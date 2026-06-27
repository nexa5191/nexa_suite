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

export const SEED_CYCLES: SaopCycle[] = [];

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
