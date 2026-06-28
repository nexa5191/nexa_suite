"use client";

import * as React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Rocket,
  Target,
  Boxes,
  Users,
  LineChart as LineChartIcon,
  PiggyBank,
  Flag,
  Printer,
  Building2,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { ExcelExport } from "@/components/excel/excel-export";
import { cn, formatCompactInr } from "@/lib/planning/util";
import { noNumberNudge } from "@/lib/utils";
import { fyLabel, periodPresets } from "@/lib/accounting/periods";
import { printDocument } from "@/lib/export";
import {
  buildBusinessPlan,
  loadPlanInputs,
  savePlanInputs,
  CRORE,
  type PlanInputs,
  type BusinessPlan,
} from "@/lib/planning/business-plan";
import type { ReportSheet, ReportColumn } from "@/lib/xlsx/report";

export function BusinessPlanClient() {
  const today = React.useMemo(() => new Date(), []);
  const last12 = React.useMemo(() => periodPresets(today).find((p) => p.id === "last12")!, [today]);
  const fyStart = today.getMonth() + 1 >= 4 ? today.getFullYear() : today.getFullYear() - 1;
  const baseLabel = `Current — ${fyLabel(fyStart)} TTM`;

  const [stored, setStored] = React.useState<Partial<PlanInputs>>({});
  React.useEffect(() => setStored(loadPlanInputs()), []);

  const plan = React.useMemo(
    () => buildBusinessPlan(last12.from, last12.to, baseLabel, stored),
    [last12.from, last12.to, baseLabel, stored],
  );
  const inputs = plan.inputs;

  const update = (patch: Partial<PlanInputs>) => {
    const next = { ...inputs, ...patch };
    setStored(next);
    savePlanInputs(next);
  };

  const fundingTotal = inputs.fundingAskCr * CRORE;

  return (
    <>
      <PageHeader
        title="Business Plan"
        subtitle="A living, investor-ready plan — financials pulled straight from your books, narrative yours to edit."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={() => printDocument(`${inputs.companyName} — Business Plan`, planHtml(plan))}>
              <Printer className="size-4" />
              PDF
            </Button>
            <ExcelExport filename={`${inputs.companyName.replace(/\s+/g, "-")}-business-plan`} build={() => buildSheets(plan)} />
          </div>
        }
      />

      <div className="space-y-4">
        {/* Executive summary */}
        <Section icon={Rocket} title="Executive Summary">
          <input
            value={inputs.companyName}
            onChange={(e) => update({ companyName: e.target.value })}
            className="w-full bg-transparent text-2xl font-bold tracking-tight outline-none focus:bg-accent/40 rounded px-1"
          />
          <EditText
            value={inputs.tagline}
            onChange={(v) => update({ tagline: v })}
            className="text-sm text-muted-foreground italic"
          />
          <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Tile label="Revenue (TTM)" value={<Money value={plan.base.revenue} compact />} />
            <Tile label="Net margin" value={`${(plan.base.revenue ? (plan.base.net / plan.base.revenue) * 100 : 0).toFixed(1)}%`} />
            <Tile label="Team" value={`${plan.team.total}`} sub="active employees" />
            <Tile label="Footprint" value={`${plan.entities.length} entities`} sub={`${plan.locations} locations`} />
          </div>
          <EditText value={inputs.execSummary} onChange={(v) => update({ execSummary: v })} className="mt-3 text-sm leading-relaxed" rows={3} />
        </Section>

        {/* Company */}
        <Section icon={Building2} title="Company Overview">
          <div className="grid gap-2 sm:grid-cols-3">
            {plan.entities.map((e) => (
              <div key={e.legalName} className="rounded-lg border p-3">
                <div className="font-semibold">{e.name}</div>
                <div className="text-xs text-muted-foreground">{e.legalName}</div>
                <div className="mt-1 text-xs text-muted-foreground">{e.country}</div>
              </div>
            ))}
          </div>
        </Section>

        {/* Problem / Solution */}
        <Section icon={Target} title="Problem & Solution">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="The problem">
              <EditText value={inputs.problem} onChange={(v) => update({ problem: v })} rows={3} className="text-sm leading-relaxed" />
            </Field>
            <Field label="Our solution">
              <EditText value={inputs.solution} onChange={(v) => update({ solution: v })} rows={3} className="text-sm leading-relaxed" />
            </Field>
          </div>
          <Field label="Target customer" className="mt-3">
            <EditText value={inputs.targetCustomer} onChange={(v) => update({ targetCustomer: v })} rows={2} className="text-sm leading-relaxed" />
          </Field>
        </Section>

        {/* Market */}
        <Section icon={Target} title="Market Opportunity">
          <div className="grid gap-3 sm:grid-cols-3">
            <MarketTile label="TAM" sub="Total market" valueCr={inputs.marketTamCr} onChange={(v) => update({ marketTamCr: v })} tone="bg-primary/10" />
            <MarketTile label="SAM" sub="Serviceable" valueCr={inputs.marketSamCr} onChange={(v) => update({ marketSamCr: v })} tone="bg-primary/20" />
            <MarketTile label="SOM" sub="Obtainable (3-5 yr)" valueCr={inputs.marketSomCr} onChange={(v) => update({ marketSomCr: v })} tone="bg-primary/30" />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Target share ≈ {inputs.marketSamCr ? ((inputs.marketSomCr / inputs.marketSamCr) * 100).toFixed(1) : "—"}% of the serviceable market.
          </p>
        </Section>

        {/* Products */}
        <Section icon={Boxes} title="Products & Services">
          <div className="overflow-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 text-left font-semibold">Product</th>
                  <th className="px-2 py-2 text-right font-semibold">Price</th>
                  <th className="px-2 py-2 text-right font-semibold">Unit cost (BOM)</th>
                  <th className="px-2 py-2 text-right font-semibold">Gross margin</th>
                </tr>
              </thead>
              <tbody>
                {plan.products.map((p) => (
                  <tr key={p.name} className="border-b last:border-0">
                    <td className="px-2 py-1.5">{p.name}</td>
                    <td className="px-2 py-1.5 text-right tabular"><Money value={p.price} /></td>
                    <td className="px-2 py-1.5 text-right tabular text-muted-foreground"><Money value={p.unitCost} /></td>
                    <td className={cn("px-2 py-1.5 text-right tabular font-medium", p.margin < 0 ? "text-danger" : "text-success")}>
                      {(p.margin * 100).toFixed(1)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Team */}
        <Section icon={Users} title="Team">
          <div className="flex flex-wrap gap-2">
            {plan.team.byDept.map((d) => (
              <span key={d.dept} className="rounded-full border bg-muted/30 px-3 py-1 text-xs">
                {d.dept} · <span className="font-semibold">{d.count}</span>
              </span>
            ))}
          </div>
          {plan.team.leadership.length > 0 && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {plan.team.leadership.map((l) => (
                <div key={l.name} className="rounded-lg border p-2.5">
                  <div className="text-sm font-medium">{l.name}</div>
                  <div className="text-xs text-muted-foreground">{l.title}</div>
                </div>
              ))}
            </div>
          )}
        </Section>

        {/* Financial projections */}
        <Section icon={LineChartIcon} title="Financial Plan">
          <div className="mb-3 flex flex-wrap items-center gap-x-5 gap-y-2 rounded-lg border bg-muted/20 p-3">
            <Assumption label="Revenue CAGR" value={inputs.revenueCagr * 100} onChange={(v) => update({ revenueCagr: v / 100 })} suffix="%" />
            <Assumption label="Target cost ratio" value={inputs.targetCostRatio * 100} onChange={(v) => update({ targetCostRatio: v / 100 })} suffix="%" />
            <Assumption label="Years" value={inputs.projectionYears} onChange={(v) => update({ projectionYears: Math.max(1, Math.min(6, Math.round(v))) })} step={1} />
          </div>

          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={plan.projections} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tickFormatter={(v) => formatCompactInr(v)} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" width={62} />
              <Tooltip formatter={(v) => formatCompactInr(v as number)} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))" }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="revenue" name="Revenue" fill="hsl(var(--chart-1))" radius={[3, 3, 0, 0]} />
              <Bar dataKey="net" name="Net profit" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-3 overflow-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-2 py-2 text-left font-semibold">Period</th>
                  <th className="px-2 py-2 text-right font-semibold">Revenue</th>
                  <th className="px-2 py-2 text-right font-semibold">Cost</th>
                  <th className="px-2 py-2 text-right font-semibold">Net profit</th>
                  <th className="px-2 py-2 text-right font-semibold">Margin</th>
                </tr>
              </thead>
              <tbody>
                {plan.projections.map((y) => (
                  <tr key={y.year} className={cn("border-b last:border-0", y.year === 0 && "bg-muted/20")}>
                    <td className="px-2 py-1.5 font-medium">{y.label}</td>
                    <td className="px-2 py-1.5 text-right tabular"><Money value={y.revenue} compact /></td>
                    <td className="px-2 py-1.5 text-right tabular text-muted-foreground"><Money value={y.cost} compact /></td>
                    <td className={cn("px-2 py-1.5 text-right tabular font-semibold", y.net < 0 ? "text-danger" : "text-success")}>
                      <Money value={y.net} compact />
                    </td>
                    <td className="px-2 py-1.5 text-right tabular">{(y.margin * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Funding */}
        <Section icon={PiggyBank} title="Funding Ask & Use of Funds">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <div className="text-xs font-medium text-muted-foreground">Raising</div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold">₹</span>
                <input
                  type="number"
                  onKeyDown={noNumberNudge}
                  value={inputs.fundingAskCr}
                  onChange={(e) => update({ fundingAskCr: Number(e.target.value) || 0 })}
                  className="w-24 bg-transparent text-2xl font-bold outline-none focus:bg-accent/40 rounded px-1"
                />
                <span className="text-lg font-semibold text-muted-foreground">Cr</span>
              </div>
            </div>
          </div>
          <div className="mt-3 space-y-2">
            {inputs.useOfFunds.map((u, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between text-sm">
                    <span>{u.label}</span>
                    <span className="tabular text-muted-foreground">
                      {formatCompactInr(fundingTotal * u.pct)} · {(u.pct * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${u.pct * 100}%` }} />
                  </div>
                </div>
                <input
                  type="number"
                  onKeyDown={noNumberNudge}
                  value={Math.round(u.pct * 100)}
                  onChange={(e) => {
                    const next = [...inputs.useOfFunds];
                    next[i] = { ...u, pct: (Number(e.target.value) || 0) / 100 };
                    update({ useOfFunds: next });
                  }}
                  className="h-8 w-14 rounded border bg-card px-1.5 text-right text-sm"
                />
              </div>
            ))}
            <p className="text-xs text-muted-foreground">
              Allocation totals {(inputs.useOfFunds.reduce((s, u) => s + u.pct, 0) * 100).toFixed(0)}%.
            </p>
          </div>
        </Section>

        {/* Milestones */}
        <Section icon={Flag} title="12-Month Milestones">
          <div className="space-y-2">
            {inputs.milestones.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <input
                  value={m.when}
                  onChange={(e) => {
                    const next = [...inputs.milestones];
                    next[i] = { ...m, when: e.target.value };
                    update({ milestones: next });
                  }}
                  className="h-8 w-16 rounded border bg-card px-2 text-center text-xs font-semibold"
                />
                <input
                  value={m.label}
                  onChange={(e) => {
                    const next = [...inputs.milestones];
                    next[i] = { ...m, label: e.target.value };
                    update({ milestones: next });
                  }}
                  className="h-8 flex-1 rounded border bg-card px-2 text-sm"
                />
              </div>
            ))}
          </div>
        </Section>
      </div>
    </>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------
function Section({ icon: Icon, title, children }: { icon: typeof Rocket; title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-card px-5 py-3 shadow-sm">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function Tile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-bold tabular">{value}</div>
      {sub && <div className="text-xs text-muted-foreground">{sub}</div>}
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function EditText({
  value,
  onChange,
  rows = 2,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  className?: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      className={cn(
        "w-full resize-none rounded bg-transparent px-1 py-0.5 outline-none focus:bg-accent/40",
        className,
      )}
    />
  );
}

function Assumption({
  label,
  value,
  onChange,
  suffix,
  step = 1,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
      {label}
      <span className="flex items-center">
        <input
          type="number"
          onKeyDown={noNumberNudge}
          value={Math.round(value * 10) / 10}
          step={step}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="h-8 w-16 rounded-md border bg-card px-2 text-right text-sm text-foreground"
        />
        {suffix && <span className="ml-1">{suffix}</span>}
      </span>
    </label>
  );
}

function MarketTile({
  label,
  sub,
  valueCr,
  onChange,
  tone,
}: {
  label: string;
  sub: string;
  valueCr: number;
  onChange: (v: number) => void;
  tone: string;
}) {
  return (
    <div className={cn("rounded-lg border p-3", tone)}>
      <div className="text-xs font-semibold">{label}</div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-sm">₹</span>
        <input
          type="number"
          onKeyDown={noNumberNudge}
          value={valueCr}
          onChange={(e) => onChange(Number(e.target.value) || 0)}
          className="w-24 bg-transparent text-lg font-bold outline-none"
        />
        <span className="text-xs font-semibold text-muted-foreground">Cr</span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Excel — financial model with live projection formulas
// ---------------------------------------------------------------------------
function buildSheets(plan: BusinessPlan): ReportSheet[] {
  const { inputs, base } = plan;
  const growthFactor = 1 + inputs.revenueCagr;

  const projCols: ReportColumn[] = [
    { header: "Period", key: "label", type: "text", width: 20 },
    {
      header: "Revenue",
      key: "revenue",
      type: "money",
      width: 16,
      // Year 1+ revenue grows off the previous row; base year is a literal seed.
      formula: (c) => (c.index === 0 ? "" : `${c.col}${c.row - 1}*${growthFactor.toFixed(4)}`),
    },
    {
      header: "Cost",
      key: "cost",
      type: "money",
      width: 16,
      formula: (c) => `${c.colOf("revenue")}${c.row}*${(plan.projections[c.index].ratio).toFixed(4)}`,
    },
    {
      header: "Net Profit",
      key: "net",
      type: "money",
      width: 16,
      formula: (c) => `${c.colOf("revenue")}${c.row}-${c.colOf("cost")}${c.row}`,
    },
    {
      header: "Margin %",
      key: "margin",
      type: "percent",
      width: 12,
      formula: (c) => `IF(${c.colOf("revenue")}${c.row}=0,0,${c.colOf("net")}${c.row}/${c.colOf("revenue")}${c.row})`,
    },
  ];
  const projRows = plan.projections.map((y, i) => ({
    label: y.label,
    // Only the base year carries a literal revenue; later years are pure formula.
    revenue: i === 0 ? Math.round(y.revenue) : y.revenue,
    cost: Math.round(y.cost),
    net: Math.round(y.net),
    margin: y.margin,
  }));

  const prodCols: ReportColumn[] = [
    { header: "Product", key: "name", type: "text", width: 30 },
    { header: "Price", key: "price", type: "money", width: 12 },
    { header: "Unit Cost", key: "unitCost", type: "money", width: 12 },
    {
      header: "Gross Margin",
      key: "margin",
      type: "percent",
      width: 12,
      formula: (c) => `IF(${c.colOf("price")}${c.row}=0,0,(${c.colOf("price")}${c.row}-${c.colOf("unitCost")}${c.row})/${c.colOf("price")}${c.row})`,
    },
  ];
  const prodRows = plan.products.map((p) => ({
    name: p.name,
    price: Math.round(p.price),
    unitCost: Math.round(p.unitCost),
    margin: p.margin,
  }));

  const total = inputs.fundingAskCr * CRORE;
  const fundCols: ReportColumn[] = [
    { header: "Use of Funds", key: "label", type: "text", width: 30, totalText: "Total raise" },
    { header: "Allocation %", key: "pct", type: "percent", width: 14, total: "sum" },
    {
      header: "Amount",
      key: "amount",
      type: "money",
      width: 16,
      formula: (c) => `${c.colOf("pct")}${c.row}*${Math.round(total)}`,
      total: "sum",
    },
  ];
  const fundRows = inputs.useOfFunds.map((u) => ({ label: u.label, pct: u.pct }));

  const meta = [`${inputs.companyName}`, `Base: ${plan.projections[0].label}`];
  return [
    {
      name: "Financial Model",
      title: `${inputs.companyName} — Financial Model`,
      subtitle: "Revenue compounds at the CAGR assumption; every figure recomputes live.",
      meta,
      columns: projCols,
      rows: projRows,
      notes: [
        `Revenue CAGR ${(inputs.revenueCagr * 100).toFixed(1)}%; cost ratio glides to ${(inputs.targetCostRatio * 100).toFixed(0)}% of revenue.`,
        "Edit the base-year revenue cell and the whole projection re-flows.",
      ],
    },
    { name: "Products", title: "Product Economics", subtitle: "Price vs bill-of-materials cost", meta, columns: prodCols, rows: prodRows },
    { name: "Use of Funds", title: "Use of Funds", subtitle: `Raising ₹${inputs.fundingAskCr} Cr`, meta, columns: fundCols, rows: fundRows, totals: true },
  ];
}

// ---------------------------------------------------------------------------
// PDF (print) rendering
// ---------------------------------------------------------------------------
function planHtml(plan: BusinessPlan): string {
  const { inputs, base } = plan;
  const money = (v: number) => formatCompactInr(v);
  const projRows = plan.projections
    .map(
      (y) =>
        `<tr><td>${y.label}</td><td class="n">${money(y.revenue)}</td><td class="n">${money(y.cost)}</td><td class="n">${money(y.net)}</td><td class="n">${(y.margin * 100).toFixed(1)}%</td></tr>`,
    )
    .join("");
  const prodRows = plan.products
    .map((p) => `<tr><td>${p.name}</td><td class="n">₹${Math.round(p.price)}</td><td class="n">₹${Math.round(p.unitCost)}</td><td class="n">${(p.margin * 100).toFixed(1)}%</td></tr>`)
    .join("");
  const fundRows = inputs.useOfFunds
    .map((u) => `<tr><td>${u.label}</td><td class="n">${(u.pct * 100).toFixed(0)}%</td><td class="n">${money(inputs.fundingAskCr * CRORE * u.pct)}</td></tr>`)
    .join("");
  const milestones = inputs.milestones.map((m) => `<li><b>${m.when}</b> — ${m.label}</li>`).join("");
  return `
    <h1>${inputs.companyName} — Business Plan</h1>
    <div class="sub">${inputs.tagline}</div>
    <h2>Executive Summary</h2><p>${inputs.execSummary}</p>
    <p><b>Revenue (TTM):</b> ${money(base.revenue)} &nbsp; <b>Net margin:</b> ${(base.revenue ? (base.net / base.revenue) * 100 : 0).toFixed(1)}% &nbsp; <b>Team:</b> ${plan.team.total}</p>
    <h2>Problem</h2><p>${inputs.problem}</p>
    <h2>Solution</h2><p>${inputs.solution}</p>
    <h2>Market</h2><p>TAM ₹${inputs.marketTamCr.toLocaleString("en-IN")} Cr · SAM ₹${inputs.marketSamCr.toLocaleString("en-IN")} Cr · SOM ₹${inputs.marketSomCr.toLocaleString("en-IN")} Cr</p>
    <h2>Products</h2><table><thead><tr><th>Product</th><th class="n">Price</th><th class="n">Unit cost</th><th class="n">Margin</th></tr></thead><tbody>${prodRows}</tbody></table>
    <h2>Financial Plan</h2><table><thead><tr><th>Period</th><th class="n">Revenue</th><th class="n">Cost</th><th class="n">Net</th><th class="n">Margin</th></tr></thead><tbody>${projRows}</tbody></table>
    <h2>Funding Ask — ₹${inputs.fundingAskCr} Cr</h2><table><thead><tr><th>Use of funds</th><th class="n">%</th><th class="n">Amount</th></tr></thead><tbody>${fundRows}</tbody></table>
    <h2>Milestones</h2><ul>${milestones}</ul>
  `;
}
