import { dhamenRoute } from "@/lib/dhamen/http";
import { customerPaymentStatus } from "@/lib/dhamen/services/payments";
import { schemas, validate } from "@/lib/dhamen/validation";

export const POST = dhamenRoute({
  mutate: false,
  parse: ({ body }) => validate(schemas.customerPaymentStatus, body),
  run: (db, input, ctx) => customerPaymentStatus(db, ctx, input.paymentReferenceId, input.customerIdentifier),
});
