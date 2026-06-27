"use client";

import * as React from "react";
import { PackageCheck, Search, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { LOCATIONS } from "@/lib/accounting/org";
import {
  allTasks, loadTasks, saveTasks,
  TASK_STATUS_META, STRATEGY_META,
  type WarehouseTask, type TaskStatus, type TaskType,
} from "@/lib/inventory/putaway";

const TYPE_TABS: Array<{ value: TaskType | "all"; label: string }> = [
  { value: "all",     label: "All"       },
  { value: "putaway", label: "Put-away"  },
  { value: "pick",    label: "Picking"   },
];

const STATUS_TABS: Array<{ value: TaskStatus | "all"; label: string }> = [
  { value: "all",         label: "All"         },
  { value: "pending",     label: "Pending"     },
  { value: "in-progress", label: "In Progress" },
  { value: "completed",   label: "Completed"   },
  { value: "cancelled",   label: "Cancelled"   },
];

function locName(id: string) {
  return LOCATIONS.find((l) => l.id === id)?.name ?? id;
}

function progress(task: WarehouseTask) {
  const total = task.lines.reduce((s, l) => s + l.qty, 0);
  const done  = task.lines.reduce((s, l) => s + l.picked, 0);
  return { total, done, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
}

export function PutawayClient() {
  const [tasks, setTasks] = React.useState<WarehouseTask[]>([]);
  const [typeTab, setTypeTab] = React.useState<TaskType | "all">("all");
  const [statusTab, setStatusTab] = React.useState<TaskStatus | "all">("pending");
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setTasks(allTasks(loadTasks()));
  }, []);

  const filtered = tasks.filter((t) => {
    if (typeTab !== "all" && t.type !== typeTab) return false;
    if (statusTab !== "all" && t.status !== statusTab) return false;
    if (query) {
      const q = query.toLowerCase();
      return t.ref.toLowerCase().includes(q) || t.assignedTo.toLowerCase().includes(q) || t.sourceRef.toLowerCase().includes(q);
    }
    return true;
  });

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function markComplete(id: string) {
    const updated = tasks.map((t) =>
      t.id !== id ? t : { ...t, status: "completed" as TaskStatus, completedAt: new Date().toISOString().slice(0, 10), lines: t.lines.map((l) => ({ ...l, picked: l.qty })) },
    );
    setTasks(updated);
    saveTasks(updated.filter((t) => !["task-put-001","task-put-002","task-put-003","task-put-004","task-put-005","task-pick-001","task-pick-002","task-pick-003","task-pick-004","task-pick-005","task-pick-006","task-pick-007"].includes(t.id)));
  }

  return (
    <>
      <PageHeader
        title="Put-away & Picking"
        subtitle="Warehouse task management — FIFO, zone-based and wave picking strategies."
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex gap-1">
          {TYPE_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setTypeTab(t.value)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", typeTab === t.value ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="h-4 w-px bg-border" />
        <div className="flex gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusTab(t.value)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", statusTab === t.value ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search tasks…" className="h-8 w-44 pl-7 text-xs" />
        </div>
      </Card>

      <div className="space-y-2">
        {filtered.map((task) => {
          const { total, done, pct } = progress(task);
          const statusMeta = TASK_STATUS_META[task.status];
          const isOpen = expanded.has(task.id);
          return (
            <Card key={task.id} className="overflow-hidden">
              <button className="w-full text-left" onClick={() => toggleExpand(task.id)}>
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <span className="font-mono text-xs text-primary">{task.ref}</span>
                  <Badge variant={task.type === "putaway" ? "primary" : "warning"} className="text-[10px]">
                    {task.type === "putaway" ? "Put-away" : "Pick"}
                  </Badge>
                  {task.strategy && <Badge variant={STRATEGY_META[task.strategy].variant} className="text-[10px]">{STRATEGY_META[task.strategy].label}</Badge>}
                  <Badge variant={statusMeta.variant}>{statusMeta.label}</Badge>
                  <span className="text-xs text-muted-foreground">{locName(task.locationId)}</span>
                  <span className="text-xs text-muted-foreground">→ {task.sourceRef}</span>
                  <span className="text-xs text-muted-foreground">Assigned: {task.assignedTo}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatDate(task.createdAt)}</span>
                  <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </div>
                {task.status !== "completed" && task.status !== "cancelled" && (
                  <div className="px-3 pb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[11px] text-muted-foreground">{done}/{total} picked ({pct}%)</span>
                    </div>
                  </div>
                )}
              </button>

              {isOpen && (
                <div className="border-t bg-muted/30 px-3 pb-3 pt-2">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="pb-1 font-medium">Item</th>
                        <th className="pb-1 font-medium">Qty</th>
                        <th className="pb-1 font-medium">UOM</th>
                        <th className="pb-1 font-medium">From bin</th>
                        <th className="pb-1 font-medium">To bin</th>
                        <th className="pb-1 font-medium">Picked</th>
                      </tr>
                    </thead>
                    <tbody>
                      {task.lines.map((l, i) => (
                        <tr key={i} className="border-t border-border/50">
                          <td className="py-1 font-mono">{l.itemId}</td>
                          <td className="py-1">{l.qty}</td>
                          <td className="py-1">{l.uom}</td>
                          <td className="py-1">{l.fromBin ?? "—"}</td>
                          <td className="py-1">{l.toBin ?? "—"}</td>
                          <td className={cn("py-1 font-medium", l.picked >= l.qty ? "text-success" : "text-muted-foreground")}>{l.picked}/{l.qty}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {(task.status === "pending" || task.status === "in-progress") && (
                    <Button size="sm" className="mt-2 h-7 px-2 text-xs" onClick={() => markComplete(task.id)}>
                      <PackageCheck className="size-3.5" /> Mark complete
                    </Button>
                  )}
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="py-12 text-center text-sm text-muted-foreground">No tasks match the selected filters.</Card>
        )}
      </div>
    </>
  );
}
