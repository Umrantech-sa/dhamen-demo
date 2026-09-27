// Supplier payments (split payouts), escrow funding and IBAN payout cycles.
import { DhamenError, Errors } from "../errors";
import { guid, r2, shortId, uti } from "../generators";
import type { Ctx, DB, PayoutBatch, SupplierPaymentLine, SupplierPaymentRecord, SupplierPaymentRequest, SupplierPaymentStatusResponse } from "../types";
import { AUTHORITY_ACCOUNT_ID, balanceOf, post, transfer } from "./accounts";
import { notify, supplierObject, transactionObject } from "./notifications";
import { findCustomer, findSupplier } from "./parties";

/** Sandbox rule: IBANs ending in 12 zeros are rejected by SARIE, to demo failed transfers. */
export const isRejectedIban = (iban: string) => /0{12}$/.test(iban);
const SARIE_REJECT = "THE ACCOUNT NUMBER PROVIDED IS INVALID Transaction SarieReject";

export function createSupplierPayment(db: DB, ctx: Ctx, req: SupplierPaymentRequest) {
  if (db.supplierPayments.some((r) => r.source === "supplier-payment" && r.paymentReferenceId === req.paymentReferenceId)) throw Errors.refExists();

  const lines: SupplierPaymentLine[] = req.supplierPayments.map((item) => {
    const supplier = findSupplier(db, item.supplierId);
    if (!supplier || supplier.status !== "active") throw Errors.supplierNotFound();
    let fundingAccountId = AUTHORITY_ACCOUNT_ID;
    if (item.customerId) {
      const customer = findCustomer(db, item.customerId);
      if (!customer) throw Errors.customerNotExists();
      fundingAccountId = customer.accountId;
    }
    return {
      lineId: shortId(),
      supplierId: supplier.supplierId,
      amount: r2(item.amount),
      customerId: item.customerId,
      fundingAccountId,
      funded: false,
      status: 0,
    };
  });

  const record: SupplierPaymentRecord = {
    id: guid(),
    paymentReferenceId: req.paymentReferenceId,
    source: "supplier-payment",
    lines,
    createdAt: ctx.now.toISOString(),
  };
  db.supplierPayments.push(record);
  fundRecord(db, ctx, record);
  runPayouts(db, ctx, "threshold", new Set(lines.map((l) => l.supplierId)));
  return record;
}

/** Earmark collected funds for a supplier (customer payment / SADAD with supplierId). */
export function earmarkForSupplier(db: DB, ctx: Ctx, source: SupplierPaymentRecord["source"], ref: string, supplierId: string, amount: number, fundingAccountId: string) {
  if (amount <= 0) return;
  const record: SupplierPaymentRecord = {
    id: guid(),
    paymentReferenceId: ref,
    source,
    lines: [{ lineId: shortId(), supplierId, amount: r2(amount), fundingAccountId, funded: false, status: 0 }],
    createdAt: ctx.now.toISOString(),
  };
  db.supplierPayments.push(record);
  fundRecord(db, ctx, record);
  runPayouts(db, ctx, "threshold", new Set([supplierId]));
}

function fundRecord(db: DB, ctx: Ctx, record: SupplierPaymentRecord) {
  for (const line of record.lines) {
    if (line.funded) continue;
    const supplier = findSupplier(db, line.supplierId)!;
    if (balanceOf(db, line.fundingAccountId) >= line.amount) {
      transfer(db, ctx, line.fundingAccountId, supplier.accountId, line.amount, record.paymentReferenceId, `Escrow release to ${supplier.name}`);
      line.funded = true;
      line.insufficientNotified = false;
    } else if (!line.insufficientNotified) {
      line.insufficientNotified = true;
      const funding = db.accounts[line.fundingAccountId];
      notify(db, ctx, "Insufficient_Balance_Notification", {
        Supplier: supplierObject(supplier),
        Transaction: {
          ...transactionObject({ transactionId: 0, amount: line.amount, createdAt: ctx.now.toISOString() }, 2, {}, 3),
          BeneficiaryName: supplier.name,
          BeneficiaryIBAN: supplier.iban,
          FundingAccount: funding.viban,
          PaymentReferences: [{ PaymentRequestId: record.paymentReferenceId, Amount: line.amount }],
        },
      });
    }
  }
}

export interface PayoutRunResult {
  funded: number;
  batches: PayoutBatch[];
  skipped: { supplierId: string; reason: string }[];
}

/**
 * Pays supplier VIBAN balances out to their IBANs.
 * - "threshold": only suppliers whose balance reached payoutThresholdAmount.
 * - "schedule"/"manual": every supplier with funded pending lines; also retries failed transfers and unfunded lines.
 */
