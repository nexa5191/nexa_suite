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

// loc → entity is fixed by the org tree; keep employees consistent with it.
const ENTITY_OF: Record<string, string> = {
  "loc-blr": "ent-nexa-in",
  "loc-mys": "ent-nexa-in",
  "loc-mum": "ent-nexa-trade",
  "loc-del": "ent-nexa-trade",
  "loc-sg": "ent-nexa-global",
};

type Seed = Omit<Employee, "entityId" | "email" | "status" | "personalEmail"> & {
  status?: Employee["status"];
  exitDate?: string;
};

function email(name: string) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@nexa.example`;
}

function personalEmail(name: string) {
  return `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@gmail.com`;
}

const SEED: Seed[] = [];

export const EMPLOYEES: Employee[] = SEED.map((s) => ({
  ...s,
  entityId: ENTITY_OF[s.locationId],
  email: email(s.name),
  personalEmail: personalEmail(s.name),
  status: s.status ?? "active",
}));

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
