import { dhamenRoute } from "@/lib/dhamen/http";
import { createSupplierPayment } from "@/lib/dhamen/services/payouts";
import { schemas, validate } from "@/lib/dhamen/validation";

export const POST = dhamenRoute({
  parse: ({ body }) => validate(schemas.supplierPayment, body),
  run: (db, input, ctx) => {
    createSupplierPayment(db, ctx, input);
  },
});
