import { readDb, withDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";
import { customerViews, invoiceView } from "@/lib/demo/views";
import { Errors } from "@/lib/dhamen/errors";
import { expireStale } from "@/lib/dhamen/services/payments";
import { setCustomerStatus } from "@/lib/dhamen/services/parties";

export const GET = demoRoute(({ params, origin, now }) =>
  readDb((db) => {
    expireStale(db, { now, origin });
    const customer = customerViews(db).find((c) => c.customerId === params.id);
    if (!customer) throw Errors.customerNotExists();
    return {
      customer,
      invoices: db.invoices
        .filter((i) => i.customerId === customer.customerId)
        .reverse()
        .map((i) => invoiceView(db, origin, i)),
      sadad: db.sadadInvoices.filter((s) => s.customerIdentifier === customer.identityNumber).reverse(),
      ledger: db.ledger.filter((l) => l.accountId === customer.accountId).reverse(),
      supplierPayments: db.supplierPayments.filter((r) => r.lines.some((l) => l.customerId === customer.customerId)).reverse(),
    };
  }),
);

export const PATCH = demoRoute(({ params, body, now, origin }) =>
  withDb((db) => setCustomerStatus(db, { now, origin }, params.id, body.status === "inactive" ? "inactive" : "active")),
);
