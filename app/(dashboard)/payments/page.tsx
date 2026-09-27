"use client";

import { CheckCheckIcon, DownloadIcon, PlusIcon } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { InvoiceTable } from "@/components/app/invoice-table";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-input";
import { SimpleSelect } from "@/components/app/simple-select";
import { INVOICE_STATUS } from "@/components/app/status-badge";
import { PaymentLinkDialog } from "@/components/forms/payment-link-dialog";
import { demo } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import type { InvoiceView, SupplierView } from "@/lib/client/types";
import type { InvoiceStatus } from "@/lib/dhamen/types";
import { downloadCsv } from "@/lib/format";
import { cn } from "@/lib/utils";

const TABS: { key: string; label: string; match: (i: InvoiceView) => boolean }[] = [
  { key: "all", label: "All", match: () => true },
  { key: "unpaid", label: "Open links", match: (i) => i.status === "unpaid" },
  { key: "authorized", label: "Awaiting capture", match: (i) => i.status === "authorized" },
  { key: "settlement", label: "Awaiting settlement", match: (i) => i.reconciliationStatus === 3 },
  { key: "completed", label: "Completed", match: (i) => ["paid", "captured", "partially_captured"].includes(i.status) },
  { key: "refunds", label: "Refunds", match: (i) => i.refundedAmount > 0 },
  { key: "closed", label: "Closed", match: (i) => ["reversed", "cancelled", "expired"].includes(i.status) },
];

