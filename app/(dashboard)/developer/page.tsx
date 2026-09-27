"use client";

import { BookOpenIcon, KeyRoundIcon, PlayIcon, RotateCcwIcon } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { MethodTag, StatusTag } from "@/components/layout/api-inspector";
import { DataTable } from "@/components/app/data-table";
import { JsonView } from "@/components/app/json-view";
import { PageHeader } from "@/components/app/page-header";
import { SimpleSelect } from "@/components/app/simple-select";
import { rawCall, refreshAll } from "@/lib/client/api";
import { useDemo } from "@/lib/client/use-api";
import type { CustomerView, InvoiceView, SupplierView } from "@/lib/client/types";
import { DHAMEN_CONFIG } from "@/lib/dhamen/config";
import { ERROR_CATALOG } from "@/lib/dhamen/errors";
import type { ApiLog } from "@/lib/dhamen/types";
import { fmtDate, newRef } from "@/lib/format";
import { cn } from "@/lib/utils";

interface Ctx {
  customer?: CustomerView;
  supplier?: SupplierView;
  supplier2?: SupplierView;
  unpaid?: InvoiceView;
  authorized?: InvoiceView;
  paid?: InvoiceView;
  recurring?: InvoiceView;
}

interface Endpoint {
  key: string;
  name: string;
  method: "GET" | "POST" | "PUT";
  path: string;
  param?: string;
  description: string;
  body?: (c: Ctx) => unknown;
  paramValue?: (c: Ctx) => string;
}

