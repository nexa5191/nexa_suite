// ---------------------------------------------------------------------------
// NEXA FX Revaluation
//
// NEXA stores everything in base INR but transacts in foreign currency too:
// exports billed in USD/SGD, some imports in USD, and Nexa Global (Pte Ltd)
// keeps an SGD bank balance. At period-end the open foreign-currency MONETARY
// items (AR / AP / Bank) must be restated at the closing rate, booking the
// resulting unrealised gain/loss against a "Forex Gain/Loss" account.
//
// Rate direction — IMPORTANT:
//   bookedRateInr / periodEndRateInr are quoted as INR per 1 foreign unit.
//   (lib/currency.ts CURRENCIES.rate is foreign-per-INR, so INR-per-FC = 1/rate.)
//
// Sign convention:
//   - AR / Bank  → a RISE in INR-per-FC is a GAIN (the asset is worth more INR).
//   - AP         → a RISE in INR-per-FC is a LOSS (the liability costs more INR).
//
// Demo "today" is 2026-06-18; the revaluation is run as on period-end
// 2026-05-31 (FY 2025-26). Nothing is posted — buildRevalJournal() returns the
// balanced Dr/Cr lines as data only.
// ---------------------------------------------------------------------------

import { CURRENCIES, currencyByCode } from "@/lib/currency";

export type FxCurrency = "USD" | "SGD" | "EUR" | "GBP" | "AED";
export type FxItemType = "AR" | "AP" | "Bank";

/** An open foreign-currency monetary item as of the period-end. */
export interface FxOpenItem {
  id: string;
  type: FxItemType;
  party: string;
  currency: FxCurrency;
  fcAmount: number; // in foreign units
  bookedRateInr: number; // INR per 1 FC at booking
  entityId: string;
  docDate: string; // ISO
}

/** A rate row the user can edit — booking baseline vs. period-end. */
export interface RateRow {
  currency: FxCurrency;
  baselineInr: number; // INR per 1 FC — derived from CURRENCIES (1/rate)
  periodEndInr: number; // INR per 1 FC at 2026-05-31 (editable)
}

/** currency → period-end INR-per-FC rate. */
export type RateTable = Record<FxCurrency, number>;

/** A single revalued line in the result. */
export interface FxRevalLine {
  item: FxOpenItem;
  bookedInr: number; // fcAmount * bookedRateInr
  revaluedInr: number; // fcAmount * periodEndRateInr
  diffInr: number; // revaluedInr - bookedInr (raw, before sign convention)
  gainLossInr: number; // signed impact on P&L (+ gain / − loss)
}

/** A Dr/Cr line of the (un-posted) restatement journal. */
export interface FxJournalLine {
  account: string;
  debit: number;
  credit: number;
  note: string;
}

export interface FxRevalResult {
  lines: FxRevalLine[];
  totalGain: number; // sum of positive impacts (≥ 0)
  totalLoss: number; // sum of negative impacts as a positive magnitude (≥ 0)
  net: number; // totalGain - totalLoss
  exposureInr: number; // |revalued INR| across all items — gross exposure
  byCurrency: Record<FxCurrency, { exposureInr: number; gainLossInr: number }>;
  byType: Record<FxItemType, { exposureInr: number; gainLossInr: number }>;
}

export const FX_CURRENCIES: FxCurrency[] = ["USD", "SGD", "EUR", "GBP", "AED"];

/** INR per 1 FC implied by lib/currency.ts (rate = FC per 1 INR ⇒ 1/rate). */
export function baselineInrPerFc(currency: FxCurrency): number {
  const c = currencyByCode(currency);
  return c.rate > 0 ? 1 / c.rate : 0;
}

/** Symbol for a foreign currency (for "$12,000"-style FC display). */
export function fxSymbol(currency: FxCurrency): string {
  return currencyByCode(currency).symbol;
}

/**
 * Period-end rates as on 2026-05-31 (INR per 1 FC). Derived loosely from the
 * baseline (1/rate) then nudged to realistic closing levels so there is a real
 * gain/loss to book. These are the DEFAULTS — the user can edit them and the
 * edits persist to localStorage.
 */
export const PERIOD_END_RATES: RateTable = {
  USD: 83.2, // baseline ≈ 83.33
  SGD: 61.5, // baseline = 62.50
  EUR: 90.4, // baseline ≈ 90.91
  GBP: 106.0, // baseline ≈ 105.26
  AED: 22.6, // baseline ≈ 22.73
};

