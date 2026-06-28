// ---------------------------------------------------------------------------
// NEXA tax dataset — derives line-level GST/TDS rows from the SAME business
// events that drive the P&L / Balance Sheet (lib/accounting/events.ts). Because
// the returns are built from the books, GSTR-3B and the books-vs-return recon
// tie back exactly; the only gap is what hasn't been filed yet.
//
// Enrichment (vendor, customer, HSN, place-of-supply, TDS section) is assigned
// deterministically from the event id, so server and client agree and the data
// never shifts between renders.
// ---------------------------------------------------------------------------

import { BUSINESS_EVENTS, gstRateFor } from "@/lib/accounting/events";
import type { BusinessEvent } from "@/lib/accounting/types";
import { locationById, entityById } from "@/lib/accounting/org";
import { ACCOUNTS } from "@/lib/crm";
import { TAX_VENDOR_POOL, ldcRateFor, allPOs, loadAddedPOs, VENDORS, type MsmeClass, type PurchaseOrder } from "@/lib/vendors";
import { loadCreatedInvoices, type Invoice, type InvoiceLine } from "@/lib/invoicing";
import {
  classify,
  splitTax,
  natureOf,
  isUnionTerritory,
  monthKeyOf,
  fyOf,
  panFromGstin,
  stateCodeFromGstin,
  tdsAmount,
  type TaxNature,
  type TaxKind,
} from "./gst";

