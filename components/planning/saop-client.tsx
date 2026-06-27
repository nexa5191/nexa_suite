"use client";

import * as React from "react";
import {
  TrendingUp, ChevronRight, CheckCircle2, Circle, ArrowRight,
  AlertTriangle, Info, BarChart3, Table2, Layers,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  loadCycles, saveCycles,
  nextStatus, STATUS_ORDER, STATUS_LABELS, cycleMonthLabels, sum12, sum3,
  type SaopCycle, type ForecastLine, type ReviewStatus,
} from "@/lib/planning/saop";

type Tab = "dashboard" | "forecast" | "balance";

// ---- Helpers ----------------------------------------------------------------
function fmtN(n: number, uom?: string) {
  const s = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
  return uom ? `${s} ${uom}` : s;
}

function coverDays(onHand: number, monthlyDemand: number): number {
  if (monthlyDemand <= 0) return 999;
  return Math.round((onHand / monthlyDemand) * 30);
}

type CoverStatus = "CRITICAL" | "LOW" | "OK" | "EXCESS";
function coverStatus(days: number): CoverStatus {
  if (days < 3) return "CRITICAL";
  if (days < 7) return "LOW";
  if (days > 45) return "EXCESS";
  return "OK";
}

const COVER_BADGE: Record<CoverStatus, "danger" | "warning" | "success" | "primary"> = {
  CRITICAL: "danger",
  LOW:      "warning",
  OK:       "success",
  EXCESS:   "primary",
};

function gapPct(sales3: number, ops3: number): number {
  if (ops3 === 0) return 0;
  return ((sales3 - ops3) / ops3) * 100;
}

// Which forecast row is editable for a given status
function editableField(status: ReviewStatus): keyof ForecastLine | null {
  if (status === "sales-review")   return "salesForecast";
  if (status === "ops-review")     return "opsForecast";
  if (status === "finance-review") return "consensusForecast";
  return null;
}

