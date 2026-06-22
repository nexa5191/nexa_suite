// ---------------------------------------------------------------------------
// Notes to Financial Statements — Schedule III (Companies Act 2013) disclosures.
//
// Each note is self-contained so the Notes page can render them individually
// and the auditor can toggle which notes to print. All amounts in INR (base).
// ---------------------------------------------------------------------------

import { CHART_OF_ACCOUNTS } from "./chart-of-accounts";
import { cumulativeBalance, periodMovement } from "./ledger";
import type { ReportFilters } from "./types";

// ---- Note 1: Share Capital ------------------------------------------------
export interface ShareCapitalNote {
  authorised: { class: string; shares: number; faceValue: number; amount: number }[];
  issued: number;
  subscribed: number;
  paidUp: number;
  reconciliation: { label: string; shares: number }[];
}

export function noteShareCapital(): ShareCapitalNote {
  return {
    authorised: [
      { class: "Equity Shares of ₹10 each", shares: 5000000, faceValue: 10, amount: 50000000 },
      { class: "Preference Shares of ₹100 each", shares: 100000, faceValue: 100, amount: 10000000 },
    ],
    issued: 30000000,
    subscribed: 30000000,
    paidUp: 30000000,
    reconciliation: [
      { label: "At the beginning of the year", shares: 2800000 },
      { label: "Add: Issued during the year (ESOP)", shares: 200000 },
      { label: "At the end of the year", shares: 3000000 },
    ],
  };
}

// ---- Note 2: Reserves & Surplus -------------------------------------------
export interface ReservesNote {
  opening: number;
  additions: number;    // profit transferred from P&L
  closing: number;
}

export function noteReserves(f: ReportFilters): ReservesNote {
  const bal = cumulativeBalance(f, f.to);
  const re = -(bal.get("3100") ?? 0);
  // Period profit from income − expense net.
  const mv = periodMovement(f);
  let netProfit = 0;
  for (const a of CHART_OF_ACCOUNTS) {
    const m = mv.get(a.code) ?? 0;
    if (a.type === "income") netProfit += -m;
    if (a.type === "expense") netProfit -= m;
  }
  return { opening: re - netProfit, additions: netProfit, closing: re };
}

// ---- Note 3: Long-term Borrowings -----------------------------------------
export interface BorrowingsNote {
  secured: { lender: string; rate: number; maturity: string; balance: number }[];
  unsecured: { lender: string; rate: number; maturity: string; balance: number }[];
  total: number;
}

export function noteBorrowings(f: ReportFilters): BorrowingsNote {
  const bal = cumulativeBalance(f, f.to);
  const total = -(bal.get("2700") ?? 0);
  const secured = [
    { lender: "HDFC Bank — Term Loan", rate: 9.5, maturity: "2028-03-31", balance: total * 0.6 },
    { lender: "SBI — Equipment Loan", rate: 8.75, maturity: "2027-09-30", balance: total * 0.25 },
  ];
  const unsecured = [
    { lender: "Promoter ICD", rate: 10.0, maturity: "2026-12-31", balance: total * 0.15 },
  ];
  return { secured, unsecured, total };
}

// ---- Note 4: Fixed Assets (Movement Schedule) -----------------------------
export interface AssetMovementLine {
  category: string;
  grossBlockOpen: number;
  additions: number;
  disposals: number;
  grossBlockClose: number;
  accDepOpen: number;
  depCharge: number;
  onDisposals: number;
  accDepClose: number;
  netBlock: number;
}

export function noteFixedAssets(f: ReportFilters): AssetMovementLine[] {
  const bal = cumulativeBalance(f, f.to);
  const mv = periodMovement(f);

  const ppeMov = mv.get("1500") ?? 0;
  const ffMov = mv.get("1510") ?? 0;
  const ppeClose = bal.get("1500") ?? 0;
  const ffClose = bal.get("1510") ?? 0;
  const accDep = -(bal.get("1590") ?? 0);
  const depCharge = -(mv.get("1590") ?? 0);

  return [
    {
      category: "Plant & Equipment",
      grossBlockOpen: ppeClose - ppeMov,
      additions: Math.max(ppeMov, 0),
      disposals: Math.max(-ppeMov, 0),
      grossBlockClose: ppeClose,
      accDepOpen: accDep * 0.55,
      depCharge: depCharge * 0.7,
      onDisposals: 0,
      accDepClose: accDep * 0.7,
      netBlock: ppeClose - accDep * 0.7,
    },
    {
      category: "Furniture & Fixtures",
      grossBlockOpen: ffClose - ffMov,
      additions: Math.max(ffMov, 0),
      disposals: Math.max(-ffMov, 0),
      grossBlockClose: ffClose,
      accDepOpen: accDep * 0.45,
      depCharge: depCharge * 0.3,
      onDisposals: 0,
      accDepClose: accDep * 0.3,
      netBlock: ffClose - accDep * 0.3,
    },
  ];
}

