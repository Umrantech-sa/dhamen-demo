"use client";

import {
  AlertTriangleIcon,
  ArchiveRestoreIcon,
  ArchiveXIcon,
  Building2Icon,
  CreditCardIcon,
  DownloadIcon,
  EyeIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
  SendIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Mono } from "@/components/app/copy-button";
import { DataTable, type Column } from "@/components/app/data-table";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-input";
import { SimpleSelect } from "@/components/app/simple-select";
import { StatCard } from "@/components/app/stat-card";
import { Pill, RecordStatusBadge } from "@/components/app/status-badge";
import { PaymentLinkDialog } from "@/components/forms/payment-link-dialog";
import { SupplierFormDialog } from "@/components/forms/supplier-form-dialog";
import { demo } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import type { SupplierView } from "@/lib/client/types";
import { downloadCsv, fmtDay, initials, sar } from "@/lib/format";

export default function SuppliersPage() {
  const router = useRouter();
  const { data, loading } = useDemo<SupplierView[]>("suppliers");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [payout, setPayout] = useState("any");
  const [threshold, setThreshold] = useState("any");
  const [edit, setEdit] = useState<SupplierView | undefined>();
  const [formOpen, setFormOpen] = useState(useSearchParams().get("new") === "1");
  const [linkFor, setLinkFor] = useState<string | undefined>();
  const [toggle, setToggle] = useState<SupplierView | undefined>();

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((s) => {
      if (status !== "all" && s.status !== status) return false;
      if (payout === "pending" && s.pendingPayout <= 0) return false;
      if (payout === "failed" && s.failedPayouts === 0) return false;
      if (payout === "held" && s.balance <= 0) return false;
      if (threshold === "with" && s.payoutThresholdAmount == null) return false;
      if (threshold === "without" && s.payoutThresholdAmount != null) return false;
      if (!term) return true;
      return [s.name, s.identityNumber, s.iban, s.viban, s.email, s.mobile, s.supplierId].some((v) => v?.toLowerCase().includes(term));
    });
  }, [data, q, status, payout, threshold]);

  const all = data ?? [];
  const columns: Column<SupplierView>[] = [
    {
      key: "name",
      header: "Supplier",
      sort: (s) => s.name,
      cell: (s) => (
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-[11px] font-semibold text-orange-700">{initials(s.name)}</div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 truncate font-medium">
              {s.name}
              {s.isAuthorityFee && (
                <Pill t="purple" dot={false}>
                  Fees
                </Pill>
              )}
            </div>
            <div className="truncate text-xs text-muted-foreground">{s.email ?? "—"}</div>
          </div>
        </div>
      ),
    },
    { key: "cr", header: "Identity no.", sort: (s) => s.identityNumber, cell: (s) => <Mono>{s.identityNumber}</Mono>, className: "hidden md:table-cell" },
    {
      key: "iban",
      header: "Payout IBAN",
      cell: (s) => (
        <div className="flex items-center gap-1">
          <Mono className="text-muted-foreground">{s.iban}</Mono>
          {s.failedPayouts > 0 && (
            <span title="Transfer rejected by bank">
              <AlertTriangleIcon className="size-3.5 text-rose-600" />
            </span>
          )}
        </div>
      ),
      className: "hidden lg:table-cell",
    },
    {
      key: "threshold",
      header: "Threshold",
      sort: (s) => s.payoutThresholdAmount ?? -1,
      align: "right",
      cell: (s) =>
        s.payoutThresholdAmount != null ? (
          <Money value={s.payoutThresholdAmount} className="text-muted-foreground" />
        ) : (
          <span className="text-xs text-muted-foreground">Schedule</span>
        ),
      className: "hidden xl:table-cell",
    },
    {
      key: "balance",
      header: "VIBAN balance",
      sort: (s) => s.balance,
      align: "right",
      cell: (s) => <Money value={s.balance} className={s.balance > 0 ? "font-medium" : "text-muted-foreground"} />,
    },
    {
      key: "paid",
      header: "Paid out",
      sort: (s) => s.totalPaidOut,
      align: "right",
      cell: (s) => <Money value={s.totalPaidOut} className="text-muted-foreground" />,
      className: "hidden md:table-cell",
    },
    { key: "status", header: "Status", sort: (s) => s.status, cell: (s) => <RecordStatusBadge status={s.status} /> },
    {
      key: "created",
      header: "Created",
      sort: (s) => s.createdAt,
      cell: (s) => <span className="text-xs text-muted-foreground">{fmtDay(s.createdAt)}</span>,
      className: "hidden lg:table-cell",
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      cell: (s) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Actions" />}>
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem render={<Link href={`/suppliers/${s.supplierId}`} />}>
                <EyeIcon /> View profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEdit(s);
                  setFormOpen(true);
                }}
              >
                <PencilIcon /> Edit
              </DropdownMenuItem>
              {s.status === "active" && (
                <>
                  <DropdownMenuItem onClick={() => setLinkFor(s.supplierId)}>
                    <CreditCardIcon /> Payment link for supplier
                  </DropdownMenuItem>
                  <DropdownMenuItem render={<Link href="/payouts?new=1" />}>
                    <SendIcon /> Pay supplier
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant={s.status === "active" ? "destructive" : "default"} onClick={() => setToggle(s)}>
                {s.status === "active" ? <ArchiveXIcon /> : <ArchiveRestoreIcon />} {s.status === "active" ? "Deactivate" : "Restore"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <>
      <PageHeader
        title="Suppliers"
        description="Beneficiaries who receive released escrow funds. Each supplier has a VIBAN that collects funds before payout to their bank IBAN."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "dhamen-suppliers.csv",
                  rows.map((s) => ({
                    supplierId: s.supplierId,
                    name: s.name,
                    identityNumber: s.identityNumber,
                    iban: s.iban,
                    viban: s.viban,
                    payoutThresholdAmount: s.payoutThresholdAmount,
                    balance: s.balance,
                    totalPaidOut: s.totalPaidOut,
                    status: s.status,
                  })),
                )
              }
            >
              <DownloadIcon /> Export CSV
            </Button>
            <Button
              onClick={() => {
                setEdit(undefined);
                setFormOpen(true);
              }}
            >
              <PlusIcon /> New supplier
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total suppliers" value={all.length} icon={Building2Icon} accent="orange" />
        <StatCard label="Awaiting payout (VIBANs)" value={<Money value={all.reduce((a, s) => a + s.balance, 0)} />} accent="purple" />
        <StatCard label="Paid out to IBANs" value={<Money value={all.reduce((a, s) => a + s.totalPaidOut, 0)} />} accent="teal" />
        <StatCard
          label="Failed transfers"
          value={all.filter((s) => s.failedPayouts > 0).length}
          sub={all.some((s) => s.failedPayouts > 0) ? "Fix IBAN and re-run payout" : "All good"}
          accent="rose"
        />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search name, CR, IBAN, VIBAN…" />
          <SimpleSelect
            value={status}
            onValueChange={setStatus}
            options={[
              { value: "active", label: "Active" },
              { value: "inactive", label: "Inactive" },
              { value: "all", label: "All statuses" },
            ]}
          />
          <SimpleSelect
            value={payout}
            onValueChange={setPayout}
            options={[
              { value: "any", label: "Any payout state" },
              { value: "held", label: "Funds in VIBAN" },
              { value: "pending", label: "Pending payouts" },
              { value: "failed", label: "Failed transfers" },
            ]}
          />
          <SimpleSelect
            value={threshold}
            onValueChange={setThreshold}
            options={[
              { value: "any", label: "Any payout rule" },
              { value: "with", label: "Threshold based" },
              { value: "without", label: "Schedule based" },
            ]}
          />
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(s) => s.supplierId}
          loading={loading}
          onRowClick={(s) => router.push(`/suppliers/${s.supplierId}`)}
          initialSort={{ key: "created", dir: "desc" }}
        />
      </div>

      <SupplierFormDialog open={formOpen} onOpenChange={setFormOpen} supplier={edit} onSaved={(id) => !edit && id && router.push(`/suppliers/${id}`)} />
      <PaymentLinkDialog open={!!linkFor} onOpenChange={(o) => !o && setLinkFor(undefined)} defaultSupplierId={linkFor} />
      <ConfirmDialog
        open={!!toggle}
        onOpenChange={(o) => !o && setToggle(undefined)}
        title={toggle?.status === "active" ? `Deactivate ${toggle?.name}?` : `Restore ${toggle?.name}?`}
        description={
          toggle?.status === "active"
            ? `Soft-deletes the supplier (Dhamen has no delete API). Blocked while the VIBAN holds SAR ${sar(toggle?.balance)} or payouts are pending.`
            : "The supplier can receive payments again."
        }
        confirmLabel={toggle?.status === "active" ? "Deactivate" : "Restore"}
        destructive={toggle?.status === "active"}
        successMessage={toggle?.status === "active" ? "Supplier deactivated" : "Supplier restored"}
        onConfirm={() => demo.patch(`suppliers/${toggle!.supplierId}`, { status: toggle!.status === "active" ? "inactive" : "active" })}
      />
    </>
  );
}
