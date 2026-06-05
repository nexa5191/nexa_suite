import type { Item, ItemCategory, BomComponent, Uom } from "./types";

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
  { id: "rm-wheat", code: "RM-WHT", name: "Wheat grain", category: "raw", uom: "kg", rate: 32, hsn: "1001", reorderLevel: 80000, primaryLocationId: PLANT },
  { id: "rm-sunseed", code: "RM-SUN", name: "Sunflower seed", category: "raw", uom: "kg", rate: 75, hsn: "1206", reorderLevel: 35000, primaryLocationId: PLANT },
  { id: "rm-paddy", code: "RM-PDY", name: "Basmati paddy", category: "raw", uom: "kg", rate: 40, hsn: "1006", reorderLevel: 60000, primaryLocationId: PLANT },
  { id: "rm-durum", code: "RM-DUR", name: "Durum wheat", category: "raw", uom: "kg", rate: 38, hsn: "1001", reorderLevel: 30000, primaryLocationId: PLANT },

  // ---- Packing materials ----
  { id: "pm-bag50", code: "PM-B50", name: "Woven bag — 50kg", category: "packing", uom: "pcs", rate: 35, hsn: "6305", reorderLevel: 1500, primaryLocationId: PLANT },
  { id: "pm-bag25", code: "PM-B25", name: "Woven bag — 25kg", category: "packing", uom: "pcs", rate: 22, hsn: "6305", reorderLevel: 2000, primaryLocationId: PLANT },
  { id: "pm-bag10", code: "PM-B10", name: "Woven bag — 10kg", category: "packing", uom: "pcs", rate: 14, hsn: "6305", reorderLevel: 2000, primaryLocationId: PLANT },
  { id: "pm-tin15", code: "PM-T15", name: "Oil tin — 15L", category: "packing", uom: "pcs", rate: 95, hsn: "7310", reorderLevel: 3000, primaryLocationId: PLANT },
  { id: "pm-pouch1", code: "PM-P01", name: "Laminated pouch — 1kg", category: "packing", uom: "pcs", rate: 6, hsn: "3923", reorderLevel: 15000, primaryLocationId: PLANT },
  { id: "pm-carton", code: "PM-CTN", name: "Carton box (12s)", category: "packing", uom: "pcs", rate: 42, hsn: "4819", reorderLevel: 2000, primaryLocationId: PLANT },
  { id: "pm-label", code: "PM-LBL", name: "Barcode label", category: "packing", uom: "pcs", rate: 4, hsn: "4821", reorderLevel: 20000, primaryLocationId: PLANT },

  // ---- Semi-finished (WIP) ----
  { id: "sfg-flour", code: "SF-FLR", name: "Refined wheat flour (bulk)", category: "semi-finished", uom: "kg", rate: 36, hsn: "1101", reorderLevel: 15000, primaryLocationId: PLANT, shelfLifeDays: 180 },
  { id: "sfg-oil", code: "SF-OIL", name: "Refined sunflower oil (bulk)", category: "semi-finished", uom: "L", rate: 165, hsn: "1512", reorderLevel: 5000, primaryLocationId: PLANT, shelfLifeDays: 365 },
  { id: "sfg-rice", code: "SF-RCE", name: "Milled basmati rice (bulk)", category: "semi-finished", uom: "kg", rate: 95, hsn: "1006", reorderLevel: 12000, primaryLocationId: PLANT, shelfLifeDays: 540 },
  { id: "sfg-semolina", code: "SF-SEM", name: "Durum semolina (bulk)", category: "semi-finished", uom: "kg", rate: 40, hsn: "1103", reorderLevel: 5000, primaryLocationId: PLANT, shelfLifeDays: 180 },

  // ---- Finished goods (packed SKUs — match the invoicing catalogue) ----
  { id: "fg-flour50", code: "FG-FL50", name: "Wheat flour (50kg bag)", category: "finished", uom: "pcs", rate: 1850, hsn: "1101", reorderLevel: 300, primaryLocationId: PLANT, shelfLifeDays: 150 },
  { id: "fg-rice25", code: "FG-RC25", name: "Basmati rice (25kg)", category: "finished", uom: "pcs", rate: 2400, hsn: "1006", reorderLevel: 200, primaryLocationId: PLANT, shelfLifeDays: 540 },
  { id: "fg-oil15", code: "FG-OL15", name: "Sunflower oil (15L tin)", category: "finished", uom: "pcs", rate: 1650, hsn: "1512", reorderLevel: 250, primaryLocationId: PLANT, shelfLifeDays: 365 },
  { id: "fg-flour00", code: "FG-F025", name: "Specialty 00 flour (25kg)", category: "finished", uom: "pcs", rate: 2200, hsn: "1101", reorderLevel: 200, primaryLocationId: PLANT, shelfLifeDays: 150 },
  { id: "fg-semolina25", code: "FG-SM25", name: "Durum semolina (25kg)", category: "finished", uom: "pcs", rate: 1900, hsn: "1103", reorderLevel: 120, primaryLocationId: PLANT, shelfLifeDays: 150 },
  { id: "fg-atta10", code: "FG-AT10", name: "Atta (10kg)", category: "finished", uom: "pcs", rate: 360, hsn: "1101", reorderLevel: 600, primaryLocationId: PLANT, shelfLifeDays: 120 },
  { id: "fg-atta1", code: "FG-AT01", name: "Atta pouch (1kg)", category: "finished", uom: "pcs", rate: 48, hsn: "1101", reorderLevel: 5000, primaryLocationId: PLANT, shelfLifeDays: 120 },
];

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
