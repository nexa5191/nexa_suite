// ---------------------------------------------------------------------------
// Department-wise budget builder — FY 2026-27
// Driver-based budgeting: headcount, revenue growth, area, manual %.
// ---------------------------------------------------------------------------

export type Department = "Finance" | "Operations" | "SCM" | "Maintenance" | "HR" | "Marketing" | "IT";
export type DeptStatus  = "draft" | "submitted" | "approved";
export type DriverType  = "headcount" | "revenue" | "area" | "fixed" | "manual";

export const DEPARTMENTS: Department[] = [
  "HR", "Operations", "SCM", "Maintenance", "Finance", "Marketing", "IT",
];

export const DEPT_HEADS: Record<Department, string[]> = {
  HR:          ["Salaries & wages", "Staff welfare & canteen", "Recruitment & hiring", "Training & development", "HR travel & conveyance", "Statutory compliance"],
  Operations:  ["Contract labour", "Utilities - power", "Utilities - fuel & water", "Quality & testing", "Operations travel", "Miscellaneous"],
  SCM:         ["Freight inward", "Freight outward", "Customs & duties", "Warehousing & storage", "SCM travel", "Miscellaneous"],
  Maintenance: ["Spares & consumables", "AMC charges", "Repairs & maintenance", "Calibration & testing", "Safety & PPE", "Miscellaneous"],
  Finance:     ["Professional fees", "Audit & legal fees", "Insurance premiums", "Banking charges", "Finance travel", "Miscellaneous"],
  Marketing:   ["Advertising & promotion", "Events & exhibitions", "Digital marketing", "Agency fees", "Market research", "Marketing travel"],
  IT:          ["Software licences", "Hardware & equipment", "Cloud & hosting", "IT support & AMC", "Cybersecurity", "IT travel"],
};

// Apr=0 … Mar=11
export const MONTHS      = ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb", "Mar"];
export const FY          = "2026-27";
export const FY_PREV     = "2025-26";
export const CLOSED_MONTHS = [0, 1]; // Apr, May are past

// ---------------------------------------------------------------------------
// Interfaces
// ---------------------------------------------------------------------------
export interface DeptAssumptions {
  headcountFY25: number;
  headcountFY26: number;
  revenueGrowthPct: number; // company-wide revenue growth %
  areaSqftFY25: number;
  areaSqftFY26: number;
}

export interface SubLine {
  id: string;
  label: string;
  cells: number[];                // 12 monthly values (₹)
  formulas: (string | null)[];    // parallel to cells; null = plain number, "=0.06*100" = formula
}

export interface BudgetLine {
  dept: Department;
  glHead: string;
  fy25Actual: number;             // full-year FY25 actual (₹)
  budgeted: number[];             // FY26 monthly budget [Apr…Mar]; auto-computed from subLines when subLines.length > 0
  cellFormulas: (string | null)[]; // formulas for direct GL head monthly entry (no sub-lines)
  actuals: number[];              // FY26 monthly actuals (closed months only)
  driverType: DriverType;
  manualPct: number;              // used when driverType === "manual"
  subLines: SubLine[];            // optional breakdown rows; when present, budgeted = their column sums
}

export interface BudgetStore {
  fy: string;
  deptStatus: Record<Department, DeptStatus>;
  assumptions: Record<Department, DeptAssumptions>;
  lines: BudgetLine[];
}

// ---------------------------------------------------------------------------
// Driver helpers
// ---------------------------------------------------------------------------
export const DRIVER_LABELS: Record<DriverType, string> = {
  headcount: "Headcount",
  revenue:   "Revenue",
  area:      "Area (sqft)",
  fixed:     "Fixed",
  manual:    "Manual %",
};

export function driverChangePct(line: BudgetLine, assumptions: DeptAssumptions): number {
  switch (line.driverType) {
    case "headcount":
      return assumptions.headcountFY25 > 0
        ? ((assumptions.headcountFY26 - assumptions.headcountFY25) / assumptions.headcountFY25) * 100
        : 0;
    case "revenue":
      return assumptions.revenueGrowthPct;
    case "area":
      return assumptions.areaSqftFY25 > 0
        ? ((assumptions.areaSqftFY26 - assumptions.areaSqftFY25) / assumptions.areaSqftFY25) * 100
        : 0;
    case "fixed":
      return 0;
    case "manual":
      return line.manualPct;
  }
}

export function suggestedAnnual(fy25Actual: number, changePct: number): number {
  return Math.round(fy25Actual * (1 + changePct / 100));
}

