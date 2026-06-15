// ---------------------------------------------------------------------------
// NEXA bank reconciliation — auto-matching of book lines to statement lines,
// and the bank reconciliation statement (BRS) that bridges the book balance to
// the bank balance via the outstanding reconciling items.
// ---------------------------------------------------------------------------

import type { BankAccount, BookLine, StmtLine } from "./banking";

const r2 = (n: number) => Math.round(n * 100) / 100;
const dayDiff = (a: string, b: string) => Math.abs((new Date(a).getTime() - new Date(b).getTime()) / 86_400_000);

export type MatchMap = Record<string, string>; // stmtId → bookId

/** How sure we are about a proposed pairing. */
export type MatchConfidence = "exact" | "likely";

export interface MatchProposal {
  stmtId: string;
  bookId: string;
  confidence: MatchConfidence;
  reason: string;
  dayGap: number;
}

/**
 * Drop existing pairs that no longer reference live, unused lines. Returns a
 * fresh map plus the set of book ids it consumes (so further passes don't
 * double-assign a book line).
 */
function keepValid(book: BookLine[], stmt: StmtLine[], existing: MatchMap) {
  const bookById = new Map(book.map((b) => [b.id, b]));
  const stmtById = new Map(stmt.map((s) => [s.id, s]));
  const usedBook = new Set<string>();
  const result: MatchMap = {};
  for (const [stmtId, bookId] of Object.entries(existing)) {
    if (stmtById.has(stmtId) && bookById.has(bookId) && !usedBook.has(bookId)) {
      result[stmtId] = bookId;
      usedBook.add(bookId);
    }
  }
  return { result, usedBook };
}

/**
 * Rank every plausible (statement ↔ book) pairing not already taken in
 * `existing`, then greedily assign best-first so each line is used once.
 *
 * Signals, strongest first:
 *  - UTR (bank reference) + equal amount  → "exact"  (auto-committable)
 *  - equal amount within 7 days, no UTR   → "likely" (needs a human nod)
 *
 * Matching on UTR — not just amount + nearest date — is what stops two equal
 * payments from cross-pairing to the wrong book line. Bank-only lines (charges
 * / interest) never propose a match.
 */
export function proposeMatches(book: BookLine[], stmt: StmtLine[], existing: MatchMap): MatchProposal[] {
  const usedBook = new Set(Object.values(existing));
  const usedStmt = new Set(Object.keys(existing));
  const openStmt = stmt.filter((s) => s.kind === "normal" && !usedStmt.has(s.id));

  type Cand = MatchProposal & { score: number };
  const cands: Cand[] = [];
  for (const s of openStmt) {
    for (const b of book) {
      if (usedBook.has(b.id)) continue;
      if (r2(b.amount) !== r2(s.amount)) continue;
      const gap = dayDiff(s.date, b.date);
      const refEqual = !!s.ref && s.ref === b.ref;
      if (refEqual) {
        cands.push({
          stmtId: s.id,
          bookId: b.id,
          confidence: "exact",
          reason: gap === 0 ? "UTR + amount verified" : `UTR + amount verified · ${gap}d apart`,
          dayGap: gap,
          score: 10_000 - gap,
        });
      } else if (gap <= 7) {
        cands.push({
          stmtId: s.id,
          bookId: b.id,
          confidence: "likely",
          reason: gap === 0 ? "Amount match · same day" : `Amount match · ${gap}d apart`,
          dayGap: gap,
          score: 1_000 - gap * 10,
        });
      }
    }
  }

  cands.sort((a, b) => b.score - a.score);
  const out: MatchProposal[] = [];
  const ub = new Set<string>();
  const us = new Set<string>();
  for (const c of cands) {
    if (ub.has(c.bookId) || us.has(c.stmtId)) continue;
    ub.add(c.bookId);
    us.add(c.stmtId);
    out.push({ stmtId: c.stmtId, bookId: c.bookId, confidence: c.confidence, reason: c.reason, dayGap: c.dayGap });
  }
  return out;
}

/**
 * Auto-match: preserve still-valid existing pairs, then commit only the
 * high-confidence (UTR-verified) proposals. Amount-and-date-only guesses are
 * left for {@link proposeMatches} to surface as reviewable suggestions rather
 * than being silently trusted.
 */
export function autoMatch(book: BookLine[], stmt: StmtLine[], existing: MatchMap): MatchMap {
  const { result } = keepValid(book, stmt, existing);
  for (const p of proposeMatches(book, stmt, result)) {
    if (p.confidence === "exact") result[p.stmtId] = p.bookId;
  }
  return result;
}

/** The amount+date-only proposals worth showing the user for a one-click confirm. */
export function suggestionsFor(book: BookLine[], stmt: StmtLine[], current: MatchMap): MatchProposal[] {
  return proposeMatches(book, stmt, current).filter((p) => p.confidence === "likely");
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
