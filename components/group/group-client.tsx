"use client";

import * as React from "react";
import { Layers, ArrowLeftRight, Globe, CheckCircle2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { KpiStrip } from "@/components/accounting/kpi-strip";
import { useReport } from "@/components/reports/use-report";
import { ReportControls } from "@/components/reports/report-controls";
import { cn } from "@/lib/utils";
import {
  allIc,
  loadCreatedIc,
  loadSettlements,
  type IcTransaction,
} from "@/lib/intercompany/intercompany";
import { consolidate, type ConsolRow, type Consolidation } from "@/lib/intercompany/consolidation";

export function GroupClient() {
  const ctl = useReport();
  const [txns, setTxns] = React.useState<IcTransaction[]>([]);
  const [settled, setSettled] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => {
    setTxns(allIc(loadCreatedIc()));
    setSettled(loadSettlements());
  }, []);

  const c: Consolidation = React.useMemo(
    () => consolidate(txns, settled, ctl.filters.from, ctl.filters.to, ctl.filters.basis),
    [txns, settled, ctl.filters.from, ctl.filters.to, ctl.filters.basis],
  );

  const totalElim = c.eliminations.icSales + c.eliminations.icServices;
  const npRow = c.pnl.find((r) => r.kind === "total");

  return (
    <>
      <PageHeader
        title="Group Reporting"
        subtitle="Consolidated financials across all three entities — inter-company dealings eliminated, Nexa Global translated to INR."
        actions={
          <Link href="/group/intercompany">
            <Button variant="outline">
              <ArrowLeftRight className="size-4" /> Inter-company
            </Button>
          </Link>
        }
      />

      <ReportControls ctl={ctl} />

      <KpiStrip
        items={[
          {
            label: "Group revenue",
            value: c.pnl[0].consolidated,
            detailTitle: "By entity",
            detail: c.entityNames.map((n, i) => ({ label: n, value: c.pnl[0].perEntity[i] })),
          },
          {
            label: "Group net profit",
            value: c.groupNetProfit,
            colored: true,
            ...(npRow && {
              detailTitle: "By entity",
              detail: c.entityNames.map((n, i) => ({ label: n, value: npRow.perEntity[i] })),
            }),
          },
          { label: "Group assets", value: c.groupAssets },
          {
            label: "IC eliminations (P&L)",
            value: totalElim,
            detailTitle: "Eliminations",
            detail: [
              { label: "Goods sales", value: c.eliminations.icSales },
              { label: "Services / royalties", value: c.eliminations.icServices },
              { label: "Trade balances (AR⇄AP)", value: c.eliminations.icTradeOutstanding },
              { label: "Loans", value: c.eliminations.icLoanOutstanding },
            ],
          },
        ]}
      />

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <ConsolTable title="Consolidated Profit & Loss" rows={c.pnl} names={c.entityNames} />
        <ConsolTable title="Consolidated Balance Sheet" rows={c.balanceSheet} names={c.entityNames} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <ArrowLeftRight className="size-4" /> Elimination entries
          </h3>
          <ElimLine label="Inter-company goods sales (revenue ⇄ COGS)" value={c.eliminations.icSales} />
          <ElimLine label="Inter-company services / royalties (income ⇄ opex)" value={c.eliminations.icServices} />
          <ElimLine label="Inter-company trade balances (AR ⇄ AP)" value={c.eliminations.icTradeOutstanding} />
          <ElimLine label="Inter-company loans (asset ⇄ liability)" value={c.eliminations.icLoanOutstanding} />
        </Card>

        <Card className="p-5">
          <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Globe className="size-4" /> Currency translation
          </h3>
          <p className="text-sm text-muted-foreground">
            Nexa Global is a Singapore (SGD) entity. Its results are translated to INR for the group. The residual on
            retranslating net assets at the closing rate is carried as a <strong>foreign-currency translation reserve</strong> within equity.
          </p>
          <div className="mt-3 flex items-center justify-between rounded-md bg-muted/50 px-3 py-2.5">
            <span className="text-sm font-medium">Translation reserve (CTA)</span>
            <Money value={c.cta} className="font-semibold" />
          </div>
          <div className={cn("mt-3 flex items-center gap-2 text-sm", Math.abs(c.bsCheck) < 1 ? "text-success" : "text-danger")}>
            {Math.abs(c.bsCheck) < 1 ? <CheckCircle2 className="size-4" /> : <AlertTriangle className="size-4" />}
            Balance sheet {Math.abs(c.bsCheck) < 1 ? "balances after eliminations" : `out by ₹${c.bsCheck.toFixed(0)}`}
          </div>
        </Card>
      </div>
    </>
  );
}

function ConsolTable({ title, rows, names }: { title: string; rows: ConsolRow[]; names: string[] }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
        <Layers className="size-4 text-muted-foreground" />
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      </div>
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-right text-[11px] uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-medium">Particulars</th>
              {names.map((n) => (
                <th key={n} className="px-3 py-2.5 font-medium">{n}</th>
              ))}
              <th className="px-3 py-2.5 font-medium text-warning">Elim.</th>
              <th className="px-3 py-2.5 font-medium">Group</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr
                key={r.label}
                className={cn(
                  "border-b last:border-0",
                  r.kind === "subtotal" && "bg-muted/20 font-medium",
                  r.kind === "total" && "border-t-2 bg-muted/30 font-semibold",
                )}
              >
                <td className="px-3 py-2 text-left">{r.label}</td>
                {r.perEntity.map((v, i) => (
                  <td key={i} className="px-3 py-2 text-right tabular text-muted-foreground">
                    <Money value={v} compact />
                  </td>
                ))}
                <td className="px-3 py-2 text-right tabular">
                  {Math.abs(r.elimination) < 1 ? <span className="text-muted-foreground/40">—</span> : <Money value={r.elimination} compact className="text-warning" bracketNegatives />}
                </td>
                <td className="px-3 py-2 text-right tabular font-semibold">
                  <Money value={r.consolidated} compact />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function ElimLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <Money value={value} className="font-medium tabular" />
    </div>
  );
}

