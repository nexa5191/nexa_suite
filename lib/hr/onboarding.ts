// ---------------------------------------------------------------------------
// NEXA onboarding / offboarding workflows
//
// Drives /hr/onboarding. Each joiner or leaver runs through a standard
// checklist template; completion state is computed deterministically from the
// employee's join/exit date (vs. today, 2026-06-18) and can be overridden in
// the UI (persisted to localStorage by the client).
// ---------------------------------------------------------------------------

import { EMPLOYEES } from "./employees";
import type { Employee } from "./types";

export type JourneyKind = "onboarding" | "offboarding";

export type TaskOwner = "HR" | "IT" | "Manager" | "Finance" | "Employee";

/** A single template line item within a checklist. */
export interface ChecklistTask {
  id: string;
  label: string;
  owner: TaskOwner;
  // Days relative to the journey anchor date (join date for onboarding, exit
  // date for offboarding). Negative = due before the anchor.
  dueOffsetDays: number;
}

/** A person actively running through one of the two flows. */
export interface OnboardingJourney {
  id: string; // e.g. "onb-emp-024"
  kind: JourneyKind;
  employee: Employee;
  anchorDate: string; // ISO — join date (onboarding) or exit date (offboarding)
  tasks: ChecklistTask[];
  defaultDone: string[]; // task ids deterministically completed by default
}

/** In-app "today". */
export const TODAY = "2026-06-18";
const TODAY_MS = new Date(TODAY).getTime();
const DAY_MS = 86_400_000;

// ---- Templates ------------------------------------------------------------

export const ONBOARDING_TEMPLATE: ChecklistTask[] = [
  { id: "offer-accepted", label: "Offer accepted", owner: "HR", dueOffsetDays: -7 },
  { id: "docs-collected", label: "Documents collected (PAN / Aadhaar / bank)", owner: "HR", dueOffsetDays: 0 },
  { id: "accounts-provisioned", label: "Email & accounts provisioned", owner: "IT", dueOffsetDays: 1 },
  { id: "asset-issued", label: "Asset issued (laptop)", owner: "IT", dueOffsetDays: 1 },
  { id: "induction", label: "Induction / orientation", owner: "HR", dueOffsetDays: 2 },
  { id: "payroll-setup", label: "Payroll & PF setup", owner: "Finance", dueOffsetDays: 5 },
  { id: "buddy-assigned", label: "Buddy assigned", owner: "Manager", dueOffsetDays: 3 },
  { id: "probation-goals", label: "Probation goals set", owner: "Manager", dueOffsetDays: 14 },
];

export const OFFBOARDING_TEMPLATE: ChecklistTask[] = [
  { id: "resignation-ack", label: "Resignation acknowledged", owner: "HR", dueOffsetDays: -30 },
  { id: "knowledge-transfer", label: "Knowledge transfer", owner: "Manager", dueOffsetDays: -7 },
  { id: "assets-returned", label: "Assets returned", owner: "IT", dueOffsetDays: 0 },
  { id: "access-revoked", label: "Access revoked", owner: "IT", dueOffsetDays: 0 },
  { id: "fnf-initiated", label: "Full & final settlement initiated", owner: "Finance", dueOffsetDays: 1 },
  { id: "exit-interview", label: "Exit interview", owner: "HR", dueOffsetDays: -2 },
  { id: "experience-letter", label: "Experience letter", owner: "HR", dueOffsetDays: 3 },
  { id: "relieving-letter", label: "Relieving letter", owner: "HR", dueOffsetDays: 1 },
];

export function templateFor(kind: JourneyKind): ChecklistTask[] {
  return kind === "onboarding" ? ONBOARDING_TEMPLATE : OFFBOARDING_TEMPLATE;
}

// ---- Date helpers ---------------------------------------------------------

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((new Date(toIso).getTime() - new Date(fromIso).getTime()) / DAY_MS);
}

