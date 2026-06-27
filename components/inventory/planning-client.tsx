"use client";

import * as React from "react";
import Link from "next/link";
import {
  TrendingUp,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ShoppingCart,
  Factory,
  Wrench,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  PackageX,
  CalendarClock,
  BarChart3,
  GitBranch,
  Clock,
  Zap,
  ClipboardList,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from "recharts";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { FINISHED_ITEMS, itemById, itemName, explodeBom, ITEMS } from "@/lib/inventory/items";
import {
  allMovements,
  buildStockIndex,
  loadAddedMovements,
  stockTotal,
  type StockIndex,
} from "@/lib/inventory/movements";
import {
  runMrp,
  suggestedDemand,
  type PlanLine,
  type DemandEntry,
  type DemandStats,
} from "@/lib/inventory/planning";
import {
  allPRs,
  loadPRs,
  savePRs,
  nextPRRef,
  type PurchaseRequisition,
} from "@/lib/inventory/supply-chain";

// ---------------------------------------------------------------------------
// Constants & helpers
// ---------------------------------------------------------------------------

const HORIZON_OPTIONS = [
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
];

const FG_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#3b82f6",
  "#ec4899", "#8b5cf6", "#14b8a6", "#f97316",
];

function fmtQty(n: number, uom?: string) {
  const s = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
  return uom ? `${s} ${uom}` : s;
}

