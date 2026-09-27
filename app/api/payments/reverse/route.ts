import { dhamenRoute } from "@/lib/dhamen/http";
import { reverse } from "@/lib/dhamen/services/payments";
import { schemas, validate } from "@/lib/dhamen/validation";

export const PUT = dhamenRoute({
  parse: ({ body }) => validate(schemas.reverse, body),
  run: (db, input, ctx) => reverse(db, ctx, input),
});
