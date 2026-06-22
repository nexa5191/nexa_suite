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

export const TP_TRANSACTIONS: TpTransaction[] = [
  {
    id: "tp-001",
    relatedParty: "Nexa Global Pte. Ltd. (Singapore)",
    country: "SGP",
    txnCategory: "management-fee",
    description: "Group management services charge",
    value: 12000000,
    alpMethod: "TNMM",
    benchmarkMargin: 12.5,
    actualMargin: 11.8,
    adjustment: 0,          // within tolerance
    documented: true,
    localFileSection: "Section 4.2",
    masterFile: false,
  },
  {
    id: "tp-002",
    relatedParty: "Nexa Global Pte. Ltd. (Singapore)",
    country: "SGP",
    txnCategory: "royalty",
    description: "Brand royalty on net sales",
    value: 8500000,
    alpMethod: "CUP",
    benchmarkMargin: 2.0,
    actualMargin: 2.8,
    adjustment: Math.round(8500000 * (2.8 - 2.0) / 100), // over-payment
    documented: true,
    localFileSection: "Section 5.1",
    masterFile: false,
  },
  {
    id: "tp-003",
    relatedParty: "Nexa Trading Pvt. Ltd. (India — SDT)",
    country: "IND",
    txnCategory: "sale-of-goods",
    description: "Goods sold to fellow subsidiary at transfer price",
    value: 85000000,  // SDT — above ₹20 cr threshold
    alpMethod: "TNMM",
    benchmarkMargin: 8.0,
    actualMargin: 7.2,
    adjustment: Math.round(85000000 * (8.0 - 7.2) / 100),
    documented: true,
    localFileSection: "Section 3.1",
    masterFile: false,
  },
  {
    id: "tp-004",
    relatedParty: "Nexa Global Pte. Ltd. (Singapore)",
    country: "SGP",
    txnCategory: "loan",
    description: "Inter-company loan advanced @ 8% p.a.",
    value: 50000000,
    alpMethod: "CUP",
    benchmarkMargin: 9.5,  // LIBOR/SOFR + spread benchmark
    actualMargin: 8.0,
    adjustment: Math.round(50000000 * (9.5 - 8.0) / 100),
    documented: false,      // documentation gap — flagged
    masterFile: false,
  },
];

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