/** The default editable rate rows (baseline vs. period-end). */
export function defaultRateRows(): RateRow[] {
  return FX_CURRENCIES.map((currency) => ({
    currency,
    baselineInr: round2(baselineInrPerFc(currency)),
    periodEndInr: PERIOD_END_RATES[currency],
  }));
}

// ---------------------------------------------------------------------------
// Seed: deterministic open FC monetary items as of 2026-05-31.
//   bookedRateInr = the spot rate the document was originally booked at — set
//   slightly away from the period-end rate so each item revalues with a gain or
//   a loss.
// ---------------------------------------------------------------------------
export const FX_OPEN_ITEMS: FxOpenItem[] = [];

// ---------------------------------------------------------------------------
// Engine
// ---------------------------------------------------------------------------

/** Revalue a single open item against the supplied period-end rate table. */
export function revalue(item: FxOpenItem, rates: RateTable): FxRevalLine {
  const periodEndRate = rates[item.currency];
  const bookedInr = item.fcAmount * item.bookedRateInr;
  const revaluedInr = item.fcAmount * periodEndRate;
  const diffInr = revaluedInr - bookedInr;
  // AR / Bank: a rise in INR-per-FC is a gain. AP: a rise is a loss.
  const gainLossInr = item.type === "AP" ? -diffInr : diffInr;
  return { item, bookedInr, revaluedInr, diffInr, gainLossInr };
}

function emptyAgg(): { exposureInr: number; gainLossInr: number } {
  return { exposureInr: 0, gainLossInr: 0 };
}

/** Revalue all items and produce the aggregates. */
export function runRevaluation(items: FxOpenItem[], rates: RateTable): FxRevalResult {
  const lines = items.map((i) => revalue(i, rates));

  const byCurrency = Object.fromEntries(
    FX_CURRENCIES.map((c) => [c, emptyAgg()]),
  ) as Record<FxCurrency, { exposureInr: number; gainLossInr: number }>;
  const byType: Record<FxItemType, { exposureInr: number; gainLossInr: number }> = {
    AR: emptyAgg(), AP: emptyAgg(), Bank: emptyAgg(),
  };

  let totalGain = 0;
  let totalLoss = 0;
  let exposureInr = 0;

  for (const l of lines) {
    exposureInr += Math.abs(l.revaluedInr);
    if (l.gainLossInr >= 0) totalGain += l.gainLossInr;
    else totalLoss += -l.gainLossInr;

    byCurrency[l.item.currency].exposureInr += Math.abs(l.revaluedInr);
    byCurrency[l.item.currency].gainLossInr += l.gainLossInr;
    byType[l.item.type].exposureInr += Math.abs(l.revaluedInr);
    byType[l.item.type].gainLossInr += l.gainLossInr;
  }

  return {
    lines,
    totalGain,
    totalLoss,
    net: totalGain - totalLoss,
    exposureInr,
    byCurrency,
    byType,
  };
}

/**
 * A "no-op" revaluation used when FC revaluation is switched off for the period:
 * every open item is kept at its booked INR value, so there is no gain/loss and
 * the restatement journal comes out empty.
 */
export function passthroughRevaluation(items: FxOpenItem[]): FxRevalResult {
  const lines: FxRevalLine[] = items.map((item) => {
    const bookedInr = item.fcAmount * item.bookedRateInr;
    return { item, bookedInr, revaluedInr: bookedInr, diffInr: 0, gainLossInr: 0 };
  });
  const byCurrency = Object.fromEntries(
    FX_CURRENCIES.map((c) => [c, emptyAgg()]),
  ) as Record<FxCurrency, { exposureInr: number; gainLossInr: number }>;
  const byType: Record<FxItemType, { exposureInr: number; gainLossInr: number }> = {
    AR: emptyAgg(), AP: emptyAgg(), Bank: emptyAgg(),
  };
  let exposureInr = 0;
  for (const l of lines) {
    exposureInr += Math.abs(l.revaluedInr);
    byCurrency[l.item.currency].exposureInr += Math.abs(l.revaluedInr);
    byType[l.item.type].exposureInr += Math.abs(l.revaluedInr);
  }
  return { lines, totalGain: 0, totalLoss: 0, net: 0, exposureInr, byCurrency, byType };
}

