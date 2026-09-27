import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/dhamen/types";

const tone = {
  green: "bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300",
  blue: "bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300",
  purple: "bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300",
  amber: "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300",
  red: "bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300",
  gray: "bg-zinc-100 text-zinc-600 ring-zinc-500/20 dark:bg-zinc-500/10 dark:text-zinc-300",
  orange: "bg-orange-50 text-orange-700 ring-orange-600/20 dark:bg-orange-500/10 dark:text-orange-300",
} as const;
export type Tone = keyof typeof tone;

export function Pill({ children, t = "gray", className, dot = true }: { children: React.ReactNode; t?: Tone; className?: string; dot?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ring-1 ring-inset", tone[t], className)}>
      {dot && <span className="size-1.5 rounded-full bg-current opacity-70" />}
      {children}
    </span>
  );
}

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  unpaid: { label: "Unpaid", tone: "amber" },
  authorized: { label: "Authorized", tone: "purple" },
  paid: { label: "Paid", tone: "green" },
  captured: { label: "Captured", tone: "green" },
  partially_captured: { label: "Partially captured", tone: "blue" },
  reversed: { label: "Reversed", tone: "gray" },
  partially_refunded: { label: "Partially refunded", tone: "orange" },
  refunded: { label: "Refunded", tone: "red" },
  cancelled: { label: "Cancelled", tone: "gray" },
  expired: { label: "Expired", tone: "gray" },
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const s = INVOICE_STATUS[status];
  return <Pill t={s.tone}>{s.label}</Pill>;
}

export function PayoutStatusBadge({ status }: { status: 0 | 1 | 2 }) {
  return status === 1 ? <Pill t="green">Transferred</Pill> : status === 2 ? <Pill t="red">Failed transfer</Pill> : <Pill t="amber">Pending</Pill>;
}

export function RecordStatusBadge({ status }: { status: "active" | "inactive" }) {
  return status === "active" ? <Pill t="green">Active</Pill> : <Pill t="gray">Inactive</Pill>;
}

export function ReconBadge({ value }: { value?: 1 | 3 | null }) {
  if (value === 1)
    return (
      <Pill t="green" dot={false}>
        Settled
      </Pill>
    );
  if (value === 3)
    return (
      <Pill t="amber" dot={false}>
        Settlement pending
      </Pill>
    );
  return <span className="text-muted-foreground">—</span>;
}
