"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import {
  COMPLIANCE_CALENDAR,
  dueDatesFiltered,
  alertSummary,
  estimatedPenalty,
  type ComplianceCategory,
  type AlertLevel,
  type DueDate,
} from "@/lib/compliance/calendar";
import { AlertTriangle, CheckCircle2, Clock, CalendarClock, Bell, Download } from "lucide-react";
import { cn } from "@/lib/utils";

const CATEGORIES: { key: ComplianceCategory | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "GST", label: "GST" },
  { key: "TDS", label: "TDS" },
  { key: "PF/ESI", label: "PF / ESI" },
  { key: "AdvanceTax", label: "Advance Tax" },
  { key: "MCA", label: "MCA / ROC" },
  { key: "IncomeTax", label: "Income Tax" },
  { key: "PT", label: "Prof. Tax" },
];

const ALERT_COLORS: Record<AlertLevel, string> = {
  ok: "text-emerald-600",
  "due-soon": "text-amber-600",
  "due-today": "text-primary",
  overdue: "text-red-600",
};

const ALERT_BG: Record<AlertLevel, string> = {
  ok: "",
  "due-soon": "bg-amber-50/50 dark:bg-amber-950/10",
  "due-today": "bg-primary/5",
  overdue: "bg-red-50/50 dark:bg-red-950/10",
};

const ALERT_BADGE: Record<AlertLevel, "success" | "warning" | "primary" | "danger"> = {
  ok: "success",
  "due-soon": "warning",
  "due-today": "primary",
  overdue: "danger",
};

const ALERT_LABELS: Record<AlertLevel, string> = {
  ok: "On track",
  "due-soon": "Due soon",
  "due-today": "Due today",
  overdue: "Overdue",
};

