import { readDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";

export const GET = demoRoute(() =>
  readDb((db) =>
    [...db.sadadInvoices].reverse().map((b) => ({
      ...b,
      supplierName: b.supplierId ? db.suppliers.find((s) => s.supplierId === b.supplierId)?.name : undefined,
      isRegisteredCustomer: b.accountId !== "AUTH",
    })),
  ),
);
