// Delivers pending notifications to the authority webhook (Appendix B) in batches.
import { randomUUID } from "crypto";
import { readDb, withDb } from "@/lib/db/store";

export async function dispatchPending(origin: string, ids?: number[]) {
  const { pending, url } = await readDb((db) => ({
    pending: db.notifications.filter((n) => (ids ? ids.includes(n.id) : n.delivery.status === "pending")).slice(-50),
    url: db.settings.webhookUrl,
  }));
  if (!pending.length) return { delivered: 0 };
  if (!url) {
    await withDb((db) => {
      for (const n of db.notifications) if (pending.some((p) => p.id === n.id)) n.delivery.status = "not_configured";
    });
    return { delivered: 0 };
  }

  const target = url.startsWith("/") ? origin + url : url;
  const batch = {
    Header: { BatchId: randomUUID(), BatchCreationTime: new Date().toISOString() },
    Notifications: pending.map((n) => n.payload),
  };
  let responseCode = 0;
  let responseBody = "";
  try {
    const res = await fetch(target, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
      signal: AbortSignal.timeout(5000),
    });
    responseCode = res.status;
    responseBody = (await res.text()).slice(0, 2000);
  } catch (err) {
    responseBody = err instanceof Error ? err.message : String(err);
  }
  let ok = responseCode === 200;
  try {
    ok = ok && JSON.parse(responseBody).status === "SUCCESS";
  } catch {
    ok = false;
  }

  await withDb((db) => {
    const at = new Date().toISOString();
    for (const n of db.notifications) {
      if (!pending.some((p) => p.id === n.id)) continue;
      n.delivery = { status: ok ? "delivered" : "failed", attempts: n.delivery.attempts + 1, lastAttemptAt: at, responseCode, responseBody };
    }
  });
  return { delivered: ok ? pending.length : 0, responseCode };
}
