// ---------------------------------------------------------------------------
// NEXA people / HR domain model
//
// Sits alongside the accounting model (lib/accounting) and reuses the same
// entity + location tree from lib/accounting/org.
// ---------------------------------------------------------------------------

export type DayUnit = "full" | "half";

export type EmploymentType = "full-time" | "part-time" | "contract";

export interface Department {
  id: string;
  name: string;
}

export interface Employee {
  id: string;
  code: string; // human id, e.g. "EMP-001"
  name: string;
  email: string;
  designation: string;
  departmentId: string;
  entityId: string; // FK → lib/accounting/org ENTITIES
  locationId: string; // FK → lib/accounting/org LOCATIONS
  managerId: string | null;
  joinDate: string; // ISO
  employmentType: EmploymentType;
  status: "active" | "on-leave" | "exited";
  personalEmail: string; // used by the self-service portal after exit
  exitDate?: string; // ISO — set when the employee has left
}

// ---- Leave policy (configurable in-platform) ------------------------------

// A leave type is the unit a company's leave policy is built from. Everything
// here is editable from /leave/config and persisted to localStorage.
export interface LeaveType {
  id: string;
  name: string; // "Casual Leave"
  code: string; // "CL"
  tone: "primary" | "success" | "warning" | "danger"; // maps to a UI token
  allowHalfDay: boolean; // can be booked in 0.5-day units
  annualDays: number; // allocation granted per year (0 = unlimited/unpaid)
  paid: boolean;
  carryForward: boolean; // unused balance rolls into next year
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  from: string; // ISO date
  to: string; // ISO date (== from for single-day / half-day)
  unit: DayUnit; // half only valid for a single-day request
  days: number; // chargeable days (0.5 for a half day)
  reason: string;
  status: "pending" | "approved" | "rejected";
  appliedOn: string; // ISO date
  approverId: string | null;
}

// Derived per-employee, per-type balance.
export interface LeaveBalance {
  leaveTypeId: string;
  allocated: number;
  used: number; // approved days taken
  pending: number; // days awaiting approval
  available: number; // allocated − used − pending
}

// ---- Unified approval engine ----------------------------------------------

export type ApprovalKind = "leave" | "financial" | "document";

// One pending decision, regardless of which module raised it. The widget and
// /approvals page render this shape; modules (leave, finance, docs) feed it.
export interface Approval {
  id: string;
  kind: ApprovalKind;
  title: string;
  detail: string;
  requestedById: string | null; // employee id where applicable
  requestedByName: string;
  requestedOn: string; // ISO date
  amount?: number; // base-currency (INR) — financial approvals only
  entityId: string;
  locationId: string;
  approverId: string | null;
  status: "pending" | "approved" | "rejected";
  href: string; // where to review the underlying item
}
