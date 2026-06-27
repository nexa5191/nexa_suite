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

export const SEED_MOVEMENTS: Movement[] = [];

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