export function distributeEvenly(annual: number): number[] {
  const base = Math.floor(annual / 12);
  const rem  = annual - base * 12;
  return Array.from({ length: 12 }, (_, i) => base + (i === 0 ? rem : 0));
}

// ---------------------------------------------------------------------------
// Route helpers
// ---------------------------------------------------------------------------
export function slugFromDept(dept: Department): string { return dept.toLowerCase(); }
export function deptFromSlug(slug: string): Department | null {
  return DEPARTMENTS.find((d) => d.toLowerCase() === slug.toLowerCase()) ?? null;
}

// ---------------------------------------------------------------------------
// Aggregation helpers
// ---------------------------------------------------------------------------
export function sumLine(arr: number[]): number { return arr.reduce((s, v) => s + v, 0); }

export function deptLines(store: BudgetStore, dept: Department): BudgetLine[] {
  return store.lines.filter((l) => l.dept === dept);
}
export function deptMonthTotal(store: BudgetStore, dept: Department, mi: number, field: "budgeted" | "actuals"): number {
  return deptLines(store, dept).reduce((s, l) => s + (l[field][mi] ?? 0), 0);
}
export function deptAnnualTotal(store: BudgetStore, dept: Department, field: "budgeted" | "actuals" | "fy25Actual"): number {
  if (field === "fy25Actual") return deptLines(store, dept).reduce((s, l) => s + l.fy25Actual, 0);
  return deptLines(store, dept).reduce((s, l) => s + sumLine(l[field]), 0);
}

// ---------------------------------------------------------------------------
// Default driver assignments per dept/head
// ---------------------------------------------------------------------------
const DEFAULT_DRIVERS: Record<Department, Record<string, { type: DriverType; manualPct: number }>> = {
  HR: {
    "Salaries & wages":       { type: "headcount", manualPct: 0  },
    "Staff welfare & canteen":{ type: "headcount", manualPct: 0  },
    "Recruitment & hiring":   { type: "manual",    manualPct: 8  },
    "Training & development": { type: "manual",    manualPct: 5  },
    "HR travel & conveyance": { type: "headcount", manualPct: 0  },
    "Statutory compliance":   { type: "headcount", manualPct: 0  },
  },
  Operations: {
    "Contract labour":        { type: "revenue",   manualPct: 0  },
    "Utilities - power":      { type: "area",      manualPct: 0  },
    "Utilities - fuel & water":{ type: "manual",   manualPct: 7  },
    "Quality & testing":      { type: "revenue",   manualPct: 0  },
    "Operations travel":      { type: "manual",    manualPct: 5  },
    "Miscellaneous":          { type: "manual",    manualPct: 5  },
  },
  SCM: {
    "Freight inward":         { type: "revenue",   manualPct: 0  },
    "Freight outward":        { type: "revenue",   manualPct: 0  },
    "Customs & duties":       { type: "revenue",   manualPct: 0  },
    "Warehousing & storage":  { type: "revenue",   manualPct: 0  },
    "SCM travel":             { type: "manual",    manualPct: 5  },
    "Miscellaneous":          { type: "manual",    manualPct: 5  },
  },
  Maintenance: {
    "Spares & consumables":   { type: "fixed",     manualPct: 0  },
    "AMC charges":            { type: "fixed",     manualPct: 0  },
    "Repairs & maintenance":  { type: "fixed",     manualPct: 0  },
    "Calibration & testing":  { type: "fixed",     manualPct: 0  },
    "Safety & PPE":           { type: "headcount", manualPct: 0  },
    "Miscellaneous":          { type: "manual",    manualPct: 5  },
  },
  Finance: {
    "Professional fees":      { type: "fixed",     manualPct: 0  },
    "Audit & legal fees":     { type: "fixed",     manualPct: 0  },
    "Insurance premiums":     { type: "fixed",     manualPct: 0  },
    "Banking charges":        { type: "revenue",   manualPct: 0  },
    "Finance travel":         { type: "headcount", manualPct: 0  },
    "Miscellaneous":          { type: "manual",    manualPct: 5  },
  },
  Marketing: {
    "Advertising & promotion":{ type: "revenue",   manualPct: 0  },
    "Events & exhibitions":   { type: "revenue",   manualPct: 0  },
    "Digital marketing":      { type: "revenue",   manualPct: 0  },
    "Agency fees":            { type: "manual",    manualPct: 10 },
    "Market research":        { type: "manual",    manualPct: 8  },
    "Marketing travel":       { type: "headcount", manualPct: 0  },
  },
  IT: {
    "Software licences":      { type: "headcount", manualPct: 0  },
    "Hardware & equipment":   { type: "headcount", manualPct: 0  },
    "Cloud & hosting":        { type: "revenue",   manualPct: 0  },
    "IT support & AMC":       { type: "headcount", manualPct: 0  },
    "Cybersecurity":          { type: "manual",    manualPct: 10 },
    "IT travel":              { type: "headcount", manualPct: 0  },
  },
};

