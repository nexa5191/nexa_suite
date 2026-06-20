"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarDays, Plus, Settings2, X } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useNewIntent } from "@/lib/commands/new-intent";
import { EMPLOYEES, employeeName } from "@/lib/hr/employees";
import {
  DEFAULT_LEAVE_TYPES,
  LEAVE_REQUESTS,
  loadLeaveTypes,
  leaveTypeById,
  balancesFor,
  requestDays,
} from "@/lib/hr/leave";
import type { LeaveType, LeaveRequest, DayUnit } from "@/lib/hr/types";

const STATUS_VARIANT: Record<LeaveRequest["status"], "warning" | "success" | "danger"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
};

export function LeaveClient() {
  const [types, setTypes] = React.useState<LeaveType[]>(DEFAULT_LEAVE_TYPES);
  const [extra, setExtra] = React.useState<LeaveRequest[]>([]);
  const [viewAs, setViewAs] = React.useState("emp-006");
  const [statusFilter, setStatusFilter] = React.useState("all");
  const [showApply, setShowApply] = React.useState(false);
  useNewIntent(() => setShowApply(true));

  // Load the persisted policy (edited in /leave/config) after hydration.
  React.useEffect(() => {
    setTypes(loadLeaveTypes());
  }, []);

  const allRequests = React.useMemo(
    () => [...extra, ...LEAVE_REQUESTS],
    [extra],
  );
  const balances = balancesFor(viewAs, types, allRequests);

  const visibleRequests = allRequests
    .filter((r) => statusFilter === "all" || r.status === statusFilter)
    .slice()
    .sort((a, b) => (a.appliedOn < b.appliedOn ? 1 : -1));

  function addRequest(r: LeaveRequest) {
    setExtra((prev) => [r, ...prev]);
    setShowApply(false);
  }

  return (
    <>
      <PageHeader
        title="Leave"
        subtitle="Balances, applications and approvals across the team."
        actions={
          <>
            <Link href="/leave/config">
              <Button variant="outline" size="sm">
                <Settings2 className="size-3.5" /> Configure policy
              </Button>
            </Link>
            <Button size="sm" onClick={() => setShowApply((s) => !s)}>
              <Plus className="size-3.5" /> Apply for leave
            </Button>
          </>
        }
      />

      {showApply && (
        <ApplyForm
          types={types}
          requests={allRequests}
          onSubmit={addRequest}
          onCancel={() => setShowApply(false)}
          count={extra.length}
        />
      )}

      {/* Balances for the selected employee */}
      <Card className="mb-4">
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="size-4" /> Leave balance
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Viewing as</span>
            <Select value={viewAs} onChange={(e) => setViewAs(e.target.value)} className="h-8 w-48">
              {EMPLOYEES.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((b) => {
              const t = leaveTypeById(types, b.leaveTypeId)!;
              const pct = b.allocated > 0 ? Math.min((b.used / b.allocated) * 100, 100) : 0;
              const pendPct = b.allocated > 0 ? Math.min((b.pending / b.allocated) * 100, 100 - pct) : 0;
              return (
                <div key={b.leaveTypeId} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{t.name}</p>
                    <Badge variant={t.tone}>{t.code}</Badge>
                  </div>
                  <div className="mt-2 flex items-end justify-between">
                    <p className="text-2xl font-bold tabular">
                      {t.annualDays === 0 ? "∞" : b.available}
                      {t.annualDays > 0 && (
                        <span className="text-sm font-normal text-muted-foreground"> / {b.allocated}</span>
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground">days left</p>
                  </div>
                  <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                    <div className="h-full bg-warning/60" style={{ width: `${pendPct}%` }} />
                  </div>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    {b.used} used · {b.pending} pending
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Requests table */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <p className="text-sm font-medium">Leave requests</p>
          <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="h-8 w-36">
            <option value="all">All statuses</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </Select>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 font-medium">Dates</th>
                <th className="px-5 py-3 text-right font-medium">Days</th>
                <th className="px-5 py-3 font-medium">Reason</th>
                <th className="px-5 py-3 font-medium">Approver</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleRequests.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No requests match this filter
                  </td>
                </tr>
              )}
              {visibleRequests.map((r) => {
                const t = leaveTypeById(types, r.leaveTypeId);
                return (
                  <tr key={r.id} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-3 font-medium">{employeeName(r.employeeId)}</td>
                    <td className="px-5 py-3">
                      {t ? <Badge variant={t.tone}>{t.code}</Badge> : "—"}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {r.from === r.to
                        ? `${formatDate(r.from)}${r.unit === "half" ? " · ½ day" : ""}`
                        : `${formatDate(r.from)} – ${formatDate(r.to)}`}
                    </td>
                    <td className="px-5 py-3 text-right tabular font-semibold">{r.days}</td>
                    <td className="px-5 py-3 text-muted-foreground">{r.reason}</td>
                    <td className="px-5 py-3 text-muted-foreground">{employeeName(r.approverId)}</td>
                    <td className="px-5 py-3">
                      <Badge variant={STATUS_VARIANT[r.status]} className="capitalize">{r.status}</Badge>
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

function ApplyForm({
  types,
  requests,
  onSubmit,
  onCancel,
  count,
}: {
  types: LeaveType[];
  requests: LeaveRequest[];
  onSubmit: (r: LeaveRequest) => void;
  onCancel: () => void;
  count: number;
}) {
  const [employeeId, setEmployeeId] = React.useState("emp-006");
  const [leaveTypeId, setLeaveTypeId] = React.useState(types[0]?.id ?? "");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [unit, setUnit] = React.useState<DayUnit>("full");
  const [reason, setReason] = React.useState("");

  const type = leaveTypeById(types, leaveTypeId);
  const singleDay = !!from && from === to;
  const canHalf = !!type?.allowHalfDay && singleDay;
  const effectiveUnit: DayUnit = canHalf ? unit : "full";
  const days = from && to ? requestDays(from, to, effectiveUnit) : 0;

  // Live balance for the chosen employee + leave type.
  const balance = balancesFor(employeeId, types, requests).find((b) => b.leaveTypeId === leaveTypeId);
  const unlimited = (type?.annualDays ?? 0) === 0;
  const exceeds = !unlimited && !!balance && days > balance.available;
  const valid =
    !!employeeId && !!leaveTypeId && !!from && !!to && from <= to && !!reason.trim() && !exceeds;

  function submit() {
    if (!valid) return;
    const emp = EMPLOYEES.find((e) => e.id === employeeId);
    onSubmit({
      id: `req-local-${count + 1}`,
      employeeId,
      leaveTypeId,
      from,
      to,
      unit: effectiveUnit,
      days,
      reason: reason.trim(),
      status: "pending",
      appliedOn: "2026-06-05",
      approverId: emp?.managerId ?? null,
    });
  }

  return (
    <Card className="mb-4 border-primary/30">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>New leave application</CardTitle>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground" aria-label="Close">
          <X className="size-4" />
        </button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Employee">
            <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)}>
              {EMPLOYEES.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Leave type">
            <Select value={leaveTypeId} onChange={(e) => setLeaveTypeId(e.target.value)}>
              {types.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </Select>
          </Field>
          <Field label={canHalf ? "Duration" : "Duration (full days)"}>
            <Select
              value={effectiveUnit}
              onChange={(e) => setUnit(e.target.value as DayUnit)}
              disabled={!canHalf}
            >
              <option value="full">Full day</option>
              {canHalf && <option value="half">Half day</option>}
            </Select>
          </Field>
          <Field label="From">
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </Field>
          <Field label="To">
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label="Reason">
            <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Brief reason" />
          </Field>
        </div>
        {/* Live balance for the selected employee + leave type */}
        {type && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border bg-muted/30 px-3 py-2.5 text-sm">
            <Badge variant={type.tone}>{type.code}</Badge>
            {unlimited ? (
              <span className="text-muted-foreground">Unlimited allocation — no balance limit.</span>
            ) : balance ? (
              <span className="flex flex-wrap items-center gap-x-4 gap-y-1">
                <span><span className="font-semibold tabular">{balance.available}</span> <span className="text-muted-foreground">available</span></span>
                <span className="text-muted-foreground">of {balance.allocated} · {balance.used} used · {balance.pending} pending</span>
              </span>
            ) : null}
            {days > 0 && !unlimited && balance && (
              <span className={cn("ml-auto", exceeds ? "font-medium text-danger" : "text-muted-foreground")}>
                {exceeds
                  ? `Exceeds balance — only ${balance.available} left`
                  : `After this: ${balance.available - days} day${balance.available - days === 1 ? "" : "s"} left`}
              </span>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {days > 0 ? (
              <>This request charges <span className="font-semibold text-foreground">{days} day{days === 1 ? "" : "s"}</span>.</>
            ) : (
              "Pick a date range to see the chargeable days."
            )}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel}>Cancel</Button>
            <Button disabled={!valid} onClick={submit}>Submit application</Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <Label className={cn("mb-1.5 block")}>{label}</Label>
      {children}
    </label>
  );
}
