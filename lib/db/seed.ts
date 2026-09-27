// Builds a realistic sandbox history by replaying API operations through the
// same services the endpoints use, so balances, ledger and notifications stay consistent.
import { DHAMEN_CONFIG } from "@/lib/dhamen/config";
import { makeIban } from "@/lib/dhamen/generators";
import { AUTHORITY_ACCOUNT_ID, openAccount, post } from "@/lib/dhamen/services/accounts";
import { createCustomer, createSupplier, depositMoney } from "@/lib/dhamen/services/parties";
import {
  cancel,
  capture,
  checkoutPay,
  createCustomerPayment,
  createSadadPayment,
  paySadad,
  refund,
  reverse,
  settleInvoice,
  subsequentPayment,
} from "@/lib/dhamen/services/payments";
import { createSupplierPayment, runPayouts } from "@/lib/dhamen/services/payouts";
import type { Ctx, CustomerPaymentItem, DB } from "@/lib/dhamen/types";

export const WEBHOOK_RECEIVER_PATH = "/api/demo/webhook-receiver";

export function emptyDb(): DB {
  return {
    version: 1,
    counters: { transaction: 885507200, notification: 102500 },
    authority: { authorityProfileId: DHAMEN_CONFIG.authorityProfileId, name: "Umran Tech Marketplace", accountId: AUTHORITY_ACCOUNT_ID },
    accounts: {},
    customers: [],
    suppliers: [],
    invoices: [],
    sadadInvoices: [],
    supplierPayments: [],
    payoutBatches: [],
    ledger: [],
    notifications: [],
    apiLogs: [],
    settings: {
      merchantName: "Umran Tech Marketplace",
      webhookUrl: WEBHOOK_RECEIVER_PATH,
      payoutSchedule: "daily",
      autoSettle: false,
      simulateLatency: true,
      defaultExpiryMinutes: 4320,
    },
  };
}

const acct = () => String(Math.floor(Math.random() * 1e15)).padStart(18, "0");

const CUSTOMERS = [
  { name: "Abdullah Al-Qahtani", identityNumber: "1087654321", mobile: "966501234567", email: "abdullah.q@example.sa", iban: true },
  { name: "Sara Al-Otaibi", identityNumber: "1092837465", mobile: "966552345678", email: "sara.otaibi@example.sa", iban: true },
  { name: "Mohammed Al-Harbi", identityNumber: "1076543210", mobile: "966533456789", email: "m.harbi@example.sa", iban: false },
  { name: "Noura Al-Shehri", identityNumber: "1065432198", mobile: "966544567890", email: "noura.s@example.sa", iban: true },
  { name: "Faisal Al-Dosari", identityNumber: "1054321987", mobile: "966505678901", email: "faisal.d@example.sa", iban: true },
  { name: "Reem Al-Zahrani", identityNumber: "1043219876", mobile: "966566789012", email: "reem.z@example.sa", iban: false },
  { name: "Khalid Al-Mutairi", identityNumber: "1032198765", mobile: "966507890123", email: "khalid.m@example.sa", iban: true },
  { name: "Lama Al-Ghamdi", identityNumber: "1021987654", mobile: "966558901234", email: "lama.g@example.sa", iban: true },
  { name: "Turki Al-Anazi", identityNumber: "2410987654", mobile: "966509012345", email: "turki.a@example.sa", iban: false },
  { name: "Hessa Al-Subaie", identityNumber: "1019876543", mobile: "966550123456", email: "hessa.s@example.sa", iban: true },
  { name: "Omar Al-Juhani", identityNumber: "2398765432", mobile: "966541122334", email: "omar.j@example.sa", iban: false },
  { name: "Fatimah Al-Malki", identityNumber: "1008765432", mobile: "966532233445", email: "fatimah.m@example.sa", iban: true },
];

