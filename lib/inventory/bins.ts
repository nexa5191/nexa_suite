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

export const SEED_BINS: Bin[] = [];

export const SEED_BIN_STOCK: BinStock[] = [];

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
