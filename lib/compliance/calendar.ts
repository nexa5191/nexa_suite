// ---------------------------------------------------------------------------
// Compliance Calendar — statutory due-date engine for Indian companies.
//
// Covers: GST filings, TDS remittance & returns, PF/ESI, Advance Tax,
// Professional Tax, MCA/ROC filings, Income Tax return, Labour laws.
//
// Each due-date entry computes:
//   - daysUntilDue  (negative = overdue)
//   - penalty / interest for late filing where applicable
//   - alert level   (ok / due-soon / overdue)
// ---------------------------------------------------------------------------

export type ComplianceCategory = "GST" | "TDS" | "PF/ESI" | "AdvanceTax" | "MCA" | "IncomeTax" | "Labour" | "PT";

export type AlertLevel = "ok" | "due-soon" | "due-today" | "overdue";

export interface DueDate {
  id: string;
  category: ComplianceCategory;
  obligation: string;
  description: string;
  dueDate: string;           // ISO
  period: string;            // e.g. "May 2026"
  form?: string;             // e.g. "GSTR-3B", "26Q", "ECR"
  authority: string;         // GSTN, TIN, EPFO, ROC, IT Dept …
  daysUntilDue: number;
  alertLevel: AlertLevel;
  penaltyPerDay?: number;    // ₹ per day after due date (if applicable)
  interestRate?: number;     // % per month (if applicable)
  estimatedLiability?: number; // for remittance-type obligations
  filed?: boolean;
  filedOn?: string;
}

const AS_ON = "2026-06-22";

function daysDiff(dueDate: string): number {
  const due = new Date(dueDate).getTime();
  const today = new Date(AS_ON).getTime();
  return Math.round((due - today) / 86400000);
}

function alertLevel(days: number, filed: boolean): AlertLevel {
  if (filed) return "ok";
  if (days < 0) return "overdue";
  if (days === 0) return "due-today";
  if (days <= 7) return "due-soon";
  return "ok";
}

function due(
  id: string, category: ComplianceCategory, obligation: string, description: string,
  dueDate: string, period: string, authority: string,
  opts: { form?: string; penaltyPerDay?: number; interestRate?: number; estimatedLiability?: number; filed?: boolean; filedOn?: string } = {}
): DueDate {
  const days = daysDiff(dueDate);
  return {
    id, category, obligation, description, dueDate, period, authority,
    form: opts.form,
    daysUntilDue: days,
    alertLevel: alertLevel(days, opts.filed ?? false),
    penaltyPerDay: opts.penaltyPerDay,
    interestRate: opts.interestRate,
    estimatedLiability: opts.estimatedLiability,
    filed: opts.filed ?? false,
    filedOn: opts.filedOn,
  };
}

