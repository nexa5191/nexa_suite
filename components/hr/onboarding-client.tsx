"use client";

import * as React from "react";
import {
  UserPlus, UserMinus, CalendarDays, Briefcase, AlertTriangle, Check,
  CircleCheck, Circle, type LucideIcon,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { departmentName } from "@/lib/hr/employees";
import {
  journeysFor, onboardingSummary, journeyProgress, journeyOverdueCount,
  resolveDone, taskDueDate, isOverdue,
  type JourneyKind, type OnboardingJourney, type ChecklistTask, type TaskOwner,
} from "@/lib/hr/onboarding";

const STORE_KEY = "nexa-onboarding";

type Overrides = Record<string, Record<string, boolean>>;

const OWNER_TONE: Record<TaskOwner, "default" | "primary" | "success" | "warning" | "danger"> = {
  HR: "primary",
  IT: "warning",
  Manager: "success",
  Finance: "danger",
  Employee: "default",
};

const KIND_META: Record<JourneyKind, { label: string; icon: LucideIcon }> = {
  onboarding: { label: "Onboarding", icon: UserPlus },
  offboarding: { label: "Offboarding", icon: UserMinus },
};

export function OnboardingClient() {
  const [overrides, setOverrides] = React.useState<Overrides>({});
  const [kind, setKind] = React.useState<JourneyKind>("onboarding");
  const [selectedId, setSelectedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) setOverrides(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  function toggleTask(journeyId: string, taskId: string, next: boolean) {
    setOverrides((prev) => {
      const journeyOverrides = { ...(prev[journeyId] ?? {}), [taskId]: next };
      const merged = { ...prev, [journeyId]: journeyOverrides };
      try { localStorage.setItem(STORE_KEY, JSON.stringify(merged)); } catch { /* ignore */ }
      return merged;
    });
  }

  const journeys = journeysFor(kind);
  const summary = onboardingSummary(overrides);

  // Keep selection valid for the active tab; default to first.
  const selected =
    journeys.find((j) => j.id === selectedId) ?? journeys[0] ?? null;

  function selectKind(k: JourneyKind) {
    setKind(k);
    setSelectedId(journeysFor(k)[0]?.id ?? null);
  }

  return (
    <>
      <PageHeader
        title="Onboarding & Offboarding"
        subtitle="Standard joiner and leaver checklists with owners, due dates and progress."
      />

      {/* Summary cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={UserPlus} label="In onboarding" value={summary.onboardingInProgress} tone="primary" />
        <SummaryCard icon={UserMinus} label="In offboarding" value={summary.offboardingInProgress} tone="default" />
        <SummaryCard icon={AlertTriangle} label="Tasks overdue" value={summary.overdueTasks} tone="danger" />
        <SummaryCard icon={CircleCheck} label="Avg completion" value={`${summary.completionPct}%`} tone="success" />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {(Object.keys(KIND_META) as JourneyKind[]).map((k) => {
          const Icon = KIND_META[k].icon;
          const count = journeysFor(k).length;
          return (
            <button
              key={k}
              onClick={() => selectKind(k)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                k === kind ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-4" /> {KIND_META[k].label}
              <span className={cn(
                "rounded-full px-1.5 text-[11px] tabular",
                k === kind ? "bg-primary-foreground/20" : "bg-muted",
              )}>{count}</span>
            </button>
          );
        })}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* People list */}
        <div className="space-y-2 lg:col-span-1">
          {journeys.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              No one in {KIND_META[kind].label.toLowerCase()} right now.
            </Card>
          )}
          {journeys.map((j) => (
            <PersonRow
              key={j.id}
              journey={j}
              overrides={overrides[j.id]}
              active={selected?.id === j.id}
              onClick={() => setSelectedId(j.id)}
            />
          ))}
        </div>

        {/* Checklist */}
        <div className="lg:col-span-2">
          {selected ? (
            <Checklist
              journey={selected}
              overrides={overrides[selected.id]}
              onToggle={(taskId, next) => toggleTask(selected.id, taskId, next)}
            />
          ) : (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Select a person to view their checklist.
            </Card>
          )}
        </div>
      </div>
    </>
  );
}

// ---- People list row ------------------------------------------------------

function PersonRow({
  journey, overrides, active, onClick,
}: {
  journey: OnboardingJourney;
  overrides?: Record<string, boolean>;
  active: boolean;
  onClick: () => void;
}) {
  const pct = journeyProgress(journey, overrides);
  const overdue = journeyOverdueCount(journey, overrides);
  const e = journey.employee;
  const dateLabel = journey.kind === "onboarding" ? "Joined" : "Exit";

  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent/50",
        active && "border-primary/50 ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {e.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{e.name}</p>
          <p className="truncate text-xs text-muted-foreground">{e.designation}</p>
        </div>
        {pct === 100 ? (
          <Badge variant="success" className="text-[10px]"><Check className="size-3" /> Done</Badge>
        ) : overdue > 0 ? (
          <Badge variant="danger" className="text-[10px]">{overdue} overdue</Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] tabular">{pct}%</Badge>
        )}
      </div>

      <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", pct === 100 ? "bg-success" : "bg-primary")}
          style={{ width: `${pct}%` }}
        />
      </div>

      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><CalendarDays className="size-3" /> {dateLabel} {formatDate(journey.anchorDate)}</span>
        <span className="flex items-center gap-1"><Briefcase className="size-3" /> {departmentName(e.departmentId)}</span>
      </div>
    </button>
  );
}

