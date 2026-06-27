// ---------------------------------------------------------------------------
// Transfer Pricing — Form 3CEB / Chapter X (Income Tax Act 1961)
//
// Every Indian company with international transactions or specified domestic
// transactions above the threshold must obtain a CA certificate in Form 3CEB.
// NEXA tracks covered transactions, chosen ALP method, documentation status,
// and flags potential TP adjustments.
//
// ALP methods (Rule 10B): CUP, RPM, CPM, TNMM, PS (Profit Split)
// Threshold (AY2026-27): International TXN > ₹1 crore; SDT > ₹20 crore.
// ---------------------------------------------------------------------------

export type AlpMethod = "CUP" | "RPM" | "CPM" | "TNMM" | "PS";
export type TxnCategory = "sale-of-goods" | "purchase-of-goods" | "service-receipt" | "service-provision" | "loan" | "guarantee" | "royalty" | "management-fee";

export interface TpTransaction {
  id: string;
  relatedParty: string;
  country: string;
  txnCategory: TxnCategory;
  description: string;
  value: number;           // INR
  alpMethod: AlpMethod;
  benchmarkMargin?: number; // ALP margin % from comparable search
  actualMargin?: number;    // margin the company earned/paid
  adjustment: number;       // potential TP adjustment (if |actual − benchmark| > 3%)
  documented: boolean;
  localFileSection?: string; // section reference in local file
  masterFile: boolean;       // whether covered under Master File (>₹500 cr group)
}

export const TP_TRANSACTIONS: TpTransaction[] = [];

export interface TpSummary {
  totalTransactions: number;
  totalValue: number;
  internationalCount: number;
  internationalValue: number;
  sdtCount: number;
  sdtValue: number;
  totalAdjustment: number;
  undocumented: number;
  form3cebRequired: boolean;
  masterFileRequired: boolean;
}

export function tpSummary(): TpSummary {
  const intl = TP_TRANSACTIONS.filter((t) => t.country !== "IND");
  const sdt = TP_TRANSACTIONS.filter((t) => t.country === "IND");
  const total = TP_TRANSACTIONS;
  return {
    totalTransactions: total.length,
    totalValue: total.reduce((s, t) => s + t.value, 0),
    internationalCount: intl.length,
    internationalValue: intl.reduce((s, t) => s + t.value, 0),
    sdtCount: sdt.length,
    sdtValue: sdt.reduce((s, t) => s + t.value, 0),
    totalAdjustment: total.reduce((s, t) => s + t.adjustment, 0),
    undocumented: total.filter((t) => !t.documented).length,
    form3cebRequired: intl.reduce((s, t) => s + t.value, 0) > 10000000, // >₹1 crore
    masterFileRequired: false,  // group revenue < ₹500 cr
  };
}

export const ALP_LABELS: Record<AlpMethod, string> = {
  CUP: "Comparable Uncontrolled Price",
  RPM: "Resale Price Method",
  CPM: "Cost Plus Method",
  TNMM: "Transactional Net Margin Method",
  PS: "Profit Split",
};

export const CATEGORY_LABELS: Record<TxnCategory, string> = {
  "sale-of-goods": "Sale of Goods",
  "purchase-of-goods": "Purchase of Goods",
  "service-receipt": "Receipt of Services",
  "service-provision": "Provision of Services",
  loan: "Loan / ICD",
  guarantee: "Guarantee / Counter-guarantee",
  royalty: "Royalty / License Fee",
  "management-fee": "Management Fee",
};
