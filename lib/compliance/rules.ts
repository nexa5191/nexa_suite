// ---------------------------------------------------------------------------
// Compliance rule engine — the statutory rates & rules NEXA applies, delivered
// as DATA that updates from a regulatory feed, not as a software release. This
// is the "always compliant" promise: when a rate or threshold changes, the
// config updates and every calculation follows, with full version history.
//
// Values are indicative for FY 2025-26 (AY 2026-27) and illustrate the model;
// they are seed data, deterministic and offline.
// ---------------------------------------------------------------------------

export const RULE_SYNC = {
  lastSynced: "2026-06-18T06:00:00",
  nextCheck: "2026-06-19T06:00:00",
  source: "NEXA Regulatory Feed · CBIC + CBDT + MCA",
  version: "2026.06.2",
};

// ---- GST rate schedule -----------------------------------------------------

export interface GstRate {
  rate: number;
  label: string;
  examples: string;
  effectiveFrom: string;
}

export const GST_RATES: GstRate[] = [
  { rate: 0, label: "Nil / exempt", examples: "Fresh produce, milk, unbranded food grains, education, health", effectiveFrom: "2017-07-01" },
  { rate: 5, label: "Merit rate", examples: "Packaged food, raw materials, transport, restaurants (no ITC)", effectiveFrom: "2017-07-01" },
  { rate: 12, label: "Standard-lower", examples: "Processed food, business-class air, contract work", effectiveFrom: "2017-07-01" },
  { rate: 18, label: "Standard", examples: "Most goods & services — opex, professional fees, machinery", effectiveFrom: "2017-07-01" },
  { rate: 28, label: "Demerit / luxury", examples: "Aerated drinks, tobacco, automobiles (plus cess)", effectiveFrom: "2017-07-01" },
];

// ---- TDS sections ----------------------------------------------------------

export interface TdsRule {
  section: string;
  nature: string;
  rate: string; // e.g. "1% / 2%"
  threshold: string; // annual / single
  effectiveFrom: string;
  note?: string;
}

export const TDS_RULES: TdsRule[] = [
  { section: "194C", nature: "Payment to contractors", rate: "1% / 2%", threshold: "₹30,000 single · ₹1,00,000 p.a.", effectiveFrom: "2025-04-01" },
  { section: "194J", nature: "Professional / technical fees", rate: "10% / 2%", threshold: "₹50,000 p.a.", effectiveFrom: "2025-04-01", note: "Threshold raised from ₹30,000 (FY25-26)" },
  { section: "194I", nature: "Rent — land/building · plant", rate: "10% / 2%", threshold: "₹6,00,000 p.a.", effectiveFrom: "2025-04-01", note: "Threshold raised from ₹2,40,000 (FY25-26)" },
  { section: "194H", nature: "Commission / brokerage", rate: "2%", threshold: "₹20,000 p.a.", effectiveFrom: "2024-10-01", note: "Rate cut from 5% → 2%" },
  { section: "194Q", nature: "Purchase of goods", rate: "0.1%", threshold: "₹50,00,000 p.a.", effectiveFrom: "2021-07-01" },
  { section: "194T", nature: "Partner's remuneration / interest", rate: "10%", threshold: "₹20,000 p.a.", effectiveFrom: "2025-04-01", note: "New section — Finance Act 2025" },
  { section: "194A", nature: "Interest other than securities", rate: "10%", threshold: "₹50,000 (senior) · ₹40,000", effectiveFrom: "2025-04-01" },
];

// ---- Standalone statutory rules --------------------------------------------

export interface StatutoryRule {
  key: string;
  title: string;
  body: string;
  citation: string;
  effectiveFrom: string;
}

export const STATUTORY_RULES: StatutoryRule[] = [
  {
    key: "msme-43bh",
    title: "MSME 45-day payment (s.43B(h))",
    body: "Dues to registered Micro & Small enterprises must be paid within 45 days (or the agreed term, max 45). Amounts unpaid at year-end are disallowed for income-tax until actually paid.",
    citation: "Income-tax Act s.43B(h) · MSMED Act s.15",
    effectiveFrom: "2024-04-01",
  },
  {
    key: "einvoice",
    title: "e-Invoicing threshold",
    body: "B2B e-invoices (IRN + signed QR) are mandatory for taxpayers with aggregate turnover above ₹5 crore. Invoices must be reported to the IRP within 30 days for ₹10 crore+ taxpayers.",
    citation: "CGST Notification 10/2023 · NIC advisory",
    effectiveFrom: "2023-08-01",
  },
  {
    key: "gstr2b-itc",
    title: "ITC only on GSTR-2B-reflected invoices",
    body: "Input tax credit can be claimed only where the supplier has filed and the invoice appears in your GSTR-2B (s.16(2)(aa)). Reconcile every period before filing GSTR-3B.",
    citation: "CGST Act s.16(2)(aa) · Rule 36(4)",
    effectiveFrom: "2022-01-01",
  },
];

// ---- Update feed -----------------------------------------------------------

export type ChangeKind = "gst" | "tds" | "msme" | "einvoice";
export type ChangeStatus = "applied" | "upcoming";

export interface RuleChange {
  date: string; // effective date
  kind: ChangeKind;
  title: string;
  detail: string;
  status: ChangeStatus;
}

export const RULE_CHANGES: RuleChange[] = [
  { date: "2025-04-01", kind: "tds", title: "New TDS section 194T", detail: "TDS @10% on partner's salary, remuneration, commission & interest above ₹20,000 p.a.", status: "applied" },
  { date: "2025-04-01", kind: "tds", title: "194I & 194J thresholds raised", detail: "Rent (194I) threshold ₹2.4L → ₹6L p.a.; professional fees (194J) ₹30k → ₹50k p.a.", status: "applied" },
  { date: "2024-10-01", kind: "tds", title: "194H commission rate cut", detail: "TDS on commission/brokerage reduced from 5% to 2%.", status: "applied" },
  { date: "2024-04-01", kind: "msme", title: "s.43B(h) MSME disallowance live", detail: "First full year — dues to micro/small vendors unpaid beyond 45 days are disallowed at year-end.", status: "applied" },
  { date: "2024-04-01", kind: "einvoice", title: "RCM self-invoice mandatory", detail: "Recipients must raise a self-invoice for RCM supplies from unregistered vendors.", status: "applied" },
  { date: "2026-09-22", kind: "gst", title: "GST rate rationalisation (tracked)", detail: "Council proposal to merge 12% & 28% slabs is being tracked; NEXA will apply on notification.", status: "upcoming" },
];

export const CHANGE_KIND_META: Record<ChangeKind, { label: string; tone: "primary" | "warning" | "danger" | "success" }> = {
  gst: { label: "GST", tone: "primary" },
  tds: { label: "TDS", tone: "warning" },
  msme: { label: "MSME", tone: "danger" },
  einvoice: { label: "e-Invoice", tone: "success" },
};
