"use client";

import * as React from "react";
import { Briefcase, ShieldCheck, ShieldAlert, ShieldQuestion, Search, Check, Flag, Gavel } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { Drawer } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { useAccess } from "@/components/access/access-provider";
import { useServices } from "@/components/services/services-provider";
import { employeeName } from "@/lib/hr/employees";
import { entityById } from "@/lib/accounting/org";
import {
  PROJECT_STATUSES, CONFLICT_STATUS_META, accountName, type Project,
} from "@/lib/services/projects";
import {
  CONFLICT_TYPES, checkForProject, clearancesForCheck, itemsForCheck, type ConflictType,
} from "@/lib/services/conflicts";

export function ProjectsClient() {
  const { projects } = useServices();
  const [openId, setOpenId] = React.useState<string | null>(null);
  const open = openId ? projects.find((p) => p.id === openId) ?? null : null;

  const active = projects.filter((p) => p.status === "active").length;
  const blocked = projects.filter((p) => p.conflictStatus === "blocked" || p.conflictStatus === "open").length;

  return (
    <>
      <PageHeader
        title="Engagements"
        subtitle="Matters, rate cards and conflict clearance for the professional-services business."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Engagements" value={String(projects.length)} />
        <Metric label="Active" value={String(active)} />
        <Metric label="Conflict not cleared" value={String(blocked)} highlight={blocked > 0} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Engagement</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Partner</th>
                <th className="px-5 py-3 text-right font-medium">Bill rate</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Conflict</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => {
                const sMeta = PROJECT_STATUSES.find((x) => x.key === p.status)!;
                const cMeta = CONFLICT_STATUS_META[p.conflictStatus];
                return (
                  <tr key={p.id} onClick={() => setOpenId(p.id)} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-3">
                      <p className="flex items-center gap-1.5 font-medium"><Briefcase className="size-3.5 text-muted-foreground" /> {p.name}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{p.code} · {entityById(p.entityId)?.name}</p>
                    </td>
                    <td className="px-5 py-3">{accountName(p.accountId)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{employeeName(p.partnerId)}</td>
                    <td className="px-5 py-3 text-right tabular"><Money value={p.billRate} />/hr</td>
                    <td className="px-5 py-3"><Badge variant={sMeta.variant}>{sMeta.label}</Badge></td>
                    <td className="px-5 py-3"><Badge variant={cMeta.variant}>{cMeta.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <EngagementDrawer project={open} onClose={() => setOpenId(null)} />
    </>
  );
}

function EngagementDrawer({ project, onClose }: { project: Project | null; onClose: () => void }) {
  const { assignments } = useServices();
  const cMeta = project ? CONFLICT_STATUS_META[project.conflictStatus] : null;
  const asg = project ? assignments.filter((a) => a.projectId === project.id) : [];

  return (
    <Drawer
      open={!!project}
      onClose={onClose}
      title={project?.name}
      subtitle={project ? `${project.code} · ${accountName(project.accountId)}` : undefined}
      width="max-w-xl"
      actions={cMeta ? <Badge variant={cMeta.variant}>{cMeta.label}</Badge> : undefined}
    >
      {project && (
        <div className="space-y-6">
          {/* Rate card */}
          <section>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rate card</p>
            <div className="overflow-hidden rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Professional</th>
                    <th className="px-3 py-2 text-right font-medium">Bill</th>
                    <th className="px-3 py-2 text-right font-medium">Cost</th>
                    <th className="px-3 py-2 text-right font-medium">Margin</th>
                  </tr>
                </thead>
                <tbody>
                  {asg.length === 0 && <tr><td colSpan={4} className="px-3 py-4 text-center text-muted-foreground">No one on the rate card.</td></tr>}
                  {asg.map((a) => {
                    const margin = a.billRate - a.payRate;
                    const pct = a.billRate > 0 ? Math.round((margin / a.billRate) * 100) : 0;
                    return (
                      <tr key={a.id} className="border-b border-border/40 last:border-0">
                        <td className="px-3 py-2">{employeeName(a.employeeId)}</td>
                        <td className="px-3 py-2 text-right tabular"><Money value={a.billRate} /></td>
                        <td className="px-3 py-2 text-right tabular text-muted-foreground"><Money value={a.payRate} /></td>
                        <td className="px-3 py-2 text-right tabular"><Money value={margin} /> <span className="text-xs text-muted-foreground">({pct}%)</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <ConflictPanel project={project} />
        </div>
      )}
    </Drawer>
  );
}

function ConflictPanel({ project }: { project: Project }) {
  const { checks, clearances, items, screenFor, createCheck, recordClearance, resolveItem } = useServices();
  const { canManage } = useAccess();

  const check = checkForProject(checks, project.id);
  const checkClearances = check ? clearancesForCheck(clearances, check.id) : [];
  const checkItems = check ? itemsForCheck(items, check.id) : [];
  const matches = screenFor(project.id);

  // Inline "raise a conflict" form, keyed by the reviewer raising it.
  const [raising, setRaising] = React.useState<string | null>(null);
  const [raiseType, setRaiseType] = React.useState<ConflictType>("adverse-party");
  const [raiseDesc, setRaiseDesc] = React.useState("");
  // Inline resolve notes, keyed by item id.
  const [resolveFor, setResolveFor] = React.useState<string | null>(null);
  const [notes, setNotes] = React.useState("");

  return (
    <section>
      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <ShieldQuestion className="size-3.5" /> Conflict check
      </p>

      {/* Automated screen */}
      <div className="mb-3 rounded-lg border p-3">
        <p className="mb-1.5 flex items-center gap-1.5 text-sm font-medium"><Search className="size-3.5" /> Screen against the book</p>
        {project.opposingParties.length === 0 && <p className="text-xs text-muted-foreground">No opposing parties recorded.</p>}
        {project.opposingParties.length > 0 && matches.length === 0 && (
          <p className="flex items-center gap-1.5 text-xs text-success"><ShieldCheck className="size-3.5" /> No collisions found against existing clients or engagements.</p>
        )}
        {matches.map((m, i) => (
          <p key={i} className="flex items-start gap-1.5 py-0.5 text-xs text-danger">
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" />
            <span>{m.reason} <span className="text-muted-foreground">· {Math.round(m.score * 100)}% match</span></span>
          </p>
        ))}
      </div>

      {!check ? (
        <Button size="sm" variant="outline" disabled={!canManage} onClick={() => createCheck(project.id, project.partnerId)}>
          <ShieldQuestion className="size-3.5" /> Run conflict check
        </Button>
      ) : (
        <div className="space-y-3">
          {/* Reviewer clearances */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">Partner clearance</p>
            <div className="space-y-1.5">
              {checkClearances.map((c) => (
                <div key={c.id} className="rounded-lg border p-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm">{employeeName(c.reviewerId)}</span>
                    <div className="flex items-center gap-1.5">
                      <Badge variant={c.decision === "cleared" ? "success" : c.decision === "raised" ? "danger" : "default"}>
                        {c.decision === "pending" ? "Pending" : c.decision === "cleared" ? "Cleared" : "Raised"}
                      </Badge>
                      {c.decision === "pending" && canManage && (
                        <>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => recordClearance(check.id, c.reviewerId, "cleared")}>
                            <Check className="size-3.5" /> Clear
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 text-danger" onClick={() => { setRaising(c.reviewerId); setRaiseDesc(""); }}>
                            <Flag className="size-3.5" /> Raise
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {raising === c.reviewerId && (
                    <div className="mt-2 space-y-2 border-t pt-2">
                      <Select value={raiseType} onChange={(e) => setRaiseType(e.target.value as ConflictType)}>
                        {CONFLICT_TYPES.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
                      </Select>
                      <Input value={raiseDesc} onChange={(e) => setRaiseDesc(e.target.value)} placeholder="Describe the conflict…" />
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setRaising(null)}>Cancel</Button>
                        <Button size="sm" disabled={!raiseDesc.trim()} onClick={() => { recordClearance(check.id, c.reviewerId, "raised", { type: raiseType, description: raiseDesc.trim() }); setRaising(null); }}>
                          Raise conflict
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Raised items */}
          {checkItems.length > 0 && (
            <div>
              <p className="mb-1 text-xs font-medium text-muted-foreground">Raised conflicts</p>
              <div className="space-y-1.5">
                {checkItems.map((it) => (
                  <div key={it.id} className="rounded-lg border p-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm">{it.description}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {CONFLICT_TYPES.find((t) => t.key === it.type)?.label} · by {employeeName(it.raisedById)}
                          {it.resolutionNotes && ` · ${it.resolutionNotes}`}
                        </p>
                      </div>
                      <Badge variant={it.status === "pending" ? "danger" : it.status === "waived" ? "primary" : "success"}>
                        {it.status === "pending" ? "Open" : it.status === "waived" ? "Waived" : "Resolved"}
                      </Badge>
                    </div>
                    {it.status === "pending" && canManage && (
                      resolveFor === it.id ? (
                        <div className="mt-2 space-y-2 border-t pt-2">
                          <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Resolution / waiver note…" />
                          <div className="flex justify-end gap-2">
                            <Button size="sm" variant="ghost" onClick={() => setResolveFor(null)}>Cancel</Button>
                            <Button size="sm" variant="outline" onClick={() => { resolveItem(it.id, project.partnerId, notes.trim(), true); setResolveFor(null); setNotes(""); }}>Waive</Button>
                            <Button size="sm" disabled={!notes.trim()} onClick={() => { resolveItem(it.id, project.partnerId, notes.trim(), false); setResolveFor(null); setNotes(""); }}>Resolve</Button>
                          </div>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="mt-1 h-7" onClick={() => { setResolveFor(it.id); setNotes(""); }}>
                          <Gavel className="size-3.5" /> Resolve / waive
                        </Button>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", highlight && "border-danger/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular", highlight && "text-danger")}>{value}</p>
    </Card>
  );
}
