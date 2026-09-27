import { readDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";

export const GET = demoRoute(() =>
  readDb((db) => {
    const supplierName = (id: string) => db.suppliers.find((s) => s.supplierId === id)?.name ?? id;
    const accountLabel = (id: string) => db.accounts[id]?.ownerName ?? id;
    return {
      records: [...db.supplierPayments].reverse().map((r) => ({
        ...r,
        total: r.lines.reduce((s, l) => s + l.amount, 0),
        lines: r.lines.map((l) => ({
          ...l,
          supplierName: supplierName(l.supplierId),
          fundingLabel: accountLabel(l.fundingAccountId),
          uti: db.payoutBatches.find((b) => b.batchId === l.batchId)?.uti,
        })),
      })),
      batches: [...db.payoutBatches].reverse().map((b) => ({ ...b, supplierName: supplierName(b.supplierId) })),
      schedule: db.settings.payoutSchedule,
    };
  }),
);
