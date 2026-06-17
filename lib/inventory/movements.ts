import type { Movement, MovementType } from "./types";
import { ITEMS, itemById, bomFor } from "./items";

// ---------------------------------------------------------------------------
// Stock-movement ledger — single source of truth for on-hand quantities.
//
//   current stock(item, location) = Σ signed qty of its movements there
//
// Seed data covers opening balances + a slice of real history (goods receipts
// against vendor POs, production runs, dispatches, a transfer). Production runs
// triggered in the UI append more movements to localStorage.
// ---------------------------------------------------------------------------

// ---- opening balances: [itemId, locationId, qty] ----
const OPENING: [string, string, number][] = [
  // raw — at the plant
  ["rm-wheat", "loc-mys", 120000],
  ["rm-sunseed", "loc-mys", 40000],
  ["rm-paddy", "loc-mys", 90000],
  ["rm-durum", "loc-mys", 25000], // < reorder 30000 → low stock
  // packing — at the plant
  ["pm-bag50", "loc-mys", 3000],
  ["pm-bag25", "loc-mys", 5000],
  ["pm-bag10", "loc-mys", 4000],
  ["pm-tin15", "loc-mys", 2500], // < reorder 3000 → low stock
  ["pm-pouch1", "loc-mys", 20000],
  ["pm-carton", "loc-mys", 3000],
  ["pm-label", "loc-mys", 50000],
  // semi-finished — at the plant
  ["sfg-flour", "loc-mys", 30000],
  ["sfg-oil", "loc-mys", 8000],
  ["sfg-rice", "loc-mys", 20000],
  ["sfg-semolina", "loc-mys", 6000],
  // finished — plant + HQ + depots
  ["fg-flour50", "loc-mys", 400],
  ["fg-rice25", "loc-mys", 300],
  ["fg-oil15", "loc-mys", 350],
  ["fg-flour00", "loc-mys", 150], // < reorder 200 → low stock
  ["fg-semolina25", "loc-mys", 120],
  ["fg-atta10", "loc-mys", 800],
  ["fg-atta1", "loc-mys", 5000],
  ["fg-flour50", "loc-blr", 120],
  ["fg-atta10", "loc-blr", 300],
  ["fg-atta1", "loc-blr", 2000],
  ["fg-flour50", "loc-mum", 200],
  ["fg-rice25", "loc-mum", 150],
  ["fg-oil15", "loc-mum", 180],
  ["fg-atta1", "loc-mum", 3000],
  ["fg-flour50", "loc-del", 150],
  ["fg-rice25", "loc-del", 100],
  ["fg-atta10", "loc-del", 400],
  ["fg-rice25", "loc-sg", 50],
];

interface RawMove {
  date: string;
  itemId: string;
  loc: string;
  type: MovementType;
  qty: number; // signed (actual)
  std?: number; // signed standard, for production/consumption
  ref?: string;
  note?: string;
  by?: string;
  batch?: string; // lot / batch number
  expiry?: string; // ISO best-before / expiry date
}

