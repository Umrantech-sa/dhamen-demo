import { z } from "zod";
import { Errors } from "./errors";

// Field rules from the "Service input" tables of the guide.
const blankToUndef = (v: unknown) => (v === "" || v === null ? undefined : v);
const opt = <T extends z.ZodType>(s: T) => z.preprocess(blankToUndef, s.optional());

export const ibanSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\s+/g, "").toUpperCase())
  .pipe(z.string().regex(/^SA\d{22}$/, "IBAN must be 24 characters starting with SA followed by 22 digits"));
const identity10 = z
  .string()
  .trim()
  .regex(/^\d{10}$/, "Identity number must be 10 digits");
const name100 = z.string().trim().min(1, "Name is required").max(100, "Name max length is 100");
const mobile = z
  .string()
  .trim()
  .regex(/^9665\d{8}$/, "Mobile format must be 9665xxxxxxxx");
const email = z
  .string()
  .trim()
  .regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Email format must be z@z.z");
const ref50 = z.string().trim().min(1, "paymentReferenceId is required").max(50, "paymentReferenceId max length is 50");
const guid = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F-]{36}$/, "Must be a valid GUID");
const amount = z.coerce.number().min(1, "Amount must be minimum of 1");
const bool = opt(z.boolean());

export const schemas = {
  createSupplier: z.object({
    name: name100,
    iban: ibanSchema,
    identityNumber: identity10,
    payoutThresholdAmount: opt(z.coerce.number().min(0)),
    email: opt(email),
    mobile: opt(mobile),
  }),
  updateSupplier: z.object({
    supplierId: guid,
    name: name100,
    iban: ibanSchema,
    identityNumber: identity10,
    payoutThresholdAmount: opt(z.coerce.number().min(0)),
    email: opt(email),
    mobile: opt(mobile),
  }),
  supplierPayment: z.object({
    paymentReferenceId: ref50,
    supplierPayments: z.array(z.object({ supplierId: guid, amount, customerId: opt(guid) })).min(1, "At least one supplier payment is required"),
  }),
  supplierPaymentStatus: z.object({ supplierId: guid, paymentReferenceId: ref50 }),
  depositMoney: z.object({
    customerId: z.string().trim().min(1, "customerId is required"),
    amount: opt(z.coerce.number().min(1, "Amount must be minimum of 1")),
    paymentIWalletNumber: opt(z.string().trim()),
  }),
  createCustomer: z.object({
    identityNumber: identity10,
    name: name100,
    iban: opt(ibanSchema),
    email: opt(email),
    mobile: opt(mobile),
  }),
  customerPayment: z.object({
    paymentReferenceId: ref50,
    paymentExpiredOnMinutes: opt(z.coerce.number().min(1)),
    customerPayments: z
      .array(
        z
          .object({
            name: name100,
            customerIdentifier: z.string().trim().min(1).max(12, "customerIdentifier max length is 12"),
            amount: z.coerce.number(),
            supplierId: opt(guid),
            isPreAuth: bool,
            enableBNPL: bool,
            mobile: opt(mobile),
            email: opt(email),
            enableRecurring: bool,
            returnUrl: opt(z.string().trim().url("returnUrl must be a valid URL")),
          })
          .superRefine((v, ctx) => {
            if (v.enableBNPL && (!v.mobile || !v.email)) {
              ctx.addIssue({ code: "custom", path: ["mobile"], message: "mobile and email are required when enableBNPL is true" });
            }
          }),
      )
      .min(1, "At least one customer payment is required"),
  }),
  customerPaymentStatus: z.object({ paymentReferenceId: ref50, customerIdentifier: opt(z.string().trim()) }),
  capture: z.object({
    paymentReferenceId: ref50,
    customerIdentifier: z.string().trim().min(1),
    requestId: opt(z.string().trim()),
    amount: opt(amount),
  }),
  reverse: z.object({ paymentReferenceId: ref50, customerIdentifier: z.string().trim().min(1) }),
  refundIban: z.object({
    requestId: opt(z.string().trim()),
    paymentReferenceId: ref50,
    customerName: name100,
    iban: ibanSchema,
    amount: opt(amount),
  }),
  cancel: z.object({ paymentReferenceId: ref50, customerIdentifier: opt(z.string().trim()) }),
  subsequent: z.object({
    paymentReferenceId: ref50,
    originalPaymentReferenceId: ref50,
    customerIdentifier: z.string().trim().min(1),
    amount,
  }),
  sadad: z.object({
    paymentReferenceId: z.string().trim().min(1).max(100),
    name: name100,
    customerIdentifier: z.string().trim().min(1),
    amount: z.coerce.number().min(1, "Amount must be minimum of 1"),
    supplierId: opt(guid),
    email: opt(email),
    mobile: opt(mobile),
  }),
};

/** Normalises the casing quirks seen in the guide samples (e.g. paymentReferenceID). */
function normaliseKeys(body: unknown): unknown {
  if (Array.isArray(body)) return body.map(normaliseKeys);
  if (body && typeof body === "object") {
    return Object.fromEntries(Object.entries(body as Record<string, unknown>).map(([k, v]) => [k === "paymentReferenceID" ? "paymentReferenceId" : k, normaliseKeys(v)]));
  }
  return body;
}

export function validate<T extends z.ZodType>(schema: T, body: unknown): z.output<T> {
  const result = schema.safeParse(normaliseKeys(body ?? {}));
  if (!result.success) {
    const errors: Record<string, string[]> = {};
    for (const issue of result.error.issues) {
      const key = issue.path.join(".") || "body";
      (errors[key] ??= []).push(issue.message);
    }
    throw Errors.validation(errors);
  }
  return result.data;
}
