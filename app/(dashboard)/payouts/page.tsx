"use client";

import { AlertTriangleIcon, ArrowLeftRightIcon, CalendarClockIcon, CheckCircle2Icon, HourglassIcon, PlayIcon, SearchCheckIcon, SplitIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mono } from "@/components/app/copy-button";
import { DataTable } from "@/components/app/data-table";
import { JsonView } from "@/components/app/json-view";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-input";
import { SimpleSelect } from "@/components/app/simple-select";
import { StatCard } from "@/components/app/stat-card";
import { PayoutStatusBadge, Pill } from "@/components/app/status-badge";
import { SplitPayoutDialog } from "@/components/forms/split-payout-dialog";
import { demo, dhamen, errorMessage } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import type { PayoutBatchRow, PayoutLineRow, PayoutRecordRow } from "@/lib/client/types";
import { fmtDate, sar } from "@/lib/format";
import { cn } from "@/lib/utils";

interface PayoutsData {
  records: PayoutRecordRow[];
  batches: PayoutBatchRow[];
  schedule: string;
}

const recordStatus = (r: PayoutRecordRow): 0 | 1 | 2 => (r.lines.some((l) => l.status === 2) ? 2 : r.lines.every((l) => l.status === 1) ? 1 : 0);

export default function PayoutsPage() {
  const { data, loading } = useDemo<PayoutsData>("payouts");
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  const [defaults, setDefaults] = useState<{ fund?: string; amount?: number }>(() => ({
    fund: searchParams.get("fund") ?? undefined,
    amount: searchParams.get("amount") ? Number(searchParams.get("amount")) : undefined,
  }));
  const [running, setRunning] = useState(false);
  const [q, setQ] = useState("");
  const [source, setSource] = useState("any");
  const [status, setStatus] = useState("any");
  const [statusRes, setStatusRes] = useState<{ req: unknown; res: unknown } | null>(null);

  const records = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data?.records ?? []).filter((r) => {
      if (source !== "any" && r.source !== source) return false;
      if (status === "insufficient" && !r.lines.some((l) => !l.funded)) return false;
      if (status !== "any" && status !== "insufficient" && recordStatus(r) !== Number(status)) return false;
      if (!term) return true;
      return (
        r.paymentReferenceId.toLowerCase().includes(term) ||
        r.lines.some((l) => l.supplierName.toLowerCase().includes(term) || l.fundingLabel.toLowerCase().includes(term) || l.uti?.toLowerCase().includes(term))
      );
    });
  }, [data, q, source, status]);

  const lines = (data?.records ?? []).flatMap((r) => r.lines);
  const pending = lines.filter((l) => l.status === 0);
  const unfunded = lines.filter((l) => !l.funded);
  const failed = lines.filter((l) => l.status === 2);
  const transferred = (data?.batches ?? []).filter((b) => b.status === 1);

  async function runCycle() {
    setRunning(true);
    try {
      const r = await demo.post<{ funded: number; transferred: number; failed: number; amount: number; skipped: { reason: string }[] }>("payouts/run");
      if (!r.transferred && !r.failed) toast.info("Payout cycle complete · nothing eligible", { description: r.skipped[0]?.reason });
      else
        toast.success(`Payout cycle complete · ${r.transferred} transfer(s), SAR ${sar(r.amount)}`, {
          description: r.failed ? `${r.failed} transfer(s) rejected by beneficiary bank` : "UTI notifications sent",
        });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRunning(false);
    }
  }

  async function checkLine(ref: string, l: PayoutLineRow) {
    const req = { supplierId: l.supplierId, paymentReferenceId: ref };
    try {
      setStatusRes({ req, res: await dhamen.supplierPaymentStatus(req) });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Payouts & splits"
        description="Release escrow funds to suppliers (supplier-payment), split one collection across many suppliers, and track SARIE transfers to supplier IBANs."
        actions={
          <>
            <Button variant="outline" onClick={runCycle} disabled={running}>
              <PlayIcon /> {running ? "Running…" : "Run payout cycle"}
            </Button>
            <Button
              onClick={() => {
                setDefaults({});
                setOpen(true);
              }}
            >
              <SplitIcon /> New split payout
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Pending payout"
          value={<Money value={pending.reduce((s, l) => s + l.amount, 0)} />}
          sub={`${pending.length} supplier line(s)`}
          icon={HourglassIcon}
          accent="orange"
        />
        <StatCard
          label="Awaiting escrow funds"
          value={<Money value={unfunded.reduce((s, l) => s + l.amount, 0)} />}
          sub="Insufficient balance at source"
          icon={AlertTriangleIcon}
          accent="rose"
        />
        <StatCard
          label="Transferred to IBANs"
          value={<Money value={transferred.reduce((s, b) => s + b.amount, 0)} />}
          sub={`${transferred.length} SARIE transfer(s)`}
          icon={CheckCircle2Icon}
          accent="teal"
        />
        <StatCard
          label="Payout schedule"
          value={<span className="capitalize">{data?.schedule ?? "—"}</span>}
          sub={failed.length ? `${failed.length} failed line(s) will retry` : "Threshold payouts run instantly"}
          icon={CalendarClockIcon}
          accent="purple"
        />
      </div>

      <Tabs defaultValue="requests">
        <TabsList>
          <TabsTrigger value="requests">
            <ArrowLeftRightIcon /> Supplier payments
          </TabsTrigger>
          <TabsTrigger value="transfers">Bank transfers ({data?.batches.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="requests" className="mt-2 grid gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput value={q} onChange={setQ} placeholder="Reference, supplier, funding account, UTI…" />
            <SimpleSelect
              value={source}
              onValueChange={setSource}
              options={[
                { value: "any", label: "Any source" },
                { value: "supplier-payment", label: "Supplier payment API" },
                { value: "customer-payment", label: "Customer payment (supplierId)" },
                { value: "sadad", label: "SADAD bill" },
              ]}
            />
            <SimpleSelect
              value={status}
              onValueChange={setStatus}
              options={[
                { value: "any", label: "Any status" },
                { value: "0", label: "Pending" },
                { value: "1", label: "Transferred" },
                { value: "2", label: "Failed transfer" },
                { value: "insufficient", label: "Insufficient balance" },
              ]}
            />
          </div>
          <DataTable
            rows={records}
            loading={loading}
            rowKey={(r) => r.id}
            initialSort={{ key: "date", dir: "desc" }}
            columns={[
              {
                key: "ref",
                header: "Reference",
                sort: (r) => r.paymentReferenceId,
                cell: (r) => (
                  <div>
                    <Mono className="font-medium">{r.paymentReferenceId}</Mono>
                    <div className="text-xs text-muted-foreground capitalize">{r.source.replace("-", " ")}</div>
                  </div>
                ),
              },
              { key: "funding", header: "Funded from", cell: (r) => <span className="text-xs">{r.lines[0]?.fundingLabel}</span>, className: "hidden md:table-cell" },
              {
                key: "split",
                header: "Split",
                cell: (r) => (
                  <div className="flex flex-wrap gap-1.5">
                    {r.lines.map((l) => (
                      <button
                        key={l.lineId}
                        onClick={() => checkLine(r.paymentReferenceId, l)}
                        title="Check supplier-payment-status"
                        className={cn(
                          "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition hover:bg-muted",
                          l.status === 2 && "border-rose-200 bg-rose-50",
                          !l.funded && "border-amber-200 bg-amber-50",
                        )}
                      >
                        <span
                          className={cn("size-1.5 rounded-full", l.status === 1 ? "bg-emerald-500" : l.status === 2 ? "bg-rose-500" : l.funded ? "bg-amber-500" : "bg-amber-300")}
                        />
                        <span className="max-w-40 truncate">{l.supplierName}</span>
                        <span className="font-medium tabular-nums">{sar(l.amount)}</span>
                        <SearchCheckIcon className="size-3 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                ),
              },
              {
                key: "status",
                header: "Status",
                cell: (r) => (r.lines.some((l) => !l.funded) ? <Pill t="amber">Insufficient balance</Pill> : <PayoutStatusBadge status={recordStatus(r)} />),
              },
              {
                key: "date",
                header: "Created",
                sort: (r) => r.createdAt,
                cell: (r) => <span className="text-xs whitespace-nowrap text-muted-foreground">{fmtDate(r.createdAt)}</span>,
                className: "hidden lg:table-cell",
              },
              { key: "total", header: "Total", align: "right", sort: (r) => r.total, cell: (r) => <Money value={r.total} className="font-medium" /> },
            ]}
          />
        </TabsContent>
        <TabsContent value="transfers" className="mt-2">
          <DataTable
            rows={data?.batches}
            loading={loading}
            rowKey={(b) => b.batchId}
            columns={[
              { key: "date", header: "Date", cell: (b) => <span className="text-xs whitespace-nowrap">{fmtDate(b.createdAt)}</span> },
              {
                key: "supplier",
                header: "Beneficiary",
                cell: (b) => (
                  <div>
                    <div className="font-medium">{b.supplierName}</div>
                    <Mono className="text-muted-foreground">{b.iban}</Mono>
                  </div>
                ),
              },
              {
                key: "uti",
                header: "UTI / reason",
                cell: (b) => (b.uti ? <Mono>{b.uti}</Mono> : <span className="text-xs text-rose-600">{b.failureReason}</span>),
                className: "hidden md:table-cell",
              },
              {
                key: "refs",
                header: "Payment references",
                cell: (b) => <span className="text-xs text-muted-foreground">{b.references.map((r) => `${r.paymentReferenceId} (${sar(r.amount)})`).join(", ")}</span>,
                className: "hidden xl:table-cell",
              },
              {
                key: "trigger",
                header: "Trigger",
                cell: (b) => (
                  <Pill t={b.trigger === "threshold" ? "purple" : "blue"} dot={false}>
                    {b.trigger}
                  </Pill>
                ),
                className: "hidden lg:table-cell",
              },
              { key: "status", header: "Status", cell: (b) => <PayoutStatusBadge status={b.status} /> },
              { key: "amount", header: "Amount", align: "right", cell: (b) => <Money value={b.amount} className="font-medium" /> },
            ]}
            emptyTitle="No transfers yet"
          />
        </TabsContent>
      </Tabs>

      <SplitPayoutDialog open={open} onOpenChange={setOpen} defaultFund={defaults.fund} defaultAmount={defaults.amount} />
      <Dialog open={!!statusRes} onOpenChange={(o) => !o && setStatusRes(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Supplier payment status</DialogTitle>
            <DialogDescription>POST /api/payments/supplier-payment-status · 0 Pending · 1 Transferred · 2 FailedTransfer</DialogDescription>
          </DialogHeader>
          <JsonView value={statusRes?.req} className="max-h-24" />
          <JsonView value={statusRes?.res} />
        </DialogContent>
      </Dialog>
    </>
  );
}
