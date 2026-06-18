"use client";

import * as React from "react";
import { Building2, MapPin, Package, Factory, FileSpreadsheet, SlidersHorizontal, Boxes, Hash, Rows3, Columns3 } from "lucide-react";
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
  DRIVER_SHORT,
  type ProductDriver,
  type HeadDrivers,
  type AllocRow,
  type CostHead,
  type CostAudit,
  type CostSheet,
  type ProductMovement,
} from "@/lib/analysis/cost-audit";
import { OWNERSHIP_META } from "@/lib/inventory/items";
import { allMovements, loadAddedMovements } from "@/lib/inventory/movements";
import type { Movement } from "@/lib/inventory/types";
import type { ReportSheet, ReportColumn } from "@/lib/xlsx/report";

type Dim = "entity" | "location" | "product" | "ownership";

const DIMS: { id: Dim; label: string; icon: typeof Building2; head: string }[] = [
  { id: "entity", label: "By Entity", icon: Building2, head: "Entity" },
  { id: "location", label: "By Location", icon: MapPin, head: "Location" },
  { id: "product", label: "By Product", icon: Package, head: "Product" },
  { id: "ownership", label: "By Sourcing", icon: Factory, head: "Sourcing model" },
];

export function CostAuditClient() {
  const ctl = useReport();
  // Per-head allocation overrides (head code → driver); empty = engine defaults.
  const [drivers, setDrivers] = React.useState<HeadDrivers>({});
  const [perUnit, setPerUnit] = React.useState(false);
  const [transposed, setTransposed] = React.useState(false);
  const [dim, setDim] = React.useState<Dim>("entity");

  // Merge persisted production/sales movements (client-only) into the audit so
  // the stock-movement view reflects runs posted in this browser.
  const [added, setAdded] = React.useState<Movement[]>([]);
  React.useEffect(() => setAdded(loadAddedMovements()), [ctl.version]);
  const movements = React.useMemo(() => allMovements(added), [added]);

  const audit = buildCostAudit(ctl.filters, drivers, movements);

  const rowsFor = (d: Dim) =>
    d === "entity"
      ? audit.byEntity
      : d === "location"
        ? audit.byLocation
        : d === "ownership"
          ? audit.byOwnership
          : audit.byProduct;
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
        <div className="ml-auto flex items-center gap-2">
          {dim === "product" && (
            <label
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-xs font-medium shadow-sm transition-colors",
                perUnit ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground hover:bg-accent",
              )}
            >
              <input
                type="checkbox"
                checked={perUnit}
                onChange={(e) => setPerUnit(e.target.checked)}
                className="size-3.5 accent-[hsl(var(--primary))]"
              />
              <Hash className="size-3.5" />
              Units &amp; ₹/unit
            </label>
          )}
          <div className="flex gap-1 rounded-lg border bg-card p-1 shadow-sm">
            <button
              onClick={() => setTransposed(false)}
              title={`${dimMeta.head} down rows, cost heads across columns`}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                !transposed ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Rows3 className="size-3.5" />
              Vertical
            </button>
            <button
              onClick={() => setTransposed(true)}
              title={`${dimMeta.head} across columns, cost heads down rows`}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                transposed ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Columns3 className="size-3.5" />
              Horizontal
            </button>
          </div>
        </div>
      </div>

      {dim === "product" && (
        <AllocationControls
          heads={audit.heads}
          drivers={audit.drivers}
          onChange={(code, d) => setDrivers((prev) => ({ ...prev, [code]: d }))}
          onReset={() => setDrivers({})}
        />
      )}

      <CostMatrix
        rows={rows}
        heads={audit.heads}
        dimLabel={dimMeta.head}
        total={audit}
        perUnit={dim === "product" && perUnit}
        transposed={transposed}
      />

      {dim === "product" && <ProductMovementTable movements={audit.productMovements} />}

      {dim === "product" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Units sold and product revenue come from the stock-dispatch ledger (the same figures as the
          Inventory Movement table below), so per-unit costs tie out. Each cost head is absorbed on its own
          driver (set above) — direct costs default to each SKU’s bill-of-materials cost, overheads to
          revenue share. Only SKUs dispatched in the period carry cost; product revenue is goods sold ×
          list rate, so it can differ from total income (which also includes services and wholesale).
        </p>
      )}
      {dim === "ownership" && (
        <p className="mt-3 text-xs text-muted-foreground">
          Own / loan-licence / third-party. Direct heads map to their sourcing model (Loan Licence → 5040,
          Third-party → 5050); overheads spread on revenue share.
        </p>
      )}

      {/* Product cost sheets */}
      <div className="mt-8 mb-3 flex items-center gap-2">
        <FileSpreadsheet className="size-4 text-muted-foreground" />
        <h2 className="text-base font-bold tracking-tight">Product Cost Sheets</h2>
        <span className="text-xs text-muted-foreground">standard per-unit build-up + absorbed overhead</span>
      </div>
      <CostSheetTable sheets={audit.costSheets} />
    </>
  );
}

