// ---------------------------------------------------------------------------
// Payroll statutory outputs — employer/payroll-owner view.
//
// Computes, per employee, the statutory deductions and employer contributions
// that payroll must deposit & report: PF (EPF/EPS, ECR-style), ESI, Professional
// Tax, projected TDS (via the income-tax engine), Form 24Q quarterly summaries,
// Form 16 datasets, gratuity, and full & final settlement for exited staff.
//
// All amounts are base INR. Monthly figures from salaryStructure(); annual TDS
// is projected through lib/hr/tax-calc.ts (no slab math is re-implemented here).
// ---------------------------------------------------------------------------

import { EMPLOYEES, employeeById } from "./employees";
import { salaryStructure, PAYROLL_RUNS } from "./payroll";
import { locationById, entityById } from "@/lib/accounting/org";
import { compareRegimes, EMPTY_DEDUCTIONS, STANDARD_DEDUCTION, type Regime } from "./tax-calc";
import type { Employee } from "./types";

export const FY_LABEL = "FY 2025-26";
export const AY_LABEL = "AY 2026-27";
const TODAY = "2026-06-18";

// ---- Statutory rate constants ---------------------------------------------

export const PF_RATE = 0.12; // employee & employer each
export const EPS_RATE = 0.0833; // employer share routed to pension
export const EPS_WAGE_CEILING = 15_000; // EPS computed on basic capped here
export const ESI_EMPLOYEE_RATE = 0.0075;
export const ESI_EMPLOYER_RATE = 0.0325;
export const ESI_WAGE_CEILING = 21_000; // ESI applies only if gross ≤ this
export const GRATUITY_FACTOR = 15 / 26; // 15 days' wages per completed year

// Professional tax is a state subject — flat monthly amount per state slab.
const PT_BY_STATE: Record<string, number> = {
  Karnataka: 200,
  Maharashtra: 200,
  Delhi: 0, // no PT levied
  Singapore: 0, // non-Indian payroll
};

export function ptForState(state: string | undefined): number {
  if (!state) return 0;
  return PT_BY_STATE[state] ?? 200;
}

// ---- Helpers ---------------------------------------------------------------

function yearsBetween(fromIso: string, toIso: string): number {
  const from = new Date(fromIso).getTime();
  const to = new Date(toIso).getTime();
  return Math.max(0, (to - from) / (365.25 * 24 * 3600 * 1000));
}

function empState(emp: Employee): string | undefined {
  return locationById(emp.locationId)?.state;
}

// ---------------------------------------------------------------------------
// PF — EPF / EPS split (ECR style)
// ---------------------------------------------------------------------------

export interface PfLine {
  empId: string;
  name: string;
  basic: number; // monthly PF wages (basic)
  employeePf: number; // 12% of basic
  employerEps: number; // 8.33% of min(basic, ceiling) → pension
  employerEpf: number; // employer 12% − EPS → provident
  employerTotal: number; // employerEps + employerEpf
  total: number; // employee + employer
}

export function pfLine(empId: string): PfLine {
  const emp = employeeById(empId)!;
  const s = salaryStructure(empId);
  const basic = s.basic;
  const employeePf = Math.round(basic * PF_RATE);
  const epsBase = Math.min(basic, EPS_WAGE_CEILING);
  const employerEps = Math.round(epsBase * EPS_RATE);
  const employerTotal = Math.round(basic * PF_RATE);
  const employerEpf = employerTotal - employerEps;
  return {
    empId,
    name: emp.name,
    basic,
    employeePf,
    employerEps,
    employerEpf,
    employerTotal,
    total: employeePf + employerTotal,
  };
}

export interface PfChallan {
  lines: PfLine[];
  totalWages: number;
  employeePf: number;
  employerEps: number;
  employerEpf: number;
  total: number; // grand challan total
}

export function pfChallan(empIds: string[]): PfChallan {
  const lines = empIds.map(pfLine);
  return lines.reduce<PfChallan>(
    (acc, l) => {
      acc.totalWages += l.basic;
      acc.employeePf += l.employeePf;
      acc.employerEps += l.employerEps;
      acc.employerEpf += l.employerEpf;
      acc.total += l.total;
      return acc;
    },
    { lines, totalWages: 0, employeePf: 0, employerEps: 0, employerEpf: 0, total: 0 },
  );
}

// ---------------------------------------------------------------------------
// ESI — applicable only when gross monthly ≤ ₹21,000
// ---------------------------------------------------------------------------

export interface EsiLine {
  empId: string;
  name: string;
  gross: number;
  applicable: boolean;
  employee: number; // 0.75%
  employer: number; // 3.25%
  total: number;
}

