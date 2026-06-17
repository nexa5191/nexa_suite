"use client";

import * as React from "react";
import { Calculator, Scale, Sparkles, ArrowRight, Info, RotateCcw, TrendingDown } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Input, Label, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EMPLOYEES, employeeById } from "@/lib/hr/employees";
import { salaryStructure } from "@/lib/hr/payroll";
import {
  compareRegimes,
  EMPTY_DEDUCTIONS,
  DEDUCTION_CAPS,
  type Deductions,
  type TaxResult,
  type Regime,
} from "@/lib/hr/tax-calc";

const FY_LABEL = "FY 2025-26 · AY 2026-27";

const DEDUCTION_FIELDS: {
  key: keyof Deductions;
  label: string;
  hint: string;
  cap?: number;
}[] = [
  { key: "sec80C", label: "Section 80C", hint: "EPF, PPF, ELSS, life insurance, principal", cap: DEDUCTION_CAPS.sec80C },
  { key: "nps80CCD1B", label: "NPS — 80CCD(1B)", hint: "Additional NPS contribution", cap: DEDUCTION_CAPS.nps80CCD1B },
  { key: "sec80D", label: "Section 80D", hint: "Health insurance premium", cap: DEDUCTION_CAPS.sec80D },
  { key: "hraExemption", label: "HRA exemption", hint: "Exempt house-rent allowance" },
  { key: "homeLoanInterest", label: "Home loan interest", hint: "Section 24(b), self-occupied", cap: DEDUCTION_CAPS.homeLoanInterest },
  { key: "other", label: "Other deductions", hint: "80E, 80G, 80TTA, etc." },
];

