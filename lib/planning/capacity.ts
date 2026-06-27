import { LOCATIONS } from "@/lib/accounting/org";

export type ResourceType = "machine" | "labour";
export type ShiftPattern = "single" | "double" | "triple";

export interface WorkCentre {
  id: string;
  name: string;
  locationId: string;
  resourceType: ResourceType;
  shiftPattern: ShiftPattern;
  hoursPerShift: number;
  workingDaysPerWeek: number;
  capacityKgPerHour: number | null;
  headcount: number | null;
  standardEfficiency: number;
  costPerHour: number;
  isActive: boolean;
}

export interface CapacityLoad {
  workCentreId: string;
  week: string;
  plannedHours: number;
  actualHours: number;
  loadPct: number;
  plannedOutput: number;
  actualOutput: number;
}

export interface CapacityPlan {
  id: string;
  ref: string;
  week: string;
  workCentreId: string;
  productionOrderRef: string;
  itemName: string;
  plannedQty: number;
  plannedHours: number;
  status: "planned" | "in-progress" | "completed";
}

export const WORK_CENTRES: WorkCentre[] = [
  {
    id: "wc-mill-1",
    name: "Milling Line 1",
    locationId: "loc-mys",
    resourceType: "machine",
    shiftPattern: "double",
    hoursPerShift: 8,
    workingDaysPerWeek: 6,
    capacityKgPerHour: 500,
    headcount: null,
    standardEfficiency: 0.85,
    costPerHour: 1200,
    isActive: true,
  },
  {
    id: "wc-mill-2",
    name: "Milling Line 2",
    locationId: "loc-mys",
    resourceType: "machine",
    shiftPattern: "single",
    hoursPerShift: 8,
    workingDaysPerWeek: 6,
    capacityKgPerHour: 400,
    headcount: null,
    standardEfficiency: 0.82,
    costPerHour: 1100,
    isActive: true,
  },
  {
    id: "wc-blend-1",
    name: "Blending Unit A",
    locationId: "loc-mys",
    resourceType: "machine",
    shiftPattern: "double",
    hoursPerShift: 8,
    workingDaysPerWeek: 6,
    capacityKgPerHour: 300,
    headcount: null,
    standardEfficiency: 0.88,
    costPerHour: 950,
    isActive: true,
  },
  {
    id: "wc-blend-2",
    name: "Blending Unit B",
    locationId: "loc-mys",
    resourceType: "machine",
    shiftPattern: "double",
    hoursPerShift: 8,
    workingDaysPerWeek: 5,
    capacityKgPerHour: 280,
    headcount: null,
    standardEfficiency: 0.86,
    costPerHour: 920,
    isActive: true,
  },
  {
    id: "wc-pkg-a",
    name: "Packaging Line A",
    locationId: "loc-blr",
    resourceType: "machine",
    shiftPattern: "double",
    hoursPerShift: 8,
    workingDaysPerWeek: 6,
    capacityKgPerHour: 600,
    headcount: null,
    standardEfficiency: 0.9,
    costPerHour: 800,
    isActive: true,
  },
  {
    id: "wc-pkg-b",
    name: "Packaging Line B",
    locationId: "loc-blr",
    resourceType: "machine",
    shiftPattern: "single",
    hoursPerShift: 8,
    workingDaysPerWeek: 6,
    capacityKgPerHour: 550,
    headcount: null,
    standardEfficiency: 0.87,
    costPerHour: 780,
    isActive: true,
  },
  {
    id: "wc-qlab",
    name: "Quality Lab",
    locationId: "loc-blr",
    resourceType: "machine",
    shiftPattern: "single",
    hoursPerShift: 8,
    workingDaysPerWeek: 5,
    capacityKgPerHour: null,
    headcount: null,
    standardEfficiency: 1.0,
    costPerHour: 600,
    isActive: true,
  },
  {
    id: "wc-fill-1",
    name: "Filling Station 1",
    locationId: "loc-mys",
    resourceType: "machine",
    shiftPattern: "triple",
    hoursPerShift: 8,
    workingDaysPerWeek: 6,
    capacityKgPerHour: 200,
    headcount: null,
    standardEfficiency: 0.84,
    costPerHour: 700,
    isActive: true,
  },
  {
    id: "wc-lab-pack",
    name: "Labelling & Packing",
    locationId: "loc-blr",
    resourceType: "labour",
    shiftPattern: "single",
    hoursPerShift: 8,
    workingDaysPerWeek: 6,
    capacityKgPerHour: null,
    headcount: 12,
    standardEfficiency: 0.8,
    costPerHour: 250,
    isActive: true,
  },
  {
    id: "wc-lab-qc",
    name: "QC Inspection Team",
    locationId: "loc-blr",
    resourceType: "labour",
    shiftPattern: "single",
    hoursPerShift: 8,
    workingDaysPerWeek: 5,
    capacityKgPerHour: null,
    headcount: 6,
    standardEfficiency: 0.9,
    costPerHour: 350,
    isActive: false,
  },
];

