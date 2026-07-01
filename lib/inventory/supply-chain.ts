// ---------------------------------------------------------------------------
// Supply-chain operations for junior roles:
//   • Purchase Requisition (PR)  — raise a request to buy
//   • Goods Receipt Note (GRN)   — record goods received; auto-posts stock
//   • Stock Count                — physical count vs system; posts adjustments
//   • Material Issue (MIS)       — issue RM/PM from store to production
// ---------------------------------------------------------------------------

import type { Movement } from "./types";
import { buildStockIndex, allMovements, stockAt, stockTotal } from "./movements";
import { ITEMS, itemById } from "./items";
import { LOCATIONS } from "@/lib/accounting/org";

// ---------------------------------------------------------------------------
// Purchase Requisition
// ---------------------------------------------------------------------------
export type PRStatus = "draft" | "submitted" | "approved" | "rejected" | "ordered";

export interface PRLine {
  itemId: string;
  qty: number;
  note?: string;
}

export interface PurchaseRequisition {
  id: string;
  ref: string;
  date: string;
  requestedBy: string;
  lines: PRLine[];
  note?: string;
  status: PRStatus;
  approvedBy?: string;
  approvedDate?: string;
  poRef?: string;
  source?: "manual" | "auto-rol" | "mrp";
}

// ---------------------------------------------------------------------------
// Goods Receipt Note
// ---------------------------------------------------------------------------
export type GRNStatus = "draft" | "pending-qc" | "qc-passed" | "qc-rejected" | "posted";

export interface GRNLine {
  itemId: string;
  qty: number;
  unitPrice?: number; // actual purchase price per unit (for WACOG / landed cost)
  batchNo?: string;
  expiry?: string;
}

// ---------------------------------------------------------------------------
// QC inspection result (attached to GRN after inspection)
// ---------------------------------------------------------------------------
export interface QCLineResult {
  itemId: string;
  acceptedQty: number;
  rejectedQty: number;
  rejectionReason?: string;
}

export interface QCResult {
  inspectedBy: string;   // employee id
  inspectedDate: string; // ISO date
  verdict: "passed" | "partial" | "rejected";
  remarks?: string;
  lines: QCLineResult[];
}

export interface GoodsReceiptNote {
  id: string;
  ref: string;
  date: string;
  vendorName: string;
  poRef?: string;
  locationId: string;
  receivedBy: string;
  lines: GRNLine[];
  note?: string;
  status: GRNStatus;
  /** QC inspection result — present after inspection is submitted */
  qcResult?: QCResult;
  /** Total freight / transport charge for this GRN */
  freightTotal?: number;
  /** Allocation basis: "value" (qty×rate) or "qty" */
  freightBasis?: "value" | "qty";
}

// ---------------------------------------------------------------------------
// Stock Count
// ---------------------------------------------------------------------------
export type CountStatus = "open" | "submitted" | "approved" | "posted";

export interface CountLine {
  itemId: string;
  systemQty: number;
  countedQty: number;
}

export interface StockCount {
  id: string;
  ref: string;
  date: string;
  locationId: string;
  countedBy: string;
  lines: CountLine[];
  note?: string;
  status: CountStatus;
}

// ---------------------------------------------------------------------------
// Material Issue
// ---------------------------------------------------------------------------
export type IssueStatus = "draft" | "posted";

export interface IssueLine {
  itemId: string;
  qty: number;
}

