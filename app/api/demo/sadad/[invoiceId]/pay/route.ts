import { withDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";
import { paySadad } from "@/lib/dhamen/services/payments";

// Simulates the customer paying the bill through their bank's SADAD channel.
export const POST = demoRoute(({ params, now, origin }) => withDb((db) => paySadad(db, { now, origin }, params.invoiceId)), { dispatch: true });
