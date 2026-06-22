// ---------------------------------------------------------------------------
// MCA / ROC Compliance — Companies Act 2013 filing register.
//
// Tracks all ROC filings for the current financial year: AOC-4, MGT-7,
// ADT-1, DIR-3 KYC, DPT-3, MSME-1, INC-20A, MBP-1, etc.
// Also tracks board resolutions (board meeting minutes) and AGM.
// ---------------------------------------------------------------------------

export type McaFilingStatus = "not-due" | "pending" | "prepared" | "filed" | "overdue";

export interface McaFiling {
  id: string;
  form: string;
  description: string;
  trigger: string;             // what triggers this filing
  dueDate: string;
  period: string;
  fee: number;                 // government filing fee (₹)
  additionalFee?: number;      // per-day late fee
  status: McaFilingStatus;
  filedOn?: string;
  srn?: string;                // Service Request Number from MCA21
  remarks?: string;
}

export interface BoardMeeting {
  date: string;
  type: "board" | "agm" | "egm" | "committee";
  agenda: string[];
  quorum: boolean;
  minutes: boolean;
}

export const MCA_FILINGS: McaFiling[] = [
  {
    id: "mca-aoc4",
    form: "AOC-4",
    description: "Financial Statements with Directors' Report",
    trigger: "Within 30 days of AGM (Sec. 137)",
    dueDate: "2026-10-30",
    period: "FY 2025-26",
    fee: 200,
    additionalFee: 100,
    status: "pending",
    remarks: "Requires audited FS, Directors' Report, Audit Report",
  },
  {
    id: "mca-mgt7",
    form: "MGT-7",
    description: "Annual Return of the Company",
    trigger: "Within 60 days of AGM (Sec. 92)",
    dueDate: "2026-11-29",
    period: "FY 2025-26",
    fee: 200,
    additionalFee: 100,
    status: "pending",
    remarks: "Includes shareholding pattern, directors, KMP details",
  },
  {
    id: "mca-adt1",
    form: "ADT-1",
    description: "Appointment/Reappointment of Auditor",
    trigger: "Within 15 days of AGM (Sec. 139)",
    dueDate: "2026-10-15",
    period: "FY 2025-26",
    fee: 300,
    status: "pending",
  },
  {
    id: "mca-dir3kyc",
    form: "DIR-3 KYC",
    description: "Annual KYC of Directors",
    trigger: "31 September each year",
    dueDate: "2026-09-30",
    period: "FY 2025-26",
    fee: 0,
    additionalFee: 5000,
    status: "pending",
    remarks: "Penalty of ₹5,000 after 30 Sep",
  },
  {
    id: "mca-msme1",
    form: "MSME-1",
    description: "Half-yearly return — outstanding dues to MSME suppliers",
    trigger: "31 Oct (Apr–Sep half) and 30 Apr (Oct–Mar half) — Sec. 405",
    dueDate: "2026-10-31",
    period: "Apr–Sep 2026",
    fee: 0,
    status: "pending",
  },
  {
    id: "mca-dpt3",
    form: "DPT-3",
    description: "Return of deposits / particulars of transactions not considered as deposits",
    trigger: "30 June each year (Rule 16 of Companies (Acceptance of Deposits) Rules)",
    dueDate: "2026-06-30",
    period: "FY 2025-26",
    fee: 0,
    status: "prepared",
    remarks: "Being prepared — due in 8 days",
  },
  {
    id: "mca-inc20a",
    form: "INC-20A",
    description: "Declaration of commencement of business (one-time if not filed)",
    trigger: "Within 180 days of incorporation (Sec. 10A)",
    dueDate: "2021-09-30",
    period: "Incorporation",
    fee: 0,
    status: "filed",
    filedOn: "2021-08-15",
    srn: "F12345678",
  },
  {
    id: "mca-chs-1",
    form: "CHS-1",
    description: "Notice of change in registered office",
    trigger: "On any change in registered office",
    dueDate: "2026-04-30",
    period: "Apr 2026",
    fee: 200,
    status: "filed",
    filedOn: "2026-04-28",
    srn: "F98765432",
  },
];

export interface AgmSchedule {
  agmDate?: string;           // once decided
  lastDayForAgm: string;      // 30 Sep (Sec. 96)
  noticeRequired: number;     // clear days (21 days for listed, 15 for others)
  noticeIssuedOn?: string;
  auditReportReady: boolean;
  boardApprovedFs: boolean;
}

export const AGM_SCHEDULE: AgmSchedule = {
  lastDayForAgm: "2026-09-30",
  noticeRequired: 21,
  auditReportReady: false,
  boardApprovedFs: false,
};

export const BOARD_MEETINGS: BoardMeeting[] = [
  {
    date: "2026-04-12",
    type: "board",
    agenda: ["Approval of quarterly results Q4 FY25-26", "Appointment of internal auditor", "Related party transactions"],
    quorum: true,
    minutes: true,
  },
  {
    date: "2026-06-15",
    type: "board",
    agenda: ["Q1 FY26-27 business review", "Advance tax installment approval", "Capital expenditure sanction"],
    quorum: true,
    minutes: false,
  },
  {
    date: "2026-09-25",
    type: "agm",
    agenda: ["Adoption of FS", "Declaration of dividend", "Re-appointment of auditors", "Director retirement by rotation"],
    quorum: false,
    minutes: false,
  },
];

export function mcaFilingsByStatus(): Record<McaFilingStatus, McaFiling[]> {
  const result: Record<McaFilingStatus, McaFiling[]> = {
    "not-due": [], pending: [], prepared: [], filed: [], overdue: [],
  };
  const today = "2026-06-22";
  for (const f of MCA_FILINGS) {
    const st: McaFilingStatus = f.status === "filed"
      ? "filed"
      : f.dueDate < today
        ? "overdue"
        : f.status;
    result[st].push(f);
  }
  return result;
}