export function TaxCalculatorClient() {
  const [empId, setEmpId] = React.useState("emp-006");
  const [gross, setGross] = React.useState(() => salaryStructure("emp-006").annualCtc);
  const [deductions, setDeductions] = React.useState<Deductions>({
    ...EMPTY_DEDUCTIONS,
    sec80C: 150_000,
    sec80D: 25_000,
    professionalTax: 2_400,
  });

  function loadEmployee(id: string) {
    setEmpId(id);
    if (id) setGross(salaryStructure(id).annualCtc);
  }

  function setDeduction(key: keyof Deductions, value: number) {
    setDeductions((d) => ({ ...d, [key]: Number.isFinite(value) ? Math.max(0, value) : 0 }));
  }

  function reset() {
    setDeductions({ ...EMPTY_DEDUCTIONS, sec80C: 150_000, sec80D: 25_000, professionalTax: 2_400 });
  }

  const cmp = React.useMemo(
    () => compareRegimes({ grossIncome: gross, deductions }),
    [gross, deductions],
  );

  return (
    <>
      <PageHeader
        title="Income Tax Calculator"
        subtitle={`Compare your liability under the Old and New tax regimes — ${FY_LABEL}.`}
        actions={
          <Select value={empId} onChange={(e) => loadEmployee(e.target.value)} className="h-9 w-56">
            <option value="">Custom (enter manually)</option>
            {EMPLOYEES.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}{e.status === "exited" ? " (exited)" : ""}
              </option>
            ))}
          </Select>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[20rem_1fr]">
        {/* ---- Inputs ---------------------------------------------------- */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="size-4" /> Your income
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-1">
                <Label htmlFor="gross">Gross annual salary</Label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                  <Input
                    id="gross"
                    type="number"
                    min={0}
                    step={10000}
                    value={gross || ""}
                    onChange={(e) => setGross(Math.max(0, Number(e.target.value)))}
                    className="pl-7 tabular"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {employeeById(empId)
                    ? `Pre-filled from ${employeeById(empId)!.name}'s CTC — edit freely.`
                    : "Total annual salary before any deductions."}
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2"><Scale className="size-4" /> Deductions</span>
                <button
                  onClick={reset}
                  className="flex items-center gap-1 text-[11px] font-normal text-muted-foreground hover:text-foreground"
                >
                  <RotateCcw className="size-3" /> Reset
                </button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="flex items-start gap-1.5 rounded-md bg-muted/50 p-2 text-[11px] text-muted-foreground">
                <Info className="mt-px size-3.5 shrink-0" />
                These apply to the <span className="font-medium text-foreground">Old regime</span> only. The New regime allows
                just the ₹75,000 standard deduction.
              </p>
              {DEDUCTION_FIELDS.map((f) => (
                <div key={f.key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label htmlFor={f.key}>{f.label}</Label>
                    {f.cap && (
                      <span className="text-[10px] text-muted-foreground">max ₹{f.cap.toLocaleString("en-IN")}</span>
                    )}
                  </div>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                    <Input
                      id={f.key}
                      type="number"
                      min={0}
                      step={5000}
                      value={deductions[f.key] || ""}
                      onChange={(e) => setDeduction(f.key, Number(e.target.value))}
                      className="pl-7 tabular"
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{f.hint}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* ---- Results --------------------------------------------------- */}
        <div className="space-y-4">
          {/* Verdict banner */}
          <Card
            className={cn(
              "flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/5 p-4",
            )}
          >
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
                <TrendingDown className="size-5" />
              </span>
              <div>
                {cmp.better === "tie" ? (
                  <p className="font-semibold">Both regimes cost the same</p>
                ) : (
                  <p className="font-semibold">
                    The{" "}
                    <span className="text-primary">
                      {cmp.better === "new" ? "New" : "Old"} regime
                    </span>{" "}
                    saves you more
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {cmp.better === "tie"
                    ? "Pick either — your liability is identical."
                    : <>You save <span className="font-medium text-success"><Money value={cmp.saving} /></span> a year by choosing it.</>}
                </p>
              </div>
            </div>
            {cmp.better !== "tie" && (
              <Badge variant="success" className="text-xs">
                <Sparkles className="size-3" /> Recommended: {cmp.better === "new" ? "New" : "Old"} regime
              </Badge>
            )}
          </Card>

          {/* Side-by-side */}
          <div className="grid gap-4 sm:grid-cols-2">
            <RegimeCard
              title="Old Regime"
              subtitle="With deductions & exemptions"
              result={cmp.old}
              isBetter={cmp.better === "old"}
            />
            <RegimeCard
              title="New Regime"
              subtitle="Lower slabs, minimal deductions"
              result={cmp.new}
              isBetter={cmp.better === "new"}
            />
          </div>

          {/* Slab breakdown */}
          <div className="grid gap-4 sm:grid-cols-2">
            <SlabCard title="Old Regime — slab-wise" result={cmp.old} />
            <SlabCard title="New Regime — slab-wise" result={cmp.new} />
          </div>

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Indicative only. Computed for a resident individual below 60 for {FY_LABEL} using Finance Act 2025 slabs,
            standard deduction, s.87A rebate, surcharge with marginal relief and 4% health &amp; education cess.
            Deductions are clamped to their statutory caps. Confirm with payroll before declaring your regime.
          </p>
        </div>
      </div>
    </>
  );
}

function RegimeCard({
  title,
  subtitle,
  result,
  isBetter,
}: {
  title: string;
  subtitle: string;
  result: TaxResult;
  isBetter: boolean;
}) {
  return (
    <Card className={cn("overflow-hidden", isBetter && "ring-2 ring-success/50")}>
      <div className={cn("flex items-center justify-between px-5 py-3", isBetter ? "bg-success/10" : "bg-muted/40")}>
        <div>
          <p className="font-semibold">{title}</p>
          <p className="text-[11px] text-muted-foreground">{subtitle}</p>
        </div>
        {isBetter && <Badge variant="success" className="text-[10px]">Best</Badge>}
      </div>
      <CardContent className="space-y-1 pt-4">
        <Line label="Gross income" value={result.grossIncome} />
        <Line label="Standard deduction" value={-result.standardDeduction} />
        {result.otherDeductions > 0 && <Line label="Other deductions" value={-result.otherDeductions} />}
        <Line label="Taxable income" value={result.taxableIncome} bold />
        <div className="my-2 border-t" />
        <Line label="Tax on slabs" value={result.slabTax} muted />
        {result.rebate87A > 0 && <Line label="Less: s.87A rebate" value={-result.rebate87A} muted />}
        {result.rebateMarginalRelief > 0 && <Line label="Less: marginal relief" value={-result.rebateMarginalRelief} muted />}
        {result.surcharge > 0 && <Line label="Surcharge" value={result.surcharge} muted />}
        {result.cess > 0 && <Line label="Health & education cess (4%)" value={result.cess} muted />}
        <div className="mt-2 flex items-center justify-between rounded-lg bg-foreground/[0.03] px-3 py-2.5">
          <span className="text-sm font-semibold">Total tax</span>
          <span className="text-lg font-bold tabular"><Money value={result.totalTax} /></span>
        </div>
        <div className="flex items-center justify-between px-3 pt-1 text-xs text-muted-foreground">
          <span>Effective rate</span>
          <span className="tabular">{(result.effectiveRate * 100).toFixed(1)}%</span>
        </div>
        <div className="flex items-center justify-between px-3 text-xs text-muted-foreground">
          <span>Take-home (post-tax)</span>
          <span className="tabular"><Money value={result.takeHome} /></span>
        </div>
      </CardContent>
    </Card>
  );
}

function SlabCard({ title, result }: { title: string; result: TaxResult }) {
  const active = result.slabwise.filter((r) => r.taxable > 0);
  return (
    <Card>
      <CardHeader><CardTitle className="text-xs uppercase tracking-wide text-muted-foreground">{title}</CardTitle></CardHeader>
      <CardContent>
        {active.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">No taxable income in any slab.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="pb-1.5 font-medium">Slab</th>
                <th className="pb-1.5 text-right font-medium">Rate</th>
                <th className="pb-1.5 text-right font-medium">Tax</th>
              </tr>
            </thead>
            <tbody>
              {active.map((r, i) => (
                <tr key={i} className="border-t">
                  <td className="py-1.5 text-muted-foreground">{slabLabel(r.from, r.to)}</td>
                  <td className="py-1.5 text-right tabular">{(r.rate * 100).toFixed(0)}%</td>
                  <td className="py-1.5 text-right tabular"><Money value={r.tax} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
    </Card>
  );
}

function slabLabel(from: number, to: number | null): string {
  const f = (n: number) => `₹${(n / 100_000).toFixed(n % 100_000 === 0 ? 0 : 1)}L`;
  if (to === null) return `Above ${f(from)}`;
  return `${f(from)} – ${f(to)}`;
}

function Line({ label, value, bold, muted }: { label: string; value: number; bold?: boolean; muted?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-0.5 text-sm", bold && "border-t pt-1.5 font-semibold")}>
      <span className={cn(muted && "text-muted-foreground", !bold && !muted && "text-muted-foreground")}>{label}</span>
      <span className={cn("tabular", value < 0 && "text-danger")}>
        {value < 0 ? "−" : ""}<Money value={Math.abs(value)} />
      </span>
    </div>
  );
}
