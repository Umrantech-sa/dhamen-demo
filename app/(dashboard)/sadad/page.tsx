"use client";

import { CheckCircle2Icon, PlusIcon, ReceiptTextIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Mono } from "@/components/app/copy-button";
import { DataTable } from "@/components/app/data-table";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-input";
import { SimpleSelect } from "@/components/app/simple-select";
import { StatCard } from "@/components/app/stat-card";
import { Pill } from "@/components/app/status-badge";
import { SadadDialog } from "@/components/forms/sadad-dialog";
import { demo } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import type { SadadRow } from "@/lib/client/types";
import { fmtDate, sar } from "@/lib/format";

export default function SadadPage() {
  const { data, loading } = useDemo<SadadRow[]>("sadad");
  const [open, setOpen] = useState(false);
  const [pay, setPay] = useState<SadadRow>();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("any");

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter(
      (b) =>
        (status === "any" || b.status === status) &&
        (!term || [b.paymentReferenceId, b.name, b.customerIdentifier, b.billNumber, b.supplierName].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [data, q, status]);
  const all = data ?? [];

  return (
    <>
      <PageHeader
        title="SADAD bills"
        description="Invoices customers pay through SADAD in any Saudi bank channel (customer-sadad-payment)."
        actions={
          <Button onClick={() => setOpen(true)}>
            <PlusIcon /> New SADAD bill
          </Button>
        }
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <StatCard label="Bills issued" value={all.length} icon={ReceiptTextIcon} accent="teal" />
        <StatCard label="Outstanding" value={<Money value={all.filter((b) => b.status === "unpaid").reduce((s, b) => s + b.amount, 0)} />} accent="orange" />
        <StatCard
          label="Collected via SADAD"
          value={<Money value={all.filter((b) => b.status === "paid").reduce((s, b) => s + b.amount, 0)} />}
          icon={CheckCircle2Icon}
          accent="purple"
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Reference, customer, bill number…" />
        <SimpleSelect
          value={status}
          onValueChange={setStatus}
          options={[
            { value: "any", label: "Any status" },
            { value: "unpaid", label: "Unpaid" },
            { value: "paid", label: "Paid" },
          ]}
        />
      </div>
      <DataTable
        rows={rows}
        loading={loading}
        rowKey={(b) => b.invoiceId}
        columns={[
          {
            key: "ref",
            header: "Reference",
            cell: (b) => (
              <div>
                <Mono className="font-medium">{b.paymentReferenceId}</Mono>
                <div className="text-xs text-muted-foreground">{fmtDate(b.createdAt)}</div>
              </div>
            ),
          },
          {
            key: "customer",
            header: "Customer",
            cell: (b) => (
              <div>
                <div className="font-medium">{b.name}</div>
                <div className="text-xs text-muted-foreground">
                  {b.customerIdentifier}
                  {!b.isRegisteredCustomer && " · to authority VA"}
                </div>
              </div>
            ),
          },
          {
            key: "bill",
            header: "Biller / Bill no.",
            cell: (b) => (
              <Mono>
                {b.billerId} / {b.billNumber}
              </Mono>
            ),
          },
          { key: "supplier", header: "Supplier", cell: (b) => <span className="text-xs">{b.supplierName ?? "—"}</span>, className: "hidden lg:table-cell" },
          {
            key: "status",
            header: "Status",
            cell: (b) => (b.status === "paid" ? <Pill t="green">Paid {b.paidAt ? `· ${fmtDate(b.paidAt)}` : ""}</Pill> : <Pill t="amber">Unpaid</Pill>),
          },
          { key: "amount", header: "Amount", align: "right", cell: (b) => <Money value={b.amount} className="font-medium" /> },
          {
            key: "act",
            header: "",
            cell: (b) =>
              b.status === "unpaid" ? (
                <Button size="xs" variant="outline" onClick={() => setPay(b)}>
                  Simulate payment
                </Button>
              ) : null,
          },
        ]}
        emptyTitle="No SADAD bills"
      />
      <SadadDialog open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={!!pay}
        onOpenChange={(o) => !o && setPay(undefined)}
        title="Simulate SADAD payment"
        description={`Sandbox helper: ${pay?.name} pays bill ${pay?.billNumber} (SAR ${sar(pay?.amount)}) from their bank app. Funds are credited to escrow and a Deposit_Notification is sent.`}
        confirmLabel="Pay bill"
        successMessage="SADAD bill paid"
        onConfirm={() => demo.post(`sadad/${pay!.invoiceId}/pay`)}
      />
    </>
  );
}
