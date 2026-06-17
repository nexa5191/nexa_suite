import type { BusinessEvent, Posting, ReportFilters, Basis } from "./types";
import { BUSINESS_EVENTS, gstRateFor } from "./events";
import { locationById } from "./org";

let _seq = 0;
function post(
  out: Posting[],
  ev: BusinessEvent,
  basis: Basis,
  date: string,
  accountCode: string,
  debit: number,
  credit: number,
) {
  if (debit === 0 && credit === 0) return;
  const loc = locationById(ev.locationId);
  out.push({
    id: `pst-${++_seq}`,
    eventId: ev.id,
    date,
    accountCode,
    debit,
    credit,
    entityId: ev.entityId,
    locationId: ev.locationId,
    state: loc?.state ?? "—",
    currency: ev.currency,
    basis,
    memo: ev.memo,
    category: ev.category,
  });
}

function expand(ev: BusinessEvent, out: Posting[]) {
  const rate = gstRateFor(ev);
  const gst = Math.round(ev.amount * rate);
  const gross = ev.amount + gst;

  if (ev.kind === "sale") {
    // Accrual: recognise revenue at invoice date.
    post(out, ev, "accrual", ev.accrualDate, ev.contraAccount, gross, 0); // Dr AR
    post(out, ev, "accrual", ev.accrualDate, ev.incomeOrExpenseAccount, 0, ev.amount); // Cr Income
    if (gst) post(out, ev, "accrual", ev.accrualDate, "2100", 0, gst); // Cr GST Output
    if (ev.cashDate) {
      // Settlement of receivable.
      post(out, ev, "accrual", ev.cashDate, ev.cashAccount, gross, 0); // Dr Cash
      post(out, ev, "accrual", ev.cashDate, ev.contraAccount, 0, gross); // Cr AR
      // Cash basis: recognise revenue when collected.
      post(out, ev, "cash", ev.cashDate, ev.cashAccount, gross, 0);
      post(out, ev, "cash", ev.cashDate, ev.incomeOrExpenseAccount, 0, ev.amount);
      if (gst) post(out, ev, "cash", ev.cashDate, "2100", 0, gst);
    }
    return;
  }

  if (ev.kind === "purchase") {
    // Accrual: recognise expense at bill date.
    post(out, ev, "accrual", ev.accrualDate, ev.incomeOrExpenseAccount, ev.amount, 0); // Dr Expense
    if (gst) post(out, ev, "accrual", ev.accrualDate, "1300", gst, 0); // Dr GST Input
    post(out, ev, "accrual", ev.accrualDate, ev.contraAccount, 0, gross); // Cr AP / Payable
    if (ev.cashDate) {
      post(out, ev, "accrual", ev.cashDate, ev.contraAccount, gross, 0); // Dr Payable
      post(out, ev, "accrual", ev.cashDate, ev.cashAccount, 0, gross); // Cr Cash
      // Cash basis: recognise expense when paid.
      post(out, ev, "cash", ev.cashDate, ev.incomeOrExpenseAccount, ev.amount, 0);
      if (gst) post(out, ev, "cash", ev.cashDate, "1300", gst, 0);
      post(out, ev, "cash", ev.cashDate, ev.cashAccount, 0, gross);
    }
    return;
  }

  if (ev.kind === "transfer") {
    const d = ev.debitAccount!;
    const c = ev.creditAccount!;
    post(out, ev, "accrual", ev.accrualDate, d, ev.amount, 0);
    post(out, ev, "accrual", ev.accrualDate, c, 0, ev.amount);
    // Cash basis includes only transfers that actually moved cash
    // (depreciation has cashDate === null → accrual only).
    if (ev.cashDate) {
      post(out, ev, "cash", ev.cashDate, d, ev.amount, 0);
      post(out, ev, "cash", ev.cashDate, c, 0, ev.amount);
    }
  }
}

// Build the seed ledger once and cache (module-level singleton).
let _seed: Posting[] | null = null;
function seedPostings(): Posting[] {
  if (_seed) return _seed;
  const out: Posting[] = [];
  for (const ev of BUSINESS_EVENTS) expand(ev, out);
  _seed = out;
  return out;
}

// Manually-posted vouchers, registered by the JournalProvider (client-side,
// hydrated from localStorage). Merged into every ledger read so the General
// Ledger and all statements reflect user entries. Empty during SSR.
let _manual: Posting[] = [];

/** Replace the set of manual postings merged into the ledger. */
export function setManualPostings(postings: Posting[]): void {
  _manual = postings;
}

export function allPostings(): Posting[] {
  const seed = seedPostings();
  return _manual.length ? seed.concat(_manual) : seed;
}

function matchesOrg(p: Posting, f: ReportFilters) {
  if (f.entityId !== "all" && p.entityId !== f.entityId) return false;
  if (f.locationId !== "all" && p.locationId !== f.locationId) return false;
  if (f.state !== "all" && p.state !== f.state) return false;
  if (p.basis !== f.basis) return false;
  return true;
}

/** Net signed movement (debit − credit) per account within [from, to]. */
export function periodMovement(f: ReportFilters): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of allPostings()) {
    if (!matchesOrg(p, f)) continue;
    if (f.from && p.date < f.from) continue;
    if (f.to && p.date > f.to) continue;
    m.set(p.accountCode, (m.get(p.accountCode) ?? 0) + p.debit - p.credit);
  }
  return m;
}

/** Cumulative signed balance (debit − credit) per account up to and incl `to`. */
export function cumulativeBalance(f: ReportFilters, asOf: string): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of allPostings()) {
    if (!matchesOrg(p, f)) continue;
    if (asOf && p.date > asOf) continue;
    m.set(p.accountCode, (m.get(p.accountCode) ?? 0) + p.debit - p.credit);
  }
  return m;
}

/** Raw filtered postings (for the journal / general ledger view). */
export function filteredPostings(f: ReportFilters, opts?: { cumulative?: boolean }): Posting[] {
  const rows: Posting[] = [];
  for (const p of allPostings()) {
    if (!matchesOrg(p, f)) continue;
    if (!opts?.cumulative && f.from && p.date < f.from) continue;
    if (f.to && p.date > f.to) continue;
    rows.push(p);
  }
  return rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}