export interface MaterialIssue {
  id: string;
  ref: string;
  date: string;
  productionRef?: string;
  locationId: string;
  issuedBy: string;
  lines: IssueLine[];
  note?: string;
  status: IssueStatus;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------
export const SEED_PRS: PurchaseRequisition[] = [];
export const SEED_GRNS: GoodsReceiptNote[] = [];
export const SEED_COUNTS: StockCount[] = [];
export const SEED_ISSUES: MaterialIssue[] = [];

// ---------------------------------------------------------------------------
// Ref generators
// ---------------------------------------------------------------------------
function nextRef(prefix: string, existing: string[]): string {
  let max = 0;
  for (const r of existing) {
    const n = parseInt(r.replace(`${prefix}-`, ""), 10);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return `${prefix}-${String(max + 1).padStart(4, "0")}`;
}

export function nextPRRef(added: PurchaseRequisition[]) {
  return nextRef("PR", [...SEED_PRS, ...added].map((x) => x.ref));
}
export function nextGRNRef(added: GoodsReceiptNote[]) {
  return nextRef("GRN", [...SEED_GRNS, ...added].map((x) => x.ref));
}
export function nextCountRef(added: StockCount[]) {
  return nextRef("SC", [...SEED_COUNTS, ...added].map((x) => x.ref));
}
export function nextIssueRef(added: MaterialIssue[]) {
  return nextRef("MIS", [...SEED_ISSUES, ...added].map((x) => x.ref));
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
const PR_KEY = "nexa-sc-pr";
const GRN_KEY = "nexa-sc-grn";
const COUNT_KEY = "nexa-sc-count";
const ISSUE_KEY = "nexa-sc-issue";

function load<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}

function save<T>(key: string, items: T[]) {
  try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* ignore */ }
}

export const loadPRs = () => load<PurchaseRequisition>(PR_KEY);
export const savePRs = (v: PurchaseRequisition[]) => save(PR_KEY, v);
export const loadGRNs = () => load<GoodsReceiptNote>(GRN_KEY);
export const saveGRNs = (v: GoodsReceiptNote[]) => save(GRN_KEY, v);
export const loadCounts = () => load<StockCount>(COUNT_KEY);
export const saveCounts = (v: StockCount[]) => save(COUNT_KEY, v);
export const loadIssues = () => load<MaterialIssue>(ISSUE_KEY);
export const saveIssues = (v: MaterialIssue[]) => save(ISSUE_KEY, v);

export function allPRs(added: PurchaseRequisition[]) { return [...SEED_PRS, ...added]; }
export function allGRNs(added: GoodsReceiptNote[]) { return [...SEED_GRNS, ...added]; }
export function allCounts(added: StockCount[]) { return [...SEED_COUNTS, ...added]; }
export function allIssues(added: MaterialIssue[]) { return [...SEED_ISSUES, ...added]; }

// ---------------------------------------------------------------------------
// Movement builders — called on "Post"
// ---------------------------------------------------------------------------
export function buildGRNMovements(grn: GoodsReceiptNote): Movement[] {
  return grn.lines
    .map((l, i) => {
      // Use QC-accepted qty if inspection has been done; otherwise full qty
      const qcLine = grn.qcResult?.lines.find((q) => q.itemId === l.itemId);
      const effectiveQty = qcLine ? qcLine.acceptedQty : l.qty;
      if (effectiveQty <= 0 || !itemById(l.itemId)) return null;
      return {
        id: `${grn.ref}-g${i}`,
        date: grn.date,
        itemId: l.itemId,
        locationId: grn.locationId,
        type: "receipt" as const,
        qty: effectiveQty,
        ref: grn.ref,
        note: `${grn.vendorName}${grn.poRef ? ` · ${grn.poRef}` : ""}`,
        byId: grn.receivedBy,
        batchNo: l.batchNo,
        expiry: l.expiry,
      };
    })
    .filter(Boolean) as Movement[];
}

export function buildCountAdjustments(count: StockCount): Movement[] {
  return count.lines
    .filter((l) => l.countedQty !== l.systemQty)
    .map((l, i) => ({
      id: `${count.ref}-a${i}`,
      date: count.date,
      itemId: l.itemId,
      locationId: count.locationId,
      type: "adjustment" as const,
      qty: l.countedQty - l.systemQty,
      ref: count.ref,
      note: `Stock count variance`,
      byId: count.countedBy,
    }));
}

export function buildIssueMovements(issue: MaterialIssue): Movement[] {
  return issue.lines
    .filter((l) => l.qty > 0 && itemById(l.itemId))
    .map((l, i) => ({
      id: `${issue.ref}-m${i}`,
      date: issue.date,
      itemId: l.itemId,
      locationId: issue.locationId,
      type: "consumption" as const,
      qty: -Math.abs(l.qty),
      ref: issue.ref,
      note: issue.productionRef ? `Issue to ${issue.productionRef}` : "Store issue",
      byId: issue.issuedBy,
    }));
}

// ---------------------------------------------------------------------------
// Stock snapshot helper for stock count form
// ---------------------------------------------------------------------------
export function stockSnapshot(locationId: string, movements: Movement[]) {
  const idx = buildStockIndex(movements);
  return ITEMS.map((it) => ({
    item: it,
    systemQty: stockAt(idx, it.id, locationId),
  })).filter((r) => r.systemQty > 0);
}

// ---------------------------------------------------------------------------
// Auto-PR generation — ROL-triggered
// ---------------------------------------------------------------------------

/** Avg daily outflow for an item across the whole movement history. */
function avgDailyOutflow(movements: Movement[], itemId: string): number {
  const out = movements.filter(
    (m) => m.itemId === itemId && m.qty < 0 && ["consumption", "sale", "transfer-out"].includes(m.type),
  );
  if (out.length === 0) return 0;
  let minDate = "9999", maxDate = "0000", total = 0;
  for (const m of out) {
    total += Math.abs(m.qty);
    if (m.date < minDate) minDate = m.date;
    if (m.date > maxDate) maxDate = m.date;
  }
  const histDays = Math.max(1, (new Date(maxDate).getTime() - new Date(minDate).getTime()) / 86400000 + 1);
  return total / histDays;
}

/** Context stored per auto-ROL line so SCM can see the full picture. */
export interface AutoRolLineContext {
  onHand: number;
  rol: number;
  suggestedQty: number;
  leadTimeDays: number;
  safetyDays: number;
  avgDailyDemand: number;
  leadTimeDemand: number;
  safetyBuffer: number;
  uom: string;
}

const AUTO_ROL_CONTEXT_KEY = "nexa-sc-rol-context";

export function loadRolContext(): Record<string, AutoRolLineContext> {
  if (typeof window === "undefined") return {};
  try { const r = localStorage.getItem(AUTO_ROL_CONTEXT_KEY); return r ? JSON.parse(r) : {}; } catch { return {}; }
}
export function saveRolContext(ctx: Record<string, AutoRolLineContext>) {
  try { localStorage.setItem(AUTO_ROL_CONTEXT_KEY, JSON.stringify(ctx)); } catch { /* ignore */ }
}

/**
 * Scan the item master for all purchasable items below ROL and build a single
 * purchase requisition — placed directly in "submitted" status for SCM review.
 *
 * Order qty formula:
 *   target = ROL + avgDaily × (leadTimeDays + safetyDays)
 *   qty    = max(1, ceil(target − onHand))
 *
 * Returns null when everything is above ROL.
 */
export function buildAutoRolPRs(
  movements: Movement[],
  added: PurchaseRequisition[],
  requestedBy: string,
  date: string,
): { pr: PurchaseRequisition; context: Record<string, AutoRolLineContext> } | null {
  const idx = buildStockIndex(movements);
  const lines: PRLine[] = [];
  const context: Record<string, AutoRolLineContext> = {};

  for (const item of ITEMS) {
    if (item.category === "semi-finished") continue;
    if (item.category === "finished" && item.ownership !== "third-party") continue;

    const onHand = stockTotal(idx, item.id);
    if (onHand >= item.reorderLevel) continue;

    const daily = avgDailyOutflow(movements, item.id);
    const leadDays = item.leadTimeDays ?? 7;
    const safetyDays_ = item.safetyDays ?? 3;
    const leadTimeDemand = daily * leadDays;
    const safetyBuffer = daily * safetyDays_;
    const target = item.reorderLevel + leadTimeDemand + safetyBuffer;
    const qty = Math.max(1, Math.ceil(target - onHand));

    lines.push({ itemId: item.id, qty });
    context[item.id] = {
      onHand,
      rol: item.reorderLevel,
      suggestedQty: qty,
      leadTimeDays: leadDays,
      safetyDays: safetyDays_,
      avgDailyDemand: daily,
      leadTimeDemand,
      safetyBuffer,
      uom: item.uom,
    };
  }

  if (lines.length === 0) return null;

  const ref = nextPRRef(added);
  const pr: PurchaseRequisition = {
    id: `pr-rol-${Date.now()}`,
    ref,
    date,
    requestedBy,
    lines,
    note: `System-generated — ${lines.length} item${lines.length !== 1 ? "s" : ""} below reorder level. Review quantities and convert to PO.`,
    status: "submitted",
    source: "auto-rol",
  };
  return { pr, context };
}

// ---------------------------------------------------------------------------
// Status metadata
// ---------------------------------------------------------------------------
export const PR_STATUS_META: Record<PRStatus, { label: string; variant: "default" | "primary" | "warning" | "success" | "danger" }> = {
  draft:    { label: "Draft",    variant: "default" },
  submitted:{ label: "Submitted",variant: "primary" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger"  },
  ordered:  { label: "Ordered",  variant: "warning" },
};

export const GRN_STATUS_META: Record<GRNStatus, { label: string; variant: "default" | "primary" | "warning" | "success" | "danger" }> = {
  draft:         { label: "Draft",        variant: "default"  },
  "pending-qc":  { label: "Pending QC",   variant: "warning"  },
  "qc-passed":   { label: "QC Passed",    variant: "primary"  },
  "qc-rejected": { label: "QC Rejected",  variant: "danger"   },
  posted:        { label: "Posted",       variant: "success"  },
};

export const COUNT_STATUS_META: Record<CountStatus, { label: string; variant: "default" | "primary" | "warning" | "success" }> = {
  open:      { label: "Open",      variant: "default"  },
  submitted: { label: "Submitted", variant: "primary"  },
  approved:  { label: "Approved",  variant: "warning"  },
  posted:    { label: "Posted",    variant: "success"  },
};

export const ISSUE_STATUS_META: Record<IssueStatus, { label: string; variant: "default" | "success" }> = {
  draft:  { label: "Draft",  variant: "default" },
  posted: { label: "Posted", variant: "success" },
};
