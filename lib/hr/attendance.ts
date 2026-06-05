import { ACTIVE_EMPLOYEES, employeeById } from "./employees";
import { LEAVE_REQUESTS } from "./leave";
import { isHoliday } from "./holidays";
import { TODAY } from "@/lib/calendar";

// ---------------------------------------------------------------------------
// Attendance — deterministically derived from employee + date (no Date.now,
// no Math.random), cross-referencing approved leave and the holiday calendar.
// ---------------------------------------------------------------------------

export type AttendanceStatus =
  | "present"
  | "wfh"
  | "half"
  | "absent"
  | "leave"
  | "holiday"
  | "weekend";

// Order-independent hash → [0,1) so a day's status never depends on iteration.
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967296;
}

// approved-leave date set: `${employeeId}:${YYYY-MM-DD}`
const LEAVE_DATES = new Set<string>();
for (const r of LEAVE_REQUESTS) {
  if (r.status !== "approved") continue;
  const a = new Date(`${r.from}T00:00:00Z`);
  const b = new Date(`${r.to}T00:00:00Z`);
  for (const d = new Date(a); d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
    LEAVE_DATES.add(`${r.employeeId}:${d.toISOString().slice(0, 10)}`);
  }
}

function isWeekend(date: string) {
  const wd = new Date(`${date}T00:00:00Z`).getUTCDay();
  return wd === 0 || wd === 6;
}

export function dayStatus(employeeId: string, date: string): AttendanceStatus {
  if (isWeekend(date)) return "weekend";
  const emp = employeeById(employeeId);
  if (emp && isHoliday(emp.locationId, date)) return "holiday";
  if (LEAVE_DATES.has(`${employeeId}:${date}`)) return "leave";
  const r = hash01(`${employeeId}|${date}`);
  if (r < 0.03) return "absent";
  if (r < 0.07) return "half";
  if (r < 0.22) return "wfh";
  return "present";
}

function datesOfMonth(year: number, month: number): string[] {
  const out: string[] = [];
  const d = new Date(Date.UTC(year, month, 1));
  while (d.getUTCMonth() === month) {
    out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

export interface AttendanceSummary {
  employeeId: string;
  present: number;
  wfh: number;
  half: number;
  absent: number;
  leave: number;
  workingDays: number; // excludes weekends & holidays, up to TODAY
  percent: number; // attendance %
}

export type DayCell = AttendanceStatus | "future";

/** Per-employee attendance for a month, counted only up to TODAY. */
export function monthAttendance(year: number, month: number): {
  dates: string[];
  rows: { employeeId: string; days: DayCell[]; summary: AttendanceSummary }[];
} {
  const dates = datesOfMonth(year, month);
  const rows = ACTIVE_EMPLOYEES.map((emp) => {
    const days: DayCell[] = dates.map((date) => {
      if (date > TODAY) return isWeekend(date) ? "weekend" : "future";
      return dayStatus(emp.id, date);
    });
    let present = 0, wfh = 0, half = 0, absent = 0, leave = 0, workingDays = 0;
    days.forEach((s) => {
      if (s === "weekend" || s === "holiday" || s === "future") return;
      workingDays += 1;
      if (s === "present") present += 1;
      else if (s === "wfh") wfh += 1;
      else if (s === "half") half += 1;
      else if (s === "absent") absent += 1;
      else if (s === "leave") leave += 1;
    });
    const base = present + wfh + half + absent; // exclude planned leave from %
    const percent = base ? Math.round(((present + wfh + half * 0.5) / base) * 100) : 100;
    return { employeeId: emp.id, days, summary: { employeeId: emp.id, present, wfh, half, absent, leave, workingDays, percent } };
  });
  return { dates, rows };
}

/** Today's live board across active employees. */
export function todayBoard() {
  const counts = { present: 0, wfh: 0, half: 0, leave: 0, absent: 0, holiday: 0 };
  const byEmployee = ACTIVE_EMPLOYEES.map((e) => {
    const s = dayStatus(e.id, TODAY);
    if (s in counts) (counts as Record<string, number>)[s] += 1;
    return { employeeId: e.id, status: s };
  });
  return { counts, byEmployee };
}
