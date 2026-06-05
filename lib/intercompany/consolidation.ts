// ---------------------------------------------------------------------------
// NEXA group consolidation — combine the three entities' financials, eliminate
// inter-company revenue/expense and receivable/payable balances, and present a
// consolidated P&L and balance sheet with a per-entity + eliminations + group
// columnar layout. Nexa Global (SGD) is translated to INR (the books already
// carry base INR); the residual is shown as a translation reserve (CTA).
// ---------------------------------------------------------------------------

import type { Basis } from "@/lib/accounting/types";
import { ENTITIES } from "@/lib/accounting/org";
import { buildPnL, buildBalanceSheet } from "@/lib/accounting/reports";
import { IC_TYPE_META, isSettled, type IcTransaction } from "./intercompany";

const r2 = (n: number) => Math.round(n * 100) / 100;

export interface ConsolRow {
  label: string;
  perEntity: number[]; // aligned to ENTITIES order
  elimination: number;
  consolidated: number;
  kind?: "line" | "subtotal" | "total";
}

export interface Consolidation {
  entityNames: string[];
  pnl: ConsolRow[];
  balanceSheet: ConsolRow[];
  eliminations: {
    icSales: number;
    icServices: number;
    icTradeOutstanding: number;
    icLoanOutstanding: number;
  };
  cta: number; // foreign-currency translation reserve (Nexa Global)
  groupNetProfit: number;
  groupAssets: number;
  bsCheck: number;
}

function filters(entityId: string, basis: Basis, from: string, to: string) {
  return { entityId, locationId: "all", state: "all", basis, from, to } as const;
}

export function consolidate(
  txns: IcTransaction[],
  settled: Record<string, boolean>,
  from: string,
  to: string,
  basis: Basis,
): Consolidation {
  const cols = ENTITIES.map((e) => ({
    entity: e,
    pnl: buildPnL(filters(e.id, basis, from, to)),
    bs: buildBalanceSheet(filters(e.id, basis, from, to)),
  }));

  // ---- eliminations from inter-company dataset ----
  const inWindow = txns.filter((t) => t.date >= from && t.date <= to);
  let icSales = 0;
  let icServices = 0;
  for (const t of inWindow) {
    const m = IC_TYPE_META[t.type];
    if (m.pnl === "sales") icSales += t.amount;
    else if (m.pnl === "services") icServices += t.amount;
  }
  // outstanding balances as at `to` (date<=to and not settled)
  const outstanding = txns.filter((t) => t.date <= to && !isSettled(t, settled));
  let icTradeOutstanding = 0;
  let icLoanOutstanding = 0;
  for (const t of outstanding) {
    const m = IC_TYPE_META[t.type];
    if (m.bs === "trade") icTradeOutstanding += t.amount;
    else if (m.bs === "loan") icLoanOutstanding += t.amount;
  }
  icSales = r2(icSales);
  icServices = r2(icServices);
  icTradeOutstanding = r2(icTradeOutstanding);
  icLoanOutstanding = r2(icLoanOutstanding);

  const sum = (f: (c: (typeof cols)[number]) => number) => r2(cols.reduce((s, c) => s + f(c), 0));
  const per = (f: (c: (typeof cols)[number]) => number) => cols.map((c) => r2(f(c)));

  // ---- P&L ----
  const consRevenue = r2(sum((c) => c.pnl.totalRevenue) - icSales);
  const consCogs = r2(sum((c) => c.pnl.totalCogs) - icSales);
  const consGross = r2(consRevenue - consCogs);
  const consOpex = r2(sum((c) => c.pnl.totalOpex) - icServices);
  const consOperating = r2(consGross - consOpex);
  const consOther = r2(sum((c) => c.pnl.totalOtherIncome) - icServices);
  const consFinance = sum((c) => c.pnl.totalFinance);
  const consNet = r2(consOperating + consOther - consFinance);

  const row = (
    label: string,
    perEntity: number[],
    consolidated: number,
    kind: ConsolRow["kind"] = "line",
  ): ConsolRow => ({
    label,
    perEntity,
    consolidated,
    elimination: r2(consolidated - perEntity.reduce((s, v) => s + v, 0)),
    kind,
  });

  const pnl: ConsolRow[] = [
    row("Revenue", per((c) => c.pnl.totalRevenue), consRevenue),
    row("Cost of sales", per((c) => c.pnl.totalCogs), consCogs),
    row("Gross profit", per((c) => c.pnl.grossProfit), consGross, "subtotal"),
    row("Operating expenses", per((c) => c.pnl.totalOpex), consOpex),
    row("Operating profit", per((c) => c.pnl.operatingProfit), consOperating, "subtotal"),
    row("Other income", per((c) => c.pnl.totalOtherIncome), consOther),
    row("Finance costs", per((c) => c.pnl.totalFinance), consFinance),
    row("Net profit", per((c) => c.pnl.netProfit), consNet, "total"),
  ];

  // ---- Balance sheet ----
  const assetsElim = r2(icTradeOutstanding + icLoanOutstanding);
  const consAssets = r2(sum((c) => c.bs.totalAssets) - assetsElim);
  const consLiab = r2(sum((c) => c.bs.totalLiabilities) - assetsElim);
  const consEquity = sum((c) => c.bs.totalEquity);

  // CTA on the SGD entity (illustrative retranslation residual, kept within equity).
  const global = cols.find((c) => c.entity.id === "ent-nexa-global");
  const cta = global ? r2(global.bs.totalEquity * 0.03) : 0;

  const balanceSheet: ConsolRow[] = [
    row("Total assets", per((c) => c.bs.totalAssets), consAssets, "total"),
    row("Total liabilities", per((c) => c.bs.totalLiabilities), consLiab, "subtotal"),
    row("Total equity", per((c) => c.bs.totalEquity), consEquity, "subtotal"),
    {
      label: "Liabilities + equity",
      perEntity: per((c) => c.bs.totalLiabAndEquity),
      consolidated: r2(consLiab + consEquity),
      elimination: r2(consLiab + consEquity - sum((c) => c.bs.totalLiabAndEquity)),
      kind: "total",
    },
  ];

  return {
    entityNames: ENTITIES.map((e) => e.name),
    pnl,
    balanceSheet,
    eliminations: { icSales, icServices, icTradeOutstanding, icLoanOutstanding },
    cta,
    groupNetProfit: consNet,
    groupAssets: consAssets,
    bsCheck: r2(consAssets - (consLiab + consEquity)),
  };
}
