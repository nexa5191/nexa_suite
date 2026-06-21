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
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { FINISHED_ITEMS, itemById, itemName } from "@/lib/inventory/items";
import { allMovements, buildStockIndex, loadAddedMovements } from "@/lib/inventory/movements";
import { runMrp, suggestedDemand, type PlanLine, type DemandStats } from "@/lib/inventory/planning";

const HORIZON_OPTIONS = [
  { days: 7, label: "1 week" },
  { days: 14, label: "2 weeks" },
  { days: 30, label: "1 month" },
  { days: 90, label: "3 months" },
];

function fmtQty(n: number, uom?: string) {
  const s = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
  return uom ? `${s} ${uom}` : s;
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

interface PlanTableProps {
  title: string;
  lines: PlanLine[];
  emptyMsg: string;
}

function PlanTable({ title, lines, emptyMsg }: PlanTableProps) {
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
                  return (
                    <tr key={line.itemId} className="border-b align-top last:border-0">
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

export function PlanningClient() {
  const [horizon, setHorizon] = React.useState(30);
  const [demandQtys, setDemandQtys] = React.useState<Record<string, string>>({});
  const [plan, setPlan] = React.useState<ReturnType<typeof runMrp> | null>(null);
  const [stats, setStats] = React.useState<DemandStats>({ suggested: {}, avgDaily: {} });

  React.useEffect(() => {
    const added = loadAddedMovements();
    const mvs = allMovements(added);
    const sg = suggestedDemand(mvs, horizon);
    setStats(sg);
    setDemandQtys(
      Object.fromEntries(Object.entries(sg.suggested).map(([id, qty]) => [id, String(qty)])),
    );
    setPlan(null);
  }, [horizon]);

  function runPlan() {
    const added = loadAddedMovements();
    const idx = buildStockIndex(allMovements(added));
    const demand = FINISHED_ITEMS.map((it) => ({
      itemId: it.id,
      qty: Number(demandQtys[it.id] ?? 0),
    })).filter((d) => d.qty > 0);
    setPlan(runMrp(demand, idx, horizon, stats.avgDaily));
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
        subtitle="MRP-lite: enter target demand, net against on-hand stock, and get a production + procurement plan."
        actions={
          <Link href="/inventory">
            <Button variant="outline">Back to Inventory</Button>
          </Link>
        }
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
          {/* Summary strip */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
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

          <div className="space-y-4">
            <PlanTable
              title="Finished Goods — Production / Receipt Plan"
              lines={plan.finishedGoods}
              emptyMsg="No finished-good demand entered."
            />
            <PlanTable
              title="Semi-Finished — Intermediate Production Plan"
              lines={plan.semiFinished}
              emptyMsg="All semi-finished requirements are covered by on-hand stock."
            />
            <PlanTable
              title="Raw Materials & Packing — Procurement Plan"
              lines={plan.procurement}
              emptyMsg="All raw material and packing requirements are covered by on-hand stock."
            />
          </div>
        </>
      )}
    </>
  );
}

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
