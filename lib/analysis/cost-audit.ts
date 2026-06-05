// Cost audit & allocation engine. Splits the period's costs three ways —
// by entity, by location and by product — and computes allocation metrics
// (share of cost, cost-to-revenue ratio, contribution margin).
//
// Entity and location splits are *actual*: every posting already carries an
// entity and a location, so those dimensions tie exactly to the GL. The product
// dimension is *driver-based* (the GL isn't product-tagged) — direct costs are
// allocated on each SKU's bill-of-materials cost, overheads on a chosen driver
// (revenue / volume / equal). This is exactly how management accounting absorbs
// indirect cost onto products.

import type { ReportFilters } from "@/lib/accounting/types";
import { filteredPostings } from "@/lib/accounting/ledger";
import { account, accountSafe } from "@/lib/accounting/chart-of-accounts";
import { ENTITIES, LOCATIONS, entityById, locationById } from "@/lib/accounting/org";
import { FINISHED_ITEMS, explodedUnitCost } from "@/lib/inventory/items";

export type ProductDriver = "revenue" | "volume" | "equal";

export interface CostHead {
  code: string;
  name: string;
  total: number;
  isDirect: boolean; // Cost of Sales heads are absorbed on BOM cost
}

export interface AllocRow {
  id: string;
  name: string;
  sub?: string;
  costByHead: Record<string, number>;
  totalCost: number;
  revenue: number;
  share: number; // share of total cost
  margin: number; // revenue - totalCost
  marginPct: number; // margin / revenue
  costToRevenue: number; // totalCost / revenue
}

export interface ProductInfo {
  id: string;
  name: string;
  weight: number; // revenue mix weight
  unitCost: number; // exploded BOM cost
  sellRate: number;
}

export interface CostAudit {
  heads: CostHead[];
  totalCost: number;
  totalRevenue: number;
  byEntity: AllocRow[];
  byLocation: AllocRow[];
  byProduct: AllocRow[];
  driver: ProductDriver;
  products: ProductInfo[];
}

// Deterministic product revenue-mix weights (sum ≈ 1). Stable across renders so
// SSR and client agree — no Math.random in the data path.
const PRODUCT_WEIGHTS: Record<string, number> = {
  "fg-flour50": 0.26,
  "fg-rice25": 0.14,
  "fg-oil15": 0.18,
  "fg-flour00": 0.08,
  "fg-semolina25": 0.06,
  "fg-atta10": 0.16,
  "fg-atta1": 0.12,
};

function productMix(): ProductInfo[] {
  const items = FINISHED_ITEMS.map((it) => ({
    id: it.id,
    name: it.name,
    weight: PRODUCT_WEIGHTS[it.id] ?? 0.1,
    unitCost: explodedUnitCost(it.id),
    sellRate: it.rate,
  }));
  const tot = items.reduce((s, i) => s + i.weight, 0) || 1;
  return items.map((i) => ({ ...i, weight: i.weight / tot }));
}

const HEAD_ORDER = [
  "5010",
  "5020",
  "6010",
  "6020",
  "6030",
  "6040",
  "6050",
  "6060",
  "6070",
  "6080",
  "6900",
];

function emptyByHead(heads: CostHead[]): Record<string, number> {
  const m: Record<string, number> = {};
  for (const h of heads) m[h.code] = 0;
  return m;
}

function finishRow(row: AllocRow, totalCost: number): AllocRow {
  row.share = totalCost ? row.totalCost / totalCost : 0;
  row.margin = row.revenue - row.totalCost;
  row.marginPct = row.revenue ? row.margin / row.revenue : 0;
  row.costToRevenue = row.revenue ? row.totalCost / row.revenue : 0;
  return row;
}