/** Muted per-unit sub-line shown under an absorbed amount when ₹/unit is on. */
function PerU({ value, units }: { value: number; units?: number }) {
  if (!units) return null;
  return (
    <div className="text-[11px] font-normal text-muted-foreground tabular">
      <Money value={value / units} compact />/u
    </div>
  );
}

// Per-expense-line allocation picker — one driver Select per cost head.
function AllocationControls({
  heads,
  drivers,
  onChange,
  onReset,
}: {
  heads: CostHead[];
  drivers: HeadDrivers;
  onChange: (code: string, d: ProductDriver) => void;
  onReset: () => void;
}) {
  return (
    <div className="mb-4 rounded-lg border bg-card p-3 shadow-sm">
      <div className="mb-2.5 flex items-center gap-2">
        <SlidersHorizontal className="size-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold">Expense allocation</h3>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          choose the metric that absorbs each cost head onto products
        </span>
        <button onClick={onReset} className="ml-auto text-xs font-medium text-primary hover:underline">
          Reset to default
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {heads.map((h) => (
          <div key={h.code} className="flex items-center gap-2 rounded-md border bg-background/40 px-2.5 py-1.5">
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium" title={h.name}>
                {h.name}
              </div>
              <div className="text-[10px] uppercase tracking-wide text-muted-foreground">
                {h.isDirect ? "Direct · COGS" : "Overhead"}
              </div>
            </div>
            <Select
              value={drivers[h.code]}
              onChange={(e) => onChange(h.code, e.target.value as ProductDriver)}
              className="h-7 w-[104px] text-xs"
              title={DRIVER_LABEL[drivers[h.code]]}
            >
              {(Object.keys(DRIVER_LABEL) as ProductDriver[]).map((d) => (
                <option key={d} value={d}>
                  {DRIVER_SHORT[d]}
                </option>
              ))}
            </Select>
          </div>
        ))}
      </div>
    </div>
  );
}

