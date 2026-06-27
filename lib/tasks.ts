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

export const PROJECTS: string[] = [];

interface RawTask {
  title: string; desc: string; assignee: string; by: string;
  status: TaskStatus; priority: TaskPriority; due: string; project: string; created: string;
}

const RAW: RawTask[] = [];

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
