"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EntityPicker } from "@/components/app/entity-picker";
import { Field } from "@/components/app/field";
import { dhamen } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import { useSubmit } from "@/lib/client/use-submit";
import type { CustomerView } from "@/lib/client/types";
import { DHAMEN_CONFIG } from "@/lib/dhamen/config";
import { sar } from "@/lib/format";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customerId?: string;
}

export function DepositDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DepositForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function DepositForm({ onOpenChange, customerId }: Props) {
  const { data: customers } = useDemo<CustomerView[]>("customers");
  const [target, setTarget] = useState<string | undefined>(customerId);
  const [amount, setAmount] = useState("1000");
  const [wallet, setWallet] = useState(DHAMEN_CONFIG.sandboxWalletNumber);
  const { busy, err, run } = useSubmit();

  const selected = customers?.find((c) => c.customerId === target);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const res = await run(() => dhamen.depositMoney({ customerId: target ?? "", amount: Number(amount), paymentIWalletNumber: wallet }), {
      success: `SAR ${sar(Number(amount))} credited to ${selected?.name ?? "customer"} VIBAN`,
    });
    if (res) onOpenChange(false);
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Deposit money</DialogTitle>
        <DialogDescription>POST /api/payments/deposit-money · simulates a bank transfer into the customer&apos;s virtual IBAN (test environment only).</DialogDescription>
      </DialogHeader>
      <Field label="Customer" required error={err("customerId")}>
        <EntityPicker
          items={(customers ?? [])
            .filter((c) => c.status === "active")
            .map((c) => ({
              id: c.customerId,
              label: c.name,
              sub: `${c.identityNumber} · ${c.viban}`,
              right: <span className="text-xs tabular-nums text-muted-foreground">{sar(c.balance)}</span>,
            }))}
          value={target}
          onChange={setTarget}
          placeholder="Select customer"
        />
      </Field>
      {selected && (
        <div className="rounded-lg border bg-muted/40 p-3 text-xs">
          <div className="text-muted-foreground">Destination VIBAN</div>
          <div className="font-mono text-sm">{selected.viban}</div>
          <div className="mt-1 text-muted-foreground">
            Current balance <span className="font-medium text-foreground">SAR {sar(selected.balance)}</span>
          </div>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount (SAR)" required error={err("amount")}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Source wallet" error={err("paymentIWalletNumber")}>
          <Input value={wallet} onChange={(e) => setWallet(e.target.value)} className="font-mono" />
        </Field>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {[500, 1000, 5000, 10000].map((v) => (
          <Button key={v} type="button" size="xs" variant="outline" onClick={() => setAmount(String(v))}>
            {v.toLocaleString()}
          </Button>
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy || !target}>
          {busy ? "Depositing…" : "Deposit"}
        </Button>
      </DialogFooter>
    </form>
  );
}
