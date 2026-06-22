"use client";

import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { MCA_FILINGS, AGM_SCHEDULE, BOARD_MEETINGS, mcaFilingsByStatus, type McaFilingStatus } from "@/lib/compliance/mca";
import { CheckCircle2, AlertTriangle, Clock, Users, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_META: Record<McaFilingStatus, { label: string; variant: "success" | "warning" | "danger" | "default" | "primary"; icon: React.ReactNode }> = {
  filed: { label: "Filed", variant: "success", icon: <CheckCircle2 className="size-3.5" /> },
  prepared: { label: "Prepared", variant: "primary", icon: <Clock className="size-3.5" /> },
  pending: { label: "Pending", variant: "warning", icon: <Clock className="size-3.5" /> },
  overdue: { label: "Overdue", variant: "danger", icon: <AlertTriangle className="size-3.5" /> },
  "not-due": { label: "Not due", variant: "default", icon: <Clock className="size-3.5" /> },
};

export function McaClient() {
  const byStatus = mcaFilingsByStatus();
  const totalFilings = MCA_FILINGS.length;
  const filed = byStatus.filed.length;
  const overdue = byStatus.overdue.length;
  const pending = byStatus.pending.length + byStatus.prepared.length;

  return (
    <>
      <PageHeader
        title="ROC / MCA Compliance"
        subtitle="Companies Act 2013 — filing register, AGM schedule, board meetings."
        actions={
          <div className="flex gap-2">
            {overdue > 0 && <Badge variant="danger">{overdue} overdue</Badge>}
            <Badge variant="default">{filed}/{totalFilings} filed</Badge>
          </div>
        }
      />

      {/* Summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Filings (FY)", count: totalFilings, icon: <Calendar className="size-5 text-primary" /> },
          { label: "Filed", count: filed, icon: <CheckCircle2 className="size-5 text-emerald-500" /> },
          { label: "Pending / Prepared", count: pending, icon: <Clock className="size-5 text-amber-500" /> },
          { label: "Overdue", count: overdue, icon: <AlertTriangle className="size-5 text-red-500" /> },
        ].map((k) => (
          <Card key={k.label} className={cn("p-3", k.label === "Overdue" && overdue > 0 && "border-red-400 bg-red-50/50 dark:bg-red-950/10")}>
            <div className="flex items-center gap-2">{k.icon}<span className="text-2xl font-bold">{k.count}</span></div>
            <p className="mt-1 text-xs text-muted-foreground">{k.label}</p>
          </Card>
        ))}
      </div>

      {/* Filings table */}
      <Card className="mb-4 overflow-hidden">
        <div className="border-b px-4 py-3 font-semibold text-sm">MCA Filing Register — FY 2025-26</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Form", "Description", "Trigger", "Due Date", "Fee", "Status", "SRN / Notes"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {MCA_FILINGS.map((f) => {
                const today = "2026-06-22";
                const isOverdue = !f.filedOn && f.dueDate < today;
                const meta = STATUS_META[isOverdue ? "overdue" : f.status];
                return (
                  <tr key={f.id} className={cn("border-b border-border/40 hover:bg-muted/20", isOverdue && "bg-red-50/30 dark:bg-red-950/10")}>
                    <td className="px-3 py-2.5 font-mono font-semibold text-sm">{f.form}</td>
                    <td className="px-3 py-2.5 max-w-[200px]">
                      <p className="font-medium">{f.description}</p>
                      {f.period && <p className="text-xs text-muted-foreground">{f.period}</p>}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground max-w-[160px]">{f.trigger}</td>
                    <td className="px-3 py-2.5 font-mono text-xs">{f.dueDate}</td>
                    <td className="px-3 py-2.5 text-right">
                      {f.fee > 0 ? <Money value={f.fee} /> : "Nil"}
                      {f.additionalFee && <p className="text-[10px] text-muted-foreground">+₹{f.additionalFee}/day late</p>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={meta.variant} className="flex w-fit items-center gap-1">
                        {meta.icon}{meta.label}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs">
                      {f.srn && <p className="font-mono text-emerald-600">SRN: {f.srn}</p>}
                      {f.filedOn && <p className="text-emerald-600">Filed: {f.filedOn}</p>}
                      {f.remarks && <p className="text-muted-foreground">{f.remarks}</p>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* AGM Schedule */}
      <Card className="mb-4 p-4">
        <p className="font-semibold text-sm mb-3 flex items-center gap-2"><Users className="size-4" />AGM Schedule — FY 2025-26</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div><p className="text-xs text-muted-foreground">Last day for AGM</p><p className="font-semibold">{AGM_SCHEDULE.lastDayForAgm}</p></div>
          <div><p className="text-xs text-muted-foreground">Notice period required</p><p className="font-semibold">{AGM_SCHEDULE.noticeRequired} clear days</p></div>
          <div>
            <p className="text-xs text-muted-foreground">Audit report ready</p>
            <Badge variant={AGM_SCHEDULE.auditReportReady ? "success" : "warning"}>
              {AGM_SCHEDULE.auditReportReady ? "Yes" : "Pending"}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Board approved FS</p>
            <Badge variant={AGM_SCHEDULE.boardApprovedFs ? "success" : "warning"}>
              {AGM_SCHEDULE.boardApprovedFs ? "Yes" : "Pending"}
            </Badge>
          </div>
        </div>
      </Card>

      {/* Board Meetings */}
      <Card className="overflow-hidden">
        <div className="border-b px-4 py-3 font-semibold text-sm">Board / AGM Meetings</div>
        <div className="divide-y">
          {BOARD_MEETINGS.map((m, i) => (
            <div key={i} className="px-4 py-3">
              <div className="flex items-center gap-3 mb-2">
                <Badge variant={m.type === "agm" ? "primary" : "default"}>{m.type.toUpperCase()}</Badge>
                <span className="font-medium text-sm">{m.date}</span>
                <div className="ml-auto flex gap-2">
                  <Badge variant={m.quorum ? "success" : "warning"}>{m.quorum ? "Quorum met" : "Quorum TBD"}</Badge>
                  <Badge variant={m.minutes ? "success" : "warning"}>{m.minutes ? "Minutes signed" : "Minutes pending"}</Badge>
                </div>
              </div>
              <ul className="list-disc list-inside text-xs text-muted-foreground space-y-0.5">
                {m.agenda.map((a, j) => <li key={j}>{a}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
