export type BinZone = "receiving" | "storage" | "picking" | "dispatch" | "quarantine";

export interface Bin {
  id: string;
  code: string;
  locationId: string;
  zone: BinZone;
  description: string;
  capacityKg: number;
  currentKg: number;
  isActive: boolean;
}

export interface BinStock {
  binId: string;
  itemId: string;
  qty: number;
  uom: string;
  batchNo: string | null;
  expiryDate: string | null;
  lastMovedAt: string;
}

export const ZONE_META: Record<
  BinZone,
  { label: string; color: string; bg: string; border: string; badge: "default" | "primary" | "success" | "warning" | "danger" | "outline" }
> = {
  receiving:  { label: "Receiving",  color: "text-blue-700",   bg: "bg-blue-50",   border: "border-blue-200",  badge: "primary"  },
  storage:    { label: "Storage",    color: "text-green-700",  bg: "bg-green-50",  border: "border-green-200", badge: "success"  },
  picking:    { label: "Picking",    color: "text-amber-700",  bg: "bg-amber-50",  border: "border-amber-200", badge: "warning"  },
  dispatch:   { label: "Dispatch",   color: "text-purple-700", bg: "bg-purple-50", border: "border-purple-200",badge: "outline"  },
  quarantine: { label: "Quarantine", color: "text-red-700",    bg: "bg-red-50",    border: "border-red-200",   badge: "danger"   },
};

export const SEED_BINS: Bin[] = [
  // ── Mysuru Plant (loc-mys) ─────────────────────────────────────────────────
  { id: "bin-mys-rcv-01",  code: "RCV-01",  locationId: "loc-mys", zone: "receiving",  description: "Receiving dock bay 1",        capacityKg: 10000, currentKg: 5000, isActive: true },
  { id: "bin-mys-rcv-02",  code: "RCV-02",  locationId: "loc-mys", zone: "receiving",  description: "Receiving dock bay 2",        capacityKg:  8000, currentKg:  250, isActive: true },
  { id: "bin-mys-a-01-01", code: "A-01-01", locationId: "loc-mys", zone: "storage",    description: "Aisle A, rack 01, level 01",  capacityKg: 20000, currentKg: 8000, isActive: true },
  { id: "bin-mys-a-01-02", code: "A-01-02", locationId: "loc-mys", zone: "storage",    description: "Aisle A, rack 01, level 02",  capacityKg: 20000, currentKg: 1840, isActive: true },
  { id: "bin-mys-a-01-03", code: "A-01-03", locationId: "loc-mys", zone: "storage",    description: "Aisle A, rack 01, level 03",  capacityKg: 20000, currentKg: 3000, isActive: true },
  { id: "bin-mys-a-02-01", code: "A-02-01", locationId: "loc-mys", zone: "storage",    description: "Aisle A, rack 02, level 01",  capacityKg: 15000, currentKg: 5000, isActive: true },
  { id: "bin-mys-a-02-02", code: "A-02-02", locationId: "loc-mys", zone: "storage",    description: "Aisle A, rack 02, level 02",  capacityKg: 15000, currentKg: 1500, isActive: true },
  { id: "bin-mys-a-02-03", code: "A-02-03", locationId: "loc-mys", zone: "storage",    description: "Aisle A, rack 02, level 03",  capacityKg: 15000, currentKg: 4000, isActive: true },
  { id: "bin-mys-b-01-01", code: "B-01-01", locationId: "loc-mys", zone: "storage",    description: "Aisle B, rack 01, level 01",  capacityKg: 20000, currentKg: 6000, isActive: true },
  { id: "bin-mys-b-01-02", code: "B-01-02", locationId: "loc-mys", zone: "storage",    description: "Aisle B, rack 01, level 02",  capacityKg: 20000, currentKg: 3000, isActive: true },
  { id: "bin-mys-p-01-01", code: "P-01-01", locationId: "loc-mys", zone: "picking",    description: "Picking zone 1, rack 01",     capacityKg:  5000, currentKg: 5000, isActive: true },
  { id: "bin-mys-p-01-02", code: "P-01-02", locationId: "loc-mys", zone: "picking",    description: "Picking zone 1, rack 02",     capacityKg:  5000, currentKg: 2000, isActive: true },
  { id: "bin-mys-p-02-01", code: "P-02-01", locationId: "loc-mys", zone: "picking",    description: "Picking zone 2, rack 01",     capacityKg:  5000, currentKg:  800, isActive: true },
  { id: "bin-mys-dsp-01",  code: "DSP-01",  locationId: "loc-mys", zone: "dispatch",   description: "Dispatch staging area 1",     capacityKg:  8000, currentKg: 2500, isActive: true },
  { id: "bin-mys-dsp-02",  code: "DSP-02",  locationId: "loc-mys", zone: "dispatch",   description: "Dispatch staging area 2",     capacityKg:  8000, currentKg:  750, isActive: true },
  { id: "bin-mys-qur-01",  code: "QUR-01",  locationId: "loc-mys", zone: "quarantine", description: "QC hold / quarantine bay",    capacityKg:  5000, currentKg:   25, isActive: true },

  // ── Bengaluru HQ (loc-blr) ─────────────────────────────────────────────────
  { id: "bin-blr-rcv-01",  code: "RCV-01",  locationId: "loc-blr", zone: "receiving",  description: "BLR receiving dock",          capacityKg:  5000, currentKg: 1000, isActive: true },
  { id: "bin-blr-s-01-01", code: "S-01-01", locationId: "loc-blr", zone: "storage",    description: "Storage rack 01, level 01",   capacityKg:  8000, currentKg: 3000, isActive: true },
  { id: "bin-blr-s-01-02", code: "S-01-02", locationId: "loc-blr", zone: "storage",    description: "Storage rack 01, level 02",   capacityKg:  8000, currentKg: 1200, isActive: true },
  { id: "bin-blr-p-01",    code: "P-01",    locationId: "loc-blr", zone: "picking",    description: "Picking area — fast movers",  capacityKg:  3000, currentKg:  400, isActive: true },
  { id: "bin-blr-dsp-01",  code: "DSP-01",  locationId: "loc-blr", zone: "dispatch",   description: "Dispatch staging",            capacityKg:  3000, currentKg:  300, isActive: true },

  // ── Mumbai Depot (loc-mum) ─────────────────────────────────────────────────
  { id: "bin-mum-rcv-01",  code: "RCV-01",  locationId: "loc-mum", zone: "receiving",  description: "Mumbai receiving dock",        capacityKg:  8000, currentKg: 2000, isActive: true },
  { id: "bin-mum-s-01-01", code: "S-01-01", locationId: "loc-mum", zone: "storage",    description: "Storage rack 01, level 01",   capacityKg: 12000, currentKg: 5000, isActive: true },
  { id: "bin-mum-s-01-02", code: "S-01-02", locationId: "loc-mum", zone: "storage",    description: "Storage rack 01, level 02",   capacityKg: 12000, currentKg:  840, isActive: true },
  { id: "bin-mum-p-01",    code: "P-01",    locationId: "loc-mum", zone: "picking",    description: "Picking lane 01",             capacityKg:  4000, currentKg:  800, isActive: true },
  { id: "bin-mum-p-02",    code: "P-02",    locationId: "loc-mum", zone: "picking",    description: "Picking lane 02",             capacityKg:  4000, currentKg: 1000, isActive: true },
  { id: "bin-mum-dsp-01",  code: "DSP-01",  locationId: "loc-mum", zone: "dispatch",   description: "Dispatch staging area",       capacityKg:  5000, currentKg: 2000, isActive: true },
];

