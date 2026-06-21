import type { StockIndex } from "./movements";
import { stockTotal } from "./movements";
import { bomFor, itemById, ITEMS, dynamicReorderLevel } from "./items";
import type { Movement } from "./types";

// ---------------------------------------------------------------------------
// MRP-lite demand planning — single-level netting per manufacturing stage.
//
// Stage order:
//   1. Finished goods (FG) — net demand against on-hand FG stock
//   2. Semi-finished (SFG) — explode FG BOM for required SFG, net against stock
//   3. Raw + Packing (RM/PM) — explode SFG BOM + FG packing, net against stock
//
// Each PlanLine carries gross/onHand/net so the UI can show coverage status.
// ---------------------------------------------------------------------------

export interface DemandEntry {
  itemId: string;
  qty: number; // requested finished-good output quantity
}

export interface PlanLine {
  itemId: string;
  gross: number;      // total required quantity
  onHand: number;     // current on-hand stock
  net: number;        // quantity to produce / purchase (max 0, gross − onHand)
  pct: number;        // coverage % (onHand / gross × 100), capped at 100
  action: "produce" | "purchase" | "job-work" | "none";
  dynamicROL: number; // demand-derived reorder level (lead time + safety days × avg demand)
  staticROL: number;  // original fixed reorder level from item master
  rolSource: "dynamic" | "static";
}

export interface MrpPlan {
  finishedGoods: PlanLine[];
  semiFinished: PlanLine[];
  procurement: PlanLine[];
}

function lineFor(
  itemId: string,
  gross: number,
  idx: StockIndex,
  avgDailyDemand = 0,
): PlanLine {
  const item = itemById(itemId);
  const onHand = stockTotal(idx, itemId);
  const net = Math.max(0, gross - onHand);
  const pct = gross > 0 ? Math.min(100, (onHand / gross) * 100) : 100;
  let action: PlanLine["action"] = "none";
  if (net > 0) {
    const cat = item?.category;
    const own = item?.ownership ?? "own";
    if (cat === "raw" || cat === "packing") action = "purchase";
    else if (own === "third-party") action = "purchase";
    else if (own === "loan-license") action = "job-work";
    else action = "produce";
  }
  const staticROL = item?.reorderLevel ?? 0;
  const dynROL = item ? dynamicReorderLevel(item, avgDailyDemand) : staticROL;
  return {
    itemId, gross, onHand, net, pct, action,
    dynamicROL: dynROL,
    staticROL,
    rolSource: item?.leadTimeDays && avgDailyDemand > 0 ? "dynamic" : "static",
  };
}

export function runMrp(demand: DemandEntry[], idx: StockIndex, horizonDays = 30, avgDaily: Record<string, number> = {}): MrpPlan {
  // --- Stage 1: FG netting ---
  const fgLines: PlanLine[] = demand
    .filter((d) => d.qty > 0)
    .map((d) => lineFor(d.itemId, d.qty, idx, avgDaily[d.itemId] ?? (horizonDays > 0 ? d.qty / horizonDays : 0)));

  // --- Stage 2: SFG aggregation from FG net ---
  const sfgAgg = new Map<string, number>();
  for (const fg of fgLines) {
    if (fg.net <= 0) continue;
    for (const comp of bomFor(fg.itemId)) {
      const it = itemById(comp.itemId);
      if (it?.category === "semi-finished") {
        sfgAgg.set(comp.itemId, (sfgAgg.get(comp.itemId) ?? 0) + comp.qtyPerUnit * fg.net);
      }
    }
  }
  const sfgLines: PlanLine[] = [...sfgAgg.entries()].map(([id, gross]) =>
    lineFor(id, gross, idx, horizonDays > 0 ? gross / horizonDays : 0)
  );

  // --- Stage 3: RM + PM aggregation ---
  const procAgg = new Map<string, number>();

  // Packing consumed by FG production
  for (const fg of fgLines) {
    if (fg.net <= 0) continue;
    for (const comp of bomFor(fg.itemId)) {
      const it = itemById(comp.itemId);
      if (it?.category === "packing") {
        procAgg.set(comp.itemId, (procAgg.get(comp.itemId) ?? 0) + comp.qtyPerUnit * fg.net);
      }
    }
  }

  // Raw materials consumed by SFG net production
  for (const sfg of sfgLines) {
    if (sfg.net <= 0) continue;
    for (const comp of bomFor(sfg.itemId)) {
      const it = itemById(comp.itemId);
      if (it?.category === "raw") {
        procAgg.set(comp.itemId, (procAgg.get(comp.itemId) ?? 0) + comp.qtyPerUnit * sfg.net);
      }
    }
  }

  const procLines: PlanLine[] = [...procAgg.entries()].map(([id, gross]) =>
    lineFor(id, gross, idx, horizonDays > 0 ? gross / horizonDays : 0)
  );

  return { finishedGoods: fgLines, semiFinished: sfgLines, procurement: procLines };
}

// ---------------------------------------------------------------------------
// Derive suggested demand from the movement ledger (avg daily sales × horizon).
// Uses "sale" movements for finished goods only.
// ---------------------------------------------------------------------------
export interface DemandStats {
  suggested: Record<string, number>;   // horizon-scaled qty per FG item
  avgDaily: Record<string, number>;    // avg daily units sold (for ROL calc)
}

export function suggestedDemand(
  movements: Movement[],
  horizonDays: number,
): DemandStats {
  const fgIds = new Set(ITEMS.filter((i) => i.category === "finished").map((i) => i.id));
  const saleTotals = new Map<string, number>(); // itemId → total sold qty (positive)
  let minDate = "9999", maxDate = "0000";

  for (const m of movements) {
    if (m.type !== "sale" || !fgIds.has(m.itemId)) continue;
    const abs = Math.abs(m.qty);
    saleTotals.set(m.itemId, (saleTotals.get(m.itemId) ?? 0) + abs);
    if (m.date < minDate) minDate = m.date;
    if (m.date > maxDate) maxDate = m.date;
  }

  // Days spanned by the history window (at least 1)
  const histDays = Math.max(
    1,
    (new Date(maxDate).getTime() - new Date(minDate).getTime()) / 86400000 + 1,
  );

  const suggested: Record<string, number> = {};
  const avgDaily: Record<string, number> = {};
  for (const [id, total] of saleTotals) {
    const daily = total / histDays;
    avgDaily[id] = daily;
    suggested[id] = Math.ceil(daily * horizonDays);
  }
  return { suggested, avgDaily };
}
