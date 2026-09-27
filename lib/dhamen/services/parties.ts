// Customers & suppliers: create/update, balances, deposits and soft-delete.
import { DHAMEN_CONFIG } from "../config";
import { DhamenError, Errors } from "../errors";
import { guid, r2 } from "../generators";
import type {
  CreateCustomerRequest,
  CreateCustomerResponse,
  CreateSupplierRequest,
  CreateSupplierResponse,
  Ctx,
  Customer,
  DB,
  DepositMoneyRequest,
  Supplier,
  UpdateSupplierRequest,
} from "../types";
import { balanceOf, openAccount, post } from "./accounts";
import { notify, transactionObject } from "./notifications";
import { AUTHORITY_ACCOUNT_ID } from "./accounts";

const OPEN_INVOICE = new Set(["unpaid", "authorized"]);

export function findCustomer(db: DB, idOrIdentity: string): Customer | undefined {
  const key = idOrIdentity.trim().toLowerCase();
  return db.customers.find((c) => c.customerId.toLowerCase() === key || c.identityNumber === key);
}

export function findSupplier(db: DB, supplierId: string): Supplier | undefined {
  const key = supplierId.trim().toLowerCase();
  return db.suppliers.find((s) => s.supplierId.toLowerCase() === key);
}

// ---------- Customers ----------

export function createCustomer(db: DB, ctx: Ctx, req: CreateCustomerRequest): CreateCustomerResponse {
  if (db.customers.some((c) => c.identityNumber === req.identityNumber)) throw Errors.customerExists(req.identityNumber);
  const customerId = guid();
  const account = openAccount(db, ctx, "customer", customerId, req.name);
  const now = ctx.now.toISOString();
  const customer: Customer = {
    customerId,
    identityNumber: req.identityNumber,
    name: req.name,
    iban: req.iban,
    email: req.email,
    mobile: req.mobile,
    viban: account.viban,
    bban: account.bban,
    accountId: account.accountId,
    status: "active",
    createdAt: now,
    updatedAt: now,
  };
  db.customers.push(customer);
  return { customerId, name: customer.name, identityNumber: customer.identityNumber, viban: customer.viban, bban: customer.bban };
}

export function updateCustomer(db: DB, ctx: Ctx, req: CreateCustomerRequest) {
  const customer = db.customers.find((c) => c.identityNumber === req.identityNumber);
  if (!customer) throw Errors.customerNotExists();
  customer.name = req.name;
  customer.iban = req.iban;
  customer.email = req.email;
  customer.mobile = req.mobile;
  customer.updatedAt = ctx.now.toISOString();
  db.accounts[customer.accountId].ownerName = req.name;
}

export function customerBalance(db: DB, customerId: string) {
  const customer = findCustomer(db, customerId);
  if (!customer) throw Errors.customerNotExists();
  return { customerId: customer.customerId, viban: customer.viban, availableBalance: balanceOf(db, customer.accountId) };
}

export function depositMoney(db: DB, ctx: Ctx, req: DepositMoneyRequest) {
  const customer = findCustomer(db, req.customerId);
  if (!customer) throw Errors.customerNotExists();
  const amount = r2(req.amount ?? 100);
  const wallet = req.paymentIWalletNumber ?? DHAMEN_CONFIG.sandboxWalletNumber;
  const entry = post(db, ctx, {
    accountId: customer.accountId,
    direction: "credit",
    type: "bank_deposit",
    amount,
    counterparty: `Wallet ${wallet}`,
    description: `Bank transfer to VIBAN ${customer.viban}`,
  });
  notify(db, ctx, "Deposit_Notification", {
    Payment: {
      PaymentID: `DEP-${entry.transactionId}`,
      PaymentAmount: amount,
      CustomerID: customer.customerId,
      PaymentBrand: null,
      CustomerIdentityNumber: customer.identityNumber,
    },
    Transaction: transactionObject(entry, 1),
  });
}

