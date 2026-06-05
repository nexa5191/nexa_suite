"use client";

import { useReport } from "@/components/reports/use-report";
import { ReportControls } from "@/components/reports/report-controls";
import { StatementView, type StatementRow } from "@/components/reports/statement-view";
import { PageHeader } from "@/components/shell/page-header";
import { buildCashFlow } from "@/lib/accounting/reports";
import { KpiStrip } from "./kpi-strip";

export function CashFlowClient() {
  const ctl = useReport();
  const cf = buildCashFlow(ctl.filters);

  const rows: StatementRow[] = [];
  const push = (r: StatementRow) => rows.push(r);

  push({ key: "op-h", label: "Cash flow from Operating Activities", level: 0, variant: "group" });
  push({ key: "np", label: "Net profit for the period", amount: cf.netProfit, level: 1, variant: "line" });
  if (cf.operating.length) push({ key: "adj", label: "Adjustments for non-cash items & working capital", level: 1, variant: "note" });
  cf.operating
    .sort((a, b) => a.code.localeCompare(b.code))
    .forEach((r) => push({ key: r.code, label: r.name, amount: r.amount, level: 2, variant: "line" }));
  push({ key: "op-t", label: "Net cash from operating activities", amount: cf.netOperating, level: 0, variant: "subtotal" });

  push({ key: "sp1", label: "", variant: "spacer" });
  push({ key: "inv-h", label: "Cash flow from Investing Activities", level: 0, variant: "group" });
  if (!cf.investing.length) push({ key: "inv-n", label: "No investing activity in period", level: 1, variant: "note" });
  cf.investing.forEach((r) => push({ key: r.code, label: r.name, amount: r.amount, level: 2, variant: "line" }));
  push({ key: "inv-t", label: "Net cash used in investing activities", amount: cf.netInvesting, level: 0, variant: "subtotal" });

  push({ key: "sp2", label: "", variant: "spacer" });
  push({ key: "fin-h", label: "Cash flow from Financing Activities", level: 0, variant: "group" });
  if (!cf.financing.length) push({ key: "fin-n", label: "No financing activity in period", level: 1, variant: "note" });
  cf.financing.forEach((r) => push({ key: r.code, label: r.name, amount: r.amount, level: 2, variant: "line" }));
  push({ key: "fin-t", label: "Net cash from financing activities", amount: cf.netFinancing, level: 0, variant: "subtotal" });

  push({ key: "sp3", label: "", variant: "spacer" });
  push({ key: "net", label: "Net increase / (decrease) in cash", amount: cf.netChange, level: 0, variant: "subtotal" });
  push({ key: "open", label: "Opening cash & bank balance", amount: cf.openingCash, level: 0, variant: "line" });
  push({ key: "close", label: "Closing cash & bank balance", amount: cf.closingCash, level: 0, variant: "total" });

  return (
    <>
      <PageHeader
        title="Cash Flow Statement"
        subtitle="Indirect method — derived from the ledger so it always reconciles to cash on hand."
      />
      <KpiStrip
        items={[
          {
            label: "Operating",
            value: cf.netOperating,
            colored: true,
            detailTitle: "Operating drivers",
            detail: [
              { label: "Net profit", value: cf.netProfit },
              ...cf.operating.map((r) => ({ label: r.name, value: r.amount })),
            ],
          },
          {
            label: "Investing",
            value: cf.netInvesting,
            colored: true,
            detailTitle: "Investing",
            detail: cf.investing.length
              ? cf.investing.map((r) => ({ label: r.name, value: r.amount }))
              : [{ label: "No investing activity", hint: "—" }],
          },
          {
            label: "Financing",
            value: cf.netFinancing,
            colored: true,
            detailTitle: "Financing",
            detail: cf.financing.length
              ? cf.financing.map((r) => ({ label: r.name, value: r.amount }))
              : [{ label: "No financing activity", hint: "—" }],
          },
          {
            label: "Closing Cash",
            value: cf.closingCash,
            detailTitle: "Movement",
            detail: [
              { label: "Opening cash", value: cf.openingCash },
              { label: "Net change", value: cf.netChange },
              { label: "Closing cash", value: cf.closingCash },
            ],
          },
        ]}
      />
      <ReportControls ctl={ctl} />
      <StatementView
        title="Cash Flow Statement"
        scopeLabel={ctl.scopeLabel}
        periodLabel={ctl.periodLabel}
        basisLabel={ctl.basisLabel}
        rows={rows}
      />
    </>
  );
}
