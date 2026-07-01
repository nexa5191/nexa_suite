// ---------------------------------------------------------------------------
// Cost / profit-center reporting (SAP CO-PA lite) — a P&L by segment.
//
// Profit centers map to the existing location dimension every posting already
// carries (no schema change). For each profit center we build a contribution
// P&L (revenue → COGS → gross margin → opex → operating profit) and can
// allocate shared/support-center overhead across revenue-bearing centers by
// revenue share — the way Controlling spreads corporate cost.
// ---------------------------------------------------------------------------

import { filteredPostings } from "./ledger";
import { loadChartOfAccounts } from "./chart-of-accounts";
import { LOCATIONS, entityById } from "./org";
import type { Basis } from "./types";

const TYPE_OF = new Map(loadChartOfAccounts().map((a) => [a.code, a.type]));

export interface SegmentRow {
  locationId: string;
  name: string;
  entityName: string;
  revenue: number;
  cogs: number;
  grossMargin: number;
  opex: number;
  operatingProfit: number;
  allocatedOverhead: number; // overhead allocated IN (+) or OUT (−) under allocation
  operatingProfitAfter: number;
  marginPct: number; // operating margin % (post-allocation)
}

export interface SegmentPnl {
  rows: SegmentRow[];
  totalRevenue: number;
  totalOpProfit: number;
  allocated: boolean;
}

export function segmentPnl(entityId: string, from: string, to: string, allocate: boolean): SegmentPnl {
  const filters = { entityId, locationId: "all", state: "all", basis: "accrual" as Basis, from, to };
  const postings = filteredPostings(filters);

  // Aggregate revenue / cogs / opex per location.
  const agg = new Map<string, { revenue: number; cogs: number; opex: number }>();
  for (const p of postings) {
    const type = TYPE_OF.get(p.accountCode);
    if (type !== "income" && type !== "expense") continue;
    const cur = agg.get(p.locationId) ?? { revenue: 0, cogs: 0, opex: 0 };
    if (type === "income") {
      cur.revenue += p.credit - p.debit;
    } else if (p.accountCode.startsWith("5")) {
      cur.cogs += p.debit - p.credit;
    } else {
      cur.opex += p.debit - p.credit;
    }
    agg.set(p.locationId, cur);
  }

  const locs = entityId === "all" ? LOCATIONS : LOCATIONS.filter((l) => l.entityId === entityId);

  let rows: SegmentRow[] = locs.map((l) => {
    const a = agg.get(l.id) ?? { revenue: 0, cogs: 0, opex: 0 };
    const grossMargin = a.revenue - a.cogs;
    const operatingProfit = grossMargin - a.opex;
    return {
      locationId: l.id,
      name: l.name,
      entityName: entityById(l.entityId)?.name ?? l.entityId,
      revenue: round(a.revenue),
      cogs: round(a.cogs),
      grossMargin: round(grossMargin),
      opex: round(a.opex),
      operatingProfit: round(operatingProfit),
      allocatedOverhead: 0,
      operatingProfitAfter: round(operatingProfit),
      marginPct: 0,
    };
  });

  if (allocate) {
    // Support centers = revenue-bearing none; pool their opex and spread it over
    // revenue-bearing centers by revenue share.
    const pool = rows.filter((r) => r.revenue <= 0).reduce((s, r) => s + r.opex, 0);
    const earners = rows.filter((r) => r.revenue > 0);
    const totalRev = earners.reduce((s, r) => s + r.revenue, 0) || 1;
    rows = rows.map((r) => {
      if (r.revenue > 0) {
        const share = pool * (r.revenue / totalRev);
        return { ...r, allocatedOverhead: round(share), operatingProfitAfter: round(r.operatingProfit - share) };
      }
      // support center: its overhead is allocated out
      return { ...r, allocatedOverhead: round(-r.opex), operatingProfitAfter: round(r.operatingProfit + r.opex) };
    });
  }

  rows = rows.map((r) => ({ ...r, marginPct: r.revenue > 0 ? r.operatingProfitAfter / r.revenue : 0 }));
  rows.sort((a, b) => b.revenue - a.revenue);

  return {
    rows,
    totalRevenue: round(rows.reduce((s, r) => s + r.revenue, 0)),
    totalOpProfit: round(rows.reduce((s, r) => s + r.operatingProfitAfter, 0)),
    allocated: allocate,
  };
}

function round(n: number): number {
  return Math.round(n);
}