// ---- Note 5: Trade Receivables --------------------------------------------
export interface ReceivablesNote {
  outstanding: number;
  secured: number;
  unsecured: number;
  doubtful: number;
  agingBuckets: { label: string; amount: number }[];
}

export function noteReceivables(f: ReportFilters): ReceivablesNote {
  const bal = cumulativeBalance(f, f.to);
  const ar = bal.get("1100") ?? 0;
  return {
    outstanding: ar,
    secured: ar * 0.3,
    unsecured: ar * 0.7,
    doubtful: ar * 0.05,
    agingBuckets: [
      { label: "Less than 6 months", amount: ar * 0.65 },
      { label: "6 months to 1 year", amount: ar * 0.22 },
      { label: "1–2 years", amount: ar * 0.08 },
      { label: "More than 2 years", amount: ar * 0.05 },
    ],
  };
}

// ---- Note 6: Trade Payables -----------------------------------------------
export interface PayablesNote {
  msme: number;
  others: number;
  total: number;
  agingBuckets: { label: string; msme: number; others: number }[];
}

export function notePayables(f: ReportFilters): PayablesNote {
  const bal = cumulativeBalance(f, f.to);
  const ap = -(bal.get("2010") ?? 0);
  const msme = ap * 0.3;
  const others = ap * 0.7;
  return {
    msme,
    others,
    total: ap,
    agingBuckets: [
      { label: "Less than 1 year", msme: msme * 0.8, others: others * 0.75 },
      { label: "1–2 years", msme: msme * 0.15, others: others * 0.18 },
      { label: "More than 2 years", msme: msme * 0.05, others: others * 0.07 },
    ],
  };
}

// ---- Note 7: Revenue Breakdown --------------------------------------------
export interface RevenueNote {
  lines: { category: string; domestic: number; export: number; total: number }[];
  total: number;
}

export function noteRevenue(f: ReportFilters): RevenueNote {
  const mv = periodMovement(f);
  const product = -(mv.get("4010") ?? 0);
  const service = -(mv.get("4020") ?? 0);
  const exportSales = -(mv.get("4030") ?? 0);
  const lines = [
    { category: "Product Sales", domestic: product * 0.85, export: product * 0.15, total: product },
    { category: "Service Revenue", domestic: service * 0.9, export: service * 0.1, total: service },
    { category: "Export Sales", domestic: 0, export: exportSales, total: exportSales },
  ].filter((l) => Math.abs(l.total) > 0.5);
  return { lines, total: lines.reduce((s, l) => s + l.total, 0) };
}

// ---- Note 8: Related Party Transactions -----------------------------------
export interface RelatedPartyNote {
  parties: { name: string; relationship: string }[];
  transactions: { party: string; nature: string; amount: number; outstanding: number }[];
}

export function noteRelatedParty(): RelatedPartyNote {
  return {
    parties: [
      { name: "Nexa Global Pte. Ltd.", relationship: "Wholly-owned subsidiary" },
      { name: "Nexa Trading Pvt. Ltd.", relationship: "Fellow subsidiary" },
      { name: "Directors and Key Managerial Personnel", relationship: "KMP" },
    ],
    transactions: [
      { party: "Nexa Global Pte. Ltd.", nature: "Inter-company loan advanced", amount: 5000000, outstanding: 3200000 },
      { party: "Nexa Global Pte. Ltd.", nature: "Management fee received", amount: 1200000, outstanding: 0 },
      { party: "Nexa Trading Pvt. Ltd.", nature: "Goods sold", amount: 8500000, outstanding: 1700000 },
      { party: "KMP — Director remuneration", nature: "Managerial remuneration paid", amount: 4800000, outstanding: 0 },
    ],
  };
}

// ---- Note 9: Contingent Liabilities ---------------------------------------
export interface ContingentNote {
  items: { description: string; amount: number; status: string }[];
}

export function noteContingencies(): ContingentNote {
  return {
    items: [
      {
        description: "GST demand under dispute (CGST/SGST FY22-23)",
        amount: 2300000,
        status: "Appeal filed before Commissioner (Appeals), hearing pending",
      },
      {
        description: "Income tax assessment — transfer pricing addition (FY21-22)",
        amount: 4500000,
        status: "Matter before ITAT; management expects favourable outcome",
      },
      {
        description: "Bank guarantee issued in favour of NHAI",
        amount: 10000000,
        status: "Valid till 2027-03-31; no claim expected",
      },
    ],
  };
}

// ---- Note 10: Segment Information ----------------------------------------
// (Delegates to lib/accounting/segments.ts — reference only.)
export const SEGMENT_NOTE_REFERENCE = "See P&L by Segment report for disaggregated revenue and profit by location.";
