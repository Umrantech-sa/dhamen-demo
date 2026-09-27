import { readDb, withDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";
import { invoiceView, supplierViews } from "@/lib/demo/views";
import { Errors } from "@/lib/dhamen/errors";
import { setSupplierStatus } from "@/lib/dhamen/services/parties";

export const GET = demoRoute(({ params, origin }) =>
  readDb((db) => {
    const supplier = supplierViews(db).find((s) => s.supplierId === params.id);
    if (!supplier) throw Errors.supplierNotExists();
    return {
      supplier,
      invoices: db.invoices
        .filter((i) => i.supplierId === supplier.supplierId)
        .reverse()
        .map((i) => invoiceView(db, origin, i)),
      lines: db.supplierPayments
        .flatMap((r) => r.lines.map((l) => ({ ...l, paymentReferenceId: r.paymentReferenceId, source: r.source, createdAt: r.createdAt })))
        .filter((l) => l.supplierId === supplier.supplierId)
        .reverse(),
      batches: db.payoutBatches.filter((b) => b.supplierId === supplier.supplierId).reverse(),
      ledger: db.ledger.filter((l) => l.accountId === supplier.accountId).reverse(),
    };
  }),
);

export const PATCH = demoRoute(({ params, body, now, origin }) =>
  withDb((db) => setSupplierStatus(db, { now, origin }, params.id, body.status === "inactive" ? "inactive" : "active")),
);
