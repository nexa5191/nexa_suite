"use client";

import * as React from "react";
import Link from "next/link";
import { Check, X, RotateCcw, ExternalLink, CheckSquare } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { entityById, locationById } from "@/lib/accounting/org";
import { loadDecisions, saveDecisions, type Decision } from "@/lib/hr/approvals";
import type { Approval, ApprovalKind } from "@/lib/hr/types";
import { KIND_META } from "./approval-meta";

const KINDS: ApprovalKind[] = ["leave", "financial", "document"];

export function ApprovalsClient({ approvals }: { approvals: Approval[] }) {
  const [decisions, setDecisions] = React.useState<Record<string, Decision>>({});
  const [kindFilter, setKindFilter] = React.useState<"all" | ApprovalKind>("all");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "pending" | Decision>("pending");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setDecisions(loadDecisions());
  }, []);

  function decideMany(ids: string[], decision: Decision) {
    setDecisions((prev) => {
      const next = { ...prev };
      ids.forEach((id) => (next[id] = decision));
      saveDecisions(next);
      return next;
    });
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });
  }
  function decide(id: string, decision: Decision) {
    decideMany([id], decision);
  }
  function undo(id: string) {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[id];
      saveDecisions(next);
      return next;
    });
  }
  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const statusOf = (a: Approval): "pending" | Decision => decisions[a.id] ?? "pending";

  const pendingByKind = (k: ApprovalKind) =>
    approvals.filter((a) => a.kind === k && statusOf(a) === "pending").length;
  const totalPending = approvals.filter((a) => statusOf(a) === "pending").length;

  const visible = approvals.filter((a) => {
    if (kindFilter !== "all" && a.kind !== kindFilter) return false;
    if (statusFilter !== "all" && statusOf(a) !== statusFilter) return false;
    return true;
  });

  const visiblePendingIds = visible.filter((a) => statusOf(a) === "pending").map((a) => a.id);
  const allSelected = visiblePendingIds.length > 0 && visiblePendingIds.every((id) => selected.has(id));
  const selectedIds = [...selected].filter((id) => decisions[id] == null);

  function toggleSelectAll() {
    setSelected((prev) => {
      if (allSelected) {
        const next = new Set(prev);
        visiblePendingIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...visiblePendingIds]);
    });
  }

  return (
    <>
      <PageHeader
        title="Approvals"
        subtitle="Everything awaiting your sign-off — leave, finance and documents in one queue."
      />

      {/* Summary */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Pending" count={totalPending} active={statusFilter === "pending" && kindFilter === "all"} onClick={() => { setStatusFilter("pending"); setKindFilter("all"); }} />
        {KINDS.map((k) => {
          const meta = KIND_META[k];
          return (
            <SummaryCard
              key={k}
              label={meta.label}
              count={pendingByKind(k)}
              icon={<meta.Icon className="size-4" />}
              active={kindFilter === k}
              onClick={() => { setKindFilter(k); setStatusFilter("pending"); }}
            />
          );
        })}
      </div>

      {/* Filters */}
      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <span className="text-xs font-medium text-muted-foreground">Filter</span>
        <Select value={kindFilter} onChange={(e) => setKindFilter(e.target.value as typeof kindFilter)} className="h-8 w-40">
          <option value="all">All types</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>{KIND_META[k].label}</option>
          ))}
        </Select>
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="h-8 w-40">
          <option value="all">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{visible.length} shown</span>
      </Card>

      {/* Bulk selection bar */}
      {visiblePendingIds.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-3 rounded-lg border bg-card px-4 py-2.5 shadow-sm">
          <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={allSelected} onChange={toggleSelectAll} className="size-4 accent-[hsl(var(--primary))]" />
            Select all ({visiblePendingIds.length})
          </label>
          {selectedIds.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">{selectedIds.length} selected</span>
              <div className="ml-auto flex items-center gap-2">
                <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>Clear</Button>
                <Button size="sm" variant="outline" onClick={() => decideMany(selectedIds, "rejected")}>
                  <X className="size-3.5" /> Reject selected
                </Button>
                <Button size="sm" onClick={() => decideMany(selectedIds, "approved")}>
                  <CheckSquare className="size-3.5" /> Approve selected
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* List */}
      <div className="space-y-2">
        {visible.length === 0 && (
          <Card className="py-16 text-center text-sm text-muted-foreground">Nothing here — queue is clear.</Card>
        )}
        {visible.map((a) => (
          <ApprovalRow
            key={a.id}
            approval={a}
            status={statusOf(a)}
            selected={selected.has(a.id)}
            onToggleSelect={toggleSelect}
            onDecide={decide}
            onUndo={undo}
          />
        ))}
      </div>
    </>
  );
}

function SummaryCard({
  label,
  count,
  icon,
  active,
  onClick,
}: {
  label: string;
  count: number;
  icon?: React.ReactNode;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border bg-card p-4 text-left shadow-sm transition-colors hover:bg-accent/40",
        active && "border-primary/40 ring-1 ring-primary/30",
      )}
    >
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        {icon}
      </div>
      <p className="mt-1 text-3xl font-bold tabular">{count}</p>
    </button>
  );
}

function ApprovalRow({
  approval: a,
  status,
  selected,
  onToggleSelect,
  onDecide,
  onUndo,
}: {
  approval: Approval;
  status: "pending" | Decision;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onDecide: (id: string, d: Decision) => void;
  onUndo: (id: string) => void;
}) {
  const meta = KIND_META[a.kind];
  const entity = entityById(a.entityId)?.name;
  const location = locationById(a.locationId)?.name;
  return (
    <Card className={cn("p-4", status !== "pending" && "opacity-75", selected && "ring-1 ring-primary/40")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {status === "pending" && (
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(a.id)}
            className="size-4 shrink-0 accent-[hsl(var(--primary))]"
            aria-label={`Select ${a.title}`}
          />
        )}
        <span className={cn(
          "flex size-9 shrink-0 items-center justify-center rounded-lg",
          meta.tone === "primary" && "bg-primary/10 text-primary",
          meta.tone === "warning" && "bg-warning/15 text-warning",
          meta.tone === "default" && "bg-secondary text-secondary-foreground",
        )}>
          <meta.Icon className="size-4" />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{a.title}</p>
            <Badge variant={meta.tone === "default" ? "outline" : meta.tone}>{meta.label}</Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">{a.detail}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {a.requestedByName} · {formatDate(a.requestedOn)}
            {entity && ` · ${entity}`}
            {location && ` — ${location}`}
          </p>
        </div>

        {a.amount != null && (
          <div className="shrink-0 text-right">
            <Money value={a.amount} className="font-semibold" />
            <p className="text-[11px] text-muted-foreground">amount</p>
          </div>
        )}

        <div className="flex shrink-0 items-center gap-2">
          <Link href={a.href} title="Review" className="text-muted-foreground hover:text-foreground">
            <ExternalLink className="size-4" />
          </Link>
          {status === "pending" ? (
            <>
              <Button size="sm" variant="outline" onClick={() => onDecide(a.id, "rejected")}>
                <X className="size-3.5" /> Reject
              </Button>
              <Button size="sm" onClick={() => onDecide(a.id, "approved")}>
                <Check className="size-3.5" /> Approve
              </Button>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Badge variant={status === "approved" ? "success" : "danger"} className="capitalize">{status}</Badge>
              <button onClick={() => onUndo(a.id)} className="text-muted-foreground hover:text-foreground" title="Undo">
                <RotateCcw className="size-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