export default function PaymentsPage() {
  const { data, loading } = useDemo<InvoiceView[]>("invoices");
  const { data: suppliers } = useDemo<SupplierView[]>("suppliers");
  const [tab, setTab] = useState("all");
  const [q, setQ] = useState("");
  const searchParams = useSearchParams();
  const [status, setStatus] = useState(searchParams.get("status") ?? "any");
  const [brand, setBrand] = useState("any");
  const [kind, setKind] = useState("any");
  const [supplier, setSupplier] = useState("any");
  const [period, setPeriod] = useState("any");
  const [min, setMin] = useState("");
  const [max, setMax] = useState("");
  const [open, setOpen] = useState(searchParams.get("new") === "1");
  const [now] = useState(() => Date.now());
  const [settleAll, setSettleAll] = useState(false);

  const base = useMemo(() => {
    const term = q.trim().toLowerCase();
    const since = period === "any" ? 0 : now - Number(period) * 86400000;
    return (data ?? []).filter((i) => {
      if (status !== "any" && i.status !== status) return false;
      if (brand !== "any" && i.paymentBrand !== brand) return false;
      if (kind === "preauth" && !i.isPreAuth) return false;
      if (kind === "bnpl" && !i.enableBNPL) return false;
      if (kind === "recurring" && !i.enableRecurring) return false;
      if (kind === "guest" && i.isRegisteredCustomer) return false;
      if (kind === "split" && (data ?? []).filter((x) => x.paymentReferenceId === i.paymentReferenceId).length < 2) return false;
      if (supplier === "none" && i.supplierId) return false;
      if (supplier !== "any" && supplier !== "none" && i.supplierId !== supplier) return false;
      if (since && new Date(i.createdAt).getTime() < since) return false;
      if (min && i.amount < Number(min)) return false;
      if (max && i.amount > Number(max)) return false;
      if (!term) return true;
      return [i.paymentReferenceId, i.name, i.customerIdentifier, i.invoiceId, i.rrn, i.supplierName, i.email, i.mobile].some((v) => v?.toLowerCase().includes(term));
    });
  }, [data, q, status, brand, kind, supplier, period, min, max, now]);

  const rows = base.filter(TABS.find((t) => t.key === tab)!.match);
  const pendingSettlement = (data ?? []).filter((i) => i.reconciliationStatus === 3).length;
  const filtersOn = q || status !== "any" || brand !== "any" || kind !== "any" || supplier !== "any" || period !== "any" || min || max;

  return (
    <>
      <PageHeader
        title="Payments"
        description="Customer payment links (customer-payment), pre-authorizations, refunds and recurring charges."
        actions={
          <>
            <Button variant="outline" disabled={!pendingSettlement} onClick={() => setSettleAll(true)}>
              <CheckCheckIcon /> Settle pending ({pendingSettlement})
            </Button>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "dhamen-payments.csv",
                  rows.map((i) => ({
                    paymentReferenceId: i.paymentReferenceId,
                    invoiceId: i.invoiceId,
                    customerIdentifier: i.customerIdentifier,
                    name: i.name,
                    amount: i.amount,
                    status: i.status,
                    paymentBrand: i.paymentBrand,
                    rrn: i.rrn,
                    reconciliationStatus: i.reconciliationStatus,
                    capturedAmount: i.capturedAmount,
                    refundedAmount: i.refundedAmount,
                    supplier: i.supplierName,
                    createdAt: i.createdAt,
                  })),
                )
              }
            >
              <DownloadIcon /> Export
            </Button>
            <Button onClick={() => setOpen(true)}>
              <PlusIcon /> New payment link
            </Button>
          </>
        }
      />

      <div className="flex gap-1 overflow-x-auto border-b">
        {TABS.map((t) => {
          const count = base.filter(t.match).length;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "-mb-px flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium whitespace-nowrap transition",
                tab === t.key ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
              <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted")}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Reference, payer, ID, RRN, invoice…" />
          <SimpleSelect
            value={status}
            onValueChange={setStatus}
            options={[{ value: "any", label: "Any status" }, ...(Object.keys(INVOICE_STATUS) as InvoiceStatus[]).map((s) => ({ value: s, label: INVOICE_STATUS[s].label }))]}
          />
          <SimpleSelect
            value={brand}
            onValueChange={setBrand}
            options={[
              { value: "any", label: "Any method" },
              { value: "MADA", label: "MADA" },
              { value: "VISA", label: "VISA" },
              { value: "MASTER", label: "Mastercard" },
              { value: "TABBY", label: "Tabby (BNPL)" },
            ]}
          />
          <SimpleSelect
            value={kind}
            onValueChange={setKind}
            options={[
              { value: "any", label: "Any type" },
              { value: "preauth", label: "Pre-authorization" },
              { value: "bnpl", label: "BNPL enabled" },
              { value: "recurring", label: "Recurring" },
              { value: "split", label: "Split bill (multi-payer)" },
              { value: "guest", label: "Guest payers" },
            ]}
          />
          <SimpleSelect
            value={supplier}
            onValueChange={setSupplier}
            className="min-w-44"
            options={[{ value: "any", label: "Any supplier" }, { value: "none", label: "No supplier" }, ...(suppliers ?? []).map((s) => ({ value: s.supplierId, label: s.name }))]}
          />
          <SimpleSelect
            value={period}
            onValueChange={setPeriod}
            options={[
              { value: "any", label: "All time" },
              { value: "1", label: "Last 24 hours" },
              { value: "7", label: "Last 7 days" },
              { value: "30", label: "Last 30 days" },
            ]}
          />
          <div className="flex items-center gap-1">
            <Input value={min} onChange={(e) => setMin(e.target.value)} placeholder="Min SAR" className="h-8 w-24 bg-card" inputMode="decimal" />
            <span className="text-muted-foreground">–</span>
            <Input value={max} onChange={(e) => setMax(e.target.value)} placeholder="Max SAR" className="h-8 w-24 bg-card" inputMode="decimal" />
          </div>
          {filtersOn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setStatus("any");
                setBrand("any");
                setKind("any");
                setSupplier("any");
                setPeriod("any");
                setMin("");
                setMax("");
              }}
            >
              Reset
            </Button>
          )}
        </div>
        <div className="text-xs text-muted-foreground">
          {rows.length} payments · volume <Money value={rows.reduce((s, i) => s + i.amount, 0)} className="font-medium text-foreground" /> · net in escrow{" "}
          <Money value={rows.reduce((s, i) => s + i.collected, 0)} className="font-medium text-foreground" />
        </div>
        <InvoiceTable rows={rows} loading={loading} pageSize={12} />
      </div>

      <PaymentLinkDialog open={open} onOpenChange={setOpen} />
      <ConfirmDialog
        open={settleAll}
        onOpenChange={setSettleAll}
        title={`Settle ${pendingSettlement} payment(s)?`}
        description="Sandbox helper simulating the acquirer's end-of-day settlement. Each payment gets reconciliationStatus 1, a Payment_Settled_Notification, and supplier-bound funds are released to supplier VIBANs."
        confirmLabel="Run settlement"
        successMessage="Settlement completed"
        onConfirm={() => demo.post("invoices/all/settle")}
      />
    </>
  );
}
