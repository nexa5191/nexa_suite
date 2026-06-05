"use client";

import * as React from "react";
import { Building2, MapPin, Package, Scale } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { KpiStrip } from "@/components/accounting/kpi-strip";
import { ReportControls } from "@/components/reports/report-controls";
import { useReport } from "@/components/reports/use-report";
import { Money } from "@/components/ui/money";
import { Select } from "@/components/ui/input";
import { ExcelExport } from "@/components/excel/excel-export";
import { cn } from "@/lib/utils";
import {
  buildCostAudit,
  DRIVER_LABEL,
  type ProductDriver,
  type AllocRow,
  type CostHead,
  type CostAudit,
} from "@/lib/analysis/cost-audit";
import type { ReportSheet, ReportColumn } from "@/lib/xlsx/report";

type Dim = "entity" | "location" | "product";

const DIMS: { id: Dim; label: string; icon: typeof Building2; head: string }[] = [
  { id: "entity", label: "By Entity", icon: Building2, head: "Entity" },
  { id: "location", label: "By Location", icon: MapPin, head: "Location" },
  { id: "product", label: "By Product", icon: Package, head: "Product" },
];

export function CostAuditClient() {
  const ctl = useReport();
  const [driver, setDriver] = React.useState<ProductDriver>("revenue");
  const [dim, setDim] = React.useState<Dim>("entity");
  const audit = buildCostAudit(ctl.filters, driver);

  const rowsFor = (d: Dim) =>
    d === "entity" ? audit.byEntity : d === "location" ? audit.byLocation : audit.byProduct;
  const rows = rowsFor(dim);
  const dimMeta = DIMS.find((x) => x.id === dim)!;

  const cogs = audit.heads.filter((h) => h.isDirect).reduce((s, h) => s + h.total, 0);
  const overhead = audit.totalCost - cogs;
  const ctr = audit.totalRevenue ? audit.totalCost / audit.totalRevenue : 0;

  return (
    <>
      <PageHeader
        title="Cost Audit & Allocation"
        subtitle="Absorb every cost across entities, locations and products — then export a live Excel model."
        actions={
          <ExcelExport
            filename={`nexa-cost-audit-${ctl.period.from}_${ctl.period.to}`}
            build={() => buildSheets(audit, ctl)}
          />
        }
      />

      <KpiStrip
        items={[
          { label: "Total Cost", value: audit.totalCost },
          { label: "Direct (COGS)", value: cogs, sub: `${pct(audit.totalCost ? cogs / audit.totalCost : 0)} of cost` },
          { label: "Overheads", value: overhead, sub: `${pct(audit.totalCost ? overhead / audit.totalCost : 0)} of cost` },
          { label: "Cost-to-Revenue", value: audit.totalRevenue, sub: `${pct(ctr)} absorbed`, colored: true },
        ]}
      />

      <ReportControls ctl={ctl} />

      {/* Dimension tabs + product driver */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-1 rounded-lg border bg-card p-1 shadow-sm">
          {DIMS.map((d) => {
            const Icon = d.icon;
            return (
              <button
                key={d.id}
                onClick={() => setDim(d.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  dim === d.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
                )}
              >
                <Icon className="size-4" />
                {d.label}
              </button>
            );
          })}
        </div>
        {dim === "product" && (
          <div className="ml-auto flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Scale className="size-3.5" />
              Overhead driver
            </span>
            <Select
              value={driver}
              onChange={(e) => setDriver(e.target.value as ProductDriver)}
              className="h-8 w-48 text-xs"
            >
              {(Object.keys(DRIVER_LABEL) as ProductDriver[]).map((d) => (
                <option key={d} value={d}>
                  {DRIVER_LABEL[d]}
                </option>
              ))}
            </Select>
          </div>
        )}
      </div>

      <CostMatrix rows={rows} heads={audit.heads} dimLabel={dimMeta.head} total={audit} />

      {dim === "product" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Direct costs (Cost of Sales) are absorbed on each SKU’s bill-of-materials cost; overheads on{" "}
          <span className="font-medium">{DRIVER_LABEL[driver].toLowerCase()}</span>. Entity and location
          splits are actual GL postings.
        </p>
      )}
    </>
  );
}