/** ISO date for a task's due date given its journey anchor. */
export function taskDueDate(anchorDate: string, task: ChecklistTask): string {
  const ms = new Date(anchorDate).getTime() + task.dueOffsetDays * DAY_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

/** A task is overdue if its due date has passed and it is not complete. */
export function isOverdue(anchorDate: string, task: ChecklistTask, done: boolean): boolean {
  if (done) return false;
  return new Date(taskDueDate(anchorDate, task)).getTime() < TODAY_MS;
}

// ---- Seeding --------------------------------------------------------------

// Recent joiners (within ~120 days of today) are treated as in-flight
// onboarding. As of 2026-06-18 no seeded employee joined that recently, so we
// widen the window to surface the most recent joiners as a realistic pipeline.
const ONBOARDING_WINDOW_DAYS = 1200;

function recentJoiners(): Employee[] {
  return EMPLOYEES.filter((e) => e.status !== "exited")
    .filter((e) => {
      const since = daysBetween(e.joinDate, TODAY);
      return since >= 0 && since <= ONBOARDING_WINDOW_DAYS;
    })
    .sort((a, b) => b.joinDate.localeCompare(a.joinDate))
    .slice(0, 5);
}

function leavers(): Employee[] {
  return EMPLOYEES.filter((e) => e.status === "exited" && e.exitDate);
}

// Deterministic default-done set: the further a journey's anchor is in the
// past, the more of its early tasks are pre-completed. No PRNG — derived purely
// from the anchor date so SSR and client agree.
function deterministicDone(kind: JourneyKind, anchorDate: string, tasks: ChecklistTask[]): string[] {
  const elapsed = daysBetween(anchorDate, TODAY); // can be negative for future-dated
  return tasks
    .filter((t) => {
      // A task is auto-done once enough time has passed beyond its due offset.
      // Onboarding tasks settle a few days after due; offboarding closes tighter.
      const settleBuffer = kind === "onboarding" ? 2 : 1;
      return elapsed >= t.dueOffsetDays + settleBuffer;
    })
    .map((t) => t.id);
}

function buildJourney(kind: JourneyKind, employee: Employee, anchorDate: string): OnboardingJourney {
  const tasks = templateFor(kind);
  return {
    id: `${kind === "onboarding" ? "onb" : "off"}-${employee.id}`,
    kind,
    employee,
    anchorDate,
    tasks,
    defaultDone: deterministicDone(kind, anchorDate, tasks),
  };
}

export const ONBOARDING_JOURNEYS: OnboardingJourney[] = recentJoiners().map((e) =>
  buildJourney("onboarding", e, e.joinDate),
);

export const OFFBOARDING_JOURNEYS: OnboardingJourney[] = leavers().map((e) =>
  buildJourney("offboarding", e, e.exitDate!),
);

export const ALL_JOURNEYS: OnboardingJourney[] = [...ONBOARDING_JOURNEYS, ...OFFBOARDING_JOURNEYS];

export function journeysFor(kind: JourneyKind): OnboardingJourney[] {
  return kind === "onboarding" ? ONBOARDING_JOURNEYS : OFFBOARDING_JOURNEYS;
}

export function journeyById(id: string): OnboardingJourney | undefined {
  return ALL_JOURNEYS.find((j) => j.id === id);
}

// ---- Progress / summary ---------------------------------------------------

/**
 * Resolve the effective done-set for a journey: deterministic defaults merged
 * with any localStorage overrides the caller passes in (override wins per task).
 */
export function resolveDone(journey: OnboardingJourney, overrides?: Record<string, boolean>): Set<string> {
  const done = new Set(journey.defaultDone);
  if (overrides) {
    for (const t of journey.tasks) {
      const o = overrides[t.id];
      if (o === true) done.add(t.id);
      else if (o === false) done.delete(t.id);
    }
  }
  return done;
}

export function journeyProgress(journey: OnboardingJourney, overrides?: Record<string, boolean>): number {
  const done = resolveDone(journey, overrides);
  if (journey.tasks.length === 0) return 0;
  return Math.round((done.size / journey.tasks.length) * 100);
}

export function journeyOverdueCount(journey: OnboardingJourney, overrides?: Record<string, boolean>): number {
  const done = resolveDone(journey, overrides);
  return journey.tasks.filter((t) => isOverdue(journey.anchorDate, t, done.has(t.id))).length;
}

export interface OnboardingSummary {
  onboardingInProgress: number;
  offboardingInProgress: number;
  overdueTasks: number;
  completionPct: number; // average completion across all journeys
}

/**
 * Roll-up across every journey. `overridesById` maps a journey id to its
 * per-task localStorage overrides.
 */
export function onboardingSummary(
  overridesById?: Record<string, Record<string, boolean>>,
): OnboardingSummary {
  const get = (j: OnboardingJourney) => overridesById?.[j.id];

  const onboardingInProgress = ONBOARDING_JOURNEYS.filter(
    (j) => journeyProgress(j, get(j)) < 100,
  ).length;
  const offboardingInProgress = OFFBOARDING_JOURNEYS.filter(
    (j) => journeyProgress(j, get(j)) < 100,
  ).length;

  const overdueTasks = ALL_JOURNEYS.reduce((sum, j) => sum + journeyOverdueCount(j, get(j)), 0);

  const completionPct =
    ALL_JOURNEYS.length === 0
      ? 0
      : Math.round(
          ALL_JOURNEYS.reduce((sum, j) => sum + journeyProgress(j, get(j)), 0) / ALL_JOURNEYS.length,
        );

  return { onboardingInProgress, offboardingInProgress, overdueTasks, completionPct };
}
