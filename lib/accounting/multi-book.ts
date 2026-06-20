// ---------------------------------------------------------------------------
// Multi-book / parallel ledger — the same transactions, three books:
//   • Management  — billing-basis, book depreciation (how the business runs)
//   • Statutory   — Ind AS (115 revenue deferral, 116 leases)
//   • Tax (IT Act)— Income-tax Act depreciation, s.43B(h), billing-basis revenue
//
// It's the SAP-style "one entry, many ledgers": a book-to-tax bridge that starts
// from the GL profit and applies each book's adjustments. Computed for the last
// completed financial year (FY 2025-26) so the figures are a full-year set.
// ---------------------------------------------------------------------------

import { filteredPostings } from "./ledger";
import { CHART_OF_ACCOUNTS } from "./chart-of-accounts";
import type { Basis } from "./types";
import { revSummary } from "@/lib/finance/revenue-recognition";
import { apSummary } from "@/lib/finance/payables";
import { LEASES, initialLiability, schedule } from "@/lib/finance/leases";
import { allAssets, loadCreatedAssets } from "@/lib/assets/assets";
import { fyDepForBasis } from "@/lib/assets/depreciation";

const TYPE_OF = new Map(CHART_OF_ACCOUNTS.map((a) => [a.code, a.type]));

export const FY_LABEL = "FY 2025-26";
const FY_START = "2025-04-01";
const FY_END = "2026-03-31";
const FY_START_YEAR = 2025;
const TAX_RATE = 0.2517; // 25.17% effective (22% + surcharge + cess, s.115BAA)

const round = (n: number) => Math.round(n);

function addMonth(start: string, k: number): string {
  const [y, m] = start.split("-").map(Number);
  const idx = m - 1 + k;
  const yy = y + Math.floor(idx / 12);
  const mm = (idx % 12) + 1;
  return `${yy}-${String(mm).padStart(2, "0")}-01`;
}

/** Management profit before tax for the year — GL income − expense (accrual). */
function managementPbt(): number {
  const postings = filteredPostings({ entityId: "all", locationId: "all", state: "all", basis: "accrual" as Basis, from: FY_START, to: FY_END });
  let income = 0, expense = 0;
  for (const p of postings) {
    const t = TYPE_OF.get(p.accountCode);
    if (t === "income") income += p.credit - p.debit;
    else if (t === "expense") expense += p.debit - p.credit;
  }
  return round(income - expense);
}

/** Ind AS 116 P&L effect for the year across the lease portfolio. */
function leaseFyEffect(): { rent: number; depAndInterest: number; net: number } {
  let rent = 0, dep = 0, interest = 0;
  for (const l of LEASES) {
    const depMonthly = initialLiability(l) / l.termMonths;
    const sched = schedule(l);
    for (let p = 1; p <= l.termMonths; p++) {
      const month = addMonth(l.commencement, p - 1);
      if (month >= FY_START && month <= FY_END) {
        rent += l.monthlyPayment;
        dep += depMonthly;
        interest += sched[p - 1].interest;
      }
    }
  }
  // Statutory replaces rent with (dep + interest); net effect on PBT = rent − (dep+interest).
  return { rent: round(rent), depAndInterest: round(dep + interest), net: round(rent - (dep + interest)) };
}

function depreciationDiff(): { book: number; tax: number; diff: number } {
  const assets = allAssets(loadCreatedAssets());
  let book = 0, tax = 0;
  for (const a of assets) {
    book += fyDepForBasis(a, FY_START_YEAR, "companies");
    tax += fyDepForBasis(a, FY_START_YEAR, "incometax");
  }
  return { book: round(book), tax: round(tax), diff: round(book - tax) };
}

export interface BridgeRow { label: string; amount: number; note?: string }

export interface MultiBook {
  fyLabel: string;
  managementPbt: number;
  statutoryAdjustments: BridgeRow[];
  statutoryPbt: number;
  taxAdjustments: BridgeRow[];
  taxableIncome: number;
  taxRate: number;
  taxExpense: number;
  books: { management: number; statutory: number; tax: number }; // PBT per book
  pat: { management: number; statutory: number }; // PBT − tax
}

export function multiBook(): MultiBook {
  const mgmt = managementPbt();
  const rev = revSummary();
  const lease = leaseFyEffect();
  const dep = depreciationDiff();
  const ap = apSummary();
  const msmeDisallowed = ap.msmeBreaches > 0 ? round(ap.msmeDue) : 0;

  const statutoryAdjustments: BridgeRow[] = [
    { label: "Ind AS 115 — defer unearned revenue", amount: -rev.deferredBalance, note: "Revenue billed but not yet earned" },
    { label: "Ind AS 116 — lease restatement", amount: lease.net, note: `Remove rent ${inr(lease.rent)}, add ROU dep + interest ${inr(lease.depAndInterest)}` },
  ];
  const statutoryPbt = round(mgmt + statutoryAdjustments.reduce((s, r) => s + r.amount, 0));

  const taxAdjustments: BridgeRow[] = [
    { label: "Reverse Ind AS 115 deferral (taxed on billing)", amount: rev.deferredBalance },
    { label: "Reverse Ind AS 116 (rent allowed for tax)", amount: -lease.net },
    { label: "Depreciation: book less IT Act (block WDV)", amount: dep.diff, note: `Book ${inr(dep.book)} vs IT Act ${inr(dep.tax)}` },
    { label: "Add back s.43B(h) — MSME dues unpaid", amount: msmeDisallowed, note: msmeDisallowed ? "Disallowed until paid" : "No MSME breach" },
  ];
  const taxableIncome = round(statutoryPbt + taxAdjustments.reduce((s, r) => s + r.amount, 0));
  const taxExpense = round(Math.max(0, taxableIncome) * TAX_RATE);

  return {
    fyLabel: FY_LABEL,
    managementPbt: mgmt,
    statutoryAdjustments,
    statutoryPbt,
    taxAdjustments,
    taxableIncome,
    taxRate: TAX_RATE,
    taxExpense,
    books: { management: mgmt, statutory: statutoryPbt, tax: taxableIncome },
    pat: { management: round(mgmt - taxExpense), statutory: round(statutoryPbt - taxExpense) },
  };
}

function inr(n: number): string {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}
