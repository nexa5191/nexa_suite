// ---------------------------------------------------------------------------
// NEXA fixed-asset register — the asset master. Each asset carries enough to
// drive depreciation (cost, life, salvage, method) AND a capital-appraisal view
// (expected annual benefit → payback period & accounting rate of return).
//
// Amounts are base INR, like the rest of NEXA. User-added assets persist to
// localStorage (nexa-assets); disposals to nexa-asset-disposals.
// ---------------------------------------------------------------------------

export type DepMethod = "SLM" | "WDV"; // straight-line | written-down-value

export type AssetCategory =
  | "Plant & Machinery"
  | "Furniture & Fixtures"
  | "Computers & IT"
  | "Vehicles"
  | "Office Equipment"
  | "Buildings";

export interface AssetCategoryMeta {
  category: AssetCategory;
  accountCode: string; // capitalised under this COA asset account
  defaultLife: number; // years
  defaultMethod: DepMethod;
}

export const CATEGORY_META: AssetCategoryMeta[] = [
  { category: "Plant & Machinery", accountCode: "1500", defaultLife: 15, defaultMethod: "WDV" },
  { category: "Furniture & Fixtures", accountCode: "1510", defaultLife: 10, defaultMethod: "SLM" },
  { category: "Computers & IT", accountCode: "1500", defaultLife: 3, defaultMethod: "WDV" },
  { category: "Vehicles", accountCode: "1500", defaultLife: 8, defaultMethod: "WDV" },
  { category: "Office Equipment", accountCode: "1510", defaultLife: 5, defaultMethod: "SLM" },
  { category: "Buildings", accountCode: "1500", defaultLife: 30, defaultMethod: "SLM" },
];

export function categoryMeta(c: AssetCategory): AssetCategoryMeta {
  return CATEGORY_META.find((m) => m.category === c) ?? CATEGORY_META[0];
}

// Depreciation expense + accumulated depreciation accounts (shared book).
export const DEP_EXPENSE_ACCOUNT = "6080";
export const ACCUM_DEP_ACCOUNT = "1590";

export interface FixedAsset {
  id: string;
  tag: string; // FA-0001
  name: string;
  category: AssetCategory;
  entityId: string;
  locationId: string;
  acquisitionDate: string; // ISO
  cost: number; // base INR (capitalised cost)
  salvage: number; // residual value
  usefulLifeYears: number;
  method: DepMethod;
  wdvRate?: number; // % p.a. for WDV; derived from life/salvage if absent
  annualBenefit: number; // expected incremental cash inflow / saving p.a.
  supplier?: string;
}

// ---- seed register ---------------------------------------------------------
interface Raw extends Omit<FixedAsset, "id" | "tag" | "method" | "usefulLifeYears"> {
  seq: number;
  method?: DepMethod;
  life?: number;
}

const R = (
  seq: number,
  name: string,
  category: AssetCategory,
  entityId: string,
  locationId: string,
  acquisitionDate: string,
  cost: number,
  salvage: number,
  annualBenefit: number,
  supplier: string,
  opt?: { method?: DepMethod; life?: number; wdvRate?: number },
): Raw => ({
  seq,
  name,
  category,
  entityId,
  locationId,
  acquisitionDate,
  cost,
  salvage,
  annualBenefit,
  supplier,
  method: opt?.method,
  life: opt?.life,
  wdvRate: opt?.wdvRate,
});

