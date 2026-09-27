import { readDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";

export const GET = demoRoute(() =>
  readDb((db) => {
    const held: Record<string, number> = {};
    for (const i of db.invoices) if (i.status === "authorized") held[i.accountId] = (held[i.accountId] ?? 0) + i.amount;
    const status: Record<string, string> = {};
    for (const c of db.customers) status[c.accountId] = c.status;
    for (const s of db.suppliers) status[s.accountId] = s.status;
    return {
      accounts: Object.values(db.accounts).map((a) => ({ ...a, held: held[a.accountId] ?? 0, status: status[a.accountId] ?? "active" })),
      ledger: [...db.ledger].reverse(),
    };
  }),
);