export const COMPLIANCE_CALENDAR: DueDate[] = [
  // ---- GST ------------------------------------------------------------------
  due("gst-gstr1-may26", "GST", "GSTR-1 Filing", "Outward supplies — monthly filer", "2026-06-11", "May 2026", "GSTN",
    { form: "GSTR-1", penaltyPerDay: 50, filed: true, filedOn: "2026-06-10" }),
  due("gst-gstr3b-may26", "GST", "GSTR-3B + Payment", "Summary return + tax payment", "2026-06-20", "May 2026", "GSTN",
    { form: "GSTR-3B", penaltyPerDay: 50, interestRate: 18, estimatedLiability: 340000, filed: true, filedOn: "2026-06-19" }),
  due("gst-gstr1-jun26", "GST", "GSTR-1 Filing", "Outward supplies — monthly filer", "2026-07-11", "Jun 2026", "GSTN",
    { form: "GSTR-1", penaltyPerDay: 50 }),
  due("gst-gstr3b-jun26", "GST", "GSTR-3B + Payment", "Summary return + tax payment", "2026-07-20", "Jun 2026", "GSTN",
    { form: "GSTR-3B", penaltyPerDay: 50, interestRate: 18, estimatedLiability: 360000 }),
  due("gst-gstr9-fy26", "GST", "GSTR-9 Annual Return", "Annual GST return — FY 2025-26", "2026-12-31", "FY 2025-26", "GSTN",
    { form: "GSTR-9", penaltyPerDay: 200 }),

  // ---- TDS ------------------------------------------------------------------
  due("tds-challan-may26", "TDS", "TDS Challan Payment", "Deposit TDS deducted in May 2026", "2026-06-07", "May 2026", "TIN / NSDL",
    { estimatedLiability: 520000, interestRate: 18, filed: true, filedOn: "2026-06-07" }),
  due("tds-challan-jun26", "TDS", "TDS Challan Payment", "Deposit TDS deducted in Jun 2026", "2026-07-07", "Jun 2026", "TIN / NSDL",
    { estimatedLiability: 480000, interestRate: 18 }),
  due("tds-26q-q1", "TDS", "Form 26Q — Q1", "Non-salary TDS quarterly return", "2026-07-31", "Q1 FY26-27", "TIN / NSDL",
    { form: "26Q", penaltyPerDay: 200 }),
  due("tds-24q-q1", "TDS", "Form 24Q — Q1", "Salary TDS quarterly return", "2026-07-31", "Q1 FY26-27", "TIN / NSDL",
    { form: "24Q", penaltyPerDay: 200 }),
  due("tds-tcs-q1", "TDS", "Form 27EQ — Q1", "TCS quarterly return", "2026-07-15", "Q1 FY26-27", "TIN / NSDL",
    { form: "27EQ", penaltyPerDay: 200 }),

  // ---- PF / ESI -------------------------------------------------------------
  due("pf-may26", "PF/ESI", "EPF Contribution", "Provident Fund — employer + employee", "2026-06-15", "May 2026", "EPFO",
    { estimatedLiability: 420000, filed: true, filedOn: "2026-06-14" }),
  due("esi-may26", "PF/ESI", "ESI Contribution", "Employee State Insurance remittance", "2026-06-15", "May 2026", "ESIC",
    { estimatedLiability: 95000, filed: true, filedOn: "2026-06-14" }),
  due("pf-jun26", "PF/ESI", "EPF Contribution", "Provident Fund — employer + employee", "2026-07-15", "Jun 2026", "EPFO",
    { estimatedLiability: 420000 }),
  due("esi-jun26", "PF/ESI", "ESI Contribution", "Employee State Insurance remittance", "2026-07-15", "Jun 2026", "ESIC",
    { estimatedLiability: 95000 }),
  due("pf-ecr-q1", "PF/ESI", "PF ECR Filing", "Electronic Challan-cum-Return (quarterly summary)", "2026-07-25", "Q1 FY26-27", "EPFO",
    { form: "ECR" }),

  // ---- Advance Tax ----------------------------------------------------------
  due("at-q1-fy27", "AdvanceTax", "Advance Tax — 1st Installment", "15% of estimated annual tax (Sec. 207)", "2026-06-15", "Q1 FY26-27", "IT Dept",
    { estimatedLiability: 300000, interestRate: 12, filed: true, filedOn: "2026-06-13" }),
  due("at-q2-fy27", "AdvanceTax", "Advance Tax — 2nd Installment", "45% cumulative (Sec. 207)", "2026-09-15", "Q2 FY26-27", "IT Dept",
    { estimatedLiability: 600000, interestRate: 12 }),
  due("at-q3-fy27", "AdvanceTax", "Advance Tax — 3rd Installment", "75% cumulative (Sec. 207)", "2026-12-15", "Q3 FY26-27", "IT Dept",
    { estimatedLiability: 600000, interestRate: 12 }),
  due("at-q4-fy27", "AdvanceTax", "Advance Tax — 4th Installment", "100% cumulative (Sec. 207)", "2027-03-15", "Q4 FY26-27", "IT Dept",
    { estimatedLiability: 500000, interestRate: 12 }),

  // ---- MCA / ROC ------------------------------------------------------------
  due("mca-aoc4-fy25", "MCA", "AOC-4 — Financial Statements", "File audited FS with ROC (within 30 days of AGM)", "2026-10-30", "FY 2025-26", "ROC / MCA",
    { form: "AOC-4", penaltyPerDay: 100 }),
  due("mca-mgt7-fy25", "MCA", "MGT-7 — Annual Return", "Annual Return of company (within 60 days of AGM)", "2026-11-29", "FY 2025-26", "ROC / MCA",
    { form: "MGT-7", penaltyPerDay: 100 }),
  due("mca-adt1", "MCA", "ADT-1 — Auditor Appointment", "Inform ROC of auditor appointed/re-appointed at AGM", "2026-10-15", "FY 2025-26", "ROC / MCA",
    { form: "ADT-1" }),
  due("mca-form8-msme", "MCA", "Form MBP-1 / MSME-1", "Half-yearly return for dues to MSME suppliers", "2026-10-31", "Apr–Sep 2026", "ROC / MCA",
    { form: "MSME-1" }),
  due("mca-dir3kyc", "MCA", "DIR-3 KYC", "Annual KYC of directors", "2026-09-30", "FY 2025-26", "ROC / MCA",
    { form: "DIR-3 KYC" }),

  // ---- Income Tax -----------------------------------------------------------
  due("it-return-fy25", "IncomeTax", "Income Tax Return (Corp)", "ITR-6 for company — FY 2025-26", "2026-10-31", "FY 2025-26", "IT Dept",
    { form: "ITR-6", penaltyPerDay: 0, interestRate: 12 }),
  due("it-3ceb-fy25", "IncomeTax", "Form 3CEB — TP Certificate", "CA certificate for Transfer Pricing (if applicable)", "2026-10-31", "FY 2025-26", "IT Dept",
    { form: "3CEB" }),
  due("it-3cd-fy25", "IncomeTax", "Form 3CD — Tax Audit", "Tax audit report (turnover > ₹1 cr)", "2026-09-30", "FY 2025-26", "IT Dept",
    { form: "3CD" }),

  // ---- Professional Tax -----------------------------------------------------
  due("pt-may26", "PT", "Professional Tax", "Karnataka PT remittance — employer", "2026-06-20", "May 2026", "KPTPC",
    { estimatedLiability: 12500, filed: true, filedOn: "2026-06-18" }),
  due("pt-jun26", "PT", "Professional Tax", "Karnataka PT remittance — employer", "2026-07-20", "Jun 2026", "KPTPC",
    { estimatedLiability: 12500 }),
];

export function dueDatesFiltered(category?: ComplianceCategory, includeCompleted = true): DueDate[] {
  let items = COMPLIANCE_CALENDAR;
  if (category) items = items.filter((d) => d.category === category);
  if (!includeCompleted) items = items.filter((d) => !d.filed);
  return items.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
}

export function alertSummary(): { overdue: number; dueToday: number; dueSoon: number; ok: number } {
  const items = COMPLIANCE_CALENDAR.filter((d) => !d.filed);
  return {
    overdue: items.filter((d) => d.alertLevel === "overdue").length,
    dueToday: items.filter((d) => d.alertLevel === "due-today").length,
    dueSoon: items.filter((d) => d.alertLevel === "due-soon").length,
    ok: items.filter((d) => d.alertLevel === "ok").length,
  };
}

export function estimatedPenalty(d: DueDate): number {
  if (!d.penaltyPerDay || d.daysUntilDue >= 0) return 0;
  return Math.abs(d.daysUntilDue) * d.penaltyPerDay;
}
