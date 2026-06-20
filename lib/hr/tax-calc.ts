// ---------------------------------------------------------------------------
// Indian income-tax calculator — FY 2025-26 (Assessment Year 2026-27).
// Computes tax under both the Old and New regimes from a salaried employee's
// gross income + deductions, so the two can be compared side by side.
//
// All amounts are in base INR (annual). Calculations follow the Finance Act
// 2025 slabs, including standard deduction, s.87A rebate (with the new-regime
// marginal relief above ₹12L), surcharge with marginal relief, and 4% cess.
// ---------------------------------------------------------------------------

export type Regime = "old" | "new";

export interface Slab {
  /** Lower bound (exclusive of prior slab), inclusive start. */
  from: number;
  /** Upper bound, or null for the top open-ended slab. */
  to: number | null;
  rate: number; // fraction, e.g. 0.05
}

// New regime — revised slabs effective FY 2025-26.
export const NEW_REGIME_SLABS: Slab[] = [
  { from: 0, to: 400_000, rate: 0 },
  { from: 400_000, to: 800_000, rate: 0.05 },
  { from: 800_000, to: 1_200_000, rate: 0.1 },
  { from: 1_200_000, to: 1_600_000, rate: 0.15 },
  { from: 1_600_000, to: 2_000_000, rate: 0.2 },
  { from: 2_000_000, to: 2_400_000, rate: 0.25 },
  { from: 2_400_000, to: null, rate: 0.3 },
];

// Old regime — unchanged (individual below 60). Senior-citizen variants are not
// modelled here; the portal calculator targets the general salaried case.
export const OLD_REGIME_SLABS: Slab[] = [
  { from: 0, to: 250_000, rate: 0 },
  { from: 250_000, to: 500_000, rate: 0.05 },
  { from: 500_000, to: 1_000_000, rate: 0.2 },
  { from: 1_000_000, to: null, rate: 0.3 },
];

export const STANDARD_DEDUCTION: Record<Regime, number> = {
  old: 50_000,
  new: 75_000,
};

// Statutory caps used to clamp the deduction inputs (old regime only).
export const DEDUCTION_CAPS = {
  sec80C: 150_000, // 80C / 80CCC / 80CCD(1)
  sec80D: 100_000, // self + parents, senior — generous upper bound
  nps80CCD1B: 50_000, // additional NPS
  homeLoanInterest: 200_000, // s.24(b), self-occupied
} as const;

/** Deductions an employee can claim — only relevant under the old regime. */
export interface Deductions {
  sec80C: number;
  sec80D: number;
  nps80CCD1B: number;
  hraExemption: number;
  homeLoanInterest: number;
  professionalTax: number;
  other: number; // 80E, 80G, 80TTA, etc.
}

export const EMPTY_DEDUCTIONS: Deductions = {
  sec80C: 0,
  sec80D: 0,
  nps80CCD1B: 0,
  hraExemption: 0,
  homeLoanInterest: 0,
  professionalTax: 0,
  other: 0,
};

export interface SlabRow {
  from: number;
  to: number | null;
  rate: number;
  taxable: number; // income falling in this slab
  tax: number;
}

export interface TaxResult {
  regime: Regime;
  grossIncome: number;
  standardDeduction: number;
  otherDeductions: number; // chapter VI-A + HRA + home-loan (old regime)
  totalDeductions: number;
  taxableIncome: number;
  slabwise: SlabRow[];
  slabTax: number;
  rebate87A: number;
  rebateMarginalRelief: number; // new-regime relief just above ₹12L
  taxAfterRebate: number;
  surcharge: number;
  surchargeMarginalRelief: number;
  cess: number; // 4% health & education cess
  totalTax: number; // final liability, rounded to nearest ₹10
  takeHome: number; // grossIncome − totalTax
  effectiveRate: number; // totalTax / grossIncome
}

/** Tax across a slab schedule, with the per-slab breakdown. */
function applySlabs(taxable: number, slabs: Slab[]): { tax: number; rows: SlabRow[] } {
  let tax = 0;
  const rows: SlabRow[] = [];
  for (const s of slabs) {
    const upper = s.to ?? Infinity;
    const inSlab = Math.max(0, Math.min(taxable, upper) - s.from);
    const slabTax = inSlab * s.rate;
    tax += slabTax;
    rows.push({ from: s.from, to: s.to, rate: s.rate, taxable: inSlab, tax: slabTax });
  }
  return { tax, rows };
}

/** Surcharge rate on income tax once total income crosses the thresholds. */
function surchargeRate(totalIncome: number, regime: Regime): number {
  if (totalIncome <= 5_000_000) return 0;
  if (totalIncome <= 10_000_000) return 0.1;
  if (totalIncome <= 20_000_000) return 0.15;
  // The 25% / 37% top tiers apply to non-special-rate income; the new regime
  // caps surcharge at 25%.
  if (totalIncome <= 50_000_000) return 0.25;
  return regime === "new" ? 0.25 : 0.37;
}

