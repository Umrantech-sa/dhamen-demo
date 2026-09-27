"use client";

import { CheckCircle2Icon, ExternalLinkIcon, PlusIcon, RefreshCwIcon, Trash2Icon, UserPlusIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CopyButton } from "@/components/app/copy-button";
import { EntityPicker } from "@/components/app/entity-picker";
import { SwitchCard } from "@/components/app/switch-card";
import { Field } from "@/components/app/field";
import { dhamen } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import { useSubmit } from "@/lib/client/use-submit";
import type { CustomerView, SupplierView } from "@/lib/client/types";
import type { CustomerPaymentResponse } from "@/lib/dhamen/types";
import { newRef, sar } from "@/lib/format";

interface Entry {
  key: number;
  mode: "registered" | "guest";
  customerId?: string;
  name: string;
  customerIdentifier: string;
  mobile: string;
  email: string;
  amount: string;
  supplierId?: string;
}

let k = 0;
const newEntry = (mode: Entry["mode"] = "registered"): Entry => ({ key: ++k, mode, name: "", customerIdentifier: "", mobile: "", email: "", amount: "" });

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  defaultCustomerId?: string;
  defaultSupplierId?: string;
}

export function PaymentLinkDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-2xl">
        <PaymentLinkForm {...props} />
      </DialogContent>
    </Dialog>
  );
}

