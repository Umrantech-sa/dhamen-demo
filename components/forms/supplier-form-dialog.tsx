"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { dhamen } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/use-submit";
import type { Supplier } from "@/lib/dhamen/types";

const empty = { name: "", iban: "", identityNumber: "", payoutThresholdAmount: "", email: "", mobile: "" };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplier?: Supplier;
  onSaved?: (id?: string) => void;
}

export function SupplierFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <SupplierForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function SupplierForm({ onOpenChange, supplier, onSaved }: Props) {
  const { busy, err, run } = useSubmit();
  const editing = !!supplier;
  const [form, setForm] = useState(() =>
    supplier
      ? {
          name: supplier.name,
          iban: supplier.iban,
          identityNumber: supplier.identityNumber,
          payoutThresholdAmount: supplier.payoutThresholdAmount != null ? String(supplier.payoutThresholdAmount) : "",
          email: supplier.email ?? "",
          mobile: supplier.mobile ?? "",
        }
      : empty,
  );

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = { ...form, payoutThresholdAmount: form.payoutThresholdAmount === "" ? undefined : Number(form.payoutThresholdAmount) };
    if (editing) {
      const res = await run(() => dhamen.updateSupplier({ supplierId: supplier.supplierId, ...body }), { success: "Supplier updated" });
      if (res) {
        onOpenChange(false);
        onSaved?.(supplier.supplierId);
      }
    } else {
      const res = await run(() => dhamen.createSupplier(body), { success: (r) => `Supplier created · ${r.supplierId.slice(0, 8)}…` });
      if (res) {
        onOpenChange(false);
        onSaved?.(res.supplierId);
      }
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit supplier" : "New supplier"}</DialogTitle>
        <DialogDescription>
          {editing ? "POST /api/payments/update-supplier" : "POST /api/payments/create-supplier · a VIBAN is created to collect funds before payout to the supplier IBAN."}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Supplier name as per bank account" htmlFor="s-name" required error={err("name")} className="sm:col-span-2">
          <Input id="s-name" value={form.name} onChange={set("name")} maxLength={100} placeholder="Al-Waha Contracting Est." />
        </Field>
        <Field
          label="IBAN (payout account)"
          htmlFor="s-iban"
          required
          error={err("iban")}
          hint="Tip: an IBAN ending in 12 zeros is rejected by SARIE in the sandbox"
          className="sm:col-span-2"
        >
          <Input id="s-iban" value={form.iban} onChange={set("iban")} className="font-mono" placeholder="SA0380000000608010167519" />
        </Field>
        <Field label="Identity number" htmlFor="s-id" required error={err("identityNumber")} hint="CR / Unified number, 10 digits">
          <Input id="s-id" value={form.identityNumber} onChange={set("identityNumber")} inputMode="numeric" maxLength={10} placeholder="7001234561" />
        </Field>
        <Field label="Payout threshold (SAR)" htmlFor="s-th" error={err("payoutThresholdAmount")} hint="Auto-payout once VIBAN balance reaches it">
          <Input id="s-th" value={form.payoutThresholdAmount} onChange={set("payoutThresholdAmount")} inputMode="decimal" placeholder="5000.00" />
        </Field>
        <Field label="Email" htmlFor="s-email" error={err("email")}>
          <Input id="s-email" value={form.email} onChange={set("email")} placeholder="finance@company.sa" />
        </Field>
        <Field label="Mobile" htmlFor="s-mobile" error={err("mobile")} hint="Format 9665xxxxxxxx">
          <Input id="s-mobile" value={form.mobile} onChange={set("mobile")} inputMode="numeric" placeholder="966501234567" />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Create supplier"}
        </Button>
      </DialogFooter>
    </form>
  );
}
