"use client";

import {
  ArrowLeftRightIcon,
  ArrowRightIcon,
  BadgeCheckIcon,
  BanknoteIcon,
  Building2Icon,
  CreditCardIcon,
  HourglassIcon,
  LandmarkIcon,
  PlusIcon,
  ShieldCheckIcon,
  SplitIcon,
  WalletIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Money } from "@/components/app/money";
import { PageHeader } from "@/components/app/page-header";
import { StatCard } from "@/components/app/stat-card";
import { INVOICE_STATUS, InvoiceStatusBadge } from "@/components/app/status-badge";
import { PaymentLinkDialog } from "@/components/forms/payment-link-dialog";
import { SplitPayoutDialog } from "@/components/forms/split-payout-dialog";
import { useDemo } from "@/lib/client/use-api";
import type { Overview } from "@/lib/client/types";
import type { InvoiceStatus } from "@/lib/dhamen/types";
import { sar, sarCompact, timeAgo } from "@/lib/format";

const SERIES = [
  { key: "collections", label: "Collections", color: "#5b35a0" },
  { key: "payouts", label: "Supplier payouts", color: "#e07b12" },
  { key: "refunds", label: "Refunds", color: "#1f9d8b" },
] as const;

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}

export default function DashboardPage() {
  const { data } = useDemo<Overview>("overview");
  const [linkOpen, setLinkOpen] = useState(false);
  const [splitOpen, setSplitOpen] = useState(false);

  return (
    <>
      <PageHeader
        eyebrow="Umran Tech Marketplace · Authority"
        title={data ? greeting() : "Overview"}
        description="Live view of escrow balances, collections and supplier payouts across your Dhamen virtual accounts."
        actions={
          <>
            <Button variant="outline" onClick={() => setSplitOpen(true)}>
              <SplitIcon /> Split payout
            </Button>
            <Button onClick={() => setLinkOpen(true)}>
              <PlusIcon /> New payment link
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-5">
        {data ? (
          <>
            <StatCard
              className="col-span-2 lg:col-span-1"
              label="Total held in escrow"
              value={<Money value={data.escrowTotal} />}
              sub={`Customers ${sarCompact(data.customerEscrow)} · Suppliers ${sarCompact(data.supplierEscrow)}`}
              icon={ShieldCheckIcon}
            />
            <StatCard label="Authority virtual account" value={<Money value={data.authorityBalance} />} sub="Available balance" icon={WalletIcon} accent="blue" />
            <StatCard label="Collected · 30 days" value={<Money value={data.collected30d} />} sub={`Today SAR ${sar(data.collectedToday)}`} icon={CreditCardIcon} accent="teal" />
            <StatCard
              label="Pending supplier payouts"
              value={<Money value={data.pendingPayouts} />}
              sub={`Paid out 30d SAR ${sarCompact(data.paidOut30d)}`}
              icon={ArrowLeftRightIcon}
              accent="orange"
            />
            <StatCard
              label="Pre-auth holds"
              value={<Money value={data.preAuthHeld} />}
              sub={`${data.preAuthCount} awaiting capture · ${data.awaitingSettlement} awaiting settlement`}
              icon={HourglassIcon}
              accent="rose"
            />
          </>
        ) : (
          Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)
        )}
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Money movement</CardTitle>
            <CardDescription>Daily inflows into escrow vs. transfers out, last 30 days (SAR)</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-4 text-xs">
              {SERIES.map((s) => (
                <span key={s.key} className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2.5 rounded-sm" style={{ background: s.color }} />
                  {s.label}
                </span>
              ))}
            </div>
            <div className="h-64">
              {data && (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data.series} margin={{ left: 0, right: 8, top: 4, bottom: 0 }} barGap={2} barCategoryGap="18%">
                    <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
                    <XAxis
                      dataKey="date"
                      tickLine={false}
                      axisLine={false}
                      fontSize={11}
                      tickMargin={8}
                      minTickGap={24}
                      tickFormatter={(d: string) => new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}
                      stroke="var(--muted-foreground)"
                    />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} width={44} tickFormatter={(v: number) => sarCompact(v)} stroke="var(--muted-foreground)" />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.6 }}
                      content={({ active, payload, label }) =>
                        active && payload?.length ? (
                          <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
                            <div className="mb-1 font-medium">{new Date(String(label)).toLocaleDateString("en-GB", { weekday: "short", day: "2-digit", month: "short" })}</div>
                            {SERIES.map((s) => (
                              <div key={s.key} className="flex items-center justify-between gap-6">
                                <span className="flex items-center gap-1.5 text-muted-foreground">
                                  <span className="size-2 rounded-full" style={{ background: s.color }} />
                                  {s.label}
                                </span>
                                <span className="font-medium tabular-nums">{sar(Number(payload.find((p) => p.dataKey === s.key)?.value ?? 0))}</span>
                              </div>
                            ))}
                          </div>
                        ) : null
                      }
                    />
                    {SERIES.map((s) => (
                      <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={10} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Payment pipeline</CardTitle>
            <CardDescription>Payment links by current status</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {data &&
              (Object.keys(INVOICE_STATUS) as InvoiceStatus[])
                .filter((s) => data.statusCounts[s])
                .map((s) => {
                  const max = Math.max(...Object.values(data.statusCounts));
                  const v = data.statusCounts[s];
                  return (
                    <Link key={s} href={`/payments?status=${s}`} className="group grid grid-cols-[130px_1fr_28px] items-center gap-2 text-sm">
                      <span className="truncate text-muted-foreground group-hover:text-foreground">{INVOICE_STATUS[s].label}</span>
                      <span className="h-2 overflow-hidden rounded-full bg-muted">
                        <span className="block h-full rounded-full bg-violet-600/80" style={{ width: `${(v / max) * 100}%` }} />
                      </span>
                      <span className="text-right font-medium tabular-nums">{v}</span>
                    </Link>
                  );
                })}
            {data && (
              <div className="mt-2 grid grid-cols-3 gap-2 border-t pt-3 text-center">
                {Object.entries(data.brandTotals).map(([brand, v]) => (
                  <div key={brand} className="rounded-lg bg-muted/50 px-2 py-1.5">
                    <div className="text-[10px] font-semibold tracking-wide text-muted-foreground">{brand}</div>
                    <div className="text-xs font-medium tabular-nums">{sarCompact(v)}</div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle>How the Dhamen escrow flow works</CardTitle>
          <CardDescription>Every step below is live in this sandbox; each one calls the same endpoint as the production integration.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-5">
            {[
              { icon: CreditCardIcon, title: "1 · Collect", text: "Customer pays a payment link (card, MADA, Tabby) or SADAD bill", href: "/payments" },
              { icon: ShieldCheckIcon, title: "2 · Hold in escrow", text: "Funds land in the customer's dedicated VIBAN or the authority VA", href: "/escrow" },
              { icon: BadgeCheckIcon, title: "3 · Settle", text: "Acquirer settles (T+1) → Payment_Settled notification", href: "/payments?status=paid" },
              { icon: SplitIcon, title: "4 · Release / split", text: "Supplier Payment moves funds to one or many supplier VIBANs", href: "/payouts" },
              { icon: LandmarkIcon, title: "5 · Pay out", text: "SARIE transfer to supplier IBAN on threshold or schedule, with UTI", href: "/payouts" },
            ].map((s, i, arr) => (
              <Link
                key={s.title}
                href={s.href}
                className="group relative rounded-xl border bg-gradient-to-b from-violet-50/70 to-card p-3 transition hover:border-violet-300 dark:from-violet-500/5"
              >
                <s.icon className="mb-2 size-5 text-violet-700" />
                <div className="text-sm font-semibold">{s.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{s.text}</div>
                {i < arr.length - 1 && (
                  <ArrowRightIcon className="absolute top-1/2 -right-3.5 z-10 hidden size-4 -translate-y-1/2 rounded-full bg-card text-muted-foreground md:block" />
                )}
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Recent payment activity</CardTitle>
              <CardDescription>Latest updated payment links</CardDescription>
            </div>
            <Link href="/payments" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </CardHeader>
          <CardContent className="grid gap-1">
            {data?.recentInvoices.map((i) => (
              <Link key={i.invoiceId} href={`/payments/${i.invoiceId}`} className="flex items-center gap-3 rounded-lg px-2 py-2 transition hover:bg-muted/50">
                <div className="flex size-8 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                  <BanknoteIcon className="size-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{i.name}</div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">{i.paymentReferenceId}</div>
                </div>
                <InvoiceStatusBadge status={i.status} />
                <div className="w-28 text-right">
                  <Money value={i.amount} className="text-sm font-medium" />
                  <div className="text-[11px] text-muted-foreground">{timeAgo(i.updatedAt)}</div>
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Webhook feed</CardTitle>
              <CardDescription>Appendix B notifications</CardDescription>
            </div>
            <Link href="/notifications" className="text-xs font-medium text-primary hover:underline">
              Open
            </Link>
          </CardHeader>
          <CardContent>
            <ol className="relative grid gap-3 border-l pl-4">
              {data?.recentNotifications.map((n) => (
                <li key={n.id} className="relative text-xs">
                  <span
                    className={`absolute top-1 -left-[21px] size-2.5 rounded-full ring-2 ring-card ${n.payload.NotificationType.includes("Fail") || n.payload.NotificationType.includes("Insufficient") ? "bg-rose-500" : "bg-violet-500"}`}
                  />
                  <div className="font-medium">{n.payload.NotificationType.replace(/_/g, " ")}</div>
                  <div className="text-muted-foreground">
                    #{n.id} · {timeAgo(n.createdAt)} · {n.delivery.status === "delivered" ? "delivered 200" : n.delivery.status}
                  </div>
                </li>
              ))}
            </ol>
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <Link href="/customers" className="flex items-center gap-2 rounded-lg border p-2 hover:bg-muted/50">
                <Building2Icon className="size-4 text-muted-foreground" /> {data?.customers ?? "–"} active customers
              </Link>
              <Link href="/suppliers" className="flex items-center gap-2 rounded-lg border p-2 hover:bg-muted/50">
                <Building2Icon className="size-4 text-muted-foreground" /> {data?.suppliers ?? "–"} active suppliers
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>

      <PaymentLinkDialog open={linkOpen} onOpenChange={setLinkOpen} />
      <SplitPayoutDialog open={splitOpen} onOpenChange={setSplitOpen} />
    </>
  );
}
