"use client";

import { AlertCircleIcon, ArrowRightIcon, CheckCircle2Icon, CreditCardIcon, Loader2Icon, LockIcon, ShieldCheckIcon, TimerIcon, XCircleIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { demo, errorMessage } from "@/lib/client/api";
import { fmtDate, sar } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { InvoiceStatus } from "@/lib/dhamen/types";

interface CheckoutInfo {
  invoiceId: string;
  paymentReferenceId: string;
  merchantName: string;
  supplierName?: string;
  customerName: string;
  customerIdentifier: string;
  amount: number;
  status: InvoiceStatus;
  isPreAuth: boolean;
  enableBNPL: boolean;
  enableRecurring: boolean;
  expiresAt?: string;
  returnUrl?: string;
  paymentBrand?: string;
  cardLast4?: string;
  rrn?: string;
  paidAt?: string;
}

const TEST_CARDS = [
  { label: "MADA · success", number: "4464 0400 0000 0007" },
  { label: "VISA · success", number: "4111 1111 1111 1111" },
  { label: "Mastercard · success", number: "5123 4500 0000 0008" },
  { label: "Declined by issuer", number: "4000 0000 0000 0002" },
  { label: "Insufficient funds", number: "4000 0000 0000 9995" },
];

const MADA_BINS = ["446404", "440647", "440795", "457865", "968208", "588845", "504300", "636120", "529415", "543357"];
function brandOf(n: string) {
  const d = n.replace(/\D/g, "");
  if (MADA_BINS.some((b) => d.startsWith(b))) return "MADA";
  if (d.startsWith("4")) return "VISA";
  if (/^(5[1-5]|2[2-7])/.test(d)) return "MASTER";
  return null;
}

function BrandBadge({ brand, active }: { brand: string; active?: boolean }) {
  const styles: Record<string, string> = { MADA: "bg-[#84b740] text-white", VISA: "bg-[#1a1f71] text-white", MASTER: "bg-[#eb001b] text-white" };
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-bold tracking-wide transition", styles[brand], active === false && "opacity-25 grayscale")}>
      {brand === "MASTER" ? "MASTERCARD" : brand}
    </span>
  );
}

type Step = "form" | "otp" | "processing" | "success" | "declined";

