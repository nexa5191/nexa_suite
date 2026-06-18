"use client";

import * as React from "react";
import { Target, Wallet, FileClock, ShoppingCart, AlertTriangle, Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Select, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/export";
import { ENTITIES } from "@/lib/accounting/org";
import { AS_ON } from "@/lib/finance/receivables";
import { budgetControl, type BudgetControl } from "@/lib/planning/budget-control";

export function BudgetControlClient() {
  const [mounted, setMounted] = React.useState(false);
  const [entityId, setEntityId] = React.useState("all");
  React.useEffect(() => setMounted(true), []);

  const bc = React.useMemo<BudgetControl | null>(() => (mounted ? budgetControl(entityId, AS_ON) : null), [mounted, entityId]);

  function exportCsv() {
    if (!bc) return;
    downloadCsv("budget-control", ["Category", "Budget", "Actual", "Committed", "Available", "% used"],
      bc.categories.map((c) => [c.name, c.budget, c.actual, c.committed, c.available, `${Math.round(c.pctUsed * 100)}%`]));
  }

  return (
    <>
      <PageHeader
        title="Budgetary Control"
        subtitle="Commitment accounting — available budget = budget − actual − open commitments (POs)."
        actions={
          <div className="flex items-center gap-2">
            <Select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="h-9 w-48">
              <option value="all">All entities</option>
              {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
            </Select>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!bc}><Download className="size-4" /> CSV</Button>
          </div>
        }
      />

      {bc && (
        <>
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat icon={Target} label="Expense budget" value={bc.totals.budget} />
            <Stat icon={FileClock} label="Actual to date" value={bc.totals.actual} />
            <Stat icon={ShoppingCart} label="Committed (open POs)" value={bc.totals.committed} tone="warning" />
            <Stat icon={Wallet} label="Available" value={bc.totals.available} tone={bc.totals.available < 0 ? "danger" : "success"} highlight />
          </div>

          {bc.categories.some((c) => c.over) && (
            <Card className="mb-4 flex items-center gap-3 border-danger/30 bg-danger/5 p-4">
              <AlertTriangle className="size-5 shrink-0 text-danger" />
              <p className="text-sm text-muted-foreground">
                A category is <span className="font-medium text-danger">over budget</span> once actuals and commitments are combined — review before approving more spend.
              </p>
            </Card>
          )}

          <Card className="mb-4 overflow-hidden">
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Category</th>
                    <th className="px-4 py-3 text-right font-medium">Budget</th>
                    <th className="px-4 py-3 text-right font-medium">Actual</th>
                    <th className="px-4 py-3 text-right font-medium">Committed</th>
                    <th className="px-4 py-3 text-right font-medium">Available</th>
                    <th className="px-4 py-3 font-medium">Consumed</th>
                  </tr>
                </thead>
                <tbody>
                  {bc.categories.map((c) => (
                    <tr key={c.key} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2.5 font-medium">{c.name}{c.over && <Badge variant="danger" className="ml-2 text-[10px]">Over</Badge>}</td>
                      <td className="px-4 py-2.5 text-right tabular"><Money value={c.budget} /></td>
                      <td className="px-4 py-2.5 text-right tabular"><Money value={c.actual} /></td>
                      <td className="px-4 py-2.5 text-right tabular text-warning"><Money value={c.committed} /></td>
                      <td className={cn("px-4 py-2.5 text-right tabular font-medium", c.available < 0 ? "text-danger" : "text-success")}><Money value={c.available} bracketNegatives /></td>
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
                            <div className={cn("h-full rounded-full", c.over ? "bg-danger" : c.pctUsed > 0.85 ? "bg-warning" : "bg-primary")} style={{ width: `${Math.min(100, Math.round(c.pctUsed * 100))}%` }} />
                          </div>
                          <span className="text-xs tabular text-muted-foreground">{Math.round(c.pctUsed * 100)}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td className="px-4 py-3">Total</td>
                    <td className="px-4 py-3 text-right tabular"><Money value={bc.totals.budget} /></td>
                    <td className="px-4 py-3 text-right tabular"><Money value={bc.totals.actual} /></td>
                    <td className="px-4 py-3 text-right tabular text-warning"><Money value={bc.totals.committed} /></td>
                    <td className={cn("px-4 py-3 text-right tabular", bc.totals.available < 0 ? "text-danger" : "text-success")}><Money value={bc.totals.available} bracketNegatives /></td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{Math.round(bc.totals.pctUsed * 100)}% used</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>

          {/* Commitment register */}
          <Card className="overflow-hidden">
            <div className="border-b px-5 py-3 text-sm font-semibold">Open commitments — issued POs ({bc.commitments.length})</div>
            <table className="w-full text-sm">
              <tbody>
                {bc.commitments.map((c) => (
                  <tr key={c.poId} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-5 py-2.5 font-mono text-xs text-muted-foreground">{c.poId}</td>
                    <td className="px-4 py-2.5 font-medium">{c.vendor}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{c.title}</td>
                    <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{c.category === "cogs" ? "COGS" : "Opex"}</Badge></td>
                    <td className="px-5 py-2.5 text-right tabular font-medium"><Money value={c.amount} /></td>
                  </tr>
                ))}
                {bc.commitments.length === 0 && (
                  <tr><td className="px-5 py-6 text-center text-muted-foreground">No open commitments.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Commitments are purchase orders raised but not yet invoiced — they reserve budget so it can&apos;t be double-spent. Once a PO is invoiced it becomes actual.
          </p>
        </>
      )}
    </>
  );
}

function Stat({ icon: Icon, label, value, tone, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone?: "success" | "warning" | "danger"; highlight?: boolean }) {
  const toneCls = tone === "success" ? "text-success" : tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "";
  return (
    <Card className={cn("p-4", highlight && "border-primary/30 bg-primary/5")}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Icon className={cn("size-3.5", toneCls)} /> {label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular", toneCls)}><Money value={value} bracketNegatives /></p>
    </Card>
  );
}
