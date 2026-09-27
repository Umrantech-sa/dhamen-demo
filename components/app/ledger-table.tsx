"use client";

import { ArrowDownLeftIcon, ArrowUpRightIcon } from "lucide-react";
import type { LedgerEntry } from "@/lib/dhamen/types";
import { fmtDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Mono } from "./copy-button";
import { DataTable, type Column } from "./data-table";
import { Money } from "./money";
import { Pill } from "./status-badge";

export const LEDGER_LABEL: Record<LedgerEntry["type"], string> = {
  card_payment: "Card payment",
  capture: "Capture",
  bank_deposit: "Bank deposit",
  sadad_payment: "SADAD payment",
  refund: "Refund to card",
  refund_iban: "Refund to IBAN",
  transfer_in: "Escrow transfer in",
  transfer_out: "Escrow transfer out",
  payout: "Payout (SARIE)",
};

export function LedgerTable({
  rows,
  loading,
  showAccount,
  accountName,
  pageSize = 10,
}: {
  rows?: LedgerEntry[];
  loading?: boolean;
  showAccount?: boolean;
  accountName?: (id: string) => string;
  pageSize?: number;
}) {
  const columns: Column<LedgerEntry>[] = [
    {
      key: "type",
      header: "Transaction",
      cell: (l) => (
        <div className="flex items-center gap-2.5">
          <div
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-full",
              l.direction === "credit" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600",
            )}
          >
            {l.direction === "credit" ? <ArrowDownLeftIcon className="size-3.5" /> : <ArrowUpRightIcon className="size-3.5" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-medium">
              {LEDGER_LABEL[l.type]}
              {l.status === 2 && <Pill t="red">Rejected</Pill>}
            </div>
            <div className="truncate text-xs text-muted-foreground">{l.description}</div>
          </div>
        </div>
      ),
    },
    ...(showAccount
      ? [
          {
            key: "account",
            header: "Account",
            cell: (l: LedgerEntry) => <span className="text-xs">{accountName?.(l.accountId) ?? l.accountId}</span>,
            className: "hidden md:table-cell",
          },
        ]
      : []),
    { key: "ref", header: "Reference", cell: (l) => <Mono className="text-muted-foreground">{l.reference ?? "—"}</Mono>, className: "hidden lg:table-cell" },
    { key: "counterparty", header: "Counterparty", cell: (l) => <span className="text-xs text-muted-foreground">{l.counterparty ?? "—"}</span>, className: "hidden xl:table-cell" },
    { key: "txn", header: "Txn ID", cell: (l) => <Mono className="text-muted-foreground">{l.transactionId}</Mono>, className: "hidden xl:table-cell" },
    { key: "date", header: "Date", sort: (l) => l.createdAt, cell: (l) => <span className="text-xs whitespace-nowrap text-muted-foreground">{fmtDate(l.createdAt)}</span> },
    {
      key: "amount",
      header: "Amount",
      align: "right",
      sort: (l) => l.amount,
      cell: (l) => (
        <Money
          value={l.amount}
          sign={l.direction === "credit" ? "+" : "-"}
          className={cn("font-medium", l.status === 2 ? "text-muted-foreground line-through" : l.direction === "credit" ? "text-emerald-700" : "text-foreground")}
        />
      ),
    },
    { key: "bal", header: "Balance", align: "right", cell: (l) => <Money value={l.balanceAfter} className="text-muted-foreground" />, className: "hidden sm:table-cell" },
  ];
  return (
    <DataTable
      rows={rows}
      columns={columns}
      rowKey={(l) => String(l.transactionId) + l.accountId}
      loading={loading}
      pageSize={pageSize}
      emptyTitle="No transactions yet"
      emptyDescription="Deposits, payments, transfers and payouts will appear here."
    />
  );
}
