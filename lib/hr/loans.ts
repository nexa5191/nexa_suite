// ---------------------------------------------------------------------------
// NEXA HR — Employee loans & advances.
//
// Covers salary advances (interest-free) and personal / emergency / festival
// loans (reducing-balance EMI). All amounts in base INR. The monthly EMI
// recovery total feeds the payroll deduction line.
//
// EMI engine:
//   reducing-balance  EMI = P·r·(1+r)^n / ((1+r)^n − 1),  r = annualRate/12/100
//   interest-free     EMI = P / n
// An amortisation schedule (opening / emi / interest / principal / closing) is
// generated per loan, and outstanding-as-on is read off it.
//
// Affordability: total active-loan EMI for an employee should stay within ~40%
// of monthly net (salaryStructure.net).
//
// Persistence (client-side):
//   nexa-loans  → user-created loans + status overrides for any loan
// ---------------------------------------------------------------------------

import { EMPLOYEES } from "./employees";
import { salaryStructure } from "./payroll";

export type LoanType = "salary-advance" | "personal" | "emergency" | "festival";

export type LoanStatus = "active" | "closed" | "pending";

export interface Loan {
  id: string;
  empId: string;
  type: LoanType;
  principal: number; // base INR
  annualRatePct: number; // 0 for interest-free salary advance
  tenureMonths: number;
  startMonth: string; // "YYYY-MM"
  status: LoanStatus;
  purpose: string;
}

export interface EmiRow {
  month: string; // "YYYY-MM"
  index: number; // 1-based EMI number
  opening: number;
  emi: number;
  interest: number;
  principal: number;
  closing: number;
}

export interface LoanSummary {
  totalDisbursed: number;
  totalOutstanding: number;
  activeCount: number;
  monthlyRecovery: number; // sum of EMIs across active loans
}

export const TODAY = "2026-06-18";

export const LOAN_TYPES: { key: LoanType; label: string; variant: "default" | "primary" | "warning" | "success" }[] = [
  { key: "salary-advance", label: "Salary advance", variant: "primary" },
  { key: "personal", label: "Personal", variant: "default" },
  { key: "emergency", label: "Emergency", variant: "warning" },
  { key: "festival", label: "Festival", variant: "success" },
];

export function loanTypeMeta(t: LoanType) {
  return LOAN_TYPES.find((x) => x.key === t) ?? LOAN_TYPES[1];
}

export const STATUS_VARIANT: Record<LoanStatus, "default" | "success" | "warning"> = {
  active: "success",
  closed: "default",
  pending: "warning",
};

// ---------------------------------------------------------------------------
// EMI engine
// ---------------------------------------------------------------------------

/** Flat monthly EMI for a loan (rounded to rupees). */
export function emiOf(loan: Loan): number {
  const { principal, annualRatePct, tenureMonths } = loan;
  if (tenureMonths <= 0) return 0;
  if (annualRatePct <= 0) return Math.round(principal / tenureMonths);
  const r = annualRatePct / 12 / 100;
  const pow = Math.pow(1 + r, tenureMonths);
  return Math.round((principal * r * pow) / (pow - 1));
}

/** Add `n` whole months to a "YYYY-MM" string. */
function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const total = y * 12 + (m - 1) + n;
  const ny = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return `${ny}-${String(nm).padStart(2, "0")}`;
}

/** Whole months from loan start up to (inclusive of) the asOn month. */
function monthsElapsed(loan: Loan, asOnMonth: string): number {
  const [sy, sm] = loan.startMonth.split("-").map(Number);
  const [ay, am] = asOnMonth.split("-").map(Number);
  const diff = (ay * 12 + (am - 1)) - (sy * 12 + (sm - 1)) + 1; // first EMI in start month
  return Math.max(0, Math.min(loan.tenureMonths, diff));
}

