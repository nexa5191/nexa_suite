// ---------------------------------------------------------------------------
// Lease accounting (Ind AS 116 / IFRS 16) — capitalise operating leases as a
// right-of-use (ROU) asset and a lease liability. The liability amortises with
// an interest/principal split; the ROU depreciates straight-line. Deterministic
// seed leases, computed as-on. (Short-term / low-value exemptions ignored.)
// ---------------------------------------------------------------------------

import { AS_ON } from "@/lib/finance/receivables";
export { AS_ON };

export interface Lease {
  id: string;
  asset: string;
  location: string;
  commencement: string;
  termMonths: number;
  monthlyPayment: number;
  annualRate: number; // incremental borrowing rate
}

export const LEASES: Lease[] = [
  { id: "ls-1", asset: "Head-office premises", location: "Bengaluru HQ", commencement: "2025-04-01", termMonths: 60, monthlyPayment: 350_000, annualRate: 9.0 },
  { id: "ls-2", asset: "Distribution warehouse", location: "Mumbai Depot", commencement: "2025-07-01", termMonths: 36, monthlyPayment: 220_000, annualRate: 9.5 },
  { id: "ls-3", asset: "Delivery fleet (12 vehicles)", location: "Delhi Branch", commencement: "2026-01-01", termMonths: 48, monthlyPayment: 140_000, annualRate: 10.0 },
];

function monthsElapsed(start: string, asOn: string): number {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ya, ma, da] = asOn.split("-").map(Number);
  return (ya - ys) * 12 + (ma - ms) + (da >= ds ? 1 : 0);
}

/** Present value of the lease payments at commencement = initial liability = initial ROU. */
export function initialLiability(l: Lease): number {
  const i = l.annualRate / 100 / 12;
  const n = l.termMonths;
  const pv = i === 0 ? l.monthlyPayment * n : l.monthlyPayment * (1 - Math.pow(1 + i, -n)) / i;
  return Math.round(pv);
}

export interface ScheduleRow { period: number; opening: number; interest: number; payment: number; principal: number; closing: number }

export function schedule(l: Lease): ScheduleRow[] {
  const i = l.annualRate / 100 / 12;
  let opening = initialLiability(l);
  const rows: ScheduleRow[] = [];
  for (let p = 1; p <= l.termMonths; p++) {
    const interest = Math.round(opening * i);
    const principal = Math.round(l.monthlyPayment - interest);
    const closing = Math.max(0, opening - principal);
    rows.push({ period: p, opening, interest, payment: l.monthlyPayment, principal, closing });
    opening = closing;
  }
  return rows;
}

export interface LeasePosition {
  lease: Lease;
  initial: number;
  elapsed: number;
  rouCost: number;
  rouNbv: number;
  accumDep: number;
  liability: number;
  currentLiability: number;
  nonCurrentLiability: number;
  thisMonthInterest: number;
  thisMonthDep: number;
}

export function leasePosition(l: Lease, asOn: string = AS_ON): LeasePosition {
  const initial = initialLiability(l);
  const sched = schedule(l);
  const elapsed = Math.max(0, Math.min(l.termMonths, monthsElapsed(l.commencement, asOn)));
  const depMonthly = initial / l.termMonths;
  const accumDep = Math.round(depMonthly * elapsed);
  const rouNbv = Math.round(initial - accumDep);
  const liability = elapsed === 0 ? initial : sched[elapsed - 1].closing;
  // Current portion = principal repayable in the next 12 months.
  const currentLiability = Math.round(sched.slice(elapsed, elapsed + 12).reduce((s, r) => s + r.principal, 0));
  const nonCurrentLiability = Math.max(0, liability - currentLiability);
  const next = sched[elapsed]; // upcoming month
  return {
    lease: l, initial, elapsed,
    rouCost: initial, rouNbv, accumDep, liability, currentLiability, nonCurrentLiability,
    thisMonthInterest: elapsed < l.termMonths ? (next?.interest ?? 0) : 0,
    thisMonthDep: elapsed < l.termMonths ? Math.round(depMonthly) : 0,
  };
}

export interface LeaseSummary {
  rouNbv: number;
  liability: number;
  currentLiability: number;
  nonCurrentLiability: number;
  monthlyCharge: number; // interest + depreciation (P&L)
  monthlyCashRent: number; // payments
}

export function leaseSummary(asOn: string = AS_ON): { positions: LeasePosition[]; summary: LeaseSummary } {
  const positions = LEASES.map((l) => leasePosition(l, asOn));
  const summary: LeaseSummary = {
    rouNbv: positions.reduce((s, p) => s + p.rouNbv, 0),
    liability: positions.reduce((s, p) => s + p.liability, 0),
    currentLiability: positions.reduce((s, p) => s + p.currentLiability, 0),
    nonCurrentLiability: positions.reduce((s, p) => s + p.nonCurrentLiability, 0),
    monthlyCharge: positions.reduce((s, p) => s + p.thisMonthInterest + p.thisMonthDep, 0),
    monthlyCashRent: positions.filter((p) => p.elapsed < p.lease.termMonths).reduce((s, p) => s + p.lease.monthlyPayment, 0),
  };
  return { positions, summary };
}
