"use client";

import * as React from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Table2, GitCompareArrows, TrendingUp, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { KpiStrip } from "@/components/accounting/kpi-strip";
import { Money } from "@/components/ui/money";
import { Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ExcelExport } from "@/components/excel/excel-export";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { cn, formatCompactInr } from "@/lib/planning/util";
import { noNumberNudge } from "@/lib/utils";
import { ENTITIES, entityById } from "@/lib/accounting/org";
import { fyLabel } from "@/lib/accounting/periods";
import {
  buildBudget,
  lineForecast,
  loadAssumptions,
  saveAssumptions,
  loadOverrides,
  saveOverrides,
  planTotals,
  sum,
  monthShort,
  DEFAULT_ASSUMPTIONS,
  type BudgetAssumptions,
  type BudgetModel,
  type BudgetLine,
  type BudgetOverrides,
} from "@/lib/planning/budget";
import type { ReportSheet, ReportColumn } from "@/lib/xlsx/report";

type View = "plan" | "variance" | "forecast";

const SECTIONS: { key: string; label: string; match: (l: BudgetLine) => boolean }[] = [
  { key: "rev", label: "Revenue", match: (l) => l.type === "income" && l.subtype === "Revenue" },
  { key: "oi", label: "Other Income", match: (l) => l.type === "income" && l.subtype === "Other Income" },
  { key: "cogs", label: "Cost of Sales", match: (l) => l.subtype === "Cost of Sales" },
  { key: "opex", label: "Operating Expenses", match: (l) => l.subtype === "Operating Expenses" },
  { key: "fin", label: "Finance Costs", match: (l) => l.subtype === "Finance Costs" },
];

function currentFyStart(d: Date) {
  return d.getMonth() + 1 >= 4 ? d.getFullYear() : d.getFullYear() - 1;
}

