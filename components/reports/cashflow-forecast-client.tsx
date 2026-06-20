"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Wallet, AlertTriangle, Download, ArrowDownToLine, ArrowUpFromLine } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { downloadCsv } from "@/lib/export";
import { projectedCashflow, AS_ON, type CashflowForecast } from "@/lib/finance/cashflow-forecast";

export function CashflowForecastClient() {
  const [mounted, setMounted] = React.useState(false);
  const [includeGst, setIncludeGst] = React.useState(true);
  React.useEffect(() => setMounted(true), []);

  // GL-derived opening cash reads localStorage continuations, so compute post-mount.
  const fc = React.useMemo<CashflowForecast | null>(() => (mounted ? projectedCashflow(AS_ON, 8, includeGst) : null), [mounted, includeGst]);

  function exportCsv() {
    if (!fc) return;
    downloadCsv(
      "cashflow-forecast",
      ["Period", "Opening", "AR receipts", "AP payments", "Payroll", "Statutory", "GST", "Net", "Closing"],
      fc.buckets.map((b) => [
        b.label, Math.round(b.opening), Math.round(b.inflowAr), Math.round(b.outflowAp),
        Math.round(b.outflowPayroll), Math.round(b.outflowStatutory), Math.round(b.outflowGst), Math.round(b.net), Math.round(b.closing),
      ]),
    );
  }

  return (
    <>
      <PageHeader
        title="Projected Cash Flow"
        subtitle={`8-week liquidity forecast from open AR/AP and payroll · opening cash as on ${formatDate(AS_ON)}`}
        actions={
          <div className="flex items-center gap-3">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <span className={cn("font-medium", includeGst ? "text-foreground" : "text-muted-foreground")}>GST remittance</span>
              <button
                type="button"
                role="switch"
                aria-checked={includeGst}
                onClick={() => setIncludeGst((v) => !v)}
                className={cn("relative inline-flex h-6 w-11 items-center rounded-full transition-colors", includeGst ? "bg-primary" : "bg-muted")}
              >
                <span className={cn("inline-block size-5 transform rounded-full bg-white shadow transition-transform", includeGst ? "translate-x-5" : "translate-x-0.5")} />
              </button>
            </label>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!fc}><Download className="size-4" /> Export CSV</Button>
          </div>
        }
      />

      {fc && (
        <>
          {/* Summary */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Wallet} label="Opening cash" value={fc.openingCash} />
            <Stat icon={ArrowDownToLine} label="Expected receipts" value={fc.totalIn} tone="success" />
            <Stat icon={ArrowUpFromLine} label="Expected payments" value={fc.totalOut} tone="danger" />
            <Stat icon={fc.endingCash >= fc.openingCash ? TrendingUp : TrendingDown} label="Projected ending cash" value={fc.endingCash} highlight />
          </div>

          {/* Liquidity banner */}
          <Card className={cn("mb-4 flex flex-wrap items-center gap-3 p-4", fc.hasShortfall ? "border-danger/30 bg-danger/5" : "border-success/30 bg-success/5")}>
            <span className={cn("flex size-10 items-center justify-center rounded-xl", fc.hasShortfall ? "bg-danger/15 text-danger" : "bg-success/15 text-success")}>
              {fc.hasShortfall ? <AlertTriangle className="size-5" /> : <TrendingUp className="size-5" />}
            </span>
            <div className="min-w-0 flex-1 text-sm">
              {fc.hasShortfall ? (
                <p><span className="font-semibold text-danger">Projected cash shortfall.</span> Cash dips to <Money value={fc.lowestClosing} className="font-medium" /> in <b>{fc.lowestLabel}</b> — arrange a buffer or accelerate collections.</p>
              ) : (
                <p><span className="font-semibold text-success">Liquidity stays positive.</span> Lowest projected balance is <Money value={fc.lowestClosing} className="font-medium" /> in <b>{fc.lowestLabel}</b>.</p>
              )}
            </div>
          </Card>

          {/* Forecast table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Period</th>
                    <th className="px-4 py-3 text-right font-medium">Opening</th>
                    <th className="px-4 py-3 text-right font-medium">AR in</th>
                    <th className="px-4 py-3 text-right font-medium">AP out</th>
                    <th className="px-4 py-3 text-right font-medium">Payroll</th>
                    <th className="px-4 py-3 text-right font-medium">Statutory</th>
                    <th className="px-4 py-3 text-right font-medium">GST</th>
                    <th className="px-4 py-3 text-right font-medium">Net</th>
                    <th className="px-4 py-3 text-right font-medium">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  {fc.buckets.map((b) => (
                    <tr key={b.label} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{b.label}</div>
                        <div className="text-[11px] text-muted-foreground">{formatDate(b.start)} – {formatDate(b.end)}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular text-muted-foreground"><Money value={b.opening} /></td>
                      <td className="px-4 py-2.5 text-right tabular text-success">{b.inflowAr ? <Money value={b.inflowAr} /> : <Dash />}</td>
                      <td className="px-4 py-2.5 text-right tabular">{b.outflowAp ? <Money value={b.outflowAp} /> : <Dash />}</td>
                      <td className="px-4 py-2.5 text-right tabular">{b.outflowPayroll ? <Money value={b.outflowPayroll} /> : <Dash />}</td>
                      <td className="px-4 py-2.5 text-right tabular">{b.outflowStatutory ? <Money value={b.outflowStatutory} /> : <Dash />}</td>
                      <td className="px-4 py-2.5 text-right tabular">{b.outflowGst ? <Money value={b.outflowGst} /> : <Dash />}</td>
                      <td className={cn("px-4 py-2.5 text-right tabular font-medium", b.net < 0 ? "text-danger" : "text-success")}>
                        <Money value={b.net} colored bracketNegatives />
                      </td>
                      <td className={cn("px-4 py-2.5 text-right tabular font-semibold", b.closing < 0 && "text-danger")}>
                        <Money value={b.closing} bracketNegatives />
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td className="px-4 py-3">Horizon total</td>
                    <td className="px-4 py-3 text-right tabular text-muted-foreground"><Money value={fc.openingCash} /></td>
                    <td className="px-4 py-3 text-right tabular text-success"><Money value={fc.totalIn} /></td>
                    <td className="px-4 py-3 text-right tabular" colSpan={4}><Money value={fc.totalOut} /> out</td>
                    <td className="px-4 py-3 text-right tabular"><Money value={fc.totalIn - fc.totalOut} colored bracketNegatives /></td>
                    <td className="px-4 py-3 text-right tabular"><Money value={fc.endingCash} bracketNegatives /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Receipts/payments are timed to each open invoice and bill&apos;s due date (overdue items fall in the first week).
            Payroll net pay lands at month-end, statutory dues (TDS/PF/PT) on the ~10th and GST (output − eligible ITC) on the 20th of the following month. Indicative — a planning aid, not a commitment.
          </p>
        </>
      )}
    </>
  );
}

function Dash() {
  return <span className="text-muted-foreground/40">—</span>;
}

function Stat({ icon: Icon, label, value, tone, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone?: "success" | "danger"; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", highlight && "border-primary/30 bg-primary/5")}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("size-3.5", tone === "success" && "text-success", tone === "danger" && "text-danger")} /> {label}
      </p>
      <p className={cn("mt-1 text-xl font-bold tabular", tone === "success" && "text-success", tone === "danger" && "text-danger")}>
        <Money value={value} bracketNegatives />
      </p>
    </Card>
  );
}