export function esiLine(empId: string): EsiLine {
  const emp = employeeById(empId)!;
  const s = salaryStructure(empId);
  const applicable = s.gross <= ESI_WAGE_CEILING;
  const employee = applicable ? Math.round(s.gross * ESI_EMPLOYEE_RATE) : 0;
  const employer = applicable ? Math.round(s.gross * ESI_EMPLOYER_RATE) : 0;
  return { empId, name: emp.name, gross: s.gross, applicable, employee, employer, total: employee + employer };
}

export interface EsiChallan {
  lines: EsiLine[];
  covered: number; // count of covered employees
  employee: number;
  employer: number;
  total: number;
}

export function esiChallan(empIds: string[]): EsiChallan {
  const lines = empIds.map(esiLine);
  return lines.reduce<EsiChallan>(
    (acc, l) => {
      if (l.applicable) acc.covered += 1;
      acc.employee += l.employee;
      acc.employer += l.employer;
      acc.total += l.total;
      return acc;
    },
    { lines, covered: 0, employee: 0, employer: 0, total: 0 },
  );
}

// ---------------------------------------------------------------------------
// Professional Tax — per state slab
// ---------------------------------------------------------------------------

export interface PtLine {
  empId: string;
  name: string;
  state: string;
  monthly: number;
}

export function ptLine(empId: string): PtLine {
  const emp = employeeById(empId)!;
  const state = empState(emp) ?? "—";
  return { empId, name: emp.name, state, monthly: ptForState(state) };
}

export interface PtSummary {
  lines: PtLine[];
  byState: { state: string; count: number; total: number }[];
  total: number;
}

export function ptSummary(empIds: string[]): PtSummary {
  const lines = empIds.map(ptLine);
  const map = new Map<string, { state: string; count: number; total: number }>();
  let total = 0;
  for (const l of lines) {
    total += l.monthly;
    const row = map.get(l.state) ?? { state: l.state, count: 0, total: 0 };
    row.count += 1;
    row.total += l.monthly;
    map.set(l.state, row);
  }
  return { lines, byState: [...map.values()], total };
}

// ---------------------------------------------------------------------------
// TDS — annual projection via the income-tax engine (new regime default)
// ---------------------------------------------------------------------------

export interface TdsProjection {
  empId: string;
  name: string;
  annualSalary: number; // = annual CTC, treated as gross income
  regime: Regime; // assumed for projection
  annualTax: number;
  monthlyTds: number;
  betterRegime: Regime | "tie";
  betterSaving: number;
}

/**
 * Projects the year's TDS for an employee. We default to the NEW regime (the
 * statutory default when an employee makes no declaration) and run the engine
 * with only the standard deduction. compareRegimes also surfaces whether the
 * old regime would be cheaper, for payroll's information.
 */
export function tdsProjection(empId: string, regime: Regime = "new"): TdsProjection {
  const emp = employeeById(empId)!;
  const s = salaryStructure(empId);
  const cmp = compareRegimes({ grossIncome: s.annualCtc, deductions: EMPTY_DEDUCTIONS });
  const result = regime === "new" ? cmp.new : cmp.old;
  return {
    empId,
    name: emp.name,
    annualSalary: s.annualCtc,
    regime,
    annualTax: result.totalTax,
    monthlyTds: Math.round(result.totalTax / 12),
    betterRegime: cmp.better,
    betterSaving: cmp.saving,
  };
}

// ---- Form 24Q — quarterly TDS return for FY 25-26 -------------------------

export interface Quarter {
  key: "Q1" | "Q2" | "Q3" | "Q4";
  label: string;
  months: string[]; // payroll-run month keys captured (informational)
}

// FY 2025-26 quarters. Our seeded runs cover Mar–Jun 2026 (i.e. part of Q4 +
// start of next FY); for the demo we attribute the seeded runs to Q4 and model
// the earlier quarters as projections of the same monthly salary.
export const FY_QUARTERS: Quarter[] = [
  { key: "Q1", label: "Q1 · Apr–Jun 2025", months: [] },
  { key: "Q2", label: "Q2 · Jul–Sep 2025", months: [] },
  { key: "Q3", label: "Q3 · Oct–Dec 2025", months: [] },
  { key: "Q4", label: "Q4 · Jan–Mar 2026", months: ["2026-03"] },
];

export interface Form24QRow {
  key: Quarter["key"];
  label: string;
  salaryPaid: number; // total gross paid in the quarter (all employees)
  tdsDeducted: number; // total TDS deducted in the quarter
}

export interface Form24Q {
  rows: Form24QRow[];
  totalSalary: number;
  totalTds: number;
  deductees: number;
}

