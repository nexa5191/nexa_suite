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
export const SEED_PROJECTS: Project[] = [];
export const SEED_ASSIGNMENTS: ProjectAssignment[] = [];

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
