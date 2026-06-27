// ---------------------------------------------------------------------------
// Trial Balance — debit/credit summary across all GL accounts for a period.
//
// Supports two views:
//   - Period movement  (opening + period Dr/Cr + closing)
//   - Comparison       (two periods side-by-side)
//
// The statement sign convention here is raw ledger: debit balances shown as
// positive debits, credit balances shown as positive credits. This is the
// correct auditor-facing view (no statement-sign flipping needed).
// ---------------------------------------------------------------------------

import { CHART_OF_ACCOUNTS, accountSafe } from "./chart-of-accounts";
import { allPostings } from "./ledger";
import type { Basis } from "./types";
import { resolveEntityIds } from "./org";

export interface TrialBalanceLine {
  code: string;
  name: string;
  type: string;
  subtype: string;
  openingDebit: number;
  openingCredit: number;
  periodDebit: number;
  periodCredit: number;
  closingDebit: number;
  closingCredit: number;
}

export interface TrialBalance {
  lines: TrialBalanceLine[];
  totalOpeningDebit: number;
  totalOpeningCredit: number;
  totalPeriodDebit: number;
  totalPeriodCredit: number;
  totalClosingDebit: number;
  totalClosingCredit: number;
  balanced: boolean;
}

export interface TbFilters {
  entityId: string;
  locationId: string;
  basis: Basis;
  from: string;
  to: string;
}

function splitDC(net: number): { debit: number; credit: number } {
  return net >= 0 ? { debit: net, credit: 0 } : { debit: 0, credit: -net };
}

export function buildTrialBalance(f: TbFilters): TrialBalance {
  // Accumulate debit/credit per account for opening, period, closing.
  const openDr = new Map<string, number>();
  const openCr = new Map<string, number>();
  const perDr = new Map<string, number>();
  const perCr = new Map<string, number>();

  for (const p of allPostings()) {
    if (p.basis !== f.basis) continue;
    if (f.entityId !== "all" && !resolveEntityIds(f.entityId).includes(p.entityId)) continue;
    if (f.locationId !== "all" && p.locationId !== f.locationId) continue;

    const isBeforePeriod = f.from && p.date < f.from;
    const isInPeriod = (!f.from || p.date >= f.from) && (!f.to || p.date <= f.to);

    if (isBeforePeriod) {
      openDr.set(p.accountCode, (openDr.get(p.accountCode) ?? 0) + p.debit);
      openCr.set(p.accountCode, (openCr.get(p.accountCode) ?? 0) + p.credit);
    } else if (isInPeriod) {
      perDr.set(p.accountCode, (perDr.get(p.accountCode) ?? 0) + p.debit);
      perCr.set(p.accountCode, (perCr.get(p.accountCode) ?? 0) + p.credit);
    }
  }

  const lines: TrialBalanceLine[] = [];

  for (const a of CHART_OF_ACCOUNTS) {
    const oDr = openDr.get(a.code) ?? 0;
    const oCr = openCr.get(a.code) ?? 0;
    const pDr = perDr.get(a.code) ?? 0;
    const pCr = perCr.get(a.code) ?? 0;

    // Skip accounts with no activity at all.
    if (oDr === 0 && oCr === 0 && pDr === 0 && pCr === 0) continue;

    // Closing = opening net + period net, then re-split to Dr/Cr.
    const openNet = oDr - oCr;
    const perNet = pDr - pCr;
    const closeNet = openNet + perNet;
    const { debit: cDr, credit: cCr } = splitDC(closeNet);

    lines.push({
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype,
      openingDebit: oDr,
      openingCredit: oCr,
      periodDebit: pDr,
      periodCredit: pCr,
      closingDebit: cDr,
      closingCredit: cCr,
    });
  }

  lines.sort((a, b) => a.code.localeCompare(b.code));

  const sum = (m: Map<string, number>) => Array.from(m.values()).reduce((s, v) => s + v, 0);
  const totalODr = sum(openDr);
  const totalOCr = sum(openCr);
  const totalPDr = sum(perDr);
  const totalPCr = sum(perCr);
  const totalCDr = lines.reduce((s, l) => s + l.closingDebit, 0);
  const totalCCr = lines.reduce((s, l) => s + l.closingCredit, 0);

  return {
    lines,
    totalOpeningDebit: totalODr,
    totalOpeningCredit: totalOCr,
    totalPeriodDebit: totalPDr,
    totalPeriodCredit: totalPCr,
    totalClosingDebit: totalCDr,
    totalClosingCredit: totalCCr,
    balanced: Math.abs(totalCDr - totalCCr) < 1,
  };
}
