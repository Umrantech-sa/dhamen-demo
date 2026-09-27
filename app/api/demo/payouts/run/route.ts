import { withDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";
import { runPayouts } from "@/lib/dhamen/services/payouts";

// Simulates Dhamen's scheduled payout cycle (SARIE transfers to supplier IBANs).
export const POST = demoRoute(
  ({ now, origin, body }) =>
    withDb((db) => {
      const only = typeof body.supplierId === "string" ? new Set([body.supplierId]) : undefined;
      const res = runPayouts(db, { now, origin }, "schedule", only);
      return {
        funded: res.funded,
        transferred: res.batches.filter((b) => b.status === 1).length,
        failed: res.batches.filter((b) => b.status === 2).length,
        amount: res.batches.filter((b) => b.status === 1).reduce((s, b) => s + b.amount, 0),
        skipped: res.skipped,
      };
    }),
  { dispatch: true },
);
