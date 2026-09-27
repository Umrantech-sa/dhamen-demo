"use client";

import {
  BanIcon,
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  HandCoinsIcon,
  LandmarkIcon,
  MoreHorizontalIcon,
  RefreshCwIcon,
  RepeatIcon,
  SearchCheckIcon,
  SplitIcon,
  Undo2Icon,
  UndoDotIcon,
  CheckCheckIcon,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { Field } from "@/components/app/field";
import { JsonView } from "@/components/app/json-view";
import { demo, dhamen, errorMessage } from "@/lib/client/api";
import { useSubmit } from "@/lib/client/use-submit";
import type { InvoiceView } from "@/lib/client/types";
import { newRef, sar } from "@/lib/format";

type ActionKind = "capture" | "reverse" | "refund" | "refund-iban" | "cancel" | "subsequent" | "status" | "settle" | null;

const PAID = new Set(["paid", "captured", "partially_captured", "partially_refunded"]);
const reqId = (p: string) => `${p}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;

export function availableActions(inv: InvoiceView) {
  return {
    capture: inv.status === "authorized",
    reverse: inv.status === "authorized",
    refund: PAID.has(inv.status) && inv.collected > 0,
    refundIban: PAID.has(inv.status) && inv.collected > 0,
    cancel: inv.status === "unpaid",
    subsequent: inv.enableRecurring && PAID.has(inv.status),
    settle: inv.reconciliationStatus === 3,
    split: !inv.supplierId && inv.isRegisteredCustomer && inv.collected > 0 && inv.reconciliationStatus === 1,
  };
}

export function PaymentActions({ invoice, mode = "menu", customerIban }: { invoice: InvoiceView; mode?: "menu" | "bar"; customerIban?: string }) {
  const [action, setAction] = useState<ActionKind>(null);
  const router = useRouter();
  const a = availableActions(invoice);
  const close = (o: boolean) => !o && setAction(null);
  const splitHref = `/payouts?new=1&fund=${invoice.customerId}&amount=${invoice.collected}`;

  const dialogs = (
    <>
      <CaptureDialog open={action === "capture"} onOpenChange={close} invoice={invoice} />
      <RefundDialog open={action === "refund"} onOpenChange={close} invoice={invoice} />
      <RefundIbanDialog open={action === "refund-iban"} onOpenChange={close} invoice={invoice} customerIban={customerIban} />
      <SubsequentDialog open={action === "subsequent"} onOpenChange={close} invoice={invoice} />
      <StatusDialog open={action === "status"} onOpenChange={close} invoice={invoice} />
      <ConfirmDialog
        open={action === "reverse"}
        onOpenChange={close}
        title="Reverse pre-authorization?"
        description={
          <>
            PUT /api/payments/reverse · releases the <b>SAR {sar(invoice.amount)}</b> held on {invoice.name}&apos;s card. This can&apos;t be undone.
          </>
        }
        confirmLabel="Reverse payment"
        destructive
        successMessage="Authorization reversed"
        onConfirm={() => dhamen.reverse({ paymentReferenceId: invoice.paymentReferenceId, customerIdentifier: invoice.customerIdentifier })}
      />
      <ConfirmDialog
        open={action === "cancel"}
        onOpenChange={close}
        title="Cancel payment link?"
        description={
          <>
            PUT /api/payments/cancel · the link for <b>{invoice.name}</b> ({invoice.paymentReferenceId}) will stop accepting payments.
          </>
        }
        confirmLabel="Cancel link"
        destructive
        successMessage="Payment link cancelled"
        onConfirm={() => dhamen.cancel({ paymentReferenceId: invoice.paymentReferenceId, customerIdentifier: invoice.customerIdentifier })}
      />
      <ConfirmDialog
        open={action === "settle"}
        onOpenChange={close}
        title="Simulate bank settlement"
        description={
          <>
            Sandbox helper: the acquirer settles this card payment (T+1). Dhamen sends <b>Payment_Settled_Notification</b>
            {invoice.supplierName ? (
              <>
                {" "}
                and releases the funds to <b>{invoice.supplierName}</b>&apos;s VIBAN for payout.
              </>
            ) : (
              "."
            )}
          </>
        }
        confirmLabel="Settle now"
        successMessage="Payment settled"
        onConfirm={() => demo.post(`invoices/${invoice.invoiceId}/settle`)}
      />
    </>
  );

  if (mode === "bar") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        {invoice.status === "unpaid" && (
          <Button size="sm" onClick={() => window.open(invoice.paymentUrl, "_blank")}>
            <ExternalLinkIcon /> Open checkout
          </Button>
        )}
        {a.capture && (
          <Button size="sm" onClick={() => setAction("capture")}>
            <HandCoinsIcon /> Capture
          </Button>
        )}
        {a.reverse && (
          <Button size="sm" variant="outline" onClick={() => setAction("reverse")}>
            <UndoDotIcon /> Reverse
          </Button>
        )}
        {a.settle && (
          <Button size="sm" variant="outline" onClick={() => setAction("settle")}>
            <CheckCheckIcon /> Simulate settlement
          </Button>
        )}
        {a.refund && (
          <Button size="sm" variant="outline" onClick={() => setAction("refund")}>
            <Undo2Icon /> Refund
          </Button>
        )}
        {a.refundIban && (
          <Button size="sm" variant="outline" onClick={() => setAction("refund-iban")}>
            <LandmarkIcon /> Refund to IBAN
          </Button>
        )}
        {a.subsequent && (
          <Button size="sm" variant="outline" onClick={() => setAction("subsequent")}>
            <RepeatIcon /> Charge again
          </Button>
        )}
        {a.split && (
          <Button size="sm" variant="outline" onClick={() => router.push(splitHref)}>
            <SplitIcon /> Split to suppliers
          </Button>
        )}
        {a.cancel && (
          <Button size="sm" variant="destructive" onClick={() => setAction("cancel")}>
            <BanIcon /> Cancel link
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => setAction("status")}>
          <SearchCheckIcon /> Check status
        </Button>
        {dialogs}
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <DropdownMenu>
        <DropdownMenuTrigger render={<Button size="icon-sm" variant="ghost" aria-label="Actions" />}>
          <MoreHorizontalIcon />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>{invoice.paymentReferenceId}</DropdownMenuLabel>
          <DropdownMenuItem render={<Link href={`/payments/${invoice.invoiceId}`} />}>
            <EyeIcon /> View details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setAction("status")}>
            <SearchCheckIcon /> Check status
          </DropdownMenuItem>
          {invoice.status === "unpaid" && (
            <>
              <DropdownMenuItem onClick={() => window.open(invoice.paymentUrl, "_blank")}>
                <ExternalLinkIcon /> Open checkout
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  void navigator.clipboard.writeText(invoice.paymentUrl);
                  toast.success("Payment URL copied");
                }}
              >
                <CopyIcon /> Copy payment link
              </DropdownMenuItem>
            </>
          )}
          {(a.capture || a.reverse || a.settle || a.refund || a.subsequent || a.split) && <DropdownMenuSeparator />}
          {a.capture && (
            <DropdownMenuItem onClick={() => setAction("capture")}>
              <HandCoinsIcon /> Capture
            </DropdownMenuItem>
          )}
          {a.reverse && (
            <DropdownMenuItem onClick={() => setAction("reverse")}>
              <UndoDotIcon /> Reverse
            </DropdownMenuItem>
          )}
          {a.settle && (
            <DropdownMenuItem onClick={() => setAction("settle")}>
              <CheckCheckIcon /> Simulate settlement
            </DropdownMenuItem>
          )}
          {a.refund && (
            <DropdownMenuItem onClick={() => setAction("refund")}>
              <Undo2Icon /> Refund
            </DropdownMenuItem>
          )}
          {a.refundIban && (
            <DropdownMenuItem onClick={() => setAction("refund-iban")}>
              <LandmarkIcon /> Refund to IBAN
            </DropdownMenuItem>
          )}
          {a.subsequent && (
            <DropdownMenuItem onClick={() => setAction("subsequent")}>
              <RepeatIcon /> Charge again (recurring)
            </DropdownMenuItem>
          )}
          {a.split && (
            <DropdownMenuItem onClick={() => router.push(splitHref)}>
              <SplitIcon /> Split to suppliers
            </DropdownMenuItem>
          )}
          {a.cancel && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setAction("cancel")}>
                <BanIcon /> Cancel link
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialogs}
    </div>
  );
}

function Summary({ rows }: { rows: [string, React.ReactNode][] }) {
  return (
    <div className="grid gap-1.5 rounded-lg border bg-muted/30 p-3 text-xs">
      {rows.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-3">
          <span className="text-muted-foreground">{k}</span>
          <span className="font-medium tabular-nums">{v}</span>
        </div>
      ))}
    </div>
  );
}

interface DialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  invoice: InvoiceView;
}

function Shell({ open, onOpenChange, className = "sm:max-w-md", children }: { open: boolean; onOpenChange: (o: boolean) => void; className?: string; children: React.ReactNode }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={className}>{children}</DialogContent>
    </Dialog>
  );
}

function CaptureDialog(props: DialogProps) {
  return (
    <Shell {...props}>
      <CaptureForm {...props} />
    </Shell>
  );
}

function CaptureForm({ onOpenChange, invoice }: DialogProps) {
  const [amount, setAmount] = useState(String(invoice.amount));
  const [requestId, setRequestId] = useState("");
  const { busy, err, run } = useSubmit();
  const partial = Number(amount) < invoice.amount;

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(
          () =>
            dhamen.capture({
              paymentReferenceId: invoice.paymentReferenceId,
              customerIdentifier: invoice.customerIdentifier,
              amount: Number(amount),
              requestId: requestId || undefined,
            }),
          { success: `Captured SAR ${sar(Number(amount))}` },
        );
        if (res) onOpenChange(false);
      }}
    >
      <DialogHeader>
        <DialogTitle>Capture payment</DialogTitle>
        <DialogDescription>PUT /api/payments/capture · must be done before the issuer auto-reverses the hold.</DialogDescription>
      </DialogHeader>
      <Summary
        rows={[
          ["Payer", invoice.name],
          ["Authorized on card", `SAR ${sar(invoice.amount)}`],
          ["Card", `${invoice.paymentBrand} •••• ${invoice.cardLast4}`],
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Capture amount" required error={err("amount")}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Request ID" required={partial} error={err("requestId")} hint={partial ? "Required for partial capture" : undefined}>
          <div className="flex gap-1">
            <Input value={requestId} onChange={(e) => setRequestId(e.target.value)} className="font-mono" />
            <Button type="button" variant="outline" size="icon" onClick={() => setRequestId(reqId("CP"))}>
              <RefreshCwIcon />
            </Button>
          </div>
        </Field>
      </div>
      {partial && Number(amount) > 0 && <p className="text-xs text-amber-700">SAR {sar(invoice.amount - Number(amount))} will be released back to the customer&apos;s card.</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Capturing…" : partial ? "Capture partially" : "Capture in full"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RefundDialog(props: DialogProps) {
  return (
    <Shell {...props}>
      <RefundForm {...props} />
    </Shell>
  );
}

function RefundForm({ onOpenChange, invoice }: DialogProps) {
  const [amount, setAmount] = useState(String(invoice.collected));
  const [requestId, setRequestId] = useState("");
  const { busy, err, run } = useSubmit();
  const partial = Number(amount) < invoice.collected;

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(
          () =>
            dhamen.refund({
              paymentReferenceId: invoice.paymentReferenceId,
              customerIdentifier: invoice.customerIdentifier,
              amount: Number(amount),
              requestId: requestId || undefined,
            }),
          { success: `Refunded SAR ${sar(Number(amount))} to card` },
        );
        if (res) onOpenChange(false);
      }}
    >
      <DialogHeader>
        <DialogTitle>Refund to card</DialogTitle>
        <DialogDescription>PUT /api/payments/refund · partial or full refund of a captured / directly debited payment.</DialogDescription>
      </DialogHeader>
      <Summary
        rows={[
          ["Paid", `SAR ${sar(invoice.isPreAuth ? invoice.capturedAmount : invoice.amount)}`],
          ["Already refunded", `SAR ${sar(invoice.refundedAmount)}`],
          ["Refundable", `SAR ${sar(invoice.collected)}`],
          ["Debited from", invoice.accountLabel],
        ]}
      />
      <div className="grid grid-cols-2 gap-3">
        <Field label="Refund amount" required error={err("amount")}>
          <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
        </Field>
        <Field label="Request ID" required={partial} error={err("requestId")} hint={partial ? "Required for partial refund" : undefined}>
          <div className="flex gap-1">
            <Input value={requestId} onChange={(e) => setRequestId(e.target.value)} className="font-mono" />
            <Button type="button" variant="outline" size="icon" onClick={() => setRequestId(reqId("RF"))}>
              <RefreshCwIcon />
            </Button>
          </div>
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Refunding…" : partial ? "Partial refund" : "Full refund"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function RefundIbanDialog(props: DialogProps & { customerIban?: string }) {
  return (
    <Shell {...props}>
      <RefundIbanForm {...props} />
    </Shell>
  );
}

function RefundIbanForm({ onOpenChange, invoice, customerIban }: DialogProps & { customerIban?: string }) {
  const [form, setForm] = useState({ customerName: invoice.name, iban: customerIban ?? "", amount: String(invoice.collected), requestId: "" });
  const { busy, err, run } = useSubmit();

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(
          () =>
            dhamen.refundIban({
              paymentReferenceId: invoice.paymentReferenceId,
              customerName: form.customerName,
              iban: form.iban,
              amount: form.amount ? Number(form.amount) : undefined,
              requestId: form.requestId || undefined,
            }),
          { success: "Refund sent to beneficiary IBAN" },
        );
        if (res) onOpenChange(false);
      }}
    >
      <DialogHeader>
        <DialogTitle>Refund to IBAN</DialogTitle>
        <DialogDescription>POST /api/payments/refund-iban · pays the refund by bank transfer instead of reversing to the card.</DialogDescription>
      </DialogHeader>
      <Summary
        rows={[
          ["Refundable", `SAR ${sar(invoice.collected)}`],
          ["Debited from", invoice.accountLabel],
        ]}
      />
      <Field label="Beneficiary name" required error={err("customerName")}>
        <Input value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
      </Field>
      <Field label="Beneficiary IBAN" required error={err("iban")}>
        <Input value={form.iban} onChange={(e) => setForm({ ...form, iban: e.target.value })} className="font-mono" placeholder="SA9478000000001300051797" />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Amount" error={err("amount")} hint="Empty = full remaining">
          <Input value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} inputMode="decimal" />
        </Field>
        <Field label="Request ID" error={err("requestId")}>
          <div className="flex gap-1">
            <Input value={form.requestId} onChange={(e) => setForm({ ...form, requestId: e.target.value })} className="font-mono" />
            <Button type="button" variant="outline" size="icon" onClick={() => setForm({ ...form, requestId: reqId("RI") })}>
              <RefreshCwIcon />
            </Button>
          </div>
        </Field>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Sending…" : "Send refund"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function SubsequentDialog(props: DialogProps) {
  return (
    <Shell {...props}>
      <SubsequentForm {...props} />
    </Shell>
  );
}

function SubsequentForm({ onOpenChange, invoice }: DialogProps) {
  const [ref, setRef] = useState(() => newRef("SUB"));
  const [amount, setAmount] = useState(String(invoice.amount));
  const { busy, err, run } = useSubmit();
  const router = useRouter();

  return (
    <form
      className="grid gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const res = await run(
          () =>
            dhamen.subsequentPayment({
              paymentReferenceId: ref,
              originalPaymentReferenceId: invoice.paymentReferenceId,
              customerIdentifier: invoice.customerIdentifier,
              amount: Number(amount),
            }),
          { success: `Charged SAR ${sar(Number(amount))} on saved card` },
        );
        if (res) {
          onOpenChange(false);
          router.push(`/payments/${res.invoiceId}`);
        }
      }}
    >
      <DialogHeader>
        <DialogTitle>Subsequent (recurring) payment</DialogTitle>
        <DialogDescription>POST /api/payments/customer-subsequent-payment · charges the saved card without asking the customer to re-enter it.</DialogDescription>
      </DialogHeader>
      <Summary
        rows={[
          ["Original reference", invoice.paymentReferenceId],
          ["Saved card", `${invoice.paymentBrand} •••• ${invoice.cardLast4}`],
          ["Customer", invoice.name],
        ]}
      />
      <Field label="New payment reference ID" required error={err("paymentReferenceId")}>
        <Input value={ref} onChange={(e) => setRef(e.target.value)} className="font-mono" />
      </Field>
      <Field label="Amount (SAR)" required error={err("amount")}>
        <Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" />
      </Field>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
        <Button type="submit" disabled={busy}>
          {busy ? "Charging…" : "Charge saved card"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function StatusDialog(props: DialogProps) {
  return (
    <Shell {...props} className="sm:max-w-lg">
      <StatusBody {...props} />
    </Shell>
  );
}

function StatusBody({ invoice }: DialogProps) {
  const [data, setData] = useState<unknown>();
  const [error, setError] = useState<string>();
  useEffect(() => {
    dhamen
      .customerPaymentStatus({ paymentReferenceId: invoice.paymentReferenceId, customerIdentifier: invoice.customerIdentifier })
      .then(setData)
      .catch((e) => setError(errorMessage(e)));
  }, [invoice.paymentReferenceId, invoice.customerIdentifier]);

  return (
    <>
      <DialogHeader>
        <DialogTitle>Customer payment status</DialogTitle>
        <DialogDescription>POST /api/payments/customer-payment-status</DialogDescription>
      </DialogHeader>
      <JsonView value={{ paymentReferenceId: invoice.paymentReferenceId, customerIdentifier: invoice.customerIdentifier }} className="max-h-24" />
      {error ? <p className="text-sm text-rose-600">{error}</p> : data ? <JsonView value={data} /> : <p className="text-sm text-muted-foreground">Calling Dhamen…</p>}
      <p className="text-xs text-muted-foreground">paymentStatus: 0 unpaid · 1 paid — reconciliationStatus: 1 settled · 3 pending</p>
    </>
  );
}