// ---------------------------------------------------------------------------
// Seed data helpers
// ---------------------------------------------------------------------------
function flat(base: number, overrides: Record<number, number> = {}): number[] {
  return Array.from({ length: 12 }, (_, i) => overrides[i] ?? base);
}

function mkLine(
  dept: Department, glHead: string,
  fy25Actual: number,
  budgeted: number[],
  actuals: number[] = Array(12).fill(0),
): BudgetLine {
  const d = DEFAULT_DRIVERS[dept]?.[glHead] ?? { type: "manual" as DriverType, manualPct: 5 };
  return { dept, glHead, fy25Actual, budgeted, cellFormulas: Array(12).fill(null), actuals, driverType: d.type, manualPct: d.manualPct, subLines: [] };
}

// ---------------------------------------------------------------------------
// Seed lines
// ---------------------------------------------------------------------------
const SEED_LINES: BudgetLine[] = [];

export const DEPT_ASSUMPTIONS_SEED: Record<Department, DeptAssumptions> = {
  HR:          { headcountFY25: 0, headcountFY26: 0, revenueGrowthPct: 0, areaSqftFY25: 0, areaSqftFY26: 0 },
  Operations:  { headcountFY25: 0, headcountFY26: 0, revenueGrowthPct: 0, areaSqftFY25: 0, areaSqftFY26: 0 },
  SCM:         { headcountFY25: 0, headcountFY26: 0, revenueGrowthPct: 0, areaSqftFY25: 0, areaSqftFY26: 0 },
  Maintenance: { headcountFY25: 0, headcountFY26: 0, revenueGrowthPct: 0, areaSqftFY25: 0, areaSqftFY26: 0 },
  Finance:     { headcountFY25: 0, headcountFY26: 0, revenueGrowthPct: 0, areaSqftFY25: 0, areaSqftFY26: 0 },
  Marketing:   { headcountFY25: 0, headcountFY26: 0, revenueGrowthPct: 0, areaSqftFY25: 0, areaSqftFY26: 0 },
  IT:          { headcountFY25: 0, headcountFY26: 0, revenueGrowthPct: 0, areaSqftFY25: 0, areaSqftFY26: 0 },
};

export const SEED_STORE: BudgetStore = {
  fy: FY,
  deptStatus: {
    HR: "draft", Operations: "draft", SCM: "draft",
    Maintenance: "draft", Finance: "draft", Marketing: "draft", IT: "draft",
  },
  assumptions: DEPT_ASSUMPTIONS_SEED,
  lines: SEED_LINES,
};

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
const BUDGET_KEY = "nexa-budget-builder-v2";

export function loadBudgetStore(): BudgetStore {
  if (typeof window === "undefined") return SEED_STORE;
  try {
    const raw = localStorage.getItem(BUDGET_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as BudgetStore;
      // Back-fill any lines missing fy25Actual (migration from v1)
      parsed.lines = parsed.lines.map((l, i) => ({
        ...l,
        fy25Actual:   l.fy25Actual ?? SEED_LINES[i]?.fy25Actual ?? 0,
        driverType:   l.driverType ?? "manual",
        manualPct:    l.manualPct  ?? 5,
        cellFormulas: (l as BudgetLine).cellFormulas ?? Array(12).fill(null),
        subLines:     ((l as BudgetLine).subLines ?? []).map((sl) => ({
          ...sl,
          formulas: sl.formulas ?? Array(12).fill(null),
        })),
      }));
      parsed.assumptions = parsed.assumptions ?? DEPT_ASSUMPTIONS_SEED;
      return parsed;
    }
  } catch { /* ignore */ }
  return SEED_STORE;
}

export function saveBudgetStore(store: BudgetStore): void {
  try { localStorage.setItem(BUDGET_KEY, JSON.stringify(store)); } catch { /* ignore */ }
}

// ---------------------------------------------------------------------------
// Mutation helpers
// ---------------------------------------------------------------------------
export function updateLineCell(
  store: BudgetStore,
  dept: Department, glHead: string,
  field: "budgeted" | "actuals", month: number, value: number,
  formula: string | null = null,
): BudgetStore {
  return {
    ...store,
    lines: store.lines.map((l) => {
      if (l.dept !== dept || l.glHead !== glHead) return l;
      const updated: BudgetLine = { ...l, [field]: l[field].map((v, i) => (i === month ? value : v)) };
      if (field === "budgeted") {
        updated.cellFormulas = l.cellFormulas.map((f, i) => (i === month ? formula : f));
      }
      return updated;
    }),
  };
}

