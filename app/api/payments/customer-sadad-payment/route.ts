import { dhamenRoute } from "@/lib/dhamen/http";
import { createSadadPayment } from "@/lib/dhamen/services/payments";
import { schemas, validate } from "@/lib/dhamen/validation";

export const POST = dhamenRoute({
  parse: ({ body }) => validate(schemas.sadad, body),
  run: (db, input, ctx) => createSadadPayment(db, ctx, input),
});
