"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { buildTrialBalance, type TrialBalanceLine } from "@/lib/accounting/trial-balance";
import type { Basis } from "@/lib/accounting/types";
import { ENTITIES } from "@/lib/accounting/org";
import { cn } from "@/lib/utils";
import { Download, Printer, Filter } from "lucide-react";

const FY_FROM = "2026-04-01";
const FY_TO = "2026-06-22";

type ColView = "all" | "period" | "closing";

export function TrialBalanceClient() {
  const [entityId, setEntityId] = useState("all");
  const [basis, setBasis] = useState<Basis>("accrual");
  const [from, setFrom] = useState(FY_FROM);
  const [to, setTo] = useState(FY_TO);
  const [colView, setColView] = useState<ColView>("all");
  const [typeFilter, setTypeFilter] = useState("all");

  const tb = buildTrialBalance({ entityId, locationId: "all", basis, from, to });

  const filteredLines = tb.lines.filter((l) => typeFilter === "all" || l.type === typeFilter);

  function exportCsv() {
    const header = "Code,Name,Type,Opening Dr,Opening Cr,Period Dr,Period Cr,Closing Dr,Closing Cr";
    const rows = tb.lines.map((l) =>
      [l.code, `"${l.name}"`, l.type, l.openingDebit.toFixed(2), l.openingCredit.toFixed(2),
        l.periodDebit.toFixed(2), l.periodCredit.toFixed(2), l.closingDebit.toFixed(2), l.closingCredit.toFixed(2)].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "trial-balance.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  const thCls = "px-3 py-2 text-right text-xs font-semibold text-muted-foreground bg-muted/50 border-b";
  const thLCls = "px-3 py-2 text-left text-xs font-semibold text-muted-foreground bg-muted/50 border-b";
  const tdCls = "px-3 py-1.5 text-right tabular-nums text-sm";
  const tdLCls = "px-3 py-1.5 text-left text-sm";

  return (
    <>
      <PageHeader
        title="Trial Balance"
        subtitle="Aggregate debit and credit balances for all GL accounts."
        actions={
          <Badge variant={tb.balanced ? "success" : "danger"}>
            {tb.balanced ? "Balanced" : "Out of balance"}
          </Badge>
        }
      />

      {/* Controls */}
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <Filter className="size-4 text-muted-foreground" />
        <select className="rounded border bg-background px-2 py-1 text-sm" value={entityId} onChange={(e) => setEntityId(e.target.value)}>
          <option value="all">All entities</option>
          {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
        </select>
        <select className="rounded border bg-background px-2 py-1 text-sm" value={basis} onChange={(e) => setBasis(e.target.value as Basis)}>
          <option value="accrual">Accrual</option>
          <option value="cash">Cash</option>
        </select>
        <input type="date" className="rounded border bg-background px-2 py-1 text-sm" value={from} onChange={(e) => setFrom(e.target.value)} />
        <span className="text-muted-foreground text-sm">to</span>
        <input type="date" className="rounded border bg-background px-2 py-1 text-sm" value={to} onChange={(e) => setTo(e.target.value)} />
        <select className="rounded border bg-background px-2 py-1 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">All types</option>
          <option value="asset">Assets</option>
          <option value="liability">Liabilities</option>
          <option value="equity">Equity</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
        <div className="ml-auto flex gap-2">
          {(["all", "period", "closing"] as ColView[]).map((v) => (
            <Button key={v} size="sm" variant={colView === v ? "primary" : "outline"} onClick={() => setColView(v)}>
              {v === "all" ? "Full view" : v === "period" ? "Period" : "Closing"}
            </Button>
          ))}
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="size-4 mr-1" />CSV</Button>
          <Button size="sm" variant="outline" onClick={() => window.print()}><Printer className="size-4 mr-1" />Print</Button>
        </div>
      </Card>

      {/* Table */}
      <div className="rounded-lg border bg-card shadow-sm overflow-x-auto">
        <table className="w-full min-w-[800px] border-collapse">
          <thead>
            <tr>
              <th className={thLCls} rowSpan={2}>Code</th>
              <th className={thLCls} rowSpan={2}>Account</th>
              {(colView === "all" || colView === "period") && (
                <>
                  {colView === "all" && <th className={cn(thCls, "border-l")} colSpan={2}>Opening</th>}
                  <th className={cn(thCls, "border-l")} colSpan={2}>Period</th>
                </>
              )}
              <th className={cn(thCls, "border-l")} colSpan={2}>Closing</th>
            </tr>
            <tr>
              {colView === "all" && (
                <>
                  <th className={cn(thCls, "border-l")}>Dr</th>
                  <th className={thCls}>Cr</th>
                </>
              )}
              {(colView === "all" || colView === "period") && (
                <>
                  <th className={cn(thCls, colView === "all" ? "border-l" : "border-l")}>Dr</th>
                  <th className={thCls}>Cr</th>
                </>
              )}
              <th className={cn(thCls, "border-l")}>Dr</th>
              <th className={thCls}>Cr</th>
            </tr>
          </thead>
          <tbody>
            {filteredLines.map((l) => (
              <TbRow key={l.code} l={l} colView={colView} tdCls={tdCls} tdLCls={tdLCls} />
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/50 bg-muted/40 font-semibold">
              <td className={tdLCls} colSpan={2}>Total</td>
              {colView === "all" && (
                <>
                  <td className={cn(tdCls, "border-l")}><Money value={tb.totalOpeningDebit} /></td>
                  <td className={tdCls}><Money value={tb.totalOpeningCredit} /></td>
                </>
              )}
              {(colView === "all" || colView === "period") && (
                <>
                  <td className={cn(tdCls, "border-l")}><Money value={tb.totalPeriodDebit} /></td>
                  <td className={tdCls}><Money value={tb.totalPeriodCredit} /></td>
                </>
              )}
              <td className={cn(tdCls, "border-l")}><Money value={tb.totalClosingDebit} /></td>
              <td className={tdCls}><Money value={tb.totalClosingCredit} /></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!tb.balanced && (
        <Card className="mt-4 border-destructive bg-destructive/5 p-4 text-sm text-destructive">
          Trial balance is out of balance by{" "}
          <Money value={Math.abs(tb.totalClosingDebit - tb.totalClosingCredit)} className="font-semibold" />.
          Check for missing or duplicate postings.
        </Card>
      )}
    </>
  );
}

function TbRow({
  l, colView, tdCls, tdLCls,
}: {
  l: TrialBalanceLine;
  colView: ColView;
  tdCls: string;
  tdLCls: string;
}) {
  const typeColors: Record<string, string> = {
    asset: "text-sky-700 dark:text-sky-400",
    liability: "text-rose-700 dark:text-rose-400",
    equity: "text-violet-700 dark:text-violet-400",
    income: "text-emerald-700 dark:text-emerald-400",
    expense: "text-amber-700 dark:text-amber-400",
  };

  return (
    <tr className="border-b border-border/40 hover:bg-muted/20">
      <td className={cn(tdLCls, "font-mono text-xs text-muted-foreground")}>{l.code}</td>
      <td className={tdLCls}>
        <span>{l.name}</span>
        <span className={cn("ml-2 text-[10px] font-medium uppercase", typeColors[l.type])}>{l.type}</span>
      </td>
      {colView === "all" && (
        <>
          <td className={cn(tdCls, "border-l")}>{l.openingDebit > 0 ? <Money value={l.openingDebit} /> : "–"}</td>
          <td className={tdCls}>{l.openingCredit > 0 ? <Money value={l.openingCredit} /> : "–"}</td>
        </>
      )}
      {(colView === "all" || colView === "period") && (
        <>
          <td className={cn(tdCls, "border-l")}>{l.periodDebit > 0 ? <Money value={l.periodDebit} /> : "–"}</td>
          <td className={tdCls}>{l.periodCredit > 0 ? <Money value={l.periodCredit} /> : "–"}</td>
        </>
      )}
      <td className={cn(tdCls, "border-l")}>{l.closingDebit > 0 ? <Money value={l.closingDebit} /> : "–"}</td>
      <td className={tdCls}>{l.closingCredit > 0 ? <Money value={l.closingCredit} /> : "–"}</td>
    </tr>
  );
}
