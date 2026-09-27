import { dhamenRoute } from "@/lib/dhamen/http";
import { createCustomerPayment } from "@/lib/dhamen/services/payments";
import { schemas, validate } from "@/lib/dhamen/validation";

export const POST = dhamenRoute({
  parse: ({ body }) => validate(schemas.customerPayment, body),
  run: (db, input, ctx) => createCustomerPayment(db, ctx, input),
});
