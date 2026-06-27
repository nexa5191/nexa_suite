"use client";

import * as React from "react";
import { Gauge, ChevronLeft, ChevronRight, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { LOCATIONS } from "@/lib/accounting/org";
import { availableWeeks, machineUtilReport } from "@/lib/planning/machine-utilisation";
import { addWeek, currentWeekMonday, formatWeekLabel } from "@/lib/planning/capacity";

function utilBar(pct: number) {
  const color = pct > 100 ? "bg-danger" : pct >= 85 ? "bg-warning" : pct >= 50 ? "bg-primary" : "bg-muted-foreground/40";
  const textColor = pct > 100 ? "text-danger" : pct >= 85 ? "text-warning" : "text-muted-foreground";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-28 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
      <span className={cn("text-xs tabular font-medium", textColor)}>{pct.toFixed(1)}%</span>
    </div>
  );
}

function fmtHr(h: number) { return `${h.toFixed(1)}h`; }

export function MachineUtilisationClient() {
  const weeks = availableWeeks();
  const [week, setWeek] = React.useState(() => {
    const cur = currentWeekMonday();
    return weeks.includes(cur) ? cur : weeks[weeks.length - 1] ?? cur;
  });
  const [locationFilter, setLocationFilter] = React.useState("all");

  const report = React.useMemo(() => machineUtilReport(week), [week]);

  const rows = locationFilter === "all"
    ? report.rows
    : report.rows.filter((r) => r.locationId === locationFilter);

  const locations = [...new Set(report.rows.map((r) => r.locationId))];

  function prevWeek() {
    const idx = weeks.indexOf(week);
    if (idx > 0) setWeek(weeks[idx - 1]);
  }
  function nextWeek() {
    const idx = weeks.indexOf(week);
    if (idx < weeks.length - 1) setWeek(weeks[idx + 1]);
  }

  return (
    <>
      <PageHeader
        title="Machine Utilisation"
        subtitle="Actual vs. available hours per work centre — used for cost audit and capacity planning."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Total available hours" value={`${report.totalAvailable.toFixed(1)}h`} />
        <Stat label="Total actual hours" value={`${report.totalActual.toFixed(1)}h`} />
        <Stat label="Avg utilisation" value={`${report.avgUtilPct}%`} accent />
        <StatMoney label="Actual machine cost" value={report.totalActualCost} />
      </div>

      {report.overloadedCount > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-danger/40 bg-danger/5 p-3 text-sm">
          <AlertTriangle className="size-4 text-danger" />
          <span><strong>{report.overloadedCount}</strong> work centre{report.overloadedCount > 1 ? "s" : ""} exceeded 100% utilisation — review scheduling.</span>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prevWeek} disabled={weeks.indexOf(week) === 0}>
            <ChevronLeft className="size-4" />
          </Button>
          <span className="text-sm font-semibold">Week of {formatWeekLabel(week)}</span>
          <Button variant="outline" size="sm" onClick={nextWeek} disabled={weeks.indexOf(week) === weeks.length - 1}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
        <Select value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} className="h-9 w-48">
          <option value="all">All locations</option>
          {locations.map((id) => (
            <option key={id} value={id}>{LOCATIONS.find((l) => l.id === id)?.name ?? id}</option>
          ))}
        </Select>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Work Centre</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Shifts</th>
                <th className="px-4 py-2.5 text-right font-medium">Available</th>
                <th className="px-4 py-2.5 text-right font-medium">Planned</th>
                <th className="px-4 py-2.5 text-right font-medium">Actual</th>
                <th className="px-4 py-2.5 text-right font-medium">Idle</th>
                <th className="px-4 py-2.5 font-medium">Utilisation</th>
                <th className="px-4 py-2.5 text-right font-medium">Cost/hr</th>
                <th className="px-4 py-2.5 text-right font-medium">Actual cost</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.workCentreId} className={cn("border-b last:border-0 hover:bg-accent/40", r.overloadFlag && "bg-danger/5")}>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <Gauge className="size-3.5 text-muted-foreground" />
                      <span className="font-medium">{r.name}</span>
                      {r.overloadFlag && <Badge variant="danger" className="text-[9px]">Over</Badge>}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{LOCATIONS.find((l) => l.id === r.locationId)?.name ?? r.locationId}</div>
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge variant={r.resourceType === "machine" ? "primary" : "warning"} className="text-[10px]">
                      {r.resourceType === "machine" ? "Machine" : "Labour"}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-xs capitalize">{r.shiftPattern}</td>
                  <td className="px-4 py-2.5 text-right tabular text-xs">{fmtHr(r.availableHours)}</td>
                  <td className="px-4 py-2.5 text-right tabular text-xs">{r.plannedHours > 0 ? fmtHr(r.plannedHours) : "—"}</td>
                  <td className="px-4 py-2.5 text-right tabular text-xs font-medium">{r.actualHours > 0 ? fmtHr(r.actualHours) : "—"}</td>
                  <td className={cn("px-4 py-2.5 text-right tabular text-xs", r.idleHours > r.availableHours * 0.3 ? "text-warning" : "text-muted-foreground")}>
                    {fmtHr(r.idleHours)}
                  </td>
                  <td className="px-4 py-2.5">{utilBar(r.utilPct)}</td>
                  <td className="px-4 py-2.5 text-right tabular text-xs"><Money value={r.costPerHour} /></td>
                  <td className="px-4 py-2.5 text-right tabular text-xs font-medium">
                    {r.actualCost > 0 ? <Money value={r.actualCost} /> : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/30 font-semibold">
                <td className="px-4 py-3" colSpan={3}>Total</td>
                <td className="px-4 py-3 text-right tabular text-xs">{fmtHr(rows.reduce((s, r) => s + r.availableHours, 0))}</td>
                <td className="px-4 py-3 text-right tabular text-xs">{fmtHr(rows.reduce((s, r) => s + r.plannedHours, 0))}</td>
                <td className="px-4 py-3 text-right tabular text-xs">{fmtHr(rows.reduce((s, r) => s + r.actualHours, 0))}</td>
                <td className="px-4 py-3 text-right tabular text-xs">{fmtHr(rows.reduce((s, r) => s + r.idleHours, 0))}</td>
                <td className="px-4 py-3" />
                <td className="px-4 py-3" />
                <td className="px-4 py-3 text-right tabular text-xs"><Money value={rows.reduce((s, r) => s + r.actualCost, 0)} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Utilisation = actual hours / available hours (adjusted for efficiency). Values above 100% indicate overtime or unplanned shifts — flag for cost audit review.
      </p>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <Card className={cn("p-4", accent && "border-primary/30")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular", accent && "text-primary")}>{value}</p>
    </Card>
  );
}
function StatMoney({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular"><Money value={value} compact /></p>
    </Card>
  );
}
