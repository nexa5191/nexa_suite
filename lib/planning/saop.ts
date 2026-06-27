export type ForecastMethod = "manual" | "moving-average" | "trend";
export type ReviewStatus = "draft" | "sales-review" | "ops-review" | "finance-review" | "approved";

export interface ForecastLine {
  itemName: string;
  category: "finished" | "semi-finished";
  uom: string;
  salesForecast: number[];
  opsForecast: number[];
  consensusForecast: number[];
  openingStock: number;
  targetStockDays: number;
}

export interface SaopCycle {
  id: string;
  ref: string;
  cycleMonth: string;
  status: ReviewStatus;
  lines: ForecastLine[];
  reviewDates: {
    salesReview: string | null;
    opsReview: string | null;
    financeReview: string | null;
    approved: string | null;
  };
  assumptions: string;
  risks: string;
}

// ---- PRNG (mulberry32, seed 20260615) ----------------------------------------
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const _r = mulberry32(20260615);

// ---- Product definitions -----------------------------------------------------
interface ProductDef {
  itemName: string;
  category: "finished" | "semi-finished";
  uom: string;
  base: number;
  openingStock: number;
  targetStockDays: number;
}

const PRODUCTS: ProductDef[] = [
  { itemName: "Wheat Flour",              category: "finished",      uom: "kg",  base: 22000, openingStock: 12500, targetStockDays: 15 },
  { itemName: "Basmati Rice",             category: "finished",      uom: "kg",  base: 16000, openingStock: 8400,  targetStockDays: 15 },
  { itemName: "Refined Sunflower Oil",    category: "finished",      uom: "L",   base:  9500, openingStock: 5200,  targetStockDays: 12 },
  { itemName: "Ready Mix Spice Blend",    category: "semi-finished", uom: "kg",  base:  5500, openingStock: 3100,  targetStockDays: 10 },
  { itemName: "Cumin Powder",             category: "semi-finished", uom: "kg",  base:  3800, openingStock: 2200,  targetStockDays: 10 },
  { itemName: "Coriander Powder",         category: "semi-finished", uom: "kg",  base:  3100, openingStock: 1800,  targetStockDays: 10 },
  { itemName: "HDPE Laminated Bags 1 kg", category: "semi-finished", uom: "pcs", base: 85000, openingStock: 45000, targetStockDays: 20 },
];

// Sales > consensus > ops (ops is most conservative)
function genLine(p: ProductDef): ForecastLine {
  const salesForecast: number[] = [];
  const opsForecast: number[] = [];
  const consensusForecast: number[] = [];
  for (let i = 0; i < 12; i++) {
    const s = Math.round(p.base * (0.82 + _r() * 0.36));
    const o = Math.round(s * (0.88 + _r() * 0.09));
    const c = Math.round(o + (s - o) * (0.4 + _r() * 0.3));
    salesForecast.push(s);
    opsForecast.push(o);
    consensusForecast.push(c);
  }
  return {
    itemName: p.itemName,
    category: p.category,
    uom: p.uom,
    salesForecast,
    opsForecast,
    consensusForecast,
    openingStock: p.openingStock,
    targetStockDays: p.targetStockDays,
  };
}

// ---- Seed cycles (last month approved, current ops-review, next draft) -------
export const SEED_CYCLES: SaopCycle[] = [
  {
    id: "saop-001",
    ref: "SAOP-May-2026",
    cycleMonth: "2026-05",
    status: "approved",
    lines: PRODUCTS.map(genLine),
    reviewDates: {
      salesReview: "2026-04-22",
      opsReview:   "2026-04-25",
      financeReview: "2026-04-28",
      approved:    "2026-04-30",
    },
    assumptions:
      "Monsoon onset expected mid-June. Wheat procurement at ₹2,200/qtl contract locked for Q1. Sunflower oil imports stable; no customs duty revision expected in this cycle.",
    risks:
      "Delayed monsoon may spike cumin spot prices by 10–15%. Packaging supplier lead time extended to 6 weeks — buffer stock build required ahead of festival season.",
  },
  {
    id: "saop-002",
    ref: "SAOP-Jun-2026",
    cycleMonth: "2026-06",
    status: "ops-review",
    lines: PRODUCTS.map(genLine),
    reviewDates: {
      salesReview: "2026-05-26",
      opsReview:   null,
      financeReview: null,
      approved:    null,
    },
    assumptions:
      "Festival season demand uplift of 8–12% expected from September onward. Wheat flour and spice blend to drive topline. HDPE bags dual-sourced to de-risk supply chain.",
    risks:
      "Competition price cuts in edible oil may erode volume targets. Cumin crop output below normal — spot procurement likely. Power availability at Pune plant uncertain due to grid maintenance.",
  },
  {
    id: "saop-003",
    ref: "SAOP-Jul-2026",
    cycleMonth: "2026-07",
    status: "draft",
    lines: PRODUCTS.map(genLine),
    reviewDates: {
      salesReview: null,
      opsReview:   null,
      financeReview: null,
      approved:    null,
    },
    assumptions:
      "Preliminary forecast. Navratri and Diwali peaks expected in October–November. New SKU launch (Whole Wheat Atta 2 kg) planned for September with trade promotion support.",
    risks:
      "New SKU demand uncertain — trade scheme response unknown. Raw material inflation risk if RBI rate action tightens procurement credit. Logistics costs rising with new toll structure.",
  },
];

// ---- Status helpers ----------------------------------------------------------
export const STATUS_ORDER: ReviewStatus[] = [
  "draft",
  "sales-review",
  "ops-review",
  "finance-review",
  "approved",
];

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  draft:            "Draft",
  "sales-review":   "Sales Review",
  "ops-review":     "Ops Review",
  "finance-review": "Finance Review",
  approved:         "Approved",
};

export function nextStatus(s: ReviewStatus): ReviewStatus | null {
  const i = STATUS_ORDER.indexOf(s);
  return i >= 0 && i < STATUS_ORDER.length - 1 ? STATUS_ORDER[i + 1] : null;
}

// ---- Month helpers -----------------------------------------------------------
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function cycleMonthLabels(cycleMonth: string): string[] {
  const [y, m] = cycleMonth.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const mo = ((m - 1 + i) % 12);
    const yr = y + Math.floor((m - 1 + i) / 12);
    out.push(`${MONTH_NAMES[mo]} '${String(yr).slice(2)}`);
  }
  return out;
}

export const sum12 = (arr: number[]) => arr.reduce((s, v) => s + v, 0);
export const sum3  = (arr: number[]) => arr.slice(0, 3).reduce((s, v) => s + v, 0);

// ---- Persistence ------------------------------------------------------------
const SAOP_KEY = "nexa-saop-cycles";

export function loadCycles(): SaopCycle[] {
  if (typeof window === "undefined") return SEED_CYCLES;
  try {
    const s = localStorage.getItem(SAOP_KEY);
    if (s) return JSON.parse(s) as SaopCycle[];
  } catch {}
  return SEED_CYCLES;
}

export function saveCycles(cycles: SaopCycle[]) {
  try {
    localStorage.setItem(SAOP_KEY, JSON.stringify(cycles));
  } catch {}
}
