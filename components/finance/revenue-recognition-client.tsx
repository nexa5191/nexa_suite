"use client";

import * as React from "react";
import { TrendingUp, Hourglass, FileText, CalendarClock, Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { downloadCsv } from "@/lib/export";
import { revLines, revSummary, forwardSchedule, AS_ON } from "@/lib/finance/revenue-recognition";

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "short", year: "2-digit" });
}

const STATUS_TONE = { "in-progress": "primary", completed: "success", "not-started": "default" } as const;

export function RevenueRecognitionClient() {
  const lines = revLines(AS_ON);
  const summary = revSummary(AS_ON);
  const schedule = forwardSchedule(AS_ON, 6);
  const maxSched = Math.max(1, ...schedule.map((s) => s.amount));

  function exportCsv() {
    downloadCsv("revenue-recognition", ["Customer", "Contract", "Method", "Contract value", "Recognised", "Deferred", "% complete"],
      lines.map((l) => [l.contract.customer, l.contract.name, l.contract.method, l.contract.total, l.recognized, l.deferred, `${Math.round(l.pctComplete * 100)}%`]));
  }

  return (
    <>
      <PageHeader
        title="Revenue Recognition"
        subtitle={`Ind AS 115 — recognise revenue as obligations are met, not when billed · as on ${formatDate(AS_ON)}`}
        actions={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileText} label="Contract value" value={summary.totalContractValue} />
        <Stat icon={TrendingUp} label="Recognised to date" value={summary.recognizedToDate} tone="success" />
        <Stat icon={Hourglass} label="Deferred revenue" value={summary.deferredBalance} tone="warning" highlight />
        <Stat icon={CalendarClock} label="Recognised this month" value={summary.thisMonth} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        {/* Contracts */}
        <Card className="overflow-hidden">
          <div className="border-b px-5 py-3 text-sm font-semibold">Performance obligations</div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Contract</th>
                  <th className="px-4 py-3 font-medium">Method</th>
                  <th className="px-4 py-3 text-right font-medium">Value</th>
                  <th className="px-4 py-3 text-right font-medium">Recognised</th>
                  <th className="px-4 py-3 text-right font-medium">Deferred</th>
                  <th className="px-4 py-3 font-medium">Progress</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.contract.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{l.contract.customer}</div>
                      <div className="text-[11px] text-muted-foreground">{l.contract.name}</div>
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={STATUS_TONE[l.status]} className="text-[10px] capitalize">{l.contract.method}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular"><Money value={l.contract.total} /></td>
                    <td className="px-4 py-2.5 text-right tabular text-success"><Money value={l.recognized} /></td>
                    <td className="px-4 py-2.5 text-right tabular text-warning"><Money value={l.deferred} /></td>
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.round(l.pctComplete * 100)}%` }} />
                        </div>
                        <span className="text-xs tabular text-muted-foreground">{Math.round(l.pctComplete * 100)}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Forward schedule */}
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Revenue to be recognised</p>
          <div className="space-y-2">
            {schedule.map((s) => (
              <div key={s.month} className="flex items-center gap-2">
                <span className="w-12 text-xs text-muted-foreground">{monthLabel(s.month)}</span>
                <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                  <div className="flex h-full items-center rounded bg-primary/70 px-1.5" style={{ width: `${Math.max(6, (s.amount / maxSched) * 100)}%` }} />
                </div>
                <span className="w-20 text-right text-xs tabular"><Money value={s.amount} compact /></span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Next 6 months of scheduled recognition from current contracts.</p>
        </Card>
      </div>
    </>
  );
}

function Stat({ icon: Icon, label, value, tone, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone?: "success" | "warning"; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", highlight && "border-warning/30 bg-warning/5")}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className={cn("size-3.5", tone === "success" && "text-success", tone === "warning" && "text-warning")} /> {label}
      </p>
      <p className={cn("mt-1 text-xl font-bold tabular", tone === "success" && "text-success", tone === "warning" && "text-warning")}><Money value={value} /></p>
    </Card>
  );
}