export function buildCostAudit(f: ReportFilters, driver: ProductDriver = "revenue"): CostAudit {
  const postings = filteredPostings(f);

  // ---- Cost heads (expenses) + revenue, by entity & location -------------
  const headTotals = new Map<string, number>();
  const costByEntity = new Map<string, Record<string, number>>();
  const costByLoc = new Map<string, Record<string, number>>();
  const revByEntity = new Map<string, number>();
  const revByLoc = new Map<string, number>();

  const ensure = (m: Map<string, Record<string, number>>, k: string) => {
    if (!m.has(k)) m.set(k, {});
    return m.get(k)!;
  };

  for (const p of postings) {
    const a = accountSafe(p.accountCode);
    if (!a) continue;
    if (a.type === "expense") {
      const amt = p.debit - p.credit;
      if (Math.abs(amt) < 0.5) continue;
      headTotals.set(p.accountCode, (headTotals.get(p.accountCode) ?? 0) + amt);
      const be = ensure(costByEntity, p.entityId);
      be[p.accountCode] = (be[p.accountCode] ?? 0) + amt;
      const bl = ensure(costByLoc, p.locationId);
      bl[p.accountCode] = (bl[p.accountCode] ?? 0) + amt;
    } else if (a.type === "income") {
      const amt = p.credit - p.debit;
      revByEntity.set(p.entityId, (revByEntity.get(p.entityId) ?? 0) + amt);
      revByLoc.set(p.locationId, (revByLoc.get(p.locationId) ?? 0) + amt);
    }
  }

  const heads: CostHead[] = HEAD_ORDER.filter((c) => Math.abs(headTotals.get(c) ?? 0) > 0.5).map(
    (code) => {
      const a = account(code);
      return {
        code,
        name: a.name,
        total: headTotals.get(code) ?? 0,
        isDirect: a.subtype === "Cost of Sales",
      };
    },
  );
  const totalCost = heads.reduce((s, h) => s + h.total, 0);
  const totalRevenue = Array.from(revByEntity.values()).reduce((s, v) => s + v, 0);

  // ---- By entity ---------------------------------------------------------
  const byEntity: AllocRow[] = ENTITIES.filter((e) => costByEntity.has(e.id) || revByEntity.has(e.id))
    .map((e) => {
      const costByHead = { ...emptyByHead(heads), ...(costByEntity.get(e.id) ?? {}) };
      const totalC = heads.reduce((s, h) => s + (costByHead[h.code] ?? 0), 0);
      return finishRow(
        {
          id: e.id,
          name: e.name,
          sub: entityById(e.id)?.country,
          costByHead,
          totalCost: totalC,
          revenue: revByEntity.get(e.id) ?? 0,
          share: 0,
          margin: 0,
          marginPct: 0,
          costToRevenue: 0,
        },
        totalCost,
      );
    })
    .sort((a, b) => b.totalCost - a.totalCost);

  // ---- By location -------------------------------------------------------
  const byLocation: AllocRow[] = LOCATIONS.filter((l) => costByLoc.has(l.id) || revByLoc.has(l.id))
    .map((l) => {
      const costByHead = { ...emptyByHead(heads), ...(costByLoc.get(l.id) ?? {}) };
      const totalC = heads.reduce((s, h) => s + (costByHead[h.code] ?? 0), 0);
      const loc = locationById(l.id);
      return finishRow(
        {
          id: l.id,
          name: l.name,
          sub: [loc?.city, entityById(l.entityId)?.name].filter(Boolean).join(" · "),
          costByHead,
          totalCost: totalC,
          revenue: revByLoc.get(l.id) ?? 0,
          share: 0,
          margin: 0,
          marginPct: 0,
          costToRevenue: 0,
        },
        totalCost,
      );
    })
    .sort((a, b) => b.totalCost - a.totalCost);

  // ---- By product (driver-based absorption) ------------------------------
  const products = productMix();
  // product revenue from the books, split on the revenue mix.
  const prodRevenue = new Map<string, number>();
  for (const p of products) prodRevenue.set(p.id, totalRevenue * p.weight);
  // direct-cost driver = units × BOM cost; units derived from product revenue.
  const bomWeightTot =
    products.reduce((s, p) => {
      const units = p.sellRate ? (totalRevenue * p.weight) / p.sellRate : 0;
      return s + units * p.unitCost;
    }, 0) || 1;
  // overhead driver weights
  const ohWeight = (p: ProductInfo): number => {
    if (driver === "equal") return 1 / products.length;
    if (driver === "volume") {
      const units = p.sellRate ? (totalRevenue * p.weight) / p.sellRate : 0;
      return units;
    }
    return p.weight; // revenue
  };
  const ohWeightTot = products.reduce((s, p) => s + ohWeight(p), 0) || 1;

  const byProduct: AllocRow[] = products
    .map((p) => {
      const costByHead = emptyByHead(heads);
      const units = p.sellRate ? (totalRevenue * p.weight) / p.sellRate : 0;
      const directW = (units * p.unitCost) / bomWeightTot;
      const ohW = ohWeight(p) / ohWeightTot;
      for (const h of heads) {
        costByHead[h.code] = h.total * (h.isDirect ? directW : ohW);
      }
      const totalC = heads.reduce((s, h) => s + costByHead[h.code], 0);
      return finishRow(
        {
          id: p.id,
          name: p.name,
          sub: `${Math.round(units).toLocaleString("en-IN")} units · ₹${Math.round(
            p.unitCost,
          ).toLocaleString("en-IN")}/u BOM`,
          costByHead,
          totalCost: totalC,
          revenue: prodRevenue.get(p.id) ?? 0,
          share: 0,
          margin: 0,
          marginPct: 0,
          costToRevenue: 0,
        },
        totalCost,
      );
    })
    .sort((a, b) => b.totalCost - a.totalCost);

  return { heads, totalCost, totalRevenue, byEntity, byLocation, byProduct, driver, products };
}

export const DRIVER_LABEL: Record<ProductDriver, string> = {
  revenue: "Revenue share",
  volume: "Sales volume (units)",
  equal: "Equal split",
};
