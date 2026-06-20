// ---------------------------------------------------------------------------
// Budgetary control / commitment accounting — available budget is not just
// budget − actual; open purchase orders (status "issued": ordered but not yet
// invoiced) are COMMITMENTS that consume budget too. So:
//     available = budget − actual − committed
// This is what stops a department over-spending an already-committed budget.
// ---------------------------------------------------------------------------

import { buildBudget, DEFAULT_ASSUMPTIONS, loadOverrides, type BudgetModel } from "@/lib/planning/budget";
import { PURCHASE_ORDERS, vendorById } from "@/lib/vendors";
import { AS_ON } from "@/lib/finance/receivables";
import type { Basis } from "@/lib/accounting/types";

export interface BudgetCategory {
  key: "cogs" | "opex";
  name: string;
  budget: number;
  actual: number;
  committed: number;
  available: number;
  pctUsed: number; // (actual + committed) / budget
  over: boolean;
}

export interface Commitment {
  poId: string;
  vendor: string;
  title: string;
  category: "cogs" | "opex";
  amount: number;
}

export interface BudgetControl {
  fyName: string;
  categories: BudgetCategory[];
  commitments: Commitment[];
  totals: { budget: number; actual: number; committed: number; available: number; pctUsed: number };
}

function fyStartOf(asOn: string): number {
  const [y, m] = asOn.split("-").map(Number);
  return m >= 4 ? y : y - 1;
}

const sum12 = (a: number[]) => a.reduce((s, v) => s + v, 0);

export function budgetControl(entityId: string = "all", asOn: string = AS_ON): BudgetControl {
  const fyStart = fyStartOf(asOn);
  const asOfMonth = asOn.slice(0, 7);
  const model: BudgetModel = buildBudget(entityId, "accrual" as Basis, fyStart, asOfMonth, DEFAULT_ASSUMPTIONS, loadOverrides(entityId, fyStart));

  // Bucket expense budget lines: code 5xxx = direct/COGS, else operating.
  const buckets = { cogs: { budget: 0, actual: 0 }, opex: { budget: 0, actual: 0 } };
  for (const l of model.lines) {
    if (l.type !== "expense") continue;
    const b = l.code.startsWith("5") ? buckets.cogs : buckets.opex;
    b.budget += sum12(l.budget);
    b.actual += sum12(l.actual);
  }

  // Commitments = issued (un-invoiced) POs, scoped to the entity, by vendor class.
  const commitments: Commitment[] = [];
  for (const po of PURCHASE_ORDERS) {
    if (po.status !== "issued") continue;
    if (entityId !== "all" && po.entityId !== entityId) continue;
    const v = vendorById(po.vendorId);
    const category: "cogs" | "opex" = v?.vClass === "Inventory" ? "cogs" : "opex";
    commitments.push({ poId: po.id, vendor: v?.name ?? po.vendorId, title: po.title, category, amount: po.total });
  }
  const committedBy = { cogs: 0, opex: 0 };
  for (const c of commitments) committedBy[c.category] += c.amount;

  const mk = (key: "cogs" | "opex", name: string): BudgetCategory => {
    const budget = Math.round(buckets[key].budget);
    const actual = Math.round(buckets[key].actual);
    const committed = Math.round(committedBy[key]);
    const available = budget - actual - committed;
    return { key, name, budget, actual, committed, available, pctUsed: budget > 0 ? (actual + committed) / budget : 0, over: actual + committed > budget };
  };
  const categories = [mk("cogs", "Cost of materials & goods"), mk("opex", "Operating expenses")];

  const totals = {
    budget: categories.reduce((s, c) => s + c.budget, 0),
    actual: categories.reduce((s, c) => s + c.actual, 0),
    committed: categories.reduce((s, c) => s + c.committed, 0),
    available: categories.reduce((s, c) => s + c.available, 0),
    pctUsed: 0,
  };
  totals.pctUsed = totals.budget > 0 ? (totals.actual + totals.committed) / totals.budget : 0;

  return { fyName: model.fyName, categories, commitments, totals };
}
