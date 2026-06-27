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
import { ENTITIES, LOCATIONS, entityById, locationById, resolveEntityIds } from "@/lib/accounting/org";
import { FINISHED_ITEMS, explodedUnitCost, ownershipOf, unitWorksCost, OWNERSHIP_META } from "@/lib/inventory/items";
import { SEED_MOVEMENTS } from "@/lib/inventory/movements";
import type { OwnershipModel, Movement } from "@/lib/inventory/types";

// Allocation driver for absorbing one cost head onto products. Each expense line
// can pick its own metric (revenue / sales volume / equal / bill-of-materials).
export type ProductDriver = "revenue" | "volume" | "equal" | "bom";

// Per-head allocation choice (cost-head code → driver). Empty entries fall back
// to the default: direct (Cost of Sales) heads on BOM, overheads on revenue.
export type HeadDrivers = Record<string, ProductDriver>;

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
  units?: number; // absorption units (for per-unit costs) — product rows only
}

// Period stock movement for one finished product (in UoM), from the stock ledger.
//   closing = opening + production − sales − writeoff + transfers
export interface ProductMovement {
  id: string;
  name: string;
  opening: number;
  production: number;
  sales: number;
  writeoff: number;
  transfers: number; // receipts + inter-location transfers (net)
  closing: number;
  closingValue: number; // closing qty × standard rate (base INR)
}

export interface ProductInfo {
  id: string;
  name: string;
  weight: number; // revenue mix weight (share of period sales value)
  unitCost: number; // exploded BOM cost
  sellRate: number;
  units: number; // units sold in the period (from the stock ledger)
  revenue: number; // units × sellRate
}

// A management cost sheet for one finished product (per-unit build-up).
export interface CostSheet {
  id: string;
  name: string;
  ownership: OwnershipModel;
  units: number;
  material: number; // per unit
  packing: number;
  conversion: number; // own conversion + loan-licence job-work
  thirdParty: number; // landed purchase for bought-in goods
  works: number; // material + packing + conversion + thirdParty
  overhead: number; // absorbed overhead per unit
  totalUnitCost: number;
  sellRate: number;
  marginPerUnit: number;
  marginPct: number;
}

export interface CostAudit {
  heads: CostHead[];
  totalCost: number;
  totalRevenue: number;
  byEntity: AllocRow[];
  byLocation: AllocRow[];
  byProduct: AllocRow[];
  byOwnership: AllocRow[];
  costSheets: CostSheet[];
  drivers: HeadDrivers; // resolved per-head allocation drivers
  productMovements: ProductMovement[];
  products: ProductInfo[];
}

