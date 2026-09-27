// Domain + wire types for the Dhamen Pay-In/Out API (Integration Guide v1.5).
// Request/response interfaces mirror the guide field-for-field; the stored
// entities add the extra state a real platform would keep internally.

export type Guid = string;
export type IsoDate = string;

// ---------- Wire: requests ----------

export interface CreateSupplierRequest {
  name: string;
  iban: string;
  identityNumber: string;
  payoutThresholdAmount?: number;
  email?: string;
  mobile?: string;
}

export interface UpdateSupplierRequest extends CreateSupplierRequest {
  supplierId: Guid;
}

export interface SupplierPaymentItem {
  supplierId: Guid;
  amount: number;
  customerId?: Guid;
}

export interface SupplierPaymentRequest {
  paymentReferenceId: string;
  supplierPayments: SupplierPaymentItem[];
}

export interface SupplierPaymentStatusRequest {
  supplierId: Guid;
  paymentReferenceId: string;
}

export interface DepositMoneyRequest {
  customerId: string;
  amount?: number;
  paymentIWalletNumber?: string;
}

export interface CreateCustomerRequest {
  identityNumber: string;
  name: string;
  iban?: string;
  email?: string;
  mobile?: string;
}

export type UpdateCustomerRequest = CreateCustomerRequest;

export interface CustomerPaymentItem {
  name: string;
  customerIdentifier: string;
  amount: number;
  supplierId?: Guid;
  isPreAuth?: boolean;
  enableBNPL?: boolean;
  mobile?: string;
  email?: string;
  enableRecurring?: boolean;
  returnUrl?: string;
}

export interface CustomerPaymentRequest {
  paymentReferenceId: string;
  customerPayments: CustomerPaymentItem[];
  paymentExpiredOnMinutes?: number;
}

export interface CustomerPaymentStatusRequest {
  paymentReferenceId: string;
  customerIdentifier?: string;
}

export interface CaptureRequest {
  paymentReferenceId: string;
  customerIdentifier: string;
  requestId?: string;
  amount?: number;
}

export interface ReverseRequest {
  paymentReferenceId: string;
  customerIdentifier: string;
}

export type RefundRequest = CaptureRequest;

export interface RefundIbanRequest {
  requestId?: string;
  paymentReferenceId: string;
  customerName: string;
  iban: string;
  amount?: number;
}

export interface CancelRequest {
  paymentReferenceId: string;
  customerIdentifier?: string;
}

export interface SubsequentPaymentRequest {
  paymentReferenceId: string;
  originalPaymentReferenceId: string;
  customerIdentifier: string;
  amount: number;
}

export interface SadadPaymentRequest {
  paymentReferenceId: string;
  name: string;
  customerIdentifier: string;
  amount: number;
  supplierId?: Guid;
  email?: string;
  mobile?: string;
}

// ---------- Wire: responses ----------

export interface MessageResponse {
  messageCode: number | string;
  messageDescription: string;
}

export interface ErrorResponse extends MessageResponse {
  errors?: Record<string, string[]>;
}

export interface CreateSupplierResponse {
  supplierId: Guid;
  name: string;
  iban: string;
  identityNumber: string;
}

export interface SupplierPaymentStatusResponse {
  supplierPaymentStatus: 0 | 1 | 2;
  transferredAmount: number;
  uti: string | null;
  supplierPayments: { paymentReferenceId: string; amount: number }[];
}

export interface SupplierBalanceResponse {
  supplierId: Guid;
  viban: string;
  availableBalance: number;
}

export interface CreateCustomerResponse {
  customerId: Guid;
  name: string;
  identityNumber: string;
  viban: string;
  bban: string;
}

export interface CustomerPaymentResponse {
  customerPayments: { customerIdentifier: string; paymentUrl: string; invoiceId: string }[];
}

export interface CustomerPaymentStatusItem {
  paymentReferenceId: string;
  customerIdentifier: string;
  amount: number;
  paymentStatus: 0 | 1;
  paymentBrand: PaymentBrand | null;
  paymentUrl: string;
  rrn: string | null;
  reconciliationStatus: 1 | 3 | null;
}

export interface CustomerPaymentStatusResponse {
  customerPayments: CustomerPaymentStatusItem[];
}

export interface CustomerBalanceResponse {
  customerId: string;
  viban: string;
  availableBalance: number;
}

export interface SubsequentPaymentResponse {
  customerIdentifier: string;
  invoiceId: string;
}

export interface SadadPaymentResponse {
  invoiceId: Guid;
  customerId: number;
  billerId: string;
  billNumber: string;
}

export interface AuthorityBalanceResponse {
  authorityProfileId: Guid;
  bban: string;
  availableBalance: number;
}

// ---------- Stored entities ----------

export type RecordStatus = "active" | "inactive";
export type PaymentBrand = "VISA" | "MADA" | "MASTER" | "TABBY" | "SADAD";

export interface Authority {
  authorityProfileId: Guid;
  name: string;
  accountId: string;
}

export type AccountType = "authority" | "customer" | "supplier";

export interface VirtualAccount {
  accountId: string;
  type: AccountType;
  ownerId: string;
  ownerName: string;
  viban: string;
  bban: string;
  balance: number;
  createdAt: IsoDate;
}

