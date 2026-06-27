// ---------------------------------------------------------------------------
// Inventory costing — FIFO lot register, WACOG, stock ageing, DIO
// ---------------------------------------------------------------------------

import type { Movement } from "./types";
import { ITEMS, itemById } from "./items";
import type { GoodsReceiptNote } from "./supply-chain";

const TODAY = "2026-06-26";
const TODAY_MS = new Date(TODAY).getTime();
const PERIOD_START = "2026-04-01";
export const PERIOD_DAYS = Math.round(
  (TODAY_MS - new Date(PERIOD_START).getTime()) / 86400000,
); // ~86 days FY26-27 so far

// ---------------------------------------------------------------------------
// Seed unit prices — realistic deviations from standard rate for demo data.
// Keyed as "ref|itemId" for receipts or "opening|itemId" for opening lots.
// ---------------------------------------------------------------------------
const SEED_PRICES: Record<string, number> = {
  "PO-2007|rm-wheat":   30.5,  // std ₹32  — favorable (bought below standard)
  "PO-2008|pm-carton":  44.0,  // std ₹42  — adverse (market price rose)
  "PO-2008|pm-label":    4.2,  // std ₹4   — adverse (minor rise)
  "opening|rm-sunseed": 77.0,  // std ₹75  — adverse (import cost higher)
  "opening|rm-paddy":   38.5,  // std ₹40  — favorable
  "opening|rm-durum":   36.5,  // std ₹38  — favorable
  "opening|pm-tin15":   98.0,  // std ₹95  — adverse (steel cost up)
  "opening|sfg-oil":   168.0,  // std ₹165 — adverse
};

// ---------------------------------------------------------------------------
// Lot — a single inflow entry in the cost ledger
// ---------------------------------------------------------------------------
export interface Lot {
  id: string;
  itemId: string;
  date: string;
  qty: number;       // original quantity
  remaining: number; // after FIFO depletion
  unitCost: number;  // actual cost per unit (₹)
  source: "opening" | "receipt" | "production";
  ref?: string;
}

/**
 * Build the lot register from all stock movements.
 * Receipt unit costs come from (in priority):
 *   1. Unit prices on GRN lines (user-entered)
 *   2. SEED_PRICES map (hardcoded demo variances)
 *   3. item.rate (standard cost fallback)
 */