/** A 24Q summary for the FY: per-quarter salary paid & TDS deducted. */
export function form24Q(empIds: string[]): Form24Q {
  // Monthly aggregate across the chosen employees.
  let monthlyGross = 0;
  let monthlyTds = 0;
  for (const id of empIds) {
    const s = salaryStructure(id);
    monthlyGross += s.gross;
    monthlyTds += s.tds;
  }
  const rows: Form24QRow[] = FY_QUARTERS.map((q) => ({
    key: q.key,
    label: q.label,
    salaryPaid: monthlyGross * 3,
    tdsDeducted: monthlyTds * 3,
  }));
  const totalSalary = rows.reduce((a, r) => a + r.salaryPaid, 0);
  const totalTds = rows.reduce((a, r) => a + r.tdsDeducted, 0);
  return { rows, totalSalary, totalTds, deductees: empIds.length };
}

// ---------------------------------------------------------------------------
// Form 16 — Part A (TDS deposited) + Part B (salary & tax computation)
// ---------------------------------------------------------------------------

export interface Form16PartA {
  employeeName: string;
  employeeCode: string;
  pan: string; // masked / placeholder
  employerName: string;
  employerTan: string;
  assessmentYear: string;
  financialYear: string;
  quarterly: { quarter: Quarter["key"]; tdsDeposited: number }[];
  totalTdsDeposited: number;
}

export interface Form16PartB {
  grossSalary: number;
  basic: number;
  hra: number;
  special: number;
  standardDeduction: number;
  professionalTax: number;
  chapterViaDeductions: number; // 80C etc. — 0 under default new regime
  taxableIncome: number;
  taxOnIncome: number;
  cessIncludedTax: number; // total tax incl. cess (== annual tax)
  regime: Regime;
}

export interface Form16 {
  empId: string;
  partA: Form16PartA;
  partB: Form16PartB;
}

export function buildForm16(empId: string, regime: Regime = "new"): Form16 {
  const emp = employeeById(empId)!;
  const s = salaryStructure(empId);
  const proj = tdsProjection(empId, regime);
  const entity = entityById(emp.entityId);
  const annualBasic = s.basic * 12;
  const annualHra = s.hra * 12;
  const annualSpecial = s.special * 12;
  const annualPt = ptForState(empState(emp)) * 12;
  const std = STANDARD_DEDUCTION[regime];
  const annualGross = s.gross * 12;
  const taxableIncome = Math.max(0, annualGross - std);

  const perQuarter = Math.round(proj.annualTax / 4);
  const quarterly = FY_QUARTERS.map((q, i) => ({
    quarter: q.key,
    // spread the annual TDS evenly, last quarter absorbs rounding
    tdsDeposited: i === FY_QUARTERS.length - 1 ? proj.annualTax - perQuarter * 3 : perQuarter,
  }));

  return {
    empId,
    partA: {
      employeeName: emp.name,
      employeeCode: emp.code,
      pan: `ABCPX${emp.code.replace(/\D/g, "")}K`,
      employerName: entity?.legalName ?? "NEXA",
      employerTan: "BLRN01234E",
      assessmentYear: AY_LABEL,
      financialYear: FY_LABEL,
      quarterly,
      totalTdsDeposited: proj.annualTax,
    },
    partB: {
      grossSalary: annualGross,
      basic: annualBasic,
      hra: annualHra,
      special: annualSpecial,
      standardDeduction: std,
      professionalTax: annualPt,
      chapterViaDeductions: 0,
      taxableIncome,
      taxOnIncome: proj.annualTax,
      cessIncludedTax: proj.annualTax,
      regime,
    },
  };
}

// ---------------------------------------------------------------------------
// Gratuity — (15/26) × last basic × completed years (payable on exit ≥ 5 yrs)
// ---------------------------------------------------------------------------

export interface GratuityLine {
  empId: string;
  name: string;
  joinDate: string;
  years: number; // completed years of service (as of today / exit)
  lastBasic: number; // monthly basic
  eligible: boolean; // ≥ 5 years
  amount: number; // gratuity payable
}

export function gratuityLine(empId: string): GratuityLine {
  const emp = employeeById(empId)!;
  const s = salaryStructure(empId);
  const asOf = emp.exitDate ?? TODAY;
  const years = yearsBetween(emp.joinDate, asOf);
  const completed = Math.floor(years);
  const eligible = completed >= 5;
  const amount = eligible ? Math.round(GRATUITY_FACTOR * s.basic * completed) : 0;
  return { empId, name: emp.name, joinDate: emp.joinDate, years: completed, lastBasic: s.basic, eligible, amount };
}

