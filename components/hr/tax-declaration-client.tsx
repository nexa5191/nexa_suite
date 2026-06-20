"use client";

import * as React from "react";
import {
  FileSignature, Scale, ShieldCheck, Sparkles, Info, Send, Check, Clock, X, Upload, Wallet, TrendingDown,
  Download, RotateCcw, UserCircle2,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Input, Label } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { employeeById } from "@/lib/hr/employees";
import { usePortalEmployee, DEFAULT_PORTAL_EMP } from "@/lib/hr/portal-session";
import { printDocument } from "@/lib/export";
import { DEDUCTION_CAPS, type Deductions } from "@/lib/hr/tax-calc";
import {
  defaultDeclaration, loadDeclaration, saveDeclaration, submitToPayroll, projectTds,
  type Declaration, type ProofSection, type ProofStatus, type TdsProjectionResult,
} from "@/lib/hr/tax-declaration";

const FY_LABEL = "FY 2025-26 · AY 2026-27";

const SECTIONS: {
  key: ProofSection;
  dKey: keyof Deductions;
  label: string;
  hint: string;
  cap?: number;
}[] = [
  { key: "sec80C", dKey: "sec80C", label: "Section 80C", hint: "EPF, PPF, ELSS, life insurance, principal", cap: DEDUCTION_CAPS.sec80C },
  { key: "sec80D", dKey: "sec80D", label: "Section 80D", hint: "Health insurance premium", cap: DEDUCTION_CAPS.sec80D },
  { key: "nps80CCD1B", dKey: "nps80CCD1B", label: "NPS — 80CCD(1B)", hint: "Additional NPS contribution", cap: DEDUCTION_CAPS.nps80CCD1B },
  { key: "hraExemption", dKey: "hraExemption", label: "HRA exemption", hint: "Exempt house-rent allowance" },
  { key: "homeLoanInterest", dKey: "homeLoanInterest", label: "Home loan interest", hint: "Section 24(b), self-occupied", cap: DEDUCTION_CAPS.homeLoanInterest },
  { key: "other", dKey: "other", label: "Other deductions", hint: "80E, 80G, 80TTA, etc." },
];

const STATUS_META: Record<ProofStatus, { label: string; variant: "default" | "primary" | "success" | "warning" | "danger"; icon: React.ComponentType<{ className?: string }> }> = {
  pending: { label: "Not declared", variant: "default", icon: Clock },
  submitted: { label: "Proof submitted", variant: "primary", icon: Upload },
  verified: { label: "Verified", variant: "success", icon: Check },
  rejected: { label: "Rejected", variant: "danger", icon: X },
};

