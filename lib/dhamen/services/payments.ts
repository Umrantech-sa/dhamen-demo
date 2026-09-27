// Customer payments: payment links, pre-authorization, capture/reverse,
// refunds (card + IBAN), cancellation, recurring charges and SADAD bills.
import { DhamenError, Errors } from "../errors";
import { guid, invoiceHash, r2, rrn, sadadBillNumber, sadadCustomerId } from "../generators";
import type {
  CancelRequest,
  CaptureRequest,
  Ctx,
  CustomerPaymentRequest,
  CustomerPaymentResponse,
  CustomerPaymentStatusResponse,
  DB,
  Invoice,
  InvoiceEvent,
  PaymentBrand,
  RefundIbanRequest,
  ReverseRequest,
  SadadInvoice,
  SadadPaymentRequest,
  SubsequentPaymentRequest,
} from "../types";
import { AUTHORITY_ACCOUNT_ID, balanceOf, post } from "./accounts";
import { notify, paymentObject, supplierObject, transactionObject } from "./notifications";
import { findCustomer, findSupplier } from "./parties";
import { earmarkForSupplier } from "./payouts";

export const PAID_STATES = new Set<Invoice["status"]>(["paid", "captured", "partially_captured", "partially_refunded", "refunded"]);

export const paymentUrl = (ctx: Pick<Ctx, "origin">, inv: Pick<Invoice, "invoiceId">) => `${ctx.origin}/pay/${inv.invoiceId}`;

/** Net amount currently held in escrow for this invoice. */
export const collectedAmount = (inv: Invoice) => r2((inv.isPreAuth ? inv.capturedAmount : PAID_STATES.has(inv.status) ? inv.amount : 0) - inv.refundedAmount);

function event(inv: Invoice, ctx: Ctx, type: InvoiceEvent["type"], message: string, amount?: number) {
  inv.events.push({ at: ctx.now.toISOString(), type, message, amount });
  inv.updatedAt = ctx.now.toISOString();
}

function refInUse(db: DB, ref: string) {
  return db.invoices.some((i) => i.paymentReferenceId === ref) || db.sadadInvoices.some((s) => s.paymentReferenceId === ref);
}

function collectingAccount(db: DB, identifier: string) {
  const customer = db.customers.find((c) => c.status === "active" && (c.identityNumber === identifier || c.customerId.toLowerCase() === identifier.toLowerCase()));
  return customer ? { accountId: customer.accountId, customerId: customer.customerId } : { accountId: AUTHORITY_ACCOUNT_ID, customerId: undefined };
}

export function expireStale(db: DB, ctx: Ctx) {
  for (const inv of db.invoices) {
    if (inv.status === "unpaid" && inv.expiresAt && new Date(inv.expiresAt) < ctx.now) {
      inv.status = "expired";
      inv.events.push({ at: inv.expiresAt, type: "expired", message: "Payment link expired" });
    }
  }
}

function findInvoice(db: DB, ref: string, identifier: string) {
  const inv = db.invoices.find((i) => i.paymentReferenceId === ref && i.customerIdentifier.toLowerCase() === identifier.toLowerCase());
  if (!inv) throw Errors.invoiceNotFound();
  return inv;
}

function assertRequestId(inv: Invoice, requestId: string | undefined, partial: boolean, op: string) {
  if (partial && !requestId) throw Errors.validation({ requestId: [`requestId is required in case of partial ${op}`] });
  if (requestId && [...inv.captures, ...inv.refunds].some((m) => m.requestId === requestId)) throw Errors.validation({ requestId: ["requestId must be unique"] });
}

// ---------- Customer Payment ----------

