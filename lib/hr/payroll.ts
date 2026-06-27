import { EMPLOYEES, employeeById } from "./employees";
import type { Employee } from "./types";

// ---------------------------------------------------------------------------
// Payroll — salary structure (basic / HRA / allowances / PF / PT / TDS / net),
// monthly payroll runs, and payslips. All amounts in base INR per month.
// ---------------------------------------------------------------------------

// Annual CTC (₹ lakh) by employee — drives the whole structure.
const CTC_LAKH: Record<string, number> = {};

function effectiveTdsRate(annualLakh: number) {
  if (annualLakh < 10) return 0.05;
  if (annualLakh < 20) return 0.1;
  if (annualLakh < 50) return 0.18;
  return 0.25;
}

export interface SalaryStructure {
  annualCtc: number; // INR
  gross: number; // monthly
  basic: number;
  hra: number;
  special: number;
  pf: number;
  pt: number; // professional tax
  tds: number;
  deductions: number;
  net: number;
}

export function salaryStructure(employeeId: string): SalaryStructure {
  const lakh = CTC_LAKH[employeeId] ?? 10;
  const annualCtc = lakh * 100_000;
  const gross = Math.round(annualCtc / 12);
  const basic = Math.round(gross * 0.4);
  const hra = Math.round(gross * 0.2);
  const special = gross - basic - hra;
  const pf = Math.round(basic * 0.12);
  const pt = 200;
  const tds = Math.round(gross * effectiveTdsRate(lakh));
  const deductions = pf + pt + tds;
  const net = gross - deductions;
  return { annualCtc, gross, basic, hra, special, pf, pt, tds, deductions, net };
}

export type RunStatus = "paid" | "processing" | "draft";

export interface PayrollRun {
  id: string;
  month: string; // "YYYY-MM"
  label: string;
  status: RunStatus;
  runDate: string | null; // ISO when processed
  processedById: string; // payroll owner
}

export const PAYROLL_RUNS: PayrollRun[] = [];

export function runByMonth(month: string) {
  return PAYROLL_RUNS.find((r) => r.month === month);
}

// Employees included in a given month: joined on/before month-end, and not yet
// exited at the start of that month.
export function runMembers(month: string): Employee[] {
  const monthStart = `${month}-01`;
  const monthEnd = `${month}-31`;
  return EMPLOYEES.filter((e) => {
    if (e.joinDate > monthEnd) return false;
    if (e.exitDate && e.exitDate < monthStart) return false;
    return true;
  });
}

export interface RunTotals {
  headcount: number;
  gross: number;
  deductions: number;
  net: number;
}

export function runTotals(month: string): RunTotals {
  const members = runMembers(month);
  return members.reduce<RunTotals>(
    (acc, e) => {
      const s = salaryStructure(e.id);
      acc.headcount += 1;
      acc.gross += s.gross;
      acc.deductions += s.deductions;
      acc.net += s.net;
      return acc;
    },
    { headcount: 0, gross: 0, deductions: 0, net: 0 },
  );
}

export interface Payslip {
  month: string;
  label: string;
  status: RunStatus;
  employee: Employee;
  structure: SalaryStructure;
}

/** Months an employee has a (processed) payslip for, newest first. */
export function payslipsForEmployee(employeeId: string): Payslip[] {
  const emp = employeeById(employeeId);
  if (!emp) return [];
  return PAYROLL_RUNS.filter((r) => r.status === "paid")
    .filter((r) => runMembers(r.month).some((m) => m.id === employeeId))
    .map((r) => ({ month: r.month, label: r.label, status: r.status, employee: emp, structure: salaryStructure(employeeId) }))
    .reverse();
}
