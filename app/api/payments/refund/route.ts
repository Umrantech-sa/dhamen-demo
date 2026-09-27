import { dhamenRoute } from "@/lib/dhamen/http";
import { refund } from "@/lib/dhamen/services/payments";
import { schemas, validate } from "@/lib/dhamen/validation";

export const PUT = dhamenRoute({
  parse: ({ body }) => validate(schemas.capture, body),
  run: (db, input, ctx) => refund(db, ctx, input),
});
