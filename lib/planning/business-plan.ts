// Business-plan generator. Assembles an investor-ready startup plan from the
// live org, product, team and ledger data, overlaid with editable narrative +
// assumptions (persisted). Financials recompute from the books, so the plan is
// "updated on the go".

import { allPostings } from "@/lib/accounting/ledger";
import { accountSafe } from "@/lib/accounting/chart-of-accounts";
import { ENTITIES, LOCATIONS } from "@/lib/accounting/org";
import { FINISHED_ITEMS, explodedUnitCost } from "@/lib/inventory/items";
import { ACTIVE_EMPLOYEES, DEPARTMENTS, departmentName } from "@/lib/hr/employees";

export interface UseOfFund {
  label: string;
  pct: number; // fraction
}

export interface Milestone {
  when: string;
  label: string;
}

export interface PlanInputs {
  companyName: string;
  tagline: string;
  execSummary: string;
  problem: string;
  solution: string;
  targetCustomer: string;
  marketTamCr: number; // ₹ crore
  marketSamCr: number;
  marketSomCr: number;
  projectionYears: number;
  revenueCagr: number; // fraction
  targetCostRatio: number; // long-run cost / revenue
  fundingAskCr: number; // ₹ crore
  useOfFunds: UseOfFund[];
  milestones: Milestone[];
}

export interface BaseFinancials {
  revenue: number;
  cogs: number;
  opex: number;
  cost: number;
  net: number;
  costRatio: number;
  grossMargin: number;
}

export interface YearProjection {
  label: string;
  year: number; // 0 = current
  revenue: number;
  cost: number;
  net: number;
  margin: number;
  ratio: number; // cost / revenue
}

export interface ProductLine {
  name: string;
  price: number;
  unitCost: number;
  margin: number; // fraction
}

export interface TeamSummary {
  total: number;
  byDept: { dept: string; count: number }[];
  leadership: { name: string; title: string }[];
}

export interface BusinessPlan {
  inputs: PlanInputs;
  base: BaseFinancials;
  projections: YearProjection[];
  products: ProductLine[];
  team: TeamSummary;
  entities: { name: string; legalName: string; country: string }[];
  locations: number;
}

const CR = 1e7; // one crore in rupees

export function defaultInputs(base: BaseFinancials): PlanInputs {
  return {
    companyName: "",
    tagline: "",
    execSummary: "",
    problem: "",
    solution: "",
    targetCustomer: "",
    marketTamCr: 0,
    marketSamCr: 0,
    marketSomCr: 0,
    projectionYears: 4,
    revenueCagr: 0.35,
    targetCostRatio: Math.max(0.7, Math.min(base.costRatio || 0.82, 0.9)) - 0.06,
    fundingAskCr: 0,
    useOfFunds: [],
    milestones: [],
  };
}

export function baseFinancials(fromIso: string, toIso: string): BaseFinancials {
  let revenue = 0,
    cogs = 0,
    opex = 0;
  for (const p of allPostings()) {
    if (p.basis !== "accrual") continue;
    if (p.date < fromIso || p.date > toIso) continue;
    const a = accountSafe(p.accountCode);
    if (!a) continue;
    if (a.type === "income") revenue += p.credit - p.debit;
    else if (a.type === "expense") {
      const amt = p.debit - p.credit;
      if (a.subtype === "Cost of Sales") cogs += amt;
      else opex += amt;
    }
  }
  const cost = cogs + opex;
  return {
    revenue,
    cogs,
    opex,
    cost,
    net: revenue - cost,
    costRatio: revenue ? cost / revenue : 0,
    grossMargin: revenue ? (revenue - cogs) / revenue : 0,
  };
}

function projections(base: BaseFinancials, inputs: PlanInputs, baseLabel: string): YearProjection[] {
  const out: YearProjection[] = [
    {
      label: baseLabel,
      year: 0,
      revenue: base.revenue,
      cost: base.cost,
      net: base.net,
      margin: base.revenue ? base.net / base.revenue : 0,
      ratio: base.costRatio,
    },
  ];
  const startRatio = base.costRatio || 0.85;
  const n = inputs.projectionYears;
  for (let i = 1; i <= n; i++) {
    const revenue = base.revenue * Math.pow(1 + inputs.revenueCagr, i);
    const ratio = startRatio + (inputs.targetCostRatio - startRatio) * (i / n);
    const cost = revenue * ratio;
    const net = revenue - cost;
    out.push({
      label: `Year ${i}`,
      year: i,
      revenue,
      cost,
      net,
      margin: revenue ? net / revenue : 0,
      ratio,
    });
  }
  return out;
}

function teamSummary(): TeamSummary {
  const counts = new Map<string, number>();
  for (const e of ACTIVE_EMPLOYEES) counts.set(e.departmentId, (counts.get(e.departmentId) ?? 0) + 1);
  const byDept = DEPARTMENTS.map((d) => ({ dept: d.name, count: counts.get(d.id) ?? 0 })).filter(
    (d) => d.count > 0,
  );
  const leadership = ACTIVE_EMPLOYEES.filter((e) =>
    /chief|head|vp|director|president/i.test(e.designation),
  )
    .slice(0, 8)
    .map((e) => ({ name: e.name, title: e.designation }));
  return { total: ACTIVE_EMPLOYEES.length, byDept, leadership };
}

export function buildBusinessPlan(
  fromIso: string,
  toIso: string,
  baseLabel: string,
  stored?: Partial<PlanInputs>,
): BusinessPlan {
  const base = baseFinancials(fromIso, toIso);
  const inputs: PlanInputs = { ...defaultInputs(base), ...(stored ?? {}) };
  // Guard merged arrays against bad stored data.
  if (!Array.isArray(inputs.useOfFunds) || !inputs.useOfFunds.length)
    inputs.useOfFunds = defaultInputs(base).useOfFunds;
  if (!Array.isArray(inputs.milestones)) inputs.milestones = defaultInputs(base).milestones;

  const products: ProductLine[] = FINISHED_ITEMS.map((it) => {
    const unitCost = explodedUnitCost(it.id);
    return { name: it.name, price: it.rate, unitCost, margin: it.rate ? (it.rate - unitCost) / it.rate : 0 };
  });

  return {
    inputs,
    base,
    projections: projections(base, inputs, baseLabel),
    products,
    team: teamSummary(),
    entities: ENTITIES.map((e) => ({ name: e.name, legalName: e.legalName, country: e.country })),
    locations: LOCATIONS.length,
  };
}

const KEY = "nexa-business-plan";

export function loadPlanInputs(): Partial<PlanInputs> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function savePlanInputs(inputs: PlanInputs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(inputs));
  } catch {}
}

export const CRORE = CR;
