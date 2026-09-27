"use client";

import { ArchiveRestoreIcon, ArchiveXIcon, CreditCardIcon, DownloadIcon, EyeIcon, MoreHorizontalIcon, PencilIcon, PiggyBankIcon, PlusIcon, UsersIcon } from "lucide-react";
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
import { RecordStatusBadge } from "@/components/app/status-badge";
import { CustomerFormDialog } from "@/components/forms/customer-form-dialog";
import { DepositDialog } from "@/components/forms/deposit-dialog";
import { PaymentLinkDialog } from "@/components/forms/payment-link-dialog";
import { demo } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import type { CustomerView } from "@/lib/client/types";
import { downloadCsv, fmtDay, initials, timeAgo } from "@/lib/format";

export default function CustomersPage() {
  const router = useRouter();
  const { data, loading } = useDemo<CustomerView[]>("customers");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("active");
  const [iban, setIban] = useState("any");
  const [balance, setBalance] = useState("any");
  const [edit, setEdit] = useState<CustomerView | undefined>();
  const [formOpen, setFormOpen] = useState(useSearchParams().get("new") === "1");
  const [deposit, setDeposit] = useState<string | undefined>();
  const [linkFor, setLinkFor] = useState<string | undefined>();
  const [toggle, setToggle] = useState<CustomerView | undefined>();

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data ?? []).filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (iban === "with" && !c.iban) return false;
      if (iban === "without" && c.iban) return false;
      if (balance === "positive" && c.balance <= 0) return false;
      if (balance === "zero" && c.balance > 0) return false;
      if (!term) return true;
      return [c.name, c.identityNumber, c.email, c.mobile, c.viban, c.bban, c.iban, c.customerId].some((v) => v?.toLowerCase().includes(term));
    });
  }, [data, q, status, iban, balance]);

  const all = data ?? [];
  const totalBalance = all.reduce((s, c) => s + c.balance, 0);

  const columns: Column<CustomerView>[] = [
    {
      key: "name",
      header: "Customer",
      sort: (c) => c.name,
      cell: (c) => (
        <div className="flex items-center gap-2.5">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[11px] font-semibold text-violet-700">{initials(c.name)}</div>
          <div className="min-w-0">
            <div className="truncate font-medium">{c.name}</div>
            <div className="truncate text-xs text-muted-foreground">{c.email ?? "—"}</div>
          </div>
        </div>
      ),
    },
    { key: "identity", header: "Identity no.", sort: (c) => c.identityNumber, cell: (c) => <Mono>{c.identityNumber}</Mono> },
    { key: "mobile", header: "Mobile", cell: (c) => <Mono className="text-muted-foreground">{c.mobile ?? "—"}</Mono>, className: "hidden md:table-cell" },
    { key: "viban", header: "Virtual IBAN", cell: (c) => <Mono className="text-muted-foreground">{c.viban}</Mono>, className: "hidden xl:table-cell" },
    {
      key: "invoices",
      header: "Payments",
      sort: (c) => c.invoiceCount,
      cell: (c) => <span className="tabular-nums">{c.invoiceCount}</span>,
      align: "right",
      className: "hidden lg:table-cell",
    },
    {
      key: "balance",
      header: "VIBAN balance",
      sort: (c) => c.balance,
      cell: (c) => <Money value={c.balance} className={c.balance > 0 ? "font-medium" : "text-muted-foreground"} />,
      align: "right",
    },
    { key: "status", header: "Status", sort: (c) => c.status, cell: (c) => <RecordStatusBadge status={c.status} /> },
    {
      key: "created",
      header: "Created",
      sort: (c) => c.createdAt,
      cell: (c) => (
        <span className="text-xs text-muted-foreground" title={timeAgo(c.lastActivity)}>
          {fmtDay(c.createdAt)}
        </span>
      ),
      className: "hidden lg:table-cell",
    },
    {
      key: "actions",
      header: "",
      className: "w-10",
      cell: (c) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Actions" />}>
              <MoreHorizontalIcon />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem render={<Link href={`/customers/${c.customerId}`} />}>
                <EyeIcon /> View profile
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setEdit(c);
                  setFormOpen(true);
                }}
              >
                <PencilIcon /> Edit
              </DropdownMenuItem>
              {c.status === "active" && (
                <>
                  <DropdownMenuItem onClick={() => setLinkFor(c.customerId)}>
                    <CreditCardIcon /> New payment link
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setDeposit(c.customerId)}>
                    <PiggyBankIcon /> Deposit money
                  </DropdownMenuItem>
                </>
              )}
              <DropdownMenuSeparator />
              <DropdownMenuItem variant={c.status === "active" ? "destructive" : "default"} onClick={() => setToggle(c)}>
                {c.status === "active" ? <ArchiveXIcon /> : <ArchiveRestoreIcon />} {c.status === "active" ? "Deactivate" : "Restore"}
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
        title="Customers"
        description="Payers registered with Dhamen. Each customer gets a dedicated virtual IBAN (VIBAN) that holds their funds in escrow."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "dhamen-customers.csv",
                  rows.map((c) => ({
                    customerId: c.customerId,
                    name: c.name,
                    identityNumber: c.identityNumber,
                    iban: c.iban,
                    email: c.email,
                    mobile: c.mobile,
                    viban: c.viban,
                    bban: c.bban,
                    balance: c.balance,
                    status: c.status,
                    createdAt: c.createdAt,
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
              <PlusIcon /> New customer
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard label="Total customers" value={all.length} icon={UsersIcon} />
        <StatCard label="Active" value={all.filter((c) => c.status === "active").length} accent="teal" />
        <StatCard label="With funds in VIBAN" value={all.filter((c) => c.balance > 0).length} accent="blue" />
        <StatCard label="Customer escrow balance" value={<Money value={totalBalance} />} accent="orange" />
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <SearchInput value={q} onChange={setQ} placeholder="Search name, ID, mobile, email, VIBAN…" />
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
            value={iban}
            onValueChange={setIban}
            options={[
              { value: "any", label: "Any IBAN" },
              { value: "with", label: "Has IBAN" },
              { value: "without", label: "No IBAN" },
            ]}
          />
          <SimpleSelect
            value={balance}
            onValueChange={setBalance}
            options={[
              { value: "any", label: "Any balance" },
              { value: "positive", label: "Balance > 0" },
              { value: "zero", label: "Zero balance" },
            ]}
          />
          {(q || status !== "active" || iban !== "any" || balance !== "any") && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setQ("");
                setStatus("active");
                setIban("any");
                setBalance("any");
              }}
            >
              Reset filters
            </Button>
          )}
        </div>
        <DataTable
          rows={rows}
          columns={columns}
          rowKey={(c) => c.customerId}
          loading={loading}
          onRowClick={(c) => router.push(`/customers/${c.customerId}`)}
          initialSort={{ key: "created", dir: "desc" }}
        />
      </div>

      <CustomerFormDialog open={formOpen} onOpenChange={setFormOpen} customer={edit} onSaved={(id) => !edit && id && router.push(`/customers/${id}`)} />
      <DepositDialog open={!!deposit} onOpenChange={(o) => !o && setDeposit(undefined)} customerId={deposit} />
      <PaymentLinkDialog open={!!linkFor} onOpenChange={(o) => !o && setLinkFor(undefined)} defaultCustomerId={linkFor} />
      <ConfirmDialog
        open={!!toggle}
        onOpenChange={(o) => !o && setToggle(undefined)}
        title={toggle?.status === "active" ? `Deactivate ${toggle?.name}?` : `Restore ${toggle?.name}?`}
        description={
          toggle?.status === "active"
            ? "Dhamen has no delete API, so customers are soft-deleted: hidden from pickers and new payments route to the authority account. Blocked while the VIBAN holds funds or payments are open."
            : "The customer becomes selectable again and payments route back to their VIBAN."
        }
        confirmLabel={toggle?.status === "active" ? "Deactivate" : "Restore"}
        destructive={toggle?.status === "active"}
        successMessage={toggle?.status === "active" ? "Customer deactivated" : "Customer restored"}
        onConfirm={() => demo.patch(`customers/${toggle!.customerId}`, { status: toggle!.status === "active" ? "inactive" : "active" })}
      />
    </>
  );
}
