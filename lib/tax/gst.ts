// ---------------------------------------------------------------------------
// NEXA GST & TDS engine — the pure, deterministic tax maths.
//
// No I/O, no React. Everything here is a stateless function or constant so it
// renders identically on server and client. State-of-supply logic mirrors the
// invoicing module (intra → CGST+SGST, inter → IGST, overseas → zero-rated).
// ---------------------------------------------------------------------------

// ---- GST rate slabs --------------------------------------------------------
export const GST_RATES = [0, 5, 12, 18, 28];

// ---- State codes -----------------------------------------------------------
// Superset of the org's own state codes plus the customer places-of-supply the
// tax dataset fans out to. "SG" marks an overseas / export place of supply.
export const STATE_NAMES: Record<string, string> = {
  "07": "Delhi",
  "06": "Haryana",
  "09": "Uttar Pradesh",
  "19": "West Bengal",
  "24": "Gujarat",
  "27": "Maharashtra",
  "29": "Karnataka",
  "32": "Kerala",
  "33": "Tamil Nadu",
  "36": "Telangana",
  // Union Territories that levy UTGST (no legislature of their own).
  "04": "Chandigarh",
  "26": "Dadra & Nagar Haveli and Daman & Diu",
  "35": "Andaman & Nicobar Islands",
  "38": "Ladakh",
  SG: "Overseas (Export)",
};

export function stateName(code: string): string {
  return STATE_NAMES[code] ?? code;
}

// Union Territories WITHOUT a legislature — an intra-UT supply attracts CGST +
// UTGST (not SGST). Delhi (07), Puducherry (34) and J&K (01) have legislatures
// and levy SGST, so they are deliberately excluded here.
export const UT_CODES = new Set(["04", "26", "31", "35", "38", "97"]);

export function isUnionTerritory(code: string): boolean {
  return UT_CODES.has(code);
}

export type TaxNature = "intra" | "inter" | "export";

/** Classify a supply from supplier-state vs place-of-supply. */
export function natureOf(supplierState: string, placeOfSupply: string): TaxNature {
  if (supplierState === "SG" || placeOfSupply === "SG") return "export";
  return supplierState === placeOfSupply ? "intra" : "inter";
}