// ---- deterministic per-event RNG -------------------------------------------
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function rngFor(seed: string) {
  let a = hash(seed);
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- row types -------------------------------------------------------------
export interface OutwardRow {
  id: string;
  invoiceNo: string; // tax-invoice number
  date: string;
  period: string; // YYYY-MM
  fy: string;
  entityId: string;
  locationId: string;
  supplierState: string;
  supplierGstin: string;
  customerName: string;
  customerGstin: string; // "" → B2C
  placeOfSupply: string; // state code
  supplyType: "B2B" | "B2C";
  nature: TaxNature;
  ut: boolean; // intra-UT supply → CGST + UTGST
  desc: string;
  hsn: string;
  kind: TaxKind;
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  utgst: number;
  igst: number;
  tax: number;
  gross: number;
  // 194J withheld by registered customers on our fees
  tdsReceivable: number;
}

export interface InwardRow {
  id: string;
  invoiceNo: string; // vendor bill / tax-invoice number
  date: string;
  period: string;
  fy: string;
  entityId: string;
  locationId: string;
  vendorId: string;
  vendorName: string;
  vendorGstin: string;
  vendorPan: string;
  supplierState: string;
  recipientState: string;
  msme: boolean;
  msmeClass?: MsmeClass;
  nature: TaxNature;
  ut: boolean; // intra-UT supply → CGST + UTGST
  desc: string;
  hsn: string;
  kind: TaxKind;
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  utgst: number;
  igst: number;
  tax: number;
  gross: number;
  itcEligible: boolean;
  rcm: boolean; // reverse charge — recipient pays GST in cash, then claims ITC
  tdsSection: string;
  tdsBaseRate: number; // statutory section rate
  tdsRate: number; // effective rate (lower if an LDC applies)
  ldc: boolean; // a sec.197 lower-deduction certificate was applied
  ldcCertNo?: string;
  tds: number;
  netPayable: number;
}

// ---- enrichment pools ------------------------------------------------------
// Domestic customer states for B2B inter-state spread.
const POS_POOL = ["29", "27", "07", "33", "36", "24", "09", "06"];

// Union-Territory places of supply (no legislature → CGST + UTGST). A small,
// deterministic slice of intra-state supplies is re-cast as intra-UT so the
// UTGST column is exercised in the registers; only the CGST/SGST→CGST/UTGST
// classification changes — taxable value and total tax are untouched.
const UT_POS = ["04", "26", "35", "38"];

/** A short, stable tax-invoice / bill number derived from the event. */
function docNumber(memo: string, fallbackId: string, prefix: string, fy: string): string {
  const m = memo.match(/\b(?:INV|BILL)-\d{6}-\d+\b/);
  if (m) return m[0];
  const seq = (fallbackId.match(/\d+/)?.[0] ?? "0").padStart(4, "0").slice(-4);
  return `${prefix}/${fy.replace("-", "")}/${seq}`;
}

/** Re-stamp a GSTIN onto a different state code (keeps PAN + suffix intact). */
function regstin(gstin: string, stateCode: string): string {
  return gstin.length >= 2 ? stateCode + gstin.slice(2) : gstin;
}

// Vendor TDS section by the expense account hit.
const TDS_BY_ACCOUNT: Record<string, { section: string; rate: number }> = {
  "5010": { section: "194Q", rate: 0.1 }, // COGS — purchase of goods
  "5020": { section: "194C", rate: 2 }, // freight inward — contractor
  "6020": { section: "194I", rate: 10 }, // rent
  "6040": { section: "194C", rate: 2 }, // marketing
  "6050": { section: "194J", rate: 10 }, // professional fees
  "6060": { section: "194J", rate: 2 }, // software (technical) — 2%
  "6070": { section: "194C", rate: 2 }, // travel/conveyance
};

function entityGstin(entityId: string): string {
  return entityById(entityId)?.gstin ?? "";
}

// ---- builders --------------------------------------------------------------
function buildOutward(ev: BusinessEvent): OutwardRow {
  const rnd = rngFor("out-" + ev.id);
  const loc = locationById(ev.locationId);
  let supplierState = loc?.stateCode ?? "29";
  const rate = Math.round(gstRateFor(ev) * 100); // 0 or 18
  const isExport = rate === 0;

  // B2B (registered customer) ~58%, else B2C counter sale.
  const b2b = !isExport && rnd() < 0.58;
  let customerName: string;
  let customerGstin = "";
  let placeOfSupply = supplierState;

  if (isExport) {
    customerName = "Asia Pacific Foods (Export)";
    placeOfSupply = "SG";
  } else if (b2b) {
    // ~60% intra-state, else pick an out-of-state buyer.
    const intra = rnd() < 0.6;
    const pool = ACCOUNTS.filter((a) =>
      a.stateCode !== "SG" && (intra ? a.stateCode === supplierState : a.stateCode !== supplierState),
    );
    const acc = (pool.length ? pool : ACCOUNTS.filter((a) => a.stateCode !== "SG"))[
      Math.floor(rnd() * (pool.length || 1))
    ];
    customerName = acc?.name ?? "Registered customer";
    customerGstin = acc?.gstin && acc.gstin !== "—" ? acc.gstin : "";
    placeOfSupply = acc?.stateCode ?? supplierState;
  } else {
    customerName = "Counter / unregistered sale";
    placeOfSupply = supplierState;
  }

  let supplierGstin = entityGstin(ev.entityId);

  // Deterministically re-cast ~9% of intra-state supplies as intra-UT supplies
  // (supplier + place of supply both in a UT) so the UTGST head is exercised.
  let nature = natureOf(supplierState, placeOfSupply);
  if (!isExport && nature === "intra" && rnd() < 0.09) {
    const ut = UT_POS[Math.floor(rnd() * UT_POS.length)];
    supplierState = ut;
    placeOfSupply = ut;
    supplierGstin = regstin(supplierGstin, ut);
    if (customerGstin) customerGstin = regstin(customerGstin, ut);
    nature = natureOf(supplierState, placeOfSupply);
  }
  const isUT = isUnionTerritory(placeOfSupply) && nature === "intra";

  const cls = classify(ev.memo);
  const split = splitTax(ev.amount, rate, nature, isUT);

  // Registered B2B domestic customers withhold 194J @10% on the taxable value.
  const tdsReceivable = b2b && customerGstin ? tdsAmount(ev.amount, 10) : 0;

  return {
    id: ev.id,
    invoiceNo: docNumber(ev.memo, ev.id, "INV", fyOf(ev.accrualDate)),
    date: ev.accrualDate,
    period: monthKeyOf(ev.accrualDate),
    fy: fyOf(ev.accrualDate),
    entityId: ev.entityId,
    locationId: ev.locationId,
    supplierState,
    supplierGstin,
    customerName,
    customerGstin,
    placeOfSupply,
    supplyType: customerGstin ? "B2B" : "B2C",
    nature,
    ut: isUT,
    desc: ev.memo,
    hsn: cls.code,
    kind: cls.kind,
    rate,
    taxable: split.taxable,
    cgst: split.cgst,
    sgst: split.sgst,
    utgst: split.utgst,
    igst: split.igst,
    tax: split.tax,
    gross: split.gross,
    tdsReceivable,
  };
}

function buildInward(ev: BusinessEvent): InwardRow {
  const rnd = rngFor("in-" + ev.id);
  const loc = locationById(ev.locationId);
  const recipientState = loc?.stateCode ?? "29";
  const rate = Math.round(gstRateFor(ev) * 100); // 0 (global) or 18

  // Assign a vendor deterministically; vendor GSTIN gives the supplier state.
  const vendor = TAX_VENDOR_POOL[Math.floor(rnd() * TAX_VENDOR_POOL.length)];
  let supplierState = stateCodeFromGstin(vendor.gstin);
  let vendorGstin = vendor.gstin;
  let recipientStateFinal = recipientState;

  // Deterministically re-cast ~9% of intra-state purchases as intra-UT.
  let nature = natureOf(supplierState, recipientStateFinal);
  if (nature === "intra" && rnd() < 0.09) {
    const ut = UT_POS[Math.floor(rnd() * UT_POS.length)];
    supplierState = ut;
    recipientStateFinal = ut;
    vendorGstin = regstin(vendor.gstin, ut);
    nature = natureOf(supplierState, recipientStateFinal);
  }
  const isUT = isUnionTerritory(recipientStateFinal) && nature === "intra";

  const cls = classify(ev.memo);
  const split = splitTax(ev.amount, rate, nature, isUT);

  // Reverse charge for goods-transport / freight inward.
  const rcm = cls.code === "996511" || /freight|transport|logistic/i.test(ev.memo);

  const acct = ev.incomeOrExpenseAccount;
  const tdsCfg = TDS_BY_ACCOUNT[acct] ?? { section: "194C", rate: 2 };
  // Apply a sec.197 lower-deduction certificate if the vendor holds a valid one.
  const ldc = ldcRateFor(vendor, tdsCfg.section, ev.accrualDate);
  const effRate = ldc ? ldc.rate : tdsCfg.rate;
  const tds = tdsAmount(ev.amount, effRate);

  // A few bills are flagged ITC-ineligible (blocked credits, sec.17(5)).
  const itcEligible = !rcm ? rnd() > 0.08 : true;

  return {
    id: ev.id,
    invoiceNo: docNumber(ev.memo, ev.id, "BILL", fyOf(ev.accrualDate)),
    date: ev.accrualDate,
    period: monthKeyOf(ev.accrualDate),
    fy: fyOf(ev.accrualDate),
    entityId: ev.entityId,
    locationId: ev.locationId,
    vendorId: vendor.id,
    vendorName: vendor.name,
    vendorGstin,
    vendorPan: panFromGstin(vendor.gstin),
    supplierState,
    recipientState: recipientStateFinal,
    msme: vendor.msme,
    msmeClass: vendor.msmeClass,
    nature,
    ut: isUT,
    desc: ev.memo,
    hsn: cls.code,
    kind: cls.kind,
    rate,
    taxable: split.taxable,
    cgst: split.cgst,
    sgst: split.sgst,
    utgst: split.utgst,
    igst: split.igst,
    tax: split.tax,
    gross: split.gross,
    itcEligible,
    rcm,
    tdsSection: tdsCfg.section,
    tdsBaseRate: tdsCfg.rate,
    tdsRate: effRate,
    ldc: !!ldc,
    ldcCertNo: ldc?.certNo,
    tds,
    netPayable: Math.round((split.gross - tds) * 100) / 100,
  };
}

// ---- invoice → outward row builders ----------------------------------------

/** GST rate by vendor procurement category (used for inward PO rows). */
const CATEG_GST: Record<string, number> = {
  "Raw Materials": 5, "Packaging": 12, "Logistics": 5,
  "IT & Software": 18, "Marketing": 18, "Services": 18,
  "Capital Equipment": 18, "Office Equipment": 18, "Employee Claims": 0,
};
const CATEG_TDS: Record<string, { section: string; rate: number }> = {
  "Raw Materials": { section: "194Q", rate: 0.1 }, "Packaging": { section: "194Q", rate: 0.1 },
  "Logistics": { section: "194C", rate: 2 }, "IT & Software": { section: "194J", rate: 2 },
  "Marketing": { section: "194C", rate: 2 }, "Services": { section: "194J", rate: 10 },
  "Capital Equipment": { section: "194C", rate: 2 }, "Office Equipment": { section: "194J", rate: 2 },
  "Employee Claims": { section: "192", rate: 0 },
};
const CATEG_HSN: Record<string, string> = {
  "Raw Materials": "1006", "Packaging": "3923", "Logistics": "996511",
  "IT & Software": "998314", "Marketing": "998321", "Services": "9983",
  "Capital Equipment": "8479", "Office Equipment": "8471", "Employee Claims": "—",
};

function outwardFromLine(
  inv: Invoice, line: InvoiceLine, idx: number, discFrac: number,
): OutwardRow {
  const entity = entityById(inv.entityId);
  const supplierGstin = entity?.gstin ?? "";
  const supplierState = supplierGstin.length >= 2 ? supplierGstin.slice(0, 2) : "29";

  const acc = ACCOUNTS.find((a) => a.id === inv.accountId);
  const customerName = inv.billTo?.name ?? acc?.name ?? "Customer";
  const rawGstin = (inv.billTo?.gstin ?? acc?.gstin ?? "").replace(/^[—]$/, "");
  const customerGstin = rawGstin.length === 15 ? rawGstin : "";
  const placeOfSupply = acc?.stateCode ?? (customerGstin.length >= 2 ? customerGstin.slice(0, 2) : supplierState);

  const isExport = placeOfSupply === "SG" || supplierState === "SG";
  const gstRate = isExport ? 0 : line.gstRate;
  const nature: TaxNature = isExport ? "export" : natureOf(supplierState, placeOfSupply);
  const isUT = !isExport && isUnionTerritory(placeOfSupply) && nature === "intra";

  const lineBase = line.qty * line.rate * discFrac;
  const split = splitTax(lineBase, gstRate, nature, isUT);

  return {
    id: `${inv.id}-l${idx}`,
    invoiceNo: inv.number,
    date: inv.date,
    period: monthKeyOf(inv.date),
    fy: fyOf(inv.date),
    entityId: inv.entityId,
    locationId: "",
    supplierState,
    supplierGstin,
    customerName,
    customerGstin,
    placeOfSupply,
    supplyType: customerGstin ? "B2B" : "B2C",
    nature,
    ut: isUT,
    desc: line.desc,
    hsn: line.hsn,
    kind: classify(line.desc).kind,
    rate: gstRate,
    taxable: split.taxable,
    cgst: split.cgst,
    sgst: split.sgst,
    utgst: split.utgst,
    igst: split.igst,
    tax: split.tax,
    gross: split.gross,
    tdsReceivable: 0,
  };
}

function buildAllOutward(): OutwardRow[] {
  const rows: OutwardRow[] = [];
  for (const inv of loadCreatedInvoices()) {
    if (inv.status === "draft") continue;
    const subtotal = inv.lines.reduce((s, l) => s + l.qty * l.rate, 0);
    const discAmt =
      inv.discountType === "amount"
        ? Math.min(inv.discountValue ?? 0, subtotal)
        : inv.discountType === "percent"
        ? (subtotal * (inv.discountValue ?? 0)) / 100
        : 0;
    const discFrac = subtotal > 0 ? 1 - discAmt / subtotal : 1;
    inv.lines.forEach((line, i) => rows.push(outwardFromLine(inv, line, i, discFrac)));
  }
  return rows;
}

function inwardFromPO(po: PurchaseOrder): InwardRow {
  const rnd = rngFor("po-" + po.id);
  const vendor = VENDORS.find((v) => v.id === po.vendorId);

  const vendorGstin = vendor?.gstin && vendor.gstin !== "—" ? vendor.gstin : "29AACCM9861R1ZF";
  const vendorPan = panFromGstin(vendorGstin);
  const supplierState = vendorGstin.length >= 2 ? vendorGstin.slice(0, 2) : "29";

  const entity = entityById(po.entityId);
  const recipientGstin = entity?.gstin ?? "";
  const recipientState = recipientGstin.length >= 2 ? recipientGstin.slice(0, 2) : "29";

  const nature = natureOf(supplierState, recipientState);
  const isUT = isUnionTerritory(recipientState) && nature === "intra";

  const category = vendor?.category ?? "Services";
  const gstRate = CATEG_GST[category] ?? 18;
  const tdsCfg = CATEG_TDS[category] ?? { section: "194J", rate: 10 };
  const split = splitTax(po.total, gstRate, nature, isUT);

  const ldc = ldcRateFor(vendor, tdsCfg.section, po.date);
  const effRate = ldc ? ldc.rate : tdsCfg.rate;
  const tds = tdsAmount(po.total, effRate);

  const itcEligible = category !== "Employee Claims" && gstRate > 0;
  const rcm = category === "Logistics" && rnd() < 0.3;
  const date = po.invoice?.date ?? po.date;

  return {
    id: po.id,
    invoiceNo: po.invoice?.number ?? `BILL-${po.id}`,
    date,
    period: monthKeyOf(date),
    fy: fyOf(date),
    entityId: po.entityId,
    locationId: po.locationId,
    vendorId: po.vendorId,
    vendorName: vendor?.name ?? "Vendor",
    vendorGstin,
    vendorPan,
    supplierState,
    recipientState,
    msme: vendor?.msme ?? false,
    msmeClass: vendor?.msmeClass,
    nature,
    ut: isUT,
    desc: po.title,
    hsn: CATEG_HSN[category] ?? "9983",
    kind: classify(po.title).kind,
    rate: gstRate,
    taxable: split.taxable,
    cgst: split.cgst,
    sgst: split.sgst,
    utgst: split.utgst,
    igst: split.igst,
    tax: split.tax,
    gross: split.gross,
    itcEligible,
    rcm,
    tdsSection: tdsCfg.section,
    tdsBaseRate: tdsCfg.rate,
    tdsRate: effRate,
    ldc: !!ldc,
    ldcCertNo: ldc?.certNo,
    tds,
    netPayable: Math.round((split.gross - tds) * 100) / 100,
  };
}

function buildAllInward(): InwardRow[] {
  return allPOs(loadAddedPOs())
    .filter((po) => !!po.vendorId)
    .map(inwardFromPO);
}

// ---- memoised datasets -----------------------------------------------------
let _out: OutwardRow[] | null = null;
let _in: InwardRow[] | null = null;

export function outwardRows(): OutwardRow[] {
  if (typeof window === "undefined") return [];
  if (_out) return _out;
  _out = buildAllOutward();
  return _out;
}

export function inwardRows(): InwardRow[] {
  if (typeof window === "undefined") return [];
  if (_in) return _in;
  _in = buildAllInward();
  return _in;
}

/** Call after localStorage data changes (e.g. new invoices posted). */
export function invalidateTaxCache(): void {
  _out = null;
  _in = null;
}

// ---- scoping & period filters ----------------------------------------------
export interface TaxScope {
  entityId: string; // "all" | entity id
}

export function inRange<T extends { date: string }>(rows: T[], from: string, to: string): T[] {
  return rows.filter((r) => r.date >= from && r.date <= to);
}

export function scopeRows<T extends { entityId: string }>(rows: T[], scope: TaxScope): T[] {
  if (scope.entityId === "all") return rows;
  return rows.filter((r) => r.entityId === scope.entityId);
}

// All return periods present in the data (newest first), as month keys.
export function availablePeriods(): string[] {
  const set = new Set<string>();
  for (const r of outwardRows()) set.add(r.period);
  for (const r of inwardRows()) set.add(r.period);
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

export function availableFYs(): string[] {
  const set = new Set<string>();
  for (const r of outwardRows()) set.add(r.fy);
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}

// ---- aggregates ------------------------------------------------------------
export interface HeadTotals {
  taxable: number;
  cgst: number;
  sgst: number;
  utgst: number;
  igst: number;
  tax: number;
}

export function sumHeads(rows: Array<OutwardRow | InwardRow>): HeadTotals {
  return rows.reduce(
    (a, r) => ({
      taxable: a.taxable + r.taxable,
      cgst: a.cgst + r.cgst,
      sgst: a.sgst + r.sgst,
      utgst: a.utgst + r.utgst,
      igst: a.igst + r.igst,
      tax: a.tax + r.tax,
    }),
    { taxable: 0, cgst: 0, sgst: 0, utgst: 0, igst: 0, tax: 0 },
  );
}

export interface HsnGroup {
  code: string;
  kind: TaxKind;
  desc: string;
  rate: number;
  lines: number;
  taxable: number;
  cgst: number;
  sgst: number;
  utgst: number;
  igst: number;
  tax: number;
}

export function hsnSummary(rows: Array<OutwardRow | InwardRow>): HsnGroup[] {
  const map = new Map<string, HsnGroup>();
  for (const r of rows) {
    const key = `${r.hsn}-${r.rate}`;
    const g =
      map.get(key) ??
      ({ code: r.hsn, kind: r.kind, desc: classify(r.desc).desc, rate: r.rate, lines: 0, taxable: 0, cgst: 0, sgst: 0, utgst: 0, igst: 0, tax: 0 } as HsnGroup);
    g.lines += 1;
    g.taxable += r.taxable;
    g.cgst += r.cgst;
    g.sgst += r.sgst;
    g.utgst += r.utgst;
    g.igst += r.igst;
    g.tax += r.tax;
    map.set(key, g);
  }
  return Array.from(map.values()).sort((a, b) => b.taxable - a.taxable);
}