export function buildLotRegister(
  movements: Movement[],
  grns: GoodsReceiptNote[],
): Lot[] {
  // Build GRN unit-price lookup: "ref|itemId" and "poRef|itemId"
  const grnPrices = new Map<string, number>();
  for (const grn of grns) {
    for (const line of grn.lines) {
      if (line.unitPrice && line.unitPrice > 0) {
        grnPrices.set(`${grn.ref}|${line.itemId}`, line.unitPrice);
        if (grn.poRef) grnPrices.set(`${grn.poRef}|${line.itemId}`, line.unitPrice);
      }
    }
  }

  const lots: Lot[] = [];

  for (const m of movements) {
    if (m.qty <= 0) continue;
    if (
      !["opening", "receipt", "production", "transfer-in", "adjustment"].includes(m.type)
    )
      continue;

    const item = itemById(m.itemId);
    const stdCost = item?.rate ?? 0;
    const isOpening = m.type === "opening";

    const seedKey = isOpening ? `opening|${m.itemId}` : m.ref ? `${m.ref}|${m.itemId}` : null;
    const grnKey = m.ref ? `${m.ref}|${m.itemId}` : null;

    const unitCost =
      (grnKey && grnPrices.get(grnKey)) ||
      (seedKey && SEED_PRICES[seedKey]) ||
      stdCost;

    lots.push({
      id: m.id,
      itemId: m.itemId,
      date: m.date,
      qty: m.qty,
      remaining: m.qty,
      unitCost,
      source: isOpening
        ? "opening"
        : m.type === "production"
        ? "production"
        : "receipt",
      ref: m.ref,
    });
  }

  // Sort by item then by date ascending (oldest lot first — FIFO order)
  lots.sort(
    (a, b) =>
      a.itemId.localeCompare(b.itemId) || a.date.localeCompare(b.date),
  );

  // Deplete lots FIFO using outflows
  const outflows = movements
    .filter((m) => m.qty < 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  for (const out of outflows) {
    let toConsume = Math.abs(out.qty);
    for (const lot of lots) {
      if (lot.itemId !== out.itemId) continue;
      if (lot.remaining <= 0) continue;
      const take = Math.min(lot.remaining, toConsume);
      lot.remaining -= take;
      toConsume -= take;
      if (toConsume <= 0) break;
    }
  }

  return lots;
}

// ---------------------------------------------------------------------------
// WACOG — weighted average cost of goods on hand
// ---------------------------------------------------------------------------
export interface ItemWACOG {
  itemId: string;
  stdRate: number;
  wacog: number;
  variance: number;       // wacog − stdRate  (+ = costlier than standard)
  variancePct: number;    // variance as % of std
  onHand: number;
  valueAtWacog: number;   // current stock value at WACOG
  valueAtStd: number;     // current stock value at standard rate
  totalVariance: number;  // (wacog − std) × onHand
}

export function computeWACOG(lots: Lot[]): Map<string, ItemWACOG> {
  const result = new Map<string, ItemWACOG>();
  for (const item of ITEMS) {
    const itemLots = lots.filter((l) => l.itemId === item.id && l.remaining > 0);
    const onHand = itemLots.reduce((s, l) => s + l.remaining, 0);
    const totalValue = itemLots.reduce((s, l) => s + l.remaining * l.unitCost, 0);
    const wacog = onHand > 0 ? totalValue / onHand : item.rate;
    const variance = wacog - item.rate;
    const variancePct = item.rate > 0 ? (variance / item.rate) * 100 : 0;
    result.set(item.id, {
      itemId: item.id,
      stdRate: item.rate,
      wacog,
      variance,
      variancePct,
      onHand,
      valueAtWacog: totalValue,
      valueAtStd: onHand * item.rate,
      totalVariance: variance * onHand,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Stock ageing — buckets remaining lots by days since receipt
// ---------------------------------------------------------------------------
export type AgeBand = "fresh" | "normal" | "slow" | "excess";

export interface AgeingBucket {
  band: AgeBand;
  label: string;
  qty: number;
  value: number;
}

export interface ItemAgeing {
  itemId: string;
  buckets: AgeingBucket[];
  oldestDays: number;
  onHand: number;
  totalValue: number;
  riskBand: AgeBand; // highest-age band that has any qty
}

const BANDS: Array<{ band: AgeBand; label: string; maxDays: number }> = [
  { band: "fresh",  label: "0–30 d",   maxDays: 30       },
  { band: "normal", label: "31–90 d",  maxDays: 90       },
  { band: "slow",   label: "91–180 d", maxDays: 180      },
  { band: "excess", label: "> 180 d",  maxDays: Infinity },
];

export function computeStockAgeing(lots: Lot[]): Map<string, ItemAgeing> {
  const result = new Map<string, ItemAgeing>();
  for (const item of ITEMS) {
    const itemLots = lots.filter((l) => l.itemId === item.id && l.remaining > 0);
    const buckets: AgeingBucket[] = BANDS.map((b) => ({
      band: b.band,
      label: b.label,
      qty: 0,
      value: 0,
    }));
    let oldestDays = 0;
    for (const lot of itemLots) {
      const ageDays = Math.round(
        (TODAY_MS - new Date(lot.date).getTime()) / 86400000,
      );
      if (ageDays > oldestDays) oldestDays = ageDays;
      const bi = BANDS.findIndex((b) => ageDays <= b.maxDays);
      const bucket = buckets[bi === -1 ? buckets.length - 1 : bi];
      bucket.qty += lot.remaining;
      bucket.value += lot.remaining * lot.unitCost;
    }
    const onHand = buckets.reduce((s, b) => s + b.qty, 0);
    const totalValue = buckets.reduce((s, b) => s + b.value, 0);
    const riskBand =
      ([...buckets].reverse().find((b) => b.qty > 0)?.band ?? "fresh") as AgeBand;
    result.set(item.id, {
      itemId: item.id,
      buckets,
      oldestDays,
      onHand,
      totalValue,
      riskBand,
    });
  }
  return result;
}

// ---------------------------------------------------------------------------
// Days Inventory Outstanding (DIO)
//   DIO = stock value at WACOG ÷ daily COGS
//   COGS = (consumption + sale outflows) valued at WACOG over the period
// ---------------------------------------------------------------------------
export interface DIOResult {
  dio: number;
  stockValue: number;
  dailyCOGS: number;
  periodDays: number;
  totalCOGS: number;
}

export function computeDIO(
  movements: Movement[],
  wacog: Map<string, ItemWACOG>,
): DIOResult {
  let totalCOGS = 0;
  for (const m of movements) {
    if (m.qty >= 0) continue;
    if (!["consumption", "sale"].includes(m.type)) continue;
    const cost = wacog.get(m.itemId)?.wacog ?? itemById(m.itemId)?.rate ?? 0;
    totalCOGS += Math.abs(m.qty) * cost;
  }
  const dailyCOGS = PERIOD_DAYS > 0 ? totalCOGS / PERIOD_DAYS : 0;
  const stockValue = Array.from(wacog.values()).reduce(
    (s, w) => s + w.valueAtWacog,
    0,
  );
  const dio = dailyCOGS > 0 ? Math.round(stockValue / dailyCOGS) : 0;
  return { dio, stockValue, dailyCOGS, periodDays: PERIOD_DAYS, totalCOGS };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
export const AGE_BAND_META: Record<
  AgeBand,
  { color: string; bgColor: string; label: string }
> = {
  fresh:  { color: "text-success",  bgColor: "bg-success/10",  label: "Fresh"  },
  normal: { color: "text-primary",  bgColor: "bg-primary/10",  label: "Normal" },
  slow:   { color: "text-warning",  bgColor: "bg-warning/10",  label: "Slow"   },
  excess: { color: "text-danger",   bgColor: "bg-danger/10",   label: "Excess" },
};
