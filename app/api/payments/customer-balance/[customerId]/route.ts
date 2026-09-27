import { dhamenRoute } from "@/lib/dhamen/http";
import { customerBalance } from "@/lib/dhamen/services/parties";

export const GET = dhamenRoute({
  mutate: false,
  parse: ({ params }) => params.customerId,
  run: (db, customerId) => customerBalance(db, customerId),
});
