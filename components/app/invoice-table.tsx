"use client";

import { RepeatIcon, TimerIcon, WalletCardsIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { PaymentActions } from "@/components/forms/payment-actions";
import type { InvoiceView } from "@/lib/client/types";
import { fmtDate, timeAgo } from "@/lib/format";
import { Mono } from "./copy-button";
import { DataTable, type Column } from "./data-table";
import { Money } from "./money";
import { InvoiceStatusBadge, ReconBadge } from "./status-badge";

export function BrandMark({ brand }: { brand?: string }) {
  if (!brand) return <span className="text-muted-foreground">—</span>;
  const styles: Record<string, string> = {
    VISA: "bg-[#1a1f71] text-white",
    MADA: "bg-[#84b740] text-white",
    MASTER: "bg-[#eb001b] text-white",
    TABBY: "bg-[#3bffc1] text-black",
    SADAD: "bg-[#0a7c3e] text-white",
  };
  return (
    <span className={`inline-flex h-5 items-center rounded px-1.5 text-[10px] font-bold tracking-wide ${styles[brand] ?? "bg-muted"}`}>
      {brand === "MASTER" ? "MASTERCARD" : brand}
    </span>
  );
}

export function InvoiceTable({ rows, loading, hideCustomer, pageSize = 10 }: { rows?: InvoiceView[]; loading?: boolean; hideCustomer?: boolean; pageSize?: number }) {
  const router = useRouter();
  const columns: Column<InvoiceView>[] = [
    {
      key: "ref",
      header: "Reference",
      sort: (i) => i.paymentReferenceId,
      cell: (i) => (
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Mono className="font-medium text-foreground">{i.paymentReferenceId}</Mono>
            {i.isPreAuth && (
              <span title="Pre-authorization">
                <TimerIcon className="size-3.5 text-violet-600" />
              </span>
            )}
            {i.enableRecurring && (
              <span title="Recurring enabled">
                <RepeatIcon className="size-3.5 text-sky-600" />
              </span>
            )}
            {i.enableBNPL && (
              <span title="BNPL (Tabby)">
                <WalletCardsIcon className="size-3.5 text-emerald-600" />
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground">{i.kind === "subsequent" ? `Recurring from ${i.originalPaymentReferenceId}` : fmtDate(i.createdAt)}</div>
        </div>
      ),
    },
    ...(hideCustomer
      ? []
      : [
          {
            key: "customer",
            header: "Payer",
            sort: (i: InvoiceView) => i.name,
            cell: (i: InvoiceView) => (
              <div className="min-w-0">
                <div className="truncate font-medium">{i.name}</div>
                <div className="truncate text-xs text-muted-foreground">
                  {i.customerIdentifier}
                  {!i.isRegisteredCustomer && " · guest"}
                </div>
              </div>
            ),
          },
        ]),
    {
      key: "supplier",
      header: "Supplier",
      cell: (i) => <span className="text-xs">{i.supplierName ?? <span className="text-muted-foreground">—</span>}</span>,
      className: "hidden xl:table-cell",
    },
    { key: "brand", header: "Method", cell: (i) => <BrandMark brand={i.paymentBrand} />, className: "hidden md:table-cell" },
    { key: "status", header: "Status", sort: (i) => i.status, cell: (i) => <InvoiceStatusBadge status={i.status} /> },
    { key: "recon", header: "Settlement", cell: (i) => <ReconBadge value={i.reconciliationStatus} />, className: "hidden lg:table-cell" },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sort: (i) => i.amount,
      cell: (i) => (
        <div>
          <Money value={i.amount} className="font-medium" />
          {i.refundedAmount > 0 && <div className="text-[11px] text-rose-600 tabular-nums">−{i.refundedAmount.toFixed(2)} refunded</div>}
          {i.status === "partially_captured" && <div className="text-[11px] text-sky-700 tabular-nums">{i.capturedAmount.toFixed(2)} captured</div>}
        </div>
      ),
    },
    {
      key: "updated",
      header: "Updated",
      sort: (i) => i.updatedAt,
      cell: (i) => <span className="text-xs whitespace-nowrap text-muted-foreground">{timeAgo(i.updatedAt)}</span>,
      className: "hidden sm:table-cell",
    },
    { key: "actions", header: "", className: "w-10", cell: (i) => <PaymentActions invoice={i} /> },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(i) => i.invoiceId}
      loading={loading}
      pageSize={pageSize}
      onRowClick={(i) => router.push(`/payments/${i.invoiceId}`)}
      initialSort={{ key: "updated", dir: "desc" }}
      emptyTitle="No payments"
    />
  );
}
