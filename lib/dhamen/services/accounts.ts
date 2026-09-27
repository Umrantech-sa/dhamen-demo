import { makeViban, nextTransactionId, r2 } from "../generators";
import type { AccountType, Ctx, DB, LedgerEntry, LedgerType, VirtualAccount } from "../types";

export const AUTHORITY_ACCOUNT_ID = "AUTH";

export function openAccount(db: DB, ctx: Ctx, type: AccountType, ownerId: string, ownerName: string, fixed?: { viban: string; bban: string }): VirtualAccount {
  const accountId = type === "authority" ? AUTHORITY_ACCOUNT_ID : `${type === "customer" ? "C" : "S"}:${ownerId}`;
  const { viban, bban } = fixed ?? makeViban();
  const account: VirtualAccount = { accountId, type, ownerId, ownerName, viban, bban, balance: 0, createdAt: ctx.now.toISOString() };
  db.accounts[accountId] = account;
  return account;
}

export const balanceOf = (db: DB, accountId: string) => db.accounts[accountId]?.balance ?? 0;

interface PostInput {
  accountId: string;
  direction: "credit" | "debit";
  type: LedgerType;
  amount: number;
  description: string;
  reference?: string;
  counterparty?: string;
  status?: 1 | 2;
}

export function post(db: DB, ctx: Ctx, input: PostInput): LedgerEntry {
  const account = db.accounts[input.accountId];
  if (!account) throw new Error(`Unknown account ${input.accountId}`);
  const amount = r2(input.amount);
  if ((input.status ?? 1) === 1) {
    account.balance = r2(account.balance + (input.direction === "credit" ? amount : -amount));
  }
  const entry: LedgerEntry = {
    transactionId: nextTransactionId(db),
    accountId: input.accountId,
    direction: input.direction,
    type: input.type,
    amount,
    balanceAfter: account.balance,
    reference: input.reference,
    counterparty: input.counterparty,
    description: input.description,
    status: input.status ?? 1,
    createdAt: ctx.now.toISOString(),
  };
  db.ledger.push(entry);
  return entry;
}

/** Internal book transfer between two virtual accounts (escrow → supplier VIBAN). */
export function transfer(db: DB, ctx: Ctx, fromId: string, toId: string, amount: number, reference: string, description: string) {
  const from = db.accounts[fromId];
  const to = db.accounts[toId];
  const out = post(db, ctx, { accountId: fromId, direction: "debit", type: "transfer_out", amount, reference, counterparty: to.ownerName, description });
  const inn = post(db, ctx, { accountId: toId, direction: "credit", type: "transfer_in", amount, reference, counterparty: from.ownerName, description });
  return { out, inn };
}