const ENDPOINTS: Endpoint[] = [
  {
    key: "create-supplier",
    name: "Create Supplier",
    method: "POST",
    path: "create-supplier",
    description: "Add a new supplier with a valid IBAN and identity number; a VIBAN is created to collect funds before payout.",
    body: () => ({
      name: "Test Supplier Co.",
      iban: "SA2365236589745698745231",
      identityNumber: String(7100000000 + Math.floor(Math.random() * 99999999)),
      payoutThresholdAmount: 5000.0,
      email: "email@email.com",
      mobile: "966590222222",
    }),
  },
  {
    key: "update-supplier",
    name: "Update Supplier",
    method: "POST",
    path: "update-supplier",
    description: "Update an existing supplier's name, IBAN, identity number, threshold or contact.",
    body: (c) => ({
      supplierId: c.supplier?.supplierId,
      name: c.supplier?.name,
      iban: c.supplier?.iban,
      identityNumber: c.supplier?.identityNumber,
      payoutThresholdAmount: 5580.0,
      email: c.supplier?.email,
      mobile: c.supplier?.mobile,
    }),
  },
  {
    key: "supplier-payment",
    name: "Supplier Payment",
    method: "POST",
    path: "supplier-payment",
    description: "Pay suppliers from the authority VA, or from a customer VIBAN when customerId is provided. Multiple lines = split.",
    body: (c) => ({
      paymentReferenceID: newRef("SP"),
      supplierPayments: [
        { supplierId: c.supplier?.supplierId, amount: 50, customerId: c.customer?.customerId },
        { supplierId: c.supplier2?.supplierId, amount: 50 },
      ],
    }),
  },
  {
    key: "supplier-payment-status",
    name: "Supplier Payment Status",
    method: "POST",
    path: "supplier-payment-status",
    description: "Status of a payment made to a supplier: 0 Pending · 1 Transferred · 2 FailedTransfer.",
    body: (c) => ({ supplierId: c.supplier?.supplierId, paymentReferenceId: "SP-2026-0001" }),
  },
  {
    key: "supplier-balance",
    name: "Supplier Balance",
    method: "GET",
    path: "supplier-balance/{supplierId}",
    param: "supplierId",
    description: "Supplier's virtual account balance.",
    paramValue: (c) => c.supplier?.supplierId ?? "",
  },
  {
    key: "deposit-money",
    name: "Deposit Money",
    method: "POST",
    path: "deposit-money",
    description: "Test environment: simulate crediting a customer's virtual account.",
    body: (c) => ({ customerId: c.customer?.customerId, amount: 15, paymentIWalletNumber: DHAMEN_CONFIG.sandboxWalletNumber }),
  },
  {
    key: "create-customer",
    name: "Create Customer",
    method: "POST",
    path: "create-customer",
    description: "Add a customer (IBAN optional); a dedicated VIBAN is created to receive payments.",
    body: () => ({
      identityNumber: String(1100000000 + Math.floor(Math.random() * 99999999)),
      name: "Test Customer",
      iban: "SA2365236589745698745231",
      email: "email@email.com",
      mobile: "966590222222",
    }),
  },
  {
    key: "update-customer",
    name: "Update Customer",
    method: "POST",
    path: "update-customer",
    description: "Update name, IBAN, email or mobile. identityNumber is the key and can't change.",
    body: (c) => ({
      identityNumber: c.customer?.identityNumber,
      name: c.customer?.name,
      iban: c.customer?.iban ?? "SA2365236589745698745231",
      email: c.customer?.email,
      mobile: c.customer?.mobile,
    }),
  },
  {
    key: "customer-payment",
    name: "Customer Payment",
    method: "POST",
    path: "customer-payment",
    description: "Create payment page(s). Registered identityNumber → customer VIBAN; otherwise → authority VA.",
    body: (c) => ({
      paymentReferenceId: newRef("INV"),
      paymentExpiredOnMinutes: 60,
      customerPayments: [
        {
          name: c.customer?.name ?? "Test",
          customerIdentifier: c.customer?.identityNumber ?? "2485555551",
          amount: 11,
          supplierId: c.supplier?.supplierId,
          isPreAuth: false,
          enableRecurring: true,
          returnUrl: "https://www.google.com",
        },
      ],
    }),
  },
  {
    key: "customer-payment-status",
    name: "Customer Payment Status",
    method: "POST",
    path: "customer-payment-status",
    description: "paymentStatus 0 unpaid / 1 paid · reconciliationStatus 1 settled / 3 pending.",
    body: (c) => ({ paymentReferenceId: c.paid?.paymentReferenceId ?? "INV-2026-0012", customerIdentifier: c.paid?.customerIdentifier }),
  },
  {
    key: "customer-balance",
    name: "Customer Balance",
    method: "GET",
    path: "customer-balance/{customerId}",
    param: "customerId",
    description: "Customer's virtual account balance.",
    paramValue: (c) => c.customer?.customerId ?? "",
  },
  {
    key: "capture",
    name: "Capture Payment",
    method: "PUT",
    path: "capture",
    description: "Capture a pre-authorized payment (requestId required for partial capture).",
    body: (c) => ({
      paymentReferenceId: c.authorized?.paymentReferenceId ?? "INV-2026-0015",
      customerIdentifier: c.authorized?.customerIdentifier ?? "1065432198",
      requestId: newRef("CP"),
      amount: c.authorized ? Math.max(1, Math.floor(c.authorized.amount / 2)) : 50,
    }),
  },
  {
    key: "reverse",
    name: "Reverse Payment",
    method: "PUT",
    path: "reverse",
    description: "Release a pre-authorization hold on the customer's card.",
    body: (c) => ({ paymentReferenceId: c.authorized?.paymentReferenceId ?? "INV-2026-0015", customerIdentifier: c.authorized?.customerIdentifier ?? "1065432198" }),
  },
  {
    key: "refund",
    name: "Refund Payment",
    method: "PUT",
    path: "refund",
    description: "Refund (partial or full) a captured or directly debited payment.",
    body: (c) => ({ paymentReferenceId: c.paid?.paymentReferenceId, customerIdentifier: c.paid?.customerIdentifier, requestId: newRef("RF"), amount: 1 }),
  },
  {
    key: "refund-iban",
    name: "Refund to IBAN",
    method: "POST",
    path: "refund-iban",
    description: "Refund to the beneficiary's IBAN. Returns B001 when the balance is insufficient.",
    body: (c) => ({ requestId: newRef("RI"), paymentReferenceId: c.paid?.paymentReferenceId, customerName: c.paid?.name, iban: "SA9478000000001300051797", amount: 1 }),
  },
  {
    key: "cancel",
    name: "Cancel Payment Link",
    method: "PUT",
    path: "cancel",
    description: "Cancel an unpaid payment link. InvPay007 if it's already paid.",
    body: (c) => ({ paymentReferenceId: c.unpaid?.paymentReferenceId ?? "INV-2026-0017", customerIdentifier: c.unpaid?.customerIdentifier }),
  },
  {
    key: "customer-subsequent-payment",
    name: "Customer Subsequent Payment",
    method: "POST",
    path: "customer-subsequent-payment",
    description: "Charge the saved card of a previous recurring-enabled payment.",
    body: (c) => ({
      paymentReferenceId: newRef("SUB"),
      originalPaymentReferenceId: c.recurring?.paymentReferenceId ?? "SUB-2026-LAMA-01",
      customerIdentifier: c.recurring?.customerIdentifier ?? "1021987654",
      amount: 299,
    }),
  },
  {
    key: "customer-sadad-payment",
    name: "Customer SADAD Payment",
    method: "POST",
    path: "customer-sadad-payment",
    description: "Create a SADAD invoice (billerId + billNumber).",
    body: (c) => ({
      paymentReferenceId: newRef("SADAD"),
      name: c.customer?.name ?? "test name",
      customerIdentifier: c.customer?.identityNumber ?? "2485555551",
      supplierId: c.supplier?.supplierId,
      amount: 5,
      mobile: "966500000000",
      email: "test@gmail.com",
    }),
  },
  {
    key: "get-authority-balance",
    name: "Authority Balance",
    method: "GET",
    path: "get-authority-balance",
    param: "authorityProfileId",
    description: "Authority's virtual account balance (authorityProfileId passed on URL).",
    paramValue: () => DHAMEN_CONFIG.authorityProfileId,
  },
];

