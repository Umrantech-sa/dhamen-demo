import { dhamenRoute } from "@/lib/dhamen/http";
import { depositMoney } from "@/lib/dhamen/services/parties";
import { schemas, validate } from "@/lib/dhamen/validation";

export const POST = dhamenRoute({
  parse: ({ body }) => validate(schemas.depositMoney, body),
  run: (db, input, ctx) => depositMoney(db, ctx, input),
});
