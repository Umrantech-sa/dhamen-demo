import { withDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";
import { Errors } from "@/lib/dhamen/errors";
import { settleInvoice } from "@/lib/dhamen/services/payments";

// Simulates the acquirer's T+1 settlement (Payment_Settled_Notification).
export const POST = demoRoute(
  ({ params, now, origin }) =>
    withDb((db) => {
      const ctx = { now, origin };
      const targets = params.invoiceId === "all" ? db.invoices.filter((i) => i.reconciliationStatus === 3) : db.invoices.filter((i) => i.invoiceId === params.invoiceId);
      if (!targets.length && params.invoiceId !== "all") throw Errors.invoiceNotFound();
      for (const inv of targets) settleInvoice(db, ctx, inv);
      return { settled: targets.length };
    }),
  { dispatch: true },
);
