// ---------------------------------------------------------------------------
// Professional Services — Timesheets.
//
// Hours logged by an employee against an engagement. Billable + approved + not
// yet invoiced = WIP (work-in-progress), the pool the services invoice draws
// from. Status flow mirrors Touchstone's lifecycle, simplified:
//   draft → submitted → approved → billed
//
// Persistence (client-side): nexa-timesheets.
// ---------------------------------------------------------------------------

import { read, write } from "./store";
import type { Project, ProjectAssignment } from "./projects";
import { effectiveBillRate, canBill } from "./projects";

export type TimesheetStatus = "draft" | "submitted" | "approved" | "billed";

export const TIMESHEET_STATUS_META: Record<TimesheetStatus, { label: string; variant: "default" | "primary" | "warning" | "success" }> = {
  draft: { label: "Draft", variant: "default" },
  submitted: { label: "Submitted", variant: "warning" },
  approved: { label: "Approved", variant: "primary" },
  billed: { label: "Billed", variant: "success" },
};

export interface TimesheetEntry {
  id: string;
  employeeId: string;
  projectId: string;
  date: string; // ISO
  hours: number;
  billable: boolean;
  description: string;
  status: TimesheetStatus;
  approvedById?: string;
  approvedOn?: string;
  invoiceId?: string; // set when billed
}


export const SEED_TIMESHEETS: TimesheetEntry[] = [];

// ---------------------------------------------------------------------------
// Derived
// ---------------------------------------------------------------------------
export function entriesForProject(entries: TimesheetEntry[], projectId: string) {
  return entries.filter((e) => e.projectId === projectId);
}

export function entryAmount(
  entry: TimesheetEntry,
  project: Project | undefined,
  assignments: ProjectAssignment[],
): number {
  if (!entry.billable) return 0;
  return entry.hours * effectiveBillRate(project, assignments, entry.employeeId);
}

export interface WipLine {
  projectId: string;
  employeeId: string;
  hours: number;
  rate: number; // base INR / hour
  amount: number;
  entryIds: string[];
}

export interface WipGroup {
  projectId: string;
  accountId: string;
  entityId: string;
  hours: number;
  amount: number;
  lines: WipLine[];
}

/**
 * Billable WIP grouped by engagement: approved + billable + not yet invoiced,
 * only for engagements whose conflict check is cleared/waived. One line per
 * (employee) so the invoice reads like a Touchstone time bill.
 */
export function wipByProject(
  entries: TimesheetEntry[],
  projects: Project[],
  assignments: ProjectAssignment[],
): WipGroup[] {
  const groups = new Map<string, WipGroup>();

  for (const p of projects) {
    if (!canBill(p)) continue;
    const eligible = entries.filter(
      (e) => e.projectId === p.id && e.billable && e.status === "approved" && !e.invoiceId,
    );
    if (!eligible.length) continue;

    const byEmp = new Map<string, WipLine>();
    for (const e of eligible) {
      const rate = effectiveBillRate(p, assignments, e.employeeId);
      const line = byEmp.get(e.employeeId) ?? { projectId: p.id, employeeId: e.employeeId, hours: 0, rate, amount: 0, entryIds: [] };
      line.hours += e.hours;
      line.amount += e.hours * rate;
      line.entryIds.push(e.id);
      byEmp.set(e.employeeId, line);
    }
    const lines = [...byEmp.values()];
    groups.set(p.id, {
      projectId: p.id,
      accountId: p.accountId,
      entityId: p.entityId,
      hours: lines.reduce((s, l) => s + l.hours, 0),
      amount: lines.reduce((s, l) => s + l.amount, 0),
      lines,
    });
  }

  return [...groups.values()];
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
export const TIMESHEETS_KEY = "nexa-timesheets";
export const loadTimesheets = () => read<TimesheetEntry[]>(TIMESHEETS_KEY, SEED_TIMESHEETS);
export const saveTimesheets = (t: TimesheetEntry[]) => write(TIMESHEETS_KEY, t);
