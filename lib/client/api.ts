// Browser-side client for the Dhamen API (mock or real, via NEXT_PUBLIC_DHAMEN_BASE_URL)
// plus the sandbox helper endpoints. Every Dhamen call is recorded for the API inspector.
import { DHAMEN_CONFIG } from "@/lib/dhamen/config";
import type * as T from "@/lib/dhamen/types";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
  }
  get title() {
    return `${this.code} · ${this.message}`;
  }
}

export interface CallRecord {
  id: number;
  method: string;
  path: string;
  status: number;
  durationMs: number;
  request?: unknown;
  response?: unknown;
  at: string;
}

let seq = 0;
let calls: CallRecord[] = [];
const callListeners = new Set<() => void>();
export const getCalls = () => calls;
export function subscribeCalls(fn: () => void) {
  callListeners.add(fn);
  return () => callListeners.delete(fn);
}

const refreshBus = typeof window !== "undefined" ? new EventTarget() : null;
export const refreshAll = () => refreshBus?.dispatchEvent(new Event("refresh"));
export function onRefresh(fn: () => void) {
  refreshBus?.addEventListener("refresh", fn);
  return () => refreshBus?.removeEventListener("refresh", fn);
}

const dhamenHeaders = {
  "Content-Type": "application/json",
  "App-key": DHAMEN_CONFIG.appKey,
  "App-id": DHAMEN_CONFIG.appId,
  ClientId: DHAMEN_CONFIG.clientId,
  "api-version": DHAMEN_CONFIG.apiVersion,
};

export async function rawCall(method: string, url: string, body?: unknown, headers: Record<string, string> = {}) {
  const started = performance.now();
  const res = await fetch(url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const text = await res.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {}
  return { status: res.status, data, durationMs: Math.round(performance.now() - started) };
}

async function dhamenCall<R>(method: string, path: string, body?: unknown): Promise<R> {
  const { status, data, durationMs } = await rawCall(method, `${DHAMEN_CONFIG.baseUrl}/api/payments/${path}`, body, { ...dhamenHeaders, "x-demo-source": "dashboard" });
  calls = [{ id: ++seq, method, path: `/api/payments/${path}`, status, durationMs, request: body, response: data, at: new Date().toISOString() }, ...calls].slice(0, 50);
  callListeners.forEach((l) => l());
  const d = data as { messageCode?: string | number; messageDescription?: string; errors?: Record<string, string[]> } | null;
  if (status !== 200) throw new ApiError(String(d?.messageCode ?? status), d?.messageDescription ?? "Request failed", status, d?.errors);
  if (method !== "GET" && !path.endsWith("-status")) refreshAll();
  return data as R;
}

export const dhamen = {
  createSupplier: (b: T.CreateSupplierRequest) => dhamenCall<T.CreateSupplierResponse>("POST", "create-supplier", b),
  updateSupplier: (b: T.UpdateSupplierRequest) => dhamenCall<T.MessageResponse>("POST", "update-supplier", b),
  supplierPayment: (b: T.SupplierPaymentRequest) => dhamenCall<T.MessageResponse>("POST", "supplier-payment", b),
  supplierPaymentStatus: (b: T.SupplierPaymentStatusRequest) => dhamenCall<T.SupplierPaymentStatusResponse>("POST", "supplier-payment-status", b),
  supplierBalance: (id: string) => dhamenCall<T.SupplierBalanceResponse>("GET", `supplier-balance/${id}`),
  depositMoney: (b: T.DepositMoneyRequest) => dhamenCall<T.MessageResponse>("POST", "deposit-money", b),
  createCustomer: (b: T.CreateCustomerRequest) => dhamenCall<T.CreateCustomerResponse>("POST", "create-customer", b),
  updateCustomer: (b: T.UpdateCustomerRequest) => dhamenCall<T.MessageResponse>("POST", "update-customer", b),
  customerPayment: (b: T.CustomerPaymentRequest) => dhamenCall<T.CustomerPaymentResponse>("POST", "customer-payment", b),
  customerPaymentStatus: (b: T.CustomerPaymentStatusRequest) => dhamenCall<T.CustomerPaymentStatusResponse>("POST", "customer-payment-status", b),
  customerBalance: (id: string) => dhamenCall<T.CustomerBalanceResponse>("GET", `customer-balance/${id}`),
  capture: (b: T.CaptureRequest) => dhamenCall<T.MessageResponse>("PUT", "capture", b),
  reverse: (b: T.ReverseRequest) => dhamenCall<T.MessageResponse>("PUT", "reverse", b),
  refund: (b: T.RefundRequest) => dhamenCall<T.MessageResponse>("PUT", "refund", b),
  refundIban: (b: T.RefundIbanRequest) => dhamenCall<T.MessageResponse>("POST", "refund-iban", b),
  cancel: (b: T.CancelRequest) => dhamenCall<T.MessageResponse>("PUT", "cancel", b),
  subsequentPayment: (b: T.SubsequentPaymentRequest) => dhamenCall<T.SubsequentPaymentResponse>("POST", "customer-subsequent-payment", b),
  sadadPayment: (b: T.SadadPaymentRequest) => dhamenCall<T.SadadPaymentResponse>("POST", "customer-sadad-payment", b),
  authorityBalance: () => dhamenCall<T.AuthorityBalanceResponse>("GET", `get-authority-balance?authorityProfileId=${DHAMEN_CONFIG.authorityProfileId}`),
};

async function demoCall<R>(method: string, path: string, body?: unknown): Promise<R> {
  const { status, data } = await rawCall(method, `/api/demo/${path}`, body, { "Content-Type": "application/json" });
  const d = data as { messageCode?: string | number; messageDescription?: string; errors?: Record<string, string[]> } | null;
  if (status !== 200) throw new ApiError(String(d?.messageCode ?? status), d?.messageDescription ?? "Request failed", status, d?.errors);
  if (method !== "GET") refreshAll();
  return data as R;
}

export const demo = {
  get: <R>(path: string) => demoCall<R>("GET", path),
  post: <R>(path: string, body?: unknown) => demoCall<R>("POST", path, body ?? {}),
  put: <R>(path: string, body?: unknown) => demoCall<R>("PUT", path, body ?? {}),
  patch: <R>(path: string, body?: unknown) => demoCall<R>("PATCH", path, body ?? {}),
};

export function errorMessage(err: unknown) {
  if (err instanceof ApiError) return err.title;
  return err instanceof Error ? err.message : String(err);
}
