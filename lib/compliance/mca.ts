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

export const MCA_FILINGS: McaFiling[] = [];

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

export const BOARD_MEETINGS: BoardMeeting[] = [];

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