const RAW: Raw[] = [
  R(1, "Flour milling line (50 TPD)", "Plant & Machinery", "ent-nexa-in", "loc-mys", "2021-05-12", 8_400_000, 420_000, 2_600_000, "Buhler India", { wdvRate: 15 }),
  R(2, "Automated packaging line", "Plant & Machinery", "ent-nexa-in", "loc-mys", "2022-03-08", 5_200_000, 260_000, 1_700_000, "Bosch Packaging", { wdvRate: 15 }),
  R(3, "Cold storage unit (200 MT)", "Plant & Machinery", "ent-nexa-in", "loc-mys", "2023-08-20", 3_600_000, 180_000, 980_000, "Blue Star", { wdvRate: 15 }),
  R(4, "Rooftop solar plant (120 kW)", "Plant & Machinery", "ent-nexa-in", "loc-blr", "2024-01-15", 4_800_000, 240_000, 1_150_000, "Tata Power Solar", { method: "SLM", life: 25 }),
  R(5, "Diesel generator (500 kVA)", "Plant & Machinery", "ent-nexa-in", "loc-mys", "2021-11-02", 1_900_000, 95_000, 320_000, "Cummins", { wdvRate: 15 }),
  R(6, "Delivery truck — Tata 1109", "Vehicles", "ent-nexa-trade", "loc-mum", "2023-02-18", 2_100_000, 210_000, 720_000, "Tata Motors", { wdvRate: 25 }),
  R(7, "Delivery van — Mahindra Bolero", "Vehicles", "ent-nexa-trade", "loc-del", "2024-06-10", 1_350_000, 135_000, 540_000, "Mahindra", { wdvRate: 25 }),
  R(8, "Forklift (3 ton)", "Plant & Machinery", "ent-nexa-trade", "loc-mum", "2022-09-05", 1_200_000, 60_000, 280_000, "Godrej Material Handling", { wdvRate: 15 }),
  R(9, "ERP server & network stack", "Computers & IT", "ent-nexa-in", "loc-blr", "2024-04-02", 1_450_000, 50_000, 700_000, "Dell EMC", { wdvRate: 40 }),
  R(10, "Engineering laptops (12)", "Computers & IT", "ent-nexa-in", "loc-blr", "2025-03-15", 1_080_000, 36_000, 460_000, "Lenovo", { wdvRate: 40 }),
  R(11, "QA lab instruments", "Office Equipment", "ent-nexa-in", "loc-mys", "2023-07-12", 980_000, 49_000, 240_000, "Mettler Toledo", { method: "SLM", life: 7 }),
  R(12, "HQ office furniture fit-out", "Furniture & Fixtures", "ent-nexa-in", "loc-blr", "2021-04-20", 2_300_000, 115_000, 0, "Featherlite", { method: "SLM", life: 10 }),
  R(13, "Mumbai depot racking system", "Furniture & Fixtures", "ent-nexa-trade", "loc-mum", "2022-12-01", 1_650_000, 82_500, 300_000, "Godrej Storage", { method: "SLM", life: 10 }),
  R(14, "Singapore office build-out", "Buildings", "ent-nexa-global", "loc-sg", "2023-05-10", 6_200_000, 620_000, 0, "JTC Contractors", { method: "SLM", life: 20 }),
];

export const SEED_ASSETS: FixedAsset[] = RAW.map((r) => {
  const meta = categoryMeta(r.category);
  return {
    id: `asset-${String(r.seq).padStart(3, "0")}`,
    tag: `FA-${String(r.seq).padStart(4, "0")}`,
    name: r.name,
    category: r.category,
    entityId: r.entityId,
    locationId: r.locationId,
    acquisitionDate: r.acquisitionDate,
    cost: r.cost,
    salvage: r.salvage,
    usefulLifeYears: r.life ?? meta.defaultLife,
    method: r.method ?? meta.defaultMethod,
    wdvRate: r.wdvRate,
    annualBenefit: r.annualBenefit,
    supplier: r.supplier,
  };
});

// ---- disposals -------------------------------------------------------------
export interface Disposal {
  assetId: string;
  date: string; // ISO
  proceeds: number; // base INR
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
const ASSETS_KEY = "nexa-assets";
const DISPOSALS_KEY = "nexa-asset-disposals";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}
function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const loadCreatedAssets = () => read<FixedAsset[]>(ASSETS_KEY, []);
export const saveCreatedAssets = (a: FixedAsset[]) => write(ASSETS_KEY, a);
export const loadDisposals = () => read<Disposal[]>(DISPOSALS_KEY, []);
export const saveDisposals = (d: Disposal[]) => write(DISPOSALS_KEY, d);

export function allAssets(created: FixedAsset[]): FixedAsset[] {
  return [...SEED_ASSETS, ...created];
}

export function assetById(id: string, created: FixedAsset[]): FixedAsset | undefined {
  return allAssets(created).find((a) => a.id === id);
}

export function nextAssetTag(created: FixedAsset[]): { id: string; tag: string; seq: number } {
  const all = allAssets(created);
  let max = 0;
  for (const a of all) {
    const m = a.tag.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  const seq = max + 1;
  return { id: `asset-${String(seq).padStart(3, "0")}`, tag: `FA-${String(seq).padStart(4, "0")}`, seq };
}