const SURCHARGE_THRESHOLDS = [5_000_000, 10_000_000, 20_000_000, 50_000_000];

/**
 * Surcharge with marginal relief: the extra tax + surcharge from crossing a
 * threshold cannot exceed the income earned beyond that threshold.
 */
function surchargeWithRelief(
  taxableIncome: number,
  baseTax: number,
  regime: Regime,
): { surcharge: number; relief: number } {
  const rate = surchargeRate(taxableIncome, regime);
  if (rate === 0) return { surcharge: 0, relief: 0 };
  const rawSurcharge = baseTax * rate;

  // Compare against the liability at the threshold just crossed.
  const threshold = [...SURCHARGE_THRESHOLDS].reverse().find((t) => taxableIncome > t)!;
  const slabs = regime === "new" ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  const taxAtThreshold = applySlabs(threshold, slabs).tax;
  const surchargeAtThreshold = taxAtThreshold * surchargeRate(threshold, regime);
  const cap = taxAtThreshold + surchargeAtThreshold + (taxableIncome - threshold);

  const relief = Math.max(0, baseTax + rawSurcharge - cap);
  return { surcharge: Math.max(0, rawSurcharge - relief), relief };
}

function clamp(value: number, cap: number): number {
  return Math.max(0, Math.min(value, cap));
}

/** Sum of allowable old-regime deductions, each clamped to its statutory cap. */
export function allowableDeductions(d: Deductions): number {
  return (
    clamp(d.sec80C, DEDUCTION_CAPS.sec80C) +
    clamp(d.sec80D, DEDUCTION_CAPS.sec80D) +
    clamp(d.nps80CCD1B, DEDUCTION_CAPS.nps80CCD1B) +
    Math.max(0, d.hraExemption) +
    clamp(d.homeLoanInterest, DEDUCTION_CAPS.homeLoanInterest) +
    Math.max(0, d.professionalTax) +
    Math.max(0, d.other)
  );
}

export interface CalcInput {
  grossIncome: number;
  deductions: Deductions;
}

export function calculateTax(regime: Regime, input: CalcInput): TaxResult {
  const grossIncome = Math.max(0, input.grossIncome);
  const standardDeduction = grossIncome > 0 ? STANDARD_DEDUCTION[regime] : 0;

  // Chapter VI-A / HRA / home-loan deductions apply only under the old regime.
  const otherDeductions = regime === "old" ? allowableDeductions(input.deductions) : 0;
  const totalDeductions = standardDeduction + otherDeductions;
  const taxableIncome = Math.max(0, grossIncome - totalDeductions);

  const slabs = regime === "new" ? NEW_REGIME_SLABS : OLD_REGIME_SLABS;
  const { tax: slabTax, rows: slabwise } = applySlabs(taxableIncome, slabs);

  // s.87A rebate.
  let rebate87A = 0;
  let rebateMarginalRelief = 0;
  if (regime === "old") {
    if (taxableIncome <= 500_000) rebate87A = Math.min(slabTax, 12_500);
  } else {
    if (taxableIncome <= 1_200_000) {
      rebate87A = Math.min(slabTax, 60_000);
    } else {
      // Marginal relief: tax payable cannot exceed income above ₹12L.
      const excess = taxableIncome - 1_200_000;
      if (slabTax > excess) rebateMarginalRelief = slabTax - excess;
    }
  }

  const taxAfterRebate = Math.max(0, slabTax - rebate87A - rebateMarginalRelief);

  const { surcharge, relief: surchargeMarginalRelief } = surchargeWithRelief(
    taxableIncome,
    taxAfterRebate,
    regime,
  );

  const cess = (taxAfterRebate + surcharge) * 0.04;
  const totalTaxRaw = taxAfterRebate + surcharge + cess;
  // Income tax is rounded off to the nearest ₹10 (s.288B).
  const totalTax = taxAfterRebate > 0 ? Math.round(totalTaxRaw / 10) * 10 : 0;

  return {
    regime,
    grossIncome,
    standardDeduction,
    otherDeductions,
    totalDeductions,
    taxableIncome,
    slabwise,
    slabTax,
    rebate87A,
    rebateMarginalRelief,
    taxAfterRebate,
    surcharge,
    surchargeMarginalRelief,
    cess,
    totalTax,
    takeHome: grossIncome - totalTax,
    effectiveRate: grossIncome > 0 ? totalTax / grossIncome : 0,
  };
}

export interface TaxComparison {
  old: TaxResult;
  new: TaxResult;
  /** Regime with the lower liability (or "tie"). */
  better: Regime | "tie";
  /** Amount saved by choosing the better regime. */
  saving: number;
}

export function compareRegimes(input: CalcInput): TaxComparison {
  const oldR = calculateTax("old", input);
  const newR = calculateTax("new", input);
  const diff = oldR.totalTax - newR.totalTax;
  const better: Regime | "tie" = diff === 0 ? "tie" : diff > 0 ? "new" : "old";
  return { old: oldR, new: newR, better, saving: Math.abs(diff) };
}