// ---- Tax split -------------------------------------------------------------
export interface GstSplit {
  taxable: number;
  cgst: number;
  sgst: number;
  utgst: number;
  igst: number;
  tax: number;
  gross: number;
  rate: number;
  nature: TaxNature;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Split a taxable base at a rate into the right heads for the supply nature:
 *   intra-state          → CGST + SGST
 *   intra Union Territory → CGST + UTGST   (pass isUT = true)
 *   inter-state          → IGST
 *   export               → zero-rated
 * The state-half lands in UTGST instead of SGST when the place of supply is a
 * Union Territory without a legislature.
 */
export function splitTax(taxable: number, rate: number, nature: TaxNature, isUT = false): GstSplit {
  const tax = nature === "export" ? 0 : r2((taxable * rate) / 100);
  const cgst = nature === "intra" ? r2(tax / 2) : 0;
  const stateHalf = nature === "intra" ? r2(tax - cgst) : 0;
  const sgst = isUT ? 0 : stateHalf;
  const utgst = isUT ? stateHalf : 0;
  const igst = nature === "inter" ? tax : 0;
  return { taxable: r2(taxable), cgst, sgst, utgst, igst, tax: cgst + sgst + utgst + igst, gross: r2(taxable + tax), rate, nature };
}

// ---- Return-period maths (Indian FY, Apr–Mar) ------------------------------
/** "2026-06-04" → "2026-06" */
export function monthKeyOf(iso: string): string {
  return iso.slice(0, 7);
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** "2026-06" → "Jun 2026" */
export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
}

/** "2026-06-04" → "2025-26" (the FY it falls in). */
export function fyOf(iso: string): string {
  const y = parseInt(iso.slice(0, 4), 10);
  const m = parseInt(iso.slice(5, 7), 10);
  const start = m >= 4 ? y : y - 1;
  return `${start}-${String(start + 1).slice(2)}`;
}

export function fyRange(fy: string): { from: string; to: string } {
  const start = parseInt(fy.slice(0, 4), 10);
  return { from: `${start}-04-01`, to: `${start + 1}-03-31` };
}

// A period selector value: "all" | "fy:2025-26" | "m:2026-05"
export type PeriodValue = string;

export function periodRange(value: PeriodValue): { from: string; to: string } {
  if (value.startsWith("fy:")) return fyRange(value.slice(3));
  if (value.startsWith("m:")) {
    const key = value.slice(2);
    const [y, m] = key.split("-").map((x) => parseInt(x, 10));
    const last = new Date(y, m, 0).getDate();
    return { from: `${key}-01`, to: `${key}-${String(last).padStart(2, "0")}` };
  }
  return { from: "0000-00-00", to: "9999-99-99" };
}

/** A single-month period value if one is selected, else null. */
export function selectedMonth(value: PeriodValue): string | null {
  return value.startsWith("m:") ? value.slice(2) : null;
}

// ---- GSTR-3B set-off (statutory order, sec. 49 / Rule 88A) -----------------
export interface HeadAmounts {
  igst: number;
  cgst: number;
  sgst: number;
}

export const ZERO_HEADS: HeadAmounts = { igst: 0, cgst: 0, sgst: 0 };

export interface SetOff {
  liability: HeadAmounts; // output tax payable
  credit: HeadAmounts; // ITC available
  creditUsed: HeadAmounts; // ITC utilised against liability
  cashPayable: HeadAmounts; // remaining liability paid in cash
  creditLeft: HeadAmounts; // ITC carried forward
}

/**
 * Utilise ITC against output liability in the statutory order:
 *   IGST credit → IGST, then CGST, then SGST
 *   CGST credit → CGST, then IGST
 *   SGST credit → SGST, then IGST
 */
export function computeSetOff(liability: HeadAmounts, credit: HeadAmounts): SetOff {
  const liab = { ...liability };
  const cr = { ...credit };
  const used: HeadAmounts = { igst: 0, cgst: 0, sgst: 0 };

  const draw = (creditHead: keyof HeadAmounts, liabHead: keyof HeadAmounts) => {
    const amt = Math.min(cr[creditHead], liab[liabHead]);
    if (amt <= 0) return;
    cr[creditHead] = r2(cr[creditHead] - amt);
    liab[liabHead] = r2(liab[liabHead] - amt);
    used[liabHead] = r2(used[liabHead] + amt);
  };

  // IGST credit first (own head, then cross)
  draw("igst", "igst");
  draw("igst", "cgst");
  draw("igst", "sgst");
  // CGST credit
  draw("cgst", "cgst");
  draw("cgst", "igst");
  // SGST credit
  draw("sgst", "sgst");
  draw("sgst", "igst");

  return {
    liability,
    credit,
    creditUsed: used,
    cashPayable: { igst: liab.igst, cgst: liab.cgst, sgst: liab.sgst },
    creditLeft: { igst: cr.igst, cgst: cr.cgst, sgst: cr.sgst },
  };
}

export const headTotal = (h: HeadAmounts) => r2(h.igst + h.cgst + h.sgst);

// ---- GSTR-3B due date, late fee & interest --------------------------------
export interface LateCharges {
  daysLate: number;
  dueDate: string;
  lateFeeCgst: number;
  lateFeeSgst: number;
  lateFee: number;
  interest: number; // 18% p.a. on cash tax
  total: number;
}

/** Due 20th of the month following the tax period. */
export function gstr3bDueDate(monthKey: string): string {
  const [y, m] = monthKey.split("-").map((x) => parseInt(x, 10));
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${String(nm).padStart(2, "0")}-20`;
}

const daysBetween = (a: string, b: string) =>
  Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000);

/** Late fee (₹50/day, cap ₹5,000, split CGST/SGST) + 18% p.a. interest on cash tax. */
export function gstr3bLateCharges(monthKey: string, cashTax: number, today: string): LateCharges {
  const dueDate = gstr3bDueDate(monthKey);
  const daysLate = Math.max(0, daysBetween(dueDate, today));
  const fee = Math.min(daysLate * 50, 5000);
  const lateFeeCgst = r2(fee / 2);
  const lateFeeSgst = r2(fee - lateFeeCgst);
  const interest = r2((cashTax * 0.18 * daysLate) / 365);
  return {
    daysLate,
    dueDate,
    lateFeeCgst,
    lateFeeSgst,
    lateFee: fee,
    interest,
    total: r2(fee + interest),
  };
}

// ---- TDS sections (deducted at source on vendor payments) ------------------
export interface TdsSection {
  code: string;
  label: string;
  rate: number; // default %
}

export const TDS_SECTIONS: TdsSection[] = [
  { code: "194C", label: "194C — Contractor / job work", rate: 2 },
  { code: "194J", label: "194J — Professional / technical fees", rate: 10 },
  { code: "194Q", label: "194Q — Purchase of goods (> ₹50L)", rate: 0.1 },
  { code: "194I", label: "194I — Rent of plant / building", rate: 2 },
  { code: "194H", label: "194H — Commission / brokerage", rate: 5 },
];

export function tdsSection(code: string): TdsSection | undefined {
  return TDS_SECTIONS.find((s) => s.code === code);
}

export function tdsAmount(base: number, rate: number): number {
  return r2((base * rate) / 100);
}

// 194J professional fee withholding our B2B customers apply on our invoices.
export const TDS_RECEIVABLE_RATE = 10;
export const TDS_RECEIVABLE_SECTION = "194J";

// ---- HSN / SAC classification for the food business ------------------------
export type TaxKind = "HSN" | "SAC";

export interface GoodsClass {
  code: string;
  kind: TaxKind;
  rate: number;
  desc: string;
}

const GOODS_RULES: Array<[RegExp, GoodsClass]> = [
  [/atta|wheat flour|maida|semolina|durum/i, { code: "1101", kind: "HSN", rate: 5, desc: "Wheat flour / atta" }],
  [/rice|basmati/i, { code: "1006", kind: "HSN", rate: 5, desc: "Rice" }],
  [/olive oil/i, { code: "1509", kind: "HSN", rate: 12, desc: "Olive oil" }],
  [/oil|ghee/i, { code: "1512", kind: "HSN", rate: 5, desc: "Edible oil" }],
  [/spice|masala|turmeric|chilli/i, { code: "0910", kind: "HSN", rate: 5, desc: "Spices" }],
  [/sugar|jaggery/i, { code: "1701", kind: "HSN", rate: 5, desc: "Sugar" }],
  [/biscuit|snack|namkeen|confection/i, { code: "1905", kind: "HSN", rate: 18, desc: "Bakery / snacks" }],
  [/beverage|juice|drink|soda/i, { code: "2202", kind: "HSN", rate: 28, desc: "Beverages" }],
  [/carton|label|packaging|wrap|tape|box/i, { code: "4819", kind: "HSN", rate: 18, desc: "Packaging material" }],
  [/freight|transport|logistic|ftl/i, { code: "996511", kind: "SAC", rate: 18, desc: "Goods transport (GTA)" }],
  [/erp|software|subscription|saas|license|it /i, { code: "997331", kind: "SAC", rate: 18, desc: "Software / IT services" }],
  [/consult|professional|audit|legal|advisor/i, { code: "998311", kind: "SAC", rate: 18, desc: "Professional services" }],
  [/rent/i, { code: "997212", kind: "SAC", rate: 18, desc: "Rental / leasing" }],
  [/market|advertis|campaign|brand|media/i, { code: "998361", kind: "SAC", rate: 18, desc: "Advertising services" }],
];

const DEFAULT_GOODS: GoodsClass = { code: "2106", kind: "HSN", rate: 18, desc: "Food preparations n.e.s." };

export function classify(desc: string): GoodsClass {
  for (const [re, cls] of GOODS_RULES) if (re.test(desc)) return cls;
  return DEFAULT_GOODS;
}

// ---- GSTIN helpers ---------------------------------------------------------
export function panFromGstin(gstin: string): string {
  return gstin.length >= 12 ? gstin.slice(2, 12) : "—";
}
export function stateCodeFromGstin(gstin: string): string {
  return gstin.slice(0, 2);
}
