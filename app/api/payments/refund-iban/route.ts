import { dhamenRoute } from "@/lib/dhamen/http";
import { refundToIban } from "@/lib/dhamen/services/payments";
import { schemas, validate } from "@/lib/dhamen/validation";

export const POST = dhamenRoute({
  parse: ({ body }) => validate(schemas.refundIban, body),
  run: (db, input, ctx) => refundToIban(db, ctx, input),
});
