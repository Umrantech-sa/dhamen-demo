"use client";

import { BellIcon, RotateCwIcon, WebhookIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { JsonView } from "@/components/app/json-view";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-input";
import { SimpleSelect } from "@/components/app/simple-select";
import { Pill, type Tone } from "@/components/app/status-badge";
import { demo, errorMessage } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import type { NotificationType, StoredNotification } from "@/lib/dhamen/types";
import { fmtDate, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const TYPES: { type: NotificationType; trigger: string; tone: Tone }[] = [
  { type: "Deposit_Notification", trigger: "Funds deposited into a VIBAN", tone: "green" },
  { type: "Payment_Failed_Notification", trigger: "Card payment declined", tone: "red" },
  { type: "Funds_Transferring_Notification", trigger: "Funds transferred to supplier", tone: "blue" },
  { type: "UTI_Notification", trigger: "Transfer reference for bank verification", tone: "blue" },
  { type: "Failure_Transfer_Notification", trigger: "Bank rejected transfer", tone: "red" },
  { type: "Capture_Payment_Notification", trigger: "Capture processed", tone: "purple" },
  { type: "Reverse_Payment_Notification", trigger: "Reverse processed", tone: "gray" },
  { type: "Refund_Payment_Notification", trigger: "Refund processed", tone: "orange" },
  { type: "Insufficient_Balance_Notification", trigger: "Transfer blocked by balance", tone: "amber" },
  { type: "Payment_Settled_Notification", trigger: "Card payment settled by bank", tone: "green" },
];
const toneOf = (t: string) => TYPES.find((x) => x.type === t)?.tone ?? "gray";

export default function NotificationsPage() {
  const { data } = useDemo<{ notifications: StoredNotification[]; webhookUrl: string }>("notifications", { pollMs: 10000 });
  const [q, setQ] = useState("");
  const [type, setType] = useState("any");
  const [delivery, setDelivery] = useState("any");
  const [selected, setSelected] = useState<number>();
  const [resending, setResending] = useState(false);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.notifications ?? []).filter(
      (n) =>
        (type === "any" || n.payload.NotificationType === type) &&
        (delivery === "any" || n.delivery.status === delivery) &&
        (!term || JSON.stringify(n.payload).toLowerCase().includes(term)),
    );
  }, [data, q, type, delivery]);
  const current = rows.find((n) => n.id === selected) ?? rows[0];
  const counts = Object.fromEntries(TYPES.map((t) => [t.type, (data?.notifications ?? []).filter((n) => n.payload.NotificationType === t.type).length]));

  async function resend(ids?: number[]) {
    setResending(true);
    try {
      const r = await demo.post<{ delivered: number; responseCode?: number }>("notifications/resend", { ids });
      toast.success(`Webhook batch sent · HTTP ${r.responseCode ?? "–"}`, { description: `${r.delivered} notification(s) acknowledged with status SUCCESS` });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setResending(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Appendix B · Dhamen pushes batched notifications to your webhook and retries until it answers HTTP 200 with status SUCCESS."
        actions={
          <Button variant="outline" disabled={resending || !current} onClick={() => current && resend([current.id])}>
            <RotateCwIcon /> Resend selected
          </Button>
        }
      />

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-3 text-sm">
        <WebhookIcon className="size-4 text-violet-600" />
        <span className="text-muted-foreground">Webhook endpoint</span>
        <span className="font-mono text-xs">{data ? data.webhookUrl || "not configured" : "…"}</span>
        <Link href="/settings" className="ml-auto text-xs font-medium text-primary hover:underline">
          Configure
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {TYPES.map((t) => (
          <button
            key={t.type}
            onClick={() => setType(type === t.type ? "any" : t.type)}
            className={cn("rounded-lg border bg-card p-2.5 text-left transition hover:border-violet-300", type === t.type && "border-violet-400 ring-2 ring-violet-200")}
          >
            <div className="flex items-center justify-between">
              <Pill t={t.tone} dot className="max-w-full truncate">
                {t.type.replace("_Notification", "").replace(/_/g, " ")}
              </Pill>
              <span className="text-sm font-semibold tabular-nums">{counts[t.type]}</span>
            </div>
            <div className="mt-1 truncate text-[11px] text-muted-foreground">{t.trigger}</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search payload (PaymentID, SupplierID, UTI…)" />
        <SimpleSelect
          value={delivery}
          onValueChange={setDelivery}
          options={[
            { value: "any", label: "Any delivery" },
            { value: "delivered", label: "Delivered" },
            { value: "pending", label: "Pending" },
            { value: "failed", label: "Failed" },
            { value: "not_configured", label: "No webhook" },
          ]}
        />
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} notifications</span>
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(0,420px)_1fr]">
        <div className="max-h-[640px] overflow-y-auto rounded-xl border bg-card">
          {!data && <div className="p-10 text-center text-sm text-muted-foreground">Loading notifications…</div>}
          {data && rows.length === 0 && (
            <div className="flex flex-col items-center gap-2 p-10 text-sm text-muted-foreground">
              <BellIcon className="size-5" /> No notifications
            </div>
          )}
          {rows.slice(0, 200).map((n) => (
            <button
              key={n.id}
              onClick={() => setSelected(n.id)}
              className={cn("flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left last:border-0 hover:bg-muted/40", current?.id === n.id && "bg-violet-50/70")}
            >
              <div className="flex items-center gap-2">
                <Pill t={toneOf(n.payload.NotificationType)}>{n.payload.NotificationType.replace("_Notification", "").replace(/_/g, " ")}</Pill>
                <span className="ml-auto text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-mono">#{n.id}</span>
                <span className="truncate">
                  {String((n.payload.Payment as { PaymentID?: string })?.PaymentID ?? (n.payload.Supplier as { SupplierName?: string })?.SupplierName ?? "")}
                </span>
                <span className={cn("ml-auto", n.delivery.status === "delivered" ? "text-emerald-600" : n.delivery.status === "failed" ? "text-rose-600" : "")}>
                  {n.delivery.status.replace("_", " ")}
                </span>
              </div>
            </button>
          ))}
        </div>
        {current && (
          <div className="grid content-start gap-3">
            <div className="rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-center gap-2">
                <div className="text-base font-semibold">{current.payload.NotificationType}</div>
                <span className="font-mono text-xs text-muted-foreground">NotificationId {current.id}</span>
              </div>
              <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                <div>Created {fmtDate(current.createdAt)}</div>
                <div>
                  Delivery <b className="text-foreground">{current.delivery.status}</b> · attempts {current.delivery.attempts}
                  {current.delivery.responseCode ? ` · HTTP ${current.delivery.responseCode}` : ""}
                </div>
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-medium text-muted-foreground">Request (as delivered inside a batch)</div>
              <JsonView
                value={{ Header: { BatchId: "…", BatchCreationTime: current.delivery.lastAttemptAt ?? current.createdAt }, Notifications: [current.payload] }}
                className="max-h-[440px]"
              />
            </div>
            {current.delivery.responseBody && (
              <div>
                <div className="mb-1 text-xs font-medium text-muted-foreground">Authority response</div>
                <JsonView
                  value={(() => {
                    try {
                      return JSON.parse(current.delivery.responseBody!);
                    } catch {
                      return current.delivery.responseBody;
                    }
                  })()}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
