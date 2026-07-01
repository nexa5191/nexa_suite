"use client";

import * as React from "react";
import Link from "next/link";
import { PackageX, Zap, CheckCircle2, ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ITEMS } from "@/lib/inventory/items";
import { allMovements, buildStockIndex, loadAddedMovements, stockTotal } from "@/lib/inventory/movements";
import {
  allPRs, loadPRs, savePRs, nextPRRef,
  buildAutoRolPRs, loadRolContext, saveRolContext,
  type AutoRolLineContext,
} from "@/lib/inventory/supply-chain";
import { ACTIVE_EMPLOYEES } from "@/lib/hr/employees";
import { locationById } from "@/lib/accounting/org";
const locationName = (id: string) => locationById(id)?.name ?? id;

const TODAY = "2026-07-01";

export function ReorderClient() {
  const [rows, setRows] = React.useState<Array<{
    item: (typeof ITEMS)[0];
    onHand: number;
    shortage: number;
    ctx: AutoRolLineContext | null;
  }>>([]);
  const [activePrRef, setActivePrRef] = React.useState<string | null>(null);
  const [banner, setBanner] = React.useState<{ msg: string; ok: boolean } | null>(null);

  React.useEffect(() => {
    const addedMovements = loadAddedMovements();
    const movements = allMovements(addedMovements);
    const idx = buildStockIndex(movements);
    const ctx = loadRolContext();

    const below = ITEMS
      .filter((it) => it.category !== "semi-finished" && !(it.category === "finished" && it.ownership !== "third-party"))
      .flatMap((it) => {
        const onHand = stockTotal(idx, it.id);
        if (onHand >= it.reorderLevel) return [];
        return [{ item: it, onHand, shortage: it.reorderLevel - onHand, ctx: ctx[it.id] ?? null }];
      })
      .sort((a, b) => (b.shortage / b.item.reorderLevel) - (a.shortage / a.item.reorderLevel));

    setRows(below);

    const prs = allPRs(loadPRs());
    const active = prs.find((p) => p.source === "auto-rol" && ["submitted", "approved"].includes(p.status));
    setActivePrRef(active?.ref ?? null);
  }, []);

  function generateAutoRolPRs() {
    const addedMovements = loadAddedMovements();
    const movements = allMovements(addedMovements);
    const added = loadPRs();
    const requestedBy = ACTIVE_EMPLOYEES[0]?.id ?? "emp-001";

    const result = buildAutoRolPRs(movements, allPRs(added), requestedBy, TODAY);
    if (!result) {
      setBanner({ msg: "All items are above reorder level — no PR needed.", ok: true });
      return;
    }
    const { pr, context } = result;
    const ref = nextPRRef(allPRs(added));
    const newPr = { ...pr, ref };
    savePRs([...added, newPr]);
    saveRolContext(context);
    setActivePrRef(ref);
    setBanner({ msg: `Auto-PR ${ref} created with ${pr.lines.length} line${pr.lines.length !== 1 ? "s" : ""} — review in Requisitions.`, ok: true });
  }

  const pctLow = (row: typeof rows[0]) =>
    row.item.reorderLevel > 0 ? Math.max(0, Math.min(100, (row.onHand / row.item.reorderLevel) * 100)) : 0;

  return (
    <div className="space-y-4 p-4 md:p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Reorder Alerts"
        subtitle={`${rows.length} item${rows.length !== 1 ? "s" : ""} below reorder level`}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Link href="/inventory" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-3" /> Inventory
        </Link>
        <span className="text-muted-foreground">·</span>
        <Link href="/inventory/requisitions" className="text-xs text-muted-foreground hover:text-foreground">Requisitions</Link>
        <div className="ml-auto flex items-center gap-2">
          {activePrRef ? (
            <Link href="/inventory/requisitions" className="text-xs font-medium text-primary hover:underline">
              PR {activePrRef} in review →
            </Link>
          ) : (
            <Button size="sm" onClick={generateAutoRolPRs} disabled={rows.length === 0}>
              <Zap className="size-3.5" /> Generate Auto-PR
            </Button>
          )}
        </div>
      </div>

      {banner && (
        <div className={cn("flex items-center gap-2 rounded-md border px-3 py-2 text-xs", banner.ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger")}>
          <CheckCircle2 className="size-3.5 shrink-0" />
          <span className="font-medium">{banner.msg}</span>
        </div>
      )}

      {rows.length === 0 ? (
        <Card className="p-8 text-center">
          <CheckCircle2 className="mx-auto mb-2 size-8 text-success" />
          <p className="font-medium">All items above reorder level</p>
          <p className="mt-1 text-xs text-muted-foreground">No restocking required right now.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b bg-muted/40 text-left">
                <th className="px-3 py-2 font-medium text-muted-foreground">Item</th>
                <th className="px-3 py-2 font-medium text-muted-foreground">Location</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">On hand</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">ROL</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground">Shortage</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden md:table-cell">Avg daily</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden md:table-cell">Lead time</th>
                <th className="px-3 py-2 text-right font-medium text-muted-foreground hidden lg:table-cell">Suggested order</th>
                <th className="px-3 py-2 font-medium text-muted-foreground w-24">Stock %</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const pct = pctLow(row);
                const criticalPct = pct < 33;
                return (
                  <tr key={row.item.id} className="border-b last:border-0 hover:bg-muted/20">
                    <td className="px-3 py-2">
                      <div className="font-medium">{row.item.name}</div>
                      <div className="text-[10px] text-muted-foreground">{row.item.code} · {row.item.category}</div>
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{locationName(row.item.primaryLocationId)}</td>
                    <td className="px-3 py-2 text-right font-medium">
                      {row.onHand.toFixed(0)} <span className="text-muted-foreground">{row.item.uom}</span>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground">
                      {row.item.reorderLevel.toFixed(0)} {row.item.uom}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={cn("font-semibold", criticalPct ? "text-danger" : "text-warning")}>
                        {row.shortage.toFixed(0)} {row.item.uom}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground hidden md:table-cell">
                      {row.ctx ? `${row.ctx.avgDailyDemand.toFixed(1)} ${row.item.uom}/d` : "—"}
                    </td>
                    <td className="px-3 py-2 text-right text-muted-foreground hidden md:table-cell">
                      {row.ctx ? `${row.ctx.leadTimeDays}d` : `${row.item.leadTimeDays ?? 7}d`}
                    </td>
                    <td className="px-3 py-2 text-right font-medium hidden lg:table-cell">
                      {row.ctx ? `${row.ctx.suggestedQty.toFixed(0)} ${row.item.uom}` : "—"}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-1.5">
                        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full", criticalPct ? "bg-danger" : "bg-warning")}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className={cn("w-7 text-right text-[10px] font-medium tabular-nums", criticalPct ? "text-danger" : "text-warning")}>
                          {pct.toFixed(0)}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      <p className="text-[11px] text-muted-foreground">
        Avg daily demand and suggested order qty are computed from historical outflows.
        Lead time sourced from item master (default 7 days).
        <Link href="/inventory/requisitions" className="ml-1 text-primary hover:underline">Go to Requisitions →</Link>
      </p>
    </div>
  );
}