export function availableHoursPerWeek(wc: WorkCentre): number {
  const shifts = wc.shiftPattern === "single" ? 1 : wc.shiftPattern === "double" ? 2 : 3;
  return shifts * wc.hoursPerShift * wc.workingDaysPerWeek * wc.standardEfficiency;
}

function isoWeekMonday(offset: number): string {
  const d = new Date();
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1 - day) + offset * 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

function seedLoad(wcId: string, week: string, availHrs: number, loadFactor: number): CapacityLoad {
  const plannedHours = Math.round(availHrs * loadFactor * 10) / 10;
  const actualHours = Math.round(plannedHours * (0.9 + Math.random() * 0.15) * 10) / 10;
  const wc = WORK_CENTRES.find((w) => w.id === wcId)!;
  const kgPerHr = wc.capacityKgPerHour ?? 0;
  return {
    workCentreId: wcId,
    week,
    plannedHours,
    actualHours,
    loadPct: Math.round((plannedHours / availHrs) * 100),
    plannedOutput: Math.round(plannedHours * kgPerHr),
    actualOutput: Math.round(actualHours * kgPerHr * 0.95),
  };
}

export const CAPACITY_LOADS: CapacityLoad[] = (() => {
  const loads: CapacityLoad[] = [];
  const loadFactors: Record<string, number[]> = {
    "wc-mill-1":    [0.78, 0.85, 1.05, 0.92, 0.88, 0.73],
    "wc-mill-2":    [0.65, 0.72, 0.80, 1.02, 0.76, 0.60],
    "wc-blend-1":   [0.88, 0.91, 0.98, 1.10, 0.85, 0.79],
    "wc-blend-2":   [0.70, 0.75, 0.82, 0.95, 0.88, 0.65],
    "wc-pkg-a":     [0.80, 0.88, 1.08, 1.15, 0.90, 0.75],
    "wc-pkg-b":     [0.60, 0.68, 0.85, 0.98, 0.72, 0.58],
    "wc-qlab":      [0.50, 0.55, 0.65, 0.70, 0.60, 0.50],
    "wc-fill-1":    [0.85, 0.92, 1.02, 1.18, 0.95, 0.80],
    "wc-lab-pack":  [0.75, 0.80, 0.90, 1.05, 0.85, 0.70],
    "wc-lab-qc":    [0.45, 0.50, 0.58, 0.65, 0.55, 0.45],
  };
  for (let w = -3; w <= 2; w++) {
    const week = isoWeekMonday(w);
    const idx = w + 3;
    for (const wc of WORK_CENTRES) {
      const avail = availableHoursPerWeek(wc);
      const factor = loadFactors[wc.id]?.[idx] ?? 0.7;
      loads.push(seedLoad(wc.id, week, avail, factor));
    }
  }
  return loads;
})();