// ---------- Suppliers ----------

export function createSupplier(db: DB, ctx: Ctx, req: CreateSupplierRequest, opts: { isAuthorityFee?: boolean } = {}): CreateSupplierResponse {
  if (db.suppliers.some((s) => s.identityNumber === req.identityNumber)) throw Errors.supplierExists(req.identityNumber);
  const supplierId = guid();
  const account = openAccount(db, ctx, "supplier", supplierId, req.name);
  const now = ctx.now.toISOString();
  db.suppliers.push({
    supplierId,
    name: req.name,
    iban: req.iban,
    identityNumber: req.identityNumber,
    payoutThresholdAmount: req.payoutThresholdAmount,
    email: req.email,
    mobile: req.mobile,
    viban: account.viban,
    bban: account.bban,
    accountId: account.accountId,
    isAuthorityFee: opts.isAuthorityFee,
    status: "active",
    createdAt: now,
    updatedAt: now,
  });
  return { supplierId, name: req.name, iban: req.iban, identityNumber: req.identityNumber };
}

export function updateSupplier(db: DB, ctx: Ctx, req: UpdateSupplierRequest) {
  const supplier = findSupplier(db, req.supplierId);
  if (!supplier) throw Errors.supplierNotExists();
  if (db.suppliers.some((s) => s !== supplier && s.identityNumber === req.identityNumber)) throw Errors.supplierExists(req.identityNumber);
  Object.assign(supplier, {
    name: req.name,
    iban: req.iban,
    identityNumber: req.identityNumber,
    payoutThresholdAmount: req.payoutThresholdAmount,
    email: req.email,
    mobile: req.mobile,
    updatedAt: ctx.now.toISOString(),
  });
  db.accounts[supplier.accountId].ownerName = req.name;
}

export function supplierBalance(db: DB, supplierId: string) {
  const supplier = findSupplier(db, supplierId);
  if (!supplier) throw Errors.supplierNotExists();
  return { supplierId: supplier.supplierId, viban: supplier.viban, availableBalance: balanceOf(db, supplier.accountId) };
}

export function authorityBalance(db: DB) {
  const account = db.accounts[AUTHORITY_ACCOUNT_ID];
  return { authorityProfileId: db.authority.authorityProfileId, bban: account.viban, availableBalance: account.balance };
}

// ---------- Demo-only: soft delete ----------

export function setCustomerStatus(db: DB, ctx: Ctx, customerId: string, status: "active" | "inactive") {
  const customer = findCustomer(db, customerId);
  if (!customer) throw Errors.customerNotExists();
  if (status === "inactive") {
    if (balanceOf(db, customer.accountId) > 0) throw new DhamenError("DEMO01", "Customer VIBAN still holds funds. Refund or pay out the balance before deactivating.");
    if (db.invoices.some((i) => i.customerId === customer.customerId && OPEN_INVOICE.has(i.status)))
      throw new DhamenError("DEMO02", "Customer has open payment links or pre-authorizations. Cancel or settle them first.");
  }
  customer.status = status;
  customer.updatedAt = ctx.now.toISOString();
}

export function setSupplierStatus(db: DB, ctx: Ctx, supplierId: string, status: "active" | "inactive") {
  const supplier = findSupplier(db, supplierId);
  if (!supplier) throw Errors.supplierNotExists();
  if (status === "inactive") {
    if (balanceOf(db, supplier.accountId) > 0) throw new DhamenError("DEMO01", "Supplier VIBAN still holds funds awaiting payout. Run a payout cycle first.");
    if (db.supplierPayments.some((r) => r.lines.some((l) => l.supplierId === supplier.supplierId && l.status !== 1)))
      throw new DhamenError("DEMO02", "Supplier has pending payouts. Resolve them before deactivating.");
  }
  supplier.status = status;
  supplier.updatedAt = ctx.now.toISOString();
}