// ---- recent history (signed quantities) ----
const HISTORY: RawMove[] = [
  // goods receipts against vendor POs (see lib/vendors.ts)
  { date: "2026-06-03", itemId: "rm-wheat", loc: "loc-mys", type: "receipt", qty: 50000, ref: "PO-2007", note: "Sterling Foods — June restock", by: "emp-023", batch: "WHT-2606" },
  { date: "2026-06-04", itemId: "pm-carton", loc: "loc-mys", type: "receipt", qty: 6000, ref: "PO-2008", note: "BlueOcean Packaging", by: "emp-021" },
  { date: "2026-06-04", itemId: "pm-label", loc: "loc-mys", type: "receipt", qty: 30000, ref: "PO-2008", note: "BlueOcean Packaging", by: "emp-021" },

  // production run — mill wheat into flour (PROD-3001): slight milling wastage
  { date: "2026-05-20", itemId: "rm-wheat", loc: "loc-mys", type: "consumption", qty: -21300, std: -21000, ref: "PROD-3001", note: "Milling → refined flour", by: "emp-020" },
  { date: "2026-05-20", itemId: "sfg-flour", loc: "loc-mys", type: "production", qty: 20000, std: 20000, ref: "PROD-3001", note: "Milling → refined flour", by: "emp-020", batch: "FLR-2605", expiry: "2026-11-16" },

  // production run — pack 50kg flour bags (PROD-3002): 5 bags rejected
  { date: "2026-05-22", itemId: "sfg-flour", loc: "loc-mys", type: "consumption", qty: -15000, std: -15000, ref: "PROD-3002", note: "Pack 50kg bags", by: "emp-020" },
  { date: "2026-05-22", itemId: "pm-bag50", loc: "loc-mys", type: "consumption", qty: -305, std: -300, ref: "PROD-3002", note: "Pack 50kg bags", by: "emp-020" },
  { date: "2026-05-22", itemId: "fg-flour50", loc: "loc-mys", type: "production", qty: 300, std: 300, ref: "PROD-3002", note: "Pack 50kg bags", by: "emp-020", batch: "FL50-2605", expiry: "2026-10-19" },

  // dispatches against sales invoices (see lib/invoicing.ts)
  { date: "2026-05-16", itemId: "fg-flour50", loc: "loc-blr", type: "sale", qty: -120, ref: "NXF/26-27/0101", note: "FreshMart Retail", by: "emp-010" },
  { date: "2026-05-16", itemId: "fg-oil15", loc: "loc-blr", type: "sale", qty: -80, ref: "NXF/26-27/0101", note: "FreshMart Retail", by: "emp-010" },
  { date: "2026-06-01", itemId: "fg-flour50", loc: "loc-mum", type: "sale", qty: -140, ref: "NXF/26-27/0102", note: "FreshMart Retail", by: "emp-010" },

  // inter-location transfer plant → Mumbai depot (TRF-9001)
  { date: "2026-05-28", itemId: "fg-flour50", loc: "loc-mys", type: "transfer-out", qty: -150, ref: "TRF-9001", note: "Replenish Mumbai depot", by: "emp-020" },
  { date: "2026-05-28", itemId: "fg-flour50", loc: "loc-mum", type: "transfer-in", qty: 150, ref: "TRF-9001", note: "From Mysuru plant", by: "emp-020" },

  // a stock-take adjustment
  { date: "2026-05-31", itemId: "sfg-oil", loc: "loc-mys", type: "adjustment", qty: -120, ref: "ADJ-501", note: "Stock-take variance", by: "emp-020" },

  // ---- Finished-goods build + dispatch (FY26-27) ----------------------------
  // Gives every finished SKU real production/receipt + sales so the cost-audit
  // product view, per-unit costs and the stock-movement table all tie to one
  // ledger (no synthetic weights). Dispatch volumes mirror the sales invoices.
  { date: "2026-05-10", itemId: "fg-flour50", loc: "loc-mys", type: "production", qty: 600, ref: "MFG-3101", note: "Pack 50kg flour", by: "emp-020", batch: "FL50-2605B", expiry: "2026-11-06" },
  { date: "2026-05-10", itemId: "fg-flour00", loc: "loc-mys", type: "production", qty: 200, ref: "MFG-3102", note: "Pack specialty 00 flour 25kg", by: "emp-020", batch: "F025-2605" },
  { date: "2026-05-10", itemId: "fg-atta10", loc: "loc-mys", type: "production", qty: 900, ref: "MFG-3103", note: "Pack atta 10kg", by: "emp-020", batch: "AT10-2605" },
  { date: "2026-05-10", itemId: "fg-semolina25", loc: "loc-mys", type: "production", qty: 60, ref: "MFG-3104", note: "Pack durum semolina 25kg", by: "emp-020" },
  { date: "2026-05-10", itemId: "fg-oil15", loc: "loc-mys", type: "production", qty: 250, ref: "MFG-3105", note: "Loan-licence oil fill — 15L tins", by: "emp-020" },
  { date: "2026-05-10", itemId: "fg-rice25", loc: "loc-mys", type: "receipt", qty: 100, ref: "GRN-3106", note: "Third-party rice 25kg — Annapurna", by: "emp-021" },

  { date: "2026-06-05", itemId: "fg-flour50", loc: "loc-mys", type: "sale", qty: -600, ref: "NXF/26-27/0110", note: "Wholesale dispatch — flour", by: "emp-010" },
  { date: "2026-06-05", itemId: "fg-oil15", loc: "loc-mys", type: "sale", qty: -255, ref: "NXF/26-27/0111", note: "Wholesale dispatch — oil", by: "emp-010" },
  { date: "2026-06-05", itemId: "fg-rice25", loc: "loc-mys", type: "sale", qty: -60, ref: "NXF/26-27/0112", note: "Wholesale dispatch — rice", by: "emp-010" },
  { date: "2026-06-05", itemId: "fg-flour00", loc: "loc-mys", type: "sale", qty: -216, ref: "NXT/26-27/0110", note: "Specialty dispatch — 00 flour", by: "emp-010" },
  { date: "2026-06-05", itemId: "fg-semolina25", loc: "loc-mys", type: "sale", qty: -47, ref: "NXT/26-27/0111", note: "Specialty dispatch — semolina", by: "emp-010" },
  { date: "2026-06-05", itemId: "fg-atta10", loc: "loc-mys", type: "sale", qty: -1100, ref: "NXF/26-27/0113", note: "Private-label dispatch — atta", by: "emp-010" },
];