// ---------------------------------------------------------------------------
// Restatement journal (data only — nothing is posted).
//
// Each monetary account is adjusted by its net gain/loss, with the contra to a
// single "Forex Gain/Loss (Unrealised)" P&L account so the batch balances.
//   AR up   → Dr Trade Receivables (FC) / Cr Forex Gain/Loss
//   AR down → Dr Forex Gain/Loss / Cr Trade Receivables (FC)
//   AP up   → Dr Forex Gain/Loss / Cr Trade Payables (FC)   (loss)
//   Bank up → Dr Foreign Bank / Cr Forex Gain/Loss
// ---------------------------------------------------------------------------

const MONETARY_ACCOUNT: Record<FxItemType, string> = {
  AR: "Trade Receivables (FC)",
  AP: "Trade Payables (FC)",
  Bank: "Foreign Bank Balances",
};

const FOREX_ACCOUNT = "Forex Gain/Loss (Unrealised)";

export function buildRevalJournal(result: FxRevalResult): FxJournalLine[] {
  const lines: FxJournalLine[] = [];

  // One adjustment line per monetary account, by net movement of the account.
  const byAccount = new Map<string, number>(); // account → signed INR adjustment
  let forexNet = 0; // net P&L impact (+ gain / − loss)

  for (const l of result.lines) {
    const account = MONETARY_ACCOUNT[l.item.type];
    // The balance-sheet account moves by the raw INR diff (asset/liability value
    // change); for AP a rise in value is a credit (liability up).
    const accountDelta = l.item.type === "AP" ? -l.diffInr : l.diffInr;
    byAccount.set(account, (byAccount.get(account) ?? 0) + accountDelta);
    forexNet += l.gainLossInr;
  }

  for (const [account, delta] of byAccount) {
    if (Math.round(delta) === 0) continue;
    lines.push({
      account,
      debit: delta > 0 ? round2(delta) : 0,
      credit: delta < 0 ? round2(-delta) : 0,
      note: "Period-end restatement at closing rate",
    });
  }

  // Contra to the Forex Gain/Loss P&L account. A net gain is a credit (income);
  // a net loss is a debit (expense). This makes the batch balance.
  if (Math.round(forexNet) !== 0) {
    lines.push({
      account: FOREX_ACCOUNT,
      debit: forexNet < 0 ? round2(-forexNet) : 0,
      credit: forexNet > 0 ? round2(forexNet) : 0,
      note: forexNet >= 0 ? "Unrealised exchange gain" : "Unrealised exchange loss",
    });
  }

  return lines;
}

/** Totals for the journal card (should tie out: totalDebit === totalCredit). */
export function journalTotals(lines: FxJournalLine[]): { debit: number; credit: number } {
  return lines.reduce(
    (acc, l) => ({ debit: acc.debit + l.debit, credit: acc.credit + l.credit }),
    { debit: 0, credit: 0 },
  );
}

// ---------------------------------------------------------------------------
// Persistence — period-end rate overrides only.
// ---------------------------------------------------------------------------
export const FX_REVAL_KEY = "nexa-fx-reval";

/** Build a RateTable from edited rate rows. */
export function ratesFromRows(rows: RateRow[]): RateTable {
  const table = { ...PERIOD_END_RATES };
  for (const r of rows) table[r.currency] = r.periodEndInr;
  return table;
}

export function loadRateRows(): RateRow[] {
  const base = defaultRateRows();
  if (typeof window === "undefined") return base;
  try {
    const raw = localStorage.getItem(FX_REVAL_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as Partial<RateTable>;
      return base.map((r) =>
        typeof saved[r.currency] === "number"
          ? { ...r, periodEndInr: saved[r.currency] as number }
          : r,
      );
    }
  } catch {
    /* ignore */
  }
  return base;
}

export function saveRateRows(rows: RateRow[]): void {
  if (typeof window === "undefined") return;
  const table: Partial<RateTable> = {};
  for (const r of rows) table[r.currency] = r.periodEndInr;
  try {
    localStorage.setItem(FX_REVAL_KEY, JSON.stringify(table));
  } catch {
    /* ignore */
  }
}

// Whether FC revaluation is switched on for the period (defaults on).
export const FX_REVAL_ENABLED_KEY = "nexa-fx-reval-enabled";

export function loadRevalEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = localStorage.getItem(FX_REVAL_ENABLED_KEY);
    return raw === null ? true : raw === "true";
  } catch {
    return true;
  }
}

export function saveRevalEnabled(enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(FX_REVAL_ENABLED_KEY, String(enabled));
  } catch {
    /* ignore */
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Re-export so consumers can read currency metadata without a second import.
export { CURRENCIES };