function CostMatrix({
  rows,
  heads,
  dimLabel,
  total,
}: {
  rows: AllocRow[];
  heads: CostHead[];
  dimLabel: string;
  total: CostAudit;
}) {
  const headTotal = (code: string) => rows.reduce((s, r) => s + (r.costByHead[code] ?? 0), 0);
  const grandRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const grandCost = rows.reduce((s, r) => s + r.totalCost, 0);
  return (
    <div className="overflow-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 text-left font-semibold">{dimLabel}</th>
            {heads.map((h) => (
              <th key={h.code} className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">
                {h.name}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-semibold text-foreground">Total Cost</th>
            <th className="px-3 py-2.5 text-right font-semibold">Share</th>
            <th className="px-3 py-2.5 text-right font-semibold">Revenue</th>
            <th className="px-3 py-2.5 text-right font-semibold">Margin %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
              <td className="sticky left-0 z-10 bg-card px-3 py-2.5">
                <div className="font-medium">{r.name}</div>
                {r.sub && <div className="text-xs text-muted-foreground">{r.sub}</div>}
              </td>
              {heads.map((h) => (
                <td key={h.code} className="px-3 py-2.5 text-right tabular">
                  <Money value={r.costByHead[h.code] ?? 0} compact />
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-semibold tabular">
                <Money value={r.totalCost} compact />
              </td>
              <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{pct(r.share)}</td>
              <td className="px-3 py-2.5 text-right tabular">
                <Money value={r.revenue} compact />
              </td>
              <td
                className={cn(
                  "px-3 py-2.5 text-right font-medium tabular",
                  r.marginPct < 0 ? "text-danger" : "text-success",
                )}
              >
                {r.revenue ? pct(r.marginPct) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 bg-muted/30 font-semibold">
            <td className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5">Total</td>
            {heads.map((h) => (
              <td key={h.code} className="px-3 py-2.5 text-right tabular">
                <Money value={headTotal(h.code)} compact />
              </td>
            ))}
            <td className="px-3 py-2.5 text-right tabular">
              <Money value={grandCost} compact />
            </td>
            <td className="px-3 py-2.5 text-right tabular text-muted-foreground">100%</td>
            <td className="px-3 py-2.5 text-right tabular">
              <Money value={grandRevenue} compact />
            </td>
            <td className="px-3 py-2.5 text-right tabular">
              {grandRevenue ? pct((grandRevenue - grandCost) / grandRevenue) : "—"}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Excel model — every derived figure is a live formula so the sheet recomputes.
// ---------------------------------------------------------------------------
function dimSheet(
  name: string,
  dimLabel: string,
  subtitle: string,
  meta: string[],
  rows: AllocRow[],
  heads: CostHead[],
): ReportSheet {
  const firstHead = heads[0]?.code ?? "name";
  const lastHead = heads[heads.length - 1]?.code ?? "name";

  const columns: ReportColumn[] = [
    { header: dimLabel, key: "name", type: "text", width: 30, totalText: "Total" },
    ...heads.map<ReportColumn>((h) => ({
      header: h.name,
      key: h.code,
      type: "money",
      width: 14,
      total: "sum",
    })),
    {
      header: "Total Cost",
      key: "totalCost",
      type: "money",
      width: 15,
      formula: (c) => `SUM(${c.colOf(firstHead)}${c.row}:${c.colOf(lastHead)}${c.row})`,
      total: "sum",
    },
    {
      header: "Share %",
      key: "share",
      type: "percent",
      width: 10,
      formula: (c) => `${c.colOf("totalCost")}${c.row}/${c.colOf("totalCost")}$${c.lastRow + 1}`,
      total: "sum",
    },
    { header: "Revenue", key: "revenue", type: "money", width: 15, total: "sum" },
    {
      header: "Margin",
      key: "margin",
      type: "money",
      width: 15,
      formula: (c) => `${c.colOf("revenue")}${c.row}-${c.colOf("totalCost")}${c.row}`,
      total: "sum",
    },
    {
      header: "Margin %",
      key: "marginPct",
      type: "percent",
      width: 10,
      formula: (c) =>
        `IF(${c.colOf("revenue")}${c.row}=0,0,${c.colOf("margin")}${c.row}/${c.colOf("revenue")}${c.row})`,
      total: (c) =>
        `IF(${c.colOf("revenue")}${c.lastRow + 1}=0,0,${c.colOf("margin")}${c.lastRow + 1}/${c.colOf("revenue")}${c.lastRow + 1})`,
    },
    {
      header: "Cost/Rev",
      key: "costToRevenue",
      type: "percent",
      width: 10,
      formula: (c) =>
        `IF(${c.colOf("revenue")}${c.row}=0,0,${c.colOf("totalCost")}${c.row}/${c.colOf("revenue")}${c.row})`,
      total: (c) =>
        `IF(${c.colOf("revenue")}${c.lastRow + 1}=0,0,${c.colOf("totalCost")}${c.lastRow + 1}/${c.colOf("revenue")}${c.lastRow + 1})`,
    },
  ];

  const dataRows = rows.map((r) => {
    const o: Record<string, number | string> = { name: r.name };
    for (const h of heads) o[h.code] = Math.round(r.costByHead[h.code] ?? 0);
    o.totalCost = Math.round(r.totalCost);
    o.share = r.share;
    o.revenue = Math.round(r.revenue);
    o.margin = Math.round(r.margin);
    o.marginPct = r.marginPct;
    o.costToRevenue = r.costToRevenue;
    return o;
  });

  return { name, title: `Cost Audit — ${dimLabel}`, subtitle, meta, columns, rows: dataRows, totals: true };
}

function buildSheets(audit: CostAudit, ctl: ReturnType<typeof useReport>): ReportSheet[] {
  const meta = [`Scope: ${ctl.fullScopeLabel}`, `Period: ${ctl.periodLabel}`];
  const sub = "All figures in INR. Derived cells are live formulas.";

  // Summary sheet — cost heads.
  const summary: ReportSheet = {
    name: "Summary",
    title: "Cost Audit — Cost Heads",
    subtitle: sub,
    meta,
    columns: [
      { header: "Cost Head", key: "name", type: "text", width: 30, totalText: "Total Cost" },
      { header: "Type", key: "type", type: "text", width: 14 },
      { header: "Amount", key: "amount", type: "money", width: 16, total: "sum" },
      {
        header: "% of Cost",
        key: "share",
        type: "percent",
        width: 12,
        formula: (c) => `${c.colOf("amount")}${c.row}/${c.colOf("amount")}$${c.lastRow + 1}`,
        total: "sum",
      },
    ],
    rows: audit.heads.map((h) => ({
      name: h.name,
      type: h.isDirect ? "Direct (COGS)" : "Overhead",
      amount: Math.round(h.total),
      share: audit.totalCost ? h.total / audit.totalCost : 0,
    })),
    totals: true,
    notes: [
      `Product overheads absorbed on: ${DRIVER_LABEL[audit.driver]}.`,
      "Entity & location splits are actual GL postings; product split is driver-based absorption.",
    ],
  };

  return [
    summary,
    dimSheet("By Entity", "Entity", sub, meta, audit.byEntity, audit.heads),
    dimSheet("By Location", "Location", sub, meta, audit.byLocation, audit.heads),
    dimSheet("By Product", "Product", `${sub} Driver: ${DRIVER_LABEL[audit.driver]}.`, meta, audit.byProduct, audit.heads),
  ];
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
