import type { Approval } from "./types";
import { DEFAULT_LEAVE_TYPES, pendingLeaveRequests, leaveTypeById } from "./leave";
import { employeeById, employeeName } from "./employees";
import { invoicesAwaitingApproval, invoiceApprovalId, vendorName } from "@/lib/vendors";
import { formatDate } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Unified approval engine. Every module that needs sign-off (leave, finance,
// documents) projects its pending items into a single Approval shape, so the
// dashboard widget and /approvals page render one consistent queue.
// ---------------------------------------------------------------------------

// ---- 1. Leave requests awaiting a manager ----
function leaveApprovals(): Approval[] {
  return pendingLeaveRequests().map((r) => {
    const emp = employeeById(r.employeeId);
    const type = leaveTypeById(DEFAULT_LEAVE_TYPES, r.leaveTypeId);
    const span =
      r.from === r.to
        ? `${formatDate(r.from)}${r.unit === "half" ? " (half day)" : ""}`
        : `${formatDate(r.from)} → ${formatDate(r.to)}`;
    return {
      id: `apr-leave-${r.id}`,
      kind: "leave" as const,
      title: `${type?.name ?? "Leave"} — ${r.days} day${r.days === 1 ? "" : "s"}`,
      detail: `${span} · ${r.reason}`,
      requestedById: r.employeeId,
      requestedByName: employeeName(r.employeeId),
      requestedOn: r.appliedOn,
      entityId: emp?.entityId ?? "",
      locationId: emp?.locationId ?? "",
      approverId: r.approverId,
      status: "pending" as const,
      href: "/leave",
    };
  });
}

// ---- 2. Vendor invoices awaiting the SPOC who raised the PO ----
// Each invoice is routed to its PO's SPOC; approving auto-flows it to payment.
// The id matches lib/vendors invoiceApprovalId() so /vendors and /approvals
// share one decision.
function financialApprovals(): Approval[] {
  return invoicesAwaitingApproval().map((po) => ({
    id: invoiceApprovalId(po.id),
    kind: "financial" as const,
    title: `Invoice ${po.invoice!.number} — ${vendorName(po.vendorId)}`,
    detail: `${po.id} · ${po.title} — needs SPOC approval, then auto-pays`,
    requestedById: null,
    requestedByName: vendorName(po.vendorId),
    requestedOn: po.invoice!.date,
    amount: po.invoice!.amount,
    entityId: po.entityId,
    locationId: po.locationId,
    approverId: po.spocId, // the SPOC who raised the PO
    status: "pending" as const,
    href: "/vendors",
  }));
}

// ---- 3. Documents flagged for review ----
interface DocApproval {
  id: string;
  name: string;
  by: string;
  approver: string;
  on: string;
  note: string;
  entityId: string;
  locationId: string;
}
const PENDING_DOCS: DocApproval[] = [
  { id: "doc-1", name: "FY25-26 Statutory Audit Report.pdf", by: "emp-006", approver: "emp-002", on: "2026-06-02", note: "Final draft from auditors — needs CFO sign-off", entityId: "ent-nexa-in", locationId: "loc-blr" },
  { id: "doc-2", name: "Vendor Contract — Sterling Foods.pdf", by: "emp-023", approver: "emp-020", on: "2026-06-03", note: "3-year supply agreement renewal", entityId: "ent-nexa-trade", locationId: "loc-mum" },
  { id: "doc-3", name: "Q1 GST Filing Workings.xlsx", by: "emp-009", approver: "emp-002", on: "2026-06-04", note: "GSTR-3B reconciliation before filing", entityId: "ent-nexa-trade", locationId: "loc-del" },
];

function documentApprovals(): Approval[] {
  return PENDING_DOCS.map((d) => ({
    id: `apr-doc-${d.id}`,
    kind: "document" as const,
    title: d.name,
    detail: d.note,
    requestedById: d.by,
    requestedByName: employeeName(d.by),
    requestedOn: d.on,
    entityId: d.entityId,
    locationId: d.locationId,
    approverId: d.approver,
    status: "pending" as const,
    href: "/documents",
  }));
}

/** Every pending approval across all modules, newest first. */
export function allApprovals(): Approval[] {
  return [...leaveApprovals(), ...financialApprovals(), ...documentApprovals()].sort((a, b) =>
    a.requestedOn < b.requestedOn ? 1 : a.requestedOn > b.requestedOn ? -1 : 0,
  );
}

// ---- decision persistence (local, demo only) ------------------------------

export type Decision = "approved" | "rejected";
export const APPROVALS_KEY = "nexa-approval-decisions";

export function loadDecisions(): Record<string, Decision> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(APPROVALS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, Decision>;
  } catch {
    /* ignore */
  }
  return {};
}

export function saveDecisions(d: Record<string, Decision>) {
  try {
    localStorage.setItem(APPROVALS_KEY, JSON.stringify(d));
  } catch {
    /* ignore */
  }
}
