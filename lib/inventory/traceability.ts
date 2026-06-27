// ---------------------------------------------------------------------------
// Batch / lot traceability — forward and backward trace through the movement
// ledger.
//
// The core problem: movement records carry batchNo only on inflow movements
// (receipt, production output). Consumption records reference a production run
// (via `ref`) but don't carry the specific batch consumed. We resolve this with
// a FIFO assumption: the oldest receipt of an item at a location is consumed
// first.
//
// Trace result structure:
//   Receipt/Production of the queried batch
//   └── Was consumed in production run(s) [via FIFO or ref match]
//        └── Which produced output batch(es)
//             └── Which were dispatched / transferred
// ---------------------------------------------------------------------------

import type { Movement, MovementType } from "./types";
import { itemById } from "./items";

export interface TraceMovement {
  id: string;
  date: string;
  type: MovementType;
  itemId: string;
  itemName: string;
  qty: number;
  locationId: string;
  ref?: string;
  batchNo?: string;
  note?: string;
}

export interface ProductionRun {
  ref: string;
  date: string;
  note?: string;
  inputs: TraceMovement[];
  outputs: TraceMovement[];
}

export interface TraceResult {
  batchNo: string;
  /** Movements that directly carry this batch number */
  directMovements: TraceMovement[];
  /** Production runs that created this batch (batch is an output) */
  createdBy: ProductionRun[];
  /** Production runs that consumed items from this batch (via FIFO) */
  consumedBy: ProductionRun[];
  /** Dispatch/sale movements for items produced from this batch chain */
  dispatched: TraceMovement[];
  /** If not found: empty result */
  found: boolean;
}

function toTrace(m: Movement): TraceMovement {
  return {
    id: m.id,
    date: m.date,
    type: m.type,
    itemId: m.itemId,
    itemName: itemById(m.itemId)?.name ?? m.itemId,
    qty: m.qty,
    locationId: m.locationId,
    ref: m.ref,
    batchNo: m.batchNo,
    note: m.note,
  };
}

function buildProductionRun(ref: string, movements: Movement[]): ProductionRun {
  const runMvs = movements.filter((m) => m.ref === ref);
  const date = runMvs.map((m) => m.date).sort()[0] ?? "";
  const note = runMvs.find((m) => m.note)?.note;
  return {
    ref,
    date,
    note,
    inputs: runMvs.filter((m) => m.qty < 0).map(toTrace),
    outputs: runMvs.filter((m) => m.qty > 0).map(toTrace),
  };
}

/**
 * Find all production run refs that consumed a given itemId after a given date
 * (FIFO assumption: earliest receipts consumed first).
 */
function findConsumingRuns(
  itemId: string,
  afterDate: string,
  movements: Movement[],
): string[] {
  const consumptions = movements.filter(
    (m) =>
      m.itemId === itemId &&
      m.qty < 0 &&
      ["consumption", "sale", "transfer-out"].includes(m.type) &&
      m.ref &&
      m.date >= afterDate,
  );
  return [...new Set(consumptions.map((m) => m.ref!))];
}

/**
 * Trace a batch number through the movement ledger.
 * Supports partial match (e.g. "FLR" will match "FLR-2605").
 */
export function traceBatch(query: string, movements: Movement[]): TraceResult {
  const q = query.trim().toLowerCase();
  if (!q) return { batchNo: query, directMovements: [], createdBy: [], consumedBy: [], dispatched: [], found: false };

  // ── 1. Direct batch hits ──────────────────────────────────────────────────
  const direct = movements.filter(
    (m) => m.batchNo && m.batchNo.toLowerCase().includes(q),
  );

  if (direct.length === 0) {
    return { batchNo: query, directMovements: [], createdBy: [], consumedBy: [], dispatched: [], found: false };
  }

  // ── 2. Production runs that CREATED this batch ────────────────────────────
  // A batch is "created" by a production run when it appears as an output (qty > 0)
  const createdByRefs = [
    ...new Set(
      direct
        .filter((m) => m.qty > 0 && m.ref && (m.ref.startsWith("PROD-") || m.ref.startsWith("MFG-") || m.ref.startsWith("GRN")))
        .map((m) => m.ref!),
    ),
  ];
  const createdBy = createdByRefs.map((ref) => buildProductionRun(ref, movements));

  // ── 3. Production runs that CONSUMED items from this batch (FIFO) ─────────
  // For each direct movement that is an inflow (receipt / opening), find what
  // consumed that item after this receipt date.
  const consumedByRefs = new Set<string>();

  for (const m of direct.filter((m) => m.qty > 0)) {
    const consumingRefs = findConsumingRuns(m.itemId, m.date, movements);
    for (const ref of consumingRefs) {
      if (ref.startsWith("PROD-") || ref.startsWith("MFG-")) consumedByRefs.add(ref);
    }
  }

  // Also include consumptions from production runs that created this batch
  // (to show what the batch's parent items were consumed by)
  for (const run of createdBy) {
    for (const inp of run.inputs) {
      const refs = findConsumingRuns(inp.itemId, inp.date, movements);
      for (const ref of refs) {
        if (ref !== run.ref && (ref.startsWith("PROD-") || ref.startsWith("MFG-")))
          consumedByRefs.add(ref);
      }
    }
  }

  // Build runs but limit to avoid noise
  const consumedBy = [...consumedByRefs]
    .slice(0, 6)
    .map((ref) => buildProductionRun(ref, movements));

  // ── 4. Dispatch / sale movements for output items ─────────────────────────
  // Collect all item IDs that appear as outputs in createdBy + consumedBy runs
  const outputItemIds = new Set<string>();
  for (const run of [...createdBy, ...consumedBy]) {
    for (const out of run.outputs) outputItemIds.add(out.itemId);
  }
  // Also add direct items
  for (const m of direct) outputItemIds.add(m.itemId);

  const dispatched = movements
    .filter(
      (m) =>
        outputItemIds.has(m.itemId) &&
        m.qty < 0 &&
        ["sale", "transfer-out"].includes(m.type),
    )
    .slice(0, 10)
    .map(toTrace);

  return {
    batchNo: direct[0].batchNo ?? query,
    directMovements: direct.map(toTrace),
    createdBy,
    consumedBy,
    dispatched,
    found: true,
  };
}

/**
 * Return all distinct batch numbers from the movement ledger (for autocomplete).
 */
export function allBatchNumbers(movements: Movement[]): string[] {
  const set = new Set<string>();
  for (const m of movements) {
    if (m.batchNo) set.add(m.batchNo);
  }
  return [...set].sort();
}