export const SEED_MOVEMENTS: Movement[] = [
  ...OPENING.map(([itemId, locationId, qty], i) => ({
    id: `mv-open-${String(i + 1).padStart(3, "0")}`,
    date: "2026-04-01",
    itemId,
    locationId,
    type: "opening" as MovementType,
    qty,
    note: "Opening balance FY26-27",
  })),
  ...HISTORY.map((m, i) => ({
    id: `mv-hist-${String(i + 1).padStart(3, "0")}`,
    date: m.date,
    itemId: m.itemId,
    locationId: m.loc,
    type: m.type,
    qty: m.qty,
    stdQty: m.std,
    ref: m.ref,
    note: m.note,
    byId: m.by,
    batchNo: m.batch,
    expiry: m.expiry,
  })),
];

// ---------------------------------------------------------------------------
// Batch & expiry helpers
// ---------------------------------------------------------------------------
export interface BatchRow {
  itemId: string;
  locationId: string;
  batchNo: string;
  expiry?: string;
  qtyIn: number; // produced/received into this batch
}

/** Distinct batches (with expiry) seen in the movement ledger. */
export function batchRows(movements: Movement[]): BatchRow[] {
  const map = new Map<string, BatchRow>();
  for (const m of movements) {
    if (!m.batchNo || m.qty <= 0) continue;
    const k = `${m.itemId}|${m.locationId}|${m.batchNo}`;
    const existing = map.get(k);
    if (existing) existing.qtyIn += m.qty;
    else map.set(k, { itemId: m.itemId, locationId: m.locationId, batchNo: m.batchNo, expiry: m.expiry, qtyIn: m.qty });
  }
  return [...map.values()];
}

/** Days until expiry relative to `today` (ISO); negative = already expired. */
export function daysToExpiry(expiry: string, today: string): number {
  const ms = new Date(expiry).getTime() - new Date(today).getTime();
  return Math.round(ms / 86400000);
}

export const MOVEMENT_META: Record<MovementType, { label: string; variant: "default" | "primary" | "success" | "warning" | "danger" }> = {
  opening: { label: "Opening", variant: "default" },
  receipt: { label: "Receipt", variant: "success" },
  production: { label: "Production", variant: "success" },
  consumption: { label: "Consumption", variant: "warning" },
  "transfer-in": { label: "Transfer in", variant: "primary" },
  "transfer-out": { label: "Transfer out", variant: "primary" },
  sale: { label: "Sale / dispatch", variant: "danger" },
  adjustment: { label: "Adjustment", variant: "warning" },
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
export const MOVEMENTS_KEY = "nexa-inv-movements";

export function loadAddedMovements(): Movement[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(MOVEMENTS_KEY);
    if (raw) return JSON.parse(raw) as Movement[];
  } catch {
    /* ignore */
  }
  return [];
}
export function saveAddedMovements(m: Movement[]) {
  try {
    localStorage.setItem(MOVEMENTS_KEY, JSON.stringify(m));
  } catch {
    /* ignore */
  }
}

