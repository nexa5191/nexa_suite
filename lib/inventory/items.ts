import type { Item, ItemCategory, BomComponent, Uom, OwnershipModel } from "./types";

// ---------------------------------------------------------------------------
// Item master + bill of materials.
// ---------------------------------------------------------------------------

export const CATEGORY_META: Record<
  ItemCategory,
  { label: string; short: string; variant: "default" | "primary" | "warning" | "success"; order: number }
> = {
  raw: { label: "Raw Materials", short: "RM", variant: "default", order: 0 },
  packing: { label: "Packing Materials", short: "PM", variant: "primary", order: 1 },
  "semi-finished": { label: "Semi-finished (WIP)", short: "SFG", variant: "warning", order: 2 },
  finished: { label: "Finished Goods", short: "FG", variant: "success", order: 3 },
};

export const CATEGORY_ORDER: ItemCategory[] = ["raw", "packing", "semi-finished", "finished"];

export function uomLabel(uom: Uom) {
  return uom; // kg / L / pcs render as-is
}

// Plant is the primary manufacturing/storage site.
const PLANT = "";

function readLS<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fb; } catch { return fb; }
}
export const ITEMS: Item[] = readLS<Item[]>("nexa-items", []);

// ---- Ownership / sourcing model metadata --------------------------------
export const OWNERSHIP_META: Record<
  OwnershipModel,
  { label: string; short: string; variant: "default" | "primary" | "warning" | "success"; account: string }
> = {
  own: { label: "Own manufacturing", short: "Own", variant: "success", account: "5010" },
  "loan-license": { label: "Loan licence", short: "Loan Lic.", variant: "warning", account: "5040" },
  "third-party": { label: "Third-party", short: "3rd-party", variant: "primary", account: "5050" },
};

export function ownershipOf(itemId: string): OwnershipModel {
  return itemById(itemId)?.ownership ?? "own";
}

// ---- Bill of materials: output item → components consumed per unit ----
export const BOM: Record<string, BomComponent[]> = readLS<Record<string, BomComponent[]>>("nexa-bom", {});

// ---------------------------------------------------------------------------
// Alternative unit of measure (Case / pack) — base unit is `item.uom`; the
// alternative unit holds `pack` base units. Seeded on some items and addable
// later via a localStorage override (so a buyer can define a case any time).
// ---------------------------------------------------------------------------
export interface AltUom {
  unit: string; // label, e.g. "case", "bag", "carton"
  pack: number; // base units per alternative unit
}

const UOM_KEY = "nexa-uom-overrides";

