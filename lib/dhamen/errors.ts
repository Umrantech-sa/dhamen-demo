// Error codes as documented in the Dhamen Integration Guide v1.5.

export class DhamenError extends Error {
  constructor(
    public code: string,
    message: string,
    public httpStatus = 400,
    public errors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export const Errors = {
  unauthorized: () => new DhamenError("401", "Authorization failed", 401),
  forbidden: () => new DhamenError("403", "Authentication failed", 403),
  noMapping: () => new DhamenError("404", "Not Found: No Mapping Rule matched", 404),
  validation: (errors: Record<string, string[]>) => new DhamenError("M001", "Model Validation Failed", 400, errors),
  supplierExists: (id: string) => new DhamenError("B001", `Supplier already exist with this ${id} Id`),
  customerExists: (id: string) => new DhamenError("B001", `Customer already exist with this ${id} Id`),
  insufficientRefund: () => new DhamenError("B001", "Insufficient Balance to Refund"),
  supplierNotFound: () => new DhamenError("C015", "can not find supplier"),
  refExists: () => new DhamenError("C033", "PaymentReferenceId already exist"),
  recurringNotSupported: () => new DhamenError("C037", "original Request does not support Recurring payment"),
  duplicateIdentifier: () => new DhamenError("C057", "Customers customerIdentifier should not be the same"),
  amountZero: () => new DhamenError("C064", "Customers required amount should be greater than 0"),
  supplierNotExists: () => new DhamenError("D002", "Supplier not exists", 404),
  customerNotExists: () => new DhamenError("D002", "Customer not exists", 404),
  invoiceNotFound: () => new DhamenError("InvPay002", "Customer Invoice not found", 404),
  invoiceShouldBePaid: () => new DhamenError("InvPay003", "Invoice status should be paid"),
  alreadyCaptured: () => new DhamenError("InvPay004", "Invoice already captured"),
  alreadyReversed: () => new DhamenError("InvPay005", "Invoice status should not be reversed"),
  alreadyRefunded: () => new DhamenError("InvPay006", "Invoice already Refunded"),
  shouldBeUnpaid: () => new DhamenError("InvPay007", "Invoice status should be unpaid to be canceled"),
};

export const ERROR_CATALOG: { code: string; description: string; services: string }[] = [
  { code: "401", description: "Authorization failed", services: "All" },
  { code: "403", description: "Authentication failed", services: "All" },
  { code: "404", description: "Not Found: No Mapping Rule matched", services: "All" },
  { code: "M001", description: "Model Validation Failed", services: "All" },
  { code: "B001", description: "Supplier/Customer already exist · Insufficient Balance to Refund", services: "Create Supplier, Create Customer, Refund to IBAN" },
  { code: "C015", description: "can not find supplier", services: "Supplier Payment" },
  { code: "C033", description: "PaymentReferenceId already exist", services: "Supplier Payment, Customer Payment, Subsequent" },
  { code: "C037", description: "original Request does not support Recurring payment", services: "Customer Subsequent Payment" },
  { code: "C057", description: "Customers customerIdentifier should not be the same", services: "Customer Payment" },
  { code: "C064", description: "Customers required amount should be greater than 0", services: "Customer Payment" },
  { code: "D002", description: "Supplier/Customer not exists", services: "Balances" },
  { code: "InvPay002", description: "Customer Invoice not found", services: "Capture, Reverse, Refund, Cancel" },
  { code: "InvPay003", description: "Invoice status should be paid", services: "Capture, Reverse, Refund" },
  { code: "InvPay004", description: "Invoice already captured", services: "Capture, Reverse" },
  { code: "InvPay005", description: "Invoice status should not be reversed", services: "Reverse" },
  { code: "InvPay006", description: "Invoice already Refunded", services: "Refund" },
  { code: "InvPay007", description: "Invoice status should be unpaid to be canceled", services: "Cancel Payment Link" },
];
