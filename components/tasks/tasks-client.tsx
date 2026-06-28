"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight, Plus, X, CalendarClock, RefreshCw } from "lucide-react";
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
  loadUserTasks,
  saveUserTasks,
  spawnDueRecurrences,
  type FirmTask,
  type TaskStatus,
  type TaskPriority,
  type Recurrence,
} from "@/lib/tasks";

const PRIORITY_TONE: Record<TaskPriority, "default" | "primary" | "warning" | "danger"> = {
  low: "default",
  medium: "primary",
  high: "warning",
  urgent: "danger",
};
const STATUS_INDEX = TASK_STATUSES.map((s) => s.key);
const todayStr = () => new Date().toISOString().slice(0, 10);

export function TasksClient() {
  const [overrides, setOverrides] = React.useState<Record<string, TaskStatus>>({});
  const [userTasks, setUserTasks] = React.useState<FirmTask[]>([]);
  const [assignee, setAssignee] = React.useState("all");
  const [project, setProject] = React.useState("all");
  const [showAdd, setShowAdd] = React.useState(false);
  const [employees, setEmployees] = React.useState<typeof EMPLOYEES>([]);
  useNewIntent(() => setShowAdd(true));

  React.useEffect(() => {
    setOverrides(loadTaskStatuses());
    setEmployees(EMPLOYEES);

    const loaded = loadUserTasks();
    const today = todayStr();
    const spawned = spawnDueRecurrences(loaded, today);
    const merged = spawned.length ? [...loaded, ...spawned] : loaded;
    if (spawned.length) saveUserTasks(merged);
    setUserTasks(merged);
  }, []);

  const allTasks = React.useMemo(() => [...userTasks, ...FIRM_TASKS], [userTasks]);
  const statusOf = (t: FirmTask): TaskStatus => overrides[t.id] ?? t.status;

  function move(t: FirmTask, dir: -1 | 1) {
    const idx = STATUS_INDEX.indexOf(statusOf(t));
    const nextStatus = STATUS_INDEX[idx + dir] as TaskStatus;
    if (!nextStatus) return;

    setOverrides((prev) => {
      const merged = { ...prev, [t.id]: nextStatus };
      saveTaskStatuses(merged);
      return merged;
    });

    // When a recurring task is marked done, force-spawn the next occurrence.
    if (nextStatus === "done" && t.recurrence && t.recurrence !== "none" && t.recurringGroupId) {
      setUserTasks((prev) => {
        const today = todayStr();
        const spawned = spawnDueRecurrences(prev, today, true);
        if (!spawned.length) return prev;
        const updated = [...prev, ...spawned];
        saveUserTasks(updated);
        return updated;
      });
    }
  }

  function addTask(t: FirmTask) {
    setUserTasks((prev) => {
      const updated = [t, ...prev];
      saveUserTasks(updated);
      return updated;
    });
    setShowAdd(false);
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

      {showAdd && (
        <AddTask
          onAdd={addTask}
          onCancel={() => setShowAdd(false)}
          count={userTasks.length}
          employees={employees}
        />
      )}

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
                {cards.length === 0 && (
                  <p className="px-2 py-6 text-center text-xs text-muted-foreground">No tasks</p>
                )}
                {cards.map((t) => {
                  const colIdx = STATUS_INDEX.indexOf(col.key);
                  const overdue = statusOf(t) !== "done" && t.dueDate < todayStr();
                  const isRecurring = t.recurrence && t.recurrence !== "none";
                  return (
                    <Card key={t.id} className="p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{t.title}</p>
                        <Badge variant={PRIORITY_TONE[t.priority]} className="shrink-0 capitalize">
                          {t.priority}
                        </Badge>
                      </div>
                      {t.description && (
                        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.description}</p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                          {t.project}
                        </span>
                        {isRecurring && (
                          <span className="flex items-center gap-0.5 rounded-full bg-violet-500/10 px-2 py-0.5 text-[10px] font-medium text-violet-600 dark:text-violet-400 capitalize">
                            <RefreshCw className="size-2.5" /> {t.recurrence}
                            {(t.advanceDays ?? 0) > 0 && ` · ${t.advanceDays}d early`}
                          </span>
                        )}
                        <span className={cn(
                          "flex items-center gap-1 text-[11px]",
                          overdue ? "text-danger" : "text-muted-foreground",
                        )}>
                          <CalendarClock className="size-3" />
                          {formatDate(t.dueDate, { year: undefined })}
                        </span>
                      </div>
                      <div className="mt-2 flex items-center justify-between border-t pt-2">
                        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Avatar name={employeeName(t.assigneeId)} />
                          {employeeName(t.assigneeId)}
                        </span>
                        <div className="flex items-center gap-0.5">
                          <button
                            onClick={() => move(t, -1)}
                            disabled={colIdx === 0}
                            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
                            title="Move left"
                          >
                            <ChevronLeft className="size-4" />
                          </button>
                          <button
                            onClick={() => move(t, 1)}
                            disabled={colIdx === STATUS_INDEX.length - 1}
                            className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-accent disabled:opacity-30"
                            title="Move right"
                          >
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
  return (
    <span className="flex size-5 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary">
      {initials}
    </span>
  );
}

function AddTask({
  onAdd, onCancel, count, employees,
}: {
  onAdd: (t: FirmTask) => void;
  onCancel: () => void;
  count: number;
  employees: typeof EMPLOYEES;
}) {
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [assigneeId, setAssigneeId] = React.useState(employees[0]?.id ?? "");
  const [project, setProject] = React.useState(PROJECTS[0]);
  const [priority, setPriority] = React.useState<TaskPriority>("medium");
  const [dueDate, setDueDate] = React.useState("");
  const [recurrence, setRecurrence] = React.useState<Recurrence>("none");
  const [advanceDays, setAdvanceDays] = React.useState(0);

  const valid = !!title.trim() && !!dueDate;

  function submit() {
    if (!valid) return;
    const isRecurring = recurrence !== "none";
    const groupId = isRecurring ? `grp-${Date.now()}` : undefined;
    onAdd({
      id: `task-user-${count + 1}-${Date.now()}`,
      title: title.trim(),
      description: description.trim(),
      assigneeId: assigneeId || (employees[0]?.id ?? ""),
      createdById: "emp-001",
      status: "todo",
      priority,
      dueDate,
      project,
      createdOn: todayStr(),
      recurrence: isRecurring ? recurrence : undefined,
      advanceDays: isRecurring ? advanceDays : undefined,
      recurringGroupId: groupId,
    });
  }

  return (
    <Card className="mb-4 border-primary/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-semibold">New task</p>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className="block sm:col-span-2 lg:col-span-1">
          <Label className="mb-1.5 block">Title</Label>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" />
        </label>
        <label className="block sm:col-span-2 lg:col-span-2">
          <Label className="mb-1.5 block">Description</Label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional details…" />
        </label>

        <label className="block">
          <Label className="mb-1.5 block">Assignee</Label>
          <Select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            {employees.map((e) => (<option key={e.id} value={e.id}>{e.name}</option>))}
          </Select>
        </label>
        <label className="block">
          <Label className="mb-1.5 block">Project</Label>
          <Select value={project} onChange={(e) => setProject(e.target.value)}>
            {PROJECTS.map((p) => (<option key={p} value={p}>{p}</option>))}
          </Select>
        </label>
        <label className="block">
          <Label className="mb-1.5 block">Priority</Label>
          <Select value={priority} onChange={(e) => setPriority(e.target.value as TaskPriority)}>
            {(["low", "medium", "high", "urgent"] as TaskPriority[]).map((p) => (
              <option key={p} value={p} className="capitalize">{p}</option>
            ))}
          </Select>
        </label>

        <label className="block">
          <Label className="mb-1.5 block">Due date</Label>
          <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
        </label>
        <label className="block">
          <Label className="mb-1.5 block">Repeat</Label>
          <Select value={recurrence} onChange={(e) => setRecurrence(e.target.value as Recurrence)}>
            <option value="none">No repeat</option>
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
            <option value="yearly">Yearly</option>
          </Select>
        </label>
        {recurrence !== "none" && (
          <label className="block">
            <Label className="mb-1.5 block">Create next task early (days)</Label>
            <Input
              type="number"
              min={0}
              max={365}
              value={advanceDays}
              onChange={(e) => setAdvanceDays(Math.max(0, parseInt(e.target.value) || 0))}
              placeholder="0 = only when this one is closed"
            />
          </label>
        )}
      </div>

      {recurrence !== "none" && (
        <p className="mt-2 text-xs text-muted-foreground">
          {advanceDays > 0
            ? `Next ${recurrence} task will appear ${advanceDays} day${advanceDays !== 1 ? "s" : ""} before it's due — even before this one is closed.`
            : "Next occurrence will be created when this task is marked done."}
        </p>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel}>Cancel</Button>
        <Button disabled={!valid} onClick={submit}>Add task</Button>
      </div>
    </Card>
  );
}