export function createCustomerPayment(db: DB, ctx: Ctx, req: CustomerPaymentRequest): CustomerPaymentResponse {
  expireStale(db, ctx);
  if (refInUse(db, req.paymentReferenceId)) throw Errors.refExists();
  const identifiers = req.customerPayments.map((c) => c.customerIdentifier.toLowerCase());
  if (new Set(identifiers).size !== identifiers.length) throw Errors.duplicateIdentifier();
  for (const item of req.customerPayments) {
    if (!(item.amount > 0)) throw Errors.amountZero();
    if (item.amount < 1) throw Errors.validation({ amount: ["Amount must be minimum of 1"] });
    if (item.supplierId) {
      const s = findSupplier(db, item.supplierId);
      if (!s || s.status !== "active") throw Errors.supplierNotFound();
    }
  }

  const minutes = req.paymentExpiredOnMinutes ?? db.settings.defaultExpiryMinutes;
  const expiresAt = minutes ? new Date(ctx.now.getTime() + minutes * 60000).toISOString() : undefined;

  const created = req.customerPayments.map((item) => {
    const { accountId, customerId } = collectingAccount(db, item.customerIdentifier);
    const inv: Invoice = {
      invoiceId: invoiceHash(),
      paymentReferenceId: req.paymentReferenceId,
      customerIdentifier: item.customerIdentifier,
      name: item.name,
      amount: r2(item.amount),
      supplierId: item.supplierId ? findSupplier(db, item.supplierId)!.supplierId : undefined,
      isPreAuth: !!item.isPreAuth,
      enableBNPL: !!item.enableBNPL,
      enableRecurring: !!item.enableRecurring,
      mobile: item.mobile,
      email: item.email,
      returnUrl: item.returnUrl,
      expiresAt,
      kind: "link",
      status: "unpaid",
      accountId,
      customerId,
      capturedAmount: 0,
      refundedAmount: 0,
      captures: [],
      refunds: [],
      failedAttempts: 0,
      events: [],
      createdAt: ctx.now.toISOString(),
      updatedAt: ctx.now.toISOString(),
    };
    event(inv, ctx, "created", `Payment link created${inv.isPreAuth ? " (pre-authorization)" : ""}`, inv.amount);
    db.invoices.push(inv);
    return inv;
  });

  return {
    customerPayments: created.map((inv) => ({ customerIdentifier: inv.customerIdentifier, paymentUrl: paymentUrl(ctx, inv), invoiceId: inv.invoiceId })),
  };
}

export function customerPaymentStatus(db: DB, ctx: Ctx, ref: string, identifier?: string): CustomerPaymentStatusResponse {
  expireStale(db, ctx);
  const list = db.invoices.filter((i) => i.paymentReferenceId === ref && (!identifier || i.customerIdentifier.toLowerCase() === identifier.toLowerCase()));
  if (!list.length) throw Errors.invoiceNotFound();
  return {
    customerPayments: list.map((i) => ({
      paymentReferenceId: i.paymentReferenceId,
      customerIdentifier: i.customerIdentifier,
      amount: i.amount,
      paymentStatus: PAID_STATES.has(i.status) || i.status === "authorized" ? 1 : 0,
      paymentBrand: i.paymentBrand ?? null,
      paymentUrl: paymentUrl(ctx, i),
      rrn: i.rrn ?? null,
      reconciliationStatus: i.reconciliationStatus ?? null,
    })),
  };
}

// ---------- Funds received / settlement ----------

function creditInvoice(db: DB, ctx: Ctx, inv: Invoice, amount: number, kind: "card_payment" | "capture") {
  const entry = post(db, ctx, {
    accountId: inv.accountId,
    direction: "credit",
    type: kind,
    amount,
    reference: inv.paymentReferenceId,
    counterparty: `${inv.paymentBrand ?? "Card"} •••• ${inv.cardLast4 ?? "0000"}`,
    description: kind === "capture" ? `Captured pre-authorization (${inv.name})` : `Card payment from ${inv.name}`,
  });
  inv.reconciliationStatus = 3;
  return entry;
}

/** Bank settlement (T+1): marks payment settled and releases supplier-bound funds to the supplier VIBAN. */
export function settleInvoice(db: DB, ctx: Ctx, inv: Invoice) {
  if (inv.reconciliationStatus !== 3) throw new DhamenError("DEMO03", "Invoice is not awaiting settlement");
  inv.reconciliationStatus = 1;
  event(inv, ctx, "settled", "Settled by acquiring bank and deposited into virtual IBAN");
  const supplier = inv.supplierId ? findSupplier(db, inv.supplierId) : undefined;
  const amount = collectedAmount(inv);
  notify(db, ctx, "Payment_Settled_Notification", {
    Payment: paymentObject(db, inv),
    ...(supplier ? { Supplier: supplierObject(supplier) } : {}),
    Transaction: transactionObject({ transactionId: db.counters.transaction, amount, createdAt: ctx.now.toISOString() }, 1),
  });
  if (supplier && amount > 0) {
    const available = Math.min(amount, balanceOf(db, inv.accountId));
    earmarkForSupplier(db, ctx, "customer-payment", inv.paymentReferenceId, supplier.supplierId, amount, inv.accountId);
    event(inv, ctx, "funds_to_supplier", available >= amount ? `Funds released to ${supplier.name} VIBAN` : `Funds earmarked for ${supplier.name} (awaiting balance)`, amount);
  }
}

function afterFundsReceived(db: DB, ctx: Ctx, inv: Invoice) {
  if (db.settings.autoSettle) settleInvoice(db, ctx, inv);
}