/** Full amortisation schedule — last row is balanced so closing == 0. */
export function schedule(loan: Loan): EmiRow[] {
  const rows: EmiRow[] = [];
  const emi = emiOf(loan);
  const r = loan.annualRatePct > 0 ? loan.annualRatePct / 12 / 100 : 0;
  let opening = loan.principal;
  for (let i = 1; i <= loan.tenureMonths; i++) {
    const interest = Math.round(opening * r);
    let principalPaid = emi - interest;
    let payEmi = emi;
    // Final EMI clears any rounding residue.
    if (i === loan.tenureMonths || principalPaid >= opening) {
      principalPaid = opening;
      payEmi = opening + interest;
    }
    const closing = Math.max(0, opening - principalPaid);
    rows.push({
      month: addMonths(loan.startMonth, i - 1),
      index: i,
      opening,
      emi: payEmi,
      interest,
      principal: principalPaid,
      closing,
    });
    opening = closing;
    if (opening <= 0) break;
  }
  return rows;
}

export interface LoanProgress {
  emi: number;
  monthsElapsed: number;
  paidToDate: number; // principal repaid
  outstanding: number; // outstanding principal
  remainingEmis: number;
}

/** Outstanding principal as on a given date (defaults to today in-app). */
export function outstanding(loan: Loan, asOn: string = TODAY): number {
  if (loan.status === "closed") return 0;
  if (loan.status === "pending") return loan.principal;
  const rows = schedule(loan);
  const asOnMonth = asOn.slice(0, 7);
  const elapsed = monthsElapsed(loan, asOnMonth);
  if (elapsed <= 0) return loan.principal;
  const row = rows[Math.min(elapsed, rows.length) - 1];
  return row ? row.closing : 0;
}

/** Derived repayment position as on a date. */
export function loanProgress(loan: Loan, asOn: string = TODAY): LoanProgress {
  const emi = emiOf(loan);
  const rows = schedule(loan);
  if (loan.status === "pending") {
    return { emi, monthsElapsed: 0, paidToDate: 0, outstanding: loan.principal, remainingEmis: loan.tenureMonths };
  }
  const elapsed = loan.status === "closed" ? loan.tenureMonths : monthsElapsed(loan, asOn.slice(0, 7));
  const out = outstanding(loan, asOn);
  return {
    emi,
    monthsElapsed: elapsed,
    paidToDate: loan.principal - out,
    outstanding: out,
    remainingEmis: Math.max(0, rows.length - elapsed),
  };
}

// ---------------------------------------------------------------------------
// Affordability — EMI burden vs monthly net across all active loans.
// ---------------------------------------------------------------------------

export const AFFORDABILITY_CAP = 0.4; // 40% of monthly net

/** Total active-loan EMI for an employee, optionally including a hypothetical extra EMI. */
export function activeEmiBurden(empId: string, loans: Loan[], extraEmi = 0): number {
  const base = loans
    .filter((l) => l.empId === empId && l.status === "active")
    .reduce((s, l) => s + emiOf(l), 0);
  return base + extraEmi;
}

export interface AffordabilityCheck {
  net: number;
  cap: number; // 40% of net
  currentEmi: number; // existing active EMI burden
  proposedEmi: number; // currentEmi + new EMI
  withinLimit: boolean;
}

/** Does adding a loan with `newEmi` keep the employee within the 40% cap? */
export function affordability(empId: string, newEmi: number, loans: Loan[]): AffordabilityCheck {
  const net = salaryStructure(empId).net;
  const cap = Math.round(net * AFFORDABILITY_CAP);
  const currentEmi = activeEmiBurden(empId, loans);
  const proposedEmi = currentEmi + newEmi;
  return { net, cap, currentEmi, proposedEmi, withinLimit: proposedEmi <= cap };
}

// ---------------------------------------------------------------------------
// Aggregates
// ---------------------------------------------------------------------------

export function summarise(loans: Loan[], asOn: string = TODAY): LoanSummary {
  let totalDisbursed = 0;
  let totalOutstanding = 0;
  let activeCount = 0;
  let monthlyRecovery = 0;
  for (const l of loans) {
    if (l.status === "pending") continue;
    totalDisbursed += l.principal;
    totalOutstanding += outstanding(l, asOn);
    if (l.status === "active") {
      activeCount += 1;
      monthlyRecovery += emiOf(l);
    }
  }
  return { totalDisbursed, totalOutstanding, activeCount, monthlyRecovery };
}

