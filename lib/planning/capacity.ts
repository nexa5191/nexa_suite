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

export const CAPACITY_LOADS: CapacityLoad[] = [];

export const CAPACITY_PLANS: CapacityPlan[] = [];

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
