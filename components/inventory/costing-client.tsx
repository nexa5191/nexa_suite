"use client";

import * as React from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Minus, Clock, PackageX, Calculator, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ITEMS, CATEGORY_META, itemById } from "@/lib/inventory/items";
import { allMovements, loadAddedMovements } from "@/lib/inventory/movements";
import { allGRNs, loadGRNs } from "@/lib/inventory/supply-chain";
import {
  buildLotRegister,
  computeWACOG,
  computeStockAgeing,
  computeDIO,
  AGE_BAND_META,
  PERIOD_DAYS,
  type ItemWACOG,
  type ItemAgeing,
  type AgeBand,
} from "@/lib/inventory/costing";

function fmtN(n: number, dec = 0) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: dec }).format(n);
}
function fmtRate(n: number) {
  return `₹${fmtN(n, 2)}`;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export function CostingClient() {
  const [tab, setTab] = React.useState<"wacog" | "ageing">("wacog");
  const [sortCol, setSortCol] = React.useState<"variance" | "onHand" | "value">("variance");
  const [sortDir, setSortDir] = React.useState<1 | -1>(-1);

  // Compute on mount (localStorage data)
  const [wacog, setWacog] = React.useState<Map<string, ItemWACOG>>(new Map());
  const [ageing, setAgeing] = React.useState<Map<string, ItemAgeing>>(new Map());
  const [dio, setDio] = React.useState({ dio: 0, stockValue: 0, dailyCOGS: 0, periodDays: PERIOD_DAYS, totalCOGS: 0 });

  React.useEffect(() => {
    const mvs = allMovements(loadAddedMovements());
    const grns = allGRNs(loadGRNs());
    const lots = buildLotRegister(mvs, grns);
    const w = computeWACOG(lots);
    const a = computeStockAgeing(lots);
    const d = computeDIO(mvs, w);
    setWacog(w);
    setAgeing(a);
    setDio(d);
  }, []);

  const wacogRows = ITEMS.map((it) => wacog.get(it.id)).filter(Boolean) as ItemWACOG[];
  const ageingRows = ITEMS.map((it) => ageing.get(it.id)).filter(Boolean) as ItemAgeing[];

  // Totals for WACOG footer
  const totalValueWacog = wacogRows.reduce((s, w) => s + w.valueAtWacog, 0);
  const totalValueStd   = wacogRows.reduce((s, w) => s + w.valueAtStd, 0);
  const totalVariance   = wacogRows.reduce((s, w) => s + w.totalVariance, 0);

  // Value at risk (slow + excess ageing)
  const atRisk = ageingRows.reduce((s, a) => {
    const b = a.buckets.find((b) => b.band === "slow");
    const c = a.buckets.find((b) => b.band === "excess");
    return s + (b?.value ?? 0) + (c?.value ?? 0);
  }, 0);

  // Sort WACOG rows
  const sortedWacog = [...wacogRows].sort((a, b) => {
    const av = sortCol === "variance" ? a.totalVariance : sortCol === "onHand" ? a.onHand : a.valueAtWacog;
    const bv = sortCol === "variance" ? b.totalVariance : sortCol === "onHand" ? b.onHand : b.valueAtWacog;
    return sortDir * (bv - av);
  });

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortDir((d) => (d === 1 ? -1 : 1));
    else { setSortCol(col); setSortDir(-1); }
  }

  return (
    <>
      <PageHeader
        title="Inventory Costing"
        subtitle="WACOG lot valuation, stock ageing, and Days Inventory Outstanding."
        actions={
          <Link href="/inventory">
            <Button variant="outline"><ArrowLeft className="size-4" /> Back to Inventory</Button>
          </Link>
        }
      />

      {/* DIO + key metrics */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <Card className="p-4 border-primary/30 bg-primary/5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Clock className="size-3.5" /> Days Inventory Outstanding
          </p>
          <p className="mt-1 text-4xl font-bold tabular text-primary">{dio.dio}d</p>
          <p className="mt-1 text-xs text-muted-foreground">
            ₹{fmtN(dio.stockValue / 1e5, 1)}L stock ÷ ₹{fmtN(dio.dailyCOGS / 1000, 0)}K/day COGS
          </p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            Based on {dio.periodDays}d of movements ({new Date("2026-04-01").toLocaleDateString("en-IN", { month: "short", day: "numeric" })} → today)
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Calculator className="size-3.5" /> Stock at WACOG
          </p>
          <p className="mt-1 text-2xl font-bold tabular"><Money value={totalValueWacog} /></p>
          <p className={cn("mt-1 flex items-center gap-1 text-xs font-medium", totalVariance < 0 ? "text-success" : totalVariance > 0 ? "text-danger" : "text-muted-foreground")}>
            {totalVariance < 0 ? <TrendingDown className="size-3.5" /> : totalVariance > 0 ? <TrendingUp className="size-3.5" /> : <Minus className="size-3.5" />}
            {totalVariance < 0 ? "Favorable" : totalVariance > 0 ? "Adverse" : "Nil"} vs std:&nbsp;
            <Money value={Math.abs(totalVariance)} />
          </p>
        </Card>
        <Card className="p-4 border-warning/30 bg-warning/5">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <PackageX className="size-3.5" /> Ageing risk (slow + excess)
          </p>
          <p className="mt-1 text-2xl font-bold tabular"><Money value={atRisk} /></p>
          <p className="mt-1 text-xs text-muted-foreground">
            Stock older than 90 days — review for write-off or markdown
          </p>
        </Card>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1">
        {(["wacog", "ageing"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {t === "wacog" ? "WACOG Analysis" : "Stock Ageing"}
          </button>
        ))}
      </div>

      {tab === "wacog" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">Cat</th>
                  <th className="px-5 py-3 text-right font-medium">Std ₹/unit</th>
                  <th className="px-5 py-3 text-right font-medium">WACOG ₹/unit</th>
                  <th className="px-5 py-3 text-right font-medium">Var ₹</th>
                  <th className="px-5 py-3 text-right font-medium">Var %</th>
                  <SortTh label="On hand" col="onHand" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Value (WACOG)" col="value" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                  <SortTh label="Σ Variance" col="variance" sortCol={sortCol} sortDir={sortDir} onSort={toggleSort} />
                </tr>
              </thead>
              <tbody>
                {sortedWacog.map((w) => {
                  const item = itemById(w.itemId)!;
                  const meta = CATEGORY_META[item.category];
                  const adv = w.variance > 0;
                  const fav = w.variance < 0;
                  const nil = w.variance === 0 || Math.abs(w.variancePct) < 0.1;
                  return (
                    <tr key={w.itemId} className="border-b last:border-0 hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium">{item.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{item.code}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={meta.variant} className="text-[10px]">{meta.short}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">{fmtRate(w.stdRate)}</td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold">{fmtRate(w.wacog)}</td>
                      <td className={cn("px-5 py-3 text-right tabular-nums text-xs font-medium", adv ? "text-danger" : fav ? "text-success" : "text-muted-foreground")}>
                        {nil ? "—" : (adv ? "+" : "") + fmtRate(w.variance)}
                      </td>
                      <td className={cn("px-5 py-3 text-right tabular-nums text-xs", adv ? "text-danger" : fav ? "text-success" : "text-muted-foreground")}>
                        {nil ? "—" : (adv ? "+" : "") + w.variancePct.toFixed(1) + "%"}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-xs text-muted-foreground">
                        {fmtN(w.onHand, 0)} {item.uom}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        <Money value={w.valueAtWacog} className="font-semibold" />
                      </td>
                      <td className={cn("px-5 py-3 text-right tabular-nums font-semibold", adv ? "text-danger" : fav ? "text-success" : "text-muted-foreground")}>
                        {nil ? <span className="font-normal text-muted-foreground">—</span> : (
                          <>
                            {adv ? "+" : ""}
                            <Money value={w.totalVariance} />
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/20 font-semibold text-xs">
                  <td className="px-5 py-3" colSpan={7}>Total</td>
                  <td className="px-5 py-3 text-right tabular-nums"><Money value={totalValueWacog} /></td>
                  <td className={cn("px-5 py-3 text-right tabular-nums", totalVariance < 0 ? "text-success" : totalVariance > 0 ? "text-danger" : "text-muted-foreground")}>
                    {totalVariance !== 0 && (totalVariance > 0 ? "+" : "")}
                    <Money value={totalVariance} />
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="border-t bg-muted/20 px-5 py-3">
            <p className="text-[11px] text-muted-foreground">
              WACOG = Weighted Average Cost of Goods on hand across all open lots (FIFO-depleted). Variance = WACOG − Standard rate.
              Favorable (green) means actual cost is below standard; adverse (red) means above.
              Prices come from unit price entered on GRN lines; seed data uses known purchase variances for demonstration.
            </p>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 font-medium">Cat</th>
                  <th className="px-5 py-3 text-right font-medium">On hand</th>
                  <th className="px-5 py-3 text-right font-medium">0–30 d</th>
                  <th className="px-5 py-3 text-right font-medium">31–90 d</th>
                  <th className="px-5 py-3 text-right font-medium">91–180 d</th>
                  <th className="px-5 py-3 text-right font-medium">&gt; 180 d</th>
                  <th className="px-5 py-3 text-right font-medium">Oldest</th>
                  <th className="px-5 py-3 font-medium">Risk</th>
                </tr>
              </thead>
              <tbody>
                {ageingRows.map((a) => {
                  const item = itemById(a.itemId)!;
                  const meta = CATEGORY_META[item.category];
                  const riskMeta = AGE_BAND_META[a.riskBand];
                  if (a.onHand <= 0) return null;
                  return (
                    <tr key={a.itemId} className="border-b last:border-0 hover:bg-accent/40 transition-colors">
                      <td className="px-5 py-3">
                        <p className="font-medium">{item.name}</p>
                        <p className="font-mono text-[11px] text-muted-foreground">{item.code}</p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={meta.variant} className="text-[10px]">{meta.short}</Badge>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums text-xs">
                        {fmtN(a.onHand, 0)} {item.uom}
                      </td>
                      {a.buckets.map((b) => (
                        <td key={b.band} className="px-5 py-3 text-right">
                          {b.qty > 0 ? (
                            <div className={cn("rounded px-1.5 py-0.5 text-xs tabular-nums inline-block", AGE_BAND_META[b.band].bgColor, AGE_BAND_META[b.band].color)}>
                              {fmtN(b.qty, 0)}
                              <span className="ml-1 text-[10px] opacity-70">{item.uom}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground/40">—</span>
                          )}
                        </td>
                      ))}
                      <td className="px-5 py-3 text-right tabular-nums text-xs text-muted-foreground">
                        {a.oldestDays}d
                      </td>
                      <td className="px-5 py-3">
                        <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", riskMeta.bgColor, riskMeta.color)}>
                          {riskMeta.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="border-t bg-muted/20 px-5 py-3">
            <div className="flex flex-wrap gap-4 text-[11px] text-muted-foreground">
              {(["fresh", "normal", "slow", "excess"] as AgeBand[]).map((b) => (
                <span key={b} className="flex items-center gap-1.5">
                  <span className={cn("size-2 rounded-full", AGE_BAND_META[b].bgColor.replace("/10", "").replace("bg-", "bg-") + " border " + AGE_BAND_META[b].color.replace("text-", "border-"))} />
                  {AGE_BAND_META[b].label} = {AGE_BAND_META[b].label.toLowerCase()} stock
                </span>
              ))}
              <span>Age = days since GRN receipt date (FIFO-depleted).</span>
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sortable header cell
// ---------------------------------------------------------------------------
function SortTh({
  label, col, sortCol, sortDir, onSort,
}: {
  label: string;
  col: "variance" | "onHand" | "value";
  sortCol: string;
  sortDir: 1 | -1;
  onSort: (col: "variance" | "onHand" | "value") => void;
}) {
  const active = sortCol === col;
  return (
    <th
      className="cursor-pointer select-none px-5 py-3 text-right font-medium hover:text-foreground transition-colors"
      onClick={() => onSort(col)}
    >
      {label} {active ? (sortDir === -1 ? "↓" : "↑") : "↕"}
    </th>
  );
}
