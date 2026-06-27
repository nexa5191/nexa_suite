import type { LeaveType, LeaveRequest, LeaveBalance, DayUnit } from "./types";
import { employeeById } from "./employees";

// ---------------------------------------------------------------------------
// Leave policy — the default config shipped with the platform. Fully editable
// from /leave/config; edits are persisted to localStorage (see load/save).
// ---------------------------------------------------------------------------

export const DEFAULT_LEAVE_TYPES: LeaveType[] = [
  { id: "lt-cl", name: "Casual Leave", code: "CL", tone: "primary", allowHalfDay: true, annualDays: 12, paid: true, carryForward: false },
  { id: "lt-sl", name: "Sick Leave", code: "SL", tone: "warning", allowHalfDay: true, annualDays: 10, paid: true, carryForward: false },
  { id: "lt-el", name: "Earned Leave", code: "EL", tone: "success", allowHalfDay: false, annualDays: 18, paid: true, carryForward: true },
  { id: "lt-wfh", name: "Work From Home", code: "WFH", tone: "primary", allowHalfDay: true, annualDays: 24, paid: true, carryForward: false },
  { id: "lt-pl", name: "Parental Leave", code: "PL", tone: "success", allowHalfDay: false, annualDays: 26, paid: true, carryForward: false },
  { id: "lt-lwp", name: "Leave Without Pay", code: "LWP", tone: "danger", allowHalfDay: true, annualDays: 0, paid: false, carryForward: false },
];

export const LEAVE_CONFIG_KEY = "nexa-leave-config";

/** Load the active policy — persisted edits if present, else the defaults. */
export function loadLeaveTypes(): LeaveType[] {
  if (typeof window === "undefined") return DEFAULT_LEAVE_TYPES;
  try {
    const raw = localStorage.getItem(LEAVE_CONFIG_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as LeaveType[];
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_LEAVE_TYPES;
}

export function saveLeaveTypes(types: LeaveType[]) {
  try {
    localStorage.setItem(LEAVE_CONFIG_KEY, JSON.stringify(types));
  } catch {
    /* ignore */
  }
}

export function leaveTypeById(types: LeaveType[], id: string) {
  return types.find((t) => t.id === id);
}

// ---- date helpers (deterministic — no Date.now) ---------------------------

/** Chargeable working days in [from, to] inclusive, skipping weekends. */
export function workingDays(from: string, to: string): number {
  const a = new Date(`${from}T00:00:00Z`);
  const b = new Date(`${to}T00:00:00Z`);
  let n = 0;
  for (const d = new Date(a); d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n += 1;
  }
  return Math.max(n, 1);
}

export function requestDays(from: string, to: string, unit: DayUnit): number {
  if (unit === "half") return 0.5;
  return workingDays(from, to);
}

// ---------------------------------------------------------------------------
// Mock leave requests — hand-authored around the current date (2026-06-05) so
// there is a realistic mix of pending (→ approvals), approved and rejected.
// ---------------------------------------------------------------------------

interface RawRequest {
  emp: string;
  type: string;
  from: string;
  to: string;
  unit: DayUnit;
  status: LeaveRequest["status"];
  reason: string;
  appliedOn: string;
}

const RAW: RawRequest[] = [];

export const LEAVE_REQUESTS: LeaveRequest[] = RAW.map((r, i) => ({
  id: `req-${String(i + 1).padStart(3, "0")}`,
  employeeId: r.emp,
  leaveTypeId: r.type,
  from: r.from,
  to: r.to,
  unit: r.unit,
  days: requestDays(r.from, r.to, r.unit),
  reason: r.reason,
  status: r.status,
  appliedOn: r.appliedOn,
  approverId: employeeById(r.emp)?.managerId ?? null,
}));

export function requestsForEmployee(employeeId: string) {
  return LEAVE_REQUESTS.filter((r) => r.employeeId === employeeId);
}

export function pendingLeaveRequests() {
  return LEAVE_REQUESTS.filter((r) => r.status === "pending");
}

/** Per-type leave balance for an employee against the active policy. */
export function balancesFor(
  employeeId: string,
  types: LeaveType[],
  requests: LeaveRequest[] = LEAVE_REQUESTS,
): LeaveBalance[] {
  const mine = requests.filter((r) => r.employeeId === employeeId);
  return types.map((t) => {
    const ofType = mine.filter((r) => r.leaveTypeId === t.id);
    const used = ofType.filter((r) => r.status === "approved").reduce((s, r) => s + r.days, 0);
    const pending = ofType.filter((r) => r.status === "pending").reduce((s, r) => s + r.days, 0);
    return {
      leaveTypeId: t.id,
      allocated: t.annualDays,
      used,
      pending,
      available: Math.max(t.annualDays - used - pending, 0),
    };
  });
}
