// ---------------------------------------------------------------------------
// NEXA return builders — turn the raw tax rows + compliance state into the
// figures shown on GSTR-3B, GSTR-9, the books-vs-return recon and the
// electronic credit ledger.
// ---------------------------------------------------------------------------

import {
  outwardRows,
  inwardRows,
  inRange,
  scopeRows,
  sumHeads,
  availablePeriods,
  type OutwardRow,
  type InwardRow,
  type TaxScope,
} from "./tax-data";
import {
  computeSetOff,
  headTotal,
  periodRange,
  monthKeyOf,
  type HeadAmounts,
  type SetOff,
} from "./gst";
import { filingState, type FilingStore } from "./compliance";

const r2 = (n: number) => Math.round(n * 100) / 100;

function heads(rows: Array<OutwardRow | InwardRow>): HeadAmounts {
  const s = sumHeads(rows);
  // UTGST is the Union-Territory equivalent of SGST and sets off identically,
  // so it is reported in the state (SGST/UTGST) head of GSTR-3B.
  return { igst: r2(s.igst), cgst: r2(s.cgst), sgst: r2(s.sgst + s.utgst) };
}
const addHeads = (a: HeadAmounts, b: HeadAmounts): HeadAmounts => ({
  igst: r2(a.igst + b.igst),
  cgst: r2(a.cgst + b.cgst),
  sgst: r2(a.sgst + b.sgst),
});

// ---- GSTR-3B (single month) ------------------------------------------------
export interface Gstr3b {
  period: string;
  outward: OutwardRow[];
  inward: InwardRow[];
  taxableOutward: number;
  exemptOutward: number;
  outputTax: HeadAmounts; // 3.1(a)
  rcmTax: HeadAmounts; // 3.1(d) — paid in cash, also added to ITC
  liability: HeadAmounts; // output + rcm
  itcAvailable: HeadAmounts; // eligible ITC incl. RCM
  setoff: SetOff;
  netCash: number;
}

export function gstr3bFor(scope: TaxScope, month: string, itcHeld: (id: string) => boolean): Gstr3b {
  const { from, to } = periodRange("m:" + month);
  const outward = scopeRows(inRange(outwardRows(), from, to), scope);
  const inward = scopeRows(inRange(inwardRows(), from, to), scope);

  const taxableOutward = r2(outward.filter((r) => r.rate > 0).reduce((s, r) => s + r.taxable, 0));
  const exemptOutward = r2(outward.filter((r) => r.rate === 0).reduce((s, r) => s + r.taxable, 0));

  const outputTax = heads(outward);
  const rcmRows = inward.filter((r) => r.rcm);
  const rcmTax = heads(rcmRows);

  // Eligible ITC: not RCM-self + eligible + not held, plus the RCM credit.
  const itcRows = inward.filter((r) => !r.rcm && r.itcEligible && !itcHeld(r.id));
  const itcAvailable = addHeads(heads(itcRows), rcmTax);

  const liability = addHeads(outputTax, rcmTax);
  const setoff = computeSetOff(liability, itcAvailable);
  // RCM cash is always paid in cash (can't be set off against itself).
  const netCash = r2(headTotal(setoff.cashPayable) + headTotal(rcmTax));

  return {
    period: month,
    outward,
    inward,
    taxableOutward,
    exemptOutward,
    outputTax,
    rcmTax,
    liability,
    itcAvailable,
    setoff,
    netCash,
  };
}

// ---- GSTR-9 (annual consolidation) -----------------------------------------
export interface Gstr9Row {
  label: string;
  taxable: number;
  igst: number;
  cgst: number;
  sgst: number;
}