// Per-product stock movement (units), reconciling opening → closing.
function ProductMovementTable({ movements }: { movements: ProductMovement[] }) {
  if (!movements.length) return null;
  const sum = (k: keyof ProductMovement) => movements.reduce((s, m) => s + (m[k] as number), 0);
  return (
    <div className="mt-7">
      <div className="mb-3 flex items-center gap-2">
        <Boxes className="size-4 text-muted-foreground" />
        <h2 className="text-base font-bold tracking-tight">Inventory Movement</h2>
        <span className="text-xs text-muted-foreground">units in/out this period, from the stock ledger</span>
      </div>
      <div className="overflow-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 text-left font-semibold">Product</th>
              <th className="px-3 py-2.5 text-right font-semibold">Opening</th>
              <th className="px-3 py-2.5 text-right font-semibold">+ Production</th>
              <th className="px-3 py-2.5 text-right font-semibold">− Sales</th>
              <th className="px-3 py-2.5 text-right font-semibold">− Write-off</th>
              <th className="px-3 py-2.5 text-right font-semibold">± Transfer</th>
              <th className="px-3 py-2.5 text-right font-semibold text-foreground">Closing</th>
              <th className="px-3 py-2.5 text-right font-semibold">Closing value</th>
            </tr>
          </thead>
          <tbody>
            {movements.map((m) => (
              <tr key={m.id} className="border-b last:border-0 hover:bg-accent/40">
                <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-medium">{m.name}</td>
                <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{qty(m.opening)}</td>
                <td className="px-3 py-2.5 text-right tabular text-success">{signed(m.production)}</td>
                <td className="px-3 py-2.5 text-right tabular text-danger">{negated(m.sales)}</td>
                <td className="px-3 py-2.5 text-right tabular text-warning">{negated(m.writeoff)}</td>
                <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{signed(m.transfers)}</td>
                <td className="px-3 py-2.5 text-right font-semibold tabular">{qty(m.closing)}</td>
                <td className="px-3 py-2.5 text-right tabular">
                  <Money value={m.closingValue} compact />
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/30 font-semibold">
              <td className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5">Total</td>
              <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{qty(sum("opening"))}</td>
              <td className="px-3 py-2.5 text-right tabular text-success">{signed(sum("production"))}</td>
              <td className="px-3 py-2.5 text-right tabular text-danger">{negated(sum("sales"))}</td>
              <td className="px-3 py-2.5 text-right tabular text-warning">{negated(sum("writeoff"))}</td>
              <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{signed(sum("transfers"))}</td>
              <td className="px-3 py-2.5 text-right tabular">{qty(sum("closing"))}</td>
              <td className="px-3 py-2.5 text-right tabular">
                <Money value={sum("closingValue")} compact />
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// Quantity formatters for the movement table (rounded, en-IN grouped).
const qty = (n: number) => (Math.abs(n) < 0.5 ? "—" : Math.round(n).toLocaleString("en-IN"));
const signed = (n: number) =>
  Math.abs(n) < 0.5 ? "—" : `${n > 0 ? "+" : "−"}${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
const negated = (n: number) => (Math.abs(n) < 0.5 ? "—" : `−${Math.round(Math.abs(n)).toLocaleString("en-IN")}`);

function CostSheetTable({ sheets }: { sheets: CostSheet[] }) {
  return (
    <div className="overflow-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full min-w-[920px] text-sm">
        <thead className="sticky top-0 z-10">
          <tr className="border-b bg-muted text-xs uppercase tracking-wide text-muted-foreground">
            <th className="sticky left-0 z-10 bg-muted px-3 py-2.5 text-left font-semibold">Product</th>
            <th className="px-3 py-2.5 text-left font-semibold">Sourcing</th>
            <th className="px-3 py-2.5 text-right font-semibold">Material</th>
            <th className="px-3 py-2.5 text-right font-semibold">Packing</th>
            <th className="px-3 py-2.5 text-right font-semibold">Conversion</th>
            <th className="px-3 py-2.5 text-right font-semibold">3rd-party</th>
            <th className="px-3 py-2.5 text-right font-semibold text-foreground">Works/u</th>
            <th className="px-3 py-2.5 text-right font-semibold">Overhead/u</th>
            <th className="px-3 py-2.5 text-right font-semibold text-foreground">Total/u</th>
            <th className="px-3 py-2.5 text-right font-semibold">Sell/u</th>
            <th className="px-3 py-2.5 text-right font-semibold">Margin/u</th>
            <th className="px-3 py-2.5 text-right font-semibold">Margin %</th>
          </tr>
        </thead>
        <tbody>
          {sheets.map((s) => (
            <tr key={s.id} className="border-b last:border-0 hover:bg-accent/40">
              <td className="sticky left-0 z-10 bg-card px-3 py-2.5">
                <div className="font-medium">{s.name}</div>
                <div className="text-xs text-muted-foreground">{Math.round(s.units).toLocaleString("en-IN")} units</div>
              </td>
              <td className="px-3 py-2.5">
                <span className={cn("rounded-full px-2 py-0.5 text-xs", ownerClass(s.ownership))}>
                  {OWNERSHIP_META[s.ownership].short}
                </span>
              </td>
              <td className="px-3 py-2.5 text-right tabular">{s.material ? <Money value={s.material} /> : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular">{s.packing ? <Money value={s.packing} /> : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular">{s.conversion ? <Money value={s.conversion} /> : "—"}</td>
              <td className="px-3 py-2.5 text-right tabular">{s.thirdParty ? <Money value={s.thirdParty} /> : "—"}</td>
              <td className="px-3 py-2.5 text-right font-semibold tabular"><Money value={s.works} /></td>
              <td className="px-3 py-2.5 text-right tabular text-muted-foreground"><Money value={s.overhead} /></td>
              <td className="px-3 py-2.5 text-right font-semibold tabular"><Money value={s.totalUnitCost} /></td>
              <td className="px-3 py-2.5 text-right tabular"><Money value={s.sellRate} /></td>
              <td className={cn("px-3 py-2.5 text-right tabular", s.marginPerUnit < 0 ? "text-danger" : "text-success")}>
                <Money value={s.marginPerUnit} />
              </td>
              <td className={cn("px-3 py-2.5 text-right font-medium tabular", s.marginPct < 0 ? "text-danger" : "text-success")}>
                {pct(s.marginPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ownerClass(o: CostSheet["ownership"]) {
  return o === "own"
    ? "bg-success/12 text-success"
    : o === "loan-license"
      ? "bg-warning/15 text-warning"
      : "bg-primary/10 text-primary";
}

function CostMatrix({
  rows,
  heads,
  dimLabel,
  total,
  perUnit = false,
  transposed = false,
}: {
  rows: AllocRow[];
  heads: CostHead[];
  dimLabel: string;
  total: CostAudit;
  perUnit?: boolean;
  transposed?: boolean;
}) {
  const headTotal = (code: string) => rows.reduce((s, r) => s + (r.costByHead[code] ?? 0), 0);
  const grandRevenue = rows.reduce((s, r) => s + r.revenue, 0);
  const grandCost = rows.reduce((s, r) => s + r.totalCost, 0);
  // Units column only when the per-unit cost-sheet view is on and rows carry units.
  const showUnits = perUnit && rows.some((r) => r.units != null);
  const totalUnits = rows.reduce((s, r) => s + (r.units ?? 0), 0);

  if (transposed)
    return showUnits ? (
      <ProductCostSheet
        rows={rows}
        heads={heads}
        dimLabel={dimLabel}
        headTotal={headTotal}
        grandRevenue={grandRevenue}
        grandCost={grandCost}
        totalUnits={totalUnits}
      />
    ) : (
      <TransposedMatrix
        rows={rows}
        heads={heads}
        dimLabel={dimLabel}
        perUnit={perUnit}
        headTotal={headTotal}
        grandRevenue={grandRevenue}
        grandCost={grandCost}
      />
    );

  return (
    <div className="overflow-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full min-w-[820px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 text-left font-semibold">{dimLabel}</th>
            {showUnits && <th className="px-3 py-2.5 text-right font-semibold">Units</th>}
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
              {showUnits && (
                <td className="px-3 py-2.5 text-right font-medium tabular text-muted-foreground">{qty(r.units ?? 0)}</td>
              )}
              {heads.map((h) => (
                <td key={h.code} className="px-3 py-2.5 text-right tabular">
                  <Money value={r.costByHead[h.code] ?? 0} compact />
                  {perUnit && <PerU value={r.costByHead[h.code] ?? 0} units={r.units} />}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-semibold tabular">
                <Money value={r.totalCost} compact />
                {perUnit && <PerU value={r.totalCost} units={r.units} />}
              </td>
              <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{pct(r.share)}</td>
              <td className="px-3 py-2.5 text-right tabular">
                <Money value={r.revenue} compact />
                {perUnit && <PerU value={r.revenue} units={r.units} />}
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
            {showUnits && (
              <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{qty(totalUnits)}</td>
            )}
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

// Transposed view — dimension entries become columns, cost heads & metrics
// become rows. Same numbers as CostMatrix, pivoted for side-by-side comparison.
function TransposedMatrix({
  rows,
  heads,
  dimLabel,
  perUnit,
  headTotal,
  grandRevenue,
  grandCost,
}: {
  rows: AllocRow[];
  heads: CostHead[];
  dimLabel: string;
  perUnit: boolean;
  headTotal: (code: string) => number;
  grandRevenue: number;
  grandCost: number;
}) {
  const grandMargin = grandRevenue ? pct((grandRevenue - grandCost) / grandRevenue) : "—";
  const showUnits = perUnit && rows.some((r) => r.units != null);
  const totalUnits = rows.reduce((s, r) => s + (r.units ?? 0), 0);
  return (
    <div className="overflow-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="sticky left-0 z-10 bg-muted/40 px-3 py-2.5 text-left font-semibold">{dimLabel}</th>
            {rows.map((r) => (
              <th
                key={r.id}
                className="whitespace-nowrap px-3 py-2.5 text-right font-semibold"
                title={r.sub}
              >
                {r.name}
              </th>
            ))}
            <th className="px-3 py-2.5 text-right font-semibold text-foreground">Total</th>
          </tr>
        </thead>
        <tbody>
          {showUnits && (
            <tr className="border-b hover:bg-accent/40">
              <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-medium">Units</td>
              {rows.map((r) => (
                <td key={r.id} className="px-3 py-2.5 text-right tabular text-muted-foreground">
                  {qty(r.units ?? 0)}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right tabular text-muted-foreground">{qty(totalUnits)}</td>
            </tr>
          )}
          {heads.map((h) => (
            <tr key={h.code} className="border-b hover:bg-accent/40">
              <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-medium">{h.name}</td>
              {rows.map((r) => (
                <td key={r.id} className="px-3 py-2.5 text-right tabular">
                  <Money value={r.costByHead[h.code] ?? 0} compact />
                  {perUnit && <PerU value={r.costByHead[h.code] ?? 0} units={r.units} />}
                </td>
              ))}
              <td className="px-3 py-2.5 text-right font-semibold tabular">
                <Money value={headTotal(h.code)} compact />
              </td>
            </tr>
          ))}
          <tr className="border-t-2 bg-muted/30 font-semibold">
            <td className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5">Total Cost</td>
            {rows.map((r) => (
              <td key={r.id} className="px-3 py-2.5 text-right tabular">
                <Money value={r.totalCost} compact />
                {perUnit && <PerU value={r.totalCost} units={r.units} />}
              </td>
            ))}
            <td className="px-3 py-2.5 text-right tabular">
              <Money value={grandCost} compact />
            </td>
          </tr>
          <tr className="border-b hover:bg-accent/40">
            <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-medium">Share</td>
            {rows.map((r) => (
              <td key={r.id} className="px-3 py-2.5 text-right tabular text-muted-foreground">
                {pct(r.share)}
              </td>
            ))}
            <td className="px-3 py-2.5 text-right tabular text-muted-foreground">100%</td>
          </tr>
          <tr className="border-b hover:bg-accent/40">
            <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-medium">Revenue</td>
            {rows.map((r) => (
              <td key={r.id} className="px-3 py-2.5 text-right tabular">
                <Money value={r.revenue} compact />
                {perUnit && <PerU value={r.revenue} units={r.units} />}
              </td>
            ))}
            <td className="px-3 py-2.5 text-right tabular">
              <Money value={grandRevenue} compact />
            </td>
          </tr>
          <tr className="hover:bg-accent/40">
            <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-medium">Margin %</td>
            {rows.map((r) => (
              <td
                key={r.id}
                className={cn(
                  "px-3 py-2.5 text-right font-medium tabular",
                  r.marginPct < 0 ? "text-danger" : "text-success",
                )}
              >
                {r.revenue ? pct(r.marginPct) : "—"}
              </td>
            ))}
            <td className="px-3 py-2.5 text-right tabular">{grandMargin}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// Multi-product cost sheet — each product is a 3-column group (Units · Amount ·
// ₹/unit), cost heads down the rows. The classic management cost-sheet layout.
function ProductCostSheet({
  rows,
  heads,
  dimLabel,
  headTotal,
  grandRevenue,
  grandCost,
  totalUnits,
}: {
  rows: AllocRow[];
  heads: CostHead[];
  dimLabel: string;
  headTotal: (code: string) => number;
  grandRevenue: number;
  grandCost: number;
  totalUnits: number;
}) {
  // One product (or the Total) column-group of three cells: units, amount, ₹/u.
  const group = (units: number, amount: number, opts?: { strong?: boolean; tone?: "danger" | "success" }) => (
    <>
      <td className="border-l border-border/60 px-3 py-2.5 text-right tabular text-muted-foreground">
        {qty(units)}
      </td>
      <td className={cn("px-3 py-2.5 text-right tabular", opts?.strong && "font-semibold", opts?.tone && `text-${opts.tone}`)}>
        <Money value={amount} compact />
      </td>
      <td className={cn("px-3 py-2.5 text-right tabular text-muted-foreground", opts?.tone && `text-${opts.tone}`)}>
        {units ? <Money value={amount / units} compact /> : "—"}
      </td>
    </>
  );

  return (
    <div className="overflow-auto rounded-lg border bg-card shadow-sm">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th rowSpan={2} className="sticky left-0 z-10 bg-muted/40 px-3 py-2 text-left font-semibold align-bottom">
              {dimLabel}
            </th>
            {rows.map((r) => (
              <th key={r.id} colSpan={3} className="border-l border-border/60 px-3 py-2 text-center font-semibold" title={r.sub}>
                {r.name}
              </th>
            ))}
            <th colSpan={3} className="border-l border-border/60 px-3 py-2 text-center font-semibold text-foreground">
              Total
            </th>
          </tr>
          <tr className="border-b bg-muted/40 text-[10px] uppercase tracking-wide text-muted-foreground">
            {[...rows, { id: "__total" }].map((r) => (
              <React.Fragment key={r.id}>
                <th className="border-l border-border/60 px-3 py-1.5 text-right font-medium">Units</th>
                <th className="px-3 py-1.5 text-right font-medium">Amount</th>
                <th className="px-3 py-1.5 text-right font-medium">₹/u</th>
              </React.Fragment>
            ))}
          </tr>
        </thead>
        <tbody>
          {heads.map((h) => (
            <tr key={h.code} className="border-b hover:bg-accent/40">
              <td className="sticky left-0 z-10 bg-card px-3 py-2.5">
                <span className="font-medium">{h.name}</span>
                {h.isDirect && <span className="ml-1.5 text-[10px] uppercase text-muted-foreground">· direct</span>}
              </td>
              {rows.map((r) => (
                <React.Fragment key={r.id}>{group(r.units ?? 0, r.costByHead[h.code] ?? 0)}</React.Fragment>
              ))}
              {group(totalUnits, headTotal(h.code))}
            </tr>
          ))}
          <tr className="border-t-2 bg-muted/30 font-semibold">
            <td className="sticky left-0 z-10 bg-muted/30 px-3 py-2.5">Total Cost</td>
            {rows.map((r) => (
              <React.Fragment key={r.id}>{group(r.units ?? 0, r.totalCost, { strong: true })}</React.Fragment>
            ))}
            {group(totalUnits, grandCost, { strong: true })}
          </tr>
          <tr className="border-b hover:bg-accent/40">
            <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-medium">Revenue</td>
            {rows.map((r) => (
              <React.Fragment key={r.id}>{group(r.units ?? 0, r.revenue)}</React.Fragment>
            ))}
            {group(totalUnits, grandRevenue)}
          </tr>
          <tr className="hover:bg-accent/40">
            <td className="sticky left-0 z-10 bg-card px-3 py-2.5 font-medium">Margin</td>
            {rows.map((r) => (
              <React.Fragment key={r.id}>
                {group(r.units ?? 0, r.margin, { tone: r.margin < 0 ? "danger" : "success" })}
              </React.Fragment>
            ))}
            {group(totalUnits, grandRevenue - grandCost, { tone: grandRevenue - grandCost < 0 ? "danger" : "success" })}
          </tr>
        </tbody>
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
  withUnits = false,
  drivers?: Record<string, string>,
): ReportSheet {
  const firstHead = heads[0]?.code ?? "name";
  const lastHead = heads[heads.length - 1]?.code ?? "name";
  // On the driver-absorbed (product) sheet, each head cell is a live allocation
  // formula — pool × driver share — so the reader sees exactly how it was spread.
  const allocate = !!drivers && withUnits;

  const columns: ReportColumn[] = [
    { header: dimLabel, key: "name", type: "text", width: 30, totalText: "Total" },
    ...heads.map<ReportColumn>((h) => {
      const col: ReportColumn = { header: h.name, key: h.code, type: "money", width: 14, total: "sum" };
      if (allocate) {
        const driver = drivers![h.code];
        const pool = Math.round(h.total);
        col.formula = (c) => {
          if (driver === "revenue") return `${c.colOf("revenue")}${c.row}/${c.colOf("revenue")}$${c.lastRow + 1}*${pool}`;
          if (driver === "volume") return `${c.colOf("units")}${c.row}/${c.colOf("units")}$${c.lastRow + 1}*${pool}`;
          if (driver === "equal") return `${pool}/${c.lastRow - c.firstRow + 1}`;
          const w = Number((c.data as Record<string, unknown>)[`${h.code}_w`]) || 0; // bom / fallback weight
          return `${pool}*${w}`;
        };
      }
      return col;
    }),
    {
      header: "Total Cost",
      key: "totalCost",
      type: "money",
      width: 15,
      formula: (c) => `SUM(${c.colOf(firstHead)}${c.row}:${c.colOf(lastHead)}${c.row})`,
      total: "sum",
    },
    ...(withUnits
      ? [
          { header: "Units", key: "units", type: "number", width: 12, total: "sum" } as ReportColumn,
          {
            header: "Cost/Unit",
            key: "unitCost",
            type: "money",
            width: 12,
            formula: (c) =>
              `IF(${c.colOf("units")}${c.row}=0,0,${c.colOf("totalCost")}${c.row}/${c.colOf("units")}${c.row})`,
          } as ReportColumn,
        ]
      : []),
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
    for (const h of heads) {
      o[h.code] = Math.round(r.costByHead[h.code] ?? 0);
      if (allocate) o[`${h.code}_w`] = h.total ? (r.costByHead[h.code] ?? 0) / h.total : 0;
    }
    o.totalCost = Math.round(r.totalCost);
    if (withUnits) {
      o.units = Math.round(r.units ?? 0);
      o.unitCost = r.units ? r.totalCost / r.units : 0;
    }
    o.share = r.share;
    o.revenue = Math.round(r.revenue);
    o.margin = Math.round(r.margin);
    o.marginPct = r.marginPct;
    o.costToRevenue = r.costToRevenue;
    return o;
  });

  const notes = allocate
    ? [
        "Each overhead head is absorbed as (driver share) × (cost pool). E.g. Freight per product = product revenue ÷ total revenue × total freight — shown as a live formula, so editing a revenue or a pool recomputes the allocation.",
        "Direct heads spread on bill-of-materials cost; the cell carries pool × the BOM weight.",
      ]
    : undefined;
  return { name, title: `Cost Audit — ${dimLabel}`, subtitle, meta, columns, rows: dataRows, totals: true, notes };
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
      { header: "Product driver", key: "driver", type: "text", width: 18 },
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
      driver: DRIVER_LABEL[audit.drivers[h.code]],
      amount: Math.round(h.total),
      share: audit.totalCost ? h.total / audit.totalCost : 0,
    })),
    totals: true,
    notes: [
      "Each cost head is absorbed onto products on its own driver (see the Product driver column).",
      "Entity & location splits are actual GL postings; product split is driver-based absorption.",
    ],
  };

  const costSheet: ReportSheet = {
    name: "Cost Sheets",
    title: "Product Cost Sheets (per unit)",
    subtitle: sub,
    meta,
    columns: [
      { header: "Product", key: "name", type: "text", width: 28, totalText: "—" },
      { header: "Sourcing", key: "ownership", type: "text", width: 14 },
      { header: "Units", key: "units", type: "number", width: 12, total: "sum" },
      { header: "Material/u", key: "material", type: "money", width: 12 },
      { header: "Packing/u", key: "packing", type: "money", width: 12 },
      { header: "Conversion/u", key: "conversion", type: "money", width: 13 },
      { header: "3rd-party/u", key: "thirdParty", type: "money", width: 12 },
      { header: "Works/u", key: "works", type: "money", width: 12, formula: (c) => `${c.colOf("material")}${c.row}+${c.colOf("packing")}${c.row}+${c.colOf("conversion")}${c.row}+${c.colOf("thirdParty")}${c.row}` },
      { header: "Overhead/u", key: "overhead", type: "money", width: 12 },
      { header: "Total/u", key: "totalUnitCost", type: "money", width: 12, formula: (c) => `${c.colOf("works")}${c.row}+${c.colOf("overhead")}${c.row}` },
      { header: "Sell/u", key: "sellRate", type: "money", width: 12 },
      { header: "Margin/u", key: "marginPerUnit", type: "money", width: 12, formula: (c) => `${c.colOf("sellRate")}${c.row}-${c.colOf("totalUnitCost")}${c.row}` },
      { header: "Margin %", key: "marginPct", type: "percent", width: 10, formula: (c) => `IF(${c.colOf("sellRate")}${c.row}=0,0,${c.colOf("marginPerUnit")}${c.row}/${c.colOf("sellRate")}${c.row})` },
    ],
    rows: audit.costSheets.map((s) => ({
      name: s.name,
      ownership: OWNERSHIP_META[s.ownership].label,
      units: Math.round(s.units),
      material: Math.round(s.material),
      packing: Math.round(s.packing),
      conversion: Math.round(s.conversion),
      thirdParty: Math.round(s.thirdParty),
      works: Math.round(s.works),
      overhead: Math.round(s.overhead),
      totalUnitCost: Math.round(s.totalUnitCost),
      sellRate: Math.round(s.sellRate),
      marginPerUnit: Math.round(s.marginPerUnit),
      marginPct: s.marginPct,
    })),
    totals: true,
    notes: ["Works cost = material + packing + conversion (own/loan-licence) or third-party purchase. Overhead is absorbed per unit."],
  };

  const movementSheet: ReportSheet = {
    name: "Stock Movement",
    title: "Inventory Movement (units)",
    subtitle: sub,
    meta,
    columns: [
      { header: "Product", key: "name", type: "text", width: 28, totalText: "Total" },
      { header: "Opening", key: "opening", type: "number", width: 12, total: "sum" },
      { header: "Production", key: "production", type: "number", width: 12, total: "sum" },
      { header: "Sales", key: "sales", type: "number", width: 12, total: "sum" },
      { header: "Write-off", key: "writeoff", type: "number", width: 12, total: "sum" },
      { header: "Transfer", key: "transfers", type: "number", width: 12, total: "sum" },
      {
        header: "Closing",
        key: "closing",
        type: "number",
        width: 12,
        formula: (c) =>
          `${c.colOf("opening")}${c.row}+${c.colOf("production")}${c.row}-${c.colOf("sales")}${c.row}-${c.colOf("writeoff")}${c.row}+${c.colOf("transfers")}${c.row}`,
        total: "sum",
      },
      { header: "Closing value", key: "closingValue", type: "money", width: 15, total: "sum" },
    ],
    rows: audit.productMovements.map((m) => ({
      name: m.name,
      opening: Math.round(m.opening),
      production: Math.round(m.production),
      sales: Math.round(m.sales),
      writeoff: Math.round(m.writeoff),
      transfers: Math.round(m.transfers),
      closing: Math.round(m.closing),
      closingValue: Math.round(m.closingValue),
    })),
    totals: true,
    notes: ["Closing = Opening + Production − Sales − Write-off + Transfer. Read from the stock-movement ledger for the selected scope and period."],
  };

  return [
    summary,
    dimSheet("By Entity", "Entity", sub, meta, audit.byEntity, audit.heads),
    dimSheet("By Location", "Location", sub, meta, audit.byLocation, audit.heads),
    dimSheet("By Product", "Product", `${sub} Per-head drivers — see Summary.`, meta, audit.byProduct, audit.heads, true, audit.drivers),
    dimSheet("By Sourcing", "Sourcing model", sub, meta, audit.byOwnership, audit.heads),
    movementSheet,
    costSheet,
  ];
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;