// ---------------------------------------------------------------------------
// Seed loans — deterministic, principals capped at 3× monthly gross.
// ---------------------------------------------------------------------------

interface RawLoan {
  empId: string;
  type: LoanType;
  principal: number;
  annualRatePct: number;
  tenureMonths: number;
  startMonth: string;
  status: LoanStatus;
  purpose: string;
}

const RAW_LOANS: RawLoan[] = [
  // Interest-free salary advances — short tenure.
  { empId: "emp-007", type: "salary-advance", principal: 100000, annualRatePct: 0, tenureMonths: 6, startMonth: "2026-03", status: "active", purpose: "Salary advance against April–September." },
  { empId: "emp-022", type: "salary-advance", principal: 45000, annualRatePct: 0, tenureMonths: 5, startMonth: "2026-04", status: "active", purpose: "Short-term advance — medical bridge." },
  { empId: "emp-013", type: "salary-advance", principal: 40000, annualRatePct: 0, tenureMonths: 4, startMonth: "2025-12", status: "closed", purpose: "Advance for relocation deposit." },
  // Interest-bearing loans.
  { empId: "emp-006", type: "personal", principal: 300000, annualRatePct: 10, tenureMonths: 24, startMonth: "2025-09", status: "active", purpose: "Home renovation." },
  { empId: "emp-016", type: "festival", principal: 120000, annualRatePct: 6, tenureMonths: 12, startMonth: "2025-10", status: "active", purpose: "Diwali festival advance." },
  { empId: "emp-011", type: "emergency", principal: 250000, annualRatePct: 8, tenureMonths: 18, startMonth: "2026-01", status: "active", purpose: "Family medical emergency." },
  { empId: "emp-020", type: "personal", principal: 500000, annualRatePct: 11, tenureMonths: 36, startMonth: "2025-06", status: "active", purpose: "Vehicle purchase." },
  { empId: "emp-024", type: "festival", principal: 50000, annualRatePct: 6, tenureMonths: 10, startMonth: "2026-05", status: "pending", purpose: "Festival advance — awaiting approval." },
];

/** Principal capped at 3× monthly gross so seeds stay sensible vs salary. */
function capPrincipal(empId: string, principal: number): number {
  const cap = salaryStructure(empId).gross * 3;
  return Math.min(principal, cap);
}

export const SEED_LOANS: Loan[] = [];

// ---------------------------------------------------------------------------
// Persistence — created loans + status overrides under one key.
// ---------------------------------------------------------------------------

export const LOANS_KEY = "nexa-loans";

export interface LoansStore {
  created: Loan[];
  statusOverrides: Record<string, LoanStatus>;
}

const EMPTY_STORE: LoansStore = { created: [], statusOverrides: {} };

export function loadLoansStore(): LoansStore {
  if (typeof window === "undefined") return EMPTY_STORE;
  try {
    const raw = localStorage.getItem(LOANS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LoansStore>;
      return { created: parsed.created ?? [], statusOverrides: parsed.statusOverrides ?? {} };
    }
  } catch {
    /* ignore */
  }
  return EMPTY_STORE;
}

export function saveLoansStore(store: LoansStore) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LOANS_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

/** Seed + created loans with any status overrides applied. */
export function allLoans(store: LoansStore): Loan[] {
  return [...SEED_LOANS, ...store.created].map((l) => ({
    ...l,
    status: store.statusOverrides[l.id] ?? l.status,
  }));
}

/** Next sequential loan id across seed + created. */
export function nextLoanId(store: LoansStore): string {
  const all = [...SEED_LOANS, ...store.created];
  let max = 0;
  for (const l of all) {
    const m = l.id.match(/loan-(\d+)/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `loan-${String(max + 1).padStart(3, "0")}`;
}

export { capPrincipal, monthsElapsed };