export function gratuityLines(empIds: string[]): GratuityLine[] {
  return empIds.map(gratuityLine);
}

// ---------------------------------------------------------------------------
// Full & Final settlement — for exited employees
// ---------------------------------------------------------------------------

// Seeded leave-encashment days & recoveries per exited employee (demo data).
const FNF_SEED: Record<string, { pendingDays: number; leaveDays: number; recoveries: number }> = {
  "emp-015": { pendingDays: 15, leaveDays: 12, recoveries: 18_000 },
};

export interface FnfSettlement {
  empId: string;
  name: string;
  exitDate: string;
  pendingSalaryDays: number;
  pendingSalary: number; // pro-rata gross for unpaid days
  leaveDays: number;
  leaveEncashment: number; // basic-rate per-day × leave days
  gratuity: number;
  recoveries: number; // notice shortfall / asset / advance recovery
  net: number; // pending + leave + gratuity − recoveries
}

export function fnfSettlement(empId: string): FnfSettlement | null {
  const emp = employeeById(empId);
  if (!emp || emp.status !== "exited" || !emp.exitDate) return null;
  const seed = FNF_SEED[empId] ?? { pendingDays: 0, leaveDays: 0, recoveries: 0 };
  const s = salaryStructure(empId);
  const perDayGross = Math.round(s.gross / 30);
  const perDayBasic = Math.round(s.basic / 30);
  const pendingSalary = perDayGross * seed.pendingDays;
  const leaveEncashment = perDayBasic * seed.leaveDays;
  const grat = gratuityLine(empId).amount;
  const net = pendingSalary + leaveEncashment + grat - seed.recoveries;
  return {
    empId,
    name: emp.name,
    exitDate: emp.exitDate,
    pendingSalaryDays: seed.pendingDays,
    pendingSalary,
    leaveDays: seed.leaveDays,
    leaveEncashment,
    gratuity: grat,
    recoveries: seed.recoveries,
    net,
  };
}

/** All exited employees with an F&F settlement. */
export function fnfSettlements(): FnfSettlement[] {
  return EMPLOYEES.filter((e) => e.status === "exited")
    .map((e) => fnfSettlement(e.id))
    .filter((f): f is FnfSettlement => f !== null);
}

// ---------------------------------------------------------------------------
// Roster + aggregate helpers
// ---------------------------------------------------------------------------

/** Active (non-exited) employees — the statutory payroll population. */
export function statutoryRoster(): Employee[] {
  return EMPLOYEES.filter((e) => e.status !== "exited");
}

export const STATUTORY_RUN_MONTHS = PAYROLL_RUNS.map((r) => ({ month: r.month, label: r.label }));

export interface StatutoryTotals {
  pf: number; // PF challan grand total
  esi: number; // ESI challan total
  pt: number; // PT monthly total
  tds: number; // monthly TDS total
}

/** Headline challan totals for a chosen population (defaults to active roster). */
export function statutoryTotals(empIds: string[]): StatutoryTotals {
  return {
    pf: pfChallan(empIds).total,
    esi: esiChallan(empIds).total,
    pt: ptSummary(empIds).total,
    tds: empIds.reduce((a, id) => a + salaryStructure(id).tds, 0),
  };
}

/** Builds a plain-text PF ECR file body (visual/download affordance only). */
export function pfEcrText(empIds: string[]): string {
  const challan = pfChallan(empIds);
  const header = "#~#UAN~MemberName~GrossWages~EPFWages~EPSWages~EmployeePF~EmployerEPS~EmployerEPF";
  const rows = challan.lines.map((l) =>
    [
      `UAN${l.empId.replace(/\D/g, "")}`,
      l.name,
      l.basic,
      l.basic,
      Math.min(l.basic, EPS_WAGE_CEILING),
      l.employeePf,
      l.employerEps,
      l.employerEpf,
    ].join("~"),
  );
  const footer = `#TOTAL~~${challan.totalWages}~~~${challan.employeePf}~${challan.employerEps}~${challan.employerEpf}`;
  return [header, ...rows, footer].join("\n");
}

/** Builds a plain-text 24Q summary file body (visual/download affordance only). */
export function form24QText(empIds: string[]): string {
  const f = form24Q(empIds);
  const header = "Form 24Q — Quarterly TDS on Salaries — " + FY_LABEL;
  const rows = f.rows.map((r) => `${r.label}\tSalary ${r.salaryPaid}\tTDS ${r.tdsDeducted}`);
  const footer = `TOTAL\tSalary ${f.totalSalary}\tTDS ${f.totalTds}\tDeductees ${f.deductees}`;
  return [header, "", ...rows, "", footer].join("\n");
}