export function TaxDeclarationClient() {
  const [empId] = usePortalEmployee();
  const emp = employeeById(empId);
  // SSR-equal default first; the persisted declaration loads in the effect below.
  const [decl, setDecl] = React.useState<Declaration>(() => defaultDeclaration(DEFAULT_PORTAL_EMP));
  const [justSubmitted, setJustSubmitted] = React.useState(false);

  // Reload the persisted declaration whenever the employee changes.
  React.useEffect(() => {
    setDecl(loadDeclaration(empId));
    setJustSubmitted(false);
  }, [empId]);

  const projection = React.useMemo(() => projectTds(empId, decl), [empId, decl]);

  // A change to the declaration un-submits it and drops any acknowledgement —
  // the employee must re-submit for the revised figures to reach payroll.
  function update(mut: (d: Declaration) => Declaration) {
    setDecl((d) => mut({ ...d, submitted: false, acknowledgement: undefined }));
    setJustSubmitted(false);
  }

  function setRegime(regime: Declaration["regime"]) {
    update((d) => ({ ...d, regime }));
  }

  function setSection(key: ProofSection, dKey: keyof Deductions, value: number) {
    const v = Number.isFinite(value) ? Math.max(0, value) : 0;
    update((d) => ({
      ...d,
      deductions: { ...d.deductions, [dKey]: v },
      proofs: { ...d.proofs, [key]: { ...d.proofs[key], declared: v } },
    }));
  }

  // Submitting a single proof is an explicit action — persist it so the
  // submitted state survives a reload.
  function submitProof(key: ProofSection) {
    setDecl((d) => saveDeclaration({
      ...d,
      proofs: { ...d.proofs, [key]: { ...d.proofs[key], status: "submitted" } },
    }));
  }

  function submitDeclaration() {
    setDecl(submitToPayroll(decl));
    setJustSubmitted(true);
  }

  // Re-open a submitted declaration for editing (clears the lock, keeps figures).
  function revise() {
    setDecl((d) => ({ ...d, submitted: false, acknowledgement: undefined }));
    setJustSubmitted(false);
  }

  function downloadAcknowledgement() {
    if (!decl.acknowledgement) return;
    printDocument(
      `Tax Declaration Acknowledgement — ${decl.acknowledgement.ref}`,
      ackHtml(decl, emp?.name ?? empId, emp?.code, projection),
    );
  }

  const oldRegime = decl.regime === "old";
  const ack = decl.acknowledgement;

  return (
    <>
      <PageHeader
        title="Tax Declaration"
        subtitle={`Declare your investments and choose a regime — payroll projects your TDS. ${FY_LABEL}.`}
        actions={
          <Badge variant="outline" className="gap-1.5 px-2.5 py-1 text-xs font-normal">
            <UserCircle2 className="size-3.5" /> {emp ? emp.name : empId}
          </Badge>
        }
      />

      {/* Recommendation banner */}
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 border-primary/30 bg-primary/5 p-4">
        <div className="flex items-center gap-3">
          <span className="flex size-10 items-center justify-center rounded-full bg-primary/15 text-primary">
            <TrendingDown className="size-5" />
          </span>
          <div>
            {projection.betterRegime === "tie" ? (
              <p className="font-semibold">Both regimes cost the same</p>
            ) : (
              <p className="font-semibold">
                The <span className="text-primary">{projection.betterRegime === "new" ? "New" : "Old"} regime</span> is cheaper for you
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              {projection.betterRegime === "tie" ? (
                "Pick either — your liability is identical."
              ) : projection.chosenIsBest ? (
                <>You have chosen the better regime — saving <span className="font-medium text-success"><Money value={projection.saving} /></span>/yr.</>
              ) : (
                <>Switching could save <span className="font-medium text-success"><Money value={projection.saving} /></span>/yr.</>
              )}
            </p>
          </div>
        </div>
        {projection.betterRegime !== "tie" && (
          <Badge variant="success" className="text-xs">
            <Sparkles className="size-3" /> Recommended: {projection.betterRegime === "new" ? "New" : "Old"} regime
          </Badge>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* ---- Declaration form ---------------------------------------- */}
        <div className="space-y-4">
          {/* Regime toggle */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Scale className="size-4" /> Choose your tax regime</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                <RegimeOption
                  active={oldRegime}
                  title="Old Regime"
                  subtitle="With deductions & exemptions"
                  tax={projection.comparison.old.totalTax}
                  onClick={() => setRegime("old")}
                />
                <RegimeOption
                  active={!oldRegime}
                  title="New Regime"
                  subtitle="Lower slabs, standard deduction only"
                  tax={projection.comparison.new.totalTax}
                  onClick={() => setRegime("new")}
                />
              </div>
            </CardContent>
          </Card>

          {/* Investment proofs */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldCheck className="size-4" /> Investment declaration & proofs</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className={cn(
                "flex items-start gap-1.5 rounded-md p-2 text-[11px]",
                oldRegime ? "bg-muted/50 text-muted-foreground" : "bg-warning/10 text-muted-foreground",
              )}>
                <Info className="mt-px size-3.5 shrink-0" />
                {oldRegime
                  ? <span>These deductions reduce your taxable income under the <span className="font-medium text-foreground">Old regime</span>. Submit proofs for payroll to verify.</span>
                  : <span>You have chosen the <span className="font-medium text-foreground">New regime</span> — only the ₹75,000 standard deduction applies, so declared investments do not change your TDS. Switch to Old to claim them.</span>}
              </p>

              {SECTIONS.map((sec) => {
                const proof = decl.proofs[sec.key];
                const meta = STATUS_META[proof.status];
                const StatusIcon = meta.icon;
                return (
                  <div key={sec.key} className={cn("rounded-lg border p-3", !oldRegime && "opacity-60")}>
                    <div className="flex items-center justify-between">
                      <Label htmlFor={sec.key} className="text-sm font-medium text-foreground">{sec.label}</Label>
                      <Badge variant={meta.variant} className="text-[10px]"><StatusIcon className="size-3" /> {meta.label}</Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{sec.hint}</p>
                    <div className="mt-2 flex items-center gap-2">
                      <div className="relative flex-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">₹</span>
                        <Input
                          id={sec.key}
                          type="number"
                          min={0}
                          step={5000}
                          value={proof.declared || ""}
                          onChange={(e) => setSection(sec.key, sec.dKey, Number(e.target.value))}
                          className="pl-7 tabular"
                          disabled={!oldRegime}
                        />
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={decl.submitted || !oldRegime || proof.declared <= 0 || proof.status === "submitted" || proof.status === "verified"}
                        onClick={() => submitProof(sec.key)}
                      >
                        <Upload className="size-4" /> Submit proof
                      </Button>
                    </div>
                    {sec.cap && (
                      <p className="mt-1 text-[10px] text-muted-foreground">Max claimable ₹{sec.cap.toLocaleString("en-IN")}</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* ---- TDS projection ------------------------------------------ */}
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <div className={cn("flex items-center justify-between px-5 py-3", "bg-primary/5")}>
              <div>
                <p className="font-semibold capitalize">{decl.regime} regime — TDS projection</p>
                <p className="text-[11px] text-muted-foreground">Based on your declaration</p>
              </div>
              <FileSignature className="size-5 text-primary" />
            </div>
            <CardContent className="space-y-1 pt-4">
              <Line label="Annual salary (CTC)" value={projection.annualSalary} />
              <Line label="Taxable income" value={(decl.regime === "old" ? projection.comparison.old : projection.comparison.new).taxableIncome} />
              <div className="my-2 border-t" />
              <div className="flex items-center justify-between rounded-lg bg-foreground/[0.03] px-3 py-2.5">
                <span className="text-sm font-semibold">Annual tax</span>
                <span className="text-lg font-bold tabular"><Money value={projection.annualTax} /></span>
              </div>
              <div className="mt-2 flex items-center justify-between rounded-lg bg-danger/10 px-3 py-2.5">
                <span className="flex items-center gap-1.5 text-sm font-semibold text-danger"><Wallet className="size-4" /> Monthly TDS</span>
                <span className="text-lg font-bold tabular text-danger"><Money value={projection.monthlyTds} /></span>
              </div>
              <div className="flex items-center justify-between px-3 pt-2 text-xs text-muted-foreground">
                <span>Annual take-home (post-tax)</span>
                <span className="tabular"><Money value={projection.takeHome} /></span>
              </div>
            </CardContent>
          </Card>

          {/* Submit to payroll / acknowledgement receipt */}
          {decl.submitted && ack ? (
            <Card className="overflow-hidden">
              <div className="flex items-center gap-2 bg-success/10 px-4 py-3 text-success">
                <Check className="size-4" />
                <span className="text-sm font-semibold">Submitted to payroll</span>
                {justSubmitted && <Badge variant="success" className="ml-auto text-[10px]">Just now</Badge>}
              </div>
              <CardContent className="space-y-2 pt-4 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-mono text-xs font-semibold">{ack.ref}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Submitted</span>
                  <span className="tabular">{formatDateTime(ack.submittedAt)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Regime</span>
                  <span className="font-medium capitalize">{decl.regime}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Proofs submitted</span>
                  <span className="font-medium">{proofsSubmittedCount(decl)} of {SECTIONS.length}</span>
                </div>
                <div className="mt-3 flex gap-2 border-t pt-3">
                  <Button variant="outline" className="flex-1" onClick={downloadAcknowledgement}>
                    <Download className="size-4" /> Acknowledgement
                  </Button>
                  <Button variant="ghost" onClick={revise}>
                    <RotateCcw className="size-4" /> Revise
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="p-4">
              <p className="mb-3 text-xs text-muted-foreground">
                Submitting locks your regime election and forwards your declared proofs to payroll for verification.
                You&apos;ll get a dated acknowledgement reference you can download.
              </p>
              <Button className="mt-1 w-full" onClick={submitDeclaration}>
                <Send className="size-4" /> Submit declaration to payroll
              </Button>
            </Card>
          )}

          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Indicative TDS only, computed on annual CTC for {FY_LABEL} using the income-tax engine. Final TDS depends on
            payroll&apos;s verification of your submitted proofs.
          </p>
        </div>
      </div>
    </>
  );
}

function RegimeOption({ active, title, subtitle, tax, onClick }: { active: boolean; title: string; subtitle: string; tax: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-accent/50",
      )}
    >
      <div className="flex items-center justify-between">
        <p className="font-semibold">{title}</p>
        {active && <Badge variant="primary" className="text-[10px]"><Check className="size-3" /> Selected</Badge>}
      </div>
      <p className="text-[11px] text-muted-foreground">{subtitle}</p>
      <p className="mt-2 text-lg font-bold tabular"><Money value={tax} /></p>
      <p className="text-[11px] text-muted-foreground">tax / year</p>
    </button>
  );
}

function Line({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between py-0.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular"><Money value={value} /></span>
    </div>
  );
}

function proofsSubmittedCount(decl: Declaration): number {
  return SECTIONS.filter((s) => {
    const st = decl.proofs[s.key].status;
    return st === "submitted" || st === "verified";
  }).length;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return `${formatDate(iso)}, ${d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}`;
}

const inr = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;

/** Printable acknowledgement (print-to-PDF) for a submitted declaration. */
function ackHtml(decl: Declaration, empName: string, empCode: string | undefined, proj: TdsProjectionResult): string {
  const ack = decl.acknowledgement!;
  const proofRows = SECTIONS.map((s) => {
    const p = decl.proofs[s.key];
    return `<tr><td>${s.label}</td><td class="n">${inr(p.declared)}</td><td>${STATUS_META[p.status].label}</td></tr>`;
  }).join("");
  return `
    <h1>Investment Declaration — Acknowledgement</h1>
    <div class="sub">${FY_LABEL} · NEXA Payroll</div>
    <table style="margin-bottom:14px">
      <tr><th style="width:30%">Reference</th><td>${ack.ref}</td></tr>
      <tr><th>Employee</th><td>${empName}${empCode ? ` (${empCode})` : ""}</td></tr>
      <tr><th>Submitted</th><td>${new Date(ack.submittedAt).toLocaleString("en-IN")}</td></tr>
      <tr><th>Tax regime elected</th><td style="text-transform:capitalize">${decl.regime} regime</td></tr>
    </table>
    <h1 style="font-size:14px">Declared investments &amp; proofs</h1>
    <table>
      <thead><tr><th>Section</th><th class="n">Declared</th><th>Proof status</th></tr></thead>
      <tbody>${proofRows}</tbody>
    </table>
    <h1 style="font-size:14px;margin-top:16px">Projected TDS</h1>
    <table>
      <tr><th style="width:50%">Annual salary (CTC)</th><td class="n">${inr(proj.annualSalary)}</td></tr>
      <tr><th>Annual tax (${decl.regime} regime)</th><td class="n">${inr(proj.annualTax)}</td></tr>
      <tr><th>Monthly TDS</th><td class="n">${inr(proj.monthlyTds)}</td></tr>
    </table>
    <p class="sub" style="margin-top:18px">
      This is a system-generated acknowledgement of the declaration submitted to payroll. Final TDS is subject to
      payroll's verification of the submitted proofs. Indicative figures computed on annual CTC for ${FY_LABEL}.
    </p>`;
}
