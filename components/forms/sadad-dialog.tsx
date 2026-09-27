"use client";

import { CheckCircle2Icon, RefreshCwIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { EntityPicker } from "@/components/app/entity-picker";
import { Field } from "@/components/app/field";
import { JsonView } from "@/components/app/json-view";
import { dhamen } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import { useSubmit } from "@/lib/client/use-submit";
import type { CustomerView, SupplierView } from "@/lib/client/types";
import type { SadadPaymentResponse } from "@/lib/dhamen/types";
import { newRef } from "@/lib/format";

export function SadadDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <SadadForm onOpenChange={onOpenChange} />
      </DialogContent>
    </Dialog>
  );
}

function SadadForm({ onOpenChange }: { onOpenChange: (o: boolean) => void }) {
  const { data: customers } = useDemo<CustomerView[]>("customers");
  const { data: suppliers } = useDemo<SupplierView[]>("suppliers");
  const [customerId, setCustomerId] = useState<string>();
  const [form, setForm] = useState(() => ({
    paymentReferenceId: newRef("SADAD"),
    name: "",
    customerIdentifier: "",
    amount: "",
    supplierId: undefined as string | undefined,
    email: "",
    mobile: "",
  }));
  const [result, setResult] = useState<SadadPaymentResponse>();
  const { busy, err, run } = useSubmit();

  const pick = (id?: string) => {
    setCustomerId(id);
    const c = customers?.find((x) => x.customerId === id);
    if (c) setForm((f) => ({ ...f, name: c.name, customerIdentifier: c.identityNumber, email: c.email ?? "", mobile: c.mobile ?? "" }));
  };

  return result ? (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2Icon className="size-5 text-emerald-600" /> SADAD bill issued
        </DialogTitle>
        <DialogDescription>The customer can pay from any Saudi bank app using the biller code and bill number.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3 rounded-xl border bg-gradient-to-br from-emerald-50 to-white p-4">
        <div>
          <div className="text-xs text-muted-foreground">Biller code</div>
          <div className="font-mono text-2xl font-semibold">{result.billerId}</div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Bill number</div>
          <div className="font-mono text-2xl font-semibold">{result.billNumber}</div>
        </div>
      </div>
      <JsonView value={result} />
      <DialogFooter>
        <Button onClick={() => onOpenChange(false)}>Done</Button>
      </DialogFooter>
    </div>
  ) : (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(() => dhamen.sadadPayment({ ...form, amount: Number(form.amount) }), { success: "SADAD invoice created" });
        if (res) setResult(res);
      }}
    >
      <DialogHeader>
        <DialogTitle>New SADAD invoice</DialogTitle>
        <DialogDescription>POST /api/payments/customer-sadad-payment</DialogDescription>
      </DialogHeader>
      <Field label="Payment reference ID" required error={err("paymentReferenceId")}>
        <div className="flex gap-1.5">
          <Input value={form.paymentReferenceId} onChange={(e) => setForm({ ...form, paymentReferenceId: e.target.value })} className="font-mono" />
          <Button type="button" variant="outline" size="icon" onClick={() => setForm({ ...form, paymentReferenceId: newRef("SADAD") })}>
            <RefreshCwIcon />
          </Button>
        </div>
      </Field>
      <Field label="Customer" hint="Pick a registered customer or type details below">
        <EntityPicker
          items={(customers ?? []).filter((c) => c.status === "active").map((c) => ({ id: c.customerId, label: c.name, sub: c.identityNumber }))}
          value={customerId}
          onChange={pick}
          placeholder="Search customers…"
          allowClear
        />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" required error={err("name")}>
          <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Customer identifier" required error={err("customerIdentifier")}>
          <Input value={form.customerIdentifier} onChange={(e) => setForm({ ...form, customerIdentifier: e.target.value })} />
        </Field>
        <Field label="Amount (SAR)" required error={err("amount")}>
          <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="decimal" />
        </Field>
        <Field label="Mobile" error={err("mobile")}>
          <Input value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} />
        </Field>
      </div>
      <Field label="Email" error={err("email")}>
        <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
      </Field>
      <Field label="Supplier" error={err("supplierId")} hint="If set, the paid amount is released to this supplier">
        <EntityPicker
          items={(suppliers ?? []).filter((s) => s.status === "active").map((s) => ({ id: s.supplierId, label: s.name, sub: s.identityNumber }))}
          value={form.supplierId}
          onChange={(id) => setForm({ ...form, supplierId: id })}
          placeholder="None"
          allowClear
        />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Issuing…" : "Issue SADAD bill"}
        </Button>
      </DialogFooter>
    </form>
  );
}
