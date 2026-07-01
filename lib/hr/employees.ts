import type { Department, Employee } from "./types";
import { entityById, locationById } from "@/lib/accounting/org";

// Departments span the whole group (not per-entity).
export const DEPARTMENTS: Department[] = [
  { id: "dep-ops", name: "Operations" },
  { id: "dep-fin", name: "Finance" },
  { id: "dep-sal", name: "Sales" },
  { id: "dep-hr", name: "People & Culture" },
  { id: "dep-eng", name: "Engineering" },
  { id: "dep-proc", name: "Procurement" },
];

const DEPARTMENTS_KEY = "nexa-departments";
export function loadDepartments(): Department[] {
  if (typeof window === "undefined") return DEPARTMENTS;
  try {
    const r = localStorage.getItem(DEPARTMENTS_KEY);
    const p = r ? JSON.parse(r) as Department[] : null;
    if (Array.isArray(p) && p.length) return p;
  } catch { /* ignore */ }
  return DEPARTMENTS;
}

function readLS<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fb; } catch { return fb; }
}

export const EMPLOYEES: Employee[] = readLS<Employee[]>("nexa-employees", []);

export const ACTIVE_EMPLOYEES = EMPLOYEES.filter((e) => e.status !== "exited");

// ---- lookups ----
export function employeeById(id: string | null) {
  return id ? EMPLOYEES.find((e) => e.id === id) : undefined;
}
export function employeeName(id: string | null) {
  return employeeById(id)?.name ?? "—";
}
export function departmentById(id: string) {
  return DEPARTMENTS.find((d) => d.id === id);
}
export function departmentName(id: string) {
  return departmentById(id)?.name ?? "—";
}
export function employeeEntityName(e: Employee) {
  return entityById(e.entityId)?.name ?? "—";
}
export function employeeLocationName(e: Employee) {
  return locationById(e.locationId)?.name ?? "—";
}