const SUPPLIERS = [
  { key: "waha", name: "Al-Waha Contracting Est.", identityNumber: "7001234561", bank: "80", threshold: 5000, email: "finance@alwaha.example.sa", mobile: "966112345601" },
  { key: "rawabi", name: "Rawabi Interior Design", identityNumber: "7002345672", bank: "10", threshold: undefined, email: "accounts@rawabi.example.sa", mobile: "966112345602" },
  { key: "sahm", name: "Sahm Tech Solutions", identityNumber: "7003456783", bank: "45", threshold: 1500, email: "billing@sahm.example.sa", mobile: "966112345603" },
  { key: "najd", name: "Najd Logistics Co.", identityNumber: "7004567894", bank: "20", threshold: 10000, email: "ap@najdlogistics.example.sa", mobile: "966112345604" },
  { key: "qimam", name: "Qimam Catering Services", identityNumber: "7005678905", bank: "05", threshold: undefined, email: "finance@qimam.example.sa", mobile: "966112345605" },
  { key: "tamkeen", name: "Tamkeen Maintenance Co.", identityNumber: "7006789016", bank: "80", threshold: 2000, email: "pay@tamkeen.example.sa", mobile: "966112345606" },
  { key: "masar", name: "Masar Car Rental", identityNumber: "7007890127", bank: "", threshold: undefined, email: "finance@masar.example.sa", mobile: "966112345607" },
  { key: "fees", name: "Umran Tech – Platform Fees", identityNumber: "7008901238", bank: "80", threshold: undefined, email: "finance@umrantech.sa", mobile: "966112345608" },
] as const;

