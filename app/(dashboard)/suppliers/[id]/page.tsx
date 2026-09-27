"use client";

import { AlertTriangleIcon, ArchiveRestoreIcon, ArchiveXIcon, ArrowLeftIcon, PencilIcon, PlayIcon, RefreshCwIcon, SearchCheckIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { CopyButton, Mono } from "@/components/app/copy-button";
import { DataTable } from "@/components/app/data-table";
import { InfoRow } from "@/components/app/info-row";
import { InvoiceTable } from "@/components/app/invoice-table";
import { JsonView } from "@/components/app/json-view";
import { LedgerTable } from "@/components/app/ledger-table";
import { Money } from "@/components/app/money";
import { PayoutStatusBadge, Pill, RecordStatusBadge } from "@/components/app/status-badge";
import { SupplierFormDialog } from "@/components/forms/supplier-form-dialog";
import { demo, dhamen, errorMessage } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import type { SupplierDetail } from "@/lib/client/types";
import { fmtDate, formatIban, initials, sar } from "@/lib/format";

type Line = SupplierDetail["lines"][number];

export default function SupplierDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useDemo<SupplierDetail>(`suppliers/${id}`);
  const [edit, setEdit] = useState(false);
  const [toggle, setToggle] = useState(false);
  const [running, setRunning] = useState(false);
  const [statusRes, setStatusRes] = useState<{ req: unknown; res: unknown } | null>(null);

  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!data) return <Skeleton className="h-96 rounded-xl" />;
  const s = data.supplier;
  const active = s.status === "active";
  const pct = s.payoutThresholdAmount ? Math.min(100, (s.balance / s.payoutThresholdAmount) * 100) : 0;

  async function runPayout() {
    setRunning(true);
    try {
      const r = await demo.post<{ transferred: number; failed: number; amount: number }>("payouts/run", { supplierId: s.supplierId });
      if (r.failed) toast.error("Transfer rejected by beneficiary bank (SARIE)", { description: "Failure_Transfer_Notification sent. Update the IBAN and retry." });
      else if (r.transferred) toast.success(`SAR ${sar(r.amount)} transferred to ${s.iban}`);
      else toast.info("Nothing to pay out for this supplier");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRunning(false);
    }
  }

  async function checkStatus(l: Line) {
    const req = { supplierId: s.supplierId, paymentReferenceId: l.paymentReferenceId };
    try {
      setStatusRes({ req, res: await dhamen.supplierPaymentStatus(req) });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function checkBalance() {
    try {
      const r = await dhamen.supplierBalance(s.supplierId);
      toast.success(`Available balance SAR ${sar(r.availableBalance)}`, { description: `GET /supplier-balance · VIBAN ${r.viban}` });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <Link href="/suppliers" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Suppliers
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 text-lg font-semibold text-white">
            {initials(s.name)}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{s.name}</h1>
              <RecordStatusBadge status={s.status} />
              {s.isAuthorityFee && <Pill t="purple">Authority fee account</Pill>}
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              Supplier ID <Mono>{s.supplierId}</Mono>
              <CopyButton value={s.supplierId} label="Supplier ID" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEdit(true)}>
            <PencilIcon /> Edit
          </Button>
          <Button variant="outline" onClick={() => setToggle(true)}>
            {active ? <ArchiveXIcon /> : <ArchiveRestoreIcon />} {active ? "Deactivate" : "Restore"}
          </Button>
          <Button onClick={runPayout} disabled={running}>
            <PlayIcon /> {running ? "Transferring…" : "Pay out now"}
          </Button>
        </div>
      </div>

      {s.failedPayouts > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <AlertTriangleIcon className="mt-0.5 size-4 shrink-0" />
          <div>
            <div className="font-medium">Last transfer was rejected by the beneficiary bank</div>
            <div className="text-xs">
              THE ACCOUNT NUMBER PROVIDED IS INVALID · Update the supplier IBAN via update-supplier, then pay out again. Funds remain safely in the supplier VIBAN.
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#7a3b06] via-[#c2610c] to-[#f39222] text-white shadow-lg">
          <CardContent className="grid gap-4 py-1">
            <div className="flex items-center justify-between text-xs text-white/75">
              <span>Supplier VIBAN · awaiting payout</span>
              <button onClick={checkBalance} title="supplier-balance API" className="inline-flex size-6 items-center justify-center rounded-md hover:bg-white/10">
                <RefreshCwIcon className="size-3.5" />
              </button>
            </div>
            <div className="text-3xl font-semibold tabular-nums">SAR {sar(s.balance)}</div>
            {s.payoutThresholdAmount != null ? (
              <div className="grid gap-1.5">
                <Progress value={pct} className="[&_[data-slot=progress-indicator]]:bg-white [&_[data-slot=progress-track]]:bg-white/25" />
                <div className="text-xs text-white/80">
                  {pct >= 100
                    ? "Threshold reached — auto payout"
                    : `SAR ${sar(s.payoutThresholdAmount - s.balance)} until auto-payout threshold (SAR ${sar(s.payoutThresholdAmount)})`}
                </div>
              </div>
            ) : (
              <div className="text-xs text-white/80">Paid out on the scheduled payout cycle</div>
            )}
            <div className="flex items-center justify-between font-mono text-sm">
              {formatIban(s.viban)}
              <CopyButton value={s.viban} label="VIBAN" className="text-white/70 hover:bg-white/10 hover:text-white" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Identity number">
              <Mono>{s.identityNumber}</Mono>
            </InfoRow>
            <InfoRow label="Payout IBAN">
              <Mono className={s.failedPayouts ? "text-rose-600" : ""}>{s.iban}</Mono>
            </InfoRow>
            <InfoRow label="Email">{s.email ?? "—"}</InfoRow>
            <InfoRow label="Mobile">
              <Mono>{s.mobile ?? "—"}</Mono>
            </InfoRow>
            <InfoRow label="Created">{fmtDate(s.createdAt)}</InfoRow>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Payouts</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Total paid out">
              <Money value={s.totalPaidOut} />
            </InfoRow>
            <InfoRow label="Pending release/payout">
              <Money value={s.pendingPayout} />
            </InfoRow>
            <InfoRow label="Transfers">{data.batches.length}</InfoRow>
            <InfoRow label="Last payout">{fmtDate(s.lastPayoutAt)}</InfoRow>
            <InfoRow label="Linked payment links">{data.invoices.length}</InfoRow>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="lines">
        <TabsList>
          <TabsTrigger value="lines">Supplier payments ({data.lines.length})</TabsTrigger>
          <TabsTrigger value="batches">Bank transfers ({data.batches.length})</TabsTrigger>
          <TabsTrigger value="payments">Payment links ({data.invoices.length})</TabsTrigger>
          <TabsTrigger value="ledger">VIBAN ledger</TabsTrigger>
        </TabsList>
        <TabsContent value="lines" className="mt-2">
          <DataTable
            rows={data.lines}
            rowKey={(l) => l.lineId}
            columns={[
              { key: "ref", header: "Payment reference", cell: (l) => <Mono className="font-medium">{l.paymentReferenceId}</Mono> },
              {
                key: "source",
                header: "Source",
                cell: (l) => <span className="text-xs text-muted-foreground capitalize">{l.source.replace("-", " ")}</span>,
                className: "hidden md:table-cell",
              },
              { key: "date", header: "Created", cell: (l) => <span className="text-xs text-muted-foreground">{fmtDate(l.createdAt)}</span>, className: "hidden md:table-cell" },
              {
                key: "funded",
                header: "Escrow release",
                cell: (l) =>
                  l.funded ? (
                    <Pill t="green" dot={false}>
                      Released to VIBAN
                    </Pill>
                  ) : (
                    <Pill t="amber" dot={false}>
                      Awaiting funds
                    </Pill>
                  ),
              },
              { key: "status", header: "Payout", cell: (l) => <PayoutStatusBadge status={l.status} /> },
              { key: "amount", header: "Amount", align: "right", cell: (l) => <Money value={l.amount} className="font-medium" /> },
              {
                key: "check",
                header: "",
                cell: (l) => (
                  <Button size="xs" variant="ghost" onClick={() => checkStatus(l)}>
                    <SearchCheckIcon /> Status
                  </Button>
                ),
              },
            ]}
          />
        </TabsContent>
        <TabsContent value="batches" className="mt-2">
          <DataTable
            rows={data.batches}
            rowKey={(b) => b.batchId}
            columns={[
              { key: "date", header: "Date", cell: (b) => <span className="text-xs">{fmtDate(b.createdAt)}</span> },
              { key: "uti", header: "UTI", cell: (b) => (b.uti ? <Mono>{b.uti}</Mono> : <span className="text-xs text-rose-600">{b.failureReason}</span>) },
              {
                key: "refs",
                header: "References",
                cell: (b) => <span className="text-xs text-muted-foreground">{b.references.map((r) => r.paymentReferenceId).join(", ")}</span>,
                className: "hidden lg:table-cell",
              },
              { key: "trigger", header: "Trigger", cell: (b) => <span className="text-xs capitalize">{b.trigger}</span>, className: "hidden md:table-cell" },
              { key: "status", header: "Status", cell: (b) => <PayoutStatusBadge status={b.status} /> },
              { key: "amount", header: "Amount", align: "right", cell: (b) => <Money value={b.amount} className="font-medium" /> },
            ]}
            emptyTitle="No transfers yet"
          />
        </TabsContent>
        <TabsContent value="payments" className="mt-2">
          <InvoiceTable rows={data.invoices} />
        </TabsContent>
        <TabsContent value="ledger" className="mt-2">
          <LedgerTable rows={data.ledger} />
        </TabsContent>
      </Tabs>

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
      <SupplierFormDialog open={edit} onOpenChange={setEdit} supplier={s} />
      <ConfirmDialog
        open={toggle}
        onOpenChange={setToggle}
        title={active ? "Deactivate supplier?" : "Restore supplier?"}
        description={active ? "Soft-deletes the supplier. Blocked while funds or payouts are pending." : "The supplier can receive payments again."}
        confirmLabel={active ? "Deactivate" : "Restore"}
        destructive={active}
        successMessage={active ? "Supplier deactivated" : "Supplier restored"}
        onConfirm={() => demo.patch(`suppliers/${s.supplierId}`, { status: active ? "inactive" : "active" })}
      />
    </>
  );
}
