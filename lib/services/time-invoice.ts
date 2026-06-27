// ---------------------------------------------------------------------------
// Professional Services — time-based invoices (the Touchstone-format bill).
//
// Built from approved WIP rather than product lines: one line per person,
// qty = hours, rate = bill rate. GST, letterhead and amount-in-words are reused
// from lib/invoicing so a time bill looks like every other NEXA invoice. Stored
// separately (nexa-time-invoices) — the product invoice path is untouched.
//
// Numbering uses a distinct /SVC/ series so it never collides with product
// invoice numbers.
// ---------------------------------------------------------------------------

import { ACCOUNTS } from "@/lib/crm";
import { employeeName } from "@/lib/hr/employees";
import { entityPrefix, FY_LABEL, computeTotals, gstTreatment, type InvoiceLine } from "@/lib/invoicing";
import { read, write } from "./store";
import type { WipGroup } from "./timesheets";

export type ServicesInvoiceStatus = "draft" | "finalized" | "paid";

export const SERVICES_INVOICE_STATUS_META: Record<ServicesInvoiceStatus, { label: string; variant: "default" | "primary" | "success" }> = {
  draft: { label: "Draft", variant: "default" },
  finalized: { label: "Finalized", variant: "primary" },
  paid: { label: "Paid", variant: "success" },
};

export const SERVICES_GST_RATE = 18; // professional services — 18% GST

export interface ServicesInvoiceLine {
  projectId: string;
  employeeId: string;
  desc: string;
  hours: number;
  rate: number; // base INR / hour
  gstRate: number;
  entryIds: string[]; // timesheet entries this line bills (snapshot)
}

export interface ServicesInvoice {
  id: string;
  number: string;
  accountId: string;
  entityId: string;
  date: string; // ISO
  dueDate: string; // ISO
  status: ServicesInvoiceStatus;
  lines: ServicesInvoiceLine[];
  notes: string;
}

/** Convert services lines (hours × rate) into the shape the GST engine expects. */
export function asInvoiceLines(lines: ServicesInvoiceLine[]): InvoiceLine[] {
  return lines.map((l) => ({ desc: l.desc, hsn: "9983", qty: l.hours, rate: l.rate, gstRate: l.gstRate }));
}

/** Total of a services invoice via the shared GST engine. */
export function servicesInvoiceTotal(inv: ServicesInvoice): number {
  const acc = ACCOUNTS.find((a) => a.id === inv.accountId);
  const treatment = gstTreatment(inv.entityId, acc?.stateCode ?? "29");
  return computeTotals(asInvoiceLines(inv.lines), "none", 0, treatment).total;
}

/** Build a draft invoice from a single engagement's WIP group. */
export function draftFromWip(
  group: WipGroup,
  existing: ServicesInvoice[],
  today: string,
): ServicesInvoice {
  const lines: ServicesInvoiceLine[] = group.lines.map((l) => ({
    projectId: l.projectId,
    employeeId: l.employeeId,
    desc: `Professional fees — ${employeeName(l.employeeId)}`,
    hours: l.hours,
    rate: l.rate,
    gstRate: SERVICES_GST_RATE,
    entryIds: l.entryIds,
  }));

  const due = new Date(today);
  due.setDate(due.getDate() + 15);

  return {
    id: `svc-${group.projectId}-${existing.length + 1}`,
    number: nextServicesNumber(group.entityId, existing),
    accountId: group.accountId,
    entityId: group.entityId,
    date: today,
    dueDate: due.toISOString().slice(0, 10),
    status: "draft",
    lines,
    notes: "",
  };
}

/** Next sequential /SVC/ number for an entity. */
export function nextServicesNumber(entityId: string, existing: ServicesInvoice[]): string {
  const prefix = entityPrefix(entityId);
  let max = 0;
  for (const i of existing.filter((x) => x.entityId === entityId)) {
    const m = i.number.match(/\/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}/SVC/${FY_LABEL}/${String(max + 1).padStart(4, "0")}`;
}

// ---------------------------------------------------------------------------
// Seed time-invoices — a handful of finalised/paid bills so the Professional-
// services billing screen opens with history, and so service revenue appears in
// the P&L / Balance Sheet / GST (via lib/accounting/revenue-bridge).
// ---------------------------------------------------------------------------
const svcLine = (
  projectId: string,
  employeeId: string,
  hours: number,
  rate: number,
  entryIds: string[],
): ServicesInvoiceLine => ({
  projectId,
  employeeId,
  desc: `Professional fees — ${employeeName(employeeId)}`,
  hours,
  rate,
  gstRate: SERVICES_GST_RATE,
  entryIds,
});

export const SEED_TIME_INVOICES: ServicesInvoice[] = [];

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
export const TIME_INVOICES_KEY = "nexa-time-invoices";
export const loadTimeInvoices = () => read<ServicesInvoice[]>(TIME_INVOICES_KEY, SEED_TIME_INVOICES);
export const saveTimeInvoices = (i: ServicesInvoice[]) => write(TIME_INVOICES_KEY, i);
