"use client";

import {
  ArrowLeftIcon,
  BanIcon,
  BadgeCheckIcon,
  CircleDollarSignIcon,
  CircleDotIcon,
  ExternalLinkIcon,
  HandCoinsIcon,
  LandmarkIcon,
  LockIcon,
  SendIcon,
  TimerOffIcon,
  Undo2Icon,
  UndoDotIcon,
  XCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MethodTag, StatusTag } from "@/components/layout/api-inspector";
import { CopyButton, Mono } from "@/components/app/copy-button";
import { InfoRow } from "@/components/app/info-row";
import { BrandMark } from "@/components/app/invoice-table";
import { JsonView } from "@/components/app/json-view";
import { LedgerTable } from "@/components/app/ledger-table";
import { Money } from "@/components/app/money";
import { InvoiceStatusBadge, PayoutStatusBadge, Pill, ReconBadge } from "@/components/app/status-badge";
import { PaymentActions } from "@/components/forms/payment-actions";
import { useDemo } from "@/lib/client/use-api";
import type { InvoiceDetail } from "@/lib/client/types";
import type { InvoiceEvent } from "@/lib/dhamen/types";
import { fmtDate, sar, shortHash, timeAgo } from "@/lib/format";
import { cn } from "@/lib/utils";

const EVENT_ICON: Record<InvoiceEvent["type"], { icon: typeof CircleDotIcon; cls: string }> = {
  created: { icon: CircleDotIcon, cls: "bg-zinc-100 text-zinc-600" },
  attempt_failed: { icon: XCircleIcon, cls: "bg-rose-100 text-rose-600" },
  authorized: { icon: LockIcon, cls: "bg-violet-100 text-violet-700" },
  paid: { icon: CircleDollarSignIcon, cls: "bg-emerald-100 text-emerald-700" },
  captured: { icon: HandCoinsIcon, cls: "bg-emerald-100 text-emerald-700" },
  reversed: { icon: UndoDotIcon, cls: "bg-zinc-100 text-zinc-600" },
  refunded: { icon: Undo2Icon, cls: "bg-orange-100 text-orange-700" },
  refunded_iban: { icon: LandmarkIcon, cls: "bg-orange-100 text-orange-700" },
  cancelled: { icon: BanIcon, cls: "bg-zinc-100 text-zinc-600" },
  expired: { icon: TimerOffIcon, cls: "bg-zinc-100 text-zinc-600" },
  settled: { icon: BadgeCheckIcon, cls: "bg-sky-100 text-sky-700" },
  funds_to_supplier: { icon: SendIcon, cls: "bg-amber-100 text-amber-700" },
};

