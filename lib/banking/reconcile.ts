// ---------------------------------------------------------------------------
// NEXA bank reconciliation — auto-matching of book lines to statement lines,
// and the bank reconciliation statement (BRS) that bridges the book balance to
// the bank balance via the outstanding reconciling items.
// ---------------------------------------------------------------------------

import type { BankAccount, BookLine, StmtLine } from "./banking";

const r2 = (n: number) => Math.round(n * 100) / 100;
const dayDiff = (a: string, b: string) => Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);

export type MatchMap = Record<string, string>; // stmtId → bookId

/**
 * Auto-match statement lines to book lines by equal amount and nearest date
 * (within 7 days). Existing valid matches are preserved. Bank-only lines
 * (charges / interest) never match a book line.
 */
export function autoMatch(book: BookLine[], stmt: StmtLine[], existing: MatchMap): MatchMap {
  const bookById = new Map(book.map((b) => [b.id, b]));
  const stmtById = new Map(stmt.map((s) => [s.id, s]));
  const usedBook = new Set<string>();
  const result: MatchMap = {};

  // keep existing, still-valid pairs
  for (const [stmtId, bookId] of Object.entries(existing)) {
    if (stmtById.has(stmtId) && bookById.has(bookId) && !usedBook.has(bookId)) {
      result[stmtId] = bookId;
      usedBook.add(bookId);
    }
  }

  const openStmt = stmt.filter((s) => s.kind === "normal" && !(s.id in result)).sort((a, b) => a.date.localeCompare(b.date));
  for (const s of openStmt) {
    let best: BookLine | null = null;
    let bestD = Infinity;
    for (const b of book) {
      if (usedBook.has(b.id)) continue;
      if (r2(b.amount) !== r2(s.amount)) continue;
      const d = dayDiff(s.date, b.date);
      if (d <= 7 && d < bestD) {
        best = b;
        bestD = d;
      }
    }
    if (best) {
      result[s.id] = best.id;
      usedBook.add(best.id);
    }
  }
  return result;
}

export interface BrsLine {
  label: string;
  amount: number;
  isTotal?: boolean;
}

export interface Reconciliation {
  bookBalance: number; // incl. opening + booked bank-only adjustments
  statementBalance: number;
  matchedCount: number;
  bookCount: number;
  stmtCount: number;
  matchedPct: number;
  unmatchedBook: BookLine[]; // deposits in transit / unpresented cheques
  unmatchedStmt: StmtLine[]; // bank-only, not yet booked
  depositsInTransit: number;
  unpresentedCheques: number;
  bankCredits: number; // bank-only credits not in books
  bankCharges: number; // bank-only debits not in books
  brs: BrsLine[];
  difference: number; // residual after the BRS (≈ 0 when fully reconciled)
}

export function reconcile(
  acc: BankAccount,
  book: BookLine[],
  stmt: StmtLine[],
  matches: MatchMap,
  booked: string[],
): Reconciliation {
  const bookedSet = new Set(booked);
  const matchedBookIds = new Set(Object.values(matches));
  const matchedStmtIds = new Set(Object.keys(matches));

  const rawBookBalance = r2(acc.opening + book.reduce((s, b) => s + b.amount, 0));
  const statementBalance = r2(acc.opening + stmt.reduce((s, l) => s + l.amount, 0));

  // booked bank-only lines are now in the books too
  const bookedAdj = r2(stmt.filter((l) => bookedSet.has(l.id)).reduce((s, l) => s + l.amount, 0));
  const bookBalance = r2(rawBookBalance + bookedAdj);

  const unmatchedBook = book.filter((b) => !matchedBookIds.has(b.id));
  const unmatchedStmt = stmt.filter((l) => !matchedStmtIds.has(l.id) && !bookedSet.has(l.id));

  const depositsInTransit = r2(unmatchedBook.filter((b) => b.amount > 0).reduce((s, b) => s + b.amount, 0));
  const unpresentedCheques = r2(-unmatchedBook.filter((b) => b.amount < 0).reduce((s, b) => s + b.amount, 0));
  const bankCredits = r2(unmatchedStmt.filter((l) => l.amount > 0).reduce((s, l) => s + l.amount, 0));
  const bankCharges = r2(-unmatchedStmt.filter((l) => l.amount < 0).reduce((s, l) => s + l.amount, 0));

  // BRS: book → bank
  const brs: BrsLine[] = [
    { label: "Balance as per books", amount: bookBalance, isTotal: true },
    { label: "Add: credits in bank not in books", amount: bankCredits },
    { label: "Less: charges in bank not in books", amount: -bankCharges },
    { label: "Add: cheques issued, not yet presented", amount: unpresentedCheques },
    { label: "Less: deposits in transit", amount: -depositsInTransit },
    { label: "Balance as per bank statement", amount: statementBalance, isTotal: true },
  ];

  const bridged = r2(bookBalance + bankCredits - bankCharges + unpresentedCheques - depositsInTransit);
  const difference = r2(statementBalance - bridged);

  const matchedCount = matchedStmtIds.size;
  const matchableBook = book.length;
  return {
    bookBalance,
    statementBalance,
    matchedCount,
    bookCount: book.length,
    stmtCount: stmt.length,
    matchedPct: matchableBook ? Math.round((matchedBookIds.size / matchableBook) * 100) : 100,
    unmatchedBook,
    unmatchedStmt,
    depositsInTransit,
    unpresentedCheques,
    bankCredits,
    bankCharges,
    brs,
    difference,
  };
}