export interface Customer {
  customerId: Guid;
  identityNumber: string;
  name: string;
  iban?: string;
  email?: string;
  mobile?: string;
  viban: string;
  bban: string;
  accountId: string;
  status: RecordStatus;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface Supplier {
  supplierId: Guid;
  name: string;
  iban: string;
  identityNumber: string;
  payoutThresholdAmount?: number;
  email?: string;
  mobile?: string;
  viban: string;
  bban: string;
  accountId: string;
  isAuthorityFee?: boolean;
  status: RecordStatus;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export type InvoiceStatus = "unpaid" | "authorized" | "paid" | "captured" | "partially_captured" | "reversed" | "partially_refunded" | "refunded" | "cancelled" | "expired";

export interface InvoiceEvent {
  at: IsoDate;
  type: "created" | "attempt_failed" | "authorized" | "paid" | "captured" | "reversed" | "refunded" | "refunded_iban" | "cancelled" | "expired" | "settled" | "funds_to_supplier";
  message: string;
  amount?: number;
}

export interface MoneyMovement {
  requestId?: string;
  amount: number;
  at: IsoDate;
  iban?: string;
  beneficiaryName?: string;
}

export interface Invoice {
  invoiceId: string;
  paymentReferenceId: string;
  customerIdentifier: string;
  name: string;
  amount: number;
  supplierId?: Guid;
  isPreAuth: boolean;
  enableBNPL: boolean;
  enableRecurring: boolean;
  mobile?: string;
  email?: string;
  returnUrl?: string;
  expiresAt?: IsoDate;
  kind: "link" | "subsequent";
  originalPaymentReferenceId?: string;
  status: InvoiceStatus;
  paymentBrand?: PaymentBrand;
  cardLast4?: string;
  rrn?: string;
  reconciliationStatus?: 1 | 3;
  accountId: string; // collecting virtual account
  customerId?: Guid; // set when customerIdentifier matches a registered customer
  paidAt?: IsoDate;
  capturedAmount: number;
  refundedAmount: number;
  captures: MoneyMovement[];
  refunds: MoneyMovement[];
  failedAttempts: number;
  lastFailureReason?: string;
  events: InvoiceEvent[];
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface SadadInvoice {
  invoiceId: Guid;
  paymentReferenceId: string;
  name: string;
  customerIdentifier: string;
  amount: number;
  supplierId?: Guid;
  email?: string;
  mobile?: string;
  customerId: number;
  billerId: string;
  billNumber: string;
  status: "unpaid" | "paid" | "expired";
  accountId: string;
  paidAt?: IsoDate;
  createdAt: IsoDate;
}

export type SupplierLineStatus = 0 | 1 | 2; // Pending | Transferred | FailedTransfer

export interface SupplierPaymentLine {
  lineId: string;
  supplierId: Guid;
  amount: number;
  customerId?: Guid;
  fundingAccountId: string;
  funded: boolean;
  status: SupplierLineStatus;
  batchId?: string;
  insufficientNotified?: boolean;
  failureReason?: string;
}

export interface SupplierPaymentRecord {
  id: string;
  paymentReferenceId: string;
  source: "supplier-payment" | "customer-payment" | "sadad";
  lines: SupplierPaymentLine[];
  createdAt: IsoDate;
}

export interface PayoutBatch {
  batchId: string;
  supplierId: Guid;
  amount: number;
  iban: string;
  status: 1 | 2;
  uti?: string;
  transactionId: number;
  failureReason?: string;
  references: { paymentReferenceId: string; amount: number }[];
  trigger: "threshold" | "schedule" | "manual";
  createdAt: IsoDate;
}

export type LedgerType = "card_payment" | "capture" | "bank_deposit" | "sadad_payment" | "refund" | "refund_iban" | "transfer_in" | "transfer_out" | "payout";

export interface LedgerEntry {
  transactionId: number;
  accountId: string;
  direction: "credit" | "debit";
  type: LedgerType;
  amount: number;
  balanceAfter: number;
  reference?: string;
  counterparty?: string;
  description: string;
  status: 1 | 2;
  createdAt: IsoDate;
}

export type NotificationType =
  | "Deposit_Notification"
  | "Payment_Failed_Notification"
  | "Funds_Transferring_Notification"
  | "UTI_Notification"
  | "Failure_Transfer_Notification"
  | "Capture_Payment_Notification"
  | "Reverse_Payment_Notification"
  | "Refund_Payment_Notification"
  | "Insufficient_Balance_Notification"
  | "Payment_Settled_Notification";

export interface NotificationPayload {
  NotificationId: number;
  NotificationType: NotificationType;
  NotificationTime: IsoDate;
  Payment?: Record<string, unknown>;
  Supplier?: Record<string, unknown>;
  Transaction?: Record<string, unknown>;
}

export interface StoredNotification {
  id: number;
  payload: NotificationPayload;
  delivery: {
    status: "pending" | "delivered" | "failed" | "not_configured";
    attempts: number;
    lastAttemptAt?: IsoDate;
    responseCode?: number;
    responseBody?: string;
  };
  createdAt: IsoDate;
}

export interface ApiLog {
  id: string;
  method: string;
  path: string;
  status: number;
  messageCode?: string | number;
  durationMs: number;
  request?: unknown;
  response?: unknown;
  source: string;
  createdAt: IsoDate;
}

export interface Settings {
  merchantName: string;
  webhookUrl: string;
  payoutSchedule: "daily" | "weekly" | "manual";
  autoSettle: boolean;
  simulateLatency: boolean;
  defaultExpiryMinutes: number;
}

export interface DB {
  version: number;
  counters: { transaction: number; notification: number };
  authority: Authority;
  accounts: Record<string, VirtualAccount>;
  customers: Customer[];
  suppliers: Supplier[];
  invoices: Invoice[];
  sadadInvoices: SadadInvoice[];
  supplierPayments: SupplierPaymentRecord[];
  payoutBatches: PayoutBatch[];
  ledger: LedgerEntry[];
  notifications: StoredNotification[];
  apiLogs: ApiLog[];
  settings: Settings;
}

export interface Ctx {
  now: Date;
  origin: string;
}
