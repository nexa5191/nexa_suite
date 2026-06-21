// ---------------------------------------------------------------------------
// Supply-chain operations for junior roles:
//   • Purchase Requisition (PR)  — raise a request to buy
//   • Goods Receipt Note (GRN)   — record goods received; auto-posts stock
//   • Stock Count                — physical count vs system; posts adjustments
//   • Material Issue (MIS)       — issue RM/PM from store to production
// ---------------------------------------------------------------------------

import type { Movement } from "./types";
import { buildStockIndex, allMovements, stockAt } from "./movements";
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
}

// ---------------------------------------------------------------------------
// Goods Receipt Note
// ---------------------------------------------------------------------------
export type GRNStatus = "draft" | "posted";

export interface GRNLine {
  itemId: string;
  qty: number;
  batchNo?: string;
  expiry?: string;
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
export const SEED_PRS: PurchaseRequisition[] = [
  {
    id: "pr-001", ref: "PR-0001", date: "2026-06-10",
    requestedBy: "emp-024",
    lines: [
      { itemId: "rm-durum", qty: 15000, note: "Below reorder — urgent" },
      { itemId: "pm-tin15", qty: 2000, note: "Below reorder" },
    ],
    note: "Reorder triggered by low-stock alert",
    status: "approved",
    approvedBy: "emp-023",
    approvedDate: "2026-06-11",
    poRef: "PO-2010",
  },
  {
    id: "pr-002", ref: "PR-0002", date: "2026-06-14",
    requestedBy: "emp-024",
    lines: [
      { itemId: "rm-wheat", qty: 60000 },
      { itemId: "pm-bag50", qty: 2000 },
      { itemId: "pm-bag25", qty: 3000 },
    ],
    note: "Monthly restock — Q1 closing",
    status: "submitted",
  },
  {
    id: "pr-003", ref: "PR-0003", date: "2026-06-18",
    requestedBy: "emp-021",
    lines: [
      { itemId: "pm-pouch1", qty: 20000 },
      { itemId: "pm-label", qty: 20000 },
    ],
    status: "draft",
  },
];

export const SEED_GRNS: GoodsReceiptNote[] = [
  {
    id: "grn-001", ref: "GRN-0001", date: "2026-06-12",
    vendorName: "Sterling Foods", poRef: "PO-2007",
    locationId: "loc-mys", receivedBy: "emp-021",
    lines: [
      { itemId: "rm-wheat", qty: 50000, batchNo: "WHT-2606-A" },
    ],
    note: "Weigh-bridge checked. No damage.",
    status: "posted",
  },
  {
    id: "grn-002", ref: "GRN-0002", date: "2026-06-20",
    vendorName: "Jain Packaging Co.", poRef: "PR-0001",
    locationId: "loc-mys", receivedBy: "emp-021",
    lines: [
      { itemId: "pm-tin15", qty: 1800 },
    ],
    note: "Short delivery. Balance expected next week.",
    status: "draft",
  },
];

export const SEED_COUNTS: StockCount[] = [
  {
    id: "sc-001", ref: "SC-0001", date: "2026-06-15",
    locationId: "loc-mys", countedBy: "emp-021",
    lines: [
      { itemId: "rm-wheat", systemQty: 148700, countedQty: 148200 },
      { itemId: "rm-durum", systemQty: 25000, countedQty: 25000 },
      { itemId: "pm-bag50", systemQty: 2695, countedQty: 2690 },
      { itemId: "pm-tin15", systemQty: 2500, countedQty: 2480 },
      { itemId: "sfg-flour", systemQty: 35000, countedQty: 35000 },
    ],
    note: "Monthly cycle count — Mysuru Plant",
    status: "submitted",
  },
];

export const SEED_ISSUES: MaterialIssue[] = [
  {
    id: "mis-001", ref: "MIS-0001", date: "2026-06-08",
    productionRef: "PROD-3002",
    locationId: "loc-mys", issuedBy: "emp-020",
    lines: [
      { itemId: "sfg-flour", qty: 15000 },
      { itemId: "pm-bag50", qty: 305 },
    ],
    note: "Issued for PROD-3002 — 50kg flour packing run",
    status: "posted",
  },
  {
    id: "mis-002", ref: "MIS-0002", date: "2026-06-19",
    productionRef: "PROD-3010",
    locationId: "loc-mys", issuedBy: "emp-021",
    lines: [
      { itemId: "sfg-flour", qty: 5000 },
      { itemId: "pm-pouch1", qty: 5000 },
      { itemId: "pm-label", qty: 5000 },
    ],
    note: "Issue for atta pouch run",
    status: "draft",
  },
];

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
    .filter((l) => l.qty > 0 && itemById(l.itemId))
    .map((l, i) => ({
      id: `${grn.ref}-g${i}`,
      date: grn.date,
      itemId: l.itemId,
      locationId: grn.locationId,
      type: "receipt" as const,
      qty: l.qty,
      ref: grn.ref,
      note: `${grn.vendorName}${grn.poRef ? ` · ${grn.poRef}` : ""}`,
      byId: grn.receivedBy,
      batchNo: l.batchNo,
      expiry: l.expiry,
    }));
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
// Status metadata
// ---------------------------------------------------------------------------
export const PR_STATUS_META: Record<PRStatus, { label: string; variant: "default" | "primary" | "warning" | "success" | "danger" }> = {
  draft:    { label: "Draft",    variant: "default" },
  submitted:{ label: "Submitted",variant: "primary" },
  approved: { label: "Approved", variant: "success" },
  rejected: { label: "Rejected", variant: "danger"  },
  ordered:  { label: "Ordered",  variant: "warning" },
};

export const GRN_STATUS_META: Record<GRNStatus, { label: string; variant: "default" | "success" }> = {
  draft:  { label: "Draft",  variant: "default" },
  posted: { label: "Posted", variant: "success" },
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
