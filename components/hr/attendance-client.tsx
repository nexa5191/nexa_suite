"use client";

import * as React from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { cn, formatDate } from "@/lib/utils";
import { employeeById } from "@/lib/hr/employees";
import { locationById } from "@/lib/accounting/org";
import { monthAttendance, todayBoard, type DayCell, type AttendanceSummary } from "@/lib/hr/attendance";
import { Drawer } from "@/components/ui/modal";

const CELL_CLASS: Record<DayCell, string> = {
  present: "bg-success/70",
  wfh: "bg-primary/60",
  half: "bg-warning/70",
  absent: "bg-danger/70",
  leave: "bg-[#7c3aed]/60",
  holiday: "bg-foreground/15",
  weekend: "bg-muted",
  future: "bg-transparent",
};
const CELL_LABEL: Record<DayCell, string> = {
  present: "Present",
  wfh: "WFH",
  half: "Half day",
  absent: "Absent",
  leave: "Leave",
  holiday: "Holiday",
  weekend: "Weekend",
  future: "Upcoming",
};
const LEGEND: { key: DayCell; label: string }[] = [
  { key: "present", label: "Present" },
  { key: "wfh", label: "WFH" },
  { key: "half", label: "Half day" },
  { key: "leave", label: "Leave" },
  { key: "absent", label: "Absent" },
  { key: "holiday", label: "Holiday" },
  { key: "weekend", label: "Weekend" },
];

interface EmpRow {
  employeeId: string;
  days: DayCell[];
  summary: AttendanceSummary;
}

export function AttendanceClient() {
  const board = React.useMemo(() => todayBoard(), []);
  const { dates, rows } = React.useMemo(() => monthAttendance(2026, 5), []); // June 2026
  const [selected, setSelected] = React.useState<EmpRow | null>(null);

  const selEmp = selected ? employeeById(selected.employeeId) : null;

  return (
    <>
      <PageHeader title="Attendance" subtitle="Daily attendance across the team for June 2026 (live to date)." />

      {/* Today board */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Present today" value={board.counts.present} tone="text-success" />
        <Stat label="WFH" value={board.counts.wfh} tone="text-primary" />
        <Stat label="On leave" value={board.counts.leave} tone="text-[#7c3aed]" />
        <Stat label="Half day" value={board.counts.half} tone="text-warning" />
        <Stat label="Absent" value={board.counts.absent} tone="text-danger" />
      </div>

      {/* Legend */}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        {LEGEND.map((l) => (
          <span key={l.key} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className={cn("size-3 rounded-sm border", CELL_CLASS[l.key])} /> {l.label}
          </span>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="sticky left-0 z-10 bg-muted/40 px-4 py-2 text-left text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Employee
                </th>
                {dates.map((d) => {
                  const day = Number(d.slice(8, 10));
                  const wd = new Date(`${d}T00:00:00Z`).getUTCDay();
                  return (
                    <th key={d} className={cn("w-7 py-2 text-center text-[10px] font-medium", (wd === 0 || wd === 6) && "text-muted-foreground/50")}>
                      {day}
                    </th>
                  );
                })}
                <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wide text-muted-foreground">%</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const emp = employeeById(row.employeeId)!;
                return (
                  <tr
                    key={row.employeeId}
                    onClick={() => setSelected(row)}
                    className="cursor-pointer border-b last:border-0 hover:bg-accent/40"
                  >
                    <td className="sticky left-0 z-10 max-w-[180px] truncate bg-card px-4 py-1.5">
                      <span className="font-medium">{emp.name}</span>
                      <span className="block text-[11px] text-muted-foreground">{locationById(emp.locationId)?.name}</span>
                    </td>
                    {row.days.map((s, i) => (
                      <td key={i} className="px-0.5 py-1.5">
                        <span className={cn("mx-auto block size-4 rounded-sm", CELL_CLASS[s])} title={`${dates[i]} · ${s}`} />
                      </td>
                    ))}
                    <td className={cn("px-3 py-1.5 text-right font-semibold tabular", row.summary.percent < 85 ? "text-danger" : "text-foreground")}>
                      {row.summary.percent}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selEmp?.name}
        subtitle={selEmp ? `${locationById(selEmp.locationId)?.name} · June 2026` : undefined}
        width="max-w-lg"
      >
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
              <SummaryStat label="Present" value={selected.summary.present} tone="text-success" />
              <SummaryStat label="WFH" value={selected.summary.wfh} tone="text-primary" />
              <SummaryStat label="Half day" value={selected.summary.half} tone="text-warning" />
              <SummaryStat label="Leave" value={selected.summary.leave} tone="text-[#7c3aed]" />
              <SummaryStat label="Absent" value={selected.summary.absent} tone="text-danger" />
            </div>

            <div className="flex items-center justify-between rounded-md border bg-muted/30 px-3 py-2">
              <span className="text-xs text-muted-foreground">
                {selected.summary.workingDays} working day{selected.summary.workingDays === 1 ? "" : "s"} to date
              </span>
              <span className={cn("text-lg font-bold tabular", selected.summary.percent < 85 ? "text-danger" : "text-foreground")}>
                {selected.summary.percent}%
              </span>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Daily log</p>
              <div className="space-y-0.5">
                {selected.days.map((s, i) => {
                  if (s === "future") return null;
                  return (
                    <div key={i} className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-accent/40">
                      <span className={cn("size-3.5 shrink-0 rounded-sm border", CELL_CLASS[s])} />
                      <span className="w-28 text-muted-foreground">{formatDate(dates[i])}</span>
                      <span className="w-24 text-[11px] text-muted-foreground/70">
                        {new Date(`${dates[i]}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short" })}
                      </span>
                      <span className="font-medium">{CELL_LABEL[s]}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular", tone)}>{value}</p>
    </Card>
  );
}

function SummaryStat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-md border p-2 text-center">
      <p className={cn("text-2xl font-bold tabular", tone)}>{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}