export default function PaymentDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { data, error } = useDemo<InvoiceDetail>(`invoices/${invoiceId}`);

  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!data) return <Skeleton className="h-96 rounded-xl" />;
  const inv = data.invoice;
  const paid = inv.isPreAuth ? inv.capturedAmount : ["paid", "partially_refunded", "refunded"].includes(inv.status) ? inv.amount : 0;

  return (
    <>
      <Link href="/payments" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Payments
      </Link>

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-mono text-xl font-semibold tracking-tight sm:text-2xl">{inv.paymentReferenceId}</h1>
            <InvoiceStatusBadge status={inv.status} />
            {inv.isPreAuth && (
              <Pill t="purple" dot={false}>
                Pre-auth
              </Pill>
            )}
            {inv.enableRecurring && (
              <Pill t="blue" dot={false}>
                Recurring
              </Pill>
            )}
            {inv.enableBNPL && (
              <Pill t="green" dot={false}>
                BNPL
              </Pill>
            )}
            {data.siblings.length > 0 && (
              <Pill t="orange" dot={false}>
                Split bill · {data.siblings.length + 1} payers
              </Pill>
            )}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
            {inv.name} · {inv.customerIdentifier} · invoice <Mono>{shortHash(inv.invoiceId)}</Mono>
            <CopyButton value={inv.invoiceId} label="Invoice ID" />
          </div>
        </div>
        <div className="text-left lg:text-right">
          <div className="text-xs text-muted-foreground">Amount</div>
          <Money value={inv.amount} className="text-3xl font-semibold" />
        </div>
      </div>

      <PaymentActions invoice={inv} mode="bar" customerIban={data.customer?.iban} />

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="grid min-w-0 gap-4 xl:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Funds</CardTitle>
              <CardDescription>Where this money is right now</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-3 md:grid-cols-4">
              {[
                { label: inv.isPreAuth ? "Authorized" : "Requested", value: inv.amount },
                { label: inv.isPreAuth ? "Captured" : "Paid", value: paid },
                { label: "Refunded", value: inv.refundedAmount },
                { label: "Net collected", value: inv.collected },
              ].map((x) => (
                <div key={x.label} className="rounded-lg border bg-muted/30 p-3">
                  <div className="text-xs text-muted-foreground">{x.label}</div>
                  <Money value={x.value} className="text-lg font-semibold" />
                </div>
              ))}
              <div className="col-span-2 flex flex-wrap items-center gap-2 rounded-lg border border-dashed p-3 text-xs md:col-span-4">
                <LandmarkIcon className="size-4 text-violet-600" />
                Collected into <span className="font-medium">{data.account.ownerName}</span>
                <Mono className="text-muted-foreground">{data.account.viban}</Mono>
                <span className="text-muted-foreground">·</span>
                {inv.isRegisteredCustomer ? "Customer VIBAN (registered identity number)" : "Authority virtual account (guest identifier)"}
                {data.supplierLines.length > 0 && (
                  <>
                    <span className="text-muted-foreground">→</span>
                    {data.supplierLines.map((l) => (
                      <span key={l.lineId} className="flex items-center gap-1">
                        {data.supplier?.name} <PayoutStatusBadge status={l.status} />
                      </span>
                    ))}
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ol className="grid gap-4">
                {[...inv.events].reverse().map((e, i) => {
                  const m = EVENT_ICON[e.type];
                  return (
                    <li key={i} className="flex gap-3">
                      <div className={cn("flex size-8 shrink-0 items-center justify-center rounded-full", m.cls)}>
                        <m.icon className="size-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium">{e.message}</div>
                        <div className="text-xs text-muted-foreground">
                          {fmtDate(e.at)} · {timeAgo(e.at)}
                        </div>
                      </div>
                      {e.amount != null && <Money value={e.amount} className="text-sm font-medium" />}
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>

          <Tabs defaultValue="api">
            <TabsList>
              <TabsTrigger value="api">API calls ({data.apiLogs.length})</TabsTrigger>
              <TabsTrigger value="webhooks">Webhooks ({data.notifications.length})</TabsTrigger>
              <TabsTrigger value="ledger">Ledger ({data.ledger.length})</TabsTrigger>
            </TabsList>
            <TabsContent value="api" className="mt-2 grid gap-2">
              {data.apiLogs.length === 0 && (
                <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
                  Seeded payment — no API calls recorded in this session. Perform an action to see request/response pairs.
                </div>
              )}
              {data.apiLogs.map((l) => (
                <details key={l.id} className="group rounded-xl border bg-card">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
                    <MethodTag method={l.method} />
                    <span className="font-mono text-xs">{l.path}</span>
                    <StatusTag status={l.status} />
                    <span className="ml-auto text-xs text-muted-foreground">
                      {l.durationMs}ms · {timeAgo(l.createdAt)}
                    </span>
                  </summary>
                  <div className="grid gap-2 border-t p-3 md:grid-cols-2">
                    <JsonView value={l.request} />
                    <JsonView value={l.response} />
                  </div>
                </details>
              ))}
            </TabsContent>
            <TabsContent value="webhooks" className="mt-2 grid gap-2">
              {data.notifications.map((n) => (
                <details key={n.id} className="rounded-xl border bg-card">
                  <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm">
                    <span className="font-medium">{n.payload.NotificationType}</span>
                    <span className="text-xs text-muted-foreground">#{n.id}</span>
                    <span className="ml-auto text-xs text-muted-foreground">{fmtDate(n.createdAt)}</span>
                  </summary>
                  <div className="border-t p-3">
                    <JsonView value={n.payload} />
                  </div>
                </details>
              ))}
            </TabsContent>
            <TabsContent value="ledger" className="mt-2">
              <LedgerTable
                rows={data.ledger}
                showAccount
                accountName={(id) => (id === data.account.accountId ? data.account.ownerName : id.startsWith("S:") ? (data.supplier?.name ?? id) : id)}
              />
            </TabsContent>
          </Tabs>
        </div>

        <div className="grid min-w-0 content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>Payment link</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex min-w-0 items-center gap-1 rounded-lg bg-muted/60 px-2 py-1.5">
                <span className="min-w-0 flex-1 truncate font-mono text-[11px] text-muted-foreground">{inv.paymentUrl}</span>
                <CopyButton value={inv.paymentUrl} label="Payment URL" />
                <a
                  href={inv.paymentUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <ExternalLinkIcon className="size-3.5" />
                </a>
              </div>
              <div>
                <InfoRow label="Created">{fmtDate(inv.createdAt)}</InfoRow>
                <InfoRow label="Expires">{inv.expiresAt ? fmtDate(inv.expiresAt) : "No expiry"}</InfoRow>
                <InfoRow label="Return URL">
                  <span className="truncate text-xs">{inv.returnUrl ?? "—"}</span>
                </InfoRow>
                <InfoRow label="Failed attempts">{inv.failedAttempts ? <span className="text-rose-600">{inv.failedAttempts}</span> : 0}</InfoRow>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Payment method</CardTitle>
            </CardHeader>
            <CardContent>
              <InfoRow label="Brand">
                <BrandMark brand={inv.paymentBrand} />
              </InfoRow>
              <InfoRow label="Card">{inv.cardLast4 ? `•••• ${inv.cardLast4}` : "—"}</InfoRow>
              <InfoRow label="RRN">
                <Mono>{inv.rrn ?? "—"}</Mono>
              </InfoRow>
              <InfoRow label="Paid at">{fmtDate(inv.paidAt)}</InfoRow>
              <InfoRow label="Settlement">
                <ReconBadge value={inv.reconciliationStatus} />
              </InfoRow>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Parties</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-2">
              {data.customer ? (
                <Link href={`/customers/${data.customer.customerId}`} className="rounded-lg border p-3 hover:bg-muted/40">
                  <div className="text-xs text-muted-foreground">Customer</div>
                  <div className="font-medium">{data.customer.name}</div>
                  <Mono className="text-muted-foreground">{data.customer.viban}</Mono>
                </Link>
              ) : (
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Guest payer</div>
                  <div className="font-medium">{inv.name}</div>
                  <Mono className="text-muted-foreground">{inv.customerIdentifier}</Mono>
                </div>
              )}
              {data.supplier ? (
                <Link href={`/suppliers/${data.supplier.supplierId}`} className="rounded-lg border p-3 hover:bg-muted/40">
                  <div className="text-xs text-muted-foreground">Supplier (payee)</div>
                  <div className="font-medium">{data.supplier.name}</div>
                  <Mono className="text-muted-foreground">{data.supplier.iban}</Mono>
                </Link>
              ) : (
                <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">No supplier attached. Use Supplier Payment (split) to release these funds.</div>
              )}
            </CardContent>
          </Card>
          {(data.siblings.length > 0 || data.subsequent.length > 0) && (
            <Card>
              <CardHeader>
                <CardTitle>{data.siblings.length ? "Other payers on this reference" : "Recurring charges"}</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1">
                {[...data.siblings, ...data.subsequent].map((s) => (
                  <Link key={s.invoiceId} href={`/payments/${s.invoiceId}`} className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-muted/50">
                    <span className="truncate">{s.kind === "subsequent" ? s.paymentReferenceId : s.name}</span>
                    <InvoiceStatusBadge status={s.status} />
                    <span className="text-xs tabular-nums">{sar(s.amount)}</span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