/** Per-item alt-UoM overrides. `null` explicitly clears a seeded pack. */
export function loadUomOverrides(): Record<string, AltUom | null> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(UOM_KEY);
    if (raw) return JSON.parse(raw) as Record<string, AltUom | null>;
  } catch {
    /* ignore */
  }
  return {};
}
export function saveUomOverrides(o: Record<string, AltUom | null>) {
  try {
    localStorage.setItem(UOM_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

/** Effective alt UoM for an item: an override wins over the seeded pack. */
export function altUomOf(item: Item, overrides?: Record<string, AltUom | null>): AltUom | null {
  if (overrides && item.id in overrides) return overrides[item.id]; // may be null = cleared
  return item.altUom && item.altPack ? { unit: item.altUom, pack: item.altPack } : null;
}

/** Convert a quantity entered in the chosen basis to base units. */
export function toBaseQty(qty: number, basis: "base" | "alt", alt: AltUom | null): number {
  return basis === "alt" && alt ? qty * alt.pack : qty;
}

/** "12 pcs / case" style descriptor for an alt UoM. */
export function packLabel(item: Item, alt: AltUom | null): string {
  return alt ? `${alt.pack} ${item.uom} / ${alt.unit}` : "";
}

// ---- lookups ----
export function itemById(id: string) {
  return ITEMS.find((i) => i.id === id);
}
/** Match a free-text invoice line to a finished-good SKU by name (case-insensitive). */
export function finishedItemByName(name: string) {
  const n = name.trim().toLowerCase();
  if (!n) return undefined;
  return ITEMS.find((i) => i.category === "finished" && i.name.toLowerCase() === n);
}
export const FINISHED_ITEMS = ITEMS.filter((i) => i.category === "finished");
export function itemName(id: string) {
  return itemById(id)?.name ?? "—";
}
export function itemsByCategory(category: ItemCategory) {
  return ITEMS.filter((i) => i.category === category);
}
export function bomFor(itemId: string): BomComponent[] {
  return BOM[itemId] ?? [];
}
export function hasBom(itemId: string) {
  return (BOM[itemId]?.length ?? 0) > 0;
}
/** Items that can be produced (have a BOM) — SFG and FG. */
export function producibleItems() {
  return ITEMS.filter((i) => hasBom(i.id));
}
/**
 * Demand-driven reorder level:
 *   ROL = avgDailyDemand × (leadTimeDays + safetyDays)
 *
 * Falls back to the static `item.reorderLevel` when demand or lead time are unknown.
 * `avgDailyDemand` is passed in from the movement ledger (sales history).
 */
export function dynamicReorderLevel(
  item: Item,
  avgDailyDemand: number,
): number {
  if (!item.leadTimeDays || avgDailyDemand <= 0) return item.reorderLevel;
  const cover = item.leadTimeDays + (item.safetyDays ?? 0);
  return Math.ceil(avgDailyDemand * cover);
}

/** Standard input cost to make one unit, from its BOM (one level deep). */
export function bomUnitCost(itemId: string): number {
  return bomFor(itemId).reduce((s, c) => s + (itemById(c.itemId)?.rate ?? 0) * c.qtyPerUnit, 0);
}

export interface ExplodedComponent {
  itemId: string;
  qty: number; // total leaf qty for the requested output qty
  cost: number; // qty × rate
}

/**
 * Fully explode a BOM down to leaf items (raw + packing), expanding any
 * semi-finished components recursively. Returns aggregated leaf requirements.
 */
export function explodeBom(itemId: string, qty = 1): ExplodedComponent[] {
  const acc = new Map<string, number>();
  const walk = (id: string, mult: number) => {
    const components = bomFor(id);
    if (components.length === 0) {
      acc.set(id, (acc.get(id) ?? 0) + mult);
      return;
    }
    for (const c of components) walk(c.itemId, mult * c.qtyPerUnit);
  };
  walk(itemId, qty);
  return [...acc.entries()].map(([id, q]) => ({
    itemId: id,
    qty: q,
    cost: q * (itemById(id)?.rate ?? 0),
  }));
}

/** Fully-exploded standard cost (down to raw + packing) to make one unit. */
export function explodedUnitCost(itemId: string): number {
  return explodeBom(itemId, 1).reduce((s, c) => s + c.cost, 0);
}

/** Exploded cost of one unit restricted to a leaf category (raw or packing). */
function leafCostByCategory(itemId: string, category: ItemCategory): number {
  return explodeBom(itemId, 1)
    .filter((c) => itemById(c.itemId)?.category === category)
    .reduce((s, c) => s + c.cost, 0);
}
export const materialUnitCost = (itemId: string) => leafCostByCategory(itemId, "raw");
export const packingUnitCost = (itemId: string) => leafCostByCategory(itemId, "packing");

/** Recursive conversion / job-work cost per unit (own + loan-licence stages). */
export function conversionUnitCost(itemId: string, qty = 1): number {
  const it = itemById(itemId);
  if (!it) return 0;
  let c = (it.conversionRate ?? 0) * qty;
  for (const comp of bomFor(itemId)) c += conversionUnitCost(comp.itemId, qty * comp.qtyPerUnit);
  return c;
}

/**
 * Standard per-unit works cost of a finished good, split for the cost sheet.
 * Third-party goods are bought finished, so their works cost is the buy rate.
 */
export interface UnitWorksCost {
  ownership: OwnershipModel;
  material: number;
  packing: number;
  conversion: number; // own conversion + loan-licence job-work
  thirdParty: number; // landed purchase for bought-in goods
  works: number; // sum of the above
}
export function unitWorksCost(itemId: string): UnitWorksCost {
  const ownership = ownershipOf(itemId);
  if (ownership === "third-party") {
    const buy = itemById(itemId)?.buyRate ?? explodedUnitCost(itemId);
    return { ownership, material: 0, packing: 0, conversion: 0, thirdParty: buy, works: buy };
  }
  const material = materialUnitCost(itemId);
  const packing = packingUnitCost(itemId);
  const conversion = conversionUnitCost(itemId);
  return { ownership, material, packing, conversion, thirdParty: 0, works: material + packing + conversion };
}
