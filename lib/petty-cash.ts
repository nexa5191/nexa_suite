// ---------------------------------------------------------------------------
// NEXA petty cash book — an imprest-float cash book that posts REAL double-entry
// vouchers into the ledger (via the JournalProvider), so every petty expense and
// top-up flows into the P&L / Balance Sheet / General Ledger like any other.
//
// The "book" is simply the set of posted vouchers that touch the Petty Cash
// account (1015), presented as a classic analysis cash book with a running
// float balance:
//   • Top-up    → contra: Dr Petty Cash / Cr Bank          (cash IN to the float)
//   • Expense   → payment: Dr Expense head / Cr Petty Cash  (cash OUT of the float)
// ---------------------------------------------------------------------------

import type { EntryDraft, ManualEntry } from "@/lib/accounting/manual-entries";

export const PETTY_CASH_ACCOUNT = "1015";
export const DEFAULT_BANK = "1020";

/** Analysis heads available in the petty cash book → their GL expense account. */
export interface PettyHead {
  label: string;
  accountCode: string;
}

export const PETTY_HEADS: PettyHead[] = [
  { label: "Conveyance & local travel", accountCode: "6070" },
  { label: "Printing & stationery", accountCode: "6035" },
  { label: "Postage & courier", accountCode: "6035" },
  { label: "Staff refreshments", accountCode: "6035" },
  { label: "Repairs & maintenance", accountCode: "6035" },
  { label: "Utilities & sundry bills", accountCode: "6030" },
  { label: "Office & admin sundries", accountCode: "6035" },
];

const PETTY_HEADS_KEY = "nexa-petty-heads";
export function loadPettyHeads(): PettyHead[] {
  if (typeof window === "undefined") return PETTY_HEADS;
  try {
    const r = localStorage.getItem(PETTY_HEADS_KEY);
    const p = r ? JSON.parse(r) as PettyHead[] : null;
    if (Array.isArray(p) && p.length) return p;
  } catch { /* ignore */ }
  return PETTY_HEADS;
}

export function pettyHead(label: string): PettyHead {
  const heads = loadPettyHeads();
  return heads.find((h) => h.label === label) ?? heads[heads.length - 1];
}

const round2 = (n: number) => Math.round(n * 100) / 100;

// ---- voucher drafts --------------------------------------------------------

interface DraftBase {
  date: string;
  entityId: string;
  locationId: string;
  currency: string;
}

/** Replenish the imprest float from the bank — Dr Petty Cash / Cr Bank. */
export function topUpDraft(base: DraftBase, amount: number, bankAccount: string, narration: string): EntryDraft {
  const amt = round2(amount);
  return {
    type: "contra",
    date: base.date,
    narration: narration || "Petty cash top-up",
    entityId: base.entityId,
    locationId: base.locationId,
    currency: base.currency,
    basis: "both",
    lines: [
      { accountCode: PETTY_CASH_ACCOUNT, debit: amt, credit: 0 },
      { accountCode: bankAccount, debit: 0, credit: amt },
    ],
  };
}

/** Record a petty expense — Dr Expense head / Cr Petty Cash. */
export function expenseDraft(base: DraftBase, amount: number, headAccount: string, narration: string): EntryDraft {
  const amt = round2(amount);
  return {
    type: "payment",
    date: base.date,
    narration,
    entityId: base.entityId,
    locationId: base.locationId,
    currency: base.currency,
    basis: "both",
    lines: [
      { accountCode: headAccount, debit: amt, credit: 0 },
      { accountCode: PETTY_CASH_ACCOUNT, debit: 0, credit: amt },
    ],
  };
}

// ---- book derivation -------------------------------------------------------

export interface PettyBookRow {
  id: string;
  voucherNo: string;
  date: string;
  narration: string;
  entityId: string;
  /** GL account on the "other" side (expense head for spend, bank for top-up). */
  contraAccount: string;
  topUp: number; // cash into the float (debit to 1015)
  spend: number; // cash out of the float (credit to 1015)
  balance: number; // running float balance after this row
  reversed: boolean;
}

/** Signed petty-cash effect of an entry (debit − credit on account 1015). */
function pettyDelta(e: ManualEntry): number {
  return e.lines.reduce((s, l) => {
    if (l.accountCode !== PETTY_CASH_ACCOUNT) return s;
    return s + (Number(l.debit) || 0) - (Number(l.credit) || 0);
  }, 0);
}

/** True if a posted voucher belongs to the petty cash book. */
export function isPettyEntry(e: ManualEntry): boolean {
  return e.lines.some((l) => l.accountCode === PETTY_CASH_ACCOUNT);
}

/** The "other" account (not Petty Cash) — the analysis head or the bank. */
function contraOf(e: ManualEntry): string {
  const other = e.lines.find((l) => l.accountCode !== PETTY_CASH_ACCOUNT);
  return other?.accountCode ?? "—";
}

/** Build the running-balance cash book from all posted vouchers. */
export function pettyCashBook(entries: ManualEntry[]): { rows: PettyBookRow[]; balance: number } {
  const petty = entries
    .filter(isPettyEntry)
    .slice()
    .sort((a, b) => (a.date === b.date ? a.createdAt.localeCompare(b.createdAt) : a.date.localeCompare(b.date)));

  let bal = 0;
  const rows: PettyBookRow[] = petty.map((e) => {
    const delta = round2(pettyDelta(e));
    bal = round2(bal + delta);
    return {
      id: e.id,
      voucherNo: e.voucherNo,
      date: e.date,
      narration: e.narration,
      entityId: e.entityId,
      contraAccount: contraOf(e),
      topUp: delta > 0 ? delta : 0,
      spend: delta < 0 ? -delta : 0,
      balance: bal,
      reversed: e.status === "reversed" || !!e.reversalOf,
    };
  });
  // newest first for display, but the running balance was computed chronologically
  rows.reverse();
  return { rows, balance: bal };
}
