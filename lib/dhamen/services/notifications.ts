import { nextNotificationId } from "../generators";
import type { Ctx, DB, Invoice, LedgerEntry, NotificationType, Supplier } from "../types";

const MAX_NOTIFICATIONS = 600;

export function paymentObject(db: DB, inv: Invoice, extra: Record<string, unknown> = {}) {
  return {
    PaymentID: inv.paymentReferenceId,
    PaymentAmount: inv.amount,
    CustomerID: inv.customerId ?? inv.customerIdentifier,
    ...(inv.supplierId ? { SupplierID: inv.supplierId } : {}),
    PaymentBrand: inv.paymentBrand ?? null,
    ...(inv.rrn ? { RRN: inv.rrn } : {}),
    CustomerIdentityNumber: inv.customerIdentifier,
    ...extra,
  };
}

export function supplierObject(s: Supplier) {
  return {
    SupplierID: s.supplierId,
    SupplierName: s.name,
    SupplierIBAN: s.iban,
    ...(s.email ? { SupplierEmail: s.email } : {}),
    ...(s.mobile ? { SupplierMobile: s.mobile } : {}),
  };
}

/** TransactionType: 1 Deposit · 2 Transfer · 3 Refund (as seen in the guide samples). */
export function transactionObject(
  entry: Pick<LedgerEntry, "transactionId" | "amount" | "createdAt">,
  type: 1 | 2 | 3,
  extra: Record<string, unknown> = {},
  statusId: 1 | 2 | 3 = 1,
) {
  return {
    TransactionID: entry.transactionId,
    Amount: entry.amount,
    TransactionTime: entry.createdAt,
    TransactionStatusId: statusId,
    TransactionType: type,
    ...extra,
  };
}

export function notify(
  db: DB,
  ctx: Ctx,
  type: NotificationType,
  parts: { Payment?: Record<string, unknown>; Supplier?: Record<string, unknown>; Transaction?: Record<string, unknown> },
) {
  const id = nextNotificationId(db);
  db.notifications.push({
    id,
    payload: { NotificationId: id, NotificationType: type, NotificationTime: ctx.now.toISOString(), ...parts },
    delivery: { status: db.settings.webhookUrl ? "pending" : "not_configured", attempts: 0 },
    createdAt: ctx.now.toISOString(),
  });
  if (db.notifications.length > MAX_NOTIFICATIONS) db.notifications.splice(0, db.notifications.length - MAX_NOTIFICATIONS);
}
