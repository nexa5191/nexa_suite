// ---------------------------------------------------------------------------
// NEXA task management — lightweight internal task tracker (kanban).
// User-created tasks + status overrides are persisted to localStorage.
// ---------------------------------------------------------------------------

export type TaskStatus = "todo" | "in-progress" | "blocked" | "done";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type Recurrence = "none" | "daily" | "weekly" | "monthly" | "yearly";

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
  recurrence?: Recurrence;
  advanceDays?: number;      // spawn next occurrence this many days before it's due
  recurringGroupId?: string; // all instances in a series share this
}

export const TASK_STATUSES: { key: TaskStatus; label: string }[] = [
  { key: "todo", label: "To Do" },
  { key: "in-progress", label: "In Progress" },
  { key: "blocked", label: "Blocked" },
  { key: "done", label: "Done" },
];

export const PROJECTS: string[] = [
  "Audit", "GST Filings", "Payroll", "Banking", "Operations", "HR", "IT", "Finance", "Compliance",
];

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

// ---- status persistence ----
export const TASK_STATUS_KEY = "nexa-task-status";

export function loadTaskStatuses(): Record<string, TaskStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(TASK_STATUS_KEY);
    if (raw) return JSON.parse(raw) as Record<string, TaskStatus>;
  } catch { /* ignore */ }
  return {};
}
export function saveTaskStatuses(s: Record<string, TaskStatus>) {
  try { localStorage.setItem(TASK_STATUS_KEY, JSON.stringify(s)); } catch { /* ignore */ }
}

// ---- user task persistence ----
const USER_TASKS_KEY = "nexa-user-tasks";

export function loadUserTasks(): FirmTask[] {
  if (typeof window === "undefined") return [];
  try {
    const r = localStorage.getItem(USER_TASKS_KEY);
    return r ? (JSON.parse(r) as FirmTask[]) : [];
  } catch { return []; }
}
export function saveUserTasks(tasks: FirmTask[]): void {
  try { localStorage.setItem(USER_TASKS_KEY, JSON.stringify(tasks)); } catch { /* ignore */ }
}

// ---- recurrence helpers ----
function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function nextOccurrenceDue(date: string, recurrence: Recurrence): string {
  const d = new Date(date + "T00:00:00");
  switch (recurrence) {
    case "daily":   d.setDate(d.getDate() + 1); break;
    case "weekly":  d.setDate(d.getDate() + 7); break;
    case "monthly": d.setMonth(d.getMonth() + 1); break;
    case "yearly":  d.setFullYear(d.getFullYear() + 1); break;
    default: return date;
  }
  return d.toISOString().slice(0, 10);
}

/**
 * Check all recurring user tasks and return any new instances that should be
 * spawned. Pass force=true (e.g. on close) to bypass the advanceDays date
 * check and spawn the next occurrence immediately.
 */
export function spawnDueRecurrences(
  userTasks: FirmTask[],
  today: string,
  force = false,
): FirmTask[] {
  const recurring = userTasks.filter(
    (t) => t.recurrence && t.recurrence !== "none" && t.recurringGroupId,
  );
  if (!recurring.length) return [];

  const groups = new Map<string, FirmTask[]>();
  for (const t of recurring) {
    const arr = groups.get(t.recurringGroupId!) ?? [];
    arr.push(t);
    groups.set(t.recurringGroupId!, arr);
  }

  const spawned: FirmTask[] = [];
  for (const [, instances] of groups) {
    // Latest instance in the series drives the next due date
    const latest = instances.reduce((a, b) => (a.dueDate >= b.dueDate ? a : b));
    const nextDue = nextOccurrenceDue(latest.dueDate, latest.recurrence!);

    // Don't double-spawn
    if (instances.some((t) => t.dueDate === nextDue)) continue;

    const advanceDays = latest.advanceDays ?? 0;
    const appearDate = addDays(nextDue, -advanceDays);

    if (force || today >= appearDate) {
      spawned.push({
        ...latest,
        id: `task-recur-${latest.recurringGroupId}-${nextDue}`,
        dueDate: nextDue,
        status: "todo",
        createdOn: today,
      });
    }
  }
  return spawned;
}
