"use client";

import * as React from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from "recharts";
import { TrendingUp, ChevronRight, Info } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { Drawer } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  runDcf, DEFAULT_SEGMENTS, DEFAULT_PARAMS,
  ALLOCATION_META,
  type DcfSegment, type DcfResult, type SegmentDcf, type AllocationBasis,
} from "@/lib/finance/dcf";

const FMT = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 1 });
const PCT = (v: number) => `${v.toFixed(1)}%`;

function cr(v: number) {
  const abs = Math.abs(v) / 1_00_00_000;
  return `₹${FMT.format(abs)} Cr`;
}

function lakh(v: number) {
  const abs = Math.abs(v) / 1_00_000;
  return `${FMT.format(abs)}L`;
}

const WACC_STEPS = [-2, -1, 0, 1, 2];
const G_STEPS = [-1, -0.5, 0, 0.5, 1];

export function DcfClient() {
  const [segments, setSegments] = React.useState<DcfSegment[]>(DEFAULT_SEGMENTS);
  const [params, setParams] = React.useState(DEFAULT_PARAMS);
  const [result, setResult] = React.useState<DcfResult>(() => runDcf(DEFAULT_SEGMENTS, DEFAULT_PARAMS));
  const [drillSeg, setDrillSeg] = React.useState<SegmentDcf | null>(null);

  function recompute(segs: DcfSegment[], p: typeof params) {
    setResult(runDcf(segs, p));
  }

  function updateParam<K extends keyof typeof params>(k: K, v: typeof params[K]) {
    const next = { ...params, [k]: v };
    setParams(next);
    recompute(segments, next);
  }

  function updateSegment(id: string, patch: Partial<DcfSegment>) {
    const next = segments.map((s) => s.id === id ? { ...s, ...patch } : s);
    setSegments(next);
    recompute(next, params);
    // keep drawer in sync
    if (drillSeg?.segment.id === id) {
      const updated = result.segments.find((s) => s.segment.id === id);
      if (updated) setDrillSeg({ ...updated, segment: { ...updated.segment, ...patch } });
    }
  }

  const { consolidated, enterpriseValue, sensitivity } = result;
  const pvFcfs = result.segments.reduce((s, sd) => s + sd.sumPvFcf, 0);
  const evMin = Math.min(...sensitivity.flat().map((c) => c.ev).filter((v) => v !== 0));
  const evMax = Math.max(...sensitivity.flat().map((c) => c.ev).filter((v) => v !== 0));

  // FCF bar data
  const barData = consolidated.map((y) => ({
    name: `Y${y.year}`,
    fcf: y.fcf / 1_00_00_000,
    pvFcf: y.pvFcf / 1_00_00_000,
  }));

  return (
    <>
      <PageHeader
        title="Discounted Cash Flow"
        subtitle="Multi-segment DCF with per-segment overhead allocation. Each segment chooses its own allocation metric."
      />

      {/* ── Parameters ── */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-end gap-4">
          <ParamInput label="WACC %" value={params.wacc} onChange={(v) => updateParam("wacc", v)} step={0.5} min={1} max={30} />
          <ParamInput label="Terminal growth %" value={params.terminalGrowth} onChange={(v) => updateParam("terminalGrowth", v)} step={0.5} min={0} max={10} />
          <ParamInput label="Tax rate %" value={params.taxRate} onChange={(v) => updateParam("taxRate", v)} step={1} min={0} max={40} />
          <ParamInput label="Projection years" value={params.years} onChange={(v) => updateParam("years", Math.round(v))} step={1} min={1} max={10} />
          <div>
            <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Shared overhead / yr</p>
            <Input
              type="number"
              value={params.sharedOverhead / 1_00_000}
              onChange={(e) => updateParam("sharedOverhead", Number(e.target.value) * 1_00_000)}
              className="h-8 w-32 text-right tabular text-sm"
            />
            <span className="ml-1 text-xs text-muted-foreground">L</span>
          </div>
        </div>
      </Card>

      {/* ── EV KPIs ── */}
      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <EvCard label="Enterprise Value" value={cr(enterpriseValue)} sub="PV of FCFs + terminal" highlight />
        <EvCard label="PV of FCFs" value={cr(pvFcfs)} sub={`${PCT(pvFcfs / enterpriseValue * 100)} of EV`} />
        <EvCard label="PV of terminal" value={cr(result.pvTerminalConsolidated)} sub={`${PCT(result.pvTerminalConsolidated / enterpriseValue * 100)} of EV`} />
        <EvCard label="WACC / TV growth" value={`${params.wacc}% / ${params.terminalGrowth}%`} sub="Spread: " extra={PCT((params.wacc - params.terminalGrowth))} />
      </div>

      {/* ── Segment cards + drill-in ── */}
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Segments — click any card to drill down and change its allocation basis
      </p>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        {result.segments.map((sd) => {
          const seg = sd.segment;
          const pct = enterpriseValue > 0 ? sd.npv / enterpriseValue * 100 : 0;
          return (
            <button
              key={seg.id}
              onClick={() => setDrillSeg(sd)}
              className="text-left rounded-xl border bg-card p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 font-semibold text-sm">
                  <span className="size-2.5 rounded-full" style={{ background: seg.color }} />
                  {seg.name}
                </span>
                <ChevronRight className="size-4 text-muted-foreground/50" />
              </div>
              <p className="text-xl font-bold tabular">{cr(sd.npv)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{PCT(pct)} of EV</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1 flex-1 rounded-full bg-muted">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(100, pct)}%`, background: seg.color }} />
                </div>
              </div>
              <div className="mt-2 flex items-center gap-1.5">
                <Badge variant="default" className="text-[10px]">
                  {ALLOCATION_META[seg.allocationBasis].label}
                </Badge>
                <span className="text-[11px] text-muted-foreground">
                  {PCT(sd.allocationWeight * 100)} of overhead
                </span>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Consolidated FCF table ── */}
      <Card className="mb-4 overflow-hidden">
        <div className="border-b px-5 py-3 flex items-center justify-between">
          <p className="font-semibold">Consolidated FCF — {params.years}-year projection</p>
          <span className="text-xs text-muted-foreground">All amounts ₹ Cr</span>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground text-left">
                <th className="px-4 py-2.5 font-medium">Metric</th>
                {consolidated.map((y) => (
                  <th key={y.year} className="px-4 py-2.5 text-right font-medium">Year {y.year}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[
                { label: "Revenue",           key: "revenue" as const,  bold: false },
                { label: "EBITDA",            key: "ebitda" as const,   bold: false },
                { label: "– Shared overhead", key: "overhead" as const,  bold: false, neg: true },
                { label: "NOPAT (post-tax)",  key: "nopat" as const,    bold: false },
                { label: "– Capex",           key: "capex" as const,     bold: false, neg: true },
                { label: "– ΔWC",             key: "deltaWC" as const,   bold: false, neg: true },
                { label: "Free Cash Flow",    key: "fcf" as const,       bold: true },
                { label: "PV of FCF",         key: "pvFcf" as const,     bold: false, muted: true },
              ].map(({ label, key, bold, neg, muted }) => (
                <tr key={key} className={cn("border-b last:border-0", bold && "bg-muted/20")}>
                  <td className={cn("px-4 py-2 text-sm", bold && "font-semibold", muted && "text-muted-foreground")}>{label}</td>
                  {consolidated.map((y) => {
                    const raw = y[key];
                    const v = neg ? -raw : raw;
                    return (
                      <td key={y.year} className={cn("px-4 py-2 text-right tabular-nums", bold && "font-semibold", muted && "text-muted-foreground", v < 0 && "text-danger")}>
                        {lakh(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr className="border-b bg-primary/5">
                <td className="px-4 py-2 text-sm font-semibold text-primary">Cumulative PV FCF</td>
                {consolidated.map((_, i) => {
                  const cumPv = consolidated.slice(0, i + 1).reduce((s, y) => s + y.pvFcf, 0);
                  return <td key={i} className="px-4 py-2 text-right tabular-nums font-semibold text-primary">{lakh(cumPv)}</td>;
                })}
              </tr>
            </tbody>
          </table>
        </div>
        <div className="border-t bg-muted/10 px-5 py-2.5 text-xs text-muted-foreground">
          Terminal value: {cr(result.totalTerminalValue)} · PV of terminal: <strong>{cr(result.pvTerminalConsolidated)}</strong> · Enterprise value: <strong className="text-foreground">{cr(enterpriseValue)}</strong>
        </div>
      </Card>

      {/* ── FCF bar chart ── */}
      <Card className="mb-4 p-4">
        <p className="mb-3 text-sm font-semibold">Free Cash Flow — FCF vs PV (₹ Cr)</p>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={barData} barGap={4}>
            <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} tickFormatter={(v) => `${FMT.format(v)}`} />
            <Tooltip
              formatter={(v: number, name: string) => [`₹${FMT.format(v)} Cr`, name === "fcf" ? "FCF" : "PV of FCF"]}
              labelStyle={{ fontSize: 11 }}
              contentStyle={{ fontSize: 12 }}
            />
            <ReferenceLine y={0} stroke="currentColor" strokeOpacity={0.2} />
            <Bar dataKey="fcf" name="fcf" radius={[3, 3, 0, 0]}>
              {barData.map((_, i) => <Cell key={i} fill="#3b82f6" fillOpacity={0.85} />)}
            </Bar>
            <Bar dataKey="pvFcf" name="pvFcf" radius={[3, 3, 0, 0]}>
              {barData.map((_, i) => <Cell key={i} fill="#10b981" fillOpacity={0.75} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-1 flex gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-blue-500/80" /> FCF (nominal)</span>
          <span className="flex items-center gap-1"><span className="size-2.5 rounded-sm bg-emerald-500/75" /> PV of FCF</span>
        </div>
      </Card>

      {/* ── Sensitivity matrix ── */}
      <Card className="mb-4 overflow-hidden">
        <div className="border-b px-5 py-3 flex items-center gap-2">
          <p className="font-semibold">Sensitivity — Enterprise Value (₹ Cr)</p>
          <Info className="size-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">rows = WACC, cols = terminal growth</span>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                <th className="px-4 py-2 text-left font-medium">WACC ↓ / g →</th>
                {G_STEPS.map((d) => (
                  <th key={d} className="px-4 py-2 text-right font-medium">
                    {d >= 0 ? "+" : ""}{d}% ({(params.terminalGrowth + d).toFixed(1)}%)
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {WACC_STEPS.map((wd, ri) => (
                <tr key={wd} className="border-b last:border-0">
                  <td className="px-4 py-2 font-medium text-xs">
                    {wd >= 0 ? "+" : ""}{wd}% ({(params.wacc + wd).toFixed(1)}%)
                  </td>
                  {sensitivity[ri]?.map((cell, ci) => {
                    const isBase = wd === 0 && G_STEPS[ci] === 0;
                    const invalid = cell.ev === 0;
                    const intensity = invalid ? 0 : (cell.ev - evMin) / (evMax - evMin || 1);
                    return (
                      <td
                        key={ci}
                        className={cn(
                          "px-4 py-2 text-right tabular-nums text-xs font-medium",
                          isBase && "ring-1 ring-inset ring-primary",
                          invalid && "text-muted-foreground",
                        )}
                        style={!invalid ? {
                          background: `rgba(${intensity < 0.5
                            ? `239,68,68,${(0.5 - intensity) * 0.4}`
                            : `34,197,94,${(intensity - 0.5) * 0.4}`})`,
                        } : undefined}
                      >
                        {invalid ? "n/a" : FMT.format(cell.ev / 1_00_00_000)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-2 text-[11px] text-muted-foreground border-t">
          Green = higher EV · Red = lower EV · n/a = terminal growth ≥ WACC (model undefined) · Base case outlined
        </p>
      </Card>

      {/* ── Segment drill-down drawer ── */}
      {drillSeg && (
        <SegmentDrawer
          sd={drillSeg}
          params={params}
          onClose={() => setDrillSeg(null)}
          onChangeBasis={(id, basis) => {
            updateSegment(id, { allocationBasis: basis });
            // Re-find updated segment after recompute
            setTimeout(() => {
              setDrillSeg((prev) => {
                if (!prev) return null;
                const updated = result.segments.find((s) => s.segment.id === id);
                return updated ? { ...updated, segment: { ...updated.segment, allocationBasis: basis } } : prev;
              });
            }, 0);
          }}
          onChangeCustomWeight={(id, w) => updateSegment(id, { customWeight: w })}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Segment drill-down drawer
// ---------------------------------------------------------------------------
function SegmentDrawer({
  sd, params, onClose, onChangeBasis, onChangeCustomWeight,
}: {
  sd: SegmentDcf;
  params: typeof DEFAULT_PARAMS;
  onClose: () => void;
  onChangeBasis: (id: string, b: AllocationBasis) => void;
  onChangeCustomWeight: (id: string, w: number) => void;
}) {
  const seg = sd.segment;

  // Use a local state for the re-run so the drawer stays live
  const [localBasis, setLocalBasis] = React.useState<AllocationBasis>(seg.allocationBasis);
  const [localWeight, setLocalWeight] = React.useState(seg.customWeight);

  function applyBasis(basis: AllocationBasis) {
    setLocalBasis(basis);
    onChangeBasis(seg.id, basis);
  }

  function applyWeight(w: number) {
    setLocalWeight(w);
    onChangeCustomWeight(seg.id, w);
  }

  const metricLabel = {
    revenue: `₹${(seg.baseRevenue / 1_00_00_000).toFixed(1)} Cr base revenue`,
    volume: `Volume index: ${seg.volumeIndex}`,
    headcount: `${seg.headcount} employees`,
    equal: "Equal share",
    custom: `Custom weight: ${localWeight}`,
  }[localBasis];

  return (
    <Drawer
      open
      onClose={onClose}
      title={
        <span className="flex items-center gap-2">
          <span className="size-3 rounded-full" style={{ background: seg.color }} />
          {seg.name}
        </span>
      }
      subtitle="Segment DCF drill-down"
      actions={<Badge variant="default">{ALLOCATION_META[localBasis].label}</Badge>}
    >
      <div className="space-y-5">
        {/* EV summary */}
        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Segment NPV" value={cr(sd.npv)} />
          <MiniStat label="PV of FCFs" value={cr(sd.sumPvFcf)} />
          <MiniStat label="PV terminal" value={cr(sd.pvTerminal)} />
        </div>

        {/* Allocation basis selector */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Allocation metric — this segment's overhead basis
            </p>
            <p className="text-xs text-muted-foreground">{ALLOCATION_META[localBasis].description}</p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(ALLOCATION_META) as AllocationBasis[]).map((b) => (
              <button
                key={b}
                onClick={() => applyBasis(b)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium border transition-colors",
                  localBasis === b
                    ? "bg-primary text-primary-foreground border-primary"
                    : "text-muted-foreground border-border hover:bg-accent",
                )}
              >
                {ALLOCATION_META[b].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Metric value:</span>
            <span className="font-medium">{metricLabel}</span>
            <span className="text-muted-foreground ml-auto">→ {(sd.allocationWeight * 100).toFixed(1)}% of overhead</span>
          </div>
          {localBasis === "custom" && (
            <label className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">Weight (0–100):</span>
              <Input
                type="number" min={0} max={100} step={1}
                value={localWeight}
                onChange={(e) => applyWeight(Number(e.target.value))}
                className="h-7 w-20 text-right tabular text-xs"
              />
            </label>
          )}
          <p className="text-[11px] text-muted-foreground">
            Overhead allocated this segment: <strong>{cr(sd.years[0]?.overhead ?? 0)}/yr</strong> at base year weights.
            Changing this basis recalculates all segments simultaneously.
          </p>
        </div>

        {/* Year-by-year projection */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Year-by-year projection</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-muted-foreground text-left">
                  <th className="py-1.5 font-medium">Line</th>
                  {sd.years.map((y) => <th key={y.year} className="py-1.5 text-right font-medium">Y{y.year}</th>)}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: "Revenue", key: "revenue" as const },
                  { label: "EBITDA", key: "ebitda" as const },
                  { label: "– OH alloc.", key: "overhead" as const, neg: true },
                  { label: "EBITDA (net OH)", key: "ebitdaAfterOH" as const },
                  { label: "– Tax", key: "tax" as const, neg: true },
                  { label: "NOPAT", key: "nopat" as const },
                  { label: "– Capex", key: "capex" as const, neg: true },
                  { label: "– ΔWC", key: "deltaWC" as const, neg: true },
                  { label: "FCF", key: "fcf" as const, bold: true },
                  { label: "PV of FCF", key: "pvFcf" as const, muted: true },
                ].map(({ label, key, neg, bold, muted }) => (
                  <tr key={key} className={cn("border-b last:border-0", bold && "bg-muted/20")}>
                    <td className={cn("py-1.5 pr-2", bold && "font-semibold", muted && "text-muted-foreground")}>{label}</td>
                    {sd.years.map((y) => {
                      const raw = y[key];
                      const v = neg ? -raw : raw;
                      return (
                        <td key={y.year} className={cn("py-1.5 text-right tabular-nums", bold && "font-semibold", muted && "text-muted-foreground", v < 0 && "text-danger")}>
                          {lakh(v)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-md border bg-muted/10 px-3 py-2 text-xs text-muted-foreground">
          Terminal value (Gordon): <strong>{cr(sd.terminalValue)}</strong> · PV: <strong>{cr(sd.pvTerminal)}</strong>
          <br />
          Growth: {PCT(seg.revenueGrowth)} CAGR → margin target {PCT(seg.ebitdaMarginTarget)} · Capex {PCT(seg.capexPct)} of rev · ΔWC {PCT(seg.wcPct)} of incr. rev
        </div>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------
function ParamInput({
  label, value, onChange, step, min, max,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  return (
    <label className="block">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <Input
        type="number"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-8 w-24 text-right tabular text-sm"
      />
    </label>
  );
}

function EvCard({ label, value, sub, extra, highlight }: {
  label: string; value: string; sub: string; extra?: string; highlight?: boolean;
}) {
  return (
    <Card className={cn("p-4", highlight && "border-primary/30 bg-primary/5")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular", highlight && "text-primary")}>{value}</p>
      <p className="text-[11px] text-muted-foreground mt-0.5">{sub}{extra && <strong> {extra}</strong>}</p>
    </Card>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-base font-bold tabular">{value}</p>
    </div>
  );
}
