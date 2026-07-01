// ---------------------------------------------------------------------------
// Projected (forward-looking) cash-flow — a short-horizon liquidity forecast.
//
// Opening cash (live GL balance of the cash/bank accounts) rolled forward
// week-by-week with:
//   + expected receipts from open AR (timed to each invoice's due date)
//   − expected payments of open AP   (timed to each bill's due date; MSME flagged)
//   − payroll net pay (month-end) and payroll statutory remittance (~10th next)
// Overdue items land in the first bucket (collect/pay now). Each bucket shows a
// running projected closing balance so liquidity dips are visible early.
// ---------------------------------------------------------------------------

import { openItems, AS_ON } from "@/lib/finance/receivables";
import { apOpenItems } from "@/lib/finance/payables";
import { runTotals } from "@/lib/hr/payroll";
import { cumulativeBalance } from "@/lib/accounting/ledger";
import { loadChartOfAccounts } from "@/lib/accounting/chart-of-accounts";
import type { Basis } from "@/lib/accounting/types";
import { gstr3bFor } from "@/lib/tax/returns";
import { gstr3bDueDate } from "@/lib/tax/gst";

function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function lastDayOfMonth(year: number, month0: number): string {
  const d = new Date(Date.UTC(year, month0 + 1, 0));
  return d.toISOString().slice(0, 10);
}

/** Live cash position from the GL (sum of all isCash accounts as on a date). */
export function openingCash(asOn: string = AS_ON): number {
  const f = { entityId: "all", locationId: "all", state: "all", basis: "accrual" as Basis, from: "", to: "" };
  const bal = cumulativeBalance(f, asOn);
  return loadChartOfAccounts().filter((a) => a.isCash).reduce((s, a) => s + (bal.get(a.code) ?? 0), 0);
}

export interface CashflowBucket {
  label: string;
  start: string;
  end: string; // inclusive
  inflowAr: number;
  outflowAp: number;
  outflowPayroll: number;
  outflowStatutory: number;
  outflowGst: number;
  inflow: number;
  outflow: number;
  net: number;
  opening: number;
  closing: number;
}

export interface CashflowForecast {
  asOn: string;
  openingCash: number;
  buckets: CashflowBucket[];
  totalIn: number;
  totalOut: number;
  endingCash: number;
  lowestClosing: number;
  lowestLabel: string;
  hasShortfall: boolean;
}

interface Flow { date: string; amount: number; kind: "ar" | "ap" | "payroll" | "statutory" | "gst" }

/** GST net cash payable (output GST − eligible ITC) per month — claim all eligible ITC. */
function gstNetCash(monthKey: string): number {
  return gstr3bFor({ entityId: "all" }, monthKey, () => false).netCash;
}

/** Build the projected cash-flow over `weeks` weekly buckets. Set includeGst=false to exclude GST remittances. */
export function projectedCashflow(asOn: string = AS_ON, weeks = 8, includeGst = true): CashflowForecast {
  const open = openingCash(asOn);
  const horizonEnd = addDays(asOn, weeks * 7 - 1);

  const flows: Flow[] = [];

  // Receipts from open receivables — collected on the due date (overdue ⇒ now).
  for (const i of openItems(asOn)) {
    const date = i.dueDate < asOn ? asOn : i.dueDate;
    flows.push({ date, amount: i.outstanding, kind: "ar" });
  }
  // Payments of open payables — paid on the due date (overdue ⇒ now).
  for (const b of apOpenItems(asOn)) {
    const date = b.dueDate < asOn ? asOn : b.dueDate;
    flows.push({ date, amount: b.outstanding, kind: "ap" });
  }
  // Payroll: net pay at each month-end in the horizon; statutory dues (TDS/PF/PT
  // withheld) remitted ~10th of the following month.
  const startD = new Date(asOn + "T00:00:00");
  for (let k = 0; k < 4; k++) {
    const y = startD.getUTCFullYear();
    const m0 = startD.getUTCMonth() + k;
    const yy = y + Math.floor(m0 / 12);
    const mm = ((m0 % 12) + 12) % 12;
    const monthKey = `${yy}-${String(mm + 1).padStart(2, "0")}`;
    const monthEnd = lastDayOfMonth(yy, mm);
    const t = runTotals(monthKey);
    if (t.net > 0 && monthEnd >= asOn && monthEnd <= horizonEnd) {
      flows.push({ date: monthEnd, amount: t.net, kind: "payroll" });
    }
    const statDate = addDays(lastDayOfMonth(yy, mm), 10); // ~10th next month
    if (t.deductions > 0 && statDate >= asOn && statDate <= horizonEnd) {
      flows.push({ date: statDate, amount: t.deductions, kind: "statutory" });
    }
  }

  // GST net remittance — each month's GSTR-3B falls due on the 20th of the next
  // month; include the months whose due date lands inside the horizon.
  if (includeGst) for (let off = -1; off <= 3; off++) {
    const m0 = startD.getUTCMonth() + off;
    const yy = startD.getUTCFullYear() + Math.floor(m0 / 12);
    const mm = ((m0 % 12) + 12) % 12;
    const monthKey = `${yy}-${String(mm + 1).padStart(2, "0")}`;
    const due = gstr3bDueDate(monthKey);
    if (due < asOn || due > horizonEnd) continue;
    const net = gstNetCash(monthKey);
    if (net > 0) flows.push({ date: due, amount: net, kind: "gst" });
  }

  // Weekly buckets.
  const buckets: CashflowBucket[] = [];
  let running = open;
  for (let w = 0; w < weeks; w++) {
    const start = addDays(asOn, w * 7);
    const end = addDays(asOn, w * 7 + 6);
    const inB = flows.filter((f) => f.date >= start && f.date <= end);
    const arIn = sum(inB, "ar");
    const apOut = sum(inB, "ap");
    const payOut = sum(inB, "payroll");
    const statOut = sum(inB, "statutory");
    const gstOut = sum(inB, "gst");
    const inflow = arIn;
    const outflow = apOut + payOut + statOut + gstOut;
    const net = inflow - outflow;
    const opening = running;
    running = opening + net;
    buckets.push({
      label: w === 0 ? "This week (incl. overdue)" : `Week ${w + 1}`,
      start, end,
      inflowAr: arIn, outflowAp: apOut, outflowPayroll: payOut, outflowStatutory: statOut, outflowGst: gstOut,
      inflow, outflow, net, opening, closing: running,
    });
  }

  const totalIn = buckets.reduce((s, b) => s + b.inflow, 0);
  const totalOut = buckets.reduce((s, b) => s + b.outflow, 0);
  let lowestClosing = Infinity;
  let lowestLabel = "";
  for (const b of buckets) if (b.closing < lowestClosing) { lowestClosing = b.closing; lowestLabel = b.label; }

  return {
    asOn,
    openingCash: open,
    buckets,
    totalIn,
    totalOut,
    endingCash: running,
    lowestClosing: buckets.length ? lowestClosing : open,
    lowestLabel,
    hasShortfall: buckets.some((b) => b.closing < 0),
  };
}

function sum(flows: Flow[], kind: Flow["kind"]): number {
  return Math.round(flows.filter((f) => f.kind === kind).reduce((s, f) => s + f.amount, 0));
}

export { AS_ON };
