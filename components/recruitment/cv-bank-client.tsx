"use client";

import * as React from "react";
import { Search, FileText, Star, Users, Briefcase, MapPin, Mail, Phone, Calendar, Building2, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { locationById } from "@/lib/accounting/org";
import { departmentName, employeeName } from "@/lib/hr/employees";
import { Drawer } from "@/components/ui/modal";
import { useRecruitment } from "@/components/recruitment/recruitment-provider";
import {
  OPENINGS,
  AGENCIES,
  openingById,
  agencyById,
  commissionAmount,
  STAGE_ORDER,
  type Candidate,
  type Opening,
  type CandidateStage,
  type OpeningStatus,
} from "@/lib/recruitment";

const STAGE_TONE: Record<CandidateStage, "default" | "primary" | "warning" | "success" | "danger"> = {
  new: "default",
  screening: "default",
  shortlisted: "primary",
  interview: "warning",
  offer: "success",
  hired: "success",
  archived: "danger",
};
const OPENING_TONE: Record<OpeningStatus, "success" | "warning" | "default"> = {
  open: "success",
  "on-hold": "warning",
  closed: "default",
};

export function CvBankClient() {
  const { candidates, setStage: setCandidateStage } = useRecruitment();
  const [tab, setTab] = React.useState<"candidates" | "openings" | "agencies">("candidates");
  const [q, setQ] = React.useState("");
  const [stage, setStage] = React.useState("all");
  const [opening, setOpening] = React.useState("all");
  const [minExp, setMinExp] = React.useState("0");
  const [candidateId, setCandidateId] = React.useState<string | null>(null);
  const [openingDetail, setOpeningDetail] = React.useState<Opening | null>(null);

  const candidate = candidateId ? candidates.find((c) => c.id === candidateId) ?? null : null;
  const setCandidate = (c: Candidate | null) => setCandidateId(c?.id ?? null);
  const forOpening = (id: string) => candidates.filter((c) => c.openingId === id);

  const term = q.trim().toLowerCase();
  const rows = candidates.filter((c) => {
    if (stage !== "all" && c.stage !== stage) return false;
    if (opening !== "all" && (opening === "pool" ? c.openingId !== null : c.openingId !== opening)) return false;
    if (c.experienceYears < Number(minExp)) return false;
    if (term && !`${c.name} ${c.desiredRole} ${c.currentCompany} ${c.skills.join(" ")}`.toLowerCase().includes(term))
      return false;
    return true;
  });

  function viewOpening(id: string) {
    setOpening(id);
    setTab("candidates");
  }

  return (
    <>
      <PageHeader
        title="CV Bank"
        subtitle="Talent pool and live openings — search résumés for current and future roles."
        actions={
          <Badge variant="primary" className="h-7 px-3">
            <Users className="size-3.5" /> {candidates.length} candidates
          </Badge>
        }
      />

      <div className="mb-4 flex gap-1">
        {(["candidates", "openings", "agencies"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              tab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {t === "openings"
              ? `Openings (${OPENINGS.filter((o) => o.status === "open").length} open)`
              : t === "agencies"
                ? "Agencies & Commissions"
                : "Candidates"}
          </button>
        ))}
      </div>

      {tab === "candidates" ? (
        <>
          <Card className="mb-4 p-3">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="Search name, skill, company…" value={q} onChange={(e) => setQ(e.target.value)} />
              </div>
              <Select value={stage} onChange={(e) => setStage(e.target.value)}>
                <option value="all">All stages</option>
                {(["new", "screening", "shortlisted", "interview", "offer", "hired", "archived"] as CandidateStage[]).map((s) => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </Select>
              <Select value={opening} onChange={(e) => setOpening(e.target.value)}>
                <option value="all">All openings</option>
                <option value="pool">General talent pool</option>
                {OPENINGS.map((o) => (
                  <option key={o.id} value={o.id}>{o.title}</option>
                ))}
              </Select>
              <Select value={minExp} onChange={(e) => setMinExp(e.target.value)}>
                <option value="0">Any experience</option>
                <option value="2">2+ years</option>
                <option value="5">5+ years</option>
                <option value="8">8+ years</option>
              </Select>
            </div>
          </Card>

          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <p className="text-sm font-medium">Candidates</p>
              <span className="text-xs text-muted-foreground">{rows.length} shown</span>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-5 py-3 font-medium">Candidate</th>
                    <th className="px-5 py-3 font-medium">Skills</th>
                    <th className="px-5 py-3 text-right font-medium">Exp</th>
                    <th className="px-5 py-3 font-medium">Source</th>
                    <th className="px-5 py-3 font-medium">Opening</th>
                    <th className="px-5 py-3 font-medium">Stage</th>
                    <th className="px-5 py-3 font-medium">Résumé</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 && (
                    <tr><td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">No candidates match these filters</td></tr>
                  )}
                  {rows.map((c) => {
                    const op = openingById(c.openingId);
                    return (
                      <tr
                        key={c.id}
                        onClick={() => setCandidate(c)}
                        className="cursor-pointer border-b align-top transition-colors last:border-0 hover:bg-accent/50"
                      >
                        <td className="px-5 py-3">
                          <p className="flex items-center gap-2 font-medium">
                            {c.name}
                            <span className="flex items-center gap-0.5 text-xs text-warning"><Star className="size-3 fill-current" />{c.rating}</span>
                          </p>
                          <p className="text-xs text-muted-foreground">{c.desiredRole} · {c.currentCompany}</p>
                          <p className="text-[11px] text-muted-foreground">{c.location} · {c.noticePeriodDays}d notice · ₹{c.expectedCtcLakh}L</p>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex max-w-[220px] flex-wrap gap-1">
                            {c.skills.map((s) => (
                              <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">{s}</span>
                            ))}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-right tabular">{c.experienceYears}y</td>
                        <td className="px-5 py-3 capitalize text-muted-foreground">
                          {c.source}
                          {c.agencyId && <span className="block text-[11px] normal-case">{agencyById(c.agencyId)?.name}</span>}
                        </td>
                        <td className="px-5 py-3">
                          {op ? <span className="text-xs">{op.title}</span> : <Badge variant="outline">Talent pool</Badge>}
                        </td>
                        <td className="px-5 py-3"><Badge variant={STAGE_TONE[c.stage]} className="capitalize">{c.stage}</Badge></td>
                        <td className="px-5 py-3">
                          <span className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                            <FileText className="size-3.5" /> CV
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      ) : tab === "openings" ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {OPENINGS.map((o) => {
            const count = forOpening(o.id).length;
            return (
              <Card
                key={o.id}
                onClick={() => setOpeningDetail(o)}
                className="flex cursor-pointer flex-col p-4 transition-colors hover:border-primary/40 hover:bg-accent/40"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-semibold leading-tight">{o.title}</p>
                    <p className="text-xs text-muted-foreground">{departmentName(o.departmentId)}</p>
                  </div>
                  <Badge variant={OPENING_TONE[o.status]} className="capitalize">{o.status}</Badge>
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <p className="flex items-center gap-1.5"><MapPin className="size-3.5" /> {locationById(o.locationId)?.name}</p>
                  <p className="flex items-center gap-1.5"><Briefcase className="size-3.5" /> {o.positions} position{o.positions === 1 ? "" : "s"} · {o.type}</p>
                  <p>Hiring manager: {employeeName(o.hiringManagerId)}</p>
                  <p>Posted {formatDate(o.postedOn)}</p>
                </div>
                <div className="mt-3 flex items-center justify-between border-t pt-3">
                  <span className="text-sm font-medium">{count} candidate{count === 1 ? "" : "s"}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); viewOpening(o.id); }}
                    className="text-xs font-medium text-primary hover:underline"
                  >
                    View pipeline →
                  </button>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <AgenciesTab candidates={candidates} />
      )}

      {/* Candidate detail */}
      <Drawer
        open={candidate !== null}
        onClose={() => setCandidate(null)}
        title={candidate?.name}
        subtitle={candidate ? `${candidate.desiredRole} · ${candidate.currentCompany}` : undefined}
        actions={
          candidate && (
            <span className="flex items-center gap-0.5 text-sm text-warning"><Star className="size-3.5 fill-current" />{candidate.rating}</span>
          )
        }
      >
        {candidate && (
          <div className="space-y-5 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={STAGE_TONE[candidate.stage]} className="capitalize">{candidate.stage}</Badge>
              {openingById(candidate.openingId) ? (
                <Badge variant="primary">{openingById(candidate.openingId)!.title}</Badge>
              ) : (
                <Badge variant="outline">General talent pool</Badge>
              )}
              <Badge variant="default" className="capitalize">{candidate.source}</Badge>
              {candidate.agencyId && <Badge variant="warning">{agencyById(candidate.agencyId)?.name}</Badge>}
            </div>

            {/* Move stage — drives agency commission on hire */}
            <div className="rounded-lg border bg-muted/20 p-3">
              <Label htmlFor="cand-stage">Move to stage</Label>
              <Select
                id="cand-stage"
                value={candidate.stage}
                onChange={(e) => setCandidateStage(candidate.id, e.target.value as CandidateStage)}
                className="mt-1"
              >
                {STAGE_ORDER.map((s) => (
                  <option key={s} value={s} className="capitalize">{s}</option>
                ))}
              </Select>
              {candidate.agencyId && (
                <p className="mt-2 flex items-center gap-1.5 text-sm">
                  <Wallet className="size-4 text-muted-foreground" />
                  Agency commission{" "}
                  <span className={cn("font-semibold", candidate.stage === "hired" ? "text-success" : "text-muted-foreground")}>
                    <Money value={commissionAmount(candidate.expectedCtcLakh, agencyById(candidate.agencyId))} />
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {candidate.stage === "hired" ? "— payable (hired)" : "— on successful hire"}
                  </span>
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Detail label="Experience" value={`${candidate.experienceYears} years`} />
              <Detail label="Location" value={candidate.location} />
              <Detail label="Notice period" value={`${candidate.noticePeriodDays} days`} />
              <Detail label="Expected CTC" value={`₹${candidate.expectedCtcLakh}L`} />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Skills</p>
              <div className="flex flex-wrap gap-1.5">
                {candidate.skills.map((s) => (
                  <span key={s} className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">{s}</span>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Applied to</p>
              {openingById(candidate.openingId) ? (
                <button
                  onClick={() => { setOpeningDetail(openingById(candidate.openingId)!); setCandidate(null); }}
                  className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent/50"
                >
                  <Briefcase className="size-4 text-muted-foreground" />
                  <span className="flex-1">
                    <span className="block font-medium">{openingById(candidate.openingId)!.title}</span>
                    <span className="block text-xs text-muted-foreground">{departmentName(openingById(candidate.openingId)!.departmentId)}</span>
                  </span>
                  <span className="text-xs text-primary">View →</span>
                </button>
              ) : (
                <p className="text-muted-foreground">Kept in the general talent pool for future openings.</p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Contact</p>
              <p className="flex items-center gap-2"><Mail className="size-4 text-muted-foreground" /> {candidate.email}</p>
              <p className="flex items-center gap-2"><Phone className="size-4 text-muted-foreground" /> {candidate.phone}</p>
              <p className="flex items-center gap-2"><Calendar className="size-4 text-muted-foreground" /> Applied {formatDate(candidate.appliedOn)}</p>
            </div>

            <Button variant="outline" size="sm" className="w-full">
              <FileText className="size-4" /> {candidate.resumeFile}
            </Button>
          </div>
        )}
      </Drawer>

      {/* Opening detail */}
      <Drawer
        open={openingDetail !== null}
        onClose={() => setOpeningDetail(null)}
        title={openingDetail?.title}
        subtitle={openingDetail ? departmentName(openingDetail.departmentId) : undefined}
        actions={
          openingDetail && (
            <Badge variant={OPENING_TONE[openingDetail.status]} className="capitalize">{openingDetail.status}</Badge>
          )
        }
      >
        {openingDetail && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <Detail label="Location" value={locationById(openingDetail.locationId)?.name} />
              <Detail label="Seniority" value={<span className="capitalize">{openingDetail.type}</span>} />
              <Detail label="Positions" value={openingDetail.positions} />
              <Detail label="Posted" value={formatDate(openingDetail.postedOn)} />
              <Detail label="Hiring manager" value={employeeName(openingDetail.hiringManagerId)} />
              <Detail label="Department" value={departmentName(openingDetail.departmentId)} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Matching candidates ({forOpening(openingDetail.id).length})
                </p>
                <button
                  onClick={() => { viewOpening(openingDetail.id); setOpeningDetail(null); }}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  View pipeline →
                </button>
              </div>
              <div className="space-y-1.5">
                {forOpening(openingDetail.id).length === 0 && (
                  <p className="text-muted-foreground">No candidates tagged to this opening yet.</p>
                )}
                {forOpening(openingDetail.id).map((c) => (
                  <button
                    key={c.id}
                    onClick={() => { setCandidate(c); setOpeningDetail(null); }}
                    className="flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors hover:bg-accent/50"
                  >
                    <Building2 className="size-4 text-muted-foreground" />
                    <span className="flex-1 min-w-0">
                      <span className="block truncate font-medium">{c.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{c.currentCompany} · {c.experienceYears}y</span>
                    </span>
                    <Badge variant={STAGE_TONE[c.stage]} className="capitalize">{c.stage}</Badge>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function AgenciesTab({ candidates }: { candidates: Candidate[] }) {
  const rows = AGENCIES.map((ag) => {
    const subs = candidates.filter((c) => c.agencyId === ag.id);
    const hired = subs.filter((c) => c.stage === "hired");
    const active = subs.filter((c) => c.stage !== "hired" && c.stage !== "archived");
    const earned = hired.reduce((s, c) => s + commissionAmount(c.expectedCtcLakh, ag), 0);
    const pipeline = active.reduce((s, c) => s + commissionAmount(c.expectedCtcLakh, ag), 0);
    return { ag, submitted: subs.length, hired: hired.length, earned, pipeline };
  });
  const totalEarned = rows.reduce((s, r) => s + r.earned, 0);
  const totalPipeline = rows.reduce((s, r) => s + r.pipeline, 0);

  return (
    <>
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">Active agencies</p>
          <p className="mt-0.5 text-lg font-bold">{AGENCIES.length}</p>
        </Card>
        <Card className="p-4">
          <p className="flex items-center gap-1 text-xs text-muted-foreground"><Wallet className="size-3.5" /> Commission earned (hired)</p>
          <p className="mt-0.5 text-lg font-bold text-success tabular"><Money value={totalEarned} /></p>
        </Card>
        <Card className="p-4">
          <p className="text-xs text-muted-foreground">In pipeline (potential)</p>
          <p className="mt-0.5 text-lg font-bold tabular"><Money value={totalPipeline} /></p>
        </Card>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Agency</th>
              <th className="px-4 py-2.5 font-medium">SPOC</th>
              <th className="px-4 py-2.5 text-right font-medium">Rate</th>
              <th className="px-4 py-2.5 text-right font-medium">Submitted</th>
              <th className="px-4 py-2.5 text-right font-medium">Hired</th>
              <th className="px-4 py-2.5 text-right font-medium">Earned</th>
              <th className="px-4 py-2.5 text-right font-medium">Pipeline</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ ag, submitted, hired, earned, pipeline }) => (
              <tr key={ag.id} className="border-b border-border/40 last:border-0 hover:bg-accent/30">
                <td className="px-4 py-2.5">
                  <p className="font-medium">{ag.name}</p>
                  <p className="text-xs text-muted-foreground">{ag.email}</p>
                </td>
                <td className="px-4 py-2.5 text-muted-foreground">{ag.spoc}</td>
                <td className="px-4 py-2.5 text-right tabular">{ag.commissionPct}%</td>
                <td className="px-4 py-2.5 text-right tabular">{submitted}</td>
                <td className="px-4 py-2.5 text-right tabular">{hired}</td>
                <td className="px-4 py-2.5 text-right tabular font-medium text-success"><Money value={earned} /></td>
                <td className="px-4 py-2.5 text-right tabular text-muted-foreground"><Money value={pipeline} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
