"use client";

import { AlertTriangleIcon, PercentIcon, PlusIcon, RefreshCwIcon, SplitIcon, Trash2Icon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EntityPicker } from "@/components/app/entity-picker";
import { Field } from "@/components/app/field";
import { dhamen } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import { useSubmit } from "@/lib/client/use-submit";
import type { AccountRow, SupplierView } from "@/lib/client/types";
import { newRef, sar } from "@/lib/format";

interface Line {
  key: number;
  supplierId?: string;
  value: string;
}
let k = 0;
const line = (supplierId?: string, value = ""): Line => ({ key: ++k, supplierId, value });
const round = (n: number) => Math.round(n * 100) / 100;

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultFund?: string;
  defaultAmount?: number;
}

export function SplitPayoutDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <SplitPayoutForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function SplitPayoutForm({ onOpenChange, defaultFund, defaultAmount }: Props) {
  const { data: accounts } = useDemo<{ accounts: AccountRow[] }>("accounts");
  const { data: suppliers } = useDemo<SupplierView[]>("suppliers");
  const [ref, setRef] = useState(() => newRef("SP"));
  const [fund, setFund] = useState<string | undefined>(defaultFund ?? "AUTH");
  const [mode, setMode] = useState<"amount" | "percent">(defaultAmount ? "percent" : "amount");
  const [total, setTotal] = useState(defaultAmount ? String(defaultAmount) : "");
  const [lines, setLines] = useState<Line[]>(() => [line()]);
  const { busy, err, run } = useSubmit();

  const fundingItems = useMemo(
    () =>
      (accounts?.accounts ?? [])
        .filter((a) => a.type === "authority" || (a.type === "customer" && a.status === "active"))
        .sort((a, b) => (a.type === "authority" ? -1 : b.type === "authority" ? 1 : b.balance - a.balance))
        .map((a) => ({
          id: a.type === "authority" ? "AUTH" : a.ownerId,
          label: a.type === "authority" ? `${a.ownerName} (Authority VA)` : a.ownerName,
          sub: a.viban,
          right: <span className="text-xs tabular-nums text-muted-foreground">SAR {sar(a.balance)}</span>,
        })),
    [accounts],
  );
  const fundAccount = accounts?.accounts.find((a) => (fund === "AUTH" ? a.type === "authority" : a.ownerId === fund));
  const supplierItems = (suppliers ?? [])
    .filter((s) => s.status === "active")
    .map((s) => ({ id: s.supplierId, label: s.name, sub: s.isAuthorityFee ? "Authority commission account" : s.iban, keywords: s.identityNumber }));

  const amounts = lines.map((l) => (mode === "amount" ? Number(l.value) || 0 : round(((Number(total) || 0) * (Number(l.value) || 0)) / 100)));
  const sum = round(amounts.reduce((a, b) => a + b, 0));
  const pctSum = lines.reduce((a, l) => a + (Number(l.value) || 0), 0);
  const insufficient = fundAccount && sum > fundAccount.balance;

  const applyPreset = () => {
    const main = suppliers?.find((s) => !s.isAuthorityFee && s.status === "active");
    const fee = suppliers?.find((s) => s.isAuthorityFee);
    setMode("percent");
    if (!total) setTotal(String(fundAccount?.balance ?? 1000));
    setLines([line(main?.supplierId, "90"), line(fee?.supplierId, "10")]);
  };

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(
      () =>
        dhamen.supplierPayment({
          paymentReferenceId: ref,
          supplierPayments: lines.map((l, i) => ({ supplierId: l.supplierId ?? "", amount: amounts[i], customerId: fund === "AUTH" ? undefined : fund })),
        }),
      { success: insufficient ? "Accepted · pending funds (Insufficient_Balance_Notification sent)" : `Split of SAR ${sar(sum)} submitted to ${lines.length} supplier(s)` },
    );
    if (res) onOpenChange(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <SplitIcon className="size-4" /> Supplier payment (split)
        </DialogTitle>
        <DialogDescription>
          POST /api/payments/supplier-payment · releases escrow funds to one or more suppliers. Funds move to each supplier&apos;s VIBAN and are paid out to their IBAN on threshold
          or schedule.
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Payment reference ID" required error={err("paymentReferenceId")}>
          <div className="flex gap-1.5">
            <Input value={ref} onChange={(ev) => setRef(ev.target.value)} className="font-mono" />
            <Button type="button" variant="outline" size="icon" onClick={() => setRef(newRef("SP"))}>
              <RefreshCwIcon />
            </Button>
          </div>
        </Field>
        <Field label="Funding source" required hint="Authority VA when no customerId is sent">
          <EntityPicker items={fundingItems} value={fund} onChange={(id) => setFund(id ?? "AUTH")} placeholder="Select escrow account" />
        </Field>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Tabs value={mode} onValueChange={(v) => setMode(v as "amount" | "percent")}>
          <TabsList>
            <TabsTrigger value="amount">By amount</TabsTrigger>
            <TabsTrigger value="percent">By percentage</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="flex items-center gap-2">
          {mode === "percent" && (
            <div className="flex items-center gap-1.5 text-sm">
              <span className="text-muted-foreground">Total</span>
              <Input value={total} onChange={(e) => setTotal(e.target.value)} className="h-8 w-28" inputMode="decimal" />
            </div>
          )}
          <Button type="button" size="sm" variant="outline" onClick={applyPreset}>
            <PercentIcon /> 90/10 with platform fee
          </Button>
        </div>
      </div>

      <div className="grid gap-2">
        {lines.map((l, i) => (
          <div key={l.key} className="grid items-start gap-2 rounded-lg border bg-muted/20 p-2.5 sm:grid-cols-[1fr_140px_120px_32px]">
            <EntityPicker
              items={supplierItems}
              value={l.supplierId}
              onChange={(id) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, supplierId: id } : x)))}
              placeholder="Select supplier"
              invalid={!!err(`supplierPayments.${i}.supplierId`)}
            />
            <div className="relative">
              <Input
                value={l.value}
                onChange={(e) => setLines((ls) => ls.map((x) => (x.key === l.key ? { ...x, value: e.target.value } : x)))}
                inputMode="decimal"
                placeholder={mode === "amount" ? "Amount" : "%"}
                className="h-9 pr-10"
                aria-invalid={!!err(`supplierPayments.${i}.amount`) || undefined}
              />
              <span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-xs text-muted-foreground">{mode === "amount" ? "SAR" : "%"}</span>
            </div>
            <div className="flex h-9 items-center justify-end text-sm font-medium tabular-nums">SAR {sar(amounts[i])}</div>
            <Button type="button" variant="ghost" size="icon" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
              <Trash2Icon />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" className="justify-self-start" onClick={() => setLines((ls) => [...ls, line()])}>
          <PlusIcon /> Add supplier
        </Button>
      </div>

      <div className="grid gap-1.5 rounded-xl border bg-card p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Available in {fundAccount?.ownerName ?? "funding account"}</span>
          <span className="tabular-nums">SAR {sar(fundAccount?.balance)}</span>
        </div>
        <div className="flex justify-between font-medium">
          <span>Total to release</span>
          <span className="tabular-nums">SAR {sar(sum)}</span>
        </div>
        {mode === "percent" && Math.abs(pctSum - 100) > 0.001 && <div className="text-xs text-amber-700">Percentages add up to {pctSum}% (not 100%).</div>}
        {insufficient && (
          <div className="mt-1 flex items-start gap-2 rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
            <AlertTriangleIcon className="mt-0.5 size-3.5 shrink-0" />
            Balance is insufficient. Dhamen accepts the request, keeps it pending and sends Insufficient_Balance_Notification until the account is funded.
          </div>
        )}
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || sum <= 0}>
          {busy ? "Submitting…" : `Release SAR ${sar(sum)}`}
        </Button>
      </DialogFooter>
    </form>
  );
}
