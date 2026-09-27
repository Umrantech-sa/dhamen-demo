import { format, formatDistanceToNowStrict } from "date-fns";

const money = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

export const sar = (n: number | undefined | null) => money.format(n ?? 0);
export const sarCompact = (n: number) => compact.format(n);
export const fmtDate = (iso?: string) => (iso ? format(new Date(iso), "dd MMM yyyy, HH:mm") : "—");
export const fmtDay = (iso?: string) => (iso ? format(new Date(iso), "dd MMM yyyy") : "—");
export const timeAgo = (iso?: string) => (iso ? `${formatDistanceToNowStrict(new Date(iso))} ago` : "—");
export const formatIban = (iban?: string) => (iban ? iban.replace(/(.{4})/g, "$1 ").trim() : "—");
export const shortHash = (h: string) => `${h.slice(0, 8)}…${h.slice(-6)}`;
export const initials = (name: string) =>
  name
    .replace(/^(Al-|Guest – )/, "")
    .split(/\s+/)
    .filter((p) => !/^(Al-|–)$/.test(p))
    .slice(0, 2)
    .map((p) => p.replace(/^Al-/, "")[0])
    .join("")
    .toUpperCase();

export function newRef(prefix = "INV") {
  const d = new Date();
  return `${prefix}-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename });
  a.click();
  URL.revokeObjectURL(url);
}
