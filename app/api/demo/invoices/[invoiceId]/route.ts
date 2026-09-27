import { readDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";
import { invoiceView } from "@/lib/demo/views";
import { Errors } from "@/lib/dhamen/errors";
import { expireStale } from "@/lib/dhamen/services/payments";

export const GET = demoRoute(({ params, origin, now }) =>
  readDb((db) => {
    expireStale(db, { now, origin });
    const inv = db.invoices.find((i) => i.invoiceId === params.invoiceId);
    if (!inv) throw Errors.invoiceNotFound();
    const refs = new Set([inv.paymentReferenceId]);
    return {
      invoice: invoiceView(db, origin, inv),
      siblings: db.invoices.filter((i) => i.paymentReferenceId === inv.paymentReferenceId && i !== inv).map((i) => invoiceView(db, origin, i)),
      subsequent: db.invoices.filter((i) => i.originalPaymentReferenceId === inv.paymentReferenceId).map((i) => invoiceView(db, origin, i)),
      customer: inv.customerId ? db.customers.find((c) => c.customerId === inv.customerId) : undefined,
      supplier: inv.supplierId ? db.suppliers.find((s) => s.supplierId === inv.supplierId) : undefined,
      account: db.accounts[inv.accountId],
      ledger: db.ledger.filter((l) => l.reference && refs.has(l.reference)).reverse(),
      supplierLines: db.supplierPayments.filter((r) => refs.has(r.paymentReferenceId)).flatMap((r) => r.lines),
      notifications: db.notifications.filter((n) => (n.payload.Payment as { PaymentID?: string } | undefined)?.PaymentID === inv.paymentReferenceId).reverse(),
      apiLogs: db.apiLogs
        .filter((l) => JSON.stringify(l.request ?? {}).includes(inv.paymentReferenceId))
        .reverse()
        .slice(0, 30),
    };
  }),
);