function PaymentLinkForm({ onOpenChange, defaultCustomerId, defaultSupplierId }: Props) {
  const { data: customers } = useDemo<CustomerView[]>("customers");
  const { data: suppliers } = useDemo<SupplierView[]>("suppliers");
  const [ref, setRef] = useState(() => newRef("INV"));
  const [expiry, setExpiry] = useState("4320");
  const [entries, setEntries] = useState<Entry[]>(() => [{ ...newEntry(), customerId: defaultCustomerId, supplierId: defaultSupplierId }]);
  const [opts, setOpts] = useState({ isPreAuth: false, enableBNPL: false, enableRecurring: false, returnUrl: "https://umrantech.sa/orders/complete" });
  const [result, setResult] = useState<CustomerPaymentResponse>();
  const { busy, err, run } = useSubmit();

  /** Registered payers take their details from the customer record. */
  const resolve = (en: Entry) => {
    const c = en.mode === "registered" ? customers?.find((x) => x.customerId === en.customerId) : undefined;
    return { name: c?.name ?? en.name, customerIdentifier: c?.identityNumber ?? en.customerIdentifier, mobile: en.mobile || c?.mobile || "", email: en.email || c?.email || "" };
  };

  const update = (key: number, patch: Partial<Entry>) => setEntries((l) => l.map((e) => (e.key === key ? { ...e, ...patch } : e)));
  const pickCustomer = (key: number, id?: string) => update(key, { customerId: id, mobile: "", email: "" });

  const total = entries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const customerItems = (customers ?? [])
    .filter((c) => c.status === "active")
    .map((c) => ({ id: c.customerId, label: c.name, sub: `${c.identityNumber} · ${c.mobile ?? "no mobile"}`, keywords: `${c.email} ${c.viban}` }));
  const supplierItems = (suppliers ?? [])
    .filter((s) => s.status === "active")
    .map((s) => ({
      id: s.supplierId,
      label: s.name,
      sub: s.payoutThresholdAmount != null ? `Payout threshold SAR ${sar(s.payoutThresholdAmount)}` : "Scheduled payout",
      keywords: s.identityNumber,
    }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = {
      paymentReferenceId: ref,
      paymentExpiredOnMinutes: expiry ? Number(expiry) : undefined,
      customerPayments: entries.map((en) => ({
        ...resolve(en),
        amount: Number(en.amount),
        supplierId: en.supplierId,
        isPreAuth: opts.isPreAuth || undefined,
        enableBNPL: opts.enableBNPL || undefined,
        enableRecurring: opts.enableRecurring || undefined,
        returnUrl: opts.returnUrl || undefined,
      })),
    };
    const res = await run(() => dhamen.customerPayment(body), { success: `Payment link${entries.length > 1 ? "s" : ""} created for ${ref}` });
    if (res) setResult(res);
  }

  const e = (i: number, f: string) => err(`customerPayments.${i}.${f}`);

  return result ? (
    <div className="grid gap-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <CheckCircle2Icon className="size-5 text-emerald-600" /> Payment link{result.customerPayments.length > 1 ? "s" : ""} ready
        </DialogTitle>
        <DialogDescription>
          Share the hosted payment page with each payer. Reference <span className="font-mono">{ref}</span>.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-2">
        {result.customerPayments.map((p) => {
          const en = entries.map((x) => ({ ...x, ...resolve(x) })).find((x) => x.customerIdentifier === p.customerIdentifier);
          return (
            <div key={p.invoiceId} className="min-w-0 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{en?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    {p.customerIdentifier} · SAR {sar(Number(en?.amount))}
                  </div>
                </div>
                <div className="flex gap-1.5">
                  <Link href={`/payments/${p.invoiceId}`} onClick={() => onOpenChange(false)} className={buttonVariants({ variant: "outline", size: "sm" })}>
                    Details
                  </Link>
                  <a href={p.paymentUrl} target="_blank" rel="noreferrer" className={buttonVariants({ size: "sm" })}>
                    Open checkout <ExternalLinkIcon />
                  </a>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1 rounded-md bg-muted/60 px-2 py-1">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{p.paymentUrl}</span>
                <CopyButton value={p.paymentUrl} label="Payment URL" />
              </div>
            </div>
          );
        })}
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={() => setResult(undefined)}>
          Back
        </Button>
        <Button onClick={() => onOpenChange(false)}>Done</Button>
      </DialogFooter>
    </div>
  ) : (
    <form onSubmit={submit} className="grid gap-5">
      <DialogHeader>
        <DialogTitle>Create payment link</DialogTitle>
        <DialogDescription>POST /api/payments/customer-payment · generates a hosted payment page per payer. Add several payers to split one bill.</DialogDescription>
      </DialogHeader>

      <div className="grid gap-3 sm:grid-cols-[1fr_180px]">
        <Field label="Payment reference ID" required error={err("paymentReferenceId")} hint="Unique, max 50 characters">
          <div className="flex gap-1.5">
            <Input value={ref} onChange={(ev) => setRef(ev.target.value)} className="font-mono" maxLength={50} />
            <Button type="button" variant="outline" size="icon" onClick={() => setRef(newRef("INV"))} title="Generate">
              <RefreshCwIcon />
            </Button>
          </div>
        </Field>
        <Field label="Link expires after (min)" error={err("paymentExpiredOnMinutes")} hint="4320 = 3 days">
          <Input value={expiry} onChange={(ev) => setExpiry(ev.target.value)} inputMode="numeric" />
        </Field>
      </div>

      <div className="grid gap-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">Payers</div>
          <div className="flex gap-1.5">
            <Button type="button" size="xs" variant="outline" onClick={() => setEntries((l) => [...l, newEntry("registered")])}>
              <UsersIcon /> Add customer
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={() => setEntries((l) => [...l, newEntry("guest")])}>
              <UserPlusIcon /> Add guest
            </Button>
          </div>
        </div>
        {entries.map((en, i) => (
          <div key={en.key} className="grid gap-3 rounded-xl border bg-muted/20 p-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">
                Payer {i + 1} · {en.mode === "registered" ? "Registered customer (paid into customer VIBAN)" : "Guest (paid into authority virtual account)"}
              </span>
              {entries.length > 1 && (
                <Button type="button" size="icon-xs" variant="ghost" onClick={() => setEntries((l) => l.filter((x) => x.key !== en.key))}>
                  <Trash2Icon />
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {en.mode === "registered" ? (
                <Field label="Customer" required error={e(i, "name") ?? e(i, "customerIdentifier")} className="sm:col-span-2">
                  <EntityPicker items={customerItems} value={en.customerId} onChange={(id) => pickCustomer(en.key, id)} placeholder="Search customers…" />
                </Field>
              ) : (
                <>
                  <Field label="Payer name" required error={e(i, "name")}>
                    <Input value={en.name} onChange={(ev) => update(en.key, { name: ev.target.value })} placeholder="Yousef Al-Rashid" />
                  </Field>
                  <Field label="Customer identifier" required error={e(i, "customerIdentifier")} hint="Unique ID, max 12 digits">
                    <Input value={en.customerIdentifier} onChange={(ev) => update(en.key, { customerIdentifier: ev.target.value })} maxLength={12} placeholder="1122334455" />
                  </Field>
                </>
              )}
              <Field label="Amount (SAR)" required error={e(i, "amount")}>
                <Input value={en.amount} onChange={(ev) => update(en.key, { amount: ev.target.value })} inputMode="decimal" placeholder="1,250.00" />
              </Field>
              <Field label="Supplier (receives the funds)" error={e(i, "supplierId")}>
                <EntityPicker
                  items={supplierItems}
                  value={en.supplierId}
                  onChange={(id) => update(en.key, { supplierId: id })}
                  placeholder="None – decide later via Supplier Payment"
                  allowClear
                />
              </Field>
              {opts.enableBNPL && (
                <>
                  <Field label="Mobile (Tabby)" required error={e(i, "mobile")}>
                    <Input value={resolve(en).mobile} onChange={(ev) => update(en.key, { mobile: ev.target.value })} placeholder="966501234567" />
                  </Field>
                  <Field label="Email (Tabby)" required error={e(i, "email")}>
                    <Input value={resolve(en).email} onChange={(ev) => update(en.key, { email: ev.target.value })} placeholder="name@example.sa" />
                  </Field>
                </>
              )}
            </div>
          </div>
        ))}
        {err("customerPayments") && <p className="text-xs text-rose-600">{err("customerPayments")?.[0]}</p>}
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        <SwitchCard
          checked={opts.isPreAuth}
          onChange={(v) => setOpts((o) => ({ ...o, isPreAuth: v }))}
          title="Pre-authorization"
          description="Hold funds on card; capture or reverse later."
        />
        <SwitchCard
          checked={opts.enableBNPL}
          onChange={(v) => setOpts((o) => ({ ...o, enableBNPL: v }))}
          title="Buy now, pay later"
          description="Offer Tabby at checkout (mobile & email required)."
        />
        <SwitchCard
          checked={opts.enableRecurring}
          onChange={(v) => setOpts((o) => ({ ...o, enableRecurring: v }))}
          title="Recurring"
          description="Save card for subsequent payments."
        />
      </div>

      <Field label="Return URL" error={e(0, "returnUrl")} hint="Customer is redirected here after a successful payment">
        <Input value={opts.returnUrl} onChange={(ev) => setOpts((o) => ({ ...o, returnUrl: ev.target.value }))} />
      </Field>

      <DialogFooter className="items-center sm:justify-between">
        <div className="text-sm">
          Total <span className="font-semibold tabular-nums">SAR {sar(total)}</span>
          <span className="text-muted-foreground">
            {" "}
            · {entries.length} payer{entries.length > 1 ? "s" : ""}
          </span>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={busy}>
            <PlusIcon /> {busy ? "Creating…" : "Create link"}
          </Button>
        </div>
      </DialogFooter>
    </form>
  );
}
