import { randomBytes, randomUUID } from "crypto";
import type { DB } from "./types";

export const guid = () => randomUUID();

const digits = (n: number) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join("");

/** Saudi IBAN (24 chars) with a valid ISO 13616 mod-97 check. */
export function makeIban(bankCode: string, account: string): string {
  const bban = (bankCode + account).padEnd(20, "0").slice(0, 20);
  const rearranged = bban + "SA00";
  const numeric = rearranged.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  const check = 98 - Number(BigInt(numeric) % BigInt(97));
  return `SA${String(check).padStart(2, "0")}${bban}`;
}

/** Virtual IBAN in Dhamen's range (bank 45, wallet prefix 500). */
export function makeViban() {
  const viban = makeIban("45", "000000500" + digits(9));
  return { viban, bban: viban.slice(-12) };
}

export const invoiceHash = () => randomBytes(32).toString("hex");
export const rrn = () => "6" + digits(11);
export const shortId = () => randomBytes(6).toString("hex");
export const sadadBillNumber = () => "10" + digits(8);
export const sadadCustomerId = () => Number("9" + digits(9));

export function uti(now: Date) {
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const doy = Math.floor((now.getTime() - start) / 86400000);
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  return `SABBREM${String(now.getUTCFullYear()).slice(-2)}${String(doy).padStart(3, "0")}${digits(3)}${letters[Math.floor(Math.random() * letters.length)]}`;
}

export function nextTransactionId(db: DB) {
  db.counters.transaction += 1 + Math.floor(Math.random() * 7);
  return db.counters.transaction;
}

export function nextNotificationId(db: DB) {
  db.counters.notification += 1;
  return db.counters.notification;
}

export const r2 = (n: number) => Math.round(n * 100) / 100;
