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

export const SEED_TASKS: WarehouseTask[] = [
  // ── Put-away tasks ────────────────────────────────────────────────────────
  {
    id: "task-put-001",
    ref: "PUT-001",
    type: "putaway",
    status: "pending",
    strategy: null,
    assignedTo: "Pooja Shah",
    locationId: "loc-mys",
    sourceRef: "GRN-2601",
    createdAt: "2026-06-03",
    completedAt: null,
    lines: [
      { itemId: "rm-wheat",  qty: 5000, uom: "kg",  fromBin: null, toBin: "A-02-01", picked: 0 },
      { itemId: "pm-carton", qty:  500, uom: "pcs", fromBin: null, toBin: "A-02-02", picked: 0 },
    ],
  },
  {
    id: "task-put-002",
    ref: "PUT-002",
    type: "putaway",
    status: "in-progress",
    strategy: null,
    assignedTo: "Manish Tiwari",
    locationId: "loc-mum",
    sourceRef: "GRN-2602",
    createdAt: "2026-06-08",
    completedAt: null,
    lines: [
      { itemId: "fg-rice25", qty: 80,  uom: "pcs", fromBin: null, toBin: "S-01-01", picked: 40 },
      { itemId: "fg-oil15",  qty: 60,  uom: "pcs", fromBin: null, toBin: "S-01-02", picked: 0  },
    ],
  },
  {
    id: "task-put-003",
    ref: "PUT-003",
    type: "putaway",
    status: "completed",
    strategy: null,
    assignedTo: "Pooja Shah",
    locationId: "loc-mys",
    sourceRef: "GRN-2603",
    createdAt: "2026-05-20",
    completedAt: "2026-05-20",
    lines: [
      { itemId: "sfg-flour", qty: 5000, uom: "kg", fromBin: null, toBin: "A-01-01", picked: 5000 },
    ],
  },
  {
    id: "task-put-004",
    ref: "PUT-004",
    type: "putaway",
    status: "pending",
    strategy: null,
    assignedTo: "Manish Tiwari",
    locationId: "loc-mum",
    sourceRef: "GRN-2604",
    createdAt: "2026-06-10",
    completedAt: null,
    lines: [
      { itemId: "fg-atta1",  qty: 500, uom: "pcs", fromBin: null, toBin: "P-01", picked: 0 },
    ],
  },
  {
    id: "task-put-005",
    ref: "PUT-005",
    type: "putaway",
    status: "pending",
    strategy: null,
    assignedTo: "Pooja Shah",
    locationId: "loc-mys",
    sourceRef: "GRN-2605",
    createdAt: "2026-06-15",
    completedAt: null,
    lines: [
      { itemId: "sfg-semolina", qty: 2000, uom: "kg", fromBin: null, toBin: "B-01-02", picked: 0 },
      { itemId: "rm-durum",     qty: 1000, uom: "kg", fromBin: null, toBin: "A-02-02", picked: 0 },
    ],
  },

  // ── Pick tasks ─────────────────────────────────────────────────────────────
  {
    id: "task-pick-001",
    ref: "PICK-001",
    type: "pick",
    status: "pending",
    strategy: "FIFO",
    assignedTo: "Pooja Shah",
    locationId: "loc-mys",
    sourceRef: "SO-4501",
    createdAt: "2026-06-20",
    completedAt: null,
    lines: [
      { itemId: "fg-flour50", qty: 30, uom: "pcs", fromBin: "P-01-01", toBin: null, picked: 0 },
      { itemId: "fg-atta10",  qty: 50, uom: "pcs", fromBin: "P-01-02", toBin: null, picked: 0 },
    ],
  },
  {
    id: "task-pick-002",
    ref: "PICK-002",
    type: "pick",
    status: "in-progress",
    strategy: "zone",
    assignedTo: "Manish Tiwari",
    locationId: "loc-mys",
    sourceRef: "SO-4502",
    createdAt: "2026-06-21",
    completedAt: null,
    lines: [
      { itemId: "fg-atta1",  qty: 200, uom: "pcs", fromBin: "P-02-01", toBin: "DSP-01", picked: 100 },
      { itemId: "fg-atta10", qty:  30, uom: "pcs", fromBin: "P-01-02", toBin: "DSP-01", picked:  15 },
    ],
  },
  {
    id: "task-pick-003",
    ref: "PICK-003",
    type: "pick",
    status: "completed",
    strategy: "wave",
    assignedTo: "Pooja Shah",
    locationId: "loc-blr",
    sourceRef: "SO-4503",
    createdAt: "2026-06-11",
    completedAt: "2026-06-11",
    lines: [
      { itemId: "fg-atta1",   qty: 100, uom: "pcs", fromBin: "P-01",    toBin: "DSP-01", picked: 100 },
      { itemId: "fg-flour50", qty:  20, uom: "pcs", fromBin: "S-01-01", toBin: "DSP-01", picked:  20 },
    ],
  },
  {
    id: "task-pick-004",
    ref: "PICK-004",
    type: "pick",
    status: "pending",
    strategy: "FIFO",
    assignedTo: "Manish Tiwari",
    locationId: "loc-mum",
    sourceRef: "SO-4504",
    createdAt: "2026-06-22",
    completedAt: null,
    lines: [
      { itemId: "fg-flour50", qty: 40, uom: "pcs", fromBin: "S-01-01", toBin: null, picked: 0 },
      { itemId: "fg-rice25",  qty: 20, uom: "pcs", fromBin: "P-02",    toBin: null, picked: 0 },
    ],
  },
  {
    id: "task-pick-005",
    ref: "PICK-005",
    type: "pick",
    status: "in-progress",
    strategy: "zone",
    assignedTo: "Pooja Shah",
    locationId: "loc-mys",
    sourceRef: "SO-4505",
    createdAt: "2026-06-22",
    completedAt: null,
    lines: [
      { itemId: "fg-flour50", qty: 20, uom: "pcs", fromBin: "DSP-01", toBin: null, picked: 10 },
      { itemId: "fg-rice25",  qty: 10, uom: "pcs", fromBin: "DSP-02", toBin: null, picked:  5 },
    ],
  },
  {
    id: "task-pick-006",
    ref: "PICK-006",
    type: "pick",
    status: "cancelled",
    strategy: "FIFO",
    assignedTo: "Manish Tiwari",
    locationId: "loc-mum",
    sourceRef: "SO-4506",
    createdAt: "2026-06-18",
    completedAt: null,
    lines: [
      { itemId: "fg-oil15", qty: 30, uom: "pcs", fromBin: "S-01-02", toBin: null, picked: 0 },
    ],
  },
  {
    id: "task-pick-007",
    ref: "PICK-007",
    type: "pick",
    status: "pending",
    strategy: "wave",
    assignedTo: "Pooja Shah",
    locationId: "loc-mys",
    sourceRef: "SO-4507",
    createdAt: "2026-06-25",
    completedAt: null,
    lines: [
      { itemId: "fg-flour50", qty:  50, uom: "pcs", fromBin: "P-01-01", toBin: null, picked: 0 },
      { itemId: "fg-atta10",  qty: 100, uom: "pcs", fromBin: "P-01-02", toBin: null, picked: 0 },
      { itemId: "fg-atta1",   qty: 500, uom: "pcs", fromBin: "P-02-01", toBin: null, picked: 0 },
    ],
  },
];

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
