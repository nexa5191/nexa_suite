"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, TrendingUp, TrendingDown, Users, Maximize2, BarChart3, Check, Clock, FileEdit, RotateCw } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  loadBudgetDepts, MONTHS, FY, FY_PREV, CLOSED_MONTHS,
  DEPT_STATUS_META, SEED_STORE,
  loadBudgetStore, deptAnnualTotal, deptMonthTotal,
  type BudgetStore, type Department,
} from "@/lib/finance/budget-builder";

// ─── display helpers ──────────────────────────────────────────────────────────
function fmtCr(n: number, digits = 2) {
  if (n === 0) return "—";
  return "₹" + (n / 10000000).toFixed(digits) + "Cr";
}
function fmtL(n: number) {
  if (n === 0) return "—";
  return "₹" + (n / 100000).toFixed(2) + "L";
}
function pct(n: number, d: number) {
  if (!d) return 0;
  return ((n - d) / d) * 100;
}
function fmtPct(p: number) {
  return (p >= 0 ? "+" : "") + p.toFixed(1) + "%";
}

const DEPT_ICON: Record<Department, string> = {
  HR: "👥", Operations: "⚙️", SCM: "🚛", Maintenance: "🔧",
  Finance: "💼", Marketing: "📣", IT: "💻",
};
const DEPT_COLOR: Record<Department, string> = {
  HR:          "border-blue-200 dark:border-blue-900",
  Operations:  "border-orange-200 dark:border-orange-900",
  SCM:         "border-teal-200 dark:border-teal-900",
  Maintenance: "border-yellow-200 dark:border-yellow-900",
  Finance:     "border-purple-200 dark:border-purple-900",
  Marketing:   "border-pink-200 dark:border-pink-900",
  IT:          "border-indigo-200 dark:border-indigo-900",
};

// ─── main component ───────────────────────────────────────────────────────────
export function BudgetBuilderClient() {
  const [store, setStore] = React.useState<BudgetStore>(SEED_STORE);

  React.useEffect(() => { setStore(loadBudgetStore()); }, []);

  const grandFY25   = loadBudgetDepts().reduce((s, d) => s + deptAnnualTotal(store, d, "fy25Actual"), 0);
  const grandFY26   = loadBudgetDepts().reduce((s, d) => s + deptAnnualTotal(store, d, "budgeted"),   0);
  const grandActual = loadBudgetDepts().reduce((s, d) => s + deptAnnualTotal(store, d, "actuals"),    0);
  const ytdBudget   = CLOSED_MONTHS.reduce((s, mi) =>
    s + loadBudgetDepts().reduce((ss, d) => ss + deptMonthTotal(store, d, mi, "budgeted"), 0), 0);
  const ytdActual   = CLOSED_MONTHS.reduce((s, mi) =>
    s + loadBudgetDepts().reduce((ss, d) => ss + deptMonthTotal(store, d, mi, "actuals"), 0), 0);

  const approved  = loadBudgetDepts().filter((d) => store.deptStatus[d] === "approved").length;
  const submitted = loadBudgetDepts().filter((d) => store.deptStatus[d] === "submitted").length;
  const draft     = loadBudgetDepts().filter((d) => store.deptStatus[d] === "draft").length;
  const totalGrowth = pct(grandFY26, grandFY25);

  return (
    <>
      <PageHeader
        title={`Budget Builder — FY ${FY}`}
        subtitle="Click any card to see the monthly breakdown. Click Open to build or review the full budget."
        actions={
          <div className="flex items-center gap-2">
            <Link href="/planning/budget">
              <Button variant="ghost" size="sm">Legacy budget</Button>
            </Link>
          </div>
        }
      />

      {/* Summary strip */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total FY26 Budget" value={fmtCr(grandFY26)} sub={`${fmtPct(totalGrowth)} vs FY${FY_PREV}`} subPositive={totalGrowth >= 0} />
        <SummaryCard label={`FY${FY_PREV} Actual`} value={fmtCr(grandFY25)} sub="Prior year reference" />
        <SummaryCard label="YTD Actual (Apr–May)" value={fmtL(ytdActual)} sub={`vs ₹${(ytdBudget/100000).toFixed(1)}L budget`} subPositive={ytdActual <= ytdBudget} />
        <div className="rounded-xl border bg-card p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Approval status</p>
          <div className="mt-2 flex items-end gap-3">
            <div className="text-center">
              <p className="text-2xl font-bold text-success">{approved}</p>
              <p className="text-[10px] text-muted-foreground">Approved</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-primary">{submitted}</p>
              <p className="text-[10px] text-muted-foreground">Submitted</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-muted-foreground">{draft}</p>
              <p className="text-[10px] text-muted-foreground">Draft</p>
            </div>
            <div className="ml-auto text-right">
              <p className="text-xs font-medium text-muted-foreground">{loadBudgetDepts().length} depts</p>
              <div className="mt-1 h-1.5 w-20 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-success" style={{ width: `${(approved / loadBudgetDepts().length) * 100}%` }} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Department cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loadBudgetDepts().map((dept) => (
          <DeptCard key={dept} dept={dept} store={store} />
        ))}
      </div>

      {/* Consolidation table */}
      <ConsolidationTable store={store} grandFY25={grandFY25} grandFY26={grandFY26} grandActual={grandActual} />
    </>
  );
}

