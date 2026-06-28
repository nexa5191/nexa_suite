"use client";

import { useReport } from "@/components/reports/use-report";
import { ReportControls } from "@/components/reports/report-controls";
import { StatementView, type StatementRow } from "@/components/reports/statement-view";
import { PageHeader } from "@/components/shell/page-header";
import { buildPnL, accountMonthly, type Section } from "@/lib/accounting/reports";
import { monthLabel } from "@/lib/utils";
import { KpiStrip } from "./kpi-strip";

export function PnlClient() {
  const ctl = useReport();
  const pnl = buildPnL(ctl.filters);
  const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

  // Each P&L line drills into its month-by-month contribution.
  const detailFor = (code: string) => {
    const ms = accountMonthly(ctl.filters, code).filter((m) => Math.abs(m.amount) >= 0.5);
    return ms.length > 1
      ? ms.map((m) => ({ label: monthLabel(`${m.month}-01`), amount: m.amount }))
      : undefined;
  };

  // Collect codes per category for drill-through.
  const revCodes = pnl.revenue.flatMap((s) => s.rows.map((r) => r.code));
  const cogsCodes = pnl.cogs.flatMap((s) => s.rows.map((r) => r.code));
  const opexCodes = pnl.opex.flatMap((s) => s.rows.map((r) => r.code));
  const oiCodes = pnl.otherIncome.flatMap((s) => s.rows.map((r) => r.code));
  const finCodes = pnl.finance.flatMap((s) => s.rows.map((r) => r.code));
  const allIncomeCodes = [...revCodes, ...oiCodes];
  const allCostCodes = [...cogsCodes, ...opexCodes, ...finCodes];

  const rows: StatementRow[] = [];
  const push = (r: StatementRow) => rows.push(r);
  const sections = (secs: Section[], baseLevel = 1) =>
    secs.forEach((s) =>
      s.rows.forEach((r) =>
        push({ key: r.code, label: r.name, amount: r.amount, level: baseLevel, variant: "line", detail: detailFor(r.code), drillCodes: [r.code] }),
      ),
    );

  push({ key: "rev-h", label: "Revenue", level: 0, variant: "group" });
  sections(pnl.revenue);
  push({ key: "rev-t", label: "Total Revenue", amount: pnl.totalRevenue, level: 0, variant: "subtotal", drillCodes: revCodes });

  if (pnl.totalCogs) {
    push({ key: "sp1", label: "", variant: "spacer" });
    push({ key: "cogs-h", label: "Cost of Sales", level: 0, variant: "group" });
    sections(pnl.cogs);
    push({ key: "cogs-t", label: "Total Cost of Sales", amount: pnl.totalCogs, level: 0, variant: "subtotal", drillCodes: cogsCodes });
  }
  push({ key: "gp", label: "Gross Profit", amount: pnl.grossProfit, level: 0, variant: "subtotal", hint: pct(pnl.grossMargin), drillCodes: [...revCodes, ...cogsCodes] });

  push({ key: "sp2", label: "", variant: "spacer" });
  push({ key: "opex-h", label: "Operating Expenses", level: 0, variant: "group" });
  sections(pnl.opex);
  push({ key: "opex-t", label: "Total Operating Expenses", amount: pnl.totalOpex, level: 0, variant: "subtotal", drillCodes: opexCodes });
  push({ key: "op", label: "Operating Profit (EBIT)", amount: pnl.operatingProfit, level: 0, variant: "subtotal", drillCodes: [...revCodes, ...cogsCodes, ...opexCodes] });

  if (pnl.totalOtherIncome) {
    push({ key: "sp3", label: "", variant: "spacer" });
    push({ key: "oi-h", label: "Other Income", level: 0, variant: "group" });
    sections(pnl.otherIncome);
    push({ key: "oi-t", label: "Total Other Income", amount: pnl.totalOtherIncome, level: 0, variant: "subtotal", drillCodes: oiCodes });
  }
  if (pnl.totalFinance) {
    push({ key: "fin-h", label: "Finance Costs", level: 0, variant: "group" });
    sections(pnl.finance);
    push({ key: "fin-t", label: "Total Finance Costs", amount: pnl.totalFinance, level: 0, variant: "subtotal", drillCodes: finCodes });
  }

  push({ key: "np", label: "Net Profit", amount: pnl.netProfit, level: 0, variant: "total", hint: pct(pnl.netMargin), drillCodes: [...allIncomeCodes, ...allCostCodes] });

  return (
    <>
      <PageHeader
        title="Profit & Loss"
        subtitle="Income statement across entities, locations and states — switch cash/accrual basis from the top bar."
      />
      <KpiStrip
        items={[
          {
            label: "Revenue",
            value: pnl.totalRevenue,
            detailTitle: "Revenue lines",
            detail: pnl.revenue.flatMap((s) => s.rows).map((r) => ({ label: r.name, value: r.amount })),
          },
          { label: "Gross Profit", value: pnl.grossProfit, sub: pct(pnl.grossMargin) },
          { label: "Operating Profit", value: pnl.operatingProfit },
          {
            label: "Net Profit",
            value: pnl.netProfit,
            sub: pct(pnl.netMargin),
            colored: true,
            detailTitle: "Bridge",
            detail: [
              { label: "Gross profit", value: pnl.grossProfit },
              { label: "Operating expenses", value: -pnl.totalOpex },
              { label: "Other income", value: pnl.totalOtherIncome },
              { label: "Finance costs", value: -pnl.totalFinance },
            ],
          },
        ]}
      />
      <ReportControls ctl={ctl} />
      <StatementView
        title="Statement of Profit & Loss"
        scopeLabel={ctl.scopeLabel}
        periodLabel={ctl.periodLabel}
        basisLabel={ctl.basisLabel}
        rows={rows}
        filters={ctl.filters}
      />
    </>
  );
}
