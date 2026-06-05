// ---------------------------------------------------------------------------
// NEXA task management — lightweight internal task tracker (kanban).
// Status changes are persisted to localStorage; everything else is seed data.
// ---------------------------------------------------------------------------

export type TaskStatus = "todo" | "in-progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

export interface FirmTask {
  id: string;
  title: string;
  description: string;
  assigneeId: string;
  createdById: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string; // ISO
  project: string;
  createdOn: string; // ISO
}

export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in-progress", label: "In Progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

export const PROJECTS = [
  "Q2 Close",
  "ERP Rollout",
  "Audit FY25-26",
  "Warehouse Move",
  "Hiring Drive",
  "Brand Refresh",
];

interface RawTask {
  title: string; desc: string; assignee: string; by: string;
  status: TaskStatus; priority: TaskPriority; due: string; project: string; created: string;
}

const RAW: RawTask[] = [
  { title: "Finalise May bank reconciliation", desc: "Match HDFC & ICICI statements to the ledger and clear suspense items.", assignee: "emp-006", by: "emp-002", status: "in-progress", priority: "high", due: "2026-06-08", project: "Q2 Close", created: "2026-06-01" },
  { title: "File GSTR-3B for Maharashtra", desc: "Reconcile ITC and file before the due date.", assignee: "emp-009", by: "emp-002", status: "todo", priority: "urgent", due: "2026-06-11", project: "Q2 Close", created: "2026-06-03" },
  { title: "Vendor ledger confirmations", desc: "Send balance confirmation requests to top 10 vendors.", assignee: "emp-007", by: "emp-006", status: "todo", priority: "medium", due: "2026-06-15", project: "Audit FY25-26", created: "2026-06-02" },
  { title: "Migrate COA to new ERP", desc: "Map legacy account codes to the ERP chart of accounts.", assignee: "emp-017", by: "emp-005", status: "in-progress", priority: "high", due: "2026-06-20", project: "ERP Rollout", created: "2026-05-25" },
  { title: "ERP UAT — purchase module", desc: "Run user acceptance tests for the procurement flow.", assignee: "emp-016", by: "emp-005", status: "blocked", priority: "high", due: "2026-06-18", project: "ERP Rollout", created: "2026-05-28" },
  { title: "Set up SSO for ERP", desc: "Configure Google Workspace SSO with the new ERP vendor.", assignee: "emp-019", by: "emp-005", status: "todo", priority: "medium", due: "2026-06-22", project: "ERP Rollout", created: "2026-06-01" },
  { title: "Shortlist Sales Manager candidates", desc: "Review CV bank and schedule first-round interviews.", assignee: "emp-014", by: "emp-004", status: "in-progress", priority: "medium", due: "2026-06-12", project: "Hiring Drive", created: "2026-05-30" },
  { title: "Draft offer for Aishwarya Menon", desc: "Prepare offer letter for the West sales manager role.", assignee: "emp-004", by: "emp-003", status: "todo", priority: "high", due: "2026-06-09", project: "Hiring Drive", created: "2026-06-04" },
  { title: "Plan Mysuru warehouse relocation", desc: "Vendor quotes for the move and downtime window.", assignee: "emp-020", by: "emp-001", status: "in-progress", priority: "medium", due: "2026-06-28", project: "Warehouse Move", created: "2026-05-20" },
  { title: "Inventory count before move", desc: "Full physical stock count and variance report.", assignee: "emp-021", by: "emp-020", status: "todo", priority: "high", due: "2026-06-25", project: "Warehouse Move", created: "2026-06-02" },
  { title: "New brand guidelines sign-off", desc: "Review the agency's brand book and approve.", assignee: "emp-003", by: "emp-001", status: "blocked", priority: "low", due: "2026-06-30", project: "Brand Refresh", created: "2026-05-22" },
  { title: "Depreciation schedule update", desc: "Add Q1 capex to the fixed-asset register.", assignee: "emp-008", by: "emp-002", status: "done", priority: "medium", due: "2026-05-30", project: "Q2 Close", created: "2026-05-15" },
  { title: "Audit PBC list", desc: "Prepare the 'provided by client' documents for auditors.", assignee: "emp-006", by: "emp-002", status: "done", priority: "high", due: "2026-05-28", project: "Audit FY25-26", created: "2026-05-10" },
  { title: "Procurement policy refresh", desc: "Update approval thresholds and SPOC matrix.", assignee: "emp-023", by: "emp-020", status: "todo", priority: "low", due: "2026-07-01", project: "Warehouse Move", created: "2026-06-03" },
];

export const FIRM_TASKS: FirmTask[] = RAW.map((t, i) => ({
  id: `task-${String(i + 1).padStart(3, "0")}`,
  title: t.title,
  description: t.desc,
  assigneeId: t.assignee,
  createdById: t.by,
  status: t.status,
  priority: t.priority,
  dueDate: t.due,
  project: t.project,
  createdOn: t.created,
}));

// ---- status persistence (local) ----
export const TASK_STATUS_KEY = "nexa-task-status";

export function loadTaskStatuses(): Record<string, TaskStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TASK_STATUS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, TaskStatus>;
  } catch {
    /* ignore */
  }
  return {};
}
export function saveTaskStatuses(s: Record<string, TaskStatus>) {
  try {
    localStorage.setItem(TASK_STATUS_KEY, JSON.stringify(s));
  } catch {
    /* ignore */
  }
}
