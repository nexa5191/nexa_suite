import { EMPLOYEES, employeeById } from "./employees";
import type { Employee } from "./types";

// ---------------------------------------------------------------------------
// Payroll — salary structure (basic / HRA / allowances / PF / PT / TDS / net),
// monthly payroll runs, and payslips. All amounts in base INR per month.
// ---------------------------------------------------------------------------

// Annual CTC (₹ lakh) by employee — drives the whole structure.
const CTC_LAKH: Record<string, number> = {
  "emp-001": 120, "emp-002": 90, "emp-003": 80, "emp-004": 70, "emp-005": 75,
  "emp-006": 18, "emp-007": 12, "emp-008": 15, "emp-009": 16, "emp-010": 14,
  "emp-011": 22, "emp-012": 18, "emp-013": 8, "emp-014": 12, "emp-015": 13,
  "emp-016": 24, "emp-017": 26, "emp-018": 20, "emp-019": 22, "emp-020": 28,
  "emp-021": 12, "emp-022": 7, "emp-023": 20, "emp-024": 11,
};

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

export const PAYROLL_RUNS: PayrollRun[] = [
  { id: "run-2026-03", month: "2026-03", label: "March 2026", status: "paid", runDate: "2026-03-31", processedById: "emp-002" },
  { id: "run-2026-04", month: "2026-04", label: "April 2026", status: "paid", runDate: "2026-04-30", processedById: "emp-002" },
  { id: "run-2026-05", month: "2026-05", label: "May 2026", status: "paid", runDate: "2026-05-31", processedById: "emp-002" },
  { id: "run-2026-06", month: "2026-06", label: "June 2026", status: "draft", runDate: null, processedById: "emp-002" },
];

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
