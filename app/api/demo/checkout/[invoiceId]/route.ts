import { readDb, withDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";
import { Errors } from "@/lib/dhamen/errors";
import { checkoutPay, expireStale } from "@/lib/dhamen/services/payments";

// Backing API for the hosted payment page (/pay/{invoiceId}).
export const GET = demoRoute(({ params, now, origin }) =>
  readDb((db) => {
    expireStale(db, { now, origin });
    const inv = db.invoices.find((i) => i.invoiceId === params.invoiceId);
    if (!inv) throw Errors.invoiceNotFound();
    const supplier = inv.supplierId ? db.suppliers.find((s) => s.supplierId === inv.supplierId) : undefined;
    return {
      invoiceId: inv.invoiceId,
      paymentReferenceId: inv.paymentReferenceId,
      merchantName: db.settings.merchantName,
      supplierName: supplier?.name,
      customerName: inv.name,
      customerIdentifier: inv.customerIdentifier,
      amount: inv.amount,
      status: inv.status,
      isPreAuth: inv.isPreAuth,
      enableBNPL: inv.enableBNPL,
      enableRecurring: inv.enableRecurring,
      expiresAt: inv.expiresAt,
      returnUrl: inv.returnUrl,
      paymentBrand: inv.paymentBrand,
      cardLast4: inv.cardLast4,
      rrn: inv.rrn,
      paidAt: inv.paidAt,
      lastFailureReason: inv.lastFailureReason,
    };
  }),
);

export const POST = demoRoute(
  ({ params, body, now, origin }) =>
    withDb((db) => {
      const res = checkoutPay(db, { now, origin }, params.invoiceId, {
        method: body.method === "tabby" ? "tabby" : "card",
        cardNumber: typeof body.cardNumber === "string" ? body.cardNumber : undefined,
      });
      return { outcome: res.outcome, reason: "reason" in res ? res.reason : undefined, status: res.invoice.status, rrn: res.invoice.rrn };
    }),
  { dispatch: true },
);
