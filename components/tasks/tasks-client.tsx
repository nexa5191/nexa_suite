"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus, X, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useNewIntent } from "@/lib/commands/new-intent";
import { EMPLOYEES, employeeName } from "@/lib/hr/employees";
import {
  FIRM_TASKS,
  TASK_STATUSES,
  PROJECTS,
  loadTaskStatuses,
  saveTaskStatuses,
  type FirmTask,
  type TaskStatus,
  type TaskPriority,
} from "@/lib/tasks";

const PRIORITY_TONE: Record<TaskPriority, "default" | "primary" | "warning" | "danger"> = {
  low: "default",
  medium: "primary",
  high: "warning",
  urgent: "danger",
};
const STATUS_INDEX = TASK_STATUSES.map((s) => s.key);

export function TasksClient() {
  const [overrides, setOverrides] = React.useState<Record<string, TaskStatus>>({});
  const [added, setAdded] = React.useState<FirmTask[]>([]);
  const [assignee, setAssignee] = React.useState("all");
  const [project, setProject] = React.useState("all");
  const [showAdd, setShowAdd] = React.useState(false);
  // Defer localStorage-backed lists until after mount so server and initial
  // client renders match (both empty), preventing a hydration mismatch.
  const [employees, setEmployees] = React.useState<typeof EMPLOYEES>([]);
  useNewIntent(() => setShowAdd(true));

  React.useEffect(() => {
    setOverrides(loadTaskStatuses());
    setEmployees(EMPLOYEES);
  }, []);

  const allTasks = React.useMemo(() => [...added, ...FIRM_TASKS], [added]);
  const statusOf = (t: FirmTask): TaskStatus => overrides[t.id] ?? t.status;

  function move(t: FirmTask, dir: -1 | 1) {
    const idx = STATUS_INDEX.indexOf(statusOf(t));
    const next = STATUS_INDEX[idx + dir];
    if (!next) return;
    setOverrides((prev) => {
      const merged = { ...prev, [t.id]: next };
      saveTaskStatuses(merged);
      return merged;
    });
  }

  const filtered = allTasks.filter((t) => {
    if (assignee !== "all" && t.assigneeId !== assignee) return false;
    if (project !== "all" && t.project !== project) return false;
    return true;
  });

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Track work across the firm — move cards through the board."
        actions={<Button size="sm" onClick={() => setShowAdd((s) => !s)}><Plus className="size-3.5" /> New task</Button>}
      />

      {showAdd && <AddTask onAdd={(t) => { setAdded((p) => [t, ...p]); setShowAdd(false); }} onCancel={() => setShowAdd(false)} count={added.length} />}

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <span className="text-xs font-medium text-muted-foreground">Filter</span>
        <Select value={assignee} onChange={(e) => setAssignee(e.target.value)} className="h-8 w-48">
          <option value="all">All assignees</option>
          {employees.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
        </Select>
        <Select value={project} onChange={(e) => setProject(e.target.value)} className="h-8 w-44">
          <option value="all">All projects</option>
          {PROJECTS.map((p) => (<option key={p} value={p}>{p}</option>))}
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} tasks</span>
      </Card>

      <div className="grid gap-3 lg:grid-cols-4">
        {TASK_STATUSES.map((col) => {
          const cards = filtered.filter((t) => statusOf(t) === col.key);
          return (
            <div key={col.key} className="rounded-lg border bg-muted/30">
              <div className="flex items-center justify-between border-b px-3 py-2.5">
                <p className="text-sm font-semibold">{col.label}</p>
                <Badge variant="default">{cards.length}</Badge>
              </div>
              <div className="space-y-2 p-2">
                {cards.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted-foreground">No tasks</p>}
                {cards.map((t) => {
                  const idx = STATUS_INDEX.indexOf(col.key);
                  const overdue = statusOf(t) !== "done" && t.dueDate < "2026-06-05";
                  return (
                    <Card key={t.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{t.title}</p>
                        <Badge variant={PRIORITY_TONE[t.priority]} className="shrink-0 capitalize">{t.priority}</Badge>
                      </div>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{t.project}</span>
                        <span className={cn("flex items-center gap-1 text-[11px]", overdue ? "text-danger" : "text-muted-foreground")}>
                          <CalendarClock className="size-3" /> {formatDate(t.dueDate, { year: undefined })}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t pt-2">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Avatar name={employeeName(t.assigneeId)} /> {employeeName(t.assigneeId)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button onClick={() => move(t, -1)} disabled={idx === 0} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30" title="Move left">
                            <ChevronLeft className="size-4" />
                          </button>
                          <button onClick={() => move(t, 1)} disabled={idx === STATUS_INDEX.length - 1} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30" title="Move right">
                            <ChevronRight className="size-4" />
                          </button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  return <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">{initials}</span>;
}

function AddTask({ onAdd, onCancel, count }: { onAdd: (t: FirmTask) => void; onCancel: () => void; count: number }) {
  const [title, setTitle] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState("emp-006");
  const [project, setProject] = React.useState(PROJECTS[0]);
  const [priority, setPriority] = React.useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = React.useState("");

  const valid = !!title.trim() && !!dueDate;
  function submit() {
    if (!valid) return;
    onAdd({
      id: `task-local-${count + 1}`,
      title: title.trim(),
      description: "",
      assigneeId,
      createdById: "emp-001",
      status: "todo",
      priority,
      dueDate,
      project,
      createdOn: "2026-06-05",
    });
  }

  return (
    <Card className="mb-4 border-primary/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">New task</p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="block sm:col-span-2"><Label className="mb-1.5 block">Title</Label><Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" /></label>
        <label className="block"><Label className="mb-1.5 block">Assignee</Label>
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>{EMPLOYEES.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}</Select>
        </label>
        <label className="block"><Label className="mb-1.5 block">Project</Label>
          <Select value={project} onChange={(e) => setProject(e.target.value)}>{PROJECTS.map((p) => (<option key={p} value={p}>{p}</option>))}</Select>
        </label>
        <label className="block"><Label className="mb-1.5 block">Priority</Label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => (<option key={p} value={p} className="capitalize">{p}</option>))}
          </Select>
        </label>
        <label className="block"><Label className="mb-1.5 block">Due date</Label><Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={!valid} onClick={submit}>Add task</Button>
      </div>
    </Card>
  );
}