const HEAD_ORDER = [
  "5010",
  "5020",
  "5040",
  "5050",
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

/** Default driver for a head when the caller hasn't overridden it. */
const defaultDriver = (h: CostHead): ProductDriver => (h.isDirect ? "bom" : "revenue");

export function buildCostAudit(
  f: ReportFilters,
  drivers: HeadDrivers = {},
  movements: Movement[] = SEED_MOVEMENTS,
): CostAudit {
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

  // ---- Per-product stock movement (actual ledger) ------------------------
  // This is the single source of truth for product volumes — the matrix,
  // per-unit costs, cost sheets and the movement table all read these numbers,
  // so everything ties out (no synthetic mix weights).
  const productMovements = buildProductMovements(f, movements);
  const soldOf = new Map(productMovements.map((m) => [m.id, Math.max(0, m.sales)]));

  // ---- By product (per-head driver absorption) ---------------------------
  // Volumes & revenue come straight from the dispatch ledger; each cost head is
  // absorbed on its own driver. Only SKUs that actually sold in the period are
  // allocated cost (revenue/volume/BOM weights are taken over that set).
  const products: ProductInfo[] = FINISHED_ITEMS.map((it) => {
    const units = soldOf.get(it.id) ?? 0;
    return {
      id: it.id,
      name: it.name,
      weight: 0,
      unitCost: explodedUnitCost(it.id),
      sellRate: it.rate,
      units,
      revenue: units * it.rate,
    };
  }).filter((p) => p.units > 0);
  const sumRevenue = products.reduce((s, p) => s + p.revenue, 0) || 1;
  for (const p of products) p.weight = p.revenue / sumRevenue;
  const prodRevenue = new Map(products.map((p) => [p.id, p.revenue]));
  const unitsArr = products.map((p) => p.units);
  const bomArr = products.map((p) => p.units * p.unitCost);
  const sumUnits = unitsArr.reduce((s, u) => s + u, 0) || 1;
  const sumBom = bomArr.reduce((s, b) => s + b, 0) || 1;
  const weightOf = (d: ProductDriver, i: number): number => {
    if (d === "equal") return products.length ? 1 / products.length : 0;
    if (d === "volume") return unitsArr[i] / sumUnits;
    if (d === "bom") return bomArr[i] / sumBom;
    return products[i].revenue / sumRevenue; // revenue share
  };
  // resolve every head's effective driver once (overrides ∪ defaults).
  const resolvedDrivers: HeadDrivers = {};
  for (const h of heads) resolvedDrivers[h.code] = drivers[h.code] ?? defaultDriver(h);

  const byProduct: AllocRow[] = products
    .map((p, i) => {
      const costByHead = emptyByHead(heads);
      for (const h of heads) costByHead[h.code] = h.total * weightOf(resolvedDrivers[h.code], i);
      const totalC = heads.reduce((s, h) => s + costByHead[h.code], 0);
      return finishRow(
        {
          id: p.id,
          name: p.name,
          sub: `${Math.round(p.units).toLocaleString("en-IN")} sold · ₹${Math.round(
            p.unitCost,
          ).toLocaleString("en-IN")}/u BOM`,
          costByHead,
          totalCost: totalC,
          revenue: p.revenue,
          share: 0,
          margin: 0,
          marginPct: 0,
          costToRevenue: 0,
          units: p.units,
        },
        totalCost,
      );
    })
    .sort((a, b) => b.totalCost - a.totalCost);

  // ---- By ownership model (own / loan-licence / third-party) -------------
  // Direct heads map to their sourcing model; overheads spread on revenue share.
  const directOwnership = (code: string): OwnershipModel =>
    code === "5040" ? "loan-license" : code === "5050" ? "third-party" : "own";
  const ownRevenue = new Map<OwnershipModel, number>();
  for (const p of products) {
    const o = ownershipOf(p.id);
    ownRevenue.set(o, (ownRevenue.get(o) ?? 0) + (prodRevenue.get(p.id) ?? 0));
  }
  const OWN_ORDER: OwnershipModel[] = ["own", "loan-license", "third-party"];
  const byOwnership: AllocRow[] = OWN_ORDER.map((o) => {
    const costByHead = emptyByHead(heads);
    const revShare = (ownRevenue.get(o) ?? 0) / sumRevenue;
    for (const h of heads) {
      costByHead[h.code] = h.isDirect ? (directOwnership(h.code) === o ? h.total : 0) : h.total * revShare;
    }
    const totalC = heads.reduce((s, h) => s + costByHead[h.code], 0);
    return finishRow(
      {
        id: o,
        name: OWNERSHIP_META[o].label,
        sub: OWNERSHIP_META[o].account ? `Direct head ${OWNERSHIP_META[o].account}` : undefined,
        costByHead,
        totalCost: totalC,
        revenue: ownRevenue.get(o) ?? 0,
        share: 0,
        margin: 0,
        marginPct: 0,
        costToRevenue: 0,
      },
      totalCost,
    );
  }).filter((r) => r.totalCost > 0.5 || r.revenue > 0.5);

  // ---- Product cost sheets (per-unit standard build-up + absorbed OH) -----
  // All finished SKUs (even unsold ones show their standard works cost); the
  // absorbed overhead per unit uses the same sold units as the matrix.
  const byProductId = new Map(byProduct.map((r) => [r.id, r]));
  const costSheets: CostSheet[] = FINISHED_ITEMS
    .map((it) => {
      const units = soldOf.get(it.id) ?? 0;
      const w = unitWorksCost(it.id);
      const row = byProductId.get(it.id);
      const overheadTotal = row ? heads.filter((h) => !h.isDirect).reduce((s, h) => s + (row.costByHead[h.code] ?? 0), 0) : 0;
      const overhead = units ? overheadTotal / units : 0;
      const totalUnitCost = w.works + overhead;
      const sellRate = it.rate;
      const marginPerUnit = sellRate - totalUnitCost;
      return {
        id: it.id,
        name: it.name,
        ownership: w.ownership,
        units,
        material: w.material,
        packing: w.packing,
        conversion: w.conversion,
        thirdParty: w.thirdParty,
        works: w.works,
        overhead,
        totalUnitCost,
        sellRate,
        marginPerUnit,
        marginPct: sellRate ? marginPerUnit / sellRate : 0,
      };
    })
    .sort((a, b) => b.units * b.totalUnitCost - a.units * a.totalUnitCost);

  return {
    heads,
    totalCost,
    totalRevenue,
    byEntity,
    byLocation,
    byProduct,
    byOwnership,
    costSheets,
    drivers: resolvedDrivers,
    productMovements,
    products,
  };
}

// ---- Stock movement per finished product, scoped + period-bounded ----------
function movementInScope(m: Movement, f: ReportFilters): boolean {
  const loc = locationById(m.locationId);
  if (f.entityId !== "all" && !resolveEntityIds(f.entityId).includes(loc?.entityId ?? "")) return false;
  if (f.locationId !== "all" && m.locationId !== f.locationId) return false;
  if (f.state !== "all" && loc?.state !== f.state) return false;
  return true;
}

function buildProductMovements(f: ReportFilters, movements: Movement[]): ProductMovement[] {
  return FINISHED_ITEMS.map((it) => {
    let opening = 0,
      production = 0,
      sales = 0,
      writeoff = 0,
      transfers = 0;
    for (const m of movements) {
      if (m.itemId !== it.id || !movementInScope(m, f)) continue;
      if (f.to && m.date > f.to) continue; // ignore anything after the period end
      // Opening balance = the brought-forward 'opening' line plus anything dated
      // before the period start (carried forward into the opening position).
      if (m.type === "opening" || (f.from && m.date < f.from)) {
        opening += m.qty;
        continue;
      }
      if (m.type === "production") production += m.qty;
      else if (m.type === "sale") sales += -m.qty;
      else if (m.type === "adjustment") writeoff += -m.qty; // negative adj → positive write-off
      else transfers += m.qty; // receipt / transfer-in / transfer-out
    }
    const closing = opening + production - sales - writeoff + transfers;
    return { id: it.id, name: it.name, opening, production, sales, writeoff, transfers, closing, closingValue: closing * it.rate };
  }).filter((r) => r.opening || r.production || r.sales || r.writeoff || r.transfers || r.closing);
}

export const DRIVER_LABEL: Record<ProductDriver, string> = {
  revenue: "Revenue share",
  volume: "Sales volume (units)",
  equal: "Equal split",
  bom: "BOM / works cost",
};

/** Short tag for a driver, for compact UI badges. */
export const DRIVER_SHORT: Record<ProductDriver, string> = {
  revenue: "Revenue",
  volume: "Volume",
  equal: "Equal",
  bom: "BOM",
};
