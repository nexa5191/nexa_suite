"use client";

import * as React from "react";
import { Plus, Timer, Check, Send, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { useAccess } from "@/components/access/access-provider";
import { useServices } from "@/components/services/services-provider";
import { employeeName } from "@/lib/hr/employees";
import { effectiveBillRate, canBill, accountName } from "@/lib/services/projects";
import { TIMESHEET_STATUS_META, type TimesheetStatus } from "@/lib/services/timesheets";

export function TimesheetsClient() {
  const { projects, assignments, timesheets, wip, logTime, setEntryStatus } = useServices();
  const { canManage } = useAccess();
  const [filter, setFilter] = React.useState<"all" | TimesheetStatus>("all");

  const wipTotal = wip.reduce((s, g) => s + g.amount, 0);
  const wipHours = wip.reduce((s, g) => s + g.hours, 0);
  const pending = timesheets.filter((t) => t.status === "submitted").length;

  const rows = (filter === "all" ? timesheets : timesheets.filter((t) => t.status === filter))
    .slice()
    .sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <PageHeader
        title="Timesheets"
        subtitle="Hours logged against engagements. Approved billable time becomes invoiceable WIP."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Billable WIP" money={wipTotal} />
        <Metric label="WIP hours" value={wipHours.toFixed(1)} />
        <Metric label="Awaiting approval" value={String(pending)} highlight={pending > 0} />
        <Metric label="Engagements with WIP" value={String(wip.length)} />
      </div>

      <LogTimeForm />

      <div className="mb-3 mt-4 flex flex-wrap items-center gap-1">
        {(["all", "draft", "submitted", "approved", "billed"] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              filter === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {k === "all" ? "All" : TIMESHEET_STATUS_META[k].label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Who / Engagement</th>
                <th className="px-4 py-3 font-medium">Work</th>
                <th className="px-4 py-3 text-right font-medium">Hours</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">No entries in this view.</td></tr>
              )}
              {rows.map((t) => {
                const project = projects.find((p) => p.id === t.projectId);
                const rate = effectiveBillRate(project, assignments, t.employeeId);
                const amount = t.billable ? t.hours * rate : 0;
                const meta = TIMESHEET_STATUS_META[t.status];
                return (
                  <tr key={t.id} className="border-b align-top last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">{formatDate(t.date)}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium">{employeeName(t.employeeId)}</p>
                      <p className="text-xs text-muted-foreground">{project?.code} · {accountName(project?.accountId ?? "")}</p>
                    </td>
                    <td className="px-4 py-3 max-w-xs">
                      <p>{t.description}</p>
                      {!t.billable && <Badge variant="outline" className="mt-0.5">Non-billable</Badge>}
                    </td>
                    <td className="px-4 py-3 text-right tabular">{t.hours.toFixed(1)}</td>
                    <td className="px-4 py-3 text-right tabular">{amount > 0 ? <Money value={amount} /> : <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3"><Badge variant={meta.variant}>{meta.label}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {t.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => setEntryStatus(t.id, "submitted")}>
                            <Send className="size-3.5" /> Submit
                          </Button>
                        )}
                        {t.status === "submitted" && (
                          <Button size="sm" variant="outline" disabled={!canManage} onClick={() => setEntryStatus(t.id, "approved", project?.partnerId)}>
                            <Check className="size-3.5" /> Approve
                          </Button>
                        )}
                        {t.status === "approved" && project && !canBill(project) && (
                          <span className="flex items-center gap-1 text-xs text-warning"><AlertTriangle className="size-3.5" /> Blocked by conflict</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function LogTimeForm() {
  const { projects, assignments, logTime } = useServices();
  const [open, setOpen] = React.useState(false);
  const [projectId, setProjectId] = React.useState(projects[0]?.id ?? "");
  const project = projects.find((p) => p.id === projectId);
  const assigned = assignments.filter((a) => a.projectId === projectId);
  const [employeeId, setEmployeeId] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().slice(0, 10));
  const [hours, setHours] = React.useState("");
  const [billable, setBillable] = React.useState(true);
  const [desc, setDesc] = React.useState("");

  React.useEffect(() => {
    if (!projects.length) return;
    if (!projectId) setProjectId(projects[0].id);
  }, [projects, projectId]);
  React.useEffect(() => {
    setEmployeeId(assigned[0]?.employeeId ?? "");
  }, [projectId]); // eslint-disable-line react-hooks/exhaustive-deps

  const valid = projectId && employeeId && Number(hours) > 0 && desc.trim();

  function submit() {
    if (!valid) return;
    logTime({ employeeId, projectId, date, hours: Number(hours), billable, description: desc.trim() });
    setHours(""); setDesc(""); setOpen(false);
  }

  if (!open) {
    return (
      <Button onClick={() => setOpen(true)}><Plus className="size-4" /> Log time</Button>
    );
  }

  return (
    <Card className="p-4">
      <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Timer className="size-4" /> Log time</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Field label="Engagement">
          <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            {projects.map((p) => <option key={p.id} value={p.id}>{p.code} · {p.name}</option>)}
          </Select>
        </Field>
        <Field label="Person">
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
            {assigned.length === 0 && <option value="">No one assigned</option>}
            {assigned.map((a) => <option key={a.employeeId} value={a.employeeId}>{employeeName(a.employeeId)}</option>)}
          </Select>
        </Field>
        <Field label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></Field>
        <Field label="Hours"><Input type="number" min="0" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)} placeholder="0.0" /></Field>
        <Field label="Work done" className="lg:col-span-2"><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="What did you work on?" /></Field>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={billable} onChange={(e) => setBillable(e.target.checked)} className="size-4 rounded border-input" />
          Billable {project && <span className="text-xs text-muted-foreground">· {project.code}</span>}
        </label>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button disabled={!valid} onClick={submit}>Log entry</Button>
        </div>
      </div>
    </Card>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <p className="mb-1 text-xs font-medium text-muted-foreground">{label}</p>
      {children}
    </div>
  );
}

function Metric({ label, value, money, highlight }: { label: string; value?: string; money?: number; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", highlight && "border-warning/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular", highlight && "text-warning")}>
        {money !== undefined ? <Money value={money} compact /> : value}
      </p>
    </Card>
  );
}