export const SEED_BIN_STOCK: BinStock[] = [
  // Mysuru Plant
  { binId: "bin-mys-rcv-01",  itemId: "rm-wheat",     qty: 5000, uom: "kg",  batchNo: "WHT-2606",   expiryDate: null,         lastMovedAt: "2026-06-03" },
  { binId: "bin-mys-rcv-02",  itemId: "pm-carton",    qty:  500, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-04" },
  { binId: "bin-mys-a-01-01", itemId: "sfg-flour",    qty: 8000, uom: "kg",  batchNo: "FLR-2605",   expiryDate: "2026-11-16", lastMovedAt: "2026-05-20" },
  { binId: "bin-mys-a-01-02", itemId: "sfg-oil",      qty: 2000, uom: "L",   batchNo: null,         expiryDate: null,         lastMovedAt: "2026-05-20" },
  { binId: "bin-mys-a-01-03", itemId: "rm-sunseed",   qty: 3000, uom: "kg",  batchNo: null,         expiryDate: null,         lastMovedAt: "2026-05-15" },
  { binId: "bin-mys-a-02-01", itemId: "rm-paddy",     qty: 5000, uom: "kg",  batchNo: null,         expiryDate: null,         lastMovedAt: "2026-05-12" },
  { binId: "bin-mys-a-02-02", itemId: "rm-durum",     qty: 1500, uom: "kg",  batchNo: null,         expiryDate: null,         lastMovedAt: "2026-05-18" },
  { binId: "bin-mys-a-02-03", itemId: "sfg-rice",     qty: 4000, uom: "kg",  batchNo: null,         expiryDate: null,         lastMovedAt: "2026-05-22" },
  { binId: "bin-mys-b-01-01", itemId: "rm-wheat",     qty: 6000, uom: "kg",  batchNo: "WHT-2606",   expiryDate: null,         lastMovedAt: "2026-06-03" },
  { binId: "bin-mys-b-01-02", itemId: "sfg-semolina", qty: 3000, uom: "kg",  batchNo: null,         expiryDate: null,         lastMovedAt: "2026-05-22" },
  { binId: "bin-mys-p-01-01", itemId: "fg-flour50",   qty:  100, uom: "pcs", batchNo: "FL50-2605",  expiryDate: "2026-10-19", lastMovedAt: "2026-05-22" },
  { binId: "bin-mys-p-01-02", itemId: "fg-atta10",    qty:  200, uom: "pcs", batchNo: "AT10-2605",  expiryDate: null,         lastMovedAt: "2026-05-10" },
  { binId: "bin-mys-p-02-01", itemId: "fg-atta1",     qty:  800, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-05" },
  { binId: "bin-mys-dsp-01",  itemId: "fg-flour50",   qty:   50, uom: "pcs", batchNo: "FL50-2605B", expiryDate: "2026-11-06", lastMovedAt: "2026-06-05" },
  { binId: "bin-mys-dsp-02",  itemId: "fg-rice25",    qty:   30, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-05" },
  { binId: "bin-mys-qur-01",  itemId: "pm-tin15",     qty:   50, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-01" },
  // Bengaluru HQ
  { binId: "bin-blr-rcv-01",  itemId: "fg-flour50",   qty:   20, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-10" },
  { binId: "bin-blr-s-01-01", itemId: "fg-flour50",   qty:   60, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-10" },
  { binId: "bin-blr-s-01-02", itemId: "fg-atta10",    qty:  120, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-10" },
  { binId: "bin-blr-p-01",    itemId: "fg-atta1",     qty:  400, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-10" },
  { binId: "bin-blr-dsp-01",  itemId: "fg-atta10",    qty:   30, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-11" },
  // Mumbai Depot
  { binId: "bin-mum-rcv-01",  itemId: "fg-rice25",    qty:   80, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-08" },
  { binId: "bin-mum-s-01-01", itemId: "fg-flour50",   qty:  100, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-05-28" },
  { binId: "bin-mum-s-01-02", itemId: "fg-oil15",     qty:   60, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-05-28" },
  { binId: "bin-mum-p-01",    itemId: "fg-atta1",     qty:  800, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-08" },
  { binId: "bin-mum-p-02",    itemId: "fg-rice25",    qty:   40, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-08" },
  { binId: "bin-mum-dsp-01",  itemId: "fg-flour50",   qty:   40, uom: "pcs", batchNo: null,         expiryDate: null,         lastMovedAt: "2026-06-10" },
];

// Approximate kg-per-unit for utilisation bars. Does not need to be exact.
export const ITEM_KG: Record<string, number> = {
  "rm-wheat": 1, "rm-sunseed": 1, "rm-paddy": 1, "rm-durum": 1,
  "sfg-flour": 1, "sfg-oil": 0.92, "sfg-rice": 1, "sfg-semolina": 1,
  "fg-flour50": 50, "fg-rice25": 25, "fg-oil15": 14, "fg-flour00": 25,
  "fg-semolina25": 25, "fg-atta10": 10, "fg-atta1": 1,
  "pm-bag50": 0.3, "pm-bag25": 0.2, "pm-bag10": 0.15, "pm-tin15": 0.5,
  "pm-pouch1": 0.01, "pm-carton": 0.5, "pm-label": 0.001,
};

export function computeCurrentKg(binId: string, stocks: BinStock[]): number {
  return stocks
    .filter((s) => s.binId === binId)
    .reduce((sum, s) => sum + s.qty * (ITEM_KG[s.itemId] ?? 1), 0);
}

const BINS_KEY = "nexa-bins";
const BIN_STOCK_KEY = "nexa-bin-stock";

export function loadBins(): Bin[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BINS_KEY);
    if (raw) return JSON.parse(raw) as Bin[];
  } catch { /* ignore */ }
  return [];
}

export function saveBins(bins: Bin[]) {
  try { localStorage.setItem(BINS_KEY, JSON.stringify(bins)); } catch { /* ignore */ }
}

export function loadBinStock(): BinStock[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(BIN_STOCK_KEY);
    if (raw) return JSON.parse(raw) as BinStock[];
  } catch { /* ignore */ }
  return [];
}

export function saveBinStock(stock: BinStock[]) {
  try { localStorage.setItem(BIN_STOCK_KEY, JSON.stringify(stock)); } catch { /* ignore */ }
}

export function allBins(saved: Bin[]): Bin[] {
  if (saved.length === 0) return [...SEED_BINS];
  const savedMap = new Map(saved.map((b) => [b.id, b]));
  return [
    ...SEED_BINS.map((b) => savedMap.get(b.id) ?? b),
    ...saved.filter((b) => !SEED_BINS.some((s) => s.id === b.id)),
  ];
}

export function allBinStock(saved: BinStock[]): BinStock[] {
  if (saved.length === 0) return [...SEED_BIN_STOCK];
  const key = (s: BinStock) => `${s.binId}|${s.itemId}`;
  const savedKeys = new Set(saved.map(key));
  return [...SEED_BIN_STOCK.filter((s) => !savedKeys.has(key(s))), ...saved];
}

export function stockForBin(binId: string, stocks: BinStock[]): BinStock[] {
  return stocks.filter((s) => s.binId === binId);
}

export function nextBinId(bins: Bin[]): string {
  const max = bins
    .map((b) => b.id.match(/^bin-usr-(\d+)$/))
    .filter(Boolean)
    .reduce((n, m) => Math.max(n, parseInt(m![1], 10)), 0);
  return `bin-usr-${String(max + 1).padStart(3, "0")}`;
}