// ---------- Hosted checkout (demo) ----------

const MADA_BINS = ["446404", "440647", "440795", "457865", "968208", "588845", "504300", "636120", "529415", "543357"];

export function detectBrand(card: string): Exclude<PaymentBrand, "TABBY" | "SADAD"> | null {
  const n = card.replace(/\D/g, "");
  if (MADA_BINS.some((b) => n.startsWith(b))) return "MADA";
  if (n.startsWith("4")) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(n)) return "MASTER";
  return null;
}

const DECLINES: Record<string, string> = {
  "0002": "transaction declined by authorization system",
  "9995": "insufficient funds",
  "0069": "expired card",
};

export function checkoutPay(db: DB, ctx: Ctx, invoiceId: string, input: { method: "card" | "tabby"; cardNumber?: string }) {
  expireStale(db, ctx);
  const inv = db.invoices.find((i) => i.invoiceId === invoiceId);
  if (!inv) throw Errors.invoiceNotFound();
  if (inv.status !== "unpaid") throw new DhamenError("InvPay007", `Payment link is ${inv.status}`);

  const digits = (input.cardNumber ?? "").replace(/\D/g, "");
  const brand: PaymentBrand | null = input.method === "tabby" ? "TABBY" : detectBrand(digits);
  if (!brand) throw Errors.validation({ cardNumber: ["Unsupported card. Use MADA, VISA or Mastercard."] });
  const last4 = input.method === "tabby" ? "BNPL" : digits.slice(-4);
  const decline = input.method === "card" ? DECLINES[last4] : undefined;

  if (decline) {
    inv.failedAttempts += 1;
    inv.lastFailureReason = decline;
    event(inv, ctx, "attempt_failed", `${brand} •••• ${last4} declined: ${decline}`);
    notify(db, ctx, "Payment_Failed_Notification", {
      Payment: paymentObject(db, inv, { PaymentBrand: brand, RejectionReason: decline }),
    });
    return { outcome: "declined" as const, reason: decline, invoice: inv };
  }

  inv.paymentBrand = brand;
  inv.cardLast4 = last4;
  inv.rrn = rrn();
  inv.paidAt = ctx.now.toISOString();

  if (inv.isPreAuth) {
    inv.status = "authorized";
    event(inv, ctx, "authorized", `${inv.amount.toFixed(2)} SAR held on ${brand} •••• ${last4} (pre-authorization)`, inv.amount);
  } else {
    inv.status = "paid";
    const entry = creditInvoice(db, ctx, inv, inv.amount, "card_payment");
    event(inv, ctx, "paid", `Paid with ${brand === "TABBY" ? "Tabby (BNPL)" : `${brand} •••• ${last4}`}`, inv.amount);
    notify(db, ctx, "Deposit_Notification", { Payment: paymentObject(db, inv), Transaction: transactionObject(entry, 1) });
    afterFundsReceived(db, ctx, inv);
  }
  return { outcome: "success" as const, invoice: inv };
}

// ---------- Capture / Reverse ----------

export function capture(db: DB, ctx: Ctx, req: CaptureRequest) {
  const inv = findInvoice(db, req.paymentReferenceId, req.customerIdentifier);
  if (inv.status === "captured" || inv.status === "partially_captured" || (inv.isPreAuth && inv.capturedAmount > 0)) throw Errors.alreadyCaptured();
  if (inv.status === "reversed") throw Errors.alreadyReversed();
  if (inv.status !== "authorized") throw Errors.invoiceShouldBePaid();
  const amount = r2(req.amount ?? inv.amount);
  if (amount > inv.amount) throw Errors.validation({ amount: ["Capture amount exceeds authorized amount"] });
  const partial = amount < inv.amount;
  assertRequestId(inv, req.requestId, partial, "capture");

  inv.capturedAmount = amount;
  inv.captures.push({ requestId: req.requestId, amount, at: ctx.now.toISOString() });
  inv.status = partial ? "partially_captured" : "captured";
  const entry = creditInvoice(db, ctx, inv, amount, "capture");
  event(inv, ctx, "captured", partial ? `Partially captured; ${r2(inv.amount - amount).toFixed(2)} SAR released to card` : "Captured in full", amount);
  notify(db, ctx, "Capture_Payment_Notification", {
    Payment: paymentObject(db, inv, req.requestId ? { RequestID: req.requestId } : {}),
    Transaction: transactionObject(entry, 1),
  });
  afterFundsReceived(db, ctx, inv);
}

