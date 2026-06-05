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

// Explicit roster — hand-authored so the reporting hierarchy is coherent and
// fully deterministic (no PRNG needed for people).
const SEED: Seed[] = [
  // ---- Leadership ----
  { id: "emp-001", code: "EMP-001", name: "Aarav Mehta", designation: "Chief Executive Officer", departmentId: "dep-ops", locationId: "loc-blr", managerId: null, joinDate: "2019-04-01", employmentType: "full-time" },
  { id: "emp-002", code: "EMP-002", name: "Diya Sharma", designation: "Chief Financial Officer", departmentId: "dep-fin", locationId: "loc-blr", managerId: "emp-001", joinDate: "2019-06-15", employmentType: "full-time" },
  { id: "emp-003", code: "EMP-003", name: "Kabir Nair", designation: "VP, Sales", departmentId: "dep-sal", locationId: "loc-mum", managerId: "emp-001", joinDate: "2020-01-20", employmentType: "full-time" },
  { id: "emp-004", code: "EMP-004", name: "Ananya Iyer", designation: "Head of People", departmentId: "dep-hr", locationId: "loc-blr", managerId: "emp-001", joinDate: "2020-03-02", employmentType: "full-time" },
  { id: "emp-005", code: "EMP-005", name: "Rohan Gupta", designation: "Engineering Lead", departmentId: "dep-eng", locationId: "loc-blr", managerId: "emp-001", joinDate: "2020-07-13", employmentType: "full-time" },

  // ---- Finance (→ Diya) ----
  { id: "emp-006", code: "EMP-006", name: "Sneha Rao", designation: "Senior Accountant", departmentId: "dep-fin", locationId: "loc-blr", managerId: "emp-002", joinDate: "2021-02-08", employmentType: "full-time" },
  { id: "emp-007", code: "EMP-007", name: "Vikram Singh", designation: "Accounts Payable", departmentId: "dep-fin", locationId: "loc-mum", managerId: "emp-002", joinDate: "2021-09-01", employmentType: "full-time" },
  { id: "emp-008", code: "EMP-008", name: "Meera Pillai", designation: "Financial Analyst", departmentId: "dep-fin", locationId: "loc-blr", managerId: "emp-002", joinDate: "2022-05-16", employmentType: "full-time", status: "on-leave" },
  { id: "emp-009", code: "EMP-009", name: "Arjun Desai", designation: "Tax & Compliance", departmentId: "dep-fin", locationId: "loc-del", managerId: "emp-002", joinDate: "2022-11-21", employmentType: "full-time" },

  // ---- Sales (→ Kabir) ----
  { id: "emp-010", code: "EMP-010", name: "Isha Kapoor", designation: "Account Executive", departmentId: "dep-sal", locationId: "loc-mum", managerId: "emp-003", joinDate: "2021-04-12", employmentType: "full-time" },
  { id: "emp-011", code: "EMP-011", name: "Rahul Verma", designation: "Sales Manager", departmentId: "dep-sal", locationId: "loc-del", managerId: "emp-003", joinDate: "2021-08-30", employmentType: "full-time" },
  { id: "emp-012", code: "EMP-012", name: "Priya Menon", designation: "Business Development", departmentId: "dep-sal", locationId: "loc-sg", managerId: "emp-003", joinDate: "2022-02-14", employmentType: "full-time" },
  { id: "emp-013", code: "EMP-013", name: "Aditya Joshi", designation: "Sales Associate", departmentId: "dep-sal", locationId: "loc-mys", managerId: "emp-003", joinDate: "2023-06-05", employmentType: "contract" },

  // ---- People & Culture (→ Ananya) ----
  { id: "emp-014", code: "EMP-014", name: "Nisha Reddy", designation: "HR Generalist", departmentId: "dep-hr", locationId: "loc-blr", managerId: "emp-004", joinDate: "2022-01-10", employmentType: "full-time" },
  { id: "emp-015", code: "EMP-015", name: "Karan Malhotra", designation: "Talent Acquisition", departmentId: "dep-hr", locationId: "loc-mum", managerId: "emp-004", joinDate: "2023-03-27", employmentType: "full-time", status: "exited", exitDate: "2026-05-15" },

  // ---- Engineering (→ Rohan) ----
  { id: "emp-016", code: "EMP-016", name: "Tara Krishnan", designation: "Frontend Engineer", departmentId: "dep-eng", locationId: "loc-blr", managerId: "emp-005", joinDate: "2021-11-15", employmentType: "full-time" },
  { id: "emp-017", code: "EMP-017", name: "Dev Patel", designation: "Backend Engineer", departmentId: "dep-eng", locationId: "loc-blr", managerId: "emp-005", joinDate: "2022-07-04", employmentType: "full-time" },
  { id: "emp-018", code: "EMP-018", name: "Riya Bose", designation: "Product Designer", departmentId: "dep-eng", locationId: "loc-sg", managerId: "emp-005", joinDate: "2023-01-09", employmentType: "full-time" },
  { id: "emp-019", code: "EMP-019", name: "Sahil Khan", designation: "DevOps Engineer", departmentId: "dep-eng", locationId: "loc-mys", managerId: "emp-005", joinDate: "2023-09-18", employmentType: "contract" },

  // ---- Operations (→ Aarav) ----
  { id: "emp-020", code: "EMP-020", name: "Pooja Shah", designation: "Operations Manager", departmentId: "dep-ops", locationId: "loc-mys", managerId: "emp-001", joinDate: "2020-10-05", employmentType: "full-time" },
  { id: "emp-021", code: "EMP-021", name: "Manish Tiwari", designation: "Warehouse Lead", departmentId: "dep-ops", locationId: "loc-mum", managerId: "emp-020", joinDate: "2021-12-01", employmentType: "full-time" },
  { id: "emp-022", code: "EMP-022", name: "Lakshmi Nair", designation: "Operations Associate", departmentId: "dep-ops", locationId: "loc-del", managerId: "emp-020", joinDate: "2023-04-22", employmentType: "part-time" },

  // ---- Procurement (→ Pooja) ----
  { id: "emp-023", code: "EMP-023", name: "Farhan Ali", designation: "Procurement Lead", departmentId: "dep-proc", locationId: "loc-mum", managerId: "emp-020", joinDate: "2021-07-19", employmentType: "full-time" },
  { id: "emp-024", code: "EMP-024", name: "Anjali Gupta", designation: "Buyer", departmentId: "dep-proc", locationId: "loc-blr", managerId: "emp-023", joinDate: "2023-08-14", employmentType: "full-time" },
];

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
