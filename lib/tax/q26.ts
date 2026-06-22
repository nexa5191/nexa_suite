// ---------------------------------------------------------------------------
// Form 26Q — Quarterly TDS Return (non-salary payments, Sec. 192A onward)
//
// 26Q covers TDS on: professional/technical fees (194J), rent (194I),
// contractor payments (194C), commission (194H), interest (194A), etc.
// 24Q covers salary TDS — handled separately in lib/hr/statutory.ts.
//
// Filing deadlines (quarterly):
//   Q1 (Apr–Jun): 31 Jul    Q2 (Jul–Sep): 31 Oct
//   Q3 (Oct–Dec): 31 Jan    Q4 (Jan–Mar): 31 May
//
// Late filing fee u/s 234E: ₹200/day until return filed (max = tax deducted).
// ---------------------------------------------------------------------------

export interface Q26Deductee {
  id: string;
  period: string;            // YYYY-MM
  quarter: string;           // Q1/Q2/Q3/Q4 YYYY-YY
  section: string;           // 194A / 194C / 194H / 194I / 194J etc.
  sectionLabel: string;
  deducteeName: string;
  deducteePan: string;
  paymentDate: string;
  amountPaid: number;
  tdsRate: number;           // %
  tdsDeducted: number;
  tdsDeposited: number;
  challanNo?: string;
  challanDate?: string;
  remark?: string;
}

export interface Q26Return {
  quarter: string;
  fy: string;
  tan: string;
  entityName: string;
  totalDeductees: number;
  totalAmountPaid: number;
  totalTdsDeducted: number;
  totalTdsDeposited: number;
  dueDate: string;
  filedOn?: string;
  filed: boolean;
  lateFeeDays: number;
  lateFee: number;
}

// Section reference table.
const SECTIONS: Record<string, string> = {
  "194A": "Interest (other than on securities)",
  "194C": "Payments to contractors/sub-contractors",
  "194H": "Commission or brokerage",
  "194I": "Rent",
  "194J": "Professional/technical fees, royalty",
  "194Q": "Purchase of goods (sec.194Q)",
};

// Deterministic seed transactions.
let _idCounter = 0;
function makeQ26Id() { return `q26-${String(++_idCounter).padStart(4, "0")}`; }

function q26Row(
  period: string,
  quarter: string,
  section: string,
  name: string,
  pan: string,
  payDate: string,
  paid: number,
  rate: number,
  filed: boolean,
): Q26Deductee {
  const tds = Math.round((paid * rate) / 100);
  return {
    id: makeQ26Id(),
    period,
    quarter,
    section,
    sectionLabel: SECTIONS[section] ?? section,
    deducteeName: name,
    deducteePan: pan,
    paymentDate: payDate,
    amountPaid: paid,
    tdsRate: rate,
    tdsDeducted: tds,
    tdsDeposited: filed ? tds : 0,
    challanNo: filed ? `NSDL${payDate.replace(/-/g, "")}${Math.abs(_idCounter * 997) % 99999}` : undefined,
    challanDate: filed ? payDate : undefined,
  };
}

export const Q26_DEDUCTEES: Q26Deductee[] = [
  // Q4 FY2025-26 (filed)
  q26Row("2026-01", "Q4 2025-26", "194J", "Deloitte & Touche LLP", "AABCD1234E", "2026-01-15", 1800000, 10, true),
  q26Row("2026-01", "Q4 2025-26", "194I", "Prestige Rentals Pvt Ltd", "BPRRE5678F", "2026-01-31", 500000, 10, true),
  q26Row("2026-02", "Q4 2025-26", "194C", "Ravi Transport Co.", "CRTCO9012G", "2026-02-10", 350000, 2, true),
  q26Row("2026-02", "Q4 2025-26", "194H", "Apex Insurance Brokers", "DAIBR3456H", "2026-02-20", 125000, 5, true),
  q26Row("2026-03", "Q4 2025-26", "194J", "McKinsey & Co.", "EMCKI7890I", "2026-03-05", 2500000, 10, true),
  q26Row("2026-03", "Q4 2025-26", "194I", "Prestige Rentals Pvt Ltd", "BPRRE5678F", "2026-03-31", 500000, 10, true),

  // Q1 FY2026-27 (Apr–Jun — open, not yet filed)
  q26Row("2026-04", "Q1 2026-27", "194J", "Deloitte & Touche LLP", "AABCD1234E", "2026-04-15", 1800000, 10, false),
  q26Row("2026-04", "Q1 2026-27", "194I", "Prestige Rentals Pvt Ltd", "BPRRE5678F", "2026-04-30", 500000, 10, false),
  q26Row("2026-05", "Q1 2026-27", "194C", "Ravi Transport Co.", "CRTCO9012G", "2026-05-08", 420000, 2, false),
  q26Row("2026-05", "Q1 2026-27", "194Q", "Steel Scrap Traders", "FSSCT2345J", "2026-05-20", 6500000, 0.1, false),
  q26Row("2026-06", "Q1 2026-27", "194J", "KPMG Advisory Svc", "GKPMG6789K", "2026-06-10", 3200000, 10, false),
  q26Row("2026-06", "Q1 2026-27", "194I", "Prestige Rentals Pvt Ltd", "BPRRE5678F", "2026-06-30", 500000, 10, false),
];

function quarterOf(period: string): string {
  const [, m] = period.split("-").map(Number);
  if (m >= 4 && m <= 6) return "Q1";
  if (m >= 7 && m <= 9) return "Q2";
  if (m >= 10 && m <= 12) return "Q3";
  return "Q4";
}

export function q26Returns(): Q26Return[] {
  const quartersMap = new Map<string, Q26Return>();

  for (const d of Q26_DEDUCTEES) {
    const key = d.quarter;
    if (!quartersMap.has(key)) {
      const [qLabel, fyLabel] = key.split(" ");
      const isFiled = d.tdsDeposited > 0 && key.includes("2025-26");
      const dueDates: Record<string, string> = {
        "Q4 2025-26": "2026-05-31",
        "Q1 2026-27": "2026-07-31",
        "Q2 2026-27": "2026-10-31",
        "Q3 2026-27": "2027-01-31",
      };
      const dueDate = dueDates[key] ?? "2026-12-31";
      const filedOn = isFiled ? "2026-05-25" : undefined;
      const today = "2026-06-22";
      const lateDays = !filedOn && dueDate < today ? Math.floor((new Date(today).getTime() - new Date(dueDate).getTime()) / 86400000) : 0;

      quartersMap.set(key, {
        quarter: key,
        fy: fyLabel ?? "2026-27",
        tan: "BLRN12345A",
        entityName: "Nexa Foods Pvt. Ltd.",
        totalDeductees: 0,
        totalAmountPaid: 0,
        totalTdsDeducted: 0,
        totalTdsDeposited: 0,
        dueDate,
        filedOn,
        filed: isFiled,
        lateFeeDays: lateDays,
        lateFee: Math.min(lateDays * 200, d.tdsDeducted),
      });
    }
    const ret = quartersMap.get(key)!;
    ret.totalDeductees += 1;
    ret.totalAmountPaid += d.amountPaid;
    ret.totalTdsDeducted += d.tdsDeducted;
    ret.totalTdsDeposited += d.tdsDeposited;
  }

  return Array.from(quartersMap.values()).sort((a, b) => a.quarter.localeCompare(b.quarter));
}