export function reverse(db: DB, ctx: Ctx, req: ReverseRequest) {
  const inv = findInvoice(db, req.paymentReferenceId, req.customerIdentifier);
  if (inv.status === "reversed") throw Errors.alreadyReversed();
  if (inv.status === "captured" || inv.status === "partially_captured") throw Errors.alreadyCaptured();
  if (inv.status !== "authorized") throw Errors.invoiceShouldBePaid();
  inv.status = "reversed";
  event(inv, ctx, "reversed", `Authorization reversed; ${inv.amount.toFixed(2)} SAR released on customer's card`, inv.amount);
  notify(db, ctx, "Reverse_Payment_Notification", { Payment: paymentObject(db, inv) });
}

// ---------- Refunds ----------

function refundCore(db: DB, ctx: Ctx, inv: Invoice, amountReq: number | undefined, requestId: string | undefined, toIban?: { iban: string; name: string }) {
  if (inv.status === "refunded") throw Errors.alreadyRefunded();
  if (!PAID_STATES.has(inv.status)) throw Errors.invoiceShouldBePaid();
  const refundable = collectedAmount(inv);
  if (refundable <= 0) throw Errors.alreadyRefunded();
  const amount = r2(amountReq ?? refundable);
  if (amount > refundable) throw Errors.validation({ amount: [`Amount exceeds refundable amount ${refundable.toFixed(2)}`] });
  assertRequestId(inv, requestId, amount < refundable, "refund");
  if (balanceOf(db, inv.accountId) < amount) throw Errors.insufficientRefund();

  const entry = post(db, ctx, {
    accountId: inv.accountId,
    direction: "debit",
    type: toIban ? "refund_iban" : "refund",
    amount,
    reference: inv.paymentReferenceId,
    counterparty: toIban ? toIban.iban : `${inv.paymentBrand ?? "Card"} •••• ${inv.cardLast4 ?? ""}`,
    description: toIban ? `Refund to IBAN of ${toIban.name}` : `Refund to ${inv.name}'s card`,
  });
  inv.refundedAmount = r2(inv.refundedAmount + amount);
  inv.refunds.push({ requestId, amount, at: ctx.now.toISOString(), iban: toIban?.iban, beneficiaryName: toIban?.name });
  inv.status = collectedAmount(inv) <= 0 ? "refunded" : "partially_refunded";
  event(
    inv,
    ctx,
    toIban ? "refunded_iban" : "refunded",
    toIban ? `Refunded to IBAN ${toIban.iban} (${toIban.name})` : `Refunded to ${inv.paymentBrand ?? "card"} •••• ${inv.cardLast4 ?? ""}`,
    amount,
  );
  notify(db, ctx, "Refund_Payment_Notification", {
    Payment: paymentObject(db, inv, requestId ? { RequestID: requestId } : {}),
    Transaction: transactionObject(entry, 3, {
      CustomerIdentityNumber: inv.customerIdentifier,
      ...(toIban ? { BeneficiaryName: toIban.name, BeneficiaryIBAN: toIban.iban } : {}),
    }),
  });
}

export function refund(db: DB, ctx: Ctx, req: CaptureRequest) {
  const inv = findInvoice(db, req.paymentReferenceId, req.customerIdentifier);
  refundCore(db, ctx, inv, req.amount, req.requestId);
}

export function refundToIban(db: DB, ctx: Ctx, req: RefundIbanRequest) {
  const list = db.invoices.filter((i) => i.paymentReferenceId === req.paymentReferenceId);
  if (!list.length) throw Errors.invoiceNotFound();
  const inv = list.find((i) => PAID_STATES.has(i.status) && collectedAmount(i) > 0) ?? list[0];
  refundCore(db, ctx, inv, req.amount, req.requestId, { iban: req.iban, name: req.customerName });
}

// ---------- Cancel ----------

export function cancel(db: DB, ctx: Ctx, req: CancelRequest) {
  expireStale(db, ctx);
  const list = db.invoices.filter(
    (i) => i.paymentReferenceId === req.paymentReferenceId && (!req.customerIdentifier || i.customerIdentifier.toLowerCase() === req.customerIdentifier.toLowerCase()),
  );
  if (!list.length) throw Errors.invoiceNotFound();
  const unpaid = list.filter((i) => i.status === "unpaid");
  if (!unpaid.length || (req.customerIdentifier && unpaid.length !== list.length)) throw Errors.shouldBeUnpaid();
  for (const inv of unpaid) {
    inv.status = "cancelled";
    event(inv, ctx, "cancelled", "Payment link cancelled by authority");
  }
}

// ---------- Subsequent (recurring) ----------