export function buildSeed(): DB {
  const db = emptyDb();
  const real = Date.now();
  const ctx: Ctx = { now: new Date(real), origin: "" };
  const at = (daysAgo: number, hour = 10, minute = 0) => {
    const d = new Date(real - daysAgo * 86400000);
    d.setHours(hour, minute, Math.floor(Math.random() * 59), 0);
    ctx.now = d.getTime() > real ? new Date(real - 60000) : d;
    return ctx;
  };
  const ago = (minutes: number) => {
    ctx.now = new Date(real - minutes * 60000);
    return ctx;
  };

  // Authority escrow account + opening float.
  at(35, 9);
  openAccount(db, ctx, "authority", db.authority.authorityProfileId, db.authority.name, { viban: "SA8345000000500796552157", bban: "500796552157" });
  post(db, ctx, {
    accountId: AUTHORITY_ACCOUNT_ID,
    direction: "credit",
    type: "bank_deposit",
    amount: 25000,
    counterparty: "Umran Tech operating account",
    description: "Authority float top-up",
  });

  // Suppliers
  const sup: Record<string, string> = {};
  SUPPLIERS.forEach((s, i) => {
    at(34 - i, 11, i * 5);
    const iban = s.key === "masar" ? "SA6710000000000000000000" : makeIban(s.bank, acct());
    sup[s.key] = createSupplier(
      db,
      ctx,
      { name: s.name, iban, identityNumber: s.identityNumber, payoutThresholdAmount: s.threshold, email: s.email, mobile: s.mobile },
      { isAuthorityFee: s.key === "fees" },
    ).supplierId;
  });

  // Customers
  const cus: Record<string, { id: string; identity: string; name: string; mobile: string; email: string }> = {};
  CUSTOMERS.forEach((c, i) => {
    at(30 - i * 2, 9 + (i % 8), i * 3);
    const res = createCustomer(db, ctx, {
      name: c.name,
      identityNumber: c.identityNumber,
      mobile: c.mobile,
      email: c.email,
      iban: c.iban ? makeIban(["80", "10", "45", "05"][i % 4], acct()) : undefined,
    });
    cus[c.name.split(" ")[0].toLowerCase()] = { id: res.customerId, identity: c.identityNumber, name: c.name, mobile: c.mobile, email: c.email };
  });

  type LinkItem = Partial<CustomerPaymentItem> & { customer?: string };
  const link = (ref: string, items: LinkItem[], minutes?: number) => {
    const payload = items.map(({ customer, ...rest }) => {
      const c = customer ? cus[customer] : undefined;
      return {
        returnUrl: "https://umrantech.sa/orders/complete",
        ...rest,
        name: c?.name ?? rest.name!,
        customerIdentifier: c?.identity ?? rest.customerIdentifier!,
        amount: rest.amount!,
      };
    });
    return createCustomerPayment(db, ctx, { paymentReferenceId: ref, customerPayments: payload, paymentExpiredOnMinutes: minutes }).customerPayments;
  };
  const inv = (ref: string, identity?: string) => db.invoices.find((i) => i.paymentReferenceId === ref && (!identity || i.customerIdentifier === identity))!;
  const pay = (ref: string, card: string, identity?: string) =>
    checkoutPay(db, ctx, inv(ref, identity).invoiceId, { method: card === "tabby" ? "tabby" : "card", cardNumber: card });

  const VISA = "4111111111111111";
  const MADA = "4464040000000007";
  const MASTER = "5123450000000008";
  const DECLINED = "4000000000000002";

  // 1. Direct payment with supplier (below Al-Waha threshold → stays in supplier VIBAN)
  at(25, 10);
  link("INV-2026-0001", [{ customer: "abdullah", amount: 1250, supplierId: sup.waha }]);
  at(25, 10, 12);
  pay("INV-2026-0001", MADA);
  at(24, 8);
  settleInvoice(db, ctx, inv("INV-2026-0001"));

  // 2. Pre-auth, captured in full
  at(22, 15);
  link("INV-2026-0002", [{ customer: "sara", amount: 3400, supplierId: sup.rawabi, isPreAuth: true }]);
  at(22, 15, 20);
  pay("INV-2026-0002", VISA);
  at(21, 11);
  capture(db, ctx, { paymentReferenceId: "INV-2026-0002", customerIdentifier: cus.sara.identity });
  at(20, 8);
  settleInvoice(db, ctx, inv("INV-2026-0002"));

  // Deposits into customer VIBANs (bank transfers)
  at(20, 12);
  depositMoney(db, ctx, { customerId: cus.abdullah.id, amount: 5000, paymentIWalletNumber: DHAMEN_CONFIG.sandboxWalletNumber });

  // Split payout from Abdullah's VIBAN
  at(19, 14);
  createSupplierPayment(db, ctx, {
    paymentReferenceId: "SP-2026-0001",
    supplierPayments: [
      { supplierId: sup.waha, amount: 3000, customerId: cus.abdullah.id },
      { supplierId: sup.tamkeen, amount: 1500, customerId: cus.abdullah.id },
      { supplierId: sup.fees, amount: 250, customerId: cus.abdullah.id },
    ],
  });

  // 3. Pre-auth reversed
  at(18, 16);
  link("INV-2026-0003", [{ customer: "mohammed", amount: 780, isPreAuth: true }]);
  at(18, 16, 4);
  pay("INV-2026-0003", MADA);
  at(17, 10);
  reverse(db, ctx, { paymentReferenceId: "INV-2026-0003", customerIdentifier: cus.mohammed.identity });

  at(17, 23, 30);
  runPayouts(db, ctx, "schedule");

  // Recurring subscription (original)
  at(16, 13);
  link("SUB-2026-LAMA-01", [{ customer: "lama", amount: 299, enableRecurring: true }]);
  at(16, 13, 6);
  pay("SUB-2026-LAMA-01", MASTER);
  at(15, 9);
  settleInvoice(db, ctx, inv("SUB-2026-LAMA-01"));

  // 4. Direct payment, partial refund
  at(15, 11);
  link("INV-2026-0004", [{ customer: "noura", amount: 2150 }]);
  at(15, 11, 9);
  pay("INV-2026-0004", DECLINED);
  at(15, 11, 14);
  pay("INV-2026-0004", MASTER);
  at(14, 9);
  settleInvoice(db, ctx, inv("INV-2026-0004"));
  at(14, 15);
  refund(db, ctx, { paymentReferenceId: "INV-2026-0004", customerIdentifier: cus.noura.identity, requestId: "RF-0004-01", amount: 350 });

  at(13, 10);
  depositMoney(db, ctx, { customerId: cus.faisal.id, amount: 2500 });

  // 5. Full refund
  at(12, 17);
  link("INV-2026-0005", [{ customer: "faisal", amount: 499 }]);
  at(12, 17, 3);
  pay("INV-2026-0005", VISA);
  at(11, 10);
  refund(db, ctx, { paymentReferenceId: "INV-2026-0005", customerIdentifier: cus.faisal.identity });

  // 6. BNPL (Tabby) with supplier over threshold → auto payout on settlement
  at(10, 19);
  link("INV-2026-0006", [{ customer: "reem", amount: 1999, supplierId: sup.sahm, enableBNPL: true, mobile: cus.reem.mobile, email: cus.reem.email }]);
  at(10, 19, 7);
  pay("INV-2026-0006", "tabby");

  // Split payout from authority VA, and one without enough balance
  at(9, 10);
  createSupplierPayment(db, ctx, { paymentReferenceId: "SP-2026-0002", supplierPayments: [{ supplierId: sup.najd, amount: 1200 }] });
  at(9, 11);
  settleInvoice(db, ctx, inv("INV-2026-0006"));

  // 7. Pre-auth partially captured
  at(8, 12);
  link("INV-2026-0007", [{ customer: "khalid", amount: 5600, supplierId: sup.najd, isPreAuth: true }]);
  at(8, 12, 15);
  pay("INV-2026-0007", VISA);
  at(8, 18);
  capture(db, ctx, { paymentReferenceId: "INV-2026-0007", customerIdentifier: cus.khalid.identity, requestId: "CP-0007-01", amount: 5000 });
  at(7, 8);
  settleInvoice(db, ctx, inv("INV-2026-0007"));

  // 10. Cancelled link
  at(7, 12);
  link("INV-2026-0010", [{ customer: "hessa", amount: 1100 }]);
  at(6, 9);
  cancel(db, ctx, { paymentReferenceId: "INV-2026-0010", customerIdentifier: cus.hessa.identity });

  // 14. Supplier with rejected IBAN → failed transfer
  at(6, 13);
  link("INV-2026-0014", [{ customer: "mohammed", amount: 950, supplierId: sup.masar }]);
  at(6, 13, 11);
  pay("INV-2026-0014", MADA);
  at(5, 8);
  settleInvoice(db, ctx, inv("INV-2026-0014"));

  at(5, 10);
  createSupplierPayment(db, ctx, { paymentReferenceId: "SP-2026-0003", supplierPayments: [{ supplierId: sup.rawabi, amount: 4000, customerId: cus.faisal.id }] });

  // 11. Expired link
  at(5, 14);
  link("INV-2026-0011", [{ customer: "omar", amount: 650 }], 60);

  at(4, 23, 30);
  runPayouts(db, ctx, "schedule");

  // SADAD bills
  at(4, 9);
  createSadadPayment(db, ctx, {
    paymentReferenceId: "SADAD-2026-0001",
    name: cus.khalid.name,
    customerIdentifier: cus.khalid.identity,
    amount: 1750,
    supplierId: sup.waha,
    mobile: cus.khalid.mobile,
    email: cus.khalid.email,
  });
  at(3, 16);
  paySadad(db, ctx, db.sadadInvoices[0].invoiceId);
  at(2, 10);
  createSadadPayment(db, ctx, { paymentReferenceId: "SADAD-2026-0002", name: cus.hessa.name, customerIdentifier: cus.hessa.identity, amount: 620, mobile: cus.hessa.mobile });

  // 12. Split bill across three payers
  at(3, 20);
  link("INV-2026-0012", [
    { customer: "fatimah", amount: 400, supplierId: sup.qimam },
    { customer: "abdullah", amount: 400, supplierId: sup.qimam },
    { name: "Yousef Al-Rashid", customerIdentifier: "1122334455", amount: 400, supplierId: sup.qimam },
  ]);
  at(3, 20, 25);
  pay("INV-2026-0012", MADA, cus.fatimah.identity);
  at(3, 21, 2);
  pay("INV-2026-0012", VISA, cus.abdullah.identity);

  // 13. Paid, awaiting settlement
  at(2, 13);
  link("INV-2026-0013", [{ customer: "sara", amount: 2300 }]);
  at(2, 13, 18);
  pay("INV-2026-0013", VISA);

  // Guest checkout → authority VA
  at(1, 18);
  link("INV-2026-0016", [{ name: "Guest – Nasser Al-Qarni", customerIdentifier: "1199887766", amount: 320 }]);
  at(1, 18, 9);
  pay("INV-2026-0016", MADA);

  // Recurring charge
  at(1, 9);
  subsequentPayment(db, ctx, { paymentReferenceId: "SUB-2026-LAMA-02", originalPaymentReferenceId: "SUB-2026-LAMA-01", customerIdentifier: cus.lama.identity, amount: 299 });

  // 9. Unpaid link with a failed attempt
  ago(190);
  link("INV-2026-0009", [{ customer: "turki", amount: 890 }]);
  ago(175);
  pay("INV-2026-0009", DECLINED);

  // 15. Authorized, awaiting capture
  ago(120);
  link("INV-2026-0015", [{ customer: "noura", amount: 1450, supplierId: sup.tamkeen, isPreAuth: true }]);
  ago(108);
  pay("INV-2026-0015", MASTER);

  // Fresh unpaid link
  ago(35);
  link("INV-2026-0017", [{ customer: "khalid", amount: 2750, supplierId: sup.rawabi, enableRecurring: true }]);

  // Historic notifications were already acknowledged by the authority webhook.
  for (const n of db.notifications) {
    n.delivery = {
      status: "delivered",
      attempts: 1,
      lastAttemptAt: n.createdAt,
      responseCode: 200,
      responseBody: JSON.stringify({ responseId: `ABS-${n.id}`, status: "SUCCESS" }),
    };
  }
  return db;
}
