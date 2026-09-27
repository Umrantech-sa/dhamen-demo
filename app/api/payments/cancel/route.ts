import { dhamenRoute } from "@/lib/dhamen/http";
import { cancel } from "@/lib/dhamen/services/payments";
import { schemas, validate } from "@/lib/dhamen/validation";

export const PUT = dhamenRoute({
  parse: ({ body }) => validate(schemas.cancel, body),
  run: (db, input, ctx) => cancel(db, ctx, input),
});