export function allMovements(added: Movement[]): Movement[] {
  return [...SEED_MOVEMENTS, ...added];
}

// ---------------------------------------------------------------------------
// Stock computation
// ---------------------------------------------------------------------------
const key = (itemId: string, locationId: string) => `${itemId}|${locationId}`;

export type StockIndex = Map<string, number>;

/** Aggregate signed movements into on-hand qty keyed by item|location. */
export function buildStockIndex(movements: Movement[]): StockIndex {
  const idx: StockIndex = new Map();
  for (const m of movements) {
    idx.set(key(m.itemId, m.locationId), (idx.get(key(m.itemId, m.locationId)) ?? 0) + m.qty);
  }
  return idx;
}

export function stockAt(idx: StockIndex, itemId: string, locationId: string): number {
  return idx.get(key(itemId, locationId)) ?? 0;
}

export function stockTotal(idx: StockIndex, itemId: string): number {
  let total = 0;
  for (const [k, v] of idx) {
    if (k.startsWith(`${itemId}|`)) total += v;
  }
  return total;
}

/** Locations (with qty) where an item currently has stock. */
export function stockLocations(idx: StockIndex, itemId: string): { locationId: string; qty: number }[] {
  const out: { locationId: string; qty: number }[] = [];
  for (const [k, v] of idx) {
    const [id, loc] = k.split("|");
    if (id === itemId && v !== 0) out.push({ locationId: loc, qty: v });
  }
  return out;
}

export interface CategoryValue {
  qtyValue: number; // ₹ value of stock in this category
  lowCount: number;
}

/** Total stock value (base INR) across all items. */
export function totalStockValue(idx: StockIndex): number {
  let total = 0;
  for (const it of ITEMS) total += stockTotal(idx, it.id) * it.rate;
  return total;
}

/** Items below their reorder level (group-wide on-hand). */
export function lowStockItems(idx: StockIndex) {
  return ITEMS.map((it) => ({ item: it, onHand: stockTotal(idx, it.id) }))
    .filter((x) => x.onHand < x.item.reorderLevel)
    .sort((a, b) => a.onHand / a.item.reorderLevel - b.onHand / b.item.reorderLevel);
}

// ---------------------------------------------------------------------------
// Production engine — post a run as consumption + output movements.
// ---------------------------------------------------------------------------
export interface ShortfallLine {
  itemId: string;
  required: number;
  available: number;
}

/** Components short for producing `qty` of `outputId` at `locationId`. */
export function productionShortfalls(
  idx: StockIndex,
  outputId: string,
  qty: number,
  locationId: string,
): ShortfallLine[] {
  const out: ShortfallLine[] = [];
  for (const c of bomFor(outputId)) {
    const required = c.qtyPerUnit * qty;
    const available = stockAt(idx, c.itemId, locationId);
    if (available < required) out.push({ itemId: c.itemId, required, available });
  }
  return out;
}

export interface ProductionInput {
  outputId: string;
  plannedQty: number; // target output
  actualQty: number; // actual output produced
  components: { itemId: string; actualQty: number }[]; // actual consumed (positive magnitudes)
  locationId: string;
  ref: string;
  byId: string;
  date?: string;
}

/** Build production movements with standard (BOM) + actual quantities. */
export function buildProductionMovements(input: ProductionInput): Movement[] {
  const { outputId, plannedQty, actualQty, components, locationId, ref, byId, date = "2026-06-05" } = input;
  const moves: Movement[] = [];
  const note = `Produce ${actualQty} × ${itemById(outputId)?.name ?? outputId}`;
  const bom = bomFor(outputId);
  components.forEach((c, i) => {
    const std = bom.find((b) => b.itemId === c.itemId)?.qtyPerUnit ?? 0;
    moves.push({
      id: `${ref}-c${i}`,
      date,
      itemId: c.itemId,
      locationId,
      type: "consumption",
      qty: -Math.abs(c.actualQty),
      stdQty: -(std * plannedQty),
      ref,
      note,
      byId,
    });
  });
  moves.push({
    id: `${ref}-out`,
    date,
    itemId: outputId,
    locationId,
    type: "production",
    qty: actualQty,
    stdQty: plannedQty,
    ref,
    note,
    byId,
  });
  return moves;
}