export function BudgetClient() {
  const prefs = usePrefs();
  const today = React.useMemo(() => new Date(), []);
  const asOfMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
  const defaultFy = currentFyStart(today);

  const [fyStart, setFyStart] = React.useState(defaultFy);
  const [assumptions, setAssumptions] = React.useState<BudgetAssumptions>(DEFAULT_ASSUMPTIONS);
  const [overrides, setOverrides] = React.useState<BudgetOverrides>({});
  const [view, setView] = React.useState<View>("plan");
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    setAssumptions(loadAssumptions());
    setHydrated(true);
  }, []);
  React.useEffect(() => {
    if (!hydrated) return;
    setOverrides(loadOverrides(prefs.entityId, fyStart));
  }, [prefs.entityId, fyStart, hydrated]);

  const model = React.useMemo(
    () => buildBudget(prefs.entityId, prefs.basis, fyStart, asOfMonth, assumptions, overrides),
    [prefs.entityId, prefs.basis, fyStart, asOfMonth, assumptions, overrides],
  );
  const totals = planTotals(model, assumptions.forecastMethod);

  const setCell = (code: string, m: number, value: number) => {
    const next = { ...overrides, [`${code}:${m}`]: value };
    setOverrides(next);
    saveOverrides(prefs.entityId, fyStart, next);
  };
  const resetPlan = () => {
    setOverrides({});
    saveOverrides(prefs.entityId, fyStart, {});
  };
  const updateAssumption = (patch: Partial<BudgetAssumptions>) => {
    const next = { ...assumptions, ...patch };
    setAssumptions(next);
    saveAssumptions(next);
  };

  const scopeLabel = prefs.entityId === "all" ? "All entities" : entityById(prefs.entityId)?.name ?? "—";
  const fcMargin = totals.revenueForecast ? totals.netForecast / totals.revenueForecast : 0;

  return (
    <>
      <PageHeader
        title="Budgeting & Forecasting"
        subtitle="Annual operating plan seeded from last year, tracked against actuals and projected to year-end."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={resetPlan} title="Reset edited cells to seeded budget">
              <RotateCcw className="size-4" />
              Reset
            </Button>
            <ExcelExport
              filename={`nexa-budget-${fyLabel(fyStart).replace(/\s/g, "")}`}
              build={() => buildSheets(model, totals, assumptions, scopeLabel)}
            />
          </div>
        }
      />

      <KpiStrip
        items={[
          { label: `Revenue — Forecast`, value: totals.revenueForecast, sub: `Budget ${formatCompactInr(totals.revenueBudget)}` },
          { label: "Cost — Forecast", value: totals.costForecast, sub: `Budget ${formatCompactInr(totals.costBudget)}` },
          { label: "Net Profit — Forecast", value: totals.netForecast, sub: `${(fcMargin * 100).toFixed(1)}% margin`, colored: true },
          { label: "Actual to date", value: totals.netActual, sub: `${model.elapsed} of 12 months`, colored: true },
        ]}
      />

      {/* Assumptions bar */}
      <div className="mb-4 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-card p-3 shadow-sm">
        <FySelect fyStart={fyStart} setFyStart={setFyStart} defaultFy={defaultFy} />
        <GrowthInput
          label="Revenue growth"
          value={assumptions.revenueGrowth}
          onChange={(v) => updateAssumption({ revenueGrowth: v })}
        />
        <GrowthInput
          label="Cost growth"
          value={assumptions.costGrowth}
          onChange={(v) => updateAssumption({ costGrowth: v })}
        />
        <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          Forecast remaining months on
          <Select
            value={assumptions.forecastMethod}
            onChange={(e) => updateAssumption({ forecastMethod: e.target.value as BudgetAssumptions["forecastMethod"] })}
            className="h-8 w-32 text-xs"
          >
            <option value="budget">Budget</option>
            <option value="runrate">Run-rate</option>
          </Select>
        </label>
        <span className="ml-auto text-xs text-muted-foreground">{scopeLabel} · {prefs.basis} basis</span>
      </div>

      {/* View tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border bg-card p-1 shadow-sm w-fit">
        {([
          { id: "plan", label: "Plan grid", icon: Table2 },
          { id: "variance", label: "Budget vs Actual", icon: GitCompareArrows },
          { id: "forecast", label: "Forecast", icon: TrendingUp },
        ] as const).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setView(t.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-4" />
              {t.label}
            </button>
          );
        })}
      </div>

      {view === "plan" && <PlanGrid model={model} setCell={setCell} />}
      {view === "variance" && <VarianceView model={model} />}
      {view === "forecast" && <ForecastView model={model} method={assumptions.forecastMethod} />}
    </>
  );
}

function FySelect({ fyStart, setFyStart, defaultFy }: { fyStart: number; setFyStart: (n: number) => void; defaultFy: number }) {
  const opts = [defaultFy - 2, defaultFy - 1, defaultFy, defaultFy + 1];
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      Financial year
      <Select value={String(fyStart)} onChange={(e) => setFyStart(Number(e.target.value))} className="h-8 w-28 text-xs">
        {opts.map((y) => (
          <option key={y} value={y}>
            {fyLabel(y)}
          </option>
        ))}
      </Select>
    </label>
  );
}

function GrowthInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      {label}
      <span className="flex items-center">
        <input
          type="number"
          onKeyDown={noNumberNudge}
          value={Math.round(value * 1000) / 10}
          onChange={(e) => onChange((Number(e.target.value) || 0) / 100)}
          step={0.5}
          className="h-8 w-16 rounded-md border bg-card px-2 text-right text-sm text-foreground"
        />
        <span className="ml-1">%</span>
      </span>
    </label>
  );
}

// ---------------------------------------------------------------------------
// Plan grid — editable monthly budget
// ---------------------------------------------------------------------------
function PlanGrid({ model, setCell }: { model: BudgetModel; setCell: (code: string, m: number, v: number) => void }) {
  return (
    <div className="overflow-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full min-w-[1100px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 text-left font-semibold">Line</th>
            {model.monthLabels.map((m, i) => (
              <th key={m} className={cn("px-2 py-2.5 text-right font-semibold", i < model.elapsed && "text-foreground")}>
                {m}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-semibold text-foreground">Total</th>
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map((sec) => {
            const lines = model.lines.filter(sec.match);
            if (!lines.length) return null;
            const colTotals = new Array(12).fill(0);
            lines.forEach((l) => l.budget.forEach((v, i) => (colTotals[i] += v)));
            return (
              <React.Fragment key={sec.key}>
                <tr className="bg-muted/20">
                  <td colSpan={14} className="sticky left-0 px-3 py-1.5 text-xs font-semibold text-muted-foreground">
                    {sec.label}
                  </td>
                </tr>
                {lines.map((l) => (
                  <tr key={l.code} className="border-b last:border-0">
                    <td className="sticky left-0 z-10 bg-card px-3 py-1.5">{l.name}</td>
                    {l.budget.map((v, i) => (
                      <td key={i} className="px-1 py-1">
                        <input
                          type="number"
                          onKeyDown={noNumberNudge}
                          value={v}
                          onChange={(e) => setCell(l.code, i, Math.round(Number(e.target.value) || 0))}
                          className={cn(
                            "h-7 w-20 rounded border bg-transparent px-1.5 text-right text-xs tabular focus:bg-card focus:ring-1 focus:ring-ring",
                            i < model.elapsed ? "border-transparent text-muted-foreground" : "border-input/50",
                          )}
                        />
                      </td>
                    ))}
                    <td className="px-3 py-1.5 text-right font-semibold tabular">
                      <Money value={sum(l.budget)} compact />
                    </td>
                  </tr>
                ))}
                <tr className="border-b bg-muted/10 font-medium">
                  <td className="sticky left-0 z-10 bg-muted/10 px-3 py-1.5 text-xs">{sec.label} total</td>
                  {colTotals.map((v, i) => (
                    <td key={i} className="px-2 py-1.5 text-right text-xs tabular">
                      {formatCompactInr(v)}
                    </td>
                  ))}
                  <td className="px-3 py-1.5 text-right tabular">
                    <Money value={sum(colTotals)} compact />
                  </td>
                </tr>
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
      <p className="border-t px-3 py-2 text-xs text-muted-foreground">
        Greyed columns are elapsed months. Edit any cell — changes persist locally and flow into the variance,
        forecast and Excel exports.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Variance — budget vs actual to date
// ---------------------------------------------------------------------------
function VarianceView({ model }: { model: BudgetModel }) {
  const rows = model.lines.map((l) => {
    const budgetYtd = sum(l.budget.slice(0, model.elapsed));
    const actualYtd = sum(l.actual.slice(0, model.elapsed));
    const variance = actualYtd - budgetYtd;
    const favourable = l.type === "income" ? variance >= 0 : variance <= 0;
    return { l, budgetYtd, actualYtd, variance, favourable, varPct: budgetYtd ? variance / budgetYtd : 0 };
  });
  return (
    <div className="overflow-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-3 py-2.5 text-left font-semibold">Line</th>
            <th className="px-3 py-2.5 text-right font-semibold">Budget YTD</th>
            <th className="px-3 py-2.5 text-right font-semibold">Actual YTD</th>
            <th className="px-3 py-2.5 text-right font-semibold">Variance</th>
            <th className="px-3 py-2.5 text-right font-semibold">Var %</th>
          </tr>
        </thead>
        <tbody>
          {SECTIONS.map((sec) => {
            const secRows = rows.filter((r) => sec.match(r.l));
            if (!secRows.length) return null;
            return (
              <React.Fragment key={sec.key}>
                <tr className="bg-muted/20">
                  <td colSpan={5} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">{sec.label}</td>
                </tr>
                {secRows.map((r) => (
                  <tr key={r.l.code} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-3 py-2">{r.l.name}</td>
                    <td className="px-3 py-2 text-right tabular"><Money value={r.budgetYtd} compact /></td>
                    <td className="px-3 py-2 text-right tabular"><Money value={r.actualYtd} compact /></td>
                    <td className={cn("px-3 py-2 text-right tabular font-medium", r.favourable ? "text-success" : "text-danger")}>
                      <Money value={r.variance} compact />
                    </td>
                    <td className={cn("px-3 py-2 text-right tabular", r.favourable ? "text-success" : "text-danger")}>
                      {r.budgetYtd ? `${(r.varPct * 100).toFixed(1)}%` : "—"}
                    </td>
                  </tr>
                ))}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forecast — full-year projection + monthly net chart
// ---------------------------------------------------------------------------
function ForecastView({ model, method }: { model: BudgetModel; method: BudgetAssumptions["forecastMethod"] }) {
  const chartData = model.months.map((m, i) => {
    let rev = 0,
      cost = 0;
    for (const l of model.lines) {
      const fc = lineForecast(l, model.elapsed, method)[i];
      if (l.type === "income") rev += fc;
      else cost += fc;
    }
    return { month: monthShort(m).split(" ")[0], net: rev - cost, revenue: rev, actual: i < model.elapsed };
  });

  const rows = model.lines.map((l) => {
    const fc = lineForecast(l, model.elapsed, method);
    const ytd = sum(l.actual.slice(0, model.elapsed));
    const remaining = sum(fc.slice(model.elapsed));
    const full = ytd + remaining;
    const budget = sum(l.budget);
    return { l, ytd, remaining, full, budget, vsBudget: full - budget };
  });

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
        <h3 className="mb-3 text-sm font-semibold">Monthly net profit — actual then forecast</h3>
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="gNet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tickFormatter={(v) => formatCompactInr(v)} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={60} />
            <Tooltip
              formatter={(v: number) => formatCompactInr(v)}
              contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }}
            />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--muted-foreground))" fill="none" strokeDasharray="4 2" />
            <Area type="monotone" dataKey="net" name="Net profit" stroke="hsl(var(--primary))" fill="url(#gNet)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="overflow-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2.5 text-left font-semibold">Line</th>
              <th className="px-3 py-2.5 text-right font-semibold">Actual YTD</th>
              <th className="px-3 py-2.5 text-right font-semibold">Remaining</th>
              <th className="px-3 py-2.5 text-right font-semibold">Full-Year Forecast</th>
              <th className="px-3 py-2.5 text-right font-semibold">Annual Budget</th>
              <th className="px-3 py-2.5 text-right font-semibold">vs Budget</th>
            </tr>
          </thead>
          <tbody>
            {SECTIONS.map((sec) => {
              const secRows = rows.filter((r) => sec.match(r.l));
              if (!secRows.length) return null;
              return (
                <React.Fragment key={sec.key}>
                  <tr className="bg-muted/20">
                    <td colSpan={6} className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">{sec.label}</td>
                  </tr>
                  {secRows.map((r) => {
                    const good = r.l.type === "income" ? r.vsBudget >= 0 : r.vsBudget <= 0;
                    return (
                      <tr key={r.l.code} className="border-b last:border-0 hover:bg-accent/40">
                        <td className="px-3 py-2">{r.l.name}</td>
                        <td className="px-3 py-2 text-right tabular"><Money value={r.ytd} compact /></td>
                        <td className="px-3 py-2 text-right tabular text-muted-foreground"><Money value={r.remaining} compact /></td>
                        <td className="px-3 py-2 text-right font-semibold tabular"><Money value={r.full} compact /></td>
                        <td className="px-3 py-2 text-right tabular text-muted-foreground"><Money value={r.budget} compact /></td>
                        <td className={cn("px-3 py-2 text-right tabular font-medium", good ? "text-success" : "text-danger")}>
                          <Money value={r.vsBudget} compact />
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Excel — live-formula budget model
// ---------------------------------------------------------------------------
function buildSheets(
  model: BudgetModel,
  totals: ReturnType<typeof planTotals>,
  assumptions: BudgetAssumptions,
  scopeLabel: string,
): ReportSheet[] {
  const meta = [`Scope: ${scopeLabel}`, `FY ${model.fyName} · ${model.elapsed} months actual`];

  // Annual plan: monthly budget + Total = SUM(months).
  const planCols: ReportColumn[] = [
    { header: "Line", key: "name", type: "text", width: 26, totalText: "Total" },
    ...model.monthLabels.map<ReportColumn>((m) => ({ header: m, key: m, type: "money", width: 12, total: "sum" })),
    {
      header: "Total",
      key: "total",
      type: "money",
      width: 15,
      formula: (c) => `SUM(${c.colOf(model.monthLabels[0])}${c.row}:${c.colOf(model.monthLabels[11])}${c.row})`,
      total: "sum",
    },
  ];
  const planRows = model.lines.map((l) => {
    const o: Record<string, number | string> = { name: l.name, total: sum(l.budget) };
    model.monthLabels.forEach((m, i) => (o[m] = l.budget[i]));
    return o;
  });

  // Variance: budget vs actual YTD with live variance formulas.
  const varCols: ReportColumn[] = [
    { header: "Line", key: "name", type: "text", width: 26, totalText: "Total" },
    { header: "Budget YTD", key: "budgetYtd", type: "money", width: 15, total: "sum" },
    { header: "Actual YTD", key: "actualYtd", type: "money", width: 15, total: "sum" },
    {
      header: "Variance",
      key: "variance",
      type: "money",
      width: 15,
      formula: (c) => `${c.colOf("actualYtd")}${c.row}-${c.colOf("budgetYtd")}${c.row}`,
      total: "sum",
    },
    {
      header: "Var %",
      key: "varPct",
      type: "percent",
      width: 10,
      formula: (c) => `IF(${c.colOf("budgetYtd")}${c.row}=0,0,${c.colOf("variance")}${c.row}/${c.colOf("budgetYtd")}${c.row})`,
    },
  ];
  const varRows = model.lines.map((l) => {
    const budgetYtd = sum(l.budget.slice(0, model.elapsed));
    const actualYtd = sum(l.actual.slice(0, model.elapsed));
    return { name: l.name, budgetYtd, actualYtd, variance: actualYtd - budgetYtd };
  });

  // Forecast: full year = YTD + remaining (formula), vs annual budget.
  const fcCols: ReportColumn[] = [
    { header: "Line", key: "name", type: "text", width: 26, totalText: "Total" },
    { header: "Actual YTD", key: "ytd", type: "money", width: 15, total: "sum" },
    { header: "Remaining", key: "remaining", type: "money", width: 15, total: "sum" },
    {
      header: "Full-Year Forecast",
      key: "full",
      type: "money",
      width: 18,
      formula: (c) => `${c.colOf("ytd")}${c.row}+${c.colOf("remaining")}${c.row}`,
      total: "sum",
    },
    { header: "Annual Budget", key: "budget", type: "money", width: 16, total: "sum" },
    {
      header: "Fcast vs Budget",
      key: "vsBudget",
      type: "money",
      width: 16,
      formula: (c) => `${c.colOf("full")}${c.row}-${c.colOf("budget")}${c.row}`,
      total: "sum",
    },
  ];
  const fcRows = model.lines.map((l) => {
    const fc = lineForecast(l, model.elapsed, assumptions.forecastMethod);
    const ytd = sum(l.actual.slice(0, model.elapsed));
    const remaining = sum(fc.slice(model.elapsed));
    return { name: l.name, ytd, remaining, budget: sum(l.budget) };
  });

  const notes = [
    `Assumptions — revenue growth ${(assumptions.revenueGrowth * 100).toFixed(1)}%, cost growth ${(assumptions.costGrowth * 100).toFixed(1)}%.`,
    `Remaining months forecast on: ${assumptions.forecastMethod === "runrate" ? "run-rate" : "budget"}.`,
  ];

  return [
    { name: "Annual Plan", title: "Operating Budget", subtitle: "Monthly plan (INR)", meta, columns: planCols, rows: planRows, totals: true, notes },
    { name: "Variance", title: "Budget vs Actual (YTD)", subtitle: "Live variance formulas", meta, columns: varCols, rows: varRows, totals: true },
    { name: "Forecast", title: "Full-Year Forecast", subtitle: "YTD actual + projected remainder", meta, columns: fcCols, rows: fcRows, totals: true, notes },
  ];
}
