// ---------------------------------------------------------------------------
// NEXA GST registers — the statutory Sales (outward) and Purchase (inward)
// registers, built off the SAME tax dataset that feeds GSTR-1 / GSTR-3B
// (lib/tax/tax-data.ts). Three lenses over the same rows:
//
//   1. Invoice-wise        — one line per tax invoice, every head split out.
//   2. Tax-rate-wise       — invoices grouped (collapsible) by GST rate %.
//   3. HSN/SAC-wise        — grouped by HSN/SAC code & rate (GSTR-1 Table 12).
//
// Each register also maps to the filing it lands in — the Sales register to the
// OUTPUT liability filed on GSTR-1, the Purchase register to the INPUT credit
// claimed on GSTR-3B — so the "claimed vs pending" position is visible.
// ---------------------------------------------------------------------------

import type { OutwardRow, InwardRow } from "./tax-data";
import { stateName, type TaxNature } from "./gst";
import { filingState, type FilingStore, type FilingStatus, type ItcStore } from "./compliance";

const r2 = (n: number) => Math.round(n * 100) / 100;

export type RegisterKind = "sales" | "purchase";

/** One tax invoice in a register, with every GST head split out. */
export interface RegisterRow {
  id: string;
  invoiceNo: string;
  date: string;
  period: string; // YYYY-MM
  partyName: string; // customer (sales) / vendor (purchase)
  gstin: string; // counterparty GSTIN ("" → unregistered)
  placeLabel: string; // place of supply (sales) / supplier state (purchase)
  nature: TaxNature;
  ut: boolean;
  hsn: string;
  rate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  utgst: number;
  igst: number;
  totalGst: number;
  total: number; // invoice value incl. tax
  // mapping back to the return it is reported in
  filed: boolean; // sits in a filed (locked) GSTR-1 / GSTR-3B period
  // purchase-only ITC position
  itcEligible?: boolean;
  itcClaimed?: boolean;
}

/** Totals across a set of register rows. */
export interface RegisterTotals {
  count: number;
  taxable: number;
  cgst: number;
  sgst: number;
  utgst: number;
  igst: number;
  totalGst: number;
  total: number;
}

export function registerTotals(rows: RegisterRow[]): RegisterTotals {
  const t: RegisterTotals = { count: rows.length, taxable: 0, cgst: 0, sgst: 0, utgst: 0, igst: 0, totalGst: 0, total: 0 };
  for (const r of rows) {
    t.taxable += r.taxable;
    t.cgst += r.cgst;
    t.sgst += r.sgst;
    t.utgst += r.utgst;
    t.igst += r.igst;
    t.totalGst += r.totalGst;
    t.total += r.total;
  }
  for (const k of ["taxable", "cgst", "sgst", "utgst", "igst", "totalGst", "total"] as const) t[k] = r2(t[k]);
  return t;
}

// ---- builders --------------------------------------------------------------

export function salesRegister(rows: OutwardRow[], filings: FilingStore): RegisterRow[] {
  return rows.map((r) => ({
    id: r.id,
    invoiceNo: r.invoiceNo,
    date: r.date,
    period: r.period,
    partyName: r.customerName,
    gstin: r.customerGstin,
    placeLabel: stateName(r.placeOfSupply),
    nature: r.nature,
    ut: r.ut,
    hsn: r.hsn,
    rate: r.rate,
    taxable: r.taxable,
    cgst: r.cgst,
    sgst: r.sgst,
    utgst: r.utgst,
    igst: r.igst,
    totalGst: r2(r.cgst + r.sgst + r.utgst + r.igst),
    total: r.gross,
    filed: filingState(filings, "gstr1", r.period).status === "filed",
  }));
}

export function purchaseRegister(rows: InwardRow[], filings: FilingStore, itc: ItcStore): RegisterRow[] {
  return rows.map((r) => ({
    id: r.id,
    invoiceNo: r.invoiceNo,
    date: r.date,
    period: r.period,
    partyName: r.vendorName,
    gstin: r.vendorGstin,
    placeLabel: stateName(r.supplierState),
    nature: r.nature,
    ut: r.ut,
    hsn: r.hsn,
    rate: r.rate,
    taxable: r.taxable,
    cgst: r.cgst,
    sgst: r.sgst,
    utgst: r.utgst,
    igst: r.igst,
    totalGst: r2(r.cgst + r.sgst + r.utgst + r.igst),
    total: r.gross,
    filed: filingState(filings, "gstr3b", r.period).status === "filed",
    itcEligible: r.itcEligible && !r.rcm,
    itcClaimed: !!itc[r.id]?.claimed,
  }));
}

