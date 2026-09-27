"use client";

import { Building2Icon, LandmarkIcon, PiggyBankIcon, RefreshCwIcon, ShieldCheckIcon, UserIcon, XIcon } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CopyButton, Mono } from "@/components/app/copy-button";
import { DataTable } from "@/components/app/data-table";
import { LEDGER_LABEL, LedgerTable } from "@/components/app/ledger-table";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { SearchInput } from "@/components/app/search-input";
import { SimpleSelect } from "@/components/app/simple-select";
import { StatCard } from "@/components/app/stat-card";
import { Pill } from "@/components/app/status-badge";
import { DepositDialog } from "@/components/forms/deposit-dialog";
import { dhamen, errorMessage } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import type { AccountRow } from "@/lib/client/types";
import type { LedgerEntry } from "@/lib/dhamen/types";
import { formatIban, sar } from "@/lib/format";
import { cn } from "@/lib/utils";

export default function EscrowPage() {
  const { data, loading } = useDemo<{ accounts: AccountRow[]; ledger: LedgerEntry[] }>("accounts");
  const [deposit, setDeposit] = useState(false);
  const [q, setQ] = useState("");
  const [type, setType] = useState("any");
  const [only, setOnly] = useState("funded");
  const [selected, setSelected] = useState<AccountRow>();
  const [ledgerType, setLedgerType] = useState("any");
  const [direction, setDirection] = useState("any");

  const accounts = useMemo(() => data?.accounts ?? [], [data]);
  const authority = accounts.find((a) => a.type === "authority");
  const sum = (t: string) => accounts.filter((a) => a.type === t).reduce((s, a) => s + a.balance, 0);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return accounts.filter((a) => {
      if (type !== "any" && a.type !== type) return false;
      if (only === "funded" && a.balance <= 0 && a.held <= 0) return false;
      if (!term) return true;
      return [a.ownerName, a.viban, a.bban, a.ownerId].some((v) => v.toLowerCase().includes(term));
    });
  }, [accounts, q, type, only]);

  const ledger = useMemo(
    () =>
      (data?.ledger ?? []).filter((l) => {
        if (selected && l.accountId !== selected.accountId) return false;
        if (ledgerType !== "any" && l.type !== ledgerType) return false;
        if (direction !== "any" && l.direction !== direction) return false;
        return true;
      }),
    [data, selected, ledgerType, direction],
  );

  const names = Object.fromEntries(accounts.map((a) => [a.accountId, a.ownerName]));

  async function checkAuthority() {
    try {
      const r = await dhamen.authorityBalance();
      toast.success(`Authority balance SAR ${sar(r.availableBalance)}`, { description: `GET /get-authority-balance · ${r.bban}` });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <>
      <PageHeader
        title="Escrow accounts"
        description="Every virtual account Dhamen holds for you — authority VA, customer VIBANs and supplier VIBANs — with a full double-entry ledger."
        actions={
          <Button onClick={() => setDeposit(true)}>
            <PiggyBankIcon /> Deposit money
          </Button>
        }
      />

      <div className="grid gap-3 lg:grid-cols-4">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#2a1650] via-[#4b2a84] to-[#7b4cc4] text-white shadow-lg lg:col-span-2">
          <div className="pointer-events-none absolute -right-12 -bottom-16 size-56 rounded-full bg-orange-400/25 blur-3xl" />
          <CardContent className="relative grid gap-4 py-1">
            <div className="flex items-center justify-between text-xs text-white/75">
              <span className="flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3.5" /> Authority virtual account · {authority?.ownerName}
              </span>
              <button onClick={checkAuthority} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-white/10">
                <RefreshCwIcon className="size-3" /> API
              </button>
            </div>
            <div>
              <div className="text-xs text-white/70">Available balance</div>
              <div className="text-4xl font-semibold tabular-nums">SAR {sar(authority?.balance)}</div>
            </div>
            <div className="flex items-center gap-2 font-mono text-sm tracking-wider">
              {formatIban(authority?.viban)}
              {authority && <CopyButton value={authority.viban} label="Authority IBAN" className="text-white/70 hover:bg-white/10 hover:text-white" />}
            </div>
          </CardContent>
        </Card>
        <StatCard
          label="Customer VIBANs"
          value={<Money value={sum("customer")} />}
          sub={`${accounts.filter((a) => a.type === "customer").length} accounts`}
          icon={UserIcon}
          accent="purple"
        />
        <StatCard
          label="Supplier VIBANs (awaiting payout)"
          value={<Money value={sum("supplier")} />}
          sub={`Pre-auth holds on cards SAR ${sar(accounts.reduce((s, a) => s + a.held, 0))}`}
          icon={Building2Icon}
          accent="orange"
        />
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-base font-semibold">Virtual accounts</h2>
          <SearchInput value={q} onChange={setQ} placeholder="Owner, VIBAN, BBAN…" />
          <SimpleSelect
            value={type}
            onValueChange={setType}
            options={[
              { value: "any", label: "All types" },
              { value: "authority", label: "Authority" },
              { value: "customer", label: "Customers" },
              { value: "supplier", label: "Suppliers" },
            ]}
          />
          <SimpleSelect
            value={only}
            onValueChange={setOnly}
            options={[
              { value: "funded", label: "With balance / holds" },
              { value: "all", label: "All accounts" },
            ]}
          />
        </div>
        <DataTable
          rows={rows}
          loading={loading}
          rowKey={(a) => a.accountId}
          pageSize={8}
          onRowClick={(a) => setSelected((s) => (s?.accountId === a.accountId ? undefined : a))}
          initialSort={{ key: "balance", dir: "desc" }}
          columns={[
            {
              key: "owner",
              header: "Account holder",
              sort: (a) => a.ownerName,
              cell: (a) => (
                <div className={cn("flex items-center gap-2.5", selected?.accountId === a.accountId && "font-semibold")}>
                  <div
                    className={cn(
                      "flex size-8 items-center justify-center rounded-lg",
                      a.type === "authority" ? "bg-violet-600 text-white" : a.type === "customer" ? "bg-violet-100 text-violet-700" : "bg-orange-100 text-orange-700",
                    )}
                  >
                    {a.type === "authority" ? <LandmarkIcon className="size-4" /> : a.type === "customer" ? <UserIcon className="size-4" /> : <Building2Icon className="size-4" />}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      {a.type === "authority" ? (
                        a.ownerName
                      ) : (
                        <Link href={`/${a.type}s/${a.ownerId}`} onClick={(e) => e.stopPropagation()} className="hover:underline">
                          {a.ownerName}
                        </Link>
                      )}
                      {a.status === "inactive" && (
                        <Pill t="gray" dot={false}>
                          inactive
                        </Pill>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground capitalize">{a.type}</div>
                  </div>
                </div>
              ),
            },
            { key: "viban", header: "VIBAN", cell: (a) => <Mono className="text-muted-foreground">{a.viban}</Mono>, className: "hidden md:table-cell" },
            { key: "bban", header: "BBAN", cell: (a) => <Mono className="text-muted-foreground">{a.bban}</Mono>, className: "hidden xl:table-cell" },
            {
              key: "held",
              header: "Card holds",
              align: "right",
              sort: (a) => a.held,
              cell: (a) => (a.held ? <Money value={a.held} className="text-violet-700" /> : <span className="text-muted-foreground">—</span>),
              className: "hidden sm:table-cell",
            },
            {
              key: "balance",
              header: "Available",
              align: "right",
              sort: (a) => a.balance,
              cell: (a) => <Money value={a.balance} className={a.balance > 0 ? "font-semibold" : "text-muted-foreground"} />,
            },
          ]}
        />
      </div>

      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto flex items-center gap-2 text-base font-semibold">
            Ledger
            {selected && (
              <button onClick={() => setSelected(undefined)} className="flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-xs font-medium text-violet-800">
                {selected.ownerName} <XIcon className="size-3" />
              </button>
            )}
          </h2>
          <SimpleSelect
            value={ledgerType}
            onValueChange={setLedgerType}
            className="min-w-44"
            options={[{ value: "any", label: "All transaction types" }, ...Object.entries(LEDGER_LABEL).map(([value, label]) => ({ value, label }))]}
          />
          <SimpleSelect
            value={direction}
            onValueChange={setDirection}
            options={[
              { value: "any", label: "Credits & debits" },
              { value: "credit", label: "Credits (in)" },
              { value: "debit", label: "Debits (out)" },
            ]}
          />
        </div>
        <LedgerTable rows={ledger} loading={loading} showAccount accountName={(id) => names[id] ?? id} pageSize={12} />
      </div>

      <DepositDialog open={deposit} onOpenChange={setDeposit} customerId={selected?.type === "customer" ? selected.ownerId : undefined} />
    </>
  );
}
