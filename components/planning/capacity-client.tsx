"use client";

import * as React from "react";
import { Factory, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LOCATIONS } from "@/lib/accounting/org";
import {
  loadWorkCentres, loadCapacityLoads, loadCapacityPlans,
  availableHoursPerWeek, formatWeekLabel, addWeek, currentWeekMonday,
  WORK_CENTRES,
  type WorkCentre, type CapacityLoad, type CapacityPlan,
} from "@/lib/planning/capacity";

function fmtHr(h: number) { return `${h.toFixed(1)}h`; }
function fmtKg(n: number) { return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n) + " kg"; }

function loadBar(pct: number) {
  const color = pct > 100 ? "bg-danger" : pct > 85 ? "bg-warning" : "bg-primary";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={cn("text-xs tabular font-medium", pct > 100 ? "text-danger" : pct > 85 ? "text-warning" : "text-muted-foreground")}>
        {pct}%{pct > 100 && " ⚠"}
      </span>
    </div>
  );
}

export function CapacityClient() {
  const [week, setWeek] = React.useState(() => currentWeekMonday());
  const [workCentres, setWorkCentres] = React.useState<WorkCentre[]>(WORK_CENTRES);
  const [loads, setLoads] = React.useState<CapacityLoad[]>([]);
  const [plans, setPlans] = React.useState<CapacityPlan[]>([]);

  React.useEffect(() => {
    setWorkCentres(loadWorkCentres());
    setLoads(loadCapacityLoads());
    setPlans(loadCapacityPlans());
  }, []);

  const weekLoads = loads.filter((l) => l.week === week);
  const weekPlans = plans.filter((p) => p.week === week);
  const overloaded = weekLoads.filter((l) => l.loadPct > 100).length;

  function getLoad(wcId: string): CapacityLoad | undefined {
    return weekLoads.find((l) => l.workCentreId === wcId);
  }

  return (
    <>
      <PageHeader
        title="Capacity Planning"
        subtitle="Machine and labour hour planning vs. load by work centre and week."
      />

      {overloaded > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <AlertTriangle className="size-4 text-warning" />
          <span className="text-sm"><strong>{overloaded} work centre{overloaded > 1 ? "s" : ""}</strong> over capacity this week — reschedule or add shifts.</span>
        </div>
      )}

      <div className="mb-4 flex items-center justify-between">
        <Button variant="outline" size="sm" onClick={() => setWeek(addWeek(week, -1))}>
          <ChevronLeft className="size-4" />
        </Button>
        <span className="text-sm font-semibold">Week of {formatWeekLabel(week)}</span>
        <Button variant="outline" size="sm" onClick={() => setWeek(addWeek(week, 1))}>
          <ChevronRight className="size-4" />
        </Button>
      </div>

      <Card className="mb-4 overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Work Centre</th>
                <th className="px-4 py-2.5 font-medium">Location</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Shifts</th>
                <th className="px-4 py-2.5 text-right font-medium">Available</th>
                <th className="px-4 py-2.5 text-right font-medium">Planned</th>
                <th className="px-4 py-2.5 text-right font-medium">Actual</th>
                <th className="px-4 py-2.5 font-medium">Load</th>
                <th className="px-4 py-2.5 text-right font-medium">Output (planned)</th>
              </tr>
            </thead>
            <tbody>
              {workCentres.map((wc) => {
                const load = getLoad(wc.id);
                const avail = availableHoursPerWeek(wc);
                const locName = LOCATIONS.find((l) => l.id === wc.locationId)?.name ?? wc.locationId;
                return (
                  <tr key={wc.id} className={cn("border-b last:border-0 hover:bg-accent/40", !wc.isActive && "opacity-50")}>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <Factory className="size-3.5 text-muted-foreground" />
                        <span className="font-medium">{wc.name}</span>
                        {!wc.isActive && <Badge variant="default" className="text-[9px]">Inactive</Badge>}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{locName}</td>
                    <td className="px-4 py-2.5">
                      <Badge variant={wc.resourceType === "machine" ? "primary" : "warning"} className="text-[10px]">
                        {wc.resourceType === "machine" ? "Machine" : "Labour"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-xs capitalize">{wc.shiftPattern}</td>
                    <td className="px-4 py-2.5 text-right tabular text-xs">{fmtHr(avail)}</td>
                    <td className="px-4 py-2.5 text-right tabular text-xs">{load ? fmtHr(load.plannedHours) : "—"}</td>
                    <td className="px-4 py-2.5 text-right tabular text-xs">{load ? fmtHr(load.actualHours) : "—"}</td>
                    <td className="px-4 py-2.5">{load ? loadBar(load.loadPct) : <span className="text-xs text-muted-foreground">No data</span>}</td>
                    <td className="px-4 py-2.5 text-right tabular text-xs">
                      {load && wc.capacityKgPerHour ? fmtKg(load.plannedOutput) : wc.headcount ? `${wc.headcount} heads` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {weekPlans.length > 0 && (
        <>
          <h3 className="mb-2 font-semibold">Production plans for this week ({weekPlans.length})</h3>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Plan ref</th>
                  <th className="px-4 py-2.5 font-medium">Work centre</th>
                  <th className="px-4 py-2.5 font-medium">Production order</th>
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 text-right font-medium">Planned hours</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {weekPlans.map((p) => {
                  const wc = workCentres.find((w) => w.id === p.workCentreId);
                  const statusVariant = p.status === "completed" ? "success" : p.status === "in-progress" ? "warning" : "default";
                  return (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2 font-mono text-xs text-primary">{p.ref}</td>
                      <td className="px-4 py-2 text-xs">{wc?.name ?? p.workCentreId}</td>
                      <td className="px-4 py-2 font-mono text-xs">{p.productionOrderRef}</td>
                      <td className="px-4 py-2">{p.itemName}</td>
                      <td className="px-4 py-2 text-right tabular text-xs">{p.plannedQty.toLocaleString("en-IN")}</td>
                      <td className="px-4 py-2 text-right tabular text-xs">{fmtHr(p.plannedHours)}</td>
                      <td className="px-4 py-2"><Badge variant={statusVariant} className="text-[10px] capitalize">{p.status.replace("-", " ")}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </>
  );
}