export function gstr9For(scope: TaxScope, fy: string): {
  rows: Gstr9Row[];
  outputTax: number;
  itc: number;
  net: number;
} {
  const { from, to } = periodRange("fy:" + fy);
  const outward = scopeRows(inRange(outwardRows(), from, to), scope);
  const inward = scopeRows(inRange(inwardRows(), from, to), scope);

  const byRate = (rate: number) => {
    const rs = outward.filter((r) => r.rate === rate);
    const h = sumHeads(rs);
    return { label: `Outward @ ${rate}%`, taxable: r2(h.taxable), igst: r2(h.igst), cgst: r2(h.cgst), sgst: r2(h.sgst + h.utgst) };
  };

  const exempt = outward.filter((r) => r.rate === 0);
  const exemptH = sumHeads(exempt);
  const itcH = sumHeads(inward.filter((r) => r.itcEligible));
  const outH = sumHeads(outward);

  const rows: Gstr9Row[] = [
    byRate(18),
    byRate(5),
    byRate(12),
    { label: "Exempt / zero-rated", taxable: r2(exemptH.taxable), igst: 0, cgst: 0, sgst: 0 },
    { label: "Total ITC availed", taxable: r2(itcH.taxable), igst: r2(itcH.igst), cgst: r2(itcH.cgst), sgst: r2(itcH.sgst + itcH.utgst) },
  ];

  const outputTax = r2(outH.tax);
  const itc = r2(itcH.tax);
  return { rows, outputTax, itc, net: r2(outputTax - itc) };
}

// ---- Books vs Return reconciliation ----------------------------------------
export interface ReconLine {
  label: string;
  books: number;
  ret: number; // reported in a filed return
  gap: number;
}

export function reconFor(scope: TaxScope, from: string, to: string, filings: FilingStore): ReconLine[] {
  const outward = scopeRows(inRange(outwardRows(), from, to), scope);
  const inward = scopeRows(inRange(inwardRows(), from, to), scope);

  const filedOut = outward.filter((r) => filingState(filings, "gstr1", r.period).status === "filed");
  const filedItc = inward.filter((r) => filingState(filings, "gstr3b", r.period).status === "filed" && r.itcEligible);

  const bOut = sumHeads(outward);
  const rOut = sumHeads(filedOut);
  const bItc = sumHeads(inward.filter((r) => r.itcEligible));
  const rItc = sumHeads(filedItc);

  const line = (label: string, b: number, r: number): ReconLine => ({ label, books: r2(b), ret: r2(r), gap: r2(b - r) });

  return [
    line("Outward taxable value", bOut.taxable, rOut.taxable),
    line("Output tax (GSTR-1 / books)", bOut.tax, rOut.tax),
    line("Inward taxable (ITC base)", bItc.taxable, rItc.taxable),
    line("Input tax credit (GSTR-3B / books)", bItc.tax, rItc.tax),
  ];
}

// ---- Electronic credit ledger (derived from filed periods) -----------------
export interface CreditEntry {
  date: string;
  kind: "accrual" | "utilisation";
  ref: string;
  igst: number;
  cgst: number;
  sgst: number; // signed: accrual +, utilisation −
}

export function creditLedger(scope: TaxScope, filings: FilingStore, itcHeld: (id: string) => boolean): {
  entries: CreditEntry[];
  balance: HeadAmounts;
} {
  const entries: CreditEntry[] = [];
  const periods = availablePeriods().slice().sort((a, b) => a.localeCompare(b));
  for (const period of periods) {
    if (filingState(filings, "gstr3b", period).status !== "filed") continue;
    const r3b = gstr3bFor(scope, period, itcHeld);
    const acc = r3b.itcAvailable;
    if (acc.igst || acc.cgst || acc.sgst) {
      entries.push({ date: `${period}-20`, kind: "accrual", ref: `ITC ${period}`, igst: acc.igst, cgst: acc.cgst, sgst: acc.sgst });
    }
    const used = r3b.setoff.creditUsed;
    if (used.igst || used.cgst || used.sgst) {
      entries.push({ date: `${period}-20`, kind: "utilisation", ref: `Set-off ${period}`, igst: -used.igst, cgst: -used.cgst, sgst: -used.sgst });
    }
  }
  const balance = entries.reduce(
    (a, e) => ({ igst: r2(a.igst + e.igst), cgst: r2(a.cgst + e.cgst), sgst: r2(a.sgst + e.sgst) }),
    { igst: 0, cgst: 0, sgst: 0 },
  );
  return { entries, balance };
}

// Convenience: month key list for a FY in the data, newest first.
export function monthsInRange(from: string, to: string): string[] {
  const set = new Set<string>();
  for (const r of outwardRows()) if (r.date >= from && r.date <= to) set.add(monthKeyOf(r.date));
  return Array.from(set).sort((a, b) => b.localeCompare(a));
}
