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

const RAW: RawRequest[] = [
  // ---- pending (upcoming) — these surface in the approvals queue ----
  { emp: "emp-016", type: "lt-sl", from: "2026-06-08", to: "2026-06-09", unit: "full", status: "pending", reason: "Down with fever", appliedOn: "2026-06-05" },
  { emp: "emp-021", type: "lt-wfh", from: "2026-06-10", to: "2026-06-10", unit: "full", status: "pending", reason: "Awaiting a home delivery", appliedOn: "2026-06-04" },
  { emp: "emp-006", type: "lt-cl", from: "2026-06-12", to: "2026-06-12", unit: "half", status: "pending", reason: "Bank work in the afternoon", appliedOn: "2026-06-03" },
  { emp: "emp-013", type: "lt-cl", from: "2026-06-15", to: "2026-06-16", unit: "full", status: "pending", reason: "Family function", appliedOn: "2026-06-02" },
  { emp: "emp-018", type: "lt-cl", from: "2026-06-19", to: "2026-06-19", unit: "half", status: "pending", reason: "Doctor appointment", appliedOn: "2026-06-05" },
  { emp: "emp-010", type: "lt-el", from: "2026-06-22", to: "2026-06-26", unit: "full", status: "pending", reason: "Family vacation to Kerala", appliedOn: "2026-06-01" },
  { emp: "emp-009", type: "lt-el", from: "2026-07-01", to: "2026-07-03", unit: "full", status: "pending", reason: "Long weekend trip", appliedOn: "2026-06-04" },

  // ---- approved (past) ----
  { emp: "emp-014", type: "lt-cl", from: "2026-01-22", to: "2026-01-23", unit: "full", status: "approved", reason: "Out-station travel", appliedOn: "2026-01-15" },
  { emp: "emp-020", type: "lt-el", from: "2026-02-09", to: "2026-02-13", unit: "full", status: "approved", reason: "Annual vacation", appliedOn: "2026-01-20" },
  { emp: "emp-010", type: "lt-cl", from: "2026-02-17", to: "2026-02-17", unit: "full", status: "approved", reason: "Personal", appliedOn: "2026-02-10" },
  { emp: "emp-019", type: "lt-sl", from: "2026-03-03", to: "2026-03-03", unit: "half", status: "approved", reason: "Clinic visit", appliedOn: "2026-03-03" },
  { emp: "emp-006", type: "lt-el", from: "2026-03-10", to: "2026-03-14", unit: "full", status: "approved", reason: "Vacation", appliedOn: "2026-02-20" },
  { emp: "emp-008", type: "lt-pl", from: "2026-04-01", to: "2026-05-29", unit: "full", status: "approved", reason: "Maternity leave", appliedOn: "2026-03-10" },
  { emp: "emp-007", type: "lt-sl", from: "2026-04-02", to: "2026-04-03", unit: "full", status: "approved", reason: "Viral infection", appliedOn: "2026-04-01" },
  { emp: "emp-017", type: "lt-el", from: "2026-04-21", to: "2026-04-25", unit: "full", status: "approved", reason: "Holiday", appliedOn: "2026-03-30" },
  { emp: "emp-011", type: "lt-el", from: "2026-05-05", to: "2026-05-09", unit: "full", status: "approved", reason: "Cousin's wedding", appliedOn: "2026-04-15" },
  { emp: "emp-023", type: "lt-cl", from: "2026-05-12", to: "2026-05-12", unit: "full", status: "approved", reason: "Personal errand", appliedOn: "2026-05-08" },
  { emp: "emp-016", type: "lt-wfh", from: "2026-05-19", to: "2026-05-20", unit: "full", status: "approved", reason: "Remote working days", appliedOn: "2026-05-15" },

  // ---- rejected ----
  { emp: "emp-022", type: "lt-cl", from: "2026-04-14", to: "2026-04-15", unit: "full", status: "rejected", reason: "Applied on short notice", appliedOn: "2026-04-13" },
  { emp: "emp-013", type: "lt-el", from: "2026-05-26", to: "2026-05-30", unit: "full", status: "rejected", reason: "Clashes with quarter-end push", appliedOn: "2026-05-10" },
];

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