// ---- Checklist panel ------------------------------------------------------

function Checklist({
  journey, overrides, onToggle,
}: {
  journey: OnboardingJourney;
  overrides?: Record<string, boolean>;
  onToggle: (taskId: string, next: boolean) => void;
}) {
  const done = resolveDone(journey, overrides);
  const pct = journeyProgress(journey, overrides);
  const overdue = journeyOverdueCount(journey, overrides);
  const e = journey.employee;
  const KindIcon = KIND_META[journey.kind].icon;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2">
            <KindIcon className="size-4 text-primary" />
            {e.name} · {KIND_META[journey.kind].label}
          </CardTitle>
          <div className="flex items-center gap-3">
            {overdue > 0 && <Badge variant="danger" className="text-[10px]"><AlertTriangle className="size-3" /> {overdue} overdue</Badge>}
            <ProgressRing pct={pct} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          {e.designation} · {departmentName(e.departmentId)} ·{" "}
          {journey.kind === "onboarding" ? "Joined" : "Exit"} {formatDate(journey.anchorDate)}
        </p>
      </CardHeader>
      <CardContent>
        <ol className="relative space-y-3 border-l pl-5">
          {journey.tasks.map((t) => {
            const isDone = done.has(t.id);
            const overdueTask = isOverdue(journey.anchorDate, t, isDone);
            return (
              <TaskRow
                key={t.id}
                task={t}
                anchorDate={journey.anchorDate}
                done={isDone}
                overdue={overdueTask}
                onToggle={() => onToggle(t.id, !isDone)}
              />
            );
          })}
        </ol>
      </CardContent>
    </Card>
  );
}

function TaskRow({
  task, anchorDate, done, overdue, onToggle,
}: {
  task: ChecklistTask;
  anchorDate: string;
  done: boolean;
  overdue: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="relative">
      <span className={cn(
        "absolute -left-[27px] flex size-5 items-center justify-center rounded-full ring-4 ring-card",
        done ? "bg-success/15 text-success" : overdue ? "bg-danger/15 text-danger" : "bg-muted text-muted-foreground",
      )}>
        {done ? <CircleCheck className="size-3" /> : <Circle className="size-3" />}
      </span>

      <div className="flex items-start gap-3">
        <button
          onClick={onToggle}
          role="checkbox"
          aria-checked={done}
          aria-label={`Mark "${task.label}" ${done ? "incomplete" : "complete"}`}
          className={cn(
            "mt-0.5 flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
            done ? "border-success bg-success text-success-foreground" : "border-input hover:border-primary",
          )}
        >
          {done && <Check className="size-3" />}
        </button>

        <div className="min-w-0 flex-1">
          <p className={cn("text-sm font-medium", done && "text-muted-foreground line-through")}>{task.label}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px]">
            <Badge variant={OWNER_TONE[task.owner]} className="text-[10px]">{task.owner}</Badge>
            <span className={cn("flex items-center gap-1", overdue ? "font-medium text-danger" : "text-muted-foreground")}>
              <CalendarDays className="size-3" /> Due {formatDate(taskDueDate(anchorDate, task))}
              {overdue && " · overdue"}
            </span>
          </div>
        </div>
      </div>
    </li>
  );
}

// ---- Bits -----------------------------------------------------------------

function ProgressRing({ pct }: { pct: number }) {
  const r = 14;
  const c = 2 * Math.PI * r;
  const dash = (pct / 100) * c;
  const complete = pct === 100;
  return (
    <span className="relative flex size-9 items-center justify-center">
      <svg viewBox="0 0 36 36" className="size-9 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3" className="stroke-muted" />
        <circle
          cx="18" cy="18" r={r} fill="none" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
          className={cn(complete ? "stroke-success" : "stroke-primary")}
        />
      </svg>
      <span className="absolute text-[10px] font-bold tabular">{pct}</span>
    </span>
  );
}

function SummaryCard({
  icon: Icon, label, value, tone,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  tone: "default" | "primary" | "success" | "danger";
}) {
  const toneCls: Record<typeof tone, string> = {
    default: "text-muted-foreground",
    primary: "text-primary",
    success: "text-success",
    danger: "text-danger",
  };
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className={cn("size-4", toneCls[tone])} />
      </div>
      <p className={cn("mt-1 text-2xl font-bold tabular", toneCls[tone])}>{value}</p>
    </Card>
  );
}
