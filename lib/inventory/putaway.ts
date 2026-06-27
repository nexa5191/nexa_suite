export type TaskType = "putaway" | "pick";
export type TaskStatus = "pending" | "in-progress" | "completed" | "cancelled";
export type PickStrategy = "FIFO" | "zone" | "wave";

export interface TaskLine {
  itemId: string;
  qty: number;
  uom: string;
  fromBin: string | null;
  toBin: string | null;
  picked: number;
}

export interface WarehouseTask {
  id: string;
  ref: string;
  type: TaskType;
  status: TaskStatus;
  strategy: PickStrategy | null;
  assignedTo: string;
  locationId: string;
  sourceRef: string;
  lines: TaskLine[];
  createdAt: string;
  completedAt: string | null;
}

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; variant: "default" | "primary" | "success" | "warning" | "danger" }
> = {
  pending:     { label: "Pending",     variant: "default"  },
  "in-progress": { label: "In Progress", variant: "warning"  },
  completed:   { label: "Completed",   variant: "success"  },
  cancelled:   { label: "Cancelled",   variant: "danger"   },
};

export const STRATEGY_META: Record<
  PickStrategy,
  { label: string; variant: "default" | "primary" | "success" | "warning" | "danger" }
> = {
  FIFO: { label: "FIFO",  variant: "primary" },
  zone: { label: "Zone",  variant: "warning" },
  wave: { label: "Wave",  variant: "success" },
};

export const SEED_TASKS: WarehouseTask[] = [];

const TASKS_KEY = "nexa-wh-tasks";

export function loadTasks(): WarehouseTask[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TASKS_KEY);
    if (raw) return JSON.parse(raw) as WarehouseTask[];
  } catch { /* ignore */ }
  return [];
}

export function saveTasks(tasks: WarehouseTask[]) {
  try { localStorage.setItem(TASKS_KEY, JSON.stringify(tasks)); } catch { /* ignore */ }
}

export function allTasks(saved: WarehouseTask[]): WarehouseTask[] {
  if (saved.length === 0) return [...SEED_TASKS];
  const savedIds = new Set(saved.map((t) => t.id));
  return [
    ...SEED_TASKS.map((t) => saved.find((s) => s.id === t.id) ?? t),
    ...saved.filter((t) => !SEED_TASKS.some((s) => s.id === t.id)),
  ];
}

export function nextTaskRef(type: TaskType, tasks: WarehouseTask[]): string {
  const prefix = type === "putaway" ? "PUT" : "PICK";
  const max = tasks
    .filter((t) => t.ref.startsWith(prefix + "-"))
    .reduce((n, t) => {
      const num = parseInt(t.ref.slice(prefix.length + 1), 10);
      return isNaN(num) ? n : Math.max(n, num);
    }, 0);
  return `${prefix}-${String(max + 1).padStart(3, "0")}`;
}