export function subsequentPayment(db: DB, ctx: Ctx, req: SubsequentPaymentRequest) {
  const original = db.invoices.find((i) => i.paymentReferenceId === req.originalPaymentReferenceId && i.customerIdentifier.toLowerCase() === req.customerIdentifier.toLowerCase());
  if (!original) throw Errors.invoiceNotFound();
  if (!original.enableRecurring || !PAID_STATES.has(original.status)) throw Errors.recurringNotSupported();
  if (refInUse(db, req.paymentReferenceId)) throw Errors.refExists();
  if (!(req.amount > 0)) throw Errors.amountZero();

  const inv: Invoice = {
    ...structuredClone(original),
    invoiceId: invoiceHash(),
    paymentReferenceId: req.paymentReferenceId,
    amount: r2(req.amount),
    kind: "subsequent",
    originalPaymentReferenceId: original.paymentReferenceId,
    isPreAuth: false,
    enableRecurring: true,
    status: "paid",
    rrn: rrn(),
    paidAt: ctx.now.toISOString(),
    expiresAt: undefined,
    reconciliationStatus: undefined,
    capturedAmount: 0,
    refundedAmount: 0,
    captures: [],
    refunds: [],
    failedAttempts: 0,
    lastFailureReason: undefined,
    events: [],
    createdAt: ctx.now.toISOString(),
    updatedAt: ctx.now.toISOString(),
  };
  event(inv, ctx, "created", `Recurring charge on saved card from ${original.paymentReferenceId}`, inv.amount);
  db.invoices.push(inv);
  const entry = creditInvoice(db, ctx, inv, inv.amount, "card_payment");
  event(inv, ctx, "paid", `Charged ${inv.paymentBrand} •••• ${inv.cardLast4} without customer interaction`, inv.amount);
  notify(db, ctx, "Deposit_Notification", { Payment: paymentObject(db, inv), Transaction: transactionObject(entry, 1) });
  afterFundsReceived(db, ctx, inv);
  return { customerIdentifier: inv.customerIdentifier, invoiceId: inv.invoiceId };
}

// ---------- SADAD ----------

export function createSadadPayment(db: DB, ctx: Ctx, req: SadadPaymentRequest) {
  if (refInUse(db, req.paymentReferenceId)) throw Errors.refExists();
  if (req.supplierId) {
    const s = findSupplier(db, req.supplierId);
    if (!s || s.status !== "active") throw Errors.supplierNotFound();
  }
  const { accountId } = collectingAccount(db, req.customerIdentifier);
  const bill: SadadInvoice = {
    invoiceId: guid(),
    paymentReferenceId: req.paymentReferenceId,
    name: req.name,
    customerIdentifier: req.customerIdentifier,
    amount: r2(req.amount),
    supplierId: req.supplierId ? findSupplier(db, req.supplierId)!.supplierId : undefined,
    email: req.email,
    mobile: req.mobile,
    customerId: sadadCustomerId(),
    billerId: "312",
    billNumber: sadadBillNumber(),
    status: "unpaid",
    accountId,
    createdAt: ctx.now.toISOString(),
  };
  db.sadadInvoices.push(bill);
  return { invoiceId: bill.invoiceId, customerId: bill.customerId, billerId: bill.billerId, billNumber: bill.billNumber };
}

export function paySadad(db: DB, ctx: Ctx, invoiceId: string) {
  const bill = db.sadadInvoices.find((b) => b.invoiceId === invoiceId);
  if (!bill) throw Errors.invoiceNotFound();
  if (bill.status !== "unpaid") throw new DhamenError("InvPay003", `SADAD bill is ${bill.status}`);
  bill.status = "paid";
  bill.paidAt = ctx.now.toISOString();
  const entry = post(db, ctx, {
    accountId: bill.accountId,
    direction: "credit",
    type: "sadad_payment",
    amount: bill.amount,
    reference: bill.paymentReferenceId,
    counterparty: `SADAD ${bill.billerId}/${bill.billNumber}`,
    description: `SADAD bill paid by ${bill.name}`,
  });
  const customer = findCustomer(db, bill.customerIdentifier);
  notify(db, ctx, "Deposit_Notification", {
    Payment: {
      PaymentID: bill.paymentReferenceId,
      PaymentAmount: bill.amount,
      CustomerID: customer?.customerId ?? bill.customerIdentifier,
      ...(bill.supplierId ? { SupplierID: bill.supplierId } : {}),
      PaymentBrand: "SADAD",
      CustomerIdentityNumber: bill.customerIdentifier,
    },
    Transaction: transactionObject(entry, 1),
  });
  if (bill.supplierId) earmarkForSupplier(db, ctx, "sadad", bill.paymentReferenceId, bill.supplierId, bill.amount, bill.accountId);
}
