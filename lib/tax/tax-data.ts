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
import { VENDORS } from "@/lib/vendors";
import {
  classify,
  splitTax,
  natureOf,
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
  desc: string;
  hsn: string;
  kind: TaxKind;
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  gross: number;
  // 194J withheld by registered customers on our fees
  tdsReceivable: number;
}

export interface InwardRow {
  id: string;
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
  msme: boolean;
  nature: TaxNature;
  desc: string;
  hsn: string;
  kind: TaxKind;
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  tax: number;
  gross: number;
  itcEligible: boolean;
  rcm: boolean; // reverse charge — recipient pays GST in cash, then claims ITC
  tdsSection: string;
  tdsRate: number;
  tds: number;
  netPayable: number;
}

// ---- enrichment pools ------------------------------------------------------
// Domestic customer states for B2B inter-state spread.
const POS_POOL = ["29", "27", "07", "33", "36", "24", "09", "06"];

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
  const supplierState = loc?.stateCode ?? "29";
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

  const nature = natureOf(supplierState, placeOfSupply);
  const cls = classify(ev.memo);
  const split = splitTax(ev.amount, rate, nature);

  // Registered B2B domestic customers withhold 194J @10% on the taxable value.
  const tdsReceivable = b2b && customerGstin ? tdsAmount(ev.amount, 10) : 0;

  return {
    id: ev.id,
    date: ev.accrualDate,
    period: monthKeyOf(ev.accrualDate),
    fy: fyOf(ev.accrualDate),
    entityId: ev.entityId,
    locationId: ev.locationId,
    supplierState,
    supplierGstin: entityGstin(ev.entityId),
    customerName,
    customerGstin,
    placeOfSupply,
    supplyType: customerGstin ? "B2B" : "B2C",
    nature,
    desc: ev.memo,
    hsn: cls.code,
    kind: cls.kind,
    rate,
    taxable: split.taxable,
    cgst: split.cgst,
    sgst: split.sgst,
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
  const vendor = VENDORS[Math.floor(rnd() * VENDORS.length)];
  const supplierState = stateCodeFromGstin(vendor.gstin);
  const nature = natureOf(supplierState, recipientState);
  const cls = classify(ev.memo);
  const split = splitTax(ev.amount, rate, nature);

  // Reverse charge for goods-transport / freight inward.
  const rcm = cls.code === "996511" || /freight|transport|logistic/i.test(ev.memo);

  const acct = ev.incomeOrExpenseAccount;
  const tdsCfg = TDS_BY_ACCOUNT[acct] ?? { section: "194C", rate: 2 };
  const tds = tdsAmount(ev.amount, tdsCfg.rate);

  // A few bills are flagged ITC-ineligible (blocked credits, sec.17(5)).
  const itcEligible = !rcm ? rnd() > 0.08 : true;

  return {
    id: ev.id,
    date: ev.accrualDate,
    period: monthKeyOf(ev.accrualDate),
    fy: fyOf(ev.accrualDate),
    entityId: ev.entityId,
    locationId: ev.locationId,
    vendorId: vendor.id,
    vendorName: vendor.name,
    vendorGstin: vendor.gstin,
    vendorPan: panFromGstin(vendor.gstin),
    supplierState,
    msme: vendor.msme,
    nature,
    desc: ev.memo,
    hsn: cls.code,
    kind: cls.kind,
    rate,
    taxable: split.taxable,
    cgst: split.cgst,
    sgst: split.sgst,
    igst: split.igst,
    tax: split.tax,
    gross: split.gross,
    itcEligible,
    rcm,
    tdsSection: tdsCfg.section,
    tdsRate: tdsCfg.rate,
    tds,
    netPayable: Math.round((split.gross - tds) * 100) / 100,
  };
}

// ---- memoised datasets -----------------------------------------------------
let _out: OutwardRow[] | null = null;
let _in: InwardRow[] | null = null;

export function outwardRows(): OutwardRow[] {
  if (_out) return _out;
  _out = BUSINESS_EVENTS.filter((e) => e.kind === "sale").map(buildOutward);
  return _out;
}

export function inwardRows(): InwardRow[] {
  if (_in) return _in;
  // Goods/service purchases only — exclude payroll (sec.192, no GST/TDS here).
  _in = BUSINESS_EVENTS.filter(
    (e) => e.kind === "purchase" && e.incomeOrExpenseAccount !== "6010" && e.contraAccount !== "2300",
  ).map(buildInward);
  return _in;
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
  igst: number;
  tax: number;
}

export function sumHeads(rows: Array<OutwardRow | InwardRow>): HeadTotals {
  return rows.reduce(
    (a, r) => ({
      taxable: a.taxable + r.taxable,
      cgst: a.cgst + r.cgst,
      sgst: a.sgst + r.sgst,
      igst: a.igst + r.igst,
      tax: a.tax + r.tax,
    }),
    { taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 },
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
  igst: number;
  tax: number;
}

export function hsnSummary(rows: Array<OutwardRow | InwardRow>): HsnGroup[] {
  const map = new Map<string, HsnGroup>();
  for (const r of rows) {
    const key = `${r.hsn}-${r.rate}`;
    const g =
      map.get(key) ??
      ({ code: r.hsn, kind: r.kind, desc: classify(r.desc).desc, rate: r.rate, lines: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0, tax: 0 } as HsnGroup);
    g.lines += 1;
    g.taxable += r.taxable;
    g.cgst += r.cgst;
    g.sgst += r.sgst;
    g.igst += r.igst;
    g.tax += r.tax;
    map.set(key, g);
  }
  return Array.from(map.values()).sort((a, b) => b.taxable - a.taxable);
}
