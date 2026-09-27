import { dhamenRoute } from "@/lib/dhamen/http";
import { supplierBalance } from "@/lib/dhamen/services/parties";

export const GET = dhamenRoute({
  mutate: false,
  parse: ({ params }) => params.supplierId,
  run: (db, supplierId) => supplierBalance(db, supplierId),
});