// ---------------------------------------------------------------------------
// Standard vs actual variance — computed from the ledger for a production run.
// ---------------------------------------------------------------------------
export interface ComponentVariance {
  itemId: string;
  stdQty: number; // magnitude
  actualQty: number; // magnitude
  qtyVar: number; // actual − std (positive = unfavourable, more consumed)
  costVar: number; // qtyVar × rate (base INR)
}

export interface RunVariance {
  ref: string;
  date: string;
  outputId: string;
  locationId: string;
  byId?: string;
  plannedQty: number;
  actualQty: number;
  yieldVar: number; // actual − planned output
  components: ComponentVariance[];
  stdCost: number; // standard input cost
  actualCost: number; // actual input cost
  costVar: number; // actual − std (positive = unfavourable)
}

/** Reconstruct a run's std-vs-actual variance from its movements. */
export function runVariance(movements: Movement[], ref: string): RunVariance | null {
  const lines = movements.filter((m) => m.ref === ref);
  const out = lines.find((m) => m.type === "production");
  if (!out) return null;
  const components: ComponentVariance[] = lines
    .filter((m) => m.type === "consumption")
    .map((m) => {
      const rate = itemById(m.itemId)?.rate ?? 0;
      const actualQty = Math.abs(m.qty);
      const stdQty = Math.abs(m.stdQty ?? m.qty);
      const qtyVar = actualQty - stdQty;
      return { itemId: m.itemId, stdQty, actualQty, qtyVar, costVar: qtyVar * rate };
    });
  const stdCost = components.reduce((s, c) => s + c.stdQty * (itemById(c.itemId)?.rate ?? 0), 0);
  const actualCost = components.reduce((s, c) => s + c.actualQty * (itemById(c.itemId)?.rate ?? 0), 0);
  const planned = out.stdQty ?? out.qty;
  return {
    ref,
    date: out.date,
    outputId: out.itemId,
    locationId: out.locationId,
    byId: out.byId,
    plannedQty: planned,
    actualQty: out.qty,
    yieldVar: out.qty - planned,
    components,
    stdCost,
    actualCost,
    costVar: actualCost - stdCost,
  };
}

/** All production runs (seed + added) as variances, newest ref first. */
export function allRunVariances(movements: Movement[]): RunVariance[] {
  const refs = Array.from(
    new Set(movements.filter((m) => m.ref?.startsWith("PROD-")).map((m) => m.ref as string)),
  );
  return refs
    .map((r) => runVariance(movements, r))
    .filter((v): v is RunVariance => v !== null)
    .sort((a, b) => b.ref.localeCompare(a.ref));
}

// ---------------------------------------------------------------------------
// Sales integration — dispatch finished goods when an invoice is saved.
// ---------------------------------------------------------------------------
/** Build sale (dispatch) movements for catalogue-linked invoice lines. */
export function buildSaleMovements(
  items: { itemId: string; qty: number }[],
  locationId: string,
  ref: string,
  byId: string,
  note: string,
  date = "2026-06-05",
): Movement[] {
  return items
    .filter((l) => l.itemId && l.qty > 0 && itemById(l.itemId))
    .map((l, i) => ({
      id: `${ref}-s${i}`,
      date,
      itemId: l.itemId,
      locationId,
      type: "sale" as MovementType,
      qty: -Math.abs(l.qty),
      ref,
      note,
      byId,
    }));
}

/** Append movements to the persisted store (load → concat → save). Returns the merged added list. */
export function appendMovements(extra: Movement[]): Movement[] {
  const next = [...loadAddedMovements(), ...extra];
  saveAddedMovements(next);
  return next;
}

/** Next PROD reference, counting seed + added production movements. */
export function nextProductionRef(added: Movement[]): string {
  const refs = [...SEED_MOVEMENTS, ...added]
    .map((m) => m.ref)
    .filter((r): r is string => !!r && r.startsWith("PROD-"));
  let max = 3000;
  for (const r of refs) {
    const n = parseInt(r.replace("PROD-", ""), 10);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return `PROD-${max + 1}`;
}
