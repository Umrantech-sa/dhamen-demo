import { dhamenRoute } from "@/lib/dhamen/http";
import { Errors } from "@/lib/dhamen/errors";
import { authorityBalance } from "@/lib/dhamen/services/parties";

// authorityProfileId is "passed on url" (?authorityProfileId=...); optional in the sandbox.
export const GET = dhamenRoute({
  mutate: false,
  parse: ({ query }) => query.get("authorityProfileId") ?? undefined,
  run: (db, profileId) => {
    if (profileId && profileId.toLowerCase() !== db.authority.authorityProfileId.toLowerCase()) throw Errors.forbidden();
    return authorityBalance(db);
  },
});
