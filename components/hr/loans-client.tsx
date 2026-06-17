"use client";

import * as React from "react";
import { Plus, X, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Input, Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EMPLOYEES, employeeName, departmentName } from "@/lib/hr/employees";
import {
  LOAN_TYPES, STATUS_VARIANT, TODAY,
  emiOf, schedule, loanProgress, affordability, summarise,
  allLoans, loadLoansStore, saveLoansStore, nextLoanId, loanTypeMeta,
  type Loan, type LoanType, type LoansStore, type EmiRow,
} from "@/lib/hr/loans";

const TODAY_MONTH = TODAY.slice(0, 7);

export function LoansClient() {
  const [store, setStore] = React.useState<LoansStore>({ created: [], statusOverrides: {} });
  const [empFilter, setEmpFilter] = React.useState<string>("all");
  const [showForm, setShowForm] = React.useState(false);
  const [detail, setDetail] = React.useState<Loan | null>(null);

  React.useEffect(() => {
    setStore(loadLoansStore());
  }, []);

  const loans = React.useMemo(() => allLoans(store), [store]);
  const summary = React.useMemo(() => summarise(loans), [loans]);

  const visible = React.useMemo(
    () => loans.filter((l) => empFilter === "all" || l.empId === empFilter),
    [loans, empFilter],
  );

  // Employees referenced by at least one loan — for the filter.
  const loanEmployeeIds = React.useMemo(
    () => [...new Set(loans.map((l) => l.empId))],
    [loans],
  );

  function addLoan(loan: Loan) {
    setStore((prev) => {
      const next: LoansStore = { ...prev, created: [...prev.created, loan] };
      saveLoansStore(next);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="Loans & Advances"
        subtitle="Employee salary advances and personal loans with EMI schedules and payroll recovery."
        actions={
          <Button onClick={() => setShowForm(true)}>
            <Plus className="size-4" /> New loan
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Total disbursed" value={summary.totalDisbursed} />
        <Summary label="Total outstanding" value={summary.totalOutstanding} highlight />
        <Summary label="Active loans" plain={String(summary.activeCount)} />
        <Summary label="Monthly EMI recovery" value={summary.monthlyRecovery} />
      </div>

      {/* Filter */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-full sm:w-64">
          <Label>Employee</Label>
          <div className="mt-1">
            <Select value={empFilter} onChange={(e) => setEmpFilter(e.target.value)}>
              <option value="all">All employees</option>
              {loanEmployeeIds.map((id) => (
                <option key={id} value={id}>{employeeName(id)}</option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {/* Loans table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 text-right font-medium">Principal</th>
                <th className="px-5 py-3 text-right font-medium">EMI</th>
                <th className="px-5 py-3 text-center font-medium">Tenure</th>
                <th className="px-5 py-3 font-medium">Progress</th>
                <th className="px-5 py-3 text-right font-medium">Outstanding</th>
                <th className="px-5 py-3 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => {
                const p = loanProgress(l);
                const meta = loanTypeMeta(l.type);
                const pct = l.tenureMonths > 0 ? Math.round((p.monthsElapsed / l.tenureMonths) * 100) : 0;
                return (
                  <tr
                    key={l.id}
                    onClick={() => setDetail(l)}
                    className="cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50"
                  >
                    <td className="px-5 py-3">
                      <div className="font-medium">{employeeName(l.empId)}</div>
                      <div className="text-xs text-muted-foreground">{departmentName(EMPLOYEES.find((e) => e.id === l.empId)?.departmentId ?? "")}</div>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                      {l.annualRatePct > 0
                        ? <span className="ml-1.5 text-xs text-muted-foreground">{l.annualRatePct}% p.a.</span>
                        : <span className="ml-1.5 text-xs text-muted-foreground">0% (free)</span>}
                    </td>
                    <td className="px-5 py-3 text-right tabular"><Money value={l.principal} /></td>
                    <td className="px-5 py-3 text-right tabular"><Money value={p.emi} /></td>
                    <td className="px-5 py-3 text-center tabular text-muted-foreground">{l.tenureMonths} mo</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs tabular text-muted-foreground">{p.monthsElapsed}/{l.tenureMonths}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular"><Money value={p.outstanding} /></td>
                    <td className="px-5 py-3 text-center">
                      <Badge variant={STATUS_VARIANT[l.status]} className="capitalize">{l.status}</Badge>
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">No loans to show.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {showForm && (
        <NewLoanModal loans={loans} store={store} onClose={() => setShowForm(false)} onCreate={addLoan} />
      )}
      {detail && <ScheduleModal loan={detail} onClose={() => setDetail(null)} />}
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

// ---------------------------------------------------------------------------
// New loan modal
// ---------------------------------------------------------------------------

function NewLoanModal({
  loans, store, onClose, onCreate,
}: {
  loans: Loan[];
  store: LoansStore;
  onClose: () => void;
  onCreate: (loan: Loan) => void;
}) {
  const [empId, setEmpId] = React.useState(EMPLOYEES[5]?.id ?? EMPLOYEES[0].id);
  const [type, setType] = React.useState<LoanType>("personal");
  const [principal, setPrincipal] = React.useState("100000");
  const [rate, setRate] = React.useState("10");
  const [tenure, setTenure] = React.useState("12");
  const [purpose, setPurpose] = React.useState("");

  const principalNum = Number(principal) || 0;
  const rateNum = type === "salary-advance" ? 0 : Number(rate) || 0;
  const tenureNum = Math.max(1, Number(tenure) || 1);

  // Preview the EMI + affordability for the entered figures.
  const previewLoan: Loan = {
    id: "preview", empId, type, principal: principalNum,
    annualRatePct: rateNum, tenureMonths: tenureNum,
    startMonth: TODAY_MONTH, status: "active", purpose,
  };
  const emi = emiOf(previewLoan);
  const check = affordability(empId, emi, loans);

  function submit() {
    onCreate({
      id: nextLoanId(store),
      empId,
      type,
      principal: principalNum,
      annualRatePct: rateNum,
      tenureMonths: tenureNum,
      startMonth: TODAY_MONTH,
      status: "active",
      purpose: purpose || `${loanTypeMeta(type).label} loan`,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-5" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">New loan / advance</p>
            <h3 className="mt-0.5 font-semibold">Disburse to an employee</h3>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="mt-3 grid gap-3">
          <div>
            <Label>Employee</Label>
            <div className="mt-1">
              <Select value={empId} onChange={(e) => setEmpId(e.target.value)}>
                {EMPLOYEES.filter((e) => e.status !== "exited").map((e) => (
                  <option key={e.id} value={e.id}>{e.name} · {e.code}</option>
                ))}
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Type</Label>
              <div className="mt-1">
                <Select
                  value={type}
                  onChange={(e) => {
                    const t = e.target.value as LoanType;
                    setType(t);
                    if (t === "salary-advance") setRate("0");
                  }}
                >
                  {LOAN_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>{t.label}</option>
                  ))}
                </Select>
              </div>
            </div>
            <div>
              <Label>Principal (₹)</Label>
              <Input className="mt-1" type="number" value={principal} onChange={(e) => setPrincipal(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Rate (% p.a.)</Label>
              <Input
                className="mt-1"
                type="number"
                value={type === "salary-advance" ? "0" : rate}
                disabled={type === "salary-advance"}
                onChange={(e) => setRate(e.target.value)}
              />
            </div>
            <div>
              <Label>Tenure (months)</Label>
              <Input className="mt-1" type="number" value={tenure} onChange={(e) => setTenure(e.target.value)} />
            </div>
          </div>

          <div>
            <Label>Purpose</Label>
            <Input className="mt-1" value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Home renovation" />
          </div>

          {/* EMI + affordability preview */}
          <div className="rounded-lg border bg-muted/30 p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Monthly EMI</span>
              <span className="font-semibold tabular"><Money value={emi} /></span>
            </div>
            <div className="mt-1 flex items-center justify-between">
              <span className="text-muted-foreground">EMI burden / 40% net cap</span>
              <span className="tabular"><Money value={check.proposedEmi} compact /> / <Money value={check.cap} compact /></span>
            </div>
          </div>

          {!check.withinLimit && (
            <div className="flex items-start gap-2 rounded-lg border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" />
              <span>
                Affordability breach — total active EMI (<Money value={check.proposedEmi} compact />) exceeds 40% of monthly net
                (<Money value={check.cap} compact />). You can still disburse, but flag for review.
              </span>
            </div>
          )}
        </div>

        <div className="mt-4 flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={principalNum <= 0}>Disburse loan</Button>
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Amortisation schedule modal
// ---------------------------------------------------------------------------

function ScheduleModal({ loan, onClose }: { loan: Loan; onClose: () => void }) {
  const rows = schedule(loan);
  const p = loanProgress(loan);
  const meta = loanTypeMeta(loan.type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="flex max-h-[85vh] w-full max-w-2xl flex-col p-5" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Amortisation · {meta.label}</p>
            <h3 className="mt-0.5 font-semibold">{employeeName(loan.empId)}</h3>
            <p className="text-xs text-muted-foreground">{loan.purpose}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Mini label="Principal" value={loan.principal} />
          <Mini label="EMI" value={p.emi} />
          <Mini label="Outstanding" value={p.outstanding} />
          <Mini label="Remaining" plain={`${p.remainingEmis} EMIs`} />
        </div>

        <div className="mt-3 overflow-y-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-card">
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-2 font-medium">#</th>
                <th className="px-3 py-2 font-medium">Month</th>
                <th className="px-3 py-2 text-right font-medium">Opening</th>
                <th className="px-3 py-2 text-right font-medium">EMI</th>
                <th className="px-3 py-2 text-right font-medium">Interest</th>
                <th className="px-3 py-2 text-right font-medium">Principal</th>
                <th className="px-3 py-2 text-right font-medium">Closing</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r: EmiRow) => {
                const current = loan.status === "active" && r.month === TODAY_MONTH;
                return (
                  <tr
                    key={r.index}
                    className={cn(
                      "border-b transition-colors last:border-0",
                      current ? "bg-primary/10 font-medium" : "hover:bg-accent/40",
                    )}
                  >
                    <td className="px-3 py-2 text-muted-foreground tabular">{r.index}</td>
                    <td className="px-3 py-2 tabular">{r.month}{current && <span className="ml-1.5 text-[10px] uppercase text-primary">current</span>}</td>
                    <td className="px-3 py-2 text-right tabular"><Money value={r.opening} /></td>
                    <td className="px-3 py-2 text-right tabular"><Money value={r.emi} /></td>
                    <td className="px-3 py-2 text-right tabular text-muted-foreground"><Money value={r.interest} /></td>
                    <td className="px-3 py-2 text-right tabular"><Money value={r.principal} /></td>
                    <td className="px-3 py-2 text-right tabular"><Money value={r.closing} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

function Mini({ label, value, plain }: { label: string; value?: number; plain?: string }) {
  return (
    <div className="rounded-lg border p-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-semibold tabular">{plain ?? <Money value={value ?? 0} />}</p>
    </div>
  );
}
