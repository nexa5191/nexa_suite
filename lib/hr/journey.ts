import { employeeById, departmentName } from "./employees";
import { payslipsForEmployee } from "./payroll";

// ---------------------------------------------------------------------------
// Employee journey timeline + document vault — powers the self-service portal.
// ---------------------------------------------------------------------------

export type JourneyType = "joined" | "promotion" | "transfer" | "award" | "exit";

export interface JourneyEvent {
  date: string; // ISO
  title: string;
  detail: string;
  type: JourneyType;
}

// Hand-authored milestones for a few employees; everyone else just has "joined"
// (+ exit, if applicable).
const EXTRA: Record<string, JourneyEvent[]> = {
  "emp-006": [
    { date: "2023-04-01", title: "Promoted to Senior Accountant", detail: "Moved up from Accountant after a strong FY22-23.", type: "promotion" },
    { date: "2025-01-15", title: "Star Performer — Q3", detail: "Recognised for leading the audit readiness.", type: "award" },
  ],
  "emp-016": [
    { date: "2023-10-01", title: "Promoted to Frontend Engineer II", detail: "Led the design-system migration.", type: "promotion" },
  ],
  "emp-020": [
    { date: "2022-04-01", title: "Promoted to Operations Manager", detail: "Took ownership of the Mysuru plant operations.", type: "promotion" },
  ],
  "emp-010": [
    { date: "2022-04-01", title: "Confirmed as Account Executive", detail: "Cleared probation with top-quartile numbers.", type: "transfer" },
  ],
};

export function journeyFor(employeeId: string): JourneyEvent[] {
  const emp = employeeById(employeeId);
  if (!emp) return [];
  const events: JourneyEvent[] = [
    { date: emp.joinDate, title: "Joined NEXA", detail: `${emp.designation}, ${departmentName(emp.departmentId)}`, type: "joined" },
    ...(EXTRA[employeeId] ?? []),
  ];
  if (emp.exitDate) {
    events.push({ date: emp.exitDate, title: "Exited NEXA", detail: "Full & final settlement completed; account switched to personal ID.", type: "exit" });
  }
  return events.sort((a, b) => b.date.localeCompare(a.date));
}

export type DocCategory = "Onboarding" | "Payroll" | "Tax" | "Personal" | "Exit";
export interface EmpDoc {
  name: string;
  kind: "pdf" | "doc" | "image";
  date: string;
  category: DocCategory;
}

export function documentsFor(employeeId: string): EmpDoc[] {
  const emp = employeeById(employeeId);
  if (!emp) return [];
  const docs: EmpDoc[] = [
    { name: "Offer Letter.pdf", kind: "pdf", date: emp.joinDate, category: "Onboarding" },
    { name: "Appointment Letter.pdf", kind: "pdf", date: emp.joinDate, category: "Onboarding" },
    { name: "PAN Card.jpg", kind: "image", date: emp.joinDate, category: "Personal" },
    { name: "Aadhaar.pdf", kind: "pdf", date: emp.joinDate, category: "Personal" },
    { name: "Form 16 (FY25-26).pdf", kind: "pdf", date: "2026-05-31", category: "Tax" },
  ];
  payslipsForEmployee(employeeId).forEach((p) => {
    docs.push({ name: `Payslip ${p.label}.pdf`, kind: "pdf", date: `${p.month}-28`, category: "Payroll" });
  });
  if (emp.exitDate) {
    docs.push(
      { name: "Relieving Letter.pdf", kind: "pdf", date: emp.exitDate, category: "Exit" },
      { name: "Experience Certificate.pdf", kind: "pdf", date: emp.exitDate, category: "Exit" },
      { name: "Full & Final Settlement.pdf", kind: "pdf", date: emp.exitDate, category: "Exit" },
    );
  }
  return docs.sort((a, b) => b.date.localeCompare(a.date));
}
