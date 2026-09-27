import { readDb, storageBackend, withDb } from "@/lib/db/store";
import { demoRoute } from "@/lib/demo/route";
import type { Settings } from "@/lib/dhamen/types";

export const GET = demoRoute(() => readDb((db) => ({ settings: db.settings, authority: db.authority, storage: storageBackend() })));

export const PUT = demoRoute(({ body }) =>
  withDb((db) => {
    const b = body as Partial<Settings>;
    const s = db.settings;
    if (typeof b.merchantName === "string" && b.merchantName.trim()) {
      s.merchantName = b.merchantName.trim();
      db.authority.name = s.merchantName;
      db.accounts.AUTH.ownerName = s.merchantName;
    }
    if (typeof b.webhookUrl === "string") s.webhookUrl = b.webhookUrl.trim();
    if (b.payoutSchedule && ["daily", "weekly", "manual"].includes(b.payoutSchedule)) s.payoutSchedule = b.payoutSchedule;
    if (typeof b.autoSettle === "boolean") s.autoSettle = b.autoSettle;
    if (typeof b.simulateLatency === "boolean") s.simulateLatency = b.simulateLatency;
    if (typeof b.defaultExpiryMinutes === "number" && b.defaultExpiryMinutes > 0) s.defaultExpiryMinutes = b.defaultExpiryMinutes;
    return { settings: s };
  }),
);
