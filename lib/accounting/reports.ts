import type { ReportFilters, Basis } from "./types";
import { CHART_OF_ACCOUNTS, account, accountSafe, SUBTYPE_ORDER } from "./chart-of-accounts";
import { periodMovement, cumulativeBalance, allPostings } from "./ledger";
import { ENTITIES } from "./org";

export interface Row {
  code: string;
  name: string;
  amount: number;
}
export interface Section {
  label: string;
  rows: Row[];
  total: number;
}

function sectionsBySubtype(
  entries: Array<{ code: string; amount: number }>,
  order = SUBTYPE_ORDER,
): Section[] {
  const map = new Map<string, Row[]>();
  for (const e of entries) {
    if (Math.abs(e.amount) < 0.5) continue;
    const a = account(e.code);
    if (!map.has(a.subtype)) map.set(a.subtype, []);
    map.get(a.subtype)!.push({ code: e.code, name: a.name, amount: e.amount });
  }
  const out: Section[] = [];
  for (const sub of order) {
    const rows = map.get(sub);
    if (!rows || rows.length === 0) continue;
    rows.sort((a, b) => a.code.localeCompare(b.code));
    out.push({ label: sub, rows, total: rows.reduce((s, r) => s + r.amount, 0) });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Profit & Loss
// ---------------------------------------------------------------------------
export interface PnL {
  revenue: Section[];
  totalRevenue: number;
  cogs: Section[];
  totalCogs: number;
  grossProfit: number;
  grossMargin: number;
  opex: Section[];
  totalOpex: number;
  finance: Section[];
  totalFinance: number;
  otherIncome: Section[];
  totalOtherIncome: number;
  operatingProfit: number;
  netProfit: number;
  netMargin: number;
}

export function buildPnL(f: ReportFilters): PnL {
  const mv = periodMovement(f);
  const incomeEntries: Array<{ code: string; amount: number }> = [];
  const cogsEntries: Array<{ code: string; amount: number }> = [];
  const opexEntries: Array<{ code: string; amount: number }> = [];
  const financeEntries: Array<{ code: string; amount: number }> = [];
  const otherIncomeEntries: Array<{ code: string; amount: number }> = [];

  for (const a of CHART_OF_ACCOUNTS) {
    const bal = mv.get(a.code) ?? 0;
    if (a.type === "income") {
      const amount = -bal; // credit-normal
      if (a.subtype === "Other Income") otherIncomeEntries.push({ code: a.code, amount });
      else incomeEntries.push({ code: a.code, amount });
    } else if (a.type === "expense") {
      const amount = bal; // debit-normal
      if (a.subtype === "Cost of Sales") cogsEntries.push({ code: a.code, amount });
      else if (a.subtype === "Finance Costs") financeEntries.push({ code: a.code, amount });
      else opexEntries.push({ code: a.code, amount });
    }
  }

  const sum = (e: Array<{ amount: number }>) => e.reduce((s, x) => s + x.amount, 0);
  const totalRevenue = sum(incomeEntries);
  const totalCogs = sum(cogsEntries);
  const grossProfit = totalRevenue - totalCogs;
  const totalOpex = sum(opexEntries);
  const totalFinance = sum(financeEntries);
  const totalOtherIncome = sum(otherIncomeEntries);
  const operatingProfit = grossProfit - totalOpex;
  const netProfit = operatingProfit + totalOtherIncome - totalFinance;

  return {
    revenue: sectionsBySubtype(incomeEntries),
    totalRevenue,
    cogs: sectionsBySubtype(cogsEntries),
    totalCogs,
    grossProfit,
    grossMargin: totalRevenue ? grossProfit / totalRevenue : 0,
    opex: sectionsBySubtype(opexEntries),
    totalOpex,
    finance: sectionsBySubtype(financeEntries),
    totalFinance,
    otherIncome: sectionsBySubtype(otherIncomeEntries),
    totalOtherIncome,
    operatingProfit,
    netProfit,
    netMargin: totalRevenue ? netProfit / totalRevenue : 0,
  };
}

// ---------------------------------------------------------------------------
// Balance Sheet (as of `to`)
// ---------------------------------------------------------------------------
export interface BalanceSheet {
  assets: Section[];
  totalAssets: number;
  liabilities: Section[];
  totalLiabilities: number;
  equity: Section[];
  retainedEarnings: number;
  totalEquity: number;
  totalLiabAndEquity: number;
  check: number; // should be ~0
}

export function buildBalanceSheet(f: ReportFilters): BalanceSheet {
  const bal = cumulativeBalance(f, f.to);
  const assetEntries: Array<{ code: string; amount: number }> = [];
  const liabEntries: Array<{ code: string; amount: number }> = [];
  const equityEntries: Array<{ code: string; amount: number }> = [];
  let plNet = 0;

  for (const a of CHART_OF_ACCOUNTS) {
    const b = bal.get(a.code) ?? 0;
    if (a.type === "asset") assetEntries.push({ code: a.code, amount: b });
    else if (a.type === "liability") liabEntries.push({ code: a.code, amount: -b });
    else if (a.type === "equity") equityEntries.push({ code: a.code, amount: -b });
    else plNet += b; // income+expense (d-c)
  }
  const retainedEarnings = -plNet; // net profit retained to date

  const assets = sectionsBySubtype(assetEntries);
  const liabilities = sectionsBySubtype(liabEntries);
  const equity = sectionsBySubtype(equityEntries);

  const totalAssets = assets.reduce((s, x) => s + x.total, 0);
  const totalLiabilities = liabilities.reduce((s, x) => s + x.total, 0);
  const totalEquity = equity.reduce((s, x) => s + x.total, 0) + retainedEarnings;
  const totalLiabAndEquity = totalLiabilities + totalEquity;

  return {
    assets,
    totalAssets,
    liabilities,
    totalLiabilities,
    equity,
    retainedEarnings,
    totalEquity,
    totalLiabAndEquity,
    check: totalAssets - totalLiabAndEquity,
  };
}

// ---------------------------------------------------------------------------
// Cash Flow (indirect method, derived so it always reconciles)
// ---------------------------------------------------------------------------
export interface CashFlow {
  netProfit: number;
  operating: Row[];
  netOperating: number;
  investing: Row[];
  netInvesting: number;
  financing: Row[];
  netFinancing: number;
  netChange: number;
  openingCash: number;
  closingCash: number;
}

function cashBalance(f: ReportFilters, predicate: (date: string) => boolean): number {
  let total = 0;
  for (const p of allPostings()) {
    if (p.basis !== f.basis) continue;
    if (f.entityId !== "all" && p.entityId !== f.entityId) continue;
    if (f.locationId !== "all" && p.locationId !== f.locationId) continue;
    if (f.state !== "all" && p.state !== f.state) continue;
    if (!account(p.accountCode).isCash) continue;
    if (!predicate(p.date)) continue;
    total += p.debit - p.credit;
  }
  return total;
}

export function buildCashFlow(f: ReportFilters): CashFlow {
  const mv = periodMovement(f);
  let netProfit = 0;
  const operating: Row[] = [];
  const investing: Row[] = [];
  const financing: Row[] = [];

  for (const a of CHART_OF_ACCOUNTS) {
    const m = mv.get(a.code) ?? 0;
    if (a.type === "income" || a.type === "expense") {
      netProfit += -m;
      continue;
    }
    if (a.isCash) continue; // cash itself is the result, not a line
    const contribution = -m; // change in cash from this account's movement
    if (Math.abs(contribution) < 0.5) continue;
    const row: Row = { code: a.code, name: workingCapitalLabel(a), amount: contribution };
    if (a.cashFlow === "investing") investing.push(row);
    else if (a.cashFlow === "financing") financing.push(row);
    else operating.push(row);
  }

  const netOperating = netProfit + operating.reduce((s, r) => s + r.amount, 0);
  const netInvesting = investing.reduce((s, r) => s + r.amount, 0);
  const netFinancing = financing.reduce((s, r) => s + r.amount, 0);
  const netChange = netOperating + netInvesting + netFinancing;

  const openingCash = cashBalance(f, (d) => !!f.from && d < f.from);
  const closingCash = cashBalance(f, (d) => !f.to || d <= f.to);

  return {
    netProfit,
    operating,
    netOperating,
    investing,
    netInvesting,
    financing,
    netFinancing,
    netChange,
    openingCash,
    closingCash,
  };
}

function workingCapitalLabel(a: { code: string; name: string; type: string }): string {
  if (a.type === "asset") return `(Increase)/decrease in ${a.name}`;
  return `Increase/(decrease) in ${a.name}`;
}

// ---------------------------------------------------------------------------
// Dashboard helpers
// ---------------------------------------------------------------------------
export interface TrendPoint {
  month: string; // YYYY-MM
  revenue: number;
  expense: number;
  profit: number;
}

export function monthlyTrend(f: ReportFilters): TrendPoint[] {
  const map = new Map<string, { revenue: number; expense: number }>();
  for (const p of allPostings()) {
    if (p.basis !== f.basis) continue;
    if (f.entityId !== "all" && p.entityId !== f.entityId) continue;
    if (f.locationId !== "all" && p.locationId !== f.locationId) continue;
    if (f.state !== "all" && p.state !== f.state) continue;
    if (f.from && p.date < f.from) continue;
    if (f.to && p.date > f.to) continue;
    const a = accountSafe(p.accountCode);
    if (!a || (a.type !== "income" && a.type !== "expense")) continue;
    const key = p.date.slice(0, 7);
    if (!map.has(key)) map.set(key, { revenue: 0, expense: 0 });
    const m = map.get(key)!;
    if (a.type === "income") m.revenue += p.credit - p.debit;
    else m.expense += p.debit - p.credit;
  }
  return Array.from(map.entries())
    .sort((a, b) => (a[0] < b[0] ? -1 : 1))
    .map(([month, v]) => ({ month, revenue: v.revenue, expense: v.expense, profit: v.revenue - v.expense }));
}

export interface EntitySlice {
  id: string;
  name: string;
  revenue: number;
  profit: number;
}

export function entityBreakdown(basis: Basis, from: string, to: string): EntitySlice[] {
  const rev = new Map<string, number>();
  const prof = new Map<string, number>();
  for (const p of allPostings()) {
    if (p.basis !== basis) continue;
    if (from && p.date < from) continue;
    if (to && p.date > to) continue;
    const a = accountSafe(p.accountCode);
    if (!a) continue;
    if (a.type === "income") {
      const v = p.credit - p.debit;
      rev.set(p.entityId, (rev.get(p.entityId) ?? 0) + v);
      prof.set(p.entityId, (prof.get(p.entityId) ?? 0) + v);
    } else if (a.type === "expense") {
      prof.set(p.entityId, (prof.get(p.entityId) ?? 0) - (p.debit - p.credit));
    }
  }
  return ENTITIES.map((e) => ({
    id: e.id,
    name: e.name,
    revenue: rev.get(e.id) ?? 0,
    profit: prof.get(e.id) ?? 0,
  }));
}

/** Month-by-month contribution of a single account, in statement sign. */
export function accountMonthly(f: ReportFilters, code: string): Array<{ month: string; amount: number }> {
  const a = accountSafe(code);
  if (!a) return [];
  // Income/liability/equity are credit-normal → flip so the figure reads positive.
  const sign = a.type === "income" || a.type === "liability" || a.type === "equity" ? -1 : 1;
  const map = new Map<string, number>();
  for (const p of allPostings()) {
    if (p.basis !== f.basis) continue;
    if (f.entityId !== "all" && p.entityId !== f.entityId) continue;
    if (f.locationId !== "all" && p.locationId !== f.locationId) continue;
    if (f.state !== "all" && p.state !== f.state) continue;
    if (f.from && p.date < f.from) continue;
    if (f.to && p.date > f.to) continue;
    if (p.accountCode !== code) continue;
    const key = p.date.slice(0, 7);
    map.set(key, (map.get(key) ?? 0) + sign * (p.debit - p.credit));
  }
  return Array.from(map.entries())
    .sort((x, y) => (x[0] < y[0] ? -1 : 1))
    .map(([month, amount]) => ({ month, amount }));
}

export function cashAndReceivables(f: ReportFilters): { cash: number; receivables: number; payables: number } {
  const bal = cumulativeBalance(f, f.to);
  let cash = 0;
  for (const a of CHART_OF_ACCOUNTS) {
    if (a.isCash) cash += bal.get(a.code) ?? 0;
  }
  return {
    cash,
    receivables: bal.get("1100") ?? 0,
    payables: -(bal.get("2010") ?? 0),
  };
}
