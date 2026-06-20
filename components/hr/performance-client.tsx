"use client";

import * as React from "react";
import { X, Target, Award, Grid3x3, BarChart3, ClipboardList, TrendingUp, Check, Star } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { EMPLOYEES, employeeById, employeeName, departmentName, DEPARTMENTS } from "@/lib/hr/employees";
import {
  REVIEW_CYCLES, ACTIVE_CYCLE, cycleById, cycleProgress, PHASE_LABEL,
  ratingLabel, ratingTone, appraisalFor, objectivesFor, objectiveProgress, keyResultProgress,
  ninebox, ratingDistribution, perfSummary, saveAppraisal, saveKeyResultCurrent,
  type Appraisal, type Competency, type Objective, type KeyResult,
} from "@/lib/hr/performance";

type Tab = "appraisals" | "okrs" | "ninebox" | "distribution";

const TABS: { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "appraisals", label: "Appraisals", icon: ClipboardList },
  { id: "okrs", label: "OKRs", icon: Target },
  { id: "ninebox", label: "9-Box", icon: Grid3x3 },
  { id: "distribution", label: "Distribution", icon: BarChart3 },
];

export function PerformanceClient() {
  const [cycleId, setCycleId] = React.useState(ACTIVE_CYCLE.id);
  const [tab, setTab] = React.useState<Tab>("appraisals");
  const [dept, setDept] = React.useState<string>("all");
  const [review, setReview] = React.useState<string | null>(null); // empId under review
  const [version, setVersion] = React.useState(0); // bump to re-read localStorage

  const cycle = cycleById(cycleId) ?? ACTIVE_CYCLE;

  const employees = React.useMemo(
    () => EMPLOYEES.filter((e) => dept === "all" || e.departmentId === dept),
    [dept],
  );
  const empIds = employees.map((e) => e.id);

  // version is a dependency to force recompute after a save.
  const summary = React.useMemo(() => perfSummary(empIds), [empIds, version]);

  function bump() { setVersion((v) => v + 1); }

  return (
    <>
      <PageHeader
        title="Performance & OKRs"
        subtitle={`${cycle.label} appraisal cycle — ${PHASE_LABEL[cycle.phase].toLowerCase()} phase (${cycle.period}).`}
        actions={
          <Select value={cycleId} onChange={(e) => setCycleId(e.target.value)} className="h-9 w-44">
            {REVIEW_CYCLES.map((c) => (
              <option key={c.id} value={c.id}>{c.label}{c.active ? " · active" : ""}</option>
            ))}
          </Select>
        }
      />

      {/* Cycle progress + filter */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold">{cycle.label}</h2>
            <Badge variant={cycle.active ? "primary" : "default"} className="capitalize">{PHASE_LABEL[cycle.phase]}</Badge>
          </div>
          <Select value={dept} onChange={(e) => setDept(e.target.value)} className="h-9 w-52">
            <option value="all">All departments</option>
            {DEPARTMENTS.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </div>
        <div className="mt-3">
          <div className="mb-1 flex justify-between text-xs text-muted-foreground">
            <span>Cycle progress</span>
            <span>{Math.round(cycleProgress(cycle) * 100)}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${cycleProgress(cycle) * 100}%` }} />
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <div className="mb-4 flex flex-wrap gap-1">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                t.id === tab ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <Icon className="size-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {tab === "appraisals" && <AppraisalsTab empIds={empIds} version={version} onReview={setReview} />}
      {tab === "okrs" && <OkrsTab empIds={empIds} version={version} onBump={bump} />}
      {tab === "ninebox" && <NineBoxTab empIds={empIds} version={version} />}
      {tab === "distribution" && <DistributionTab empIds={empIds} summary={summary} version={version} />}

      {review && (
        <ReviewModal
          empId={review}
          onClose={() => setReview(null)}
          onSaved={() => { bump(); setReview(null); }}
        />
      )}
    </>
  );
}

// ---- Appraisals -----------------------------------------------------------

function AppraisalsTab({ empIds, version, onReview }: { empIds: string[]; version: number; onReview: (id: string) => void }) {
  // version forces re-read.
  void version;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3 font-medium">Employee</th>
              <th className="px-5 py-3 font-medium">Department</th>
              <th className="px-5 py-3 font-medium">Designation</th>
              <th className="px-5 py-3 text-center font-medium">Self</th>
              <th className="px-5 py-3 text-center font-medium">Manager</th>
              <th className="px-5 py-3 text-center font-medium">Final</th>
              <th className="px-5 py-3 font-medium">Status</th>
              <th className="px-5 py-3 text-right font-medium">Review</th>
            </tr>
          </thead>
          <tbody>
            {empIds.map((id) => {
              const e = employeeById(id)!;
              const a = appraisalFor(id);
              return (
                <tr key={id} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                  <td className="px-5 py-3 font-medium">{e.name}</td>
                  <td className="px-5 py-3 text-muted-foreground">{departmentName(e.departmentId)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{e.designation}</td>
                  <td className="px-5 py-3 text-center"><RatingBadge n={a.selfRating} muted /></td>
                  <td className="px-5 py-3 text-center"><RatingBadge n={a.managerRating} /></td>
                  <td className="px-5 py-3 text-center"><RatingBadge n={a.finalRating} /></td>
                  <td className="px-5 py-3">
                    <span className="flex items-center gap-1.5">
                      <Badge variant={a.status === "finalised" ? "success" : a.status === "reviewed" ? "primary" : "default"} className="capitalize">
                        {a.status.replace("-", " ")}
                      </Badge>
                      {a.promotionRecommended && <Badge variant="warning"><TrendingUp className="size-3" /> Promo</Badge>}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <button onClick={() => onReview(id)} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <ClipboardList className="size-3.5" /> Review
                    </button>
                  </td>
                </tr>
              );
            })}
            {empIds.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-8 text-center text-sm text-muted-foreground">No employees in this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RatingBadge({ n, muted }: { n: number; muted?: boolean }) {
  return (
    <Badge variant={muted ? "outline" : ratingTone(n)} title={ratingLabel(n)}>
      <Star className="size-3" /> {n.toFixed(0)}
    </Badge>
  );
}

// ---- Review modal ---------------------------------------------------------

function ReviewModal({ empId, onClose, onSaved }: { empId: string; onClose: () => void; onSaved: () => void }) {
  const e = employeeById(empId)!;
  const a = appraisalFor(empId);
  const [managerRating, setManagerRating] = React.useState(a.managerRating);
  const [finalRating, setFinalRating] = React.useState(a.finalRating);
  const [promo, setPromo] = React.useState(a.promotionRecommended);
  const [comps, setComps] = React.useState<Competency[]>(a.competencies.map((c) => ({ ...c })));

  function setComp(i: number, score: number) {
    setComps((prev) => prev.map((c, j) => (j === i ? { ...c, score: Math.max(1, Math.min(5, score)) } : c)));
  }

  function save() {
    saveAppraisal(empId, {
      managerRating,
      finalRating,
      competencies: comps,
      promotionRecommended: promo,
      status: "finalised",
    });
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-5" onClick={(ev) => ev.stopPropagation()}>
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Appraisal · {ACTIVE_CYCLE.label}</p>
            <h3 className="mt-0.5 font-semibold">{e.name}</h3>
            <p className="text-xs text-muted-foreground">{e.designation} · reviewer {employeeName(a.reviewerId)}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="mt-3 grid grid-cols-3 gap-3">
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Self rating</p>
            <p className="mt-1 text-lg font-bold">{a.selfRating} <span className="text-xs font-normal text-muted-foreground">{ratingLabel(a.selfRating)}</span></p>
          </div>
          <RatingPicker label="Manager rating" value={managerRating} onChange={setManagerRating} />
          <RatingPicker label="Final rating" value={finalRating} onChange={setFinalRating} highlight />
        </div>

        <div className="mt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Competencies</p>
          <div className="space-y-2">
            {comps.map((c, i) => (
              <div key={c.name} className="flex items-center gap-3">
                <span className="w-32 text-sm">{c.name}</span>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      onClick={() => setComp(i, n)}
                      className={cn(
                        "size-7 rounded-md border text-xs font-medium transition-colors",
                        c.score >= n ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
                      )}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <span className="ml-auto text-xs text-muted-foreground">{ratingLabel(c.score)}</span>
              </div>
            ))}
          </div>
        </div>

        <label className="mt-4 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={promo} onChange={(ev) => setPromo(ev.target.checked)} className="size-4 rounded border-input" />
          <Award className="size-4 text-warning" /> Recommend for promotion
        </label>

        <div className="mt-5 flex justify-end gap-2 border-t pt-3">
          <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
          <Button size="sm" onClick={save}><Check className="size-4" /> Save appraisal</Button>
        </div>
      </Card>
    </div>
  );
}

function RatingPicker({ label, value, onChange, highlight }: { label: string; value: number; onChange: (n: number) => void; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", highlight && "border-primary/30 bg-primary/5")}>
      <Label className="block">{label}</Label>
      <Select value={String(value)} onChange={(e) => onChange(Number(e.target.value))} className="mt-1 h-8">
        {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} — {ratingLabel(n)}</option>)}
      </Select>
    </div>
  );
}

// ---- OKRs -----------------------------------------------------------------

function OkrsTab({ empIds, version, onBump }: { empIds: string[]; version: number; onBump: () => void }) {
  void version;
  const withObjectives = empIds
    .map((id) => ({ id, objectives: objectivesFor(id) }))
    .filter((x) => x.objectives.length > 0);

  return (
    <div className="space-y-4">
      {withObjectives.map(({ id, objectives }) => {
        const e = employeeById(id)!;
        return (
          <Card key={id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <span className="flex size-7 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {e.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </span>
                {e.name}
                <span className="text-xs font-normal text-muted-foreground">· {departmentName(e.departmentId)}</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 pb-4">
              {objectives.map((obj) => (
                <ObjectiveCard key={obj.id} obj={obj} onBump={onBump} />
              ))}
            </CardContent>
          </Card>
        );
      })}
      {withObjectives.length === 0 && (
        <Card className="p-8 text-center text-sm text-muted-foreground">No objectives for this filter.</Card>
      )}
    </div>
  );
}

function ObjectiveCard({ obj, onBump }: { obj: Objective; onBump: () => void }) {
  const progress = objectiveProgress(obj);
  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-medium"><Target className="size-4 text-primary" /> {obj.title}</p>
        <Badge variant={progress >= 80 ? "success" : progress >= 50 ? "primary" : "warning"}>{progress}%</Badge>
      </div>
      <div className="space-y-2.5">
        {obj.keyResults.map((kr, i) => (
          <KeyResultRow key={i} objId={obj.id} index={i} kr={kr} onBump={onBump} />
        ))}
      </div>
    </div>
  );
}

function KeyResultRow({ objId, index, kr, onBump }: { objId: string; index: number; kr: KeyResult; onBump: () => void }) {
  const pct = keyResultProgress(kr);
  function onCurrent(v: number) {
    saveKeyResultCurrent(objId, index, v);
    onBump();
  }
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{kr.title}</span>
        <span className="flex items-center gap-1.5">
          <Input
            type="number"
            value={kr.current}
            onChange={(e) => onCurrent(Number(e.target.value))}
            className="h-7 w-16 px-2 text-right text-xs"
          />
          <span className="tabular text-muted-foreground">/ {kr.target} {kr.unit}</span>
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full transition-all", pct >= 80 ? "bg-success" : pct >= 50 ? "bg-primary" : "bg-warning")}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

// ---- 9-Box ----------------------------------------------------------------

function NineBoxTab({ empIds, version }: { empIds: string[]; version: number }) {
  void version;
  // Build a 3×3 matrix of employee ids.
  const grid: string[][][] = [0, 1, 2].map((row) => [0, 1, 2].map((col) => {
    return empIds.filter((id) => {
      const cell = ninebox(employeeById(id)!);
      return cell.row === row && cell.col === col;
    });
  }));

  const CELL_TONE = (row: number, col: number) => {
    const score = (2 - row) + col; // 0..4 — higher is better
    if (score >= 4) return "bg-success/10 border-success/30";
    if (score >= 3) return "bg-primary/5 border-primary/20";
    if (score <= 1) return "bg-danger/5 border-danger/20";
    return "bg-card";
  };

  return (
    <Card className="p-4">
      <div className="flex gap-3">
        {/* y-axis */}
        <div className="flex w-6 flex-col items-center justify-between py-2">
          <span className="rotate-180 text-[11px] font-medium uppercase tracking-wider text-muted-foreground [writing-mode:vertical-rl]">Potential →</span>
        </div>
        <div className="flex-1">
          <div className="grid grid-cols-3 gap-2">
            {grid.map((rowCells, row) =>
              rowCells.map((ids, col) => {
                const cellLabel = CELL_LABELS[row][col];
                return (
                  <div key={`${row}-${col}`} className={cn("min-h-28 rounded-lg border p-2", CELL_TONE(row, col))}>
                    <p className="mb-1.5 text-[11px] font-semibold text-muted-foreground">{cellLabel}</p>
                    <div className="flex flex-wrap gap-1">
                      {ids.map((id) => {
                        const e = employeeById(id)!;
                        return (
                          <span key={id} className="rounded-full bg-card px-2 py-0.5 text-[11px] font-medium shadow-sm ring-1 ring-border" title={e.designation}>
                            {e.name.split(" ")[0]} {e.name.split(" ")[1]?.[0] ?? ""}.
                          </span>
                        );
                      })}
                      {ids.length === 0 && <span className="text-[11px] text-muted-foreground/50">—</span>}
                    </div>
                  </div>
                );
              }),
            )}
          </div>
          <div className="mt-2 text-center text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Performance →</div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-3 border-t pt-3 text-xs text-muted-foreground">
        <Legend className="bg-success/40" label="Top talent / stars" />
        <Legend className="bg-primary/40" label="Solid contributors" />
        <Legend className="bg-danger/40" label="At risk / needs attention" />
      </div>
    </Card>
  );
}

const CELL_LABELS: string[][] = [
  ["Rough Diamond", "High Potential", "Star"],
  ["Inconsistent Player", "Core Player", "High Performer"],
  ["Risk", "Effective", "Trusted Professional"],
];

function Legend({ className, label }: { className: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5"><span className={cn("size-3 rounded", className)} /> {label}</span>
  );
}

// ---- Distribution ---------------------------------------------------------

function DistributionTab({ empIds, summary, version }: { empIds: string[]; summary: ReturnType<typeof perfSummary>; version: number }) {
  void version;
  const dist = ratingDistribution(empIds);
  const max = Math.max(1, ...dist.map((d) => d.count));

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <SummaryCard label="Average rating" value={summary.avgRating.toFixed(2)} hint={ratingLabel(summary.avgRating)} icon={Star} />
        <SummaryCard label="% exceeding (4+)" value={`${summary.pctExceeding}%`} hint={`${summary.headcount} reviewed`} icon={TrendingUp} />
        <SummaryCard label="Promotions recommended" value={String(summary.promotions)} hint="this cycle" icon={Award} highlight />
      </div>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><BarChart3 className="size-4" /> Rating distribution</CardTitle></CardHeader>
        <CardContent className="space-y-2 pb-4">
          {[...dist].reverse().map((d) => (
            <div key={d.rating} className="flex items-center gap-3">
              <span className="flex w-28 items-center gap-2 text-xs">
                <Badge variant={ratingTone(d.rating)}>{d.rating}</Badge>
                <span className="text-muted-foreground">{d.label}</span>
              </span>
              <div className="h-5 flex-1 overflow-hidden rounded bg-muted">
                <div
                  className={cn("flex h-full items-center justify-end rounded px-2 text-[11px] font-semibold text-white transition-all",
                    d.rating >= 4 ? "bg-success" : d.rating === 3 ? "bg-primary" : d.rating === 2 ? "bg-warning" : "bg-danger")}
                  style={{ width: `${(d.count / max) * 100}%`, minWidth: d.count > 0 ? "1.75rem" : 0 }}
                >
                  {d.count > 0 ? d.count : ""}
                </div>
              </div>
              <span className="w-8 text-right text-xs tabular text-muted-foreground">{d.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({ label, value, hint, icon: Icon, highlight }: { label: string; value: string; hint?: string; icon: React.ComponentType<{ className?: string }>; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", highlight && "border-primary/30 bg-primary/5")}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <p className="mt-1 text-2xl font-bold tabular">{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </Card>
  );
}