export function runPayouts(db: DB, ctx: Ctx, trigger: PayoutBatch["trigger"], only?: Set<string>): PayoutRunResult {
  const result: PayoutRunResult = { funded: 0, batches: [], skipped: [] };

  if (trigger !== "threshold") {
    for (const record of db.supplierPayments) {
      const before = record.lines.filter((l) => l.funded).length;
      fundRecord(db, ctx, record);
      result.funded += record.lines.filter((l) => l.funded).length - before;
    }
  }

  const pending = new Map<string, { record: SupplierPaymentRecord; line: SupplierPaymentLine }[]>();
  for (const record of db.supplierPayments) {
    for (const line of record.lines) {
      if (!line.funded || line.status === 1) continue;
      if (line.status === 2 && trigger === "threshold") continue;
      if (only && !only.has(line.supplierId)) continue;
      const list = pending.get(line.supplierId) ?? [];
      list.push({ record, line });
      pending.set(line.supplierId, list);
    }
  }

  for (const [supplierId, items] of pending) {
    const supplier = findSupplier(db, supplierId)!;
    const amount = r2(items.reduce((s, i) => s + i.line.amount, 0));
    const available = balanceOf(db, supplier.accountId);
    if (trigger === "threshold") {
      if (supplier.payoutThresholdAmount == null) {
        result.skipped.push({ supplierId, reason: "Waiting for scheduled payout cycle" });
        continue;
      }
      if (available < supplier.payoutThresholdAmount) {
        result.skipped.push({ supplierId, reason: `Balance below threshold ${supplier.payoutThresholdAmount}` });
        continue;
      }
    }
    if (available < amount) {
      result.skipped.push({ supplierId, reason: "Supplier VIBAN balance lower than pending payouts" });
      continue;
    }

    const references = items.map((i) => ({ paymentReferenceId: i.record.paymentReferenceId, amount: i.line.amount }));
    const batchId = shortId();

    if (isRejectedIban(supplier.iban)) {
      const entry = post(db, ctx, {
        accountId: supplier.accountId,
        direction: "debit",
        type: "payout",
        amount,
        status: 2,
        counterparty: supplier.iban,
        description: `Payout rejected by bank: ${SARIE_REJECT}`,
      });
      const batch: PayoutBatch = {
        batchId,
        supplierId,
        amount,
        iban: supplier.iban,
        status: 2,
        transactionId: entry.transactionId,
        failureReason: SARIE_REJECT,
        references,
        trigger,
        createdAt: ctx.now.toISOString(),
      };
      db.payoutBatches.push(batch);
      result.batches.push(batch);
      for (const { line } of items) Object.assign(line, { status: 2, batchId, failureReason: SARIE_REJECT });
      notify(db, ctx, "Failure_Transfer_Notification", {
        Supplier: supplierObject(supplier),
        Transaction: {
          ...transactionObject(entry, 2, {}, 2),
          BeneficiaryName: supplier.name,
          BeneficiaryIBAN: supplier.iban,
          RejectionReason: SARIE_REJECT,
          PaymentReferences: references.map((r) => ({ PaymentRequestId: r.paymentReferenceId, Amount: r.amount })),
        },
      });
      continue;
    }

    const code = uti(ctx.now);
    const entry = post(db, ctx, {
      accountId: supplier.accountId,
      direction: "debit",
      type: "payout",
      amount,
      counterparty: supplier.iban,
      reference: code,
      description: `SARIE transfer to ${supplier.iban}`,
    });
    const batch: PayoutBatch = {
      batchId,
      supplierId,
      amount,
      iban: supplier.iban,
      status: 1,
      uti: code,
      transactionId: entry.transactionId,
      references,
      trigger,
      createdAt: ctx.now.toISOString(),
    };
    db.payoutBatches.push(batch);
    result.batches.push(batch);
    for (const { line } of items) Object.assign(line, { status: 1, batchId, failureReason: undefined });
    const txn = {
      ...transactionObject(entry, 2),
      BeneficiaryName: supplier.name,
      BeneficiaryIBAN: supplier.iban,
    };
    notify(db, ctx, "Funds_Transferring_Notification", {
      Supplier: supplierObject(supplier),
      Transaction: { ...txn, PaymentReferences: references.map((r) => ({ PaymentRequestId: r.paymentReferenceId, Amount: r.amount })) },
    });
    notify(db, ctx, "UTI_Notification", { Supplier: supplierObject(supplier), Transaction: { ...txn, UTI: code } });
  }
  return result;
}

export function supplierPaymentStatus(db: DB, supplierId: string, ref: string): SupplierPaymentStatusResponse {
  const supplier = findSupplier(db, supplierId);
  if (!supplier) throw Errors.supplierNotFound();
  const lines = db.supplierPayments
    .filter((r) => r.paymentReferenceId === ref)
    .flatMap((r) => r.lines.map((line) => ({ line, ref: r.paymentReferenceId })))
    .filter(({ line }) => line.supplierId === supplier.supplierId);
  if (!lines.length) throw new DhamenError("InvPay002", "Supplier payment not found for this paymentReferenceId", 404);

  const status: 0 | 1 | 2 = lines.some((l) => l.line.status === 2) ? 2 : lines.every((l) => l.line.status === 1) ? 1 : 0;
  const batch = status === 1 ? db.payoutBatches.find((b) => b.batchId === lines[0].line.batchId) : undefined;
  if (batch) {
    return { supplierPaymentStatus: 1, uti: batch.uti ?? null, transferredAmount: batch.amount, supplierPayments: batch.references };
  }
  return {
    supplierPaymentStatus: status,
    uti: null,
    transferredAmount: 0,
    supplierPayments: lines.map((l) => ({ paymentReferenceId: l.ref, amount: l.line.amount })),
  };
}
