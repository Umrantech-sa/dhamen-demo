import { readDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";
import { invoiceView } from "@/lib/demo/views";
import { expireStale } from "@/lib/dhamen/services/payments";

export const GET = demoRoute(({ origin, now }) =>
  readDb((db) => {
    expireStale(db, { now, origin });
    return [...db.invoices].reverse().map((i) => invoiceView(db, origin, i));
  }),
);
