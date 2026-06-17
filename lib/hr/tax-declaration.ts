// ---------------------------------------------------------------------------
// Employee tax declaration / regime election — self-service.
//
// The front-door workflow: an employee declares their planned investments and
// chooses a tax regime; payroll then projects the year's TDS from it. Reuses
// the income-tax engine (lib/hr/tax-calc.ts) — no slab math here.
//
// Persisted to localStorage "nexa-tax-declaration", keyed by employee id.
// ---------------------------------------------------------------------------

import { salaryStructure } from "./payroll";
import {
  compareRegimes, calculateTax, EMPTY_DEDUCTIONS,
  type Deductions, type Regime, type TaxComparison,
} from "./tax-calc";

export const DECLARATION_KEY = "nexa-tax-declaration";

export type ProofStatus = "pending" | "submitted" | "verified" | "rejected";

// The proof-able sections an employee declares investment under. Maps to the
// Deductions keys the old regime allows.
export type ProofSection =
  | "sec80C"
  | "sec80D"
  | "nps80CCD1B"
  | "hraExemption"
  | "homeLoanInterest"
  | "other";

export const PROOF_SECTIONS: ProofSection[] = [
  "sec80C", "sec80D", "nps80CCD1B", "hraExemption", "homeLoanInterest", "other",
];

export interface ProofEntry {
  declared: number; // amount the employee declares
  verified: number; // amount payroll has verified (≤ declared)
  status: ProofStatus;
}

export type Proofs = Record<ProofSection, ProofEntry>;

export interface Declaration {
  empId: string;
  regime: Regime;
  deductions: Deductions;
  proofs: Proofs;
  submitted: boolean; // submitted to payroll
  updatedAt: string; // ISO timestamp
}

function emptyProofs(): Proofs {
  return PROOF_SECTIONS.reduce((acc, k) => {
    acc[k] = { declared: 0, verified: 0, status: "pending" };
    return acc;
  }, {} as Proofs);
}

/** A fresh declaration seeded from the employee's salary structure. */
export function defaultDeclaration(empId: string): Declaration {
  const s = salaryStructure(empId);
  // Seed a plausible 80C (PF already counts), 80D and professional tax.
  const annualPf = s.pf * 12;
  const deductions: Deductions = {
    ...EMPTY_DEDUCTIONS,
    sec80C: Math.min(150_000, annualPf),
    sec80D: 25_000,
    professionalTax: s.pt * 12,
  };
  const proofs = emptyProofs();
  proofs.sec80C.declared = deductions.sec80C;
  proofs.sec80D.declared = deductions.sec80D;
  return {
    empId,
    regime: "new",
    deductions,
    proofs,
    submitted: false,
    updatedAt: new Date().toISOString(),
  };
}

// ---- Persistence -----------------------------------------------------------

type Store = Record<string, Declaration>;

function readStore(): Store {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(DECLARATION_KEY);
    return raw ? (JSON.parse(raw) as Store) : {};
  } catch {
    return {};
  }
}

function writeStore(store: Store) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(DECLARATION_KEY, JSON.stringify(store));
  } catch {
    /* ignore */
  }
}

/** Loads the stored declaration for an employee, or a default seeded one. */
export function loadDeclaration(empId: string): Declaration {
  const stored = readStore()[empId];
  if (!stored) return defaultDeclaration(empId);
  // Merge against the default so newly added sections never come back undefined.
  const base = defaultDeclaration(empId);
  return {
    ...base,
    ...stored,
    deductions: { ...base.deductions, ...stored.deductions },
    proofs: { ...base.proofs, ...stored.proofs },
  };
}

export function saveDeclaration(decl: Declaration): Declaration {
  const next: Declaration = { ...decl, updatedAt: new Date().toISOString() };
  const store = readStore();
  store[decl.empId] = next;
  writeStore(store);
  return next;
}

// ---- TDS projection --------------------------------------------------------

export interface TdsProjectionResult {
  annualSalary: number; // gross income used (annual CTC)
  regime: Regime; // the chosen regime
  annualTax: number; // liability under the chosen regime
  monthlyTds: number; // annualTax / 12
  takeHome: number; // annual salary − annual tax
  comparison: TaxComparison; // old vs new, with verdict
  betterRegime: Regime | "tie";
  saving: number; // saving from the better regime vs the worse one
  chosenIsBest: boolean; // chosen regime == better (or tie)
}

/**
 * Projects TDS for a declaration. The new regime ignores the declared
 * deductions (only the standard deduction applies); the old regime uses them.
 */
export function projectTds(empId: string, decl: Declaration): TdsProjectionResult {
  const s = salaryStructure(empId);
  const grossIncome = s.annualCtc;
  const comparison = compareRegimes({ grossIncome, deductions: decl.deductions });
  const chosen = calculateTax(decl.regime, { grossIncome, deductions: decl.deductions });
  return {
    annualSalary: grossIncome,
    regime: decl.regime,
    annualTax: chosen.totalTax,
    monthlyTds: Math.round(chosen.totalTax / 12),
    takeHome: chosen.takeHome,
    comparison,
    betterRegime: comparison.better,
    saving: comparison.saving,
    chosenIsBest: comparison.better === "tie" || comparison.better === decl.regime,
  };
}
