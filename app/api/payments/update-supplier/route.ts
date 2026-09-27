import { dhamenRoute } from "@/lib/dhamen/http";
import { updateSupplier } from "@/lib/dhamen/services/parties";
import { schemas, validate } from "@/lib/dhamen/validation";

export const POST = dhamenRoute({
  parse: ({ body }) => validate(schemas.updateSupplier, body),
  run: (db, input, ctx) => updateSupplier(db, ctx, input),
});
