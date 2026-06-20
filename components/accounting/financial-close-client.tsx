"use client";

import * as React from "react";
import Link from "next/link";
import { Lock, LockOpen, CalendarDays, CheckCircle2, Circle, ShieldCheck, ArrowRight, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ENTITIES } from "@/lib/accounting/org";
import { AS_ON } from "@/lib/finance/receivables";
import {
  recentPeriods, statusOf, setPeriodStatus, loadChecklist, saveChecklistFor,
  CLOSE_CHECKLIST, PERIOD_STATUS_META, type PeriodStatus,
} from "@/lib/accounting/period-close";

function monthLabel(period: string): string {
  const [y, m] = period.split("-").map((x) => parseInt(x, 10));
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

export function FinancialCloseClient() {
  const [mounted, setMounted] = React.useState(false);
  const [entityId, setEntityId] = React.useState(ENTITIES[0].id);
  const periods = React.useMemo(() => recentPeriods(AS_ON, 6), []);
  const [period, setPeriod] = React.useState(periods[0]);
  const [tick, setTick] = React.useState(0); // bump to recompute persisted state
  const [checks, setChecks] = React.useState<Record<string, boolean>>({});

  React.useEffect(() => setMounted(true), []);

  const scope = `${entityId}|${period}`;
  React.useEffect(() => {
    if (mounted) setChecks(loadChecklist()[scope] ?? {});
  }, [scope, mounted]);

  const status: PeriodStatus = mounted ? statusOf(entityId, period) : "open";
  const done = CLOSE_CHECKLIST.filter((t) => checks[t.key]).length;
  const pct = Math.round((done / CLOSE_CHECKLIST.length) * 100);

  function toggle(key: string) {
    setChecks((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      saveChecklistFor(scope, next);
      return next;
    });
  }
  function changeStatus(s: PeriodStatus) {
    setPeriodStatus(entityId, period, s);
    setTick((t) => t + 1);
  }

  return (
    <>
      <PageHeader
        title="Financial Close"
        subtitle="Open, soft-close and lock accounting periods. A locked period rejects new postings."
        actions={
          <Select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="h-9 w-52">
            {ENTITIES.map((en) => <option key={en.id} value={en.id}>{en.name}</option>)}
          </Select>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        {/* Period list */}
        <div className="space-y-2">
          {periods.map((p) => {
            const st = mounted ? statusOf(entityId, p) : "open";
            const meta = PERIOD_STATUS_META[st];
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  "flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors",
                  period === p ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30" : "hover:bg-accent/40",
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  <CalendarDays className="size-4 text-muted-foreground" /> {monthLabel(p)}
                </span>
                <Badge variant={meta.tone}>{st === "locked" ? <Lock className="size-3" /> : null} {meta.label}</Badge>
              </button>
            );
          })}
          {/* tick keeps lint happy and forces re-eval of statuses after a change */}
          <span className="hidden">{tick}</span>
        </div>

        {/* Selected period */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-lg font-bold">{monthLabel(period)}</p>
                <p className="text-sm text-muted-foreground">{ENTITIES.find((e) => e.id === entityId)?.name}</p>
              </div>
              <Badge variant={PERIOD_STATUS_META[status].tone} className="h-7 px-3">
                {status === "locked" ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />} {PERIOD_STATUS_META[status].label}
              </Badge>
            </div>

            {status === "locked" && (
              <div className="mt-3 flex items-center gap-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
                <Lock className="size-4" /> Period locked — new journal entries dated in {period} are rejected on posting.
              </div>
            )}

            {/* Progress */}
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>Close checklist</span><span>{done}/{CLOSE_CHECKLIST.length} · {pct}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-success" : "bg-primary")} style={{ width: `${pct}%` }} />
              </div>
            </div>

            {/* Status actions */}
            <div className="mt-4 flex flex-wrap gap-2 border-t pt-4">
              {status !== "open" && <Button variant="outline" size="sm" onClick={() => changeStatus("open")}><LockOpen className="size-4" /> Reopen</Button>}
              {status === "open" && <Button variant="outline" size="sm" onClick={() => changeStatus("soft-closed")}><ShieldCheck className="size-4" /> Soft-close</Button>}
              {status !== "locked" && (
                <Button size="sm" onClick={() => changeStatus("locked")} disabled={pct < 100}>
                  <Lock className="size-4" /> Lock period
                </Button>
              )}
              {pct < 100 && status !== "locked" && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle className="size-3.5 text-warning" /> Complete the checklist to lock</span>
              )}
            </div>
          </Card>

          {/* Checklist */}
          <Card className="overflow-hidden">
            <div className="border-b px-5 py-3 text-sm font-semibold">Month-end checklist</div>
            <ul className="divide-y">
              {CLOSE_CHECKLIST.map((t) => {
                const ok = !!checks[t.key];
                return (
                  <li key={t.key} className="flex items-center gap-3 px-5 py-3">
                    <button onClick={() => toggle(t.key)} aria-label={t.label} disabled={status === "locked"}>
                      {ok ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5 text-muted-foreground/40" />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-medium", ok && "text-muted-foreground line-through")}>{t.label}</p>
                    </div>
                    <Badge variant="outline" className="text-[10px]">{t.module}</Badge>
                    <Link href={t.href} className="text-muted-foreground hover:text-primary"><ArrowRight className="size-4" /></Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </>
  );
}
