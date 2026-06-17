"use client";

import { useReport } from "@/components/reports/use-report";
import { ReportControls } from "@/components/reports/report-controls";
import { StatementView, type StatementRow } from "@/components/reports/statement-view";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { Info } from "lucide-react";
import { buildBalanceSheet, outstandingControl, type Section } from "@/lib/accounting/reports";
import { KpiStrip } from "./kpi-strip";

export function BalanceSheetClient() {
  const ctl = useReport();
  const bs = buildBalanceSheet(ctl.filters);
  const isCash = ctl.filters.basis === "cash";
  const outstanding = outstandingControl(ctl.filters);

  const rows: StatementRow[] = [];
  const push = (r: StatementRow) => rows.push(r);

  const renderSections = (secs: Section[]) =>
    secs.forEach((s) => {
      push({ key: `g-${s.label}`, label: s.label, level: 1, variant: "group" });
      s.rows.forEach((r) =>
        push({ key: r.code, label: r.name, amount: r.amount, level: 2, variant: "line" }),
      );
      push({ key: `t-${s.label}`, label: `Total ${s.label}`, amount: s.total, level: 1, variant: "subtotal" });
    });

  push({ key: "assets", label: "ASSETS", level: 0, variant: "group" });
  renderSections(bs.assets);
  push({ key: "ta", label: "Total Assets", amount: bs.totalAssets, level: 0, variant: "total" });

  push({ key: "sp1", label: "", variant: "spacer" });
  push({ key: "liab", label: "LIABILITIES", level: 0, variant: "group" });
  renderSections(bs.liabilities);
  push({ key: "tl", label: "Total Liabilities", amount: bs.totalLiabilities, level: 0, variant: "subtotal" });

  push({ key: "sp2", label: "", variant: "spacer" });
  push({ key: "eq", label: "EQUITY", level: 0, variant: "group" });
  bs.equity.forEach((s) =>
    s.rows.forEach((r) => push({ key: r.code, label: r.name, amount: r.amount, level: 2, variant: "line" })),
  );
  push({ key: "re", label: "Retained Earnings (incl. current period)", amount: bs.retainedEarnings, level: 2, variant: "line" });
  push({ key: "teq", label: "Total Equity", amount: bs.totalEquity, level: 0, variant: "subtotal" });

  push({ key: "sp3", label: "", variant: "spacer" });
  push({ key: "tle", label: "Total Liabilities & Equity", amount: bs.totalLiabAndEquity, level: 0, variant: "total" });

  const balanced = Math.abs(bs.check) < 1;

  return (
    <>
      <PageHeader
        title="Balance Sheet"
        subtitle="Statement of financial position as at a date."
        actions={
          <Badge variant={balanced ? "success" : "danger"}>
            {balanced ? "Balanced" : `Out by ${bs.check.toFixed(0)}`}
          </Badge>
        }
      />
      <KpiStrip
        items={[
          {
            label: "Total Assets",
            value: bs.totalAssets,
            detailTitle: "Asset classes",
            detail: bs.assets.map((s) => ({ label: s.label, value: s.total })),
          },
          {
            label: "Total Liabilities",
            value: bs.totalLiabilities,
            detailTitle: "Liability classes",
            detail: bs.liabilities.map((s) => ({ label: s.label, value: s.total })),
          },
          {
            label: "Total Equity",
            value: bs.totalEquity,
            detailTitle: "Equity",
            detail: [
              ...bs.equity.map((s) => ({ label: s.label, value: s.total })),
              { label: "Retained earnings", value: bs.retainedEarnings },
            ],
          },
          { label: "Retained Earnings", value: bs.retainedEarnings, colored: true },
        ]}
      />
      <ReportControls ctl={ctl} asOf />
      {isCash && (outstanding.receivables !== 0 || outstanding.payables !== 0) && (
        <Card className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-dashed bg-muted/30 p-4 text-sm">
          <span className="flex items-center gap-2 font-medium">
            <Info className="size-4 text-muted-foreground" />
            Memo — not part of the cash-basis books
          </span>
          <span className="text-muted-foreground">
            Cash basis carries no receivables or payables. Under accrual, outstanding as at{" "}
            {ctl.period.to}:
          </span>
          <span className="flex items-center gap-1.5">
            Receivables <Money value={outstanding.receivables} className="font-semibold" />
          </span>
          <span className="flex items-center gap-1.5">
            Payables <Money value={outstanding.payables} className="font-semibold" />
          </span>
        </Card>
      )}
      <StatementView
        title="Balance Sheet"
        subtitle={`As at ${ctl.period.to}`}
        scopeLabel={ctl.scopeLabel}
        periodLabel={`As at ${ctl.periodLabel.split("–")[1].trim()}`}
        basisLabel={ctl.basisLabel}
        rows={rows}
      />
    </>
  );
}
