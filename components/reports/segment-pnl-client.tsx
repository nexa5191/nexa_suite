"use client";

import * as React from "react";
import { Building2, Download, PieChart } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/export";
import { ENTITIES } from "@/lib/accounting/org";
import { AS_ON } from "@/lib/finance/receivables";
import { segmentPnl, type SegmentPnl } from "@/lib/accounting/segments";

function fyStart(asOn: string): string {
  const [y, m] = asOn.split("-").map((x) => parseInt(x, 10));
  return `${m >= 4 ? y : y - 1}-04-01`;
}

export function SegmentPnlClient() {
  const [mounted, setMounted] = React.useState(false);
  const [entityId, setEntityId] = React.useState("all");
  const [periodMode, setPeriodMode] = React.useState<"fy" | "all">("fy");
  const [allocate, setAllocate] = React.useState(false);
  React.useEffect(() => setMounted(true), []);

  const range = periodMode === "fy" ? { from: fyStart(AS_ON), to: AS_ON } : { from: "", to: "" };
  const pnl = React.useMemo<SegmentPnl | null>(
    () => (mounted ? segmentPnl(entityId, range.from, range.to, allocate) : null),
    [mounted, entityId, range.from, range.to, allocate],
  );

  function exportCsv() {
    if (!pnl) return;
    const cols = ["Profit centre", "Entity", "Revenue", "COGS", "Gross margin", "Opex", "Operating profit"];
    if (allocate) cols.push("Allocated overhead", "Op profit (after alloc)");
    cols.push("Margin %");
    downloadCsv("segment-pnl", cols, pnl.rows.map((r) => {
      const base = [r.name, r.entityName, r.revenue, r.cogs, r.grossMargin, r.opex, r.operatingProfit];
      if (allocate) base.push(r.allocatedOverhead, r.operatingProfitAfter);
      base.push(`${Math.round(r.marginPct * 100)}%`);
      return base;
    }));
  }

  return (
    <>
      <PageHeader
        title="P&L by Segment"
        subtitle="Profit-centre contribution reporting (Controlling / CO-PA) — revenue, margin and operating profit per location."
        actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!pnl}><Download className="size-4" /> Export CSV</Button>}
      />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="w-48">
          <Label>Entity</Label>
          <Select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="mt-1">
            <option value="all">All entities</option>
            {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
          </Select>
        </div>
        <div className="w-44">
          <Label>Period</Label>
          <Select value={periodMode} onChange={(e) => setPeriodMode(e.target.value as "fy" | "all")} className="mt-1">
            <option value="fy">This FY to date</option>
            <option value="all">All time</option>
          </Select>
        </div>
        <label className="flex cursor-pointer items-center gap-2 pb-1 text-sm">
          <input type="checkbox" checked={allocate} onChange={(e) => setAllocate(e.target.checked)} className="size-4" />
          Allocate support-centre overhead by revenue
        </label>
      </Card>

      {pnl && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <Stat icon={Building2} label="Profit centres" value={String(pnl.rows.length)} />
            <Stat icon={PieChart} label="Total revenue" money={pnl.totalRevenue} />
            <Stat icon={PieChart} label="Operating profit" money={pnl.totalOpProfit} highlight />
          </div>

          <Card className="overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Profit centre</th>
                    <th className="px-4 py-3 text-right font-medium">Revenue</th>
                    <th className="px-4 py-3 text-right font-medium">COGS</th>
                    <th className="px-4 py-3 text-right font-medium">Gross margin</th>
                    <th className="px-4 py-3 text-right font-medium">Opex</th>
                    <th className="px-4 py-3 text-right font-medium">Op profit</th>
                    {allocate && <th className="px-4 py-3 text-right font-medium">Alloc. o/h</th>}
                    {allocate && <th className="px-4 py-3 text-right font-medium">Op profit (net)</th>}
                    <th className="px-4 py-3 text-right font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {pnl.rows.map((r) => (
                    <tr key={r.locationId} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2.5">
                        <div className="font-medium">{r.name}</div>
                        <div className="text-[11px] text-muted-foreground">{r.entityName}{r.revenue <= 0 ? " · support centre" : ""}</div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular">{r.revenue ? <Money value={r.revenue} /> : <Dash />}</td>
                      <td className="px-4 py-2.5 text-right tabular">{r.cogs ? <Money value={r.cogs} /> : <Dash />}</td>
                      <td className="px-4 py-2.5 text-right tabular">{r.grossMargin ? <Money value={r.grossMargin} /> : <Dash />}</td>
                      <td className="px-4 py-2.5 text-right tabular">{r.opex ? <Money value={r.opex} /> : <Dash />}</td>
                      <td className={cn("px-4 py-2.5 text-right tabular", r.operatingProfit < 0 && "text-danger")}><Money value={r.operatingProfit} bracketNegatives /></td>
                      {allocate && <td className="px-4 py-2.5 text-right tabular text-muted-foreground">{r.allocatedOverhead ? <Money value={r.allocatedOverhead} bracketNegatives /> : <Dash />}</td>}
                      {allocate && <td className={cn("px-4 py-2.5 text-right tabular font-medium", r.operatingProfitAfter < 0 && "text-danger")}><Money value={r.operatingProfitAfter} bracketNegatives /></td>}
                      <td className={cn("px-4 py-2.5 text-right tabular", r.marginPct < 0 ? "text-danger" : "text-success")}>{r.revenue > 0 ? `${Math.round(r.marginPct * 100)}%` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular"><Money value={pnl.totalRevenue} /></td>
                    <td colSpan={allocate ? 5 : 3} />
                    <td className="px-4 py-3 text-right tabular"><Money value={pnl.totalOpProfit} bracketNegatives /></td>
                    <td className="px-4 py-3 text-right tabular">{pnl.totalRevenue > 0 ? `${Math.round((pnl.totalOpProfit / pnl.totalRevenue) * 100)}%` : "—"}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Profit centres map to operating locations; every GL posting already carries one. Support centres (no revenue) can have
            their overhead allocated across revenue-bearing centres by revenue share.
          </p>
        </>
      )}
    </>
  );
}

function Dash() { return <span className="text-muted-foreground/40">—</span>; }

function Stat({ icon: Icon, label, value, money, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: string; money?: number; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", highlight && "border-primary/30 bg-primary/5")}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Icon className="size-3.5" /> {label}</p>
      <p className="mt-1 text-xl font-bold tabular">{money !== undefined ? <Money value={money} bracketNegatives /> : value}</p>
    </Card>
  );
}
