"use client";

import * as React from "react";
import {
  Landmark, HeartPulse, MapPin, Receipt, FileText, Gift, Download, X, Check, AlertTriangle,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { departmentName } from "@/lib/hr/employees";
import {
  statutoryRoster, pfChallan, esiChallan, ptSummary, tdsProjection, form24Q,
  buildForm16, gratuityLines, fnfSettlements, statutoryTotals,
  pfEcrText, form24QText, FY_LABEL, AY_LABEL,
  type Form16,
} from "@/lib/hr/statutory";

type Tab = "pf" | "esi" | "pt" | "tds" | "form16" | "gratuity";

const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "pf", label: "PF (ECR)", icon: Landmark },
  { key: "esi", label: "ESI", icon: HeartPulse },
  { key: "pt", label: "Professional Tax", icon: MapPin },
  { key: "tds", label: "TDS / 24Q", icon: Receipt },
  { key: "form16", label: "Form 16", icon: FileText },
  { key: "gratuity", label: "Gratuity & F&F", icon: Gift },
];

function downloadText(filename: string, body: string) {
  if (typeof window === "undefined") return;
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function StatutoryClient() {
  const [tab, setTab] = React.useState<Tab>("pf");
  const roster = React.useMemo(() => statutoryRoster(), []);
  const empIds = React.useMemo(() => roster.map((e) => e.id), [roster]);
  const totals = React.useMemo(() => statutoryTotals(empIds), [empIds]);
  const [form16, setForm16] = React.useState<Form16 | null>(null);

  return (
    <>
      <PageHeader
        title="Payroll Statutory Compliance"
        subtitle={`PF · ESI · PT · TDS · Form 16 · Gratuity for ${FY_LABEL} (${AY_LABEL}) — monthly figures across ${roster.length} employees.`}
      />

      {/* Headline challan totals */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="PF challan (monthly)" value={totals.pf} tone="primary" />
        <SummaryCard label="ESI challan (monthly)" value={totals.esi} tone="success" />
        <SummaryCard label="Professional Tax" value={totals.pt} tone="warning" />
        <SummaryCard label="TDS (monthly)" value={totals.tds} tone="danger" highlight />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                t.key === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "pf" && <PfTab empIds={empIds} />}
      {tab === "esi" && <EsiTab empIds={empIds} />}
      {tab === "pt" && <PtTab empIds={empIds} />}
      {tab === "tds" && <TdsTab empIds={empIds} />}
      {tab === "form16" && <Form16Tab roster={roster} onView={setForm16} />}
      {tab === "gratuity" && <GratuityTab empIds={empIds} />}

      {form16 && <Form16Modal form16={form16} onClose={() => setForm16(null)} />}
    </>
  );

  // ---- PF ------------------------------------------------------------------
  function PfTab({ empIds }: { empIds: string[] }) {
    const challan = pfChallan(empIds);
    return (
      <Card className="overflow-hidden">
        <ToolbarRow
          title="Provident Fund — ECR (Electronic Challan-cum-Return)"
          note="Employee 12% of basic; employer 12% split 8.33% EPS (capped at ₹15,000 basic) + balance EPF."
          action={
            <Button size="sm" variant="outline" onClick={() => downloadText("nexa-pf-ecr.txt", pfEcrText(empIds))}>
              <Download className="size-4" /> Generate ECR
            </Button>
          }
        />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <Th cols={["Employee", "PF wages (basic)", "Employee PF", "Employer EPS", "Employer EPF", "Total"]} />
            </thead>
            <tbody>
              {challan.lines.map((l) => (
                <tr key={l.empId} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                  <td className="px-5 py-2.5 font-medium">{l.name}</td>
                  <Num value={l.basic} />
                  <Num value={l.employeePf} />
                  <Num value={l.employerEps} />
                  <Num value={l.employerEpf} />
                  <Num value={l.total} bold />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <td className="px-5 py-2.5">Challan total</td>
                <Num value={challan.totalWages} />
                <Num value={challan.employeePf} />
                <Num value={challan.employerEps} />
                <Num value={challan.employerEpf} />
                <Num value={challan.total} bold />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    );
  }

  // ---- ESI -----------------------------------------------------------------
  function EsiTab({ empIds }: { empIds: string[] }) {
    const challan = esiChallan(empIds);
    return (
      <Card className="overflow-hidden">
        <ToolbarRow
          title="Employees' State Insurance"
          note="Applies only when gross ≤ ₹21,000/month. Employee 0.75%, employer 3.25%."
          action={<Badge variant="primary">{challan.covered} covered</Badge>}
        />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <Th cols={["Employee", "Gross / month", "Covered", "Employee 0.75%", "Employer 3.25%", "Total"]} />
            </thead>
            <tbody>
              {challan.lines.map((l) => (
                <tr key={l.empId} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                  <td className="px-5 py-2.5 font-medium">{l.name}</td>
                  <Num value={l.gross} />
                  <td className="px-5 py-2.5 text-center">
                    {l.applicable
                      ? <Badge variant="success" className="text-[10px]"><Check className="size-3" /> Yes</Badge>
                      : <span className="text-xs text-muted-foreground">—</span>}
                  </td>
                  <Num value={l.employee} muted={!l.applicable} />
                  <Num value={l.employer} muted={!l.applicable} />
                  <Num value={l.total} bold />
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 bg-muted/40 font-semibold">
                <td className="px-5 py-2.5" colSpan={3}>Challan total</td>
                <Num value={challan.employee} />
                <Num value={challan.employer} />
                <Num value={challan.total} bold />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    );
  }

  // ---- PT ------------------------------------------------------------------
  function PtTab({ empIds }: { empIds: string[] }) {
    const summary = ptSummary(empIds);
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          {summary.byState.map((s) => (
            <Card key={s.state} className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{s.state}</p>
              <p className="mt-1 text-xl font-bold tabular"><Money value={s.total} /></p>
              <p className="text-[11px] text-muted-foreground">{s.count} employee{s.count === 1 ? "" : "s"}</p>
            </Card>
          ))}
        </div>
        <Card className="overflow-hidden">
          <ToolbarRow
            title="Professional Tax — by state slab"
            note="State-levied; deducted monthly per the local slab (Karnataka/Maharashtra ₹200; Delhi nil)."
            action={<span className="text-sm font-semibold">Total <Money value={summary.total} /></span>}
          />
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead><Th cols={["Employee", "State", "Monthly PT"]} /></thead>
              <tbody>
                {summary.lines.map((l) => (
                  <tr key={l.empId} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-2.5 font-medium">{l.name}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{l.state}</td>
                    <Num value={l.monthly} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  // ---- TDS / 24Q -----------------------------------------------------------
  function TdsTab({ empIds }: { empIds: string[] }) {
    const projections = empIds.map((id) => tdsProjection(id));
    const f24 = form24Q(empIds);
    return (
      <div className="space-y-4">
        <Card className="flex items-start gap-2 border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning" />
          <span>
            TDS is projected on annual CTC under the <span className="font-medium text-foreground">New regime</span> (the
            statutory default until the employee files a declaration), with only the standard deduction. Where the Old
            regime is cheaper it is flagged below.
          </span>
        </Card>

        {/* 24Q quarterly */}
        <Card className="overflow-hidden">
          <ToolbarRow
            title={`Form 24Q — Quarterly TDS on Salaries · ${FY_LABEL}`}
            note="Salary paid & TDS deducted, per quarter, across the payroll."
            action={
              <Button size="sm" variant="outline" onClick={() => downloadText("nexa-form-24q.txt", form24QText(empIds))}>
                <Download className="size-4" /> Export 24Q
              </Button>
            }
          />
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead><Th cols={["Quarter", "Salary paid", "TDS deducted"]} /></thead>
              <tbody>
                {f24.rows.map((r) => (
                  <tr key={r.key} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-2.5 font-medium">{r.label}</td>
                    <Num value={r.salaryPaid} />
                    <Num value={r.tdsDeducted} />
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 bg-muted/40 font-semibold">
                  <td className="px-5 py-2.5">FY total · {f24.deductees} deductees</td>
                  <Num value={f24.totalSalary} />
                  <Num value={f24.totalTds} bold />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Per-employee projection */}
        <Card className="overflow-hidden">
          <ToolbarRow title="Annual TDS projection — per employee" />
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead><Th cols={["Employee", "Annual salary", "Annual tax", "Monthly TDS", "Better regime"]} /></thead>
              <tbody>
                {projections.map((p) => (
                  <tr key={p.empId} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-2.5 font-medium">{p.name}</td>
                    <Num value={p.annualSalary} />
                    <Num value={p.annualTax} />
                    <Num value={p.monthlyTds} bold />
                    <td className="px-5 py-2.5 text-right">
                      {p.betterRegime === "tie" ? (
                        <Badge variant="default" className="text-[10px]">Either</Badge>
                      ) : p.betterRegime === "new" ? (
                        <Badge variant="success" className="text-[10px]">New</Badge>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Badge variant="warning" className="text-[10px]">Old saves <Money value={p.betterSaving} compact /></Badge>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    );
  }

  // ---- Form 16 -------------------------------------------------------------
  function Form16Tab({ roster, onView }: { roster: ReturnType<typeof statutoryRoster>; onView: (f: Form16) => void }) {
    return (
      <Card className="overflow-hidden">
        <ToolbarRow
          title={`Form 16 — ${FY_LABEL} (${AY_LABEL})`}
          note="Part A (TDS deposited) + Part B (salary breakup & tax). One certificate per employee."
        />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead><Th cols={["Employee", "Department", "Gross salary (yr)", "TDS deposited", ""]} /></thead>
            <tbody>
              {roster.map((e) => {
                const f = buildForm16(e.id);
                return (
                  <tr key={e.id} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-2.5 font-medium">{e.name}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{departmentName(e.departmentId)}</td>
                    <Num value={f.partB.grossSalary} />
                    <Num value={f.partA.totalTdsDeposited} />
                    <td className="px-5 py-2.5 text-right">
                      <button
                        onClick={() => onView(f)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                      >
                        <FileText className="size-3.5" /> View Form 16
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    );
  }

  // ---- Gratuity & F&F ------------------------------------------------------
  function GratuityTab({ empIds }: { empIds: string[] }) {
    const lines = gratuityLines(empIds);
    const eligible = lines.filter((l) => l.eligible);
    const fnf = fnfSettlements();
    return (
      <div className="space-y-4">
        <Card className="overflow-hidden">
          <ToolbarRow
            title="Gratuity — (15/26) × last basic × completed years"
            note="Payable on exit after ≥ 5 years of continuous service."
            action={<Badge variant="primary">{eligible.length} eligible</Badge>}
          />
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead><Th cols={["Employee", "Joined", "Years", "Last basic", "Eligible", "Gratuity"]} /></thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.empId} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-2.5 font-medium">{l.name}</td>
                    <td className="px-5 py-2.5 text-muted-foreground">{formatDate(l.joinDate)}</td>
                    <td className="px-5 py-2.5 text-right tabular">{l.years}</td>
                    <Num value={l.lastBasic} />
                    <td className="px-5 py-2.5 text-center">
                      {l.eligible
                        ? <Badge variant="success" className="text-[10px]"><Check className="size-3" /> Yes</Badge>
                        : <span className="text-xs text-muted-foreground">&lt; 5 yrs</span>}
                    </td>
                    <Num value={l.amount} bold muted={!l.eligible} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="size-4" /> Full &amp; Final Settlement</CardTitle></CardHeader>
          <CardContent>
            {fnf.length === 0 ? (
              <p className="py-2 text-center text-sm text-muted-foreground">No exited employees pending settlement.</p>
            ) : (
              <div className="space-y-3">
                {fnf.map((f) => (
                  <div key={f.empId} className="rounded-lg border p-4">
                    <div className="flex items-center justify-between border-b pb-2">
                      <div>
                        <p className="font-semibold">{f.name}</p>
                        <p className="text-xs text-muted-foreground">Relieved {formatDate(f.exitDate)}</p>
                      </div>
                      <Badge variant="danger">Exited</Badge>
                    </div>
                    <div className="mt-3 space-y-1">
                      <FnfLine label={`Pending salary (${f.pendingSalaryDays} days)`} value={f.pendingSalary} />
                      <FnfLine label={`Leave encashment (${f.leaveDays} days)`} value={f.leaveEncashment} />
                      <FnfLine label="Gratuity" value={f.gratuity} />
                      <FnfLine label="Less: recoveries" value={-f.recoveries} />
                      <div className="mt-1 flex items-center justify-between rounded-md bg-primary/10 px-3 py-2">
                        <span className="text-sm font-semibold text-primary">Net settlement</span>
                        <span className="text-lg font-bold text-primary"><Money value={f.net} /></span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }
}

// ---- Shared little pieces ---------------------------------------------------

function SummaryCard({ label, value, tone, highlight }: { label: string; value: number; tone: "primary" | "success" | "warning" | "danger"; highlight?: boolean }) {
  const dot = { primary: "bg-primary", success: "bg-success", warning: "bg-warning", danger: "bg-danger" }[tone];
  return (
    <div className={cn("rounded-lg border p-3", highlight && "border-primary/30 bg-primary/5")}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <span className={cn("size-1.5 rounded-full", dot)} /> {label}
      </p>
      <p className="mt-1 text-xl font-bold tabular"><Money value={value} /></p>
    </div>
  );
}

function ToolbarRow({ title, note, action }: { title: string; note?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-b px-5 py-3">
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      </div>
      {action}
    </div>
  );
}

function Th({ cols }: { cols: string[] }) {
  return (
    <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
      {cols.map((c, i) => (
        <th key={i} className={cn("px-5 py-3 font-medium", i > 0 && c !== "" && "text-right")}>{c}</th>
      ))}
    </tr>
  );
}

function Num({ value, bold, muted }: { value: number; bold?: boolean; muted?: boolean }) {
  return (
    <td className={cn("px-5 py-2.5 text-right tabular", bold && "font-semibold", muted && "text-muted-foreground")}>
      <Money value={value} />
    </td>
  );
}

function FnfLine({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular", value < 0 && "text-danger")}>
        {value < 0 ? "−" : ""}<Money value={Math.abs(value)} />
      </span>
    </div>
  );
}

// ---- Form 16 modal ----------------------------------------------------------

function Form16Modal({ form16, onClose }: { form16: Form16; onClose: () => void }) {
  const { partA: a, partB: b } = form16;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="max-h-[90vh] w-full max-w-lg overflow-y-auto p-5 scrollbar-thin" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Form 16 · {a.financialYear} · {a.assessmentYear}</p>
            <h3 className="mt-0.5 font-semibold">{a.employeeName}</h3>
            <p className="text-xs text-muted-foreground">{a.employeeCode} · PAN {a.pan}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        {/* Part A */}
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Part A — TDS deposited</p>
          <div className="rounded-md border p-3 text-sm">
            <KV label="Employer" value={a.employerName} />
            <KV label="TAN" value={a.employerTan} />
            <div className="my-2 border-t" />
            {a.quarterly.map((q) => (
              <div key={q.quarter} className="flex items-center justify-between py-0.5">
                <span className="text-muted-foreground">{q.quarter} — TDS deposited</span>
                <span className="tabular"><Money value={q.tdsDeposited} /></span>
              </div>
            ))}
            <div className="mt-1 flex items-center justify-between border-t pt-1.5 font-semibold">
              <span>Total TDS deposited</span>
              <span className="tabular"><Money value={a.totalTdsDeposited} /></span>
            </div>
          </div>
        </div>

        {/* Part B */}
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Part B — Salary & tax computation
            <Badge variant="primary" className="ml-2 text-[10px] capitalize">{b.regime} regime</Badge>
          </p>
          <div className="rounded-md border p-3 text-sm">
            <KVMoney label="Basic" value={b.basic} />
            <KVMoney label="HRA" value={b.hra} />
            <KVMoney label="Special allowance" value={b.special} />
            <KVMoney label="Gross salary" value={b.grossSalary} bold />
            <div className="my-2 border-t" />
            <KVMoney label="Less: standard deduction" value={-b.standardDeduction} />
            {b.chapterViaDeductions > 0 && <KVMoney label="Less: Chapter VI-A" value={-b.chapterViaDeductions} />}
            <KVMoney label="Taxable income" value={b.taxableIncome} bold />
            <div className="my-2 border-t" />
            <div className="flex items-center justify-between rounded-md bg-foreground/[0.03] px-3 py-2">
              <span className="text-sm font-semibold">Tax payable (incl. cess)</span>
              <span className="text-base font-bold tabular"><Money value={b.cessIncludedTax} /></span>
            </div>
          </div>
        </div>

        <Button className="mt-4 w-full" variant="outline" onClick={onClose}>
          <Download className="size-4" /> Download Form 16 (PDF)
        </Button>
      </Card>
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-0.5">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function KVMoney({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-0.5", bold && "border-t mt-1 pt-1.5 font-semibold")}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className={cn("tabular", value < 0 && "text-danger")}>
        {value < 0 ? "−" : ""}<Money value={Math.abs(value)} />
      </span>
    </div>
  );
}
