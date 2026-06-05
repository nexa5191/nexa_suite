// ---------------------------------------------------------------------------
// NEXA multi-bank reconciliation — the bank masters, the book side (from the
// ledger's cash postings) and a deterministically-generated bank statement that
// deliberately differs from the books (timing lags, deposits in transit,
// unpresented cheques, bank-only charges/interest) so there's something real to
// reconcile.
// ---------------------------------------------------------------------------

import { allPostings } from "@/lib/accounting/ledger";
import { account } from "@/lib/accounting/chart-of-accounts";
import { entityById } from "@/lib/accounting/org";

export interface BankAccount {
  id: string;
  entityId: string;
  accountCode: string; // COA cash/bank account
  bankName: string;
  number: string;
  ifsc: string;
  currency: string;
  opening: number; // book opening balance at the start of the rec window (base INR)
}

export const BANK_ACCOUNTS: BankAccount[] = [
  { id: "bank-foods-hdfc", entityId: "ent-nexa-in", accountCode: "1020", bankName: "HDFC Bank — Current", number: "5011 2233 4455", ifsc: "HDFC0000291", currency: "INR", opening: 4_200_000 },
  { id: "bank-foods-eefc", entityId: "ent-nexa-in", accountCode: "1030", bankName: "HDFC Bank — EEFC (Forex)", number: "5011 9988 7766", ifsc: "HDFC0000291", currency: "INR", opening: 1_350_000 },
  { id: "bank-trade-icici", entityId: "ent-nexa-trade", accountCode: "1020", bankName: "ICICI Bank — Current", number: "6022 7788 1122", ifsc: "ICIC0000271", currency: "INR", opening: 2_600_000 },
  { id: "bank-global-dbs", entityId: "ent-nexa-global", accountCode: "1020", bankName: "DBS Bank — Current", number: "0012-345678", ifsc: "DBSSSGSG", currency: "SGD", opening: 900_000 },
];

export function bankAccountById(id: string) {
  return BANK_ACCOUNTS.find((b) => b.id === id);
}

export function bankAccountLabel(b: BankAccount) {
  return `${entityById(b.entityId)?.name} · ${b.bankName}`;
}

// ---- a line in the books (cash posting) ------------------------------------
export interface BookLine {
  id: string;
  date: string;
  amount: number; // signed: + money in, − money out
  memo: string;
  ref: string;
  category: string;
}

// ---- a line on the bank statement ------------------------------------------
export type StmtKind = "normal" | "charge" | "interest";
export interface StmtLine {
  id: string;
  date: string;
  amount: number; // signed
  description: string;
  kind: StmtKind;
  ref: string;
}

// ---- deterministic helpers -------------------------------------------------
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rngFor(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const utr = (seed: string) => `UTR${(hash(seed) % 1_000_000_000).toString().padStart(9, "0")}`;

// ---- the book side: cash postings for an account in [from, to] -------------
export function bookLines(acc: BankAccount, from: string, to: string): BookLine[] {
  const out: BookLine[] = [];
  for (const p of allPostings()) {
    if (p.basis !== "accrual") continue; // accrual ledger carries every cash movement
    if (p.entityId !== acc.entityId) continue;
    if (p.accountCode !== acc.accountCode) continue;
    if (!account(p.accountCode).isCash) continue;
    if (p.date < from || p.date > to) continue;
    const amount = p.debit - p.credit;
    if (amount === 0) continue;
    out.push({ id: p.id, date: p.date, amount, memo: p.memo, ref: utr(p.id), category: p.category });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---- the statement side: generated to differ from the books ----------------
export function statementLines(acc: BankAccount, from: string, to: string): StmtLine[] {
  const book = bookLines(acc, from, to);
  const out: StmtLine[] = [];
  for (const b of book) {
    const r = rngFor("stmt-" + b.id)();
    if (r < 0.74) {
      // clears same day
      out.push({ id: `st-${b.id}`, date: b.date, amount: b.amount, description: b.memo, kind: "normal", ref: b.ref });
    } else if (r < 0.86) {
      // clears a few days later (timing difference, still in window)
      const d = addDays(b.date, 3 + Math.floor(r * 4));
      if (d <= to) out.push({ id: `st-${b.id}`, date: d, amount: b.amount, description: b.memo, kind: "normal", ref: b.ref });
      // else: drops off → deposit in transit / unpresented cheque
    } else if (r < 0.94) {
      // book-only this period (in transit / unpresented) → no statement line
    } else {
      out.push({ id: `st-${b.id}`, date: b.date, amount: b.amount, description: b.memo, kind: "normal", ref: b.ref });
    }
  }
  // bank-only items not in the books: monthly charges + interest credit
  const mid = addDays(from, 14);
  const endish = to;
  out.push({ id: `bo-${acc.id}-chg`, date: mid, amount: -Math.round(2400 + (hash(acc.id) % 1800)), description: "Bank charges & NEFT fees", kind: "charge", ref: utr(acc.id + "chg") });
  out.push({ id: `bo-${acc.id}-int`, date: endish, amount: Math.round(5200 + (hash(acc.id + "i") % 4200)), description: "Savings interest credit", kind: "interest", ref: utr(acc.id + "int") });
  if (hash(acc.id) % 2 === 0) {
    out.push({ id: `bo-${acc.id}-ach`, date: addDays(from, 9), amount: -Math.round(18000 + (hash(acc.id + "a") % 9000)), description: "Auto-debit — insurance premium", kind: "charge", ref: utr(acc.id + "ach") });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// ---------------------------------------------------------------------------
// Persistence — manual matches, booked bank-only lines
// ---------------------------------------------------------------------------
const MATCH_KEY = "nexa-bank-matches";
const BOOKED_KEY = "nexa-bank-booked";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}
function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

// matches keyed by account: { [accountId]: { [stmtId]: bookId } }
export type MatchStore = Record<string, Record<string, string>>;
export const loadMatches = () => read<MatchStore>(MATCH_KEY, {});
export const saveMatches = (m: MatchStore) => write(MATCH_KEY, m);

// booked bank-only statement ids: { [accountId]: stmtId[] }
export type BookedStore = Record<string, string[]>;
export const loadBooked = () => read<BookedStore>(BOOKED_KEY, {});
export const saveBooked = (b: BookedStore) => write(BOOKED_KEY, b);
