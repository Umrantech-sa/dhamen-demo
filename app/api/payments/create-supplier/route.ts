import { dhamenRoute } from "@/lib/dhamen/http";
import { createSupplier } from "@/lib/dhamen/services/parties";
import { schemas, validate } from "@/lib/dhamen/validation";

export const POST = dhamenRoute({
  parse: ({ body }) => validate(schemas.createSupplier, body),
  run: (db, input, ctx) => createSupplier(db, ctx, input),
});
