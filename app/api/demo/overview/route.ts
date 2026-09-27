import { readDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";
import { overview } from "@/lib/demo/views";
import { expireStale } from "@/lib/dhamen/services/payments";

export const GET = demoRoute(({ now, origin }) =>
  readDb((db) => {
    expireStale(db, { now, origin });
    return overview(db);
  }),
);