export function CalendarClient() {
  const [category, setCategory] = useState<ComplianceCategory | "all">("all");
  const [hideCompleted, setHideCompleted] = useState(false);
  const alerts = alertSummary();

  const items = dueDatesFiltered(
    category === "all" ? undefined : category,
    !hideCompleted,
  );

  function exportCsv() {
    const hdr = "Category,Obligation,Period,Due Date,Days Until Due,Alert Level,Filed,Penalty/day,Est. Liability";
    const rows = items.map((d) =>
      [d.category, `"${d.obligation}"`, d.period, d.dueDate, d.daysUntilDue,
        d.alertLevel, d.filed ? "Yes" : "No", d.penaltyPerDay ?? 0, d.estimatedLiability ?? 0].join(",")
    );
    const blob = new Blob([[hdr, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "compliance-calendar.csv";
    a.click();
  }

  const totalPenalty = items.filter((d) => !d.filed && d.alertLevel === "overdue")
    .reduce((s, d) => s + estimatedPenalty(d), 0);

  return (
    <>
      <PageHeader
        title="Compliance Calendar"
        subtitle="Statutory due-dates, alerts, and penalty tracking for all obligations."
        actions={
          <div className="flex items-center gap-2">
            {alerts.overdue > 0 && <Badge variant="danger">{alerts.overdue} overdue</Badge>}
            {alerts.dueToday > 0 && <Badge variant="primary">{alerts.dueToday} due today</Badge>}
            {alerts.dueSoon > 0 && <Badge variant="warning">{alerts.dueSoon} due soon</Badge>}
          </div>
        }
      />

      {/* Alert summary strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Overdue", count: alerts.overdue, level: "overdue" as AlertLevel, icon: <AlertTriangle className="size-5" /> },
          { label: "Due today", count: alerts.dueToday, level: "due-today" as AlertLevel, icon: <CalendarClock className="size-5" /> },
          { label: "Due this week", count: alerts.dueSoon, level: "due-soon" as AlertLevel, icon: <Bell className="size-5" /> },
          { label: "On track", count: alerts.ok, level: "ok" as AlertLevel, icon: <CheckCircle2 className="size-5" /> },
        ].map((k) => (
          <Card key={k.label} className={cn("p-3", k.level === "overdue" && alerts.overdue > 0 && "border-red-400")}>
            <div className={cn("flex items-center gap-2", ALERT_COLORS[k.level])}>
              {k.icon}
              <span className="text-2xl font-bold">{k.count}</span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{k.label}</p>
          </Card>
        ))}
      </div>

      {totalPenalty > 0 && (
        <Card className="mb-4 flex items-center gap-3 border-red-400 bg-red-50 dark:bg-red-950/20 p-3">
          <AlertTriangle className="size-5 text-red-500 shrink-0" />
          <div className="text-sm">
            <span className="font-semibold text-red-700 dark:text-red-300">Estimated penalty accumulating: </span>
            <Money value={totalPenalty} className="font-bold text-red-700 dark:text-red-300" />
            <span className="text-muted-foreground ml-1">(based on overdue items and their daily penalty rate)</span>
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {CATEGORIES.map((c) => (
            <Button
              key={c.key}
              size="sm"
              variant={category === c.key ? "primary" : "outline"}
              onClick={() => setCategory(c.key)}
            >
              {c.label}
            </Button>
          ))}
        </div>
        <Button
          size="sm"
          variant={hideCompleted ? "primary" : "outline"}
          onClick={() => setHideCompleted((p) => !p)}
          className="ml-auto"
        >
          {hideCompleted ? "Show completed" : "Hide completed"}
        </Button>
        <Button size="sm" variant="outline" onClick={exportCsv}>
          <Download className="size-4 mr-1" />CSV
        </Button>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Category", "Obligation", "Form", "Period", "Due Date", "Days", "Est. Liability", "Penalty/day", "Accrued Penalty", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <CalendarRow key={d.id} d={d} />
              ))}
              {items.length === 0 && (
                <tr><td colSpan={10} className="py-12 text-center text-muted-foreground">No obligations match the current filter.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function CalendarRow({ d }: { d: DueDate }) {
  const level = d.filed ? "ok" : d.alertLevel;
  const penalty = estimatedPenalty(d);

  return (
    <tr className={cn("border-b border-border/40 hover:bg-muted/20 transition-colors", ALERT_BG[level])}>
      <td className="px-3 py-2.5">
        <Badge variant="default" className="text-[10px]">{d.category}</Badge>
      </td>
      <td className="px-3 py-2.5">
        <p className="font-medium">{d.obligation}</p>
        <p className="text-xs text-muted-foreground">{d.description}</p>
      </td>
      <td className="px-3 py-2.5 font-mono text-xs">{d.form ?? "–"}</td>
      <td className="px-3 py-2.5 text-xs">{d.period}</td>
      <td className="px-3 py-2.5 font-mono text-xs">{d.dueDate}</td>
      <td className={cn("px-3 py-2.5 font-semibold text-right", d.filed ? "text-muted-foreground" : ALERT_COLORS[d.alertLevel])}>
        {d.filed ? "Filed" : d.daysUntilDue === 0 ? "Today" : d.daysUntilDue > 0 ? `+${d.daysUntilDue}d` : `${d.daysUntilDue}d`}
      </td>
      <td className="px-3 py-2.5 text-right">
        {d.estimatedLiability ? <Money value={d.estimatedLiability} /> : "–"}
      </td>
      <td className="px-3 py-2.5 text-right text-xs">
        {d.penaltyPerDay ? `₹${d.penaltyPerDay}/day` : "–"}
      </td>
      <td className="px-3 py-2.5 text-right">
        {penalty > 0 ? <span className="text-red-600 font-medium"><Money value={penalty} /></span> : "–"}
      </td>
      <td className="px-3 py-2.5">
        {d.filed ? (
          <div>
            <Badge variant="success">Filed</Badge>
            {d.filedOn && <p className="text-[10px] text-muted-foreground mt-0.5">{d.filedOn}</p>}
          </div>
        ) : (
          <Badge variant={ALERT_BADGE[d.alertLevel]}>{ALERT_LABELS[d.alertLevel]}</Badge>
        )}
      </td>
    </tr>
  );
}
