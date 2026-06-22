// ---------------------------------------------------------------------------
// Advance Tax — Sec. 207–211 and 234B/234C Interest (Income Tax Act 1961)
//
// Corporates must pay advance tax in 4 installments:
//   Q1: by 15 Jun  — 15% of estimated liability
//   Q2: by 15 Sep  — 45% cumulative
//   Q3: by 15 Dec  — 75% cumulative
//   Q4: by 15 Mar  — 100% cumulative
//
// Interest u/s 234C: 1% per month (or part) on the shortfall vs the prescribed
// cumulative % at each due date. 234B: deferment if total advance < 90%.
// ---------------------------------------------------------------------------

export interface Installment {
  quarter: string;            // e.g. "Q1 FY 2026-27"
  dueDate: string;            // ISO date
  requiredCumPct: number;     // prescribed cumulative % of total liability
  estimatedTax: number;       // estimated full-year liability at that point
  requiredCumAmount: number;  // what should have been paid cumulatively by due date
  paidCumAmount: number;      // what was actually paid cumulatively
  shortfall: number;          // max(0, required − paid)
  sec234cMonths: number;      // months of delay (1 if shortfall exists in the period)
  sec234cInterest: number;    // 1% per month × shortfall
  status: "paid" | "short" | "pending" | "due-today";
}

export interface AdvanceTaxComputation {
  fy: string;
  estimatedIncome: number;
  estimatedDeductions: number;
  taxableIncome: number;
  grossTax: number;           // tax on taxable income at applicable slab/MAT
  cess: number;               // 4% health & education cess
  tdsCredit: number;          // TDS deducted by others
  totalLiability: number;     // gross tax + cess − TDS credit
  installments: Installment[];
  total234c: number;
  total234b: number;
  netPayable: number;
}

// Corporate tax rate assumptions (FY2026-27 demo).
const CORPORATE_RATE = 0.22;  // new regime Sec 115BAA (no surcharge / cess separate)
const CESS_RATE = 0.04;
const AS_ON = "2026-06-22";

function sec234cInterest(shortfall: number, months: number): number {
  return Math.round(shortfall * 0.01 * months);
}

export function computeAdvanceTax(estimatedRevenue: number, estimatedExpenses: number, tdsCredit: number): AdvanceTaxComputation {
  const estimatedIncome = estimatedRevenue;
  const estimatedDeductions = estimatedExpenses;
  const taxableIncome = Math.max(0, estimatedIncome - estimatedDeductions);
  const grossTax = Math.round(taxableIncome * CORPORATE_RATE);
  const cess = Math.round(grossTax * CESS_RATE);
  const totalLiability = Math.max(0, grossTax + cess - tdsCredit);

  // Installment schedule — amounts simulate partial payments for demo.
  const q1Required = Math.round(totalLiability * 0.15);
  const q2Required = Math.round(totalLiability * 0.45);
  const q3Required = Math.round(totalLiability * 0.75);
  const q4Required = totalLiability;

  const q1Paid = Math.round(q1Required * 0.9);   // slightly short
  const q2Paid = Math.round(q2Required * 0.95);  // slightly short
  const q3Paid = 0;                               // future
  const q4Paid = 0;                               // future

  const makeDueDate = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  function status(dueDate: string, shortfall: number): Installment["status"] {
    if (dueDate > AS_ON) return "pending";
    if (dueDate === AS_ON) return "due-today";
    if (shortfall > 0) return "short";
    return "paid";
  }

  const installments: Installment[] = [
    {
      quarter: "Q1 — Jun 2026",
      dueDate: makeDueDate(2026, 6, 15),
      requiredCumPct: 15,
      estimatedTax: totalLiability,
      requiredCumAmount: q1Required,
      paidCumAmount: q1Paid,
      shortfall: Math.max(0, q1Required - q1Paid),
      sec234cMonths: 3,
      sec234cInterest: sec234cInterest(Math.max(0, q1Required - q1Paid), 3),
      status: status(makeDueDate(2026, 6, 15), Math.max(0, q1Required - q1Paid)),
    },
    {
      quarter: "Q2 — Sep 2026",
      dueDate: makeDueDate(2026, 9, 15),
      requiredCumPct: 45,
      estimatedTax: totalLiability,
      requiredCumAmount: q2Required,
      paidCumAmount: q1Paid + q2Paid,
      shortfall: Math.max(0, q2Required - (q1Paid + q2Paid)),
      sec234cMonths: 3,
      sec234cInterest: sec234cInterest(Math.max(0, q2Required - (q1Paid + q2Paid)), 3),
      status: status(makeDueDate(2026, 9, 15), Math.max(0, q2Required - (q1Paid + q2Paid))),
    },
    {
      quarter: "Q3 — Dec 2026",
      dueDate: makeDueDate(2026, 12, 15),
      requiredCumPct: 75,
      estimatedTax: totalLiability,
      requiredCumAmount: q3Required,
      paidCumAmount: q1Paid + q2Paid + q3Paid,
      shortfall: Math.max(0, q3Required - (q1Paid + q2Paid + q3Paid)),
      sec234cMonths: 3,
      sec234cInterest: 0,
      status: status(makeDueDate(2026, 12, 15), Math.max(0, q3Required - (q1Paid + q2Paid + q3Paid))),
    },
    {
      quarter: "Q4 — Mar 2027",
      dueDate: makeDueDate(2027, 3, 15),
      requiredCumPct: 100,
      estimatedTax: totalLiability,
      requiredCumAmount: q4Required,
      paidCumAmount: q1Paid + q2Paid + q3Paid + q4Paid,
      shortfall: Math.max(0, q4Required - (q1Paid + q2Paid + q3Paid + q4Paid)),
      sec234cMonths: 1,
      sec234cInterest: 0,
      status: status(makeDueDate(2027, 3, 15), Math.max(0, q4Required - (q1Paid + q2Paid + q3Paid + q4Paid))),
    },
  ];

  const total234c = installments.reduce((s, i) => s + i.sec234cInterest, 0);
  const totalPaid = q1Paid + q2Paid + q3Paid + q4Paid;
  const advanceShortfall = Math.max(0, totalLiability - totalPaid);
  const total234b = advanceShortfall > totalLiability * 0.1
    ? Math.round(advanceShortfall * 0.01 * 3)  // estimated 3-month deferment
    : 0;

  return {
    fy: "2026-27",
    estimatedIncome,
    estimatedDeductions,
    taxableIncome,
    grossTax,
    cess,
    tdsCredit,
    totalLiability,
    installments,
    total234c,
    total234b,
    netPayable: totalLiability - totalPaid + total234c + total234b,
  };
}

// Demo values derived from NEXA books.
export const DEMO_ADVANCE_TAX = computeAdvanceTax(
  45000000,   // estimated revenue
  32000000,   // estimated deductible expenses
  1200000,    // TDS credit expected
);