// ─── dept card (flip = same card, content swap + scroll) ─────────────────────
function DeptCard({ dept, store }: { dept: Department; store: BudgetStore }) {
  const [flipped, setFlipped] = React.useState(false);

  const status      = store.deptStatus[dept];
  const sm          = DEPT_STATUS_META[status];
  const fy25        = deptAnnualTotal(store, dept, "fy25Actual");
  const fy26        = deptAnnualTotal(store, dept, "budgeted");
  const ytdActual   = CLOSED_MONTHS.reduce((s, mi) => s + deptMonthTotal(store, dept, mi, "actuals"), 0);
  const ytdBudget   = CLOSED_MONTHS.reduce((s, mi) => s + deptMonthTotal(store, dept, mi, "budgeted"), 0);
  const growth      = pct(fy26, fy25);
  const utilPct     = fy26 > 0 ? (ytdActual / fy26) * 100 : 0;
  const assumptions = store.assumptions[dept];
  const hcChange    = assumptions.headcountFY25 > 0
    ? ((assumptions.headcountFY26 - assumptions.headcountFY25) / assumptions.headcountFY25) * 100 : 0;

  const StatusIcon = status === "approved" ? Check : status === "submitted" ? Clock : FileEdit;

  return (
    <Card
      className={cn("group flex flex-col overflow-hidden border-l-4 cursor-pointer transition-shadow hover:shadow-md", DEPT_COLOR[dept])}
      onClick={() => setFlipped((f) => !f)}
    >
      {!flipped ? (
        /* ── Front ── */
        <>
          <div className="flex items-start justify-between px-4 pt-4 pb-3">
            <div className="flex items-center gap-2">
              <span className="text-2xl" role="img">{DEPT_ICON[dept]}</span>
              <div>
                <p className="font-semibold text-sm">{dept}</p>
                <Badge variant={sm.variant} className="mt-0.5 text-[10px] h-4 px-1.5 gap-0.5">
                  <StatusIcon className="size-2.5" />{sm.label}
                </Badge>
              </div>
            </div>
            <RotateCw className="size-3.5 text-muted-foreground/40 mt-1 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>

          <div className="px-4 pb-3 space-y-2">
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">FY26 Budget</p>
                <p className="text-xl font-bold tabular-nums">{fmtCr(fy26, 2)}</p>
              </div>
              <div className={cn("flex items-center gap-0.5 text-xs font-semibold", growth >= 0 ? "text-success" : "text-danger")}>
                {growth >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                {fmtPct(growth)}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>FY25 Actual</span>
              <span className="tabular-nums font-medium">{fmtCr(fy25, 2)}</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="flex items-center gap-1 rounded bg-muted/40 px-2 py-1">
                <Users className="size-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">HC</span>
                <span className="ml-auto font-medium tabular-nums">
                  {assumptions.headcountFY25}→{assumptions.headcountFY26}
                  <span className={cn("ml-0.5 text-[10px]", hcChange > 0 ? "text-success" : hcChange < 0 ? "text-danger" : "text-muted-foreground")}>
                    {hcChange !== 0 && (hcChange > 0 ? "↑" : "↓")}{Math.abs(hcChange).toFixed(0)}%
                  </span>
                </span>
              </div>
              <div className="flex items-center gap-1 rounded bg-muted/40 px-2 py-1">
                <BarChart3 className="size-3 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Rev</span>
                <span className="ml-auto font-medium tabular-nums text-success">+{assumptions.revenueGrowthPct}%</span>
              </div>
              {assumptions.areaSqftFY26 !== assumptions.areaSqftFY25 && (
                <div className="col-span-2 flex items-center gap-1 rounded bg-muted/40 px-2 py-1">
                  <Maximize2 className="size-3 text-muted-foreground shrink-0" />
                  <span className="text-muted-foreground">Area</span>
                  <span className="ml-auto font-medium tabular-nums">
                    {(assumptions.areaSqftFY25/1000).toFixed(0)}k→{(assumptions.areaSqftFY26/1000).toFixed(0)}k sqft
                  </span>
                </div>
              )}
            </div>

            <div>
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>YTD utilisation</span>
                <span className="tabular-nums font-medium">{utilPct.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className={cn("h-full rounded-full", utilPct > 100 ? "bg-danger" : utilPct > 85 ? "bg-warning" : "bg-primary/60")}
                  style={{ width: `${Math.min(utilPct, 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[10px] text-muted-foreground mt-0.5">
                <span>{fmtL(ytdActual)} actual</span>
                <span>{fmtL(ytdBudget)} budgeted</span>
              </div>
            </div>
          </div>

          <div className="mt-auto border-t px-4 py-2.5" onClick={(e) => e.stopPropagation()}>
            <Link href={`/finance/budgetbuilder/${dept.toLowerCase()}`} className="block">
              <Button variant="ghost" className="w-full justify-between h-8 text-xs font-medium" size="sm">
                {status === "approved" ? "View budget" : "Open & edit budget"}
                <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>
        </>
      ) : (
        /* ── Back — monthly breakdown, scrolls within the card ── */
        <>
          <div className="flex items-center gap-2 px-4 py-3 border-b">
            <span className="text-lg" role="img">{DEPT_ICON[dept]}</span>
            <span className="font-semibold text-sm flex-1">{dept} — Monthly</span>
            <RotateCw className="size-3.5 text-muted-foreground/60" />
          </div>

          <div className="grid grid-cols-[3.5rem_1fr_1fr] gap-x-2 px-4 py-1.5 border-b bg-muted/30 text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
            <span>Month</span>
            <span className="text-right">Budget</span>
            <span className="text-right">Actual</span>
          </div>

          {/* Fixed max-height so the card doesn't grow — content scrolls inside */}
          <div className="max-h-48 overflow-y-auto scrollbar-thin">
            {MONTHS.map((m, mi) => {
              const bud      = deptMonthTotal(store, dept, mi, "budgeted");
              const act      = deptMonthTotal(store, dept, mi, "actuals");
              const isClosed = CLOSED_MONTHS.includes(mi);
              const over     = isClosed && act > bud && bud > 0;
              return (
                <div key={m} className={cn(
                  "grid grid-cols-[3.5rem_1fr_1fr] gap-x-2 px-4 py-1.5 text-[11px] border-b last:border-0",
                  isClosed && "bg-primary/3",
                )}>
                  <span className="font-medium">
                    {m}{isClosed && <span className="ml-0.5 text-[8px] text-primary">●</span>}
                  </span>
                  <span className="text-right tabular-nums text-muted-foreground">{fmtL(bud)}</span>
                  <span className={cn("text-right tabular-nums font-medium",
                    !isClosed ? "text-muted-foreground/30" : over ? "text-danger" : act > 0 ? "text-success" : "text-muted-foreground/30",
                  )}>
                    {isClosed && act > 0 ? fmtL(act) : "—"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-t px-4 py-2.5 flex items-center justify-between mt-auto" onClick={(e) => e.stopPropagation()}>
            <span className="text-[10px] text-muted-foreground">FY26 {fmtCr(fy26)}</span>
            <Link href={`/finance/budgetbuilder/${dept.toLowerCase()}`}>
              <Button variant="ghost" size="sm" className="h-7 text-xs px-2">
                Open <ArrowRight className="size-3 ml-1" />
              </Button>
            </Link>
          </div>
        </>
      )}
    </Card>
  );
}

// ─── consolidation table ──────────────────────────────────────────────────────
function ConsolidationTable({ store, grandFY25, grandFY26, grandActual }: {
  store: BudgetStore; grandFY25: number; grandFY26: number; grandActual: number;
}) {
  return (
    <div className="mt-8">
      <p className="mb-3 text-sm font-semibold">FP&A Consolidation</p>
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b bg-muted/50 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Department</th>
                <th className="px-4 py-2.5 text-right font-medium">FY25 Actual</th>
                <th className="px-4 py-2.5 text-right font-medium">FY26 Budget</th>
                <th className="px-4 py-2.5 text-right font-medium">YoY Growth</th>
                <th className="px-4 py-2.5 text-right font-medium">YTD Actual</th>
                <th className="px-4 py-2.5 text-right font-medium">% of Total Opex</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium w-8" />
              </tr>
            </thead>
            <tbody>
              {loadBudgetDepts().map((dept, i) => {
                const fy25   = deptAnnualTotal(store, dept, "fy25Actual");
                const fy26   = deptAnnualTotal(store, dept, "budgeted");
                const ytdAct = CLOSED_MONTHS.reduce((s, mi) => s + deptMonthTotal(store, dept, mi, "actuals"), 0);
                const g      = pct(fy26, fy25);
                const share  = grandFY26 > 0 ? (fy26 / grandFY26) * 100 : 0;
                const sm     = DEPT_STATUS_META[store.deptStatus[dept]];
                return (
                  <tr key={dept} className={cn("border-b last:border-0 hover:bg-accent/30", i % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                    <td className="px-4 py-2.5 font-semibold">
                      <span className="mr-1.5">{DEPT_ICON[dept]}</span>{dept}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">{fmtCr(fy25)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{fmtCr(fy26)}</td>
                    <td className={cn("px-4 py-2.5 text-right tabular-nums font-medium", g >= 0 ? "text-success" : "text-danger")}>
                      {fmtPct(g)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmtL(ytdAct)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <span className="tabular-nums text-right">{share.toFixed(1)}%</span>
                        <div className="h-1.5 w-16 rounded-full bg-muted overflow-hidden">
                          <div className="h-full rounded-full bg-primary/60" style={{ width: `${share}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-2.5"><Badge variant={sm.variant} className="text-[10px]">{sm.label}</Badge></td>
                    <td className="px-4 py-2.5">
                      <Link href={`/finance/budgetbuilder/${dept.toLowerCase()}`}>
                        <button className="text-muted-foreground hover:text-foreground"><ArrowRight className="size-3.5" /></button>
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/60 font-bold">
                <td className="px-4 py-2.5">Grand Total</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtCr(grandFY25)}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtCr(grandFY26)}</td>
                <td className={cn("px-4 py-2.5 text-right tabular-nums", pct(grandFY26, grandFY25) >= 0 ? "text-success" : "text-danger")}>
                  {fmtPct(pct(grandFY26, grandFY25))}
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums">{fmtL(grandActual)}</td>
                <td className="px-4 py-2.5 text-right">100%</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─── summary card ─────────────────────────────────────────────────────────────
function SummaryCard({ label, value, sub, subPositive }: {
  label: string; value: string; sub?: string; subPositive?: boolean;
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
      {sub && (
        <p className={cn("mt-0.5 text-xs", subPositive === true ? "text-success" : subPositive === false ? "text-danger" : "text-muted-foreground")}>
          {sub}
        </p>
      )}
    </div>
  );
}
