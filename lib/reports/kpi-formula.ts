import type { ReportFilters } from "@/lib/accounting/types";
import { loadChartOfAccounts } from "@/lib/accounting/chart-of-accounts";
import { periodMovement, cumulativeBalance } from "@/lib/accounting/ledger";

// ---------------------------------------------------------------------------
// Custom KPI definitions — persisted to localStorage.
// ---------------------------------------------------------------------------

export interface CustomKpi {
  id: string;
  name: string;
  /** GL formula using SUM(code), SUM(from:to), BAL(code), BAL(from:to), +−×÷ */
  formula: string;
  format: "money" | "percent" | "ratio" | "number";
  colorize: boolean;
  description?: string;
}

const KEY = "nexa-custom-kpis";

function readLS<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fb; } catch { return fb; }
}
function writeLS<T>(key: string, v: T): void {
  try { localStorage.setItem(key, JSON.stringify(v)); } catch {}
}

export const loadCustomKpis = (): CustomKpi[] => readLS<CustomKpi[]>(KEY, []);
export const saveCustomKpis = (kpis: CustomKpi[]) => writeLS(KEY, kpis);

// ---------------------------------------------------------------------------
// Formula evaluation
// ---------------------------------------------------------------------------

// Statement-sign convention: income/liability/equity are credit-normal → flip
// debit-minus-credit so "revenue" and "asset balance" both read as positive.
function stmtSign(code: string): number {
  const a = loadChartOfAccounts().find((x) => x.code === code);
  if (!a) return 1;
  return a.type === "income" || a.type === "liability" || a.type === "equity" ? -1 : 1;
}

function sumMap(mv: Map<string, number>, from: string, to?: string): number {
  let total = 0;
  for (const a of loadChartOfAccounts()) {
    const inRange = to ? a.code >= from && a.code <= to : a.code === from;
    if (inRange) total += stmtSign(a.code) * (mv.get(a.code) ?? 0);
  }
  return total;
}

/** Evaluate a KPI formula against the given report filters. Returns NaN on parse error. */
export function evalFormula(formula: string, filters: ReportFilters): number {
  const mv = periodMovement(filters);
  const bal = cumulativeBalance(filters, filters.to);

  const expr = formula
    .replace(/SUM\((\d+)(?::(\d+))?\)/g, (_, f, t) => String(sumMap(mv, f, t)))
    .replace(/BAL\((\d+)(?::(\d+))?\)/g, (_, f, t) => String(sumMap(bal, f, t)));

  try {
    return parseArith(expr.trim());
  } catch {
    return NaN;
  }
}

/** Return all account codes referenced in the formula (used for drill-through). */
export function formulaCodes(formula: string): string[] {
  const codes: string[] = [];
  const re = /(?:SUM|BAL)\((\d+)(?::(\d+))?\)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(formula)) !== null) {
    const from = m[1], to = m[2];
    for (const a of loadChartOfAccounts()) {
      if (to ? a.code >= from && a.code <= to : a.code === from) codes.push(a.code);
    }
  }
  return [...new Set(codes)];
}

// ---------------------------------------------------------------------------
// Simple recursive-descent arithmetic parser (no eval).
// Handles: numbers (including negatives), +, −, *, /, parentheses.
// ---------------------------------------------------------------------------

function parseArith(s: string): number {
  let pos = 0;

  const ws = () => { while (pos < s.length && /\s/.test(s[pos])) pos++; };
  const peek = () => s[pos];
  const eat = () => s[pos++];

  function num(): number {
    ws();
    let neg = false;
    if (peek() === "-") { neg = true; eat(); }
    ws();
    let digits = "";
    while (pos < s.length && /[\d.]/.test(s[pos])) digits += eat();
    if (!digits) throw new Error("Expected number");
    return neg ? -parseFloat(digits) : parseFloat(digits);
  }

  function primary(): number {
    ws();
    if (peek() === "(") {
      eat();
      const v = addSub();
      ws();
      if (peek() === ")") eat();
      return v;
    }
    return num();
  }

  function mulDiv(): number {
    let left = primary();
    ws();
    while (pos < s.length && (peek() === "*" || peek() === "/")) {
      const op = eat();
      const right = primary();
      left = op === "*" ? left * right : right === 0 ? 0 : left / right;
      ws();
    }
    return left;
  }

  function addSub(): number {
    let left = mulDiv();
    ws();
    while (pos < s.length && (peek() === "+" || peek() === "-")) {
      const op = eat();
      const right = mulDiv();
      left = op === "+" ? left + right : left - right;
      ws();
    }
    return left;
  }

  return addSub();
}

// ---------------------------------------------------------------------------
// Starter templates shown in the KPI builder
// ---------------------------------------------------------------------------

export interface KpiTemplate {
  name: string;
  formula: string;
  format: CustomKpi["format"];
  description: string;
}

export const KPI_TEMPLATES: KpiTemplate[] = [
  { name: "Total Revenue", formula: "SUM(4010:4040)", format: "money", description: "Gross revenue (all income accounts 4010–4040)" },
  { name: "Gross Profit", formula: "SUM(4010:4040) - SUM(5010:5050)", format: "money", description: "Revenue minus cost of sales" },
  { name: "Gross Margin %", formula: "(SUM(4010:4040) - SUM(5010:5050)) / SUM(4010:4040)", format: "percent", description: "Gross profit as a percentage of revenue" },
  { name: "Operating Expenses", formula: "SUM(6010:6900)", format: "money", description: "All operating expense accounts 6010–6900" },
  { name: "Net Profit", formula: "SUM(4010:4900) - SUM(5010:6900)", format: "money", description: "Total income minus total expenses" },
  { name: "Net Margin %", formula: "(SUM(4010:4900) - SUM(5010:6900)) / SUM(4010:4040)", format: "percent", description: "Net profit divided by revenue" },
  { name: "Cash Balance", formula: "BAL(1010:1030)", format: "money", description: "Current balance of all cash and bank accounts" },
  { name: "Accounts Receivable", formula: "BAL(1100)", format: "money", description: "Outstanding receivables as at period end" },
  { name: "Accounts Payable", formula: "BAL(2010)", format: "money", description: "Outstanding payables as at period end" },
  { name: "Current Ratio", formula: "BAL(1010:1400) / BAL(2010:2400)", format: "ratio", description: "Current assets divided by current liabilities" },
  { name: "Revenue per ₹ Expense", formula: "SUM(4010:4040) / SUM(5010:6900)", format: "ratio", description: "How much revenue is generated per rupee of total cost" },
];
