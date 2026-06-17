// ---------------------------------------------------------------------------
// Professional Services — Engagements (matters) & rate cards.
//
// An Engagement is the services-sector twin of a product "matter": work sold to
// a CRM account, billed from a NEXA entity, led by a partner. A rate card
// (ProjectAssignment) places an employee on the engagement with a bill rate
// (what the client pays) and a pay/cost rate (what they cost us) — the spread is
// margin, which Touchstone v1 doesn't model.
//
// `conflictStatus` is the billing gate: time can only be billed once the
// engagement's conflict check is cleared or waived (see ./conflicts).
//
// Persistence (client-side): nexa-projects, nexa-project-assignments.
// ---------------------------------------------------------------------------

import { ACCOUNTS } from "@/lib/crm";
import { read, write } from "./store";

export type ProjectStatus = "active" | "completed" | "on-hold";

/** Mirror of the engagement's conflict clearance — drives the billing gate. */
export type ConflictStatus = "open" | "cleared" | "blocked" | "waived";

export const PROJECT_STATUSES: { key: ProjectStatus; label: string; variant: "default" | "primary" | "success" }[] = [
  { key: "active", label: "Active", variant: "primary" },
  { key: "on-hold", label: "On hold", variant: "default" },
  { key: "completed", label: "Completed", variant: "success" },
];

export const CONFLICT_STATUS_META: Record<ConflictStatus, { label: string; variant: "default" | "primary" | "warning" | "success" | "danger" }> = {
  open: { label: "Conflict check open", variant: "warning" },
  cleared: { label: "Cleared", variant: "success" },
  blocked: { label: "Conflict raised", variant: "danger" },
  waived: { label: "Waived", variant: "primary" },
};

export interface Project {
  id: string;
  code: string; // human id e.g. ENG-001
  name: string; // engagement / matter title
  accountId: string; // FK → CrmAccount (the client / bill-to)
  entityId: string; // billing entity
  partnerId: string; // responsible lead (employee)
  status: ProjectStatus;
  billRate: number; // default bill rate, base INR / hour
  startDate: string; // ISO
  endDate?: string;
  conflictStatus: ConflictStatus;
  opposingParties: string[]; // screened by the conflict check
}

export interface ProjectAssignment {
  id: string;
  projectId: string;
  employeeId: string;
  billRate: number; // overrides project.billRate for this person
  payRate: number; // cost basis → margin = billRate − payRate
  from: string; // ISO
  to?: string;
}

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
export const SEED_PROJECTS: Project[] = [
  {
    id: "proj-001", code: "ENG-001", name: "Quick-commerce supply-chain advisory",
    accountId: "acc-003", entityId: "ent-nexa-in", partnerId: "emp-003",
    status: "active", billRate: 4500, startDate: "2026-04-06",
    conflictStatus: "cleared", opposingParties: ["BlinkBasket Retail"],
  },
  {
    id: "proj-002", code: "ENG-002", name: "Singapore market-entry advisory",
    accountId: "acc-006", entityId: "ent-nexa-global", partnerId: "emp-012",
    status: "active", billRate: 6000, startDate: "2026-03-16",
    conflictStatus: "open", opposingParties: ["Marina Bay Foods Pte Ltd"],
  },
  {
    id: "proj-003", code: "ENG-003", name: "Private-label launch programme",
    accountId: "acc-004", entityId: "ent-nexa-trade", partnerId: "emp-011",
    status: "active", billRate: 3800, startDate: "2026-05-04",
    conflictStatus: "cleared", opposingParties: [],
  },
  {
    id: "proj-004", code: "ENG-004", name: "Retail expansion diligence",
    accountId: "acc-001", entityId: "ent-nexa-in", partnerId: "emp-003",
    status: "on-hold", billRate: 5200, startDate: "2026-05-20",
    // Opposing party collides with an existing client (acc-002 Spencer's) →
    // the conflict screen flags it and the engagement starts blocked.
    conflictStatus: "blocked", opposingParties: ["Spencer's Gourmet"],
  },
];

interface RawAssign { proj: string; emp: string; bill: number; pay: number; from: string }
const RAW_ASSIGNMENTS: RawAssign[] = [
  { proj: "proj-001", emp: "emp-016", bill: 4500, pay: 2100, from: "2026-04-06" },
  { proj: "proj-001", emp: "emp-008", bill: 5200, pay: 2600, from: "2026-04-06" },
  { proj: "proj-002", emp: "emp-018", bill: 6000, pay: 2800, from: "2026-03-16" },
  { proj: "proj-002", emp: "emp-012", bill: 7500, pay: 3400, from: "2026-03-16" },
  { proj: "proj-003", emp: "emp-017", bill: 3800, pay: 1900, from: "2026-05-04" },
  { proj: "proj-003", emp: "emp-024", bill: 3200, pay: 1500, from: "2026-05-04" },
];

export const SEED_ASSIGNMENTS: ProjectAssignment[] = RAW_ASSIGNMENTS.map((a, i) => ({
  id: `asg-${String(i + 1).padStart(3, "0")}`,
  projectId: a.proj,
  employeeId: a.emp,
  billRate: a.bill,
  payRate: a.pay,
  from: a.from,
}));

// ---------------------------------------------------------------------------
// Lookups & derived
// ---------------------------------------------------------------------------
export function projectById(projects: Project[], id: string | null) {
  return id ? projects.find((p) => p.id === id) : undefined;
}

export function assignmentsForProject(assignments: ProjectAssignment[], projectId: string) {
  return assignments.filter((a) => a.projectId === projectId);
}

/** Bill rate for a person on an engagement: their rate-card override, else the engagement default. */
export function effectiveBillRate(
  project: Project | undefined,
  assignments: ProjectAssignment[],
  employeeId: string,
): number {
  if (!project) return 0;
  const a = assignments.find((x) => x.projectId === project.id && x.employeeId === employeeId);
  return a?.billRate ?? project.billRate;
}

/** Can this engagement accrue billable time / be invoiced yet? */
export function canBill(project: Project | undefined): boolean {
  return project?.conflictStatus === "cleared" || project?.conflictStatus === "waived";
}

export function accountName(id: string) {
  return ACCOUNTS.find((a) => a.id === id)?.name ?? "—";
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
export const PROJECTS_KEY = "nexa-projects";
export const ASSIGNMENTS_KEY = "nexa-project-assignments";

export const loadProjects = () => read<Project[]>(PROJECTS_KEY, SEED_PROJECTS);
export const saveProjects = (p: Project[]) => write(PROJECTS_KEY, p);
export const loadAssignments = () => read<ProjectAssignment[]>(ASSIGNMENTS_KEY, SEED_ASSIGNMENTS);
export const saveAssignments = (a: ProjectAssignment[]) => write(ASSIGNMENTS_KEY, a);
