import { dhamenRoute } from "@/lib/dhamen/http";
import { supplierPaymentStatus } from "@/lib/dhamen/services/payouts";
import { schemas, validate } from "@/lib/dhamen/validation";

export const POST = dhamenRoute({
  mutate: false,
  parse: ({ body }) => validate(schemas.supplierPaymentStatus, body),
  run: (db, input) => supplierPaymentStatus(db, input.supplierId, input.paymentReferenceId),
});