function fmtDate(date: Date) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function addDays(base: Date, n: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

function coverageBadge(pct: number) {
  if (pct >= 100) return <Badge variant="success" className="text-[10px]">Fully covered</Badge>;
  if (pct >= 50) return <Badge variant="warning" className="text-[10px]">{Math.round(pct)}% covered</Badge>;
  return <Badge variant="danger" className="text-[10px]">{Math.round(pct)}% covered</Badge>;
}

function CoverageBar({ pct }: { pct: number }) {
  const color = pct >= 100 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-danger";
  return (
    <div className="h-1.5 w-full rounded-full bg-muted">
      <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, pct)}%` }} />
    </div>
  );
}

function ActionIcon({ action }: { action: PlanLine["action"] }) {
  if (action === "produce") return <Factory className="size-3.5 text-primary" />;
  if (action === "purchase") return <ShoppingCart className="size-3.5 text-warning" />;
  if (action === "job-work") return <Wrench className="size-3.5 text-muted-foreground" />;
  return <CheckCircle2 className="size-3.5 text-success" />;
}

function actionLabel(action: PlanLine["action"]) {
  if (action === "produce") return "Produce";
  if (action === "purchase") return "Purchase";
  if (action === "job-work") return "Job-work";
  return "Covered";
}

// ---------------------------------------------------------------------------
// Attribution helper: explode FG demand down to leaf RM/PM by contributing FG
// ---------------------------------------------------------------------------
interface AttributionEntry { fgId: string; fgName: string; qty: number }

function computeAttribution(
  demand: DemandEntry[],
  procurementIds: Set<string>,
): Map<string, AttributionEntry[]> {
  const map = new Map<string, AttributionEntry[]>();
  for (const d of demand) {
    if (d.qty <= 0) continue;
    const leaves = explodeBom(d.itemId, d.qty);
    for (const leaf of leaves) {
      if (!procurementIds.has(leaf.itemId)) continue;
      const list = map.get(leaf.itemId) ?? [];
      const existing = list.find((e) => e.fgId === d.itemId);
      if (existing) existing.qty += leaf.qty;
      else list.push({ fgId: d.itemId, fgName: itemName(d.itemId), qty: leaf.qty });
      map.set(leaf.itemId, list);
    }
  }
  return map;
}

// ============================================================
// REORDER FLAG CARDS (always visible once stock is loaded)
// ============================================================

interface ReorderFlagCardsProps {
  idx: StockIndex | null;
  onSelect: (itemId: string) => void;
  selectedId: string | null;
}

function ReorderFlagCards({ idx, onSelect, selectedId }: ReorderFlagCardsProps) {
  if (!idx) return null;

  const flags = ITEMS
    .map((it) => ({ item: it, onHand: stockTotal(idx, it.id) }))
    .filter(({ item, onHand }) => onHand < item.reorderLevel)
    .sort((a, b) => (a.onHand / a.item.reorderLevel) - (b.onHand / b.item.reorderLevel));

  if (flags.length === 0) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 flex items-center gap-2">
        <PackageX className="size-4 text-danger" />
        <p className="text-sm font-semibold">Reorder Flags</p>
        <Badge variant="danger" className="text-[10px]">{flags.length} below ROL</Badge>
        <p className="text-xs text-muted-foreground">Click a card to jump to the item in the procurement plan.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {flags.map(({ item, onHand }) => {
          const coverPct = Math.min(100, (onHand / item.reorderLevel) * 100);
          const urgency =
            coverPct === 0 ? "danger"
            : coverPct < 40 ? "danger"
            : "warning";
          const isSelected = selectedId === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                onSelect(item.id);
                setTimeout(() => {
                  document.getElementById(`plan-row-${item.id}`)?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }, 50);
              }}
              className={cn(
                "rounded-lg border px-3 py-2 text-left transition-all hover:shadow-md",
                isSelected
                  ? "border-primary bg-primary/10 ring-1 ring-primary"
                  : urgency === "danger"
                    ? "border-danger/40 bg-danger/5 hover:border-danger/60"
                    : "border-warning/40 bg-warning/5 hover:border-warning/60",
              )}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold">{item.name}</span>
                <span className="text-[10px] font-mono text-muted-foreground">{item.code}</span>
              </div>
              <div className="flex items-center gap-3 text-xs">
                <span className={cn("font-medium", urgency === "danger" ? "text-danger" : "text-warning")}>
                  {fmtQty(onHand, item.uom)} on hand
                </span>
                <span className="text-muted-foreground">ROL: {fmtQty(item.reorderLevel)}</span>
                {item.leadTimeDays && (
                  <span className="flex items-center gap-0.5 text-muted-foreground">
                    <Clock className="size-2.5" />{item.leadTimeDays}d lead
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-1 w-full rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", urgency === "danger" ? "bg-danger" : "bg-warning")}
                  style={{ width: `${coverPct}%` }}
                />
              </div>
              <p className="mt-0.5 text-[10px] text-muted-foreground">{Math.round(coverPct)}% of reorder level</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// PLAN TABLE (existing, extended with row IDs + highlight)
// ============================================================

interface PlanTableProps {
  title: string;
  lines: PlanLine[];
  emptyMsg: string;
  highlightId?: string | null;
}

function PlanTable({ title, lines, emptyMsg, highlightId }: PlanTableProps) {
  const [open, setOpen] = React.useState(true);
  const actionCounts = lines.reduce<Record<string, number>>(
    (acc, l) => { acc[l.action] = (acc[l.action] ?? 0) + 1; return acc; },
    {},
  );
  const hasShortfall = lines.some((l) => l.net > 0);

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div className="flex items-center gap-2">
          <p className="font-semibold">{title}</p>
          {hasShortfall
            ? <AlertTriangle className="size-4 text-warning" />
            : lines.length > 0 && <CheckCircle2 className="size-4 text-success" />}
        </div>
        <div className="flex items-center gap-3">
          {Object.entries(actionCounts).map(([a, n]) => (
            a !== "none" && (
              <span key={a} className="flex items-center gap-1 text-xs text-muted-foreground">
                <ActionIcon action={a as PlanLine["action"]} />
                {n} {actionLabel(a as PlanLine["action"])}
              </span>
            )
          ))}
          {open ? <ChevronUp className="size-4 text-muted-foreground" /> : <ChevronDown className="size-4 text-muted-foreground" />}
        </div>
      </button>

      {open && (
        <div className="overflow-x-auto scrollbar-thin border-t">
          {lines.length === 0 ? (
            <p className="px-5 py-8 text-center text-sm text-muted-foreground">{emptyMsg}</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground text-left">
                  <th className="px-5 py-3 font-medium">Item</th>
                  <th className="px-5 py-3 text-right font-medium">Required</th>
                  <th className="px-5 py-3 text-right font-medium">On hand</th>
                  <th className="px-5 py-3 text-right font-medium">Net qty</th>
                  <th className="px-5 py-3 text-right font-medium">Est. cost</th>
                  <th className="px-5 py-3 font-medium">Coverage</th>
                  <th className="px-5 py-3 font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((line) => {
                  const item = itemById(line.itemId);
                  const rate = item?.rate ?? 0;
                  const estCost = line.net * rate;
                  const isHighlighted = highlightId === line.itemId;
                  return (
                    <tr
                      key={line.itemId}
                      id={`plan-row-${line.itemId}`}
                      className={cn(
                        "border-b align-top last:border-0 transition-colors",
                        isHighlighted && "bg-primary/8 ring-1 ring-inset ring-primary/30",
                      )}
                    >
                      <td className="px-5 py-3">
                        <p className="font-medium">{itemName(line.itemId)}</p>
                        <p className="text-[11px] font-mono text-muted-foreground">{item?.code}</p>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        {fmtQty(line.gross, item?.uom)}
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums">
                        <span className={cn(line.onHand < line.gross && "text-warning font-medium")}>
                          {fmtQty(line.onHand, item?.uom)}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-right tabular-nums font-semibold">
                        {line.net > 0
                          ? <span className="text-danger">{fmtQty(line.net, item?.uom)}</span>
                          : <span className="text-success">—</span>}
                      </td>
                      <td className="px-5 py-3 text-right">
                        {line.net > 0 ? <Money value={estCost} /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3 w-36">
                        <CoverageBar pct={line.pct} />
                        <div className="mt-1">{coverageBadge(line.pct)}</div>
                      </td>
                      <td className="px-5 py-3">
                        <span className="flex items-center gap-1.5 text-xs font-medium">
                          <ActionIcon action={line.action} />
                          {actionLabel(line.action)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </Card>
  );
}

// ============================================================
// CHART 1 — Material Coverage (normalized stacked bar)
// ============================================================

interface CoverageRow {
  name: string;
  code: string;
  uom: string;
  coveragePct: number;
  shortagePct: number;
  onHand: number;
  net: number;
  gross: number;
  netLabel: string;
}

function MaterialCoverageChart({ lines }: { lines: PlanLine[] }) {
  const data: CoverageRow[] = lines
    .map((l) => {
      const item = itemById(l.itemId);
      const coveragePct = l.gross > 0 ? Math.min(100, (l.onHand / l.gross) * 100) : 100;
      const shortagePct = Math.max(0, 100 - coveragePct);
      return {
        name: item?.name ?? l.itemId,
        code: item?.code ?? l.itemId,
        uom: item?.uom ?? "",
        coveragePct: parseFloat(coveragePct.toFixed(1)),
        shortagePct: parseFloat(shortagePct.toFixed(1)),
        onHand: l.onHand,
        net: l.net,
        gross: l.gross,
        netLabel: l.net > 0 ? `Order: ${fmtQty(l.net, item?.uom)}` : "",
      };
    })
    .sort((a, b) => a.coveragePct - b.coveragePct); // most critical first

  const barH = 44;
  const chartH = Math.max(120, data.length * barH + 40);

  interface TooltipPayload {
    payload: CoverageRow;
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="rounded-lg border bg-popover p-3 text-xs shadow-md">
        <p className="font-semibold mb-1">{d.name}</p>
        <p className="text-muted-foreground">Required: {fmtQty(d.gross, d.uom)}</p>
        <p className="text-success">On hand: {fmtQty(d.onHand, d.uom)}</p>
        {d.net > 0 && <p className="text-danger font-medium">Order qty: {fmtQty(d.net, d.uom)}</p>}
        <p className="text-muted-foreground mt-1">Coverage: {d.coveragePct.toFixed(1)}%</p>
      </div>
    );
  };

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <BarChart3 className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Material Coverage</p>
        <p className="text-xs text-muted-foreground">On-hand vs order requirement, sorted by criticality</p>
        <div className="ml-auto flex items-center gap-4 text-xs">
          <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm bg-[#22c55e]" />On hand</span>
          <span className="flex items-center gap-1.5"><span className="inline-block size-2.5 rounded-sm bg-[#ef4444]" />Shortfall</span>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={chartH}>
        <BarChart
          data={data}
          layout="vertical"
          margin={{ top: 4, right: 200, bottom: 4, left: 8 }}
          barSize={18}
        >
          <XAxis
            type="number"
            domain={[0, 100]}
            tickFormatter={(v) => `${v}%`}
            tick={{ fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="name"
            tick={{ fontSize: 11 }}
            width={160}
            axisLine={false}
            tickLine={false}
          />
          <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: "transparent" }} />
          <Bar dataKey="coveragePct" stackId="a" fill="#22c55e" radius={[3, 0, 0, 3]} />
          <Bar dataKey="shortagePct" stackId="a" fill="#ef4444" radius={[0, 3, 3, 0]}>
            <LabelList
              dataKey="netLabel"
              position="right"
              style={{ fontSize: 11, fill: "var(--muted-foreground, #6b7280)" }}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ============================================================
// CHART 2 — Procurement Lead Time Gantt
// ============================================================

interface GanttRowData {
  itemId: string;
  name: string;
  code: string;
  uom: string;
  leadTimeDays: number;
  orderByDay: number;   // days from today to place order (horizon - leadTime)
  net: number;
  rate: number;
}

function urgencyOf(orderByDay: number): "overdue" | "urgent" | "soon" | "ok" {
  if (orderByDay <= 0) return "overdue";
  if (orderByDay <= 3) return "urgent";
  if (orderByDay <= 7) return "soon";
  return "ok";
}

const URGENCY_COLOR: Record<string, string> = {
  overdue: "bg-danger",
  urgent: "bg-danger/70",
  soon: "bg-warning",
  ok: "bg-success",
};
const URGENCY_LABEL: Record<string, string> = {
  overdue: "Overdue — order now",
  urgent: "Order within 3 days",
  soon: "Order this week",
  ok: "On track",
};
const URGENCY_BADGE: Record<string, "danger" | "warning" | "success"> = {
  overdue: "danger",
  urgent: "danger",
  soon: "warning",
  ok: "success",
};

function ProcurementGantt({ lines, horizon }: { lines: PlanLine[]; horizon: number }) {
  const today = new Date();
  const horizonEnd = addDays(today, horizon);
  const purchaseLines = lines.filter((l) => l.action === "purchase" && l.net > 0);

  if (purchaseLines.length === 0) {
    return (
      <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
        <CheckCircle2 className="size-4 mr-2 text-success" /> No purchase orders needed — all materials covered.
      </div>
    );
  }

  const rows: GanttRowData[] = purchaseLines
    .map((l) => {
      const item = itemById(l.itemId);
      const leadTimeDays = item?.leadTimeDays ?? 0;
      const orderByDay = horizon - leadTimeDays;
      return {
        itemId: l.itemId,
        name: item?.name ?? l.itemId,
        code: item?.code ?? "",
        uom: item?.uom ?? "",
        leadTimeDays,
        orderByDay,
        net: l.net,
        rate: item?.rate ?? 0,
      };
    })
    .sort((a, b) => a.orderByDay - b.orderByDay); // most urgent first

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <CalendarClock className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Procurement Timeline</p>
        <p className="text-xs text-muted-foreground">
          Lead-time window per material — shaded bar = supplier delivery window
        </p>
      </div>

      {/* Header row */}
      <div className="mb-2 grid grid-cols-[200px_1fr_auto] gap-4 text-[10px] uppercase tracking-wide text-muted-foreground px-1">
        <span>Material</span>
        <div className="relative">
          <span className="absolute left-0">Today — {fmtDate(today)}</span>
          <span className="absolute right-0">Horizon end — {fmtDate(horizonEnd)}</span>
        </div>
        <span className="w-40 text-right">Order qty / value</span>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const urgency = urgencyOf(row.orderByDay);
          const orderByDate = addDays(today, Math.max(0, row.orderByDay));
          // Position of lead-time bar: left% = orderByDay/horizon, width% = leadTimeDays/horizon
          const leftPct = Math.max(0, (row.orderByDay / horizon) * 100);
          const widthPct = Math.min(100 - leftPct, (row.leadTimeDays / horizon) * 100);

          return (
            <div
              key={row.itemId}
              className="grid grid-cols-[200px_1fr_auto] items-center gap-4"
            >
              {/* Label */}
              <div>
                <p className="text-xs font-medium leading-tight">{row.name}</p>
                <p className="text-[10px] font-mono text-muted-foreground">{row.code}</p>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <Badge variant={URGENCY_BADGE[urgency]} className="text-[9px] px-1 py-0">
                    {URGENCY_LABEL[urgency]}
                  </Badge>
                </div>
              </div>

              {/* Timeline bar */}
              <div className="relative h-8 rounded-md bg-muted overflow-hidden">
                {/* Today marker */}
                <div className="absolute left-0 top-0 h-full w-0.5 bg-foreground/30 z-10" />
                {/* Horizon end marker */}
                <div className="absolute right-0 top-0 h-full w-0.5 bg-foreground/30 z-10" />
                {/* Lead time window bar */}
                <div
                  className={cn(
                    "absolute top-1 bottom-1 rounded-sm flex items-center justify-center",
                    URGENCY_COLOR[urgency],
                  )}
                  style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
                >
                  {widthPct > 12 && (
                    <span className="text-[9px] text-white font-medium whitespace-nowrap px-1">
                      {row.leadTimeDays}d
                    </span>
                  )}
                </div>
                {/* Order-by marker line */}
                {row.orderByDay > 0 && row.orderByDay < horizon && (
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-foreground/50 z-10"
                    style={{ left: `${leftPct}%` }}
                    title={`Order by ${fmtDate(orderByDate)}`}
                  />
                )}
                {/* Date labels */}
                {row.orderByDay > 0 && (
                  <span
                    className="absolute text-[9px] text-muted-foreground"
                    style={{ left: `${Math.min(leftPct, 80)}%`, top: "50%", transform: "translateY(-50%) translateX(4px)" }}
                  >
                    Order by {fmtDate(orderByDate)}
                  </span>
                )}
              </div>

              {/* Qty / value */}
              <div className="w-40 text-right">
                <p className="text-xs font-semibold text-danger">{fmtQty(row.net, row.uom)}</p>
                <p className="text-[10px] text-muted-foreground">
                  <Money value={row.net * row.rate} compact />
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 text-[10px] text-muted-foreground border-t pt-3">
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-success" />On track (&gt; 7d)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-warning" />Order this week (4–7d)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-danger/70" />Urgent (1–3d)</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-2.5 w-4 rounded-sm bg-danger" />Overdue</span>
        <span className="ml-2 text-muted-foreground">Shaded bar = supplier lead time window; vertical line = order-by date</span>
      </div>
    </div>
  );
}

// ============================================================
// CHART 3 — FG → Material Attribution
// ============================================================

function AttributionBreakdown({ lines, demand }: { lines: PlanLine[]; demand: DemandEntry[] }) {
  const procIds = new Set(lines.map((l) => l.itemId));
  const attribution = computeAttribution(demand, procIds);

  const fgIds = Array.from(new Set(demand.filter((d) => d.qty > 0).map((d) => d.itemId)));
  const colorMap: Record<string, string> = {};
  fgIds.forEach((id, i) => { colorMap[id] = FG_COLORS[i % FG_COLORS.length]; });

  const procLines = lines.filter((l) => l.action === "purchase" && l.net > 0);
  if (procLines.length === 0) return null;

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <GitBranch className="size-4 text-muted-foreground" />
        <p className="text-sm font-semibold">Demand Attribution</p>
        <p className="text-xs text-muted-foreground">Which finished goods drive each material requirement</p>
      </div>

      {/* FG legend */}
      <div className="mb-4 flex flex-wrap gap-3">
        {fgIds.map((id) => (
          <span key={id} className="flex items-center gap-1.5 text-xs">
            <span className="inline-block size-2.5 rounded-sm" style={{ background: colorMap[id] }} />
            {itemName(id)}
          </span>
        ))}
      </div>

      <div className="space-y-5">
        {procLines.map((line) => {
          const item = itemById(line.itemId);
          const entries = attribution.get(line.itemId) ?? [];
          const totalQty = entries.reduce((s, e) => s + e.qty, 0);

          return (
            <div key={line.itemId}>
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="text-xs font-medium">{item?.name ?? line.itemId}</span>
                <span className="text-[11px] text-muted-foreground tabular-nums">
                  {fmtQty(line.net, item?.uom)} to order
                </span>
              </div>
              {/* Stacked proportional bar */}
              <div className="flex h-5 w-full overflow-hidden rounded-md">
                {entries.map((e, i) => {
                  const pct = totalQty > 0 ? (e.qty / totalQty) * 100 : 0;
                  return (
                    <div
                      key={e.fgId}
                      className="flex items-center justify-center overflow-hidden"
                      style={{ width: `${pct}%`, background: colorMap[e.fgId] ?? "#94a3b8" }}
                      title={`${e.fgName}: ${fmtQty(e.qty, item?.uom)}`}
                    >
                      {pct > 10 && (
                        <span className="text-[9px] text-white font-medium truncate px-1">
                          {Math.round(pct)}%
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
              {/* Attribution rows */}
              <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5">
                {entries.map((e) => (
                  <div key={e.fgId} className="flex items-center gap-1.5 text-[10px]">
                    <span className="inline-block size-2 rounded-sm shrink-0" style={{ background: colorMap[e.fgId] ?? "#94a3b8" }} />
                    <span className="text-muted-foreground truncate">{e.fgName}</span>
                    <span className="tabular-nums ml-auto font-medium">{fmtQty(e.qty, item?.uom)}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================================
// PROCUREMENT VISUALS WRAPPER (tabs: coverage / gantt / attribution)
// ============================================================

type VisualTab = "coverage" | "gantt" | "attribution";

function ProcurementVisuals({
  plan,
  demand,
  horizon,
}: {
  plan: ReturnType<typeof runMrp>;
  demand: DemandEntry[];
  horizon: number;
}) {
  const [tab, setTab] = React.useState<VisualTab>("gantt");
  const all = [...plan.procurement, ...plan.semiFinished];

  const tabs: { key: VisualTab; label: string; icon: React.ReactNode }[] = [
    { key: "gantt", label: "Procurement Timeline", icon: <CalendarClock className="size-3.5" /> },
    { key: "coverage", label: "Material Coverage", icon: <BarChart3 className="size-3.5" /> },
    { key: "attribution", label: "Demand Attribution", icon: <GitBranch className="size-3.5" /> },
  ];

  return (
    <Card className="overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors border-b-2 -mb-px",
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "coverage" && <MaterialCoverageChart lines={all} />}
        {tab === "gantt" && <ProcurementGantt lines={plan.procurement} horizon={horizon} />}
        {tab === "attribution" && (
          <AttributionBreakdown lines={plan.procurement} demand={demand} />
        )}
      </div>
    </Card>
  );
}

// ============================================================
// SUMMARY CARD
// ============================================================

function SummaryCard({
  label,
  value,
  icon,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <Card className={cn("flex items-center gap-3 p-4", highlight && "border-danger/40")}>
      {icon}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className={cn("text-2xl font-bold tabular", highlight && "text-danger")}>{value}</p>
      </div>
    </Card>
  );
}

// ============================================================
// MAIN PAGE COMPONENT
// ============================================================

export function PlanningClient() {
  const [horizon, setHorizon] = React.useState(30);
  const [demandQtys, setDemandQtys] = React.useState<Record<string, string>>({});
  const [plan, setPlan] = React.useState<ReturnType<typeof runMrp> | null>(null);
  const [stats, setStats] = React.useState<DemandStats>({ suggested: {}, avgDaily: {} });
  const [lastDemand, setLastDemand] = React.useState<DemandEntry[]>([]);
  const [stockIdx, setStockIdx] = React.useState<StockIndex | null>(null);
  const [highlightedItem, setHighlightedItem] = React.useState<string | null>(null);
  // "all" = no filter; "low" = below ROL; string = single item drill-down
  const [planFilter, setPlanFilter] = React.useState<"all" | "low" | string>("all");
  const [prDraftBanner, setPrDraftBanner] = React.useState<string | null>(null);

  React.useEffect(() => {
    const added = loadAddedMovements();
    const mvs = allMovements(added);
    const sg = suggestedDemand(mvs, horizon);
    const idx = buildStockIndex(mvs);
    setStats(sg);
    setStockIdx(idx);
    setDemandQtys(
      Object.fromEntries(Object.entries(sg.suggested).map(([id, qty]) => [id, String(qty)])),
    );
    setPlan(null);
    setLastDemand([]);
    setPlanFilter("all");
  }, [horizon]);

  function runPlan() {
    const added = loadAddedMovements();
    const idx = buildStockIndex(allMovements(added));
    const demand = FINISHED_ITEMS.map((it) => ({
      itemId: it.id,
      qty: Number(demandQtys[it.id] ?? 0),
    })).filter((d) => d.qty > 0);
    setLastDemand(demand);
    setPlan(runMrp(demand, idx, horizon, stats.avgDaily));
    setHighlightedItem(null);
    setPlanFilter("all");
  }

  function createPRsFromPlan() {
    if (!plan) return;
    const toOrder = plan.procurement.filter((l) => l.net > 0);
    if (toOrder.length === 0) return;
    const existing = allPRs(loadPRs());
    const added = loadPRs();
    const ref = nextPRRef(added);
    const newPR: PurchaseRequisition = {
      id: `pr-mrp-${Date.now()}`,
      ref,
      date: "2026-06-26",
      requestedBy: "emp-024",
      lines: toOrder.map((l) => ({
        itemId: l.itemId,
        qty: Math.ceil(l.net),
        note: `MRP auto-draft — ${horizon}d horizon`,
      })),
      note: `Auto-generated from MRP plan (${horizon}-day horizon). ${toOrder.length} items with shortfall.`,
      status: "draft",
    };
    const next = [...added, newPR];
    savePRs(next);
    setPrDraftBanner(`Draft PR ${ref} created with ${toOrder.length} line${toOrder.length > 1 ? "s" : ""}. Open Requisitions to review.`);
    setTimeout(() => setPrDraftBanner(null), 6000);
  }

  const totalShortfalls = plan
    ? [...plan.finishedGoods, ...plan.semiFinished, ...plan.procurement].filter((l) => l.net > 0).length
    : 0;

  const totalProcurementCost = plan
    ? plan.procurement.reduce((s, l) => s + l.net * (itemById(l.itemId)?.rate ?? 0), 0)
    : 0;

  return (
    <>
      <PageHeader
        title="Demand Planning"
        subtitle="MRP-lite: enter target demand, net against on-hand stock, and get a production + procurement plan with lead-time analysis."
        actions={
          <Link href="/inventory">
            <Button variant="outline">Back to Inventory</Button>
          </Link>
        }
      />

      {/* Reorder flags — always visible once stock is loaded */}
      <ReorderFlagCards
        idx={stockIdx}
        onSelect={(id) => {
          const next = highlightedItem === id && planFilter === id ? null : id;
          setHighlightedItem(next);
          setPlanFilter(next ?? "all");
          if (next) {
            setTimeout(() => {
              document.getElementById(`plan-row-${next}`)?.scrollIntoView({
                behavior: "smooth",
                block: "center",
              });
            }, 80);
          }
        }}
        selectedId={highlightedItem}
      />

      {/* Horizon selector */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground mb-1">Planning horizon</p>
            <div className="flex gap-1">
              {HORIZON_OPTIONS.map((h) => (
                <button
                  key={h.days}
                  onClick={() => setHorizon(h.days)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    horizon === h.days
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {h.label}
                </button>
              ))}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-4 sm:mt-0">
            Demand quantities are pre-filled from your sales history, scaled to the chosen horizon. Adjust any value before running the plan.
          </p>
        </div>
      </Card>

      {/* Demand input */}
      <Card className="mb-4 overflow-hidden">
        <div className="border-b px-5 py-3">
          <p className="font-semibold">Demand — Finished Goods</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Enter the target output quantity for each SKU over the horizon period.
          </p>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground text-left">
                <th className="px-5 py-3 font-medium">SKU</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 text-right font-medium">Suggested (sales avg)</th>
                <th className="px-5 py-3 font-medium w-44">Target qty</th>
              </tr>
            </thead>
            <tbody>
              {FINISHED_ITEMS.map((item) => (
                <tr key={item.id} className="border-b last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-medium">{item.name}</p>
                    <p className="text-[11px] font-mono text-muted-foreground">{item.code}</p>
                  </td>
                  <td className="px-5 py-3 text-xs text-muted-foreground capitalize">{item.ownership ?? "own"}</td>
                  <td className="px-5 py-3 text-right tabular-nums text-muted-foreground">
                    {stats.suggested[item.id] ? fmtQty(stats.suggested[item.id], item.uom) : "—"}
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={0}
                        value={demandQtys[item.id] ?? ""}
                        onChange={(e) => {
                          setDemandQtys((p) => ({ ...p, [item.id]: e.target.value }));
                          setPlan(null);
                        }}
                        placeholder="0"
                        className="h-8 w-28 text-right tabular"
                      />
                      <span className="text-xs text-muted-foreground">{item.uom}</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between border-t px-5 py-3">
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => {
              setDemandQtys(Object.fromEntries(Object.entries(stats.suggested).map(([id, qty]) => [id, String(qty)])));
              setPlan(null);
            }}
          >
            <RefreshCw className="inline size-3 mr-1" /> Reset to suggested
          </button>
          <Button onClick={runPlan}>
            <TrendingUp className="size-4" /> Run plan
          </Button>
        </div>
      </Card>

      {/* Plan output */}
      {plan && (
        <>
          {/* PR draft success banner */}
          {prDraftBanner && (
            <div className="mb-3 flex items-center gap-2 rounded-lg border border-success/40 bg-success/10 px-4 py-3 text-sm">
              <CheckCircle2 className="size-4 text-success shrink-0" />
              <span className="text-success font-medium">{prDraftBanner}</span>
              <Link href="/inventory/requisitions" className="ml-auto text-xs text-primary hover:underline shrink-0">Open PRs →</Link>
            </div>
          )}

          {/* Summary strip */}
          <div className="mb-3 grid gap-3 sm:grid-cols-3">
            <SummaryCard
              label="Shortfalls"
              value={String(totalShortfalls)}
              icon={totalShortfalls > 0 ? <XCircle className="size-5 text-danger" /> : <CheckCircle2 className="size-5 text-success" />}
              highlight={totalShortfalls > 0}
            />
            <SummaryCard
              label="Items to produce"
              value={String([...plan.finishedGoods, ...plan.semiFinished].filter((l) => l.action === "produce").length)}
              icon={<Factory className="size-5 text-primary" />}
            />
            <SummaryCard
              label="Est. procurement cost"
              value={<Money value={totalProcurementCost} compact />}
              icon={<ShoppingCart className="size-5 text-warning" />}
            />
          </div>

          {/* One-click PR creation from plan */}
          {plan.procurement.some((l) => l.net > 0) && (
            <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
              <Zap className="size-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">
                  {plan.procurement.filter((l) => l.net > 0).length} material{plan.procurement.filter((l) => l.net > 0).length > 1 ? "s" : ""} need procurement
                </p>
                <p className="text-xs text-muted-foreground">Generate a draft Purchase Requisition from all shortfalls in one click — vs SAP&apos;s ME57 + ME21N multi-step flow.</p>
              </div>
              <Button size="sm" onClick={createPRsFromPlan}>
                <ClipboardList className="size-4" /> Create PRs from plan
              </Button>
            </div>
          )}

          {/* Filter bar */}
          {(() => {
            const lowIds = new Set(
              stockIdx
                ? [...plan.finishedGoods, ...plan.semiFinished, ...plan.procurement]
                    .filter((l) => {
                      const it = itemById(l.itemId);
                      return it && stockIdx ? stockTotal(stockIdx, l.itemId) < it.reorderLevel : false;
                    })
                    .map((l) => l.itemId)
                : [],
            );

            const filterLine = (l: PlanLine) => {
              if (planFilter === "all") return true;
              if (planFilter === "low") return lowIds.has(l.itemId);
              return l.itemId === planFilter;
            };

            const fgFiltered = plan.finishedGoods.filter(filterLine);
            const sfgFiltered = plan.semiFinished.filter(filterLine);
            const procFiltered = plan.procurement.filter(filterLine);
            const isFiltered = planFilter !== "all";
            const filteredItemName = typeof planFilter === "string" && planFilter !== "all" && planFilter !== "low"
              ? itemName(planFilter)
              : null;

            return (
              <>
                {/* Filter toolbar */}
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">Filter plan:</span>
                  <button
                    onClick={() => { setPlanFilter("all"); setHighlightedItem(null); }}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      planFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent",
                    )}
                  >
                    All items
                  </button>
                  <button
                    onClick={() => { setPlanFilter("low"); setHighlightedItem(null); }}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                      planFilter === "low" ? "bg-warning text-white" : "bg-muted text-muted-foreground hover:bg-accent",
                    )}
                  >
                    Reorder items only
                    {lowIds.size > 0 && (
                      <span className={cn("ml-1.5 rounded-full px-1.5 py-0.5 text-[10px]",
                        planFilter === "low" ? "bg-white/20 text-white" : "bg-warning/20 text-warning"
                      )}>{lowIds.size}</span>
                    )}
                  </button>
                  {filteredItemName && (
                    <span className="flex items-center gap-1 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                      {filteredItemName}
                      <button
                        onClick={() => { setPlanFilter("all"); setHighlightedItem(null); }}
                        className="ml-1 hover:text-danger"
                        aria-label="Clear filter"
                      >×</button>
                    </span>
                  )}
                  {isFiltered && (
                    <span className="text-xs text-muted-foreground">
                      Showing {fgFiltered.length + sfgFiltered.length + procFiltered.length} of{" "}
                      {plan.finishedGoods.length + plan.semiFinished.length + plan.procurement.length} lines
                    </span>
                  )}
                </div>

                {/* MRP plan tables */}
                <div className="space-y-4 mb-4">
                  <PlanTable
                    title="Finished Goods — Production / Receipt Plan"
                    lines={fgFiltered}
                    emptyMsg={isFiltered ? "No matching finished goods for this filter." : "No finished-good demand entered."}
                    highlightId={highlightedItem}
                  />
                  <PlanTable
                    title="Semi-Finished — Intermediate Production Plan"
                    lines={sfgFiltered}
                    emptyMsg={isFiltered ? "No matching semi-finished items for this filter." : "All semi-finished requirements are covered by on-hand stock."}
                    highlightId={highlightedItem}
                  />
                  <PlanTable
                    title="Raw Materials & Packing — Procurement Plan"
                    lines={procFiltered}
                    emptyMsg={isFiltered ? "No matching procurement items for this filter." : "All raw material and packing requirements are covered by on-hand stock."}
                    highlightId={highlightedItem}
                  />
                </div>
              </>
            );
          })()}

          {/* Visual analysis */}
          <ProcurementVisuals plan={plan} demand={lastDemand} horizon={horizon} />
        </>
      )}
    </>
  );
}
