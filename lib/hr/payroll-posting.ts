// ---------------------------------------------------------------------------
// Payroll → GL. A processed payroll run is deterministic (salaryStructure), so
// its accrual journal can be generated rather than keyed by hand:
//   Dr Salaries & Wages (gross)
//     Cr TDS Payable (tax deducted at source)
//     Cr Salaries Payable (net + PF + PT — settled on payout)
// Grouped per entity+location, with already-posted detection so re-running is
// safe.
// ---------------------------------------------------------------------------

import { entityById } from "@/lib/accounting/org";
import { runMembers, salaryStructure } from "./payroll";
import type { EntryDraft, ManualEntry } from "@/lib/accounting/manual-entries";

const r2 = (n: number) => Math.round(n * 100) / 100;
const SAL_EXPENSE = "6010";
const TDS_PAYABLE = "2200";
const SAL_PAYABLE = "2300";

export const payrollNarration = (monthIso: string) => `Payroll — ${monthIso}`;

function lastDayOfMonth(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return `${monthIso}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

export interface PayrollGlGroup {
  entityId: string;
  locationId: string;
  gross: number;
  tds: number;
  payable: number; // gross − tds
  posted: boolean;
}

export interface PayrollGlPlan {
  month: string;
  total: number; // un-posted gross
  groups: PayrollGlGroup[];
  drafts: EntryDraft[];
  postedCount: number;
}

export function isPayrollPosted(entries: ManualEntry[], monthIso: string, entityId: string, locationId: string): boolean {
  const narration = payrollNarration(monthIso);
  return entries.some(
    (e) =>
      e.type === "journal" &&
      e.status === "posted" &&
      e.entityId === entityId &&
      e.locationId === locationId &&
      e.narration === narration,
  );
}

/** Build the payroll accrual GL plan for a month, grouped by entity+location. */
export function planPayrollGl(monthIso: string, entries: ManualEntry[]): PayrollGlPlan {
  const byGroup = new Map<string, { entityId: string; locationId: string; gross: number; tds: number }>();
  for (const e of runMembers(monthIso)) {
    const s = salaryStructure(e.id);
    const key = `${e.entityId}|${e.locationId}`;
    const g = byGroup.get(key) ?? { entityId: e.entityId, locationId: e.locationId, gross: 0, tds: 0 };
    g.gross = r2(g.gross + s.gross);
    g.tds = r2(g.tds + s.tds);
    byGroup.set(key, g);
  }

  const groups: PayrollGlGroup[] = [];
  const drafts: EntryDraft[] = [];
  const date = lastDayOfMonth(monthIso);
  let total = 0;
  let postedCount = 0;

  for (const g of byGroup.values()) {
    const payable = r2(g.gross - g.tds);
    const posted = isPayrollPosted(entries, monthIso, g.entityId, g.locationId);
    groups.push({ entityId: g.entityId, locationId: g.locationId, gross: g.gross, tds: g.tds, payable, posted });
    if (posted) {
      postedCount++;
      continue;
    }
    total = r2(total + g.gross);
    const lines = [{ accountCode: SAL_EXPENSE, debit: g.gross, credit: 0 }];
    if (g.tds > 0) lines.push({ accountCode: TDS_PAYABLE, debit: 0, credit: g.tds });
    lines.push({ accountCode: SAL_PAYABLE, debit: 0, credit: payable });
    drafts.push({
      type: "journal",
      date,
      narration: payrollNarration(monthIso),
      entityId: g.entityId,
      locationId: g.locationId,
      currency: entityById(g.entityId)?.currency ?? "INR",
      basis: "accrual",
      lines,
    });
  }

  return { month: monthIso, total, groups, drafts, postedCount };
}
