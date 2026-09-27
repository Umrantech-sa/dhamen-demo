import type { CustomerView, InvoiceView, SupplierView, overview } from "@/lib/demo/views";
import type * as T from "@/lib/dhamen/types";

export type { CustomerView, InvoiceView, SupplierView };
export type Overview = ReturnType<typeof overview>;

export interface AccountRow extends T.VirtualAccount {
  held: number;
  status: string;
}

export interface PayoutLineRow extends T.SupplierPaymentLine {
  supplierName: string;
  fundingLabel: string;
  uti?: string;
}
export interface PayoutRecordRow extends Omit<T.SupplierPaymentRecord, "lines"> {
  total: number;
  lines: PayoutLineRow[];
}
export interface PayoutBatchRow extends T.PayoutBatch {
  supplierName: string;
}

export interface SadadRow extends T.SadadInvoice {
  supplierName?: string;
  isRegisteredCustomer: boolean;
}

export interface InvoiceDetail {
  invoice: InvoiceView;
  siblings: InvoiceView[];
  subsequent: InvoiceView[];
  customer?: T.Customer;
  supplier?: T.Supplier;
  account: T.VirtualAccount;
  ledger: T.LedgerEntry[];
  supplierLines: T.SupplierPaymentLine[];
  notifications: T.StoredNotification[];
  apiLogs: T.ApiLog[];
}

export interface CustomerDetail {
  customer: CustomerView;
  invoices: InvoiceView[];
  sadad: T.SadadInvoice[];
  ledger: T.LedgerEntry[];
  supplierPayments: T.SupplierPaymentRecord[];
}

export interface SupplierDetail {
  supplier: SupplierView;
  invoices: InvoiceView[];
  lines: (T.SupplierPaymentLine & { paymentReferenceId: string; source: string; createdAt: string })[];
  batches: T.PayoutBatch[];
  ledger: T.LedgerEntry[];
}