export default function CheckoutPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [info, setInfo] = useState<CheckoutInfo>();
  const [error, setError] = useState<string>();
  const [method, setMethod] = useState<"card" | "tabby">("card");
  const [card, setCard] = useState({ number: "", name: "", expiry: "", cvv: "" });
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<Step>("form");
  const [reason, setReason] = useState<string>();
  const [fieldError, setFieldError] = useState<string>();

  const load = useCallback(() => {
    demo
      .get<CheckoutInfo>(`checkout/${invoiceId}`)
      .then((d) => {
        setInfo(d);
        setCard((c) => (c.name ? c : { ...c, name: d.customerName.replace(/^Guest – /, "").toUpperCase() }));
      })
      .catch((e) => setError(errorMessage(e)));
  }, [invoiceId]);
  useEffect(load, [load]);

  const brand = brandOf(card.number);
  const formatCard = (v: string) =>
    v
      .replace(/\D/g, "")
      .slice(0, 16)
      .replace(/(.{4})/g, "$1 ")
      .trim();
  const formatExpiry = (v: string) => {
    const d = v.replace(/\D/g, "").slice(0, 4);
    return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  };

  function startPayment(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(undefined);
    if (method === "card") {
      if (card.number.replace(/\D/g, "").length < 16 || !brand) return setFieldError("Enter a valid MADA, VISA or Mastercard number.");
      if (!/^\d{2}\/\d{2}$/.test(card.expiry)) return setFieldError("Enter the expiry date as MM/YY.");
      if (!/^\d{3,4}$/.test(card.cvv)) return setFieldError("Enter the 3-digit security code.");
      if (!card.name.trim()) return setFieldError("Enter the cardholder name.");
    }
    setOtp("");
    setStep("otp");
  }

  async function confirmOtp(e: React.FormEvent) {
    e.preventDefault();
    if (!/^\d{6}$/.test(otp)) return;
    setStep("processing");
    await new Promise((r) => setTimeout(r, 1400));
    try {
      const res = await demo.post<{ outcome: "success" | "declined"; reason?: string }>(`checkout/${invoiceId}`, { method, cardNumber: card.number });
      if (res.outcome === "success") {
        setStep("success");
        load();
      } else {
        setReason(res.reason);
        setStep("declined");
      }
    } catch (err) {
      setReason(errorMessage(err));
      setStep("declined");
    }
  }

  const closed = info && info.status !== "unpaid" && step !== "success";
  const installment = info ? info.amount / 4 : 0;

  return (
    <div className="min-h-dvh bg-gradient-to-b from-[#f3f0fa] to-[#fbfaff]">
      <header className="border-b bg-white/80 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-[#4b2a84] text-white">
              <ShieldCheckIcon className="size-4" />
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold">Dhamen Secure Checkout</div>
              <div className="text-[11px] text-muted-foreground">Escrow-protected payment</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <LockIcon className="size-3.5" /> 256-bit TLS
            <span className="rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">SANDBOX</span>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-5xl gap-6 px-4 py-8 md:grid-cols-[1fr_1.1fr]">
        {error && (
          <div className="rounded-2xl border bg-white p-8 text-center md:col-span-2">
            <XCircleIcon className="mx-auto mb-3 size-10 text-rose-500" />
            <div className="text-lg font-semibold">Payment link not found</div>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}
        {!info && !error && (
          <div className="flex items-center justify-center p-20 md:col-span-2">
            <Loader2Icon className="size-6 animate-spin text-violet-600" />
          </div>
        )}
        {info && (
          <>
            <section className="h-fit rounded-2xl border bg-white p-6 shadow-sm">
              <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Pay to</div>
              <div className="mt-1 text-xl font-semibold">{info.merchantName}</div>
              {info.supplierName && <div className="text-sm text-muted-foreground">on behalf of {info.supplierName}</div>}
              <div className="my-6 rounded-xl bg-gradient-to-br from-[#4b2a84] to-[#6d3fb3] p-5 text-white">
                <div className="text-xs text-white/70">{info.isPreAuth ? "Amount to authorize" : "Amount due"}</div>
                <div className="mt-1 text-4xl font-semibold tabular-nums">
                  <span className="mr-1.5 text-lg font-medium text-white/70">SAR</span>
                  {sar(info.amount)}
                </div>
              </div>
              <dl className="grid gap-2.5 text-sm">
                {[
                  [
                    "Reference",
                    <span key="r" className="font-mono">
                      {info.paymentReferenceId}
                    </span>,
                  ],
                  ["Customer", info.customerName],
                  [
                    "Customer ID",
                    <span key="c" className="font-mono">
                      {info.customerIdentifier}
                    </span>,
                  ],
                  ...(info.expiresAt ? [["Link expires", fmtDate(info.expiresAt)]] : []),
                ].map(([k, v]) => (
                  <div key={String(k)} className="flex justify-between gap-3">
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="text-right font-medium">{v}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 grid gap-2 rounded-xl bg-violet-50 p-3 text-xs text-violet-900">
                <div className="flex items-start gap-2">
                  <ShieldCheckIcon className="mt-0.5 size-3.5 shrink-0" />
                  Your payment is held in a regulated escrow account and only released to the seller according to the agreed terms.
                </div>
                {info.isPreAuth && (
                  <div className="flex items-start gap-2">
                    <TimerIcon className="mt-0.5 size-3.5 shrink-0" />
                    This is a pre-authorization: the amount is held on your card and charged only when the merchant captures it.
                  </div>
                )}
                {info.enableRecurring && (
                  <div className="flex items-start gap-2">
                    <CreditCardIcon className="mt-0.5 size-3.5 shrink-0" />
                    Your card will be saved securely for future payments to this merchant.
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border bg-white p-6 shadow-sm">
              {step === "success" || (closed && info.status !== "cancelled" && info.status !== "expired" && info.status !== "reversed") ? (
                <div className="grid justify-items-center gap-3 py-6 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-emerald-100">
                    <CheckCircle2Icon className="size-9 text-emerald-600" />
                  </div>
                  <div className="text-xl font-semibold">{info.status === "authorized" ? "Payment authorized" : "Payment successful"}</div>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    {info.status === "authorized"
                      ? `SAR ${sar(info.amount)} is on hold on your card until the merchant captures it.`
                      : `SAR ${sar(info.amount)} has been paid to ${info.merchantName}.`}
                  </p>
                  <div className="mt-2 grid w-full gap-2 rounded-xl border bg-muted/30 p-4 text-left text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Method</span>
                      <span className="font-medium">{info.paymentBrand === "TABBY" ? "Tabby" : `${info.paymentBrand} •••• ${info.cardLast4}`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">RRN</span>
                      <span className="font-mono">{info.rrn}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Date</span>
                      <span>{fmtDate(info.paidAt)}</span>
                    </div>
                  </div>
                  {info.returnUrl && (
                    <Button className="mt-2 h-10 w-full bg-[#4b2a84]" onClick={() => window.location.assign(info.returnUrl!)}>
                      Return to merchant <ArrowRightIcon />
                    </Button>
                  )}
                </div>
              ) : closed ? (
                <div className="grid justify-items-center gap-3 py-10 text-center">
                  <AlertCircleIcon className="size-12 text-zinc-400" />
                  <div className="text-xl font-semibold">This payment link is {info.status}</div>
                  <p className="max-w-xs text-sm text-muted-foreground">Please contact {info.merchantName} for a new payment link.</p>
                </div>
              ) : step === "otp" || step === "processing" ? (
                <form onSubmit={confirmOtp} className="grid gap-5 py-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold">{method === "tabby" ? "Tabby verification" : "3-D Secure authentication"}</div>
                    {method === "card" && brand && <BrandBadge brand={brand} />}
                  </div>
                  <div className="rounded-xl border bg-muted/30 p-4 text-sm">
                    <p>
                      Enter the one-time password sent to your mobile number ending in <b>••••{info.customerIdentifier.slice(-2)}</b> to confirm a payment of{" "}
                      <b>SAR {sar(method === "tabby" ? installment : info.amount)}</b>
                      {method === "tabby" ? " (first installment)" : ""} to <b>{info.merchantName}</b>.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">Sandbox: any 6 digits work.</p>
                  </div>
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="••••••"
                    autoFocus
                    className="h-12 text-center font-mono text-2xl tracking-[0.5em]"
                    disabled={step === "processing"}
                  />
                  <Button type="submit" className="h-11 bg-[#4b2a84]" disabled={otp.length !== 6 || step === "processing"}>
                    {step === "processing" ? (
                      <>
                        <Loader2Icon className="animate-spin" /> Processing payment…
                      </>
                    ) : (
                      "Confirm"
                    )}
                  </Button>
                  <button type="button" className="text-xs text-muted-foreground hover:underline" onClick={() => setStep("form")} disabled={step === "processing"}>
                    Cancel and go back
                  </button>
                </form>
              ) : step === "declined" ? (
                <div className="grid justify-items-center gap-3 py-8 text-center">
                  <div className="flex size-16 items-center justify-center rounded-full bg-rose-100">
                    <XCircleIcon className="size-9 text-rose-600" />
                  </div>
                  <div className="text-xl font-semibold">Payment declined</div>
                  <p className="max-w-xs text-sm text-muted-foreground first-letter:uppercase">{reason}</p>
                  <Button className="mt-2" variant="outline" onClick={() => setStep("form")}>
                    Try another card
                  </Button>
                </div>
              ) : (
                <form onSubmit={startPayment} className="grid gap-4">
                  <div className="text-sm font-semibold">Payment method</div>
                  <div className={cn("grid gap-2", info.enableBNPL && "grid-cols-2")}>
                    <button
                      type="button"
                      onClick={() => setMethod("card")}
                      className={cn(
                        "flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition",
                        method === "card" ? "border-[#4b2a84] bg-violet-50 ring-1 ring-[#4b2a84]" : "hover:bg-muted/50",
                      )}
                    >
                      <CreditCardIcon className="size-4" />
                      <span className="font-medium">Card</span>
                      <span className="ml-auto flex gap-1">
                        <BrandBadge brand="MADA" />
                        <BrandBadge brand="VISA" />
                        <BrandBadge brand="MASTER" />
                      </span>
                    </button>
                    {info.enableBNPL && (
                      <button
                        type="button"
                        onClick={() => setMethod("tabby")}
                        className={cn(
                          "flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition",
                          method === "tabby" ? "border-[#4b2a84] bg-violet-50 ring-1 ring-[#4b2a84]" : "hover:bg-muted/50",
                        )}
                      >
                        <span className="rounded bg-[#3bffc1] px-1.5 py-0.5 text-[10px] font-bold text-black">tabby</span>
                        <span className="font-medium">Pay in 4</span>
                      </button>
                    )}
                  </div>

                  {method === "card" ? (
                    <>
                      <label className="grid gap-1.5 text-xs font-medium">
                        Card number
                        <div className="relative">
                          <Input
                            value={card.number}
                            onChange={(e) => setCard({ ...card, number: formatCard(e.target.value) })}
                            placeholder="1234 5678 9012 3456"
                            inputMode="numeric"
                            className="h-11 pr-28 font-mono text-base"
                            autoComplete="off"
                          />
                          <span className="absolute top-1/2 right-3 flex -translate-y-1/2 gap-1">
                            {(["MADA", "VISA", "MASTER"] as const).map((b) => (
                              <BrandBadge key={b} brand={b} active={brand ? brand === b : undefined} />
                            ))}
                          </span>
                        </div>
                      </label>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="grid gap-1.5 text-xs font-medium">
                          Expiry date
                          <Input
                            value={card.expiry}
                            onChange={(e) => setCard({ ...card, expiry: formatExpiry(e.target.value) })}
                            placeholder="MM/YY"
                            inputMode="numeric"
                            className="h-11 font-mono"
                            autoComplete="off"
                          />
                        </label>
                        <label className="grid gap-1.5 text-xs font-medium">
                          CVV
                          <Input
                            value={card.cvv}
                            onChange={(e) => setCard({ ...card, cvv: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                            placeholder="•••"
                            inputMode="numeric"
                            type="password"
                            className="h-11 font-mono"
                            autoComplete="off"
                          />
                        </label>
                      </div>
                      <label className="grid gap-1.5 text-xs font-medium">
                        Name on card
                        <Input value={card.name} onChange={(e) => setCard({ ...card, name: e.target.value.toUpperCase() })} className="h-11" autoComplete="off" />
                      </label>
                    </>
                  ) : (
                    <div className="grid gap-3 rounded-xl border p-4">
                      <div className="text-sm font-medium">Split into 4 interest-free payments</div>
                      <div className="grid grid-cols-4 gap-2 text-center">
                        {["Today", "In 1 month", "In 2 months", "In 3 months"].map((l, i) => (
                          <div key={l} className="rounded-lg bg-muted/50 p-2">
                            <div className={cn("mx-auto mb-1 size-3 rounded-full border-2 border-[#3bffc1]", i === 0 && "bg-[#3bffc1]")} />
                            <div className="text-xs font-semibold tabular-nums">{sar(installment)}</div>
                            <div className="text-[10px] text-muted-foreground">{l}</div>
                          </div>
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground">No fees. The merchant receives the full amount in escrow today.</p>
                    </div>
                  )}

                  {fieldError && <p className="text-xs text-rose-600">{fieldError}</p>}
                  <Button type="submit" className="h-11 bg-[#4b2a84] text-base">
                    <LockIcon /> {method === "tabby" ? "Continue with Tabby" : `${info.isPreAuth ? "Authorize" : "Pay"} SAR ${sar(info.amount)}`}
                  </Button>

                  {method === "card" && (
                    <div className="rounded-xl border border-dashed p-3">
                      <div className="mb-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Sandbox test cards</div>
                      <div className="grid gap-1">
                        {TEST_CARDS.map((t) => (
                          <button
                            key={t.number}
                            type="button"
                            onClick={() => setCard({ ...card, number: t.number, expiry: "12/28", cvv: "123" })}
                            className="flex items-center justify-between rounded-md px-2 py-1 text-xs hover:bg-muted"
                          >
                            <span className="font-mono">{t.number}</span>
                            <span className={cn(t.label.includes("success") ? "text-emerald-700" : "text-rose-600")}>{t.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </form>
              )}
            </section>
          </>
        )}
      </main>
      <footer className="pb-8 text-center text-[11px] text-muted-foreground">Sandbox environment · no real money is moved · Demo by Umran Tech</footer>
    </div>
  );
}