// ---- view 2: grouped by tax rate (collapsible) -----------------------------

export interface RateGroup {
  rate: number;
  rows: RegisterRow[];
  totals: RegisterTotals;
}

export function groupByRate(rows: RegisterRow[]): RateGroup[] {
  const map = new Map<number, RegisterRow[]>();
  for (const r of rows) {
    const list = map.get(r.rate) ?? [];
    list.push(r);
    map.set(r.rate, list);
  }
  return Array.from(map.entries())
    .sort((a, b) => b[0] - a[0])
    .map(([rate, list]) => ({ rate, rows: list, totals: registerTotals(list) }));
}

// ---- input / output filing-claim mapping -----------------------------------
// Sales register → OUTPUT tax filed on GSTR-1.
// Purchase register → INPUT tax credit claimed via GSTR-3B.

export interface ClaimMapRow {
  period: string; // YYYY-MM
  count: number;
  taxable: number;
  cgst: number;
  sgst: number;
  utgst: number;
  igst: number;
  totalGst: number;
  status: FilingStatus; // gstr1 (sales) / gstr3b (purchase) filing status
  // amount of tax already accounted for (filed output / claimed ITC) vs pending
  accounted: number;
  pending: number;
}

function blankClaim(period: string, status: FilingStatus): ClaimMapRow {
  return { period, count: 0, taxable: 0, cgst: 0, sgst: 0, utgst: 0, igst: 0, totalGst: 0, status, accounted: 0, pending: 0 };
}

/** Per-period output-liability map: tax filed on GSTR-1 vs still to be filed. */
export function outputClaimMap(rows: OutwardRow[], filings: FilingStore): ClaimMapRow[] {
  const map = new Map<string, ClaimMapRow>();
  for (const r of rows) {
    const status = filingState(filings, "gstr1", r.period).status;
    const m = map.get(r.period) ?? blankClaim(r.period, status);
    const tax = r2(r.cgst + r.sgst + r.utgst + r.igst);
    m.count += 1;
    m.taxable = r2(m.taxable + r.taxable);
    m.cgst = r2(m.cgst + r.cgst);
    m.sgst = r2(m.sgst + r.sgst);
    m.utgst = r2(m.utgst + r.utgst);
    m.igst = r2(m.igst + r.igst);
    m.totalGst = r2(m.totalGst + tax);
    if (status === "filed") m.accounted = r2(m.accounted + tax);
    else m.pending = r2(m.pending + tax);
    map.set(r.period, m);
  }
  return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
}

/** Per-period input-credit map: ITC claimed vs eligible-but-unclaimed. */
export function inputClaimMap(rows: InwardRow[], filings: FilingStore, itc: ItcStore): ClaimMapRow[] {
  const map = new Map<string, ClaimMapRow>();
  for (const r of rows) {
    if (r.rcm || !r.itcEligible) continue; // only normal eligible ITC
    const status = filingState(filings, "gstr3b", r.period).status;
    const m = map.get(r.period) ?? blankClaim(r.period, status);
    const tax = r2(r.cgst + r.sgst + r.utgst + r.igst);
    m.count += 1;
    m.taxable = r2(m.taxable + r.taxable);
    m.cgst = r2(m.cgst + r.cgst);
    m.sgst = r2(m.sgst + r.sgst);
    m.utgst = r2(m.utgst + r.utgst);
    m.igst = r2(m.igst + r.igst);
    m.totalGst = r2(m.totalGst + tax);
    if (itc[r.id]?.claimed) m.accounted = r2(m.accounted + tax);
    else m.pending = r2(m.pending + tax);
    map.set(r.period, m);
  }
  return Array.from(map.values()).sort((a, b) => b.period.localeCompare(a.period));
}
