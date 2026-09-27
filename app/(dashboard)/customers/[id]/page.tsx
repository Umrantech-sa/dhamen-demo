"use client";

import { ArchiveRestoreIcon, ArchiveXIcon, ArrowLeftIcon, CreditCardIcon, PencilIcon, PiggyBankIcon, RefreshCwIcon, ShieldCheckIcon } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmDialog } from "@/components/app/confirm-dialog";
import { CopyButton, Mono } from "@/components/app/copy-button";
import { InfoRow } from "@/components/app/info-row";
import { InvoiceTable } from "@/components/app/invoice-table";
import { LedgerTable } from "@/components/app/ledger-table";
import { Money } from "@/components/app/money";
import { Pill, RecordStatusBadge } from "@/components/app/status-badge";
import { CustomerFormDialog } from "@/components/forms/customer-form-dialog";
import { DepositDialog } from "@/components/forms/deposit-dialog";
import { PaymentLinkDialog } from "@/components/forms/payment-link-dialog";
import { demo, dhamen, errorMessage } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import type { CustomerDetail } from "@/lib/client/types";
import { fmtDate, formatIban, initials, sar } from "@/lib/format";

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error } = useDemo<CustomerDetail>(`customers/${id}`);
  const [edit, setEdit] = useState(false);
  const [deposit, setDeposit] = useState(false);
  const [link, setLink] = useState(false);
  const [toggle, setToggle] = useState(false);
  const [checking, setChecking] = useState(false);

  if (error) return <div className="text-sm text-rose-600">{error}</div>;
  if (!data) return <Skeleton className="h-96 rounded-xl" />;
  const c = data.customer;
  const active = c.status === "active";

  async function checkBalance() {
    setChecking(true);
    try {
      const res = await dhamen.customerBalance(c.customerId);
      toast.success(`Available balance SAR ${sar(res.availableBalance)}`, { description: `GET /customer-balance/${c.customerId.slice(0, 8)}… · VIBAN ${res.viban}` });
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <Link href="/customers" className="flex w-fit items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeftIcon className="size-4" /> Customers
      </Link>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-violet-400 text-lg font-semibold text-white">
            {initials(c.name)}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{c.name}</h1>
              <RecordStatusBadge status={c.status} />
            </div>
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              Customer ID <Mono>{c.customerId}</Mono>
              <CopyButton value={c.customerId} label="Customer ID" />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEdit(true)}>
            <PencilIcon /> Edit
          </Button>
          <Button variant="outline" onClick={() => setToggle(true)}>
            {active ? <ArchiveXIcon /> : <ArchiveRestoreIcon />} {active ? "Deactivate" : "Restore"}
          </Button>
          {active && (
            <>
              <Button variant="outline" onClick={() => setDeposit(true)}>
                <PiggyBankIcon /> Deposit money
              </Button>
              <Button onClick={() => setLink(true)}>
                <CreditCardIcon /> New payment link
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="relative overflow-hidden border-0 bg-gradient-to-br from-[#3b1f6e] via-[#4b2a84] to-[#6d3fb3] text-white shadow-lg">
          <div className="pointer-events-none absolute -top-10 -right-10 size-40 rounded-full bg-orange-400/20 blur-2xl" />
          <CardContent className="relative grid gap-5 py-1">
            <div className="flex items-center justify-between text-xs text-white/70">
              <span className="flex items-center gap-1.5">
                <ShieldCheckIcon className="size-3.5" /> Dhamen escrow · Customer VIBAN
              </span>
              <span className="font-semibold tracking-wider">SAR</span>
            </div>
            <div>
              <div className="text-xs text-white/70">Available balance</div>
              <div className="text-3xl font-semibold tabular-nums">{sar(c.balance)}</div>
            </div>
            <div className="flex items-end justify-between gap-2">
              <div>
                <div className="font-mono text-sm tracking-wider">{formatIban(c.viban)}</div>
                <div className="text-xs text-white/60">BBAN {c.bban}</div>
              </div>
              <div className="flex gap-1">
                <CopyButton value={c.viban} label="VIBAN" className="text-white/70 hover:bg-white/10 hover:text-white" />
                <button
                  onClick={checkBalance}
                  disabled={checking}
                  title="Refresh via customer-balance API"
                  className="inline-flex size-6 items-center justify-center rounded-md text-white/70 hover:bg-white/10 hover:text-white"
                >
                  <RefreshCwIcon className={`size-3.5 ${checking ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Profile</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Identity number">
              <Mono>{c.identityNumber}</Mono>
            </InfoRow>
            <InfoRow label="IBAN">{c.iban ? <Mono>{c.iban}</Mono> : <span className="text-muted-foreground">Not provided</span>}</InfoRow>
            <InfoRow label="Email">{c.email ?? "—"}</InfoRow>
            <InfoRow label="Mobile">
              <Mono>{c.mobile ?? "—"}</Mono>
            </InfoRow>
            <InfoRow label="Created">{fmtDate(c.createdAt)}</InfoRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <InfoRow label="Payment links">{c.invoiceCount}</InfoRow>
            <InfoRow label="Net paid (in escrow history)">
              <Money value={c.totalPaid} />
            </InfoRow>
            <InfoRow label="Open links">{data.invoices.filter((i) => i.status === "unpaid").length}</InfoRow>
            <InfoRow label="Pre-auth holds">
              {data.invoices.filter((i) => i.status === "authorized").length ? (
                <Pill t="purple">{data.invoices.filter((i) => i.status === "authorized").length} awaiting capture</Pill>
              ) : (
                "0"
              )}
            </InfoRow>
            <InfoRow label="Funded supplier payments">{data.supplierPayments.length}</InfoRow>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="payments">
        <TabsList>
          <TabsTrigger value="payments">Payments ({data.invoices.length})</TabsTrigger>
          <TabsTrigger value="ledger">VIBAN ledger ({data.ledger.length})</TabsTrigger>
          <TabsTrigger value="sadad">SADAD ({data.sadad.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="payments" className="mt-2">
          <InvoiceTable rows={data.invoices} hideCustomer />
        </TabsContent>
        <TabsContent value="ledger" className="mt-2">
          <LedgerTable rows={data.ledger} />
        </TabsContent>
        <TabsContent value="sadad" className="mt-2">
          <div className="grid gap-2">
            {data.sadad.length === 0 && <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">No SADAD bills for this customer.</div>}
            {data.sadad.map((s) => (
              <div key={s.invoiceId} className="flex items-center justify-between rounded-xl border bg-card p-3 text-sm">
                <div>
                  <Mono className="font-medium">{s.paymentReferenceId}</Mono>
                  <div className="text-xs text-muted-foreground">
                    Biller {s.billerId} · Bill {s.billNumber}
                  </div>
                </div>
                <Pill t={s.status === "paid" ? "green" : "amber"}>{s.status}</Pill>
                <Money value={s.amount} className="font-medium" />
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>

      <CustomerFormDialog open={edit} onOpenChange={setEdit} customer={c} />
      <DepositDialog open={deposit} onOpenChange={setDeposit} customerId={c.customerId} />
      <PaymentLinkDialog open={link} onOpenChange={setLink} defaultCustomerId={c.customerId} />
      <ConfirmDialog
        open={toggle}
        onOpenChange={setToggle}
        title={active ? "Deactivate customer?" : "Restore customer?"}
        description={active ? "Soft-deletes the customer. Blocked while the VIBAN holds funds or payments are open." : "The customer becomes available for new payments again."}
        confirmLabel={active ? "Deactivate" : "Restore"}
        destructive={active}
        successMessage={active ? "Customer deactivated" : "Customer restored"}
        onConfirm={() => demo.patch(`customers/${c.customerId}`, { status: active ? "inactive" : "active" })}
      />
    </>
  );
}