export function updateLineDriver(
  store: BudgetStore,
  dept: Department, glHead: string,
  patch: { driverType?: DriverType; manualPct?: number },
): BudgetStore {
  return {
    ...store,
    lines: store.lines.map((l) =>
      l.dept === dept && l.glHead === glHead ? { ...l, ...patch } : l,
    ),
  };
}

export function applyDriverToMonths(
  store: BudgetStore,
  dept: Department, glHead: string,
): BudgetStore {
  const line = store.lines.find((l) => l.dept === dept && l.glHead === glHead);
  if (!line) return store;
  const assumptions = store.assumptions[dept];
  const changePct = driverChangePct(line, assumptions);
  const annual = suggestedAnnual(line.fy25Actual, changePct);
  const newMonthly = distributeEvenly(annual);
  return {
    ...store,
    lines: store.lines.map((l) =>
      l.dept === dept && l.glHead === glHead ? { ...l, budgeted: newMonthly } : l,
    ),
  };
}

export function updateAssumptions(
  store: BudgetStore,
  dept: Department,
  patch: Partial<DeptAssumptions>,
): BudgetStore {
  return {
    ...store,
    assumptions: { ...store.assumptions, [dept]: { ...store.assumptions[dept], ...patch } },
  };
}

export function updateDeptStatus(store: BudgetStore, dept: Department, status: DeptStatus): BudgetStore {
  return { ...store, deptStatus: { ...store.deptStatus, [dept]: status } };
}

// ---------------------------------------------------------------------------
// Sub-line helpers
// ---------------------------------------------------------------------------
function recomputeBudgeted(line: BudgetLine): BudgetLine {
  if (line.subLines.length === 0) return line;
  const budgeted = Array.from({ length: 12 }, (_, mi) =>
    line.subLines.reduce((s, sl) => s + (sl.cells[mi] ?? 0), 0),
  );
  return { ...line, budgeted };
}

export function addSubLine(store: BudgetStore, dept: Department, glHead: string): BudgetStore {
  return {
    ...store,
    lines: store.lines.map((l) => {
      if (l.dept !== dept || l.glHead !== glHead) return l;
      const id = `sl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newSub: SubLine = { id, label: "Detail item", cells: Array(12).fill(0), formulas: Array(12).fill(null) };
      return recomputeBudgeted({ ...l, subLines: [...l.subLines, newSub] });
    }),
  };
}

export function removeSubLine(
  store: BudgetStore, dept: Department, glHead: string, subId: string,
): BudgetStore {
  return {
    ...store,
    lines: store.lines.map((l) => {
      if (l.dept !== dept || l.glHead !== glHead) return l;
      const subLines = l.subLines.filter((sl) => sl.id !== subId);
      if (subLines.length === 0) return { ...l, subLines };
      return recomputeBudgeted({ ...l, subLines });
    }),
  };
}

export function updateSubLineLabel(
  store: BudgetStore, dept: Department, glHead: string, subId: string, label: string,
): BudgetStore {
  return {
    ...store,
    lines: store.lines.map((l) => {
      if (l.dept !== dept || l.glHead !== glHead) return l;
      return { ...l, subLines: l.subLines.map((sl) => sl.id === subId ? { ...sl, label } : sl) };
    }),
  };
}

export function updateSubLineCell(
  store: BudgetStore, dept: Department, glHead: string, subId: string, mi: number, val: number,
  formula: string | null = null,
): BudgetStore {
  return {
    ...store,
    lines: store.lines.map((l) => {
      if (l.dept !== dept || l.glHead !== glHead) return l;
      const subLines = l.subLines.map((sl) =>
        sl.id === subId
          ? {
              ...sl,
              cells:    sl.cells.map((v, i) => (i === mi ? val : v)),
              formulas: sl.formulas.map((f, i) => (i === mi ? formula : f)),
            }
          : sl,
      );
      return recomputeBudgeted({ ...l, subLines });
    }),
  };
}

// ---------------------------------------------------------------------------
// Status metadata
// ---------------------------------------------------------------------------
export const DEPT_STATUS_META: Record<DeptStatus, { label: string; variant: "default" | "warning" | "success" | "primary" }> = {
  draft:     { label: "Draft",     variant: "default"  },
  submitted: { label: "Submitted", variant: "primary"  },
  approved:  { label: "Approved",  variant: "success"  },
};
