import { dhamenRoute } from "@/lib/dhamen/http";
import { subsequentPayment } from "@/lib/dhamen/services/payments";
import { schemas, validate } from "@/lib/dhamen/validation";

export const POST = dhamenRoute({
  parse: ({ body }) => validate(schemas.subsequent, body),
  run: (db, input, ctx) => subsequentPayment(db, ctx, input),
});
