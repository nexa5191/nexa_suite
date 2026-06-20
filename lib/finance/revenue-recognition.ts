// ---------------------------------------------------------------------------
// Revenue recognition (Ind AS 115 / ASC 606) — recognise revenue as performance
// obligations are satisfied, not when billed. Ratable contracts spread over the
// term; milestone contracts recognise at each obligation. The difference sits in
// deferred (unearned) revenue. Deterministic seed contracts, computed as-on.
// ---------------------------------------------------------------------------

import { AS_ON } from "@/lib/finance/receivables";
export { AS_ON };

export type RecMethod = "ratable" | "milestone";

export interface Milestone { date: string; label: string; pct: number }

export interface RevContract {
  id: string;
  customer: string;
  name: string;
  method: RecMethod;
  total: number;
  start: string;
  months?: number; // ratable term
  milestones?: Milestone[];
}

export const REV_CONTRACTS: RevContract[] = [
  { id: "rc-1", customer: "QuickBasket", name: "Annual listing & data-insights fee", method: "ratable", total: 3_600_000, start: "2026-01-01", months: 12 },
  { id: "rc-2", customer: "Spencer's Gourmet", name: "Annual category supply retainer", method: "ratable", total: 1_800_000, start: "2025-10-01", months: 12 },
  { id: "rc-3", customer: "FreshMart Retail", name: "Private-label product development", method: "milestone", total: 2_400_000, start: "2026-04-01",
    milestones: [
      { date: "2026-05-15", label: "Design sign-off", pct: 30 },
      { date: "2026-07-01", label: "Pilot batch", pct: 40 },
      { date: "2026-09-01", label: "Rollout", pct: 30 },
    ] },
  { id: "rc-4", customer: "Pantry Pulse", name: "Platform integration & onboarding", method: "milestone", total: 1_200_000, start: "2026-04-01",
    milestones: [
      { date: "2026-04-10", label: "Integration live", pct: 50 },
      { date: "2026-08-10", label: "Go-live & training", pct: 50 },
    ] },
];

function monthsElapsed(start: string, asOn: string): number {
  const [ys, ms, ds] = start.split("-").map(Number);
  const [ya, ma, da] = asOn.split("-").map(Number);
  return (ya - ys) * 12 + (ma - ms) + (da >= ds ? 1 : 0);
}

export interface RevLine {
  contract: RevContract;
  recognized: number;
  deferred: number;
  thisMonth: number;
  pctComplete: number;
  status: "in-progress" | "completed" | "not-started";
}

function recognizedFor(c: RevContract, asOn: string): { recognized: number; thisMonth: number } {
  if (c.method === "ratable") {
    const term = c.months ?? 12;
    const monthly = c.total / term;
    const e = Math.max(0, Math.min(term, monthsElapsed(c.start, asOn)));
    const inTerm = e > 0 && e <= term;
    return { recognized: Math.round(monthly * e), thisMonth: inTerm ? Math.round(monthly) : 0 };
  }
  const ms = c.milestones ?? [];
  const recognized = ms.filter((m) => m.date <= asOn).reduce((s, m) => s + c.total * m.pct / 100, 0);
  const thisMonth = ms.filter((m) => m.date.slice(0, 7) === asOn.slice(0, 7)).reduce((s, m) => s + c.total * m.pct / 100, 0);
  return { recognized: Math.round(recognized), thisMonth: Math.round(thisMonth) };
}

export function revLines(asOn: string = AS_ON): RevLine[] {
  return REV_CONTRACTS.map((c) => {
    const { recognized, thisMonth } = recognizedFor(c, asOn);
    const deferred = Math.max(0, c.total - recognized);
    const pctComplete = c.total > 0 ? recognized / c.total : 0;
    const status: RevLine["status"] = recognized <= 0 ? "not-started" : recognized >= c.total ? "completed" : "in-progress";
    return { contract: c, recognized, deferred, thisMonth, pctComplete, status };
  });
}

export interface RevSummary {
  totalContractValue: number;
  recognizedToDate: number;
  deferredBalance: number;
  thisMonth: number;
}

export function revSummary(asOn: string = AS_ON): RevSummary {
  const lines = revLines(asOn);
  return {
    totalContractValue: lines.reduce((s, l) => s + l.contract.total, 0),
    recognizedToDate: lines.reduce((s, l) => s + l.recognized, 0),
    deferredBalance: lines.reduce((s, l) => s + l.deferred, 0),
    thisMonth: lines.reduce((s, l) => s + l.thisMonth, 0),
  };
}

/** Forward recognition schedule — revenue to be recognised in the next `n` months. */
export function forwardSchedule(asOn: string = AS_ON, n = 6): { month: string; amount: number }[] {
  const [y0, m0] = asOn.slice(0, 7).split("-").map(Number);
  const out: { month: string; amount: number }[] = [];
  for (let i = 1; i <= n; i++) {
    const idx = m0 - 1 + i;
    const yy = y0 + Math.floor(idx / 12);
    const mm = (idx % 12) + 1;
    const monthKey = `${yy}-${String(mm).padStart(2, "0")}`;
    let amount = 0;
    for (const c of REV_CONTRACTS) {
      if (c.method === "ratable") {
        const term = c.months ?? 12;
        const monthly = c.total / term;
        const e = monthsElapsed(c.start, `${monthKey}-28`);
        if (e >= 1 && e <= term) amount += monthly;
      } else {
        amount += (c.milestones ?? []).filter((mi) => mi.date.slice(0, 7) === monthKey).reduce((s, mi) => s + c.total * mi.pct / 100, 0);
      }
    }
    out.push({ month: monthKey, amount: Math.round(amount) });
  }
  return out;
}