export const CAPACITY_PLANS: CapacityPlan[] = [
  { id: "cp-1",  ref: "CP-2526-01", week: isoWeekMonday(0), workCentreId: "wc-mill-1",   productionOrderRef: "PO-2526-001", itemName: "Whole Wheat Flour 10kg",     plannedQty: 8000,  plannedHours: 18.8, status: "in-progress" },
  { id: "cp-2",  ref: "CP-2526-02", week: isoWeekMonday(0), workCentreId: "wc-blend-1",  productionOrderRef: "PO-2526-002", itemName: "Multi-Grain Mix 5kg",        plannedQty: 4500,  plannedHours: 17.0, status: "in-progress" },
  { id: "cp-3",  ref: "CP-2526-03", week: isoWeekMonday(0), workCentreId: "wc-pkg-a",    productionOrderRef: "PO-2526-003", itemName: "Rice Flour 1kg Pouch",       plannedQty: 12000, plannedHours: 20.0, status: "planned" },
  { id: "cp-4",  ref: "CP-2526-04", week: isoWeekMonday(0), workCentreId: "wc-fill-1",   productionOrderRef: "PO-2526-004", itemName: "Semolina Fine 500g",         plannedQty: 3200,  plannedHours: 22.0, status: "in-progress" },
  { id: "cp-5",  ref: "CP-2526-05", week: isoWeekMonday(0), workCentreId: "wc-mill-2",   productionOrderRef: "PO-2526-005", itemName: "Maida 25kg Bag",             plannedQty: 6000,  plannedHours: 15.0, status: "planned" },
  { id: "cp-6",  ref: "CP-2526-06", week: isoWeekMonday(1), workCentreId: "wc-mill-1",   productionOrderRef: "PO-2526-006", itemName: "Whole Wheat Flour 10kg",     plannedQty: 9000,  plannedHours: 21.2, status: "planned" },
  { id: "cp-7",  ref: "CP-2526-07", week: isoWeekMonday(1), workCentreId: "wc-blend-1",  productionOrderRef: "PO-2526-007", itemName: "Dosa Mix 500g",              plannedQty: 5000,  plannedHours: 18.9, status: "planned" },
  { id: "cp-8",  ref: "CP-2526-08", week: isoWeekMonday(1), workCentreId: "wc-pkg-a",    productionOrderRef: "PO-2526-008", itemName: "Idli Rice 5kg",              plannedQty: 14000, plannedHours: 25.5, status: "planned" },
  { id: "cp-9",  ref: "CP-2526-09", week: isoWeekMonday(1), workCentreId: "wc-fill-1",   productionOrderRef: "PO-2526-009", itemName: "Semolina Coarse 500g",       plannedQty: 3500,  plannedHours: 24.5, status: "planned" },
  { id: "cp-10", ref: "CP-2526-10", week: isoWeekMonday(-1), workCentreId: "wc-mill-1",  productionOrderRef: "PO-2526-010", itemName: "Jowar Flour 5kg",            plannedQty: 7000,  plannedHours: 19.6, status: "completed" },
  { id: "cp-11", ref: "CP-2526-11", week: isoWeekMonday(-1), workCentreId: "wc-blend-2", productionOrderRef: "PO-2526-011", itemName: "Protein Mix 1kg",            plannedQty: 2500,  plannedHours: 10.5, status: "completed" },
  { id: "cp-12", ref: "CP-2526-12", week: isoWeekMonday(-1), workCentreId: "wc-pkg-b",   productionOrderRef: "PO-2526-012", itemName: "Bajra Flour 1kg",            plannedQty: 4000,  plannedHours: 12.0, status: "completed" },
  { id: "cp-13", ref: "CP-2526-13", week: isoWeekMonday(-2), workCentreId: "wc-pkg-a",   productionOrderRef: "PO-2526-013", itemName: "Rice Flour Premium 2kg",     plannedQty: 10000, plannedHours: 24.0, status: "completed" },
  { id: "cp-14", ref: "CP-2526-14", week: isoWeekMonday(-2), workCentreId: "wc-blend-1", productionOrderRef: "PO-2526-014", itemName: "Masala Dosa Mix 200g",       plannedQty: 3000,  plannedHours: 13.6, status: "completed" },
  { id: "cp-15", ref: "CP-2526-15", week: isoWeekMonday(2),  workCentreId: "wc-mill-1",  productionOrderRef: "PO-2526-015", itemName: "Ragi Flour 500g",            plannedQty: 5500,  plannedHours: 16.0, status: "planned" },
];

const STORAGE_KEY_WC = "nexa-work-centres";
const STORAGE_KEY_LOADS = "nexa-capacity-loads";
const STORAGE_KEY_PLANS = "nexa-capacity-plans";

export function loadWorkCentres(): WorkCentre[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_WC);
    return raw ? (JSON.parse(raw) as WorkCentre[]) : WORK_CENTRES;
  } catch {
    return WORK_CENTRES;
  }
}

export function saveWorkCentres(wcs: WorkCentre[]): void {
  localStorage.setItem(STORAGE_KEY_WC, JSON.stringify(wcs));
}

export function loadCapacityLoads(): CapacityLoad[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_LOADS);
    return raw ? (JSON.parse(raw) as CapacityLoad[]) : CAPACITY_LOADS;
  } catch {
    return CAPACITY_LOADS;
  }
}

export function loadCapacityPlans(): CapacityPlan[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PLANS);
    return raw ? (JSON.parse(raw) as CapacityPlan[]) : CAPACITY_PLANS;
  } catch {
    return CAPACITY_PLANS;
  }
}

export function formatWeekLabel(isoDate: string): string {
  const d = new Date(isoDate + "T00:00:00");
  const end = new Date(d);
  end.setDate(d.getDate() + 6);
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  return `${d.getDate()} ${months[d.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]}`;
}

export function addWeek(isoDate: string, delta: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + delta * 7);
  return d.toISOString().slice(0, 10);
}

export function currentWeekMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}
