import { dhamenRoute } from "@/lib/dhamen/http";
import { updateCustomer } from "@/lib/dhamen/services/parties";
import { schemas, validate } from "@/lib/dhamen/validation";

export const POST = dhamenRoute({
  parse: ({ body }) => validate(schemas.createCustomer, body),
  run: (db, input, ctx) => updateCustomer(db, ctx, input),
});
