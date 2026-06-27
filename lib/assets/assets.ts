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

export const SEED_ASSETS: FixedAsset[] = [];

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