export default function DeveloperPage() {
  const { data: customers } = useDemo<CustomerView[]>("customers");
  const { data: suppliers } = useDemo<SupplierView[]>("suppliers");
  const { data: invoices } = useDemo<InvoiceView[]>("invoices");
  const { data: logs } = useDemo<ApiLog[]>("logs", { pollMs: 10000 });
  const [selected, setSelected] = useState(ENDPOINTS[0].key);
  const [logFilter, setLogFilter] = useState("all");

  const ep = ENDPOINTS.find((e) => e.key === selected)!;
  const ctx: Ctx = useMemo(() => {
    const active = (suppliers ?? []).filter((s) => s.status === "active" && !s.isAuthorityFee);
    return {
      customer: (customers ?? []).find((c) => c.status === "active"),
      supplier: active[0],
      supplier2: active[1],
      unpaid: (invoices ?? []).find((i) => i.status === "unpaid"),
      authorized: (invoices ?? []).find((i) => i.status === "authorized"),
      paid: (invoices ?? []).find((i) => ["paid", "captured", "partially_refunded"].includes(i.status) && i.collected > 1),
      recurring: (invoices ?? []).find((i) => i.enableRecurring && i.kind === "link" && ["paid", "captured"].includes(i.status)),
    };
  }, [customers, suppliers, invoices]);
  const ready = !!(customers && suppliers && invoices);

  return (
    <>
      <PageHeader
        title="API console"
        description="Call every endpoint from the Dhamen Integration Guide v1.5 against the sandbox, with live data pre-filled."
        actions={
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 text-xs">
            <KeyRoundIcon className="size-3.5 text-violet-600" />
            ClientId <span className="font-mono">{DHAMEN_CONFIG.clientId.slice(0, 8)}…</span>
          </div>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[260px_1fr]">
        <div className="grid content-start gap-0.5 rounded-xl border bg-card p-1.5">
          {ENDPOINTS.map((e) => (
            <button
              key={e.key}
              onClick={() => setSelected(e.key)}
              className={cn(
                "flex items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition hover:bg-muted",
                selected === e.key && "bg-violet-50 font-medium text-violet-900",
              )}
            >
              <span className="w-11 shrink-0">
                <MethodTag method={e.method} />
              </span>
              <span className="truncate">{e.name}</span>
            </button>
          ))}
        </div>

        <div className="grid min-w-0 content-start gap-4">
          {ready ? <Runner key={selected} ep={ep} ctx={ctx} ready={ready} /> : <Skeleton className="h-96 rounded-xl" />}

          <Tabs defaultValue="logs">
            <TabsList>
              <TabsTrigger value="logs">Request log</TabsTrigger>
              <TabsTrigger value="errors">
                <BookOpenIcon /> Error codes
              </TabsTrigger>
            </TabsList>
            <TabsContent value="logs" className="mt-2 grid gap-2">
              <SimpleSelect
                value={logFilter}
                onValueChange={setLogFilter}
                className="w-44"
                options={[
                  { value: "all", label: "All requests" },
                  { value: "errors", label: "Errors only" },
                  { value: "dashboard", label: "From dashboard" },
                  { value: "console", label: "From console" },
                  { value: "external", label: "External (cURL/Postman)" },
                ]}
              />
              <DataTable
                rows={(logs ?? []).filter((l) => logFilter === "all" || (logFilter === "errors" ? l.status !== 200 : l.source === logFilter))}
                rowKey={(l) => l.id}
                pageSize={8}
                columns={[
                  { key: "m", header: "Method", cell: (l) => <MethodTag method={l.method} /> },
                  { key: "p", header: "Path", cell: (l) => <span className="font-mono text-xs">{l.path.replace("/api/payments/", "")}</span> },
                  {
                    key: "s",
                    header: "Status",
                    cell: (l) => (
                      <span className="flex items-center gap-1.5">
                        <StatusTag status={l.status} />
                        <span className="font-mono text-[11px] text-muted-foreground">{l.status !== 200 ? l.messageCode : ""}</span>
                      </span>
                    ),
                  },
                  { key: "src", header: "Source", cell: (l) => <span className="text-xs text-muted-foreground">{l.source}</span>, className: "hidden md:table-cell" },
                  { key: "d", header: "Latency", align: "right", cell: (l) => <span className="text-xs tabular-nums">{l.durationMs} ms</span>, className: "hidden sm:table-cell" },
                  { key: "t", header: "Time", cell: (l) => <span className="text-xs whitespace-nowrap text-muted-foreground">{fmtDate(l.createdAt)}</span> },
                ]}
                emptyTitle="No API requests yet"
              />
            </TabsContent>
            <TabsContent value="errors" className="mt-2">
              <DataTable
                rows={ERROR_CATALOG}
                rowKey={(e) => e.code}
                pageSize={20}
                columns={[
                  { key: "c", header: "Code", cell: (e) => <span className="font-mono font-semibold">{e.code}</span> },
                  { key: "d", header: "Description", cell: (e) => e.description },
                  { key: "s", header: "Services", cell: (e) => <span className="text-xs text-muted-foreground">{e.services}</span> },
                ]}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </>
  );
}

function Runner({ ep, ctx, ready }: { ep: Endpoint; ctx: Ctx; ready: boolean }) {
  const sample = () => (ep.body ? JSON.stringify(ep.body(ctx), null, 2) : "");
  const [body, setBody] = useState(sample);
  const [param, setParam] = useState(() => ep.paramValue?.(ctx) ?? "");
  const [validCreds, setValidCreds] = useState(true);
  const [apiVersion, setApiVersion] = useState("2");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ status: number; data: unknown; durationMs: number }>();

  const reset = () => {
    setBody(sample());
    setParam(ep.paramValue?.(ctx) ?? "");
    setResult(undefined);
  };

  const url =
    ep.method === "GET" && ep.param
      ? ep.path.includes("{")
        ? `/api/payments/${ep.path.replace(`{${ep.param}}`, param)}`
        : `/api/payments/${ep.path}?${ep.param}=${param}`
      : `/api/payments/${ep.path}`;
  const headers = {
    "Content-Type": "application/json",
    "App-key": validCreds ? DHAMEN_CONFIG.appKey : "00000000-0000-0000-0000-000000000000",
    "App-id": DHAMEN_CONFIG.appId,
    ClientId: DHAMEN_CONFIG.clientId,
    "api-version": apiVersion,
  };

  async function send() {
    setSending(true);
    try {
      let parsed: unknown = undefined;
      if (ep.method !== "GET") {
        try {
          parsed = body ? JSON.parse(body) : {};
        } catch {
          setResult({ status: 0, data: { error: "Body is not valid JSON" }, durationMs: 0 });
          return;
        }
      }
      const res = await rawCall(ep.method, url, parsed, { ...headers, "x-demo-source": "console" });
      setResult(res);
      if (res.status === 200 && ep.method !== "GET") refreshAll();
    } finally {
      setSending(false);
    }
  }

  const curl = `curl -X ${ep.method} "$DHAMEN_BASE_URL${url}" \\\n${Object.entries(headers)
    .map(([k, v]) => `  -H '${k}: ${k === "App-key" || k === "App-id" || k === "ClientId" ? "<" + k + ">" : v}'`)
    .join(" \\\n")}${ep.method !== "GET" ? ` \\\n  -d '${body.replace(/\s+/g, " ")}'` : ""}`;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2">
          <MethodTag method={ep.method} />
          <span className="font-mono text-sm">{url}</span>
        </CardTitle>
        <CardDescription>{ep.description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <div className="flex flex-wrap items-center gap-4 rounded-lg border bg-muted/30 p-3 text-xs">
          <span className="flex items-center gap-2">
            <Switch checked={validCreds} onCheckedChange={(v) => setValidCreds(v)} size="sm" />
            Valid App-key (off → 401)
          </span>
          <label className="flex items-center gap-2">
            api-version
            <Input value={apiVersion} onChange={(e) => setApiVersion(e.target.value)} className="h-7 w-14 bg-card font-mono text-xs" />
          </label>
          <span className="text-muted-foreground">Headers per Appendix A: Content type, App-key, App-id, ClientId, api-version</span>
        </div>
        {ep.param && (
          <label className="grid gap-1.5 text-xs font-medium">
            {ep.param} <span className="font-normal text-muted-foreground">(passed on URL)</span>
            <Input value={param} onChange={(e) => setParam(e.target.value)} className="font-mono" />
          </label>
        )}
        {ep.method !== "GET" && (
          <div className="grid gap-1.5">
            <div className="text-xs font-medium">Request body</div>
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} className="min-h-56 bg-zinc-950 font-mono text-xs text-zinc-100" spellCheck={false} />
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <Button onClick={send} disabled={sending || !ready}>
            <PlayIcon /> {sending ? "Sending…" : "Send request"}
          </Button>
          <Button variant="outline" onClick={reset}>
            <RotateCcwIcon /> Reset sample
          </Button>
        </div>
        {result && (
          <div className="grid gap-1.5">
            <div className="flex items-center gap-2 text-xs">
              Response <StatusTag status={result.status} /> <span className="text-muted-foreground">{result.durationMs} ms</span>
            </div>
            <JsonView value={result.data} />
          </div>
        )}
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground">cURL</summary>
          <pre className="mt-2 overflow-x-auto rounded-lg bg-zinc-950 p-3 font-mono text-[11px] text-zinc-200">{curl}</pre>
        </details>
      </CardContent>
    </Card>
  );
}
