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

// Plant is the manufacturing site; depots hold finished goods for dispatch.
const PLANT = "loc-mys"; // Mysuru Plant

export const ITEMS: Item[] = [
  // ---- Raw materials ----
  { id: "rm-wheat",   code: "RM-WHT", name: "Wheat grain",        category: "raw",    uom: "kg",  rate: 32,  hsn: "1001", reorderLevel: 80000, primaryLocationId: PLANT, altUom: "bag", altPack: 50, leadTimeDays: 7,  safetyDays: 5  },
  { id: "rm-sunseed", code: "RM-SUN", name: "Sunflower seed",     category: "raw",    uom: "kg",  rate: 75,  hsn: "1206", reorderLevel: 35000, primaryLocationId: PLANT,                              leadTimeDays: 10, safetyDays: 7  },
  { id: "rm-paddy",   code: "RM-PDY", name: "Basmati paddy",      category: "raw",    uom: "kg",  rate: 40,  hsn: "1006", reorderLevel: 60000, primaryLocationId: PLANT,                              leadTimeDays: 14, safetyDays: 7  },
  { id: "rm-durum",   code: "RM-DUR", name: "Durum wheat",        category: "raw",    uom: "kg",  rate: 38,  hsn: "1001", reorderLevel: 30000, primaryLocationId: PLANT,                              leadTimeDays: 10, safetyDays: 5  },

  // ---- Packing materials ----
  { id: "pm-bag50",  code: "PM-B50", name: "Woven bag — 50kg",       category: "packing", uom: "pcs", rate: 35, hsn: "6305", reorderLevel: 1500,  primaryLocationId: PLANT,                              leadTimeDays: 5,  safetyDays: 3  },
  { id: "pm-bag25",  code: "PM-B25", name: "Woven bag — 25kg",       category: "packing", uom: "pcs", rate: 22, hsn: "6305", reorderLevel: 2000,  primaryLocationId: PLANT,                              leadTimeDays: 5,  safetyDays: 3  },
  { id: "pm-bag10",  code: "PM-B10", name: "Woven bag — 10kg",       category: "packing", uom: "pcs", rate: 14, hsn: "6305", reorderLevel: 2000,  primaryLocationId: PLANT,                              leadTimeDays: 5,  safetyDays: 3  },
  { id: "pm-tin15",  code: "PM-T15", name: "Oil tin — 15L",          category: "packing", uom: "pcs", rate: 95, hsn: "7310", reorderLevel: 3000,  primaryLocationId: PLANT,                              leadTimeDays: 14, safetyDays: 7  },
  { id: "pm-pouch1", code: "PM-P01", name: "Laminated pouch — 1kg",  category: "packing", uom: "pcs", rate: 6,  hsn: "3923", reorderLevel: 15000, primaryLocationId: PLANT, altUom: "case",   altPack: 1000, leadTimeDays: 7,  safetyDays: 5  },
  { id: "pm-carton", code: "PM-CTN", name: "Carton box (12s)",       category: "packing", uom: "pcs", rate: 42, hsn: "4819", reorderLevel: 2000,  primaryLocationId: PLANT, altUom: "bundle", altPack: 25,   leadTimeDays: 5,  safetyDays: 3  },
  { id: "pm-label",  code: "PM-LBL", name: "Barcode label",          category: "packing", uom: "pcs", rate: 4,  hsn: "4821", reorderLevel: 20000, primaryLocationId: PLANT, altUom: "roll",   altPack: 1000, leadTimeDays: 3,  safetyDays: 2  },

  // ---- Semi-finished (WIP) ----
  { id: "sfg-flour",    code: "SF-FLR", name: "Refined wheat flour (bulk)",   category: "semi-finished", uom: "kg", rate: 36,  hsn: "1101", reorderLevel: 15000, primaryLocationId: PLANT, shelfLifeDays: 180, ownership: "own",         conversionRate: 2,  leadTimeDays: 2,  safetyDays: 2  },
  { id: "sfg-oil",      code: "SF-OIL", name: "Refined sunflower oil (bulk)", category: "semi-finished", uom: "L",  rate: 165, hsn: "1512", reorderLevel: 5000,  primaryLocationId: PLANT, shelfLifeDays: 365, ownership: "loan-license", conversionRate: 9,  leadTimeDays: 7,  safetyDays: 5,  manufacturer: "Sunraj Oil Mills (Loan Licence)" },
  { id: "sfg-rice",     code: "SF-RCE", name: "Milled basmati rice (bulk)",   category: "semi-finished", uom: "kg", rate: 95,  hsn: "1006", reorderLevel: 12000, primaryLocationId: PLANT, shelfLifeDays: 540, ownership: "third-party",  buyRate: 92,        leadTimeDays: 10, safetyDays: 7,  manufacturer: "Annapurna Rice Industries" },
  { id: "sfg-semolina", code: "SF-SEM", name: "Durum semolina (bulk)",        category: "semi-finished", uom: "kg", rate: 40,  hsn: "1103", reorderLevel: 5000,  primaryLocationId: PLANT, shelfLifeDays: 180, ownership: "own",         conversionRate: 2.5, leadTimeDays: 2,  safetyDays: 2  },

  // ---- Finished goods (packed SKUs — match the invoicing catalogue) ----
  { id: "fg-flour50",   code: "FG-FL50", name: "Wheat flour (50kg bag)",   category: "finished", uom: "pcs", rate: 1850, hsn: "1101", reorderLevel: 300,  primaryLocationId: PLANT, shelfLifeDays: 150, ownership: "own",         conversionRate: 15, altUom: "pallet", altPack: 20, leadTimeDays: 3,  safetyDays: 3  },
  { id: "fg-rice25",    code: "FG-RC25", name: "Basmati rice (25kg)",      category: "finished", uom: "pcs", rate: 2400, hsn: "1006", reorderLevel: 200,  primaryLocationId: PLANT, shelfLifeDays: 540, ownership: "third-party",  buyRate: 2280,      altUom: "pallet", altPack: 10, leadTimeDays: 10, safetyDays: 5,  manufacturer: "Annapurna Rice Industries" },
  { id: "fg-oil15",     code: "FG-OL15", name: "Sunflower oil (15L tin)", category: "finished", uom: "pcs", rate: 1650, hsn: "1512", reorderLevel: 250,  primaryLocationId: PLANT, shelfLifeDays: 365, ownership: "loan-license", conversionRate: 25, altUom: "case",   altPack: 4,  leadTimeDays: 7,  safetyDays: 5,  manufacturer: "Sunraj Oil Mills (Loan Licence)" },
  { id: "fg-flour00",   code: "FG-F025", name: "Specialty 00 flour (25kg)", category: "finished", uom: "pcs", rate: 2200, hsn: "1101", reorderLevel: 200,  primaryLocationId: PLANT, shelfLifeDays: 150, ownership: "own",         conversionRate: 14,                              leadTimeDays: 3,  safetyDays: 3  },
  { id: "fg-semolina25",code: "FG-SM25", name: "Durum semolina (25kg)",   category: "finished", uom: "pcs", rate: 1900, hsn: "1103", reorderLevel: 120,  primaryLocationId: PLANT, shelfLifeDays: 150, ownership: "own",         conversionRate: 12,                              leadTimeDays: 3,  safetyDays: 3  },
  { id: "fg-atta10",    code: "FG-AT10", name: "Atta (10kg)",             category: "finished", uom: "pcs", rate: 360,  hsn: "1101", reorderLevel: 600,  primaryLocationId: PLANT, shelfLifeDays: 120, ownership: "own",         conversionRate: 5,                               leadTimeDays: 2,  safetyDays: 3  },
  { id: "fg-atta1",     code: "FG-AT01", name: "Atta pouch (1kg)",        category: "finished", uom: "pcs", rate: 48,   hsn: "1101", reorderLevel: 5000, primaryLocationId: PLANT, shelfLifeDays: 120, ownership: "own",         conversionRate: 1.5, altUom: "case", altPack: 12, leadTimeDays: 2,  safetyDays: 3  },
];

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
// Component qty includes process loss (e.g. milling), so it can exceed output.
export const BOM: Record<string, BomComponent[]> = {
  // semi-finished from raw
  "sfg-flour": [{ itemId: "rm-wheat", qtyPerUnit: 1.05 }],
  "sfg-oil": [{ itemId: "rm-sunseed", qtyPerUnit: 2.2 }],
  "sfg-rice": [{ itemId: "rm-paddy", qtyPerUnit: 1.45 }],
  "sfg-semolina": [{ itemId: "rm-durum", qtyPerUnit: 1.08 }],

  // finished from semi-finished + packing
  "fg-flour50": [{ itemId: "sfg-flour", qtyPerUnit: 50 }, { itemId: "pm-bag50", qtyPerUnit: 1 }],
  "fg-rice25": [{ itemId: "sfg-rice", qtyPerUnit: 25 }, { itemId: "pm-bag25", qtyPerUnit: 1 }],
  "fg-oil15": [{ itemId: "sfg-oil", qtyPerUnit: 15 }, { itemId: "pm-tin15", qtyPerUnit: 1 }],
  "fg-flour00": [{ itemId: "sfg-flour", qtyPerUnit: 25 }, { itemId: "pm-bag25", qtyPerUnit: 1 }],
  "fg-semolina25": [{ itemId: "sfg-semolina", qtyPerUnit: 25 }, { itemId: "pm-bag25", qtyPerUnit: 1 }],
  "fg-atta10": [{ itemId: "sfg-flour", qtyPerUnit: 10 }, { itemId: "pm-bag10", qtyPerUnit: 1 }],
  "fg-atta1": [
    { itemId: "sfg-flour", qtyPerUnit: 1 },
    { itemId: "pm-pouch1", qtyPerUnit: 1 },
    { itemId: "pm-label", qtyPerUnit: 1 },
  ],
};

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
