// ---------------------------------------------------------------------------
// Monthly depreciation posting. The Companies Act (book) charge is already
// computed deterministically by monthlySeries(); this turns a given month's
// charge into balanced GL vouchers (Dr Depreciation / Cr Accumulated dep),
// grouped per entity+location, and detects whether that month is already posted
// so re-running is safe (no double charge).
// ---------------------------------------------------------------------------

import { entityById } from "@/lib/accounting/org";
import { monthlySeries } from "./depreciation";
import { DEP_EXPENSE_ACCOUNT, ACCUM_DEP_ACCOUNT, type FixedAsset } from "./assets";
import type { EntryDraft, ManualEntry } from "@/lib/accounting/manual-entries";

const r2 = (n: number) => Math.round(n * 100) / 100;
const ymIndexOfMonth = (monthIso: string) =>
  parseInt(monthIso.slice(0, 4), 10) * 12 + (parseInt(monthIso.slice(5, 7), 10) - 1);
const ymIndexOfDate = (iso: string) => parseInt(iso.slice(0, 4), 10) * 12 + (parseInt(iso.slice(5, 7), 10) - 1);

/** Book depreciation charged on one asset in calendar month "YYYY-MM". */
export function monthlyDepForAsset(asset: FixedAsset, monthIso: string): number {
  const series = monthlySeries(asset);
  const idx = ymIndexOfMonth(monthIso) - ymIndexOfDate(asset.acquisitionDate);
  return idx >= 0 && idx < series.length ? r2(series[idx]) : 0;
}

export function lastDayOfMonth(monthIso: string): string {
  const [y, m] = monthIso.split("-").map(Number);
  return `${monthIso}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`;
}

/** Deterministic narration so a month's posting can be detected/avoided twice. */
export const depNarration = (monthIso: string) => `Depreciation — ${monthIso}`;

export interface DepGroup {
  entityId: string;
  locationId: string;
  amount: number;
  posted: boolean;
}

export interface DepPlan {
  month: string;
  total: number; // total not-yet-posted charge
  groups: DepGroup[];
  drafts: EntryDraft[]; // one per un-posted group
  postedCount: number;
}

/** Has this entity+location already booked depreciation for the month? */
export function isGroupPosted(entries: ManualEntry[], monthIso: string, entityId: string, locationId: string): boolean {
  const narration = depNarration(monthIso);
  return entries.some(
    (e) =>
      e.type === "journal" &&
      e.status === "posted" &&
      e.entityId === entityId &&
      e.locationId === locationId &&
      e.narration === narration,
  );
}

/**
 * Plan the depreciation posting for `monthIso` over the given assets. Groups by
 * entity+location, flags which groups are already posted, and builds drafts only
 * for the un-posted ones.
 */
export function planDepreciation(assets: FixedAsset[], monthIso: string, entries: ManualEntry[]): DepPlan {
  const byGroup = new Map<string, { entityId: string; locationId: string; amount: number }>();
  for (const a of assets) {
    const dep = monthlyDepForAsset(a, monthIso);
    if (dep <= 0) continue;
    const key = `${a.entityId}|${a.locationId}`;
    const g = byGroup.get(key) ?? { entityId: a.entityId, locationId: a.locationId, amount: 0 };
    g.amount = r2(g.amount + dep);
    byGroup.set(key, g);
  }

  const groups: DepGroup[] = [];
  const drafts: EntryDraft[] = [];
  let total = 0;
  let postedCount = 0;
  const date = lastDayOfMonth(monthIso);

  for (const g of byGroup.values()) {
    const posted = isGroupPosted(entries, monthIso, g.entityId, g.locationId);
    groups.push({ ...g, posted });
    if (posted) {
      postedCount++;
      continue;
    }
    total = r2(total + g.amount);
    drafts.push({
      type: "journal",
      date,
      narration: depNarration(monthIso),
      entityId: g.entityId,
      locationId: g.locationId,
      currency: entityById(g.entityId)?.currency ?? "INR",
      basis: "accrual",
      lines: [
        { accountCode: DEP_EXPENSE_ACCOUNT, debit: g.amount, credit: 0 },
        { accountCode: ACCUM_DEP_ACCOUNT, debit: 0, credit: g.amount },
      ],
    });
  }

  return { month: monthIso, total, groups, drafts, postedCount };
}

/** Recent calendar months up to (and including) the last completed month. */
export function recentMonths(todayIso: string, count = 12): string[] {
  let idx = ymIndexOfDate(todayIso) - 1; // last completed month
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const y = Math.floor(idx / 12);
    const m = (idx % 12) + 1;
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    idx--;
  }
  return out;
}
