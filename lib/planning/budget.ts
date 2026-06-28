// Budgeting & forecasting engine. Builds a 12-month (Indian FY, Apr–Mar) plan
// per P&L line, seeded from the prior year's actuals × a growth assumption, then
// overlays live actuals and projects the remaining months forward (budget or
// run-rate). All cell edits + assumptions persist to localStorage so the plan is
// "updated on the go".

import type { Basis } from "@/lib/accounting/types";
import { allPostings } from "@/lib/accounting/ledger";
import { CHART_OF_ACCOUNTS, accountSafe } from "@/lib/accounting/chart-of-accounts";
import { fyLabel } from "@/lib/accounting/periods";

export interface BudgetAssumptions {
  revenueGrowth: number; // fraction, e.g. 0.12
  costGrowth: number;
  forecastMethod: "budget" | "runrate";
}

export const DEFAULT_ASSUMPTIONS: BudgetAssumptions = {
  revenueGrowth: 0.15,
  costGrowth: 0.08,
  forecastMethod: "budget",
};

export interface BudgetLine {
  code: string;
  name: string;
  type: "income" | "expense";
  subtype: string;
  budget: number[]; // 12
  actual: number[]; // 12 (0 for future months)
  prior: number[]; // 12 prior-year actuals
}

export interface BudgetModel {
  fyStart: number;
  fyName: string;
  months: string[]; // "YYYY-MM"
  monthLabels: string[];
  lines: BudgetLine[];
  asOfMonth: string; // "YYYY-MM" — months strictly before this are "actual"
  elapsed: number; // count of elapsed months
}

export function fyMonths(fyStart: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = ((3 + i) % 12) + 1;
    const y = fyStart + Math.floor((3 + i) / 12);
    out.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return out;
}

export function monthShort(ym: string): string {
  const [y, m] = ym.split("-");
  const names = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${names[Number(m)]} ${y.slice(2)}`;
}

/** Monthly actuals per account for one FY, scoped to an entity + basis. */
function monthlyByAccount(entityId: string, basis: Basis, fyStart: number): Map<string, number[]> {
  const months = fyMonths(fyStart);
  const index = new Map(months.map((m, i) => [m, i]));
  const out = new Map<string, number[]>();
  for (const p of allPostings()) {
    if (p.basis !== basis) continue;
    if (entityId !== "all" && p.entityId !== entityId) continue;
    const ym = p.date.slice(0, 7);
    const i = index.get(ym);
    if (i === undefined) continue;
    const a = accountSafe(p.accountCode);
    if (!a || (a.type !== "income" && a.type !== "expense")) continue;
    if (!out.has(p.accountCode)) out.set(p.accountCode, new Array(12).fill(0));
    const arr = out.get(p.accountCode)!;
    arr[i] += a.type === "income" ? p.credit - p.debit : p.debit - p.credit;
  }
  return out;
}

// ---- Persistence -----------------------------------------------------------
const overrideKey = (entityId: string, fyStart: number) => `nexa-budget:${entityId}:${fyStart}`;
const ASSUMPTION_KEY = "nexa-budget-assumptions";

export type BudgetOverrides = Record<string, number>; // "code:monthIdx" -> value

export function loadOverrides(entityId: string, fyStart: number): BudgetOverrides {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(overrideKey(entityId, fyStart)) ?? "{}");
  } catch {
    return {};
  }
}

export function saveOverrides(entityId: string, fyStart: number, ov: BudgetOverrides) {
  try {
    localStorage.setItem(overrideKey(entityId, fyStart), JSON.stringify(ov));
  } catch {}
}

export function loadAssumptions(): BudgetAssumptions {
  if (typeof window === "undefined") return DEFAULT_ASSUMPTIONS;
  try {
    return { ...DEFAULT_ASSUMPTIONS, ...JSON.parse(localStorage.getItem(ASSUMPTION_KEY) ?? "{}") };
  } catch {
    return DEFAULT_ASSUMPTIONS;
  }
}

export function saveAssumptions(a: BudgetAssumptions) {
  try {
    localStorage.setItem(ASSUMPTION_KEY, JSON.stringify(a));
  } catch {}
}

// ---- Builder ---------------------------------------------------------------
export function buildBudget(
  entityId: string,
  basis: Basis,
  fyStart: number,
  asOfMonth: string,
  assumptions: BudgetAssumptions,
  overrides: BudgetOverrides,
): BudgetModel {
  const months = fyMonths(fyStart);
  const actuals = monthlyByAccount(entityId, basis, fyStart);
  const priors = monthlyByAccount(entityId, basis, fyStart - 1);

  const lines: BudgetLine[] = [];
  for (const a of CHART_OF_ACCOUNTS) {
    if (a.type !== "income" && a.type !== "expense") continue;
    const actual = actuals.get(a.code) ?? new Array(12).fill(0);
    const prior = priors.get(a.code) ?? new Array(12).fill(0);
    const growth = a.type === "income" ? assumptions.revenueGrowth : assumptions.costGrowth;
    const budget = months.map((_, i) => {
      const ov = overrides[`${a.code}:${i}`];
      if (ov !== undefined) return ov;
      const seed = prior[i] * (1 + growth);
      return Math.round(seed);
    });
    lines.push({ code: a.code, name: a.name, type: a.type, subtype: a.subtype, budget, actual, prior });
  }

  const elapsed = months.filter((m) => m < asOfMonth).length;
  return {
    fyStart,
    fyName: fyLabel(fyStart),
    months,
    monthLabels: months.map(monthShort),
    lines,
    asOfMonth,
    elapsed,
  };
}

// ---- Derived metrics -------------------------------------------------------
export function lineForecast(line: BudgetLine, elapsed: number, method: BudgetAssumptions["forecastMethod"]): number[] {
  const out = new Array(12).fill(0);
  const elapsedActuals = line.actual.slice(0, elapsed);
  const runRate = elapsedActuals.length ? elapsedActuals.reduce((s, v) => s + v, 0) / elapsedActuals.length : 0;
  for (let i = 0; i < 12; i++) {
    if (i < elapsed) out[i] = line.actual[i];
    else out[i] = method === "runrate" ? Math.round(runRate) : line.budget[i];
  }
  return out;
}

export const sum = (a: number[]) => a.reduce((s, v) => s + v, 0);

export interface PlanTotals {
  revenueBudget: number;
  revenueActual: number;
  revenueForecast: number;
  costBudget: number;
  costActual: number;
  costForecast: number;
  netBudget: number;
  netForecast: number;
  netActual: number;
}

export function planTotals(model: BudgetModel, method: BudgetAssumptions["forecastMethod"]): PlanTotals {
  let revenueBudget = 0,
    revenueActual = 0,
    revenueForecast = 0,
    costBudget = 0,
    costActual = 0,
    costForecast = 0;
  for (const l of model.lines) {
    const fc = sum(lineForecast(l, model.elapsed, method));
    const b = sum(l.budget);
    const a = sum(l.actual.slice(0, model.elapsed));
    if (l.type === "income") {
      revenueBudget += b;
      revenueActual += a;
      revenueForecast += fc;
    } else {
      costBudget += b;
      costActual += a;
      costForecast += fc;
    }
  }
  return {
    revenueBudget,
    revenueActual,
    revenueForecast,
    costBudget,
    costActual,
    costForecast,
    netBudget: revenueBudget - costBudget,
    netForecast: revenueForecast - costForecast,
    netActual: revenueActual - costActual,
  };
}
