"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Field } from "@/components/app/field";
import { dhamen } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/use-submit";
import type { Customer } from "@/lib/dhamen/types";

const empty = { identityNumber: "", name: "", iban: "", email: "", mobile: "" };

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  customer?: Customer;
  onSaved?: (id?: string) => void;
}

export function CustomerFormDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <CustomerForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function CustomerForm({ onOpenChange, customer, onSaved }: Props) {
  const [form, setForm] = useState(() =>
    customer ? { identityNumber: customer.identityNumber, name: customer.name, iban: customer.iban ?? "", email: customer.email ?? "", mobile: customer.mobile ?? "" } : empty,
  );
  const { busy, err, run } = useSubmit();
  const editing = !!customer;

  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (editing) {
      const res = await run(() => dhamen.updateCustomer(form), { success: "Customer updated" });
      if (res) {
        onOpenChange(false);
        onSaved?.(customer.customerId);
      }
    } else {
      const res = await run(() => dhamen.createCustomer(form), { success: (r) => `Customer created · VIBAN ${r.viban}` });
      if (res) {
        onOpenChange(false);
        onSaved?.(res.customerId);
      }
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>{editing ? "Edit customer" : "New customer"}</DialogTitle>
        <DialogDescription>
          {editing ? (
            <>POST /api/payments/update-customer · identity number is the customer key and can&apos;t be changed.</>
          ) : (
            <>POST /api/payments/create-customer · Dhamen issues a dedicated VIBAN to receive this customer&apos;s payments.</>
          )}
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Identity number" htmlFor="c-id" required error={err("identityNumber")} hint="National ID / Iqama, 10 digits">
          <Input id="c-id" value={form.identityNumber} onChange={set("identityNumber")} disabled={editing} inputMode="numeric" maxLength={10} placeholder="1087654321" />
        </Field>
        <Field label="Name as per bank account" htmlFor="c-name" required error={err("name")}>
          <Input id="c-name" value={form.name} onChange={set("name")} maxLength={100} placeholder="Abdullah Al-Qahtani" />
        </Field>
        <Field label="IBAN" htmlFor="c-iban" error={err("iban")} hint="24 chars, starts with SA" className="sm:col-span-2">
          <Input id="c-iban" value={form.iban} onChange={set("iban")} className="font-mono" placeholder="SA2365236589745698745231" />
        </Field>
        <Field label="Email" htmlFor="c-email" error={err("email")}>
          <Input id="c-email" value={form.email} onChange={set("email")} type="email" placeholder="name@example.sa" />
        </Field>
        <Field label="Mobile" htmlFor="c-mobile" error={err("mobile")} hint="Format 9665xxxxxxxx">
          <Input id="c-mobile" value={form.mobile} onChange={set("mobile")} inputMode="numeric" placeholder="966501234567" />
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Saving…" : editing ? "Save changes" : "Create customer"}
        </Button>
      </DialogFooter>
    </form>
  );
}