// ---- Status Pipeline --------------------------------------------------------
function Pipeline({ cycle }: { cycle: SaopCycle }) {
  const steps: { key: ReviewStatus; label: string; date: string | null }[] = [
    { key: "sales-review",   label: "Sales Review",   date: cycle.reviewDates.salesReview },
    { key: "ops-review",     label: "Ops Review",     date: cycle.reviewDates.opsReview },
    { key: "finance-review", label: "Finance Review", date: cycle.reviewDates.financeReview },
    { key: "approved",       label: "Approved",       date: cycle.reviewDates.approved },
  ];

  const currentIdx = STATUS_ORDER.indexOf(cycle.status);

  return (
    <div className="flex flex-wrap items-start gap-0">
      {steps.map((step, i) => {
        const stepIdx = STATUS_ORDER.indexOf(step.key);
        const done    = stepIdx < currentIdx || cycle.status === step.key && step.date !== null;
        const active  = cycle.status === step.key;
        return (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center gap-1 min-w-[7rem] px-2">
              <div className={cn(
                "flex size-8 items-center justify-center rounded-full border-2",
                done   ? "border-success bg-success/10 text-success" :
                active ? "border-primary bg-primary/10 text-primary" :
                         "border-muted-foreground/30 text-muted-foreground/40",
              )}>
                {done ? <CheckCircle2 className="size-4" /> : <Circle className="size-4" />}
              </div>
              <span className={cn(
                "text-xs font-medium text-center leading-tight",
                active && "text-primary",
                !done && !active && "text-muted-foreground/60",
              )}>{step.label}</span>
              {step.date && (
                <span className="text-[10px] text-muted-foreground">{step.date}</span>
              )}
            </div>
            {i < steps.length - 1 && (
              <div className="mt-3.5 flex-1 min-w-[1rem] border-t-2 border-dashed border-muted-foreground/20" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ---- Main component ---------------------------------------------------------
export function SaopClient() {
  const [cycles, setCycles]         = React.useState<SaopCycle[]>([]);
  const [selectedId, setSelectedId] = React.useState("saop-002");
  const [tab, setTab]               = React.useState<Tab>("dashboard");
  const [hydrated, setHydrated]     = React.useState(false);

  React.useEffect(() => {
    const loaded = loadCycles();
    setCycles(loaded);
    setHydrated(true);
  }, []);

  const cycle = cycles.find((c) => c.id === selectedId) ?? cycles[0];

  // ---- Mutations -------------------------------------------------------------
  function persist(next: SaopCycle[]) {
    setCycles(next);
    saveCycles(next);
  }

  function advance() {
    if (!cycle) return;
    const ns = nextStatus(cycle.status);
    if (!ns) return;
    const today = new Date().toISOString().slice(0, 10);
    const rd = { ...cycle.reviewDates };
    if (cycle.status === "sales-review")   rd.salesReview   = today;
    if (cycle.status === "ops-review")     rd.opsReview     = today;
    if (cycle.status === "finance-review") rd.financeReview = today;
    if (ns === "approved")                 rd.approved      = today;
    persist(cycles.map((c) => c.id === cycle.id ? { ...c, status: ns, reviewDates: rd } : c));
  }

  function updateCell(
    lineIdx: number,
    field: "salesForecast" | "opsForecast" | "consensusForecast",
    monthIdx: number,
    value: number,
  ) {
    if (!cycle) return;
    persist(
      cycles.map((c) => {
        if (c.id !== cycle.id) return c;
        const lines = c.lines.map((l, i) => {
          if (i !== lineIdx) return l;
          const arr = [...l[field]];
          arr[monthIdx] = isNaN(value) ? 0 : value;
          return { ...l, [field]: arr };
        });
        return { ...c, lines };
      }),
    );
  }

  if (!hydrated || !cycle) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  const monthLabels  = cycleMonthLabels(cycle.cycleMonth);
  const canAdvance   = nextStatus(cycle.status) !== null;
  const editable     = editableField(cycle.status);

  // ---- TABS -----------------------------------------------------------------
  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "dashboard", label: "Dashboard",            icon: BarChart3 },
    { id: "forecast",  label: "Forecast Entry",       icon: Table2    },
    { id: "balance",   label: "Supply-Demand Balance", icon: Layers   },
  ];

  return (
    <>
      <PageHeader
        title="S&OP / Sales Forecast"
        subtitle="Monthly Sales & Operations Planning — align demand, supply, and finance into one consensus plan."
        actions={
          <div className="flex items-center gap-2">
            <Select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="h-9 w-52 text-sm"
            >
              {cycles.map((c) => (
                <option key={c.id} value={c.id}>{c.ref}</option>
              ))}
            </Select>
            {canAdvance && (
              <Button size="sm" onClick={advance}>
                <ArrowRight className="size-4" />
                Advance to {STATUS_LABELS[nextStatus(cycle.status)!]}
              </Button>
            )}
          </div>
        }
      />

      {/* Tab bar */}
      <div className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" />
            {t.label}
          </button>
        ))}
      </div>

      {/* ---- Dashboard tab ---- */}
      {tab === "dashboard" && (
        <div className="space-y-4">
          {/* Status pipeline */}
          <Card className="p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Review Pipeline</h3>
              <Badge
                variant={
                  cycle.status === "approved" ? "success" :
                  cycle.status === "draft"    ? "default" : "warning"
                }
              >
                {STATUS_LABELS[cycle.status]}
              </Badge>
            </div>
            <Pipeline cycle={cycle} />
          </Card>

          {/* Summary table */}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 font-medium">Cat.</th>
                    <th className="px-4 py-3 text-right font-medium">Sales 3M</th>
                    <th className="px-4 py-3 text-right font-medium">Ops Plan 3M</th>
                    <th className="px-4 py-3 text-right font-medium">Consensus 3M</th>
                    <th className="px-4 py-3 text-right font-medium">Opening Stock</th>
                    <th className="px-4 py-3 text-right font-medium">Cover Days</th>
                    <th className="px-4 py-3 font-medium">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {cycle.lines.map((l) => {
                    const s3   = sum3(l.salesForecast);
                    const o3   = sum3(l.opsForecast);
                    const c3   = sum3(l.consensusForecast);
                    const gap  = gapPct(s3, o3);
                    const cd   = coverDays(l.openingStock, l.consensusForecast[0]);
                    const cs   = coverStatus(cd);
                    return (
                      <tr key={l.itemName} className="border-b last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-2.5 font-medium">{l.itemName}</td>
                        <td className="px-4 py-2.5">
                          <Badge variant={l.category === "finished" ? "primary" : "default"}>
                            {l.category === "finished" ? "FG" : "SFG"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular">{fmtN(s3, l.uom)}</td>
                        <td className="px-4 py-2.5 text-right tabular">{fmtN(o3, l.uom)}</td>
                        <td className="px-4 py-2.5 text-right tabular">{fmtN(c3, l.uom)}</td>
                        <td className="px-4 py-2.5 text-right tabular">{fmtN(l.openingStock, l.uom)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <Badge variant={COVER_BADGE[cs]}>{cd === 999 ? "—" : `${cd}d`}</Badge>
                        </td>
                        <td className="px-4 py-2.5">
                          {gap > 20 ? (
                            <span className="inline-flex items-center gap-1 text-danger text-xs font-medium">
                              <AlertTriangle className="size-3" />+{gap.toFixed(1)}%
                            </span>
                          ) : gap > 10 ? (
                            <span className="inline-flex items-center gap-1 text-warning text-xs font-medium">
                              <AlertTriangle className="size-3" />+{gap.toFixed(1)}%
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">+{gap.toFixed(1)}%</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Assumptions & Risks */}
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <Info className="size-4 text-primary" /> Assumptions
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{cycle.assumptions}</p>
            </Card>
            <Card className="p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <AlertTriangle className="size-4 text-warning" /> Risks
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{cycle.risks}</p>
            </Card>
          </div>
        </div>
      )}

      {/* ---- Forecast Entry tab ---- */}
      {tab === "forecast" && (
        <div className="space-y-2">
          {editable && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-4 py-2 text-xs text-primary">
              {STATUS_LABELS[cycle.status]} — editable row highlighted in blue. Other rows are read-only.
            </div>
          )}
          <Card className="overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left font-medium min-w-[9rem]">Product</th>
                    <th className="px-3 py-3 text-left font-medium w-20">Row</th>
                    {monthLabels.map((m) => (
                      <th key={m} className="px-3 py-3 text-right font-medium min-w-[5.5rem]">{m}</th>
                    ))}
                    <th className="px-3 py-3 text-right font-medium min-w-[5.5rem]">12M Total</th>
                  </tr>
                </thead>
                <tbody>
                  {cycle.lines.map((line, li) => {
                    const rows: { field: "salesForecast" | "opsForecast" | "consensusForecast"; label: string }[] = [
                      { field: "salesForecast",     label: "Sales" },
                      { field: "opsForecast",       label: "Ops"   },
                      { field: "consensusForecast", label: "Cons." },
                    ];
                    return (
                      <React.Fragment key={line.itemName}>
                        {rows.map((row, ri) => {
                          const isEditable = editable === row.field;
                          const values = line[row.field] as number[];
                          const total  = sum12(values);
                          return (
                            <tr
                              key={row.field}
                              className={cn(
                                ri === 0 && "border-t",
                                ri === 2 && "border-b",
                                isEditable && "bg-primary/5",
                                !isEditable && ri === 1 && "bg-muted/20",
                              )}
                            >
                              {ri === 0 ? (
                                <td rowSpan={3} className="sticky left-0 z-10 bg-card px-4 py-1.5 font-medium align-middle border-r">
                                  <div>{line.itemName}</div>
                                  <div className="text-xs text-muted-foreground">{line.uom}</div>
                                </td>
                              ) : null}
                              <td className={cn(
                                "px-3 py-1.5 text-xs font-medium",
                                isEditable ? "text-primary" : "text-muted-foreground",
                              )}>
                                {row.label}
                              </td>
                              {values.map((v, mi) => (
                                <td key={mi} className="px-1 py-1">
                                  {isEditable ? (
                                    <input
                                      type="number"
                                      value={v}
                                      onChange={(e) => updateCell(li, row.field, mi, parseInt(e.target.value, 10))}
                                      onKeyDown={(e) => {
                                        if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
                                      }}
                                      className="h-7 w-full rounded border border-primary/30 bg-primary/5 px-2 text-right text-xs tabular focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                                    />
                                  ) : (
                                    <div className="px-2 py-0.5 text-right text-xs tabular text-muted-foreground">
                                      {fmtN(v)}
                                    </div>
                                  )}
                                </td>
                              ))}
                              <td className="px-3 py-1.5 text-right text-xs font-semibold tabular">
                                {fmtN(total)}
                              </td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    );
                  })}
                  {/* Column totals */}
                  {(["salesForecast", "opsForecast", "consensusForecast"] as const).map((field) => {
                    const label = field === "salesForecast" ? "Total Sales" : field === "opsForecast" ? "Total Ops" : "Total Cons.";
                    const colTotals = monthLabels.map((_, mi) =>
                      cycle.lines.reduce((s, l) => s + (l[field] as number[])[mi], 0),
                    );
                    return (
                      <tr key={field} className="border-t bg-muted/40 font-semibold">
                        {field === "salesForecast" && (
                          <td rowSpan={3} className="sticky left-0 z-10 bg-muted/40 px-4 py-2 text-xs font-semibold border-r">
                            Column Totals
                          </td>
                        )}
                        <td className="px-3 py-2 text-xs text-muted-foreground">{label}</td>
                        {colTotals.map((v, mi) => (
                          <td key={mi} className="px-3 py-2 text-right text-xs tabular">{fmtN(v)}</td>
                        ))}
                        <td className="px-3 py-2 text-right text-xs tabular">
                          {fmtN(colTotals.reduce((s, v) => s + v, 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* ---- Supply-Demand Balance tab ---- */}
      {tab === "balance" && (
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Item</th>
                    <th className="px-4 py-3 text-right font-medium">Opening</th>
                    <th className="px-4 py-3 text-right font-medium">Production</th>
                    <th className="px-4 py-3 text-right font-medium">Sales</th>
                    <th className="px-4 py-3 text-right font-medium">Closing</th>
                    <th className="px-4 py-3 text-right font-medium">Cover Days</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {cycle.lines.map((l) => {
                    const production = l.opsForecast[0];
                    const sales      = l.consensusForecast[0];
                    const closing    = l.openingStock + production - sales;
                    const cd         = closing <= 0 ? 0 : coverDays(closing, sales);
                    const cs         = closing <= 0 ? "CRITICAL" : coverStatus(cd);
                    return (
                      <tr key={l.itemName} className="border-b last:border-0 hover:bg-accent/40">
                        <td className="px-4 py-2.5">
                          <div className="font-medium">{l.itemName}</div>
                          <div className="text-xs text-muted-foreground">{l.uom}</div>
                        </td>
                        <td className="px-4 py-2.5 text-right tabular">{fmtN(l.openingStock)}</td>
                        <td className="px-4 py-2.5 text-right tabular">{fmtN(production)}</td>
                        <td className="px-4 py-2.5 text-right tabular">{fmtN(sales)}</td>
                        <td className={cn(
                          "px-4 py-2.5 text-right tabular font-medium",
                          closing < 0 && "text-danger",
                        )}>
                          {fmtN(closing)}
                        </td>
                        <td className="px-4 py-2.5 text-right tabular">
                          {cd === 0 ? "—" : `${cd}d`}
                        </td>
                        <td className="px-4 py-2.5">
                          <Badge variant={COVER_BADGE[cs]}>{cs}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Aggregate by category */}
          <div className="grid gap-4 sm:grid-cols-2">
            {(["finished", "semi-finished"] as const).map((cat) => {
              const catLines = cycle.lines.filter((l) => l.category === cat);
              const totalProd = catLines.reduce((s, l) => s + l.opsForecast[0], 0);
              const totalSales = catLines.reduce((s, l) => s + l.consensusForecast[0], 0);
              const totalOpen  = catLines.reduce((s, l) => s + l.openingStock, 0);
              const totalClose = totalOpen + totalProd - totalSales;
              return (
                <Card key={cat} className="p-4">
                  <div className="mb-3 text-sm font-semibold">
                    {cat === "finished" ? "Finished Goods" : "Semi-Finished / Intermediates"}
                  </div>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                    <span className="text-muted-foreground">Opening Stock</span>
                    <span className="text-right tabular font-medium">{fmtN(totalOpen)}</span>
                    <span className="text-muted-foreground">Production Plan</span>
                    <span className="text-right tabular font-medium">{fmtN(totalProd)}</span>
                    <span className="text-muted-foreground">Sales / Demand</span>
                    <span className="text-right tabular font-medium">{fmtN(totalSales)}</span>
                    <span className="text-muted-foreground border-t pt-2">Projected Closing</span>
                    <span className={cn(
                      "text-right tabular font-semibold border-t pt-2",
                      totalClose < 0 && "text-danger",
                    )}>
                      {fmtN(totalClose)}
                    </span>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
