"use client";

import * as React from "react";
import { Play, FileText, X, Check } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { departmentName, employeeName } from "@/lib/hr/employees";
import {
  PAYROLL_RUNS, runMembers, runTotals, salaryStructure, type RunStatus, type Payslip,
} from "@/lib/hr/payroll";

const STATUS_TONE: Record<RunStatus, "success" | "warning" | "default"> = {
  paid: "success",
  processing: "warning",
  draft: "default",
};
const PROCESSED_KEY = "nexa-payroll-processed";

export function PayrollClient() {
  const [month, setMonth] = React.useState(PAYROLL_RUNS[PAYROLL_RUNS.length - 1].month); // latest (June draft)
  const [processed, setProcessed] = React.useState<string[]>([]);
  const [slip, setSlip] = React.useState<Payslip | null>(null);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem(PROCESSED_KEY);
      if (raw) setProcessed(JSON.parse(raw));
    } catch { /* ignore */ }
  }, []);

  const run = PAYROLL_RUNS.find((r) => r.month === month)!;
  const status: RunStatus = run.status === "draft" && processed.includes(month) ? "paid" : run.status;
  const members = runMembers(month);
  const totals = runTotals(month);

  function runPayroll() {
    setProcessed((prev) => {
      const next = [...new Set([...prev, month])];
      try { localStorage.setItem(PROCESSED_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }

  return (
    <>
      <PageHeader title="Payroll" subtitle="Monthly payroll runs with full salary structure and payslips." />

      {/* Run selector */}
      <div className="mb-4 flex flex-wrap gap-1">
        {PAYROLL_RUNS.map((r) => {
          const eff: RunStatus = r.status === "draft" && processed.includes(r.month) ? "paid" : r.status;
          return (
            <button
              key={r.id}
              onClick={() => setMonth(r.month)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                r.month === month ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {r.label}
              <span className={cn("size-1.5 rounded-full", eff === "paid" ? "bg-success" : "bg-muted-foreground/50")} />
            </button>
          );
        })}
      </div>

      {/* Run summary */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold">{run.label}</h2>
            <Badge variant={STATUS_TONE[status]} className="capitalize">{status}</Badge>
            {run.runDate && status === "paid" && <span className="text-xs text-muted-foreground">processed {formatDate(run.runDate)} · by {employeeName(run.processedById)}</span>}
          </div>
          {status === "draft" ? (
            <Button onClick={runPayroll}><Play className="size-4" /> Run payroll</Button>
          ) : (
            <span className="flex items-center gap-1.5 text-sm text-success"><Check className="size-4" /> Payroll processed</span>
          )}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Summary label="Headcount" plain={String(totals.headcount)} />
          <Summary label="Gross" value={totals.gross} />
          <Summary label="Deductions" value={totals.deductions} />
          <Summary label="Net payout" value={totals.net} highlight />
        </div>
      </Card>

      {/* Members */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Department</th>
                <th className="px-5 py-3 text-right font-medium">Gross</th>
                <th className="px-5 py-3 text-right font-medium">Deductions</th>
                <th className="px-5 py-3 text-right font-medium">Net</th>
                <th className="px-5 py-3 text-right font-medium">Payslip</th>
              </tr>
            </thead>
            <tbody>
              {members.map((e) => {
                const s = salaryStructure(e.id);
                return (
                  <tr key={e.id} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-3 font-medium">{e.name}</td>
                    <td className="px-5 py-3 text-muted-foreground">{departmentName(e.departmentId)}</td>
                    <td className="px-5 py-3 text-right tabular"><Money value={s.gross} /></td>
                    <td className="px-5 py-3 text-right tabular text-danger"><Money value={s.deductions} /></td>
                    <td className="px-5 py-3 text-right font-semibold tabular"><Money value={s.net} /></td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setSlip({ month: run.month, label: run.label, status, employee: e, structure: s })}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <FileText className="size-3.5" /> View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {slip && <PayslipModal slip={slip} onClose={() => setSlip(null)} />}
    </>
  );
}

function Summary({ label, value, plain, highlight }: { label: string; value?: number; plain?: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", highlight && "border-primary/30 bg-primary/5")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular">
        {plain ?? <Money value={value ?? 0} />}
      </p>
    </div>
  );
}

function PayslipModal({ slip, onClose }: { slip: Payslip; onClose: () => void }) {
  const s = slip.structure;
  const e = slip.employee;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-5" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Payslip · {slip.label}</p>
            <h3 className="mt-0.5 font-semibold">{e.name}</h3>
            <p className="text-xs text-muted-foreground">{e.designation} · {e.code}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Earnings</p>
            <Line label="Basic" value={s.basic} />
            <Line label="HRA" value={s.hra} />
            <Line label="Special allowance" value={s.special} />
            <Line label="Gross" value={s.gross} bold />
          </div>
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Deductions</p>
            <Line label="Provident Fund" value={s.pf} />
            <Line label="Professional Tax" value={s.pt} />
            <Line label="TDS" value={s.tds} />
            <Line label="Total" value={s.deductions} bold />
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between rounded-lg bg-primary/10 px-4 py-3">
          <span className="text-sm font-semibold text-primary">Net pay</span>
          <span className="text-lg font-bold text-primary"><Money value={s.net} /></span>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground">
          {slip.status === "paid" ? "Credited to bank account" : "Provisional — payroll not yet processed"}
        </p>
      </Card>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-1 text-sm", bold && "border-t mt-1 pt-1.5 font-semibold")}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular"><Money value={value} /></span>
    </div>
  );
}
