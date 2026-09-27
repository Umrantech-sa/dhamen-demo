// Read models for the dashboard. Dhamen exposes no list/search APIs, so the
// demo backend offers these views over the same JSON store.
import { balanceOf } from "@/lib/dhamen/services/accounts";
import { collectedAmount, paymentUrl } from "@/lib/dhamen/services/payments";
import type { Customer, DB, Invoice, Supplier } from "@/lib/dhamen/types";
import { r2 } from "@/lib/dhamen/generators";

export type CustomerView = Customer & {
  balance: number;
  invoiceCount: number;
  totalPaid: number;
  lastActivity: string;
};

export type SupplierView = Supplier & {
  balance: number;
  pendingPayout: number;
  totalPaidOut: number;
  failedPayouts: number;
  lastPayoutAt?: string;
};

export type InvoiceView = Invoice & {
  paymentUrl: string;
  supplierName?: string;
  collected: number;
  accountLabel: string;
  isRegisteredCustomer: boolean;
};

export function customerViews(db: DB): CustomerView[] {
  return db.customers.map((c) => {
    const invoices = db.invoices.filter((i) => i.customerId === c.customerId);
    const lastLedger = [...db.ledger].reverse().find((l) => l.accountId === c.accountId);
    return {
      ...c,
      balance: balanceOf(db, c.accountId),
      invoiceCount: invoices.length,
      totalPaid: r2(invoices.reduce((s, i) => s + collectedAmount(i), 0)),
      lastActivity: [c.updatedAt, lastLedger?.createdAt, ...invoices.map((i) => i.updatedAt)].filter(Boolean).sort().at(-1)!,
    };
  });
}

export function supplierViews(db: DB): SupplierView[] {
  return db.suppliers.map((s) => {
    const lines = db.supplierPayments.flatMap((r) => r.lines).filter((l) => l.supplierId === s.supplierId);
    const batches = db.payoutBatches.filter((b) => b.supplierId === s.supplierId);
    return {
      ...s,
      balance: balanceOf(db, s.accountId),
      pendingPayout: r2(lines.filter((l) => l.status !== 1).reduce((sum, l) => sum + l.amount, 0)),
      totalPaidOut: r2(batches.filter((b) => b.status === 1).reduce((sum, b) => sum + b.amount, 0)),
      failedPayouts: lines.filter((l) => l.status === 2).length,
      lastPayoutAt: batches.at(-1)?.createdAt,
    };
  });
}

export function invoiceView(db: DB, origin: string, inv: Invoice): InvoiceView {
  const account = db.accounts[inv.accountId];
  return {
    ...inv,
    paymentUrl: paymentUrl({ origin }, inv),
    supplierName: inv.supplierId ? db.suppliers.find((s) => s.supplierId === inv.supplierId)?.name : undefined,
    collected: collectedAmount(inv),
    accountLabel: account ? `${account.ownerName} · ${account.viban}` : inv.accountId,
    isRegisteredCustomer: !!inv.customerId,
  };
}

export function overview(db: DB) {
  const now = Date.now();
  const day = 86400000;
  const startToday = new Date();
  startToday.setHours(0, 0, 0, 0);

  const accounts = Object.values(db.accounts);
  const sum = (xs: number[]) => r2(xs.reduce((a, b) => a + b, 0));
  const credits = db.ledger.filter((l) => l.direction === "credit" && l.status === 1);

  const inflowTypes = new Set(["card_payment", "capture", "bank_deposit", "sadad_payment"]);
  // Customer money entering escrow (excludes the authority's own float top-ups).
  const inflows = credits.filter((l) => inflowTypes.has(l.type) && !(l.accountId === "AUTH" && l.type === "bank_deposit"));
  const series = Array.from({ length: 30 }, (_, i) => {
    const d = new Date(startToday.getTime() - (29 - i) * day);
    const next = d.getTime() + day;
    const inRange = (iso: string) => {
      const t = new Date(iso).getTime();
      return t >= d.getTime() && t < next;
    };
    return {
      date: d.toISOString().slice(0, 10),
      collections: sum(inflows.filter((l) => inRange(l.createdAt)).map((l) => l.amount)),
      payouts: sum(db.payoutBatches.filter((b) => b.status === 1 && inRange(b.createdAt)).map((b) => b.amount)),
      refunds: sum(db.ledger.filter((l) => (l.type === "refund" || l.type === "refund_iban") && inRange(l.createdAt)).map((l) => l.amount)),
    };
  });

  const statusCounts: Record<string, number> = {};
  for (const i of db.invoices) statusCounts[i.status] = (statusCounts[i.status] ?? 0) + 1;

  const brandTotals: Record<string, number> = {};
  for (const i of db.invoices) if (i.paymentBrand && collectedAmount(i) > 0) brandTotals[i.paymentBrand] = r2((brandTotals[i.paymentBrand] ?? 0) + collectedAmount(i));

  const authorized = db.invoices.filter((i) => i.status === "authorized");
  return {
    authorityBalance: balanceOf(db, "AUTH"),
    escrowTotal: sum(accounts.map((a) => a.balance)),
    customerEscrow: sum(accounts.filter((a) => a.type === "customer").map((a) => a.balance)),
    supplierEscrow: sum(accounts.filter((a) => a.type === "supplier").map((a) => a.balance)),
    collectedToday: sum(inflows.filter((l) => new Date(l.createdAt) >= startToday).map((l) => l.amount)),
    collected30d: sum(series.map((s) => s.collections)),
    paidOut30d: sum(series.map((s) => s.payouts)),
    preAuthHeld: sum(authorized.map((i) => i.amount)),
    preAuthCount: authorized.length,
    pendingPayouts: sum(
      db.supplierPayments
        .flatMap((r) => r.lines)
        .filter((l) => l.status !== 1)
        .map((l) => l.amount),
    ),
    awaitingSettlement: db.invoices.filter((i) => i.reconciliationStatus === 3).length,
    unpaidLinks: db.invoices.filter((i) => i.status === "unpaid").length,
    customers: db.customers.filter((c) => c.status === "active").length,
    suppliers: db.suppliers.filter((s) => s.status === "active").length,
    series,
    statusCounts,
    brandTotals,
    recentNotifications: db.notifications.slice(-8).reverse(),
    recentInvoices: [...db.invoices]
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
      .slice(0, 6)
      .map((i) => ({
        invoiceId: i.invoiceId,
        paymentReferenceId: i.paymentReferenceId,
        name: i.name,
        amount: i.amount,
        status: i.status,
        updatedAt: i.updatedAt,
      })),
    generatedAt: new Date(now).toISOString(),
  };
}
