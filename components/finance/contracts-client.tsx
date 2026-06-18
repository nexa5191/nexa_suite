"use client";

import * as React from "react";
import {
  FileSignature, FileText, Repeat, CalendarClock, AlertTriangle, CheckCircle2, Download, BellRing, FolderOpen, Banknote,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { useJournal } from "@/components/accounting/journal-provider";
import type { EntryDraft } from "@/lib/accounting/manual-entries";
import {
  contractsSummary, renewals, docsFor, daysToEnd, DOC_KIND_META, CONTRACT_DOCS, contractById,
  AS_ON, type ContractPlan, type ContractStatus,
} from "@/lib/finance/contracts";

const STATUS_TONE: Record<ContractStatus, "success" | "warning" | "danger"> = { active: "success", expiring: "warning", expired: "danger" };

function statusLabel(p: ContractPlan): string {
  const d = daysToEnd(p.contract, AS_ON);
  if (p.status === "expired") return `Expired ${Math.abs(d)}d ago`;
  if (p.status === "expiring") return `Renew in ${d}d`;
  return "Active";
}

export function ContractsClient() {
  const { entries, postMany } = useJournal();
  const [tab, setTab] = React.useState<"register" | "repository">("register");
  const [justPosted, setJustPosted] = React.useState<number | null>(null);

  const { plans, summary } = React.useMemo(() => contractsSummary(entries, AS_ON), [entries]);
  const dueRenewals = renewals(AS_ON);

  function postDrafts(drafts: EntryDraft[]) {
    if (drafts.length === 0) return;
    const res = postMany(drafts);
    setJustPosted(res.posted);
  }

  return (
    <>
      <PageHeader
        title="Contracts & AMCs"
        subtitle="Recurring service contracts — fixed-fee auto-posting to the GL and renewal reminders."
        actions={
          <Button size="sm" onClick={() => postDrafts(summary.pendingDrafts)} disabled={summary.pendingDrafts.length === 0}>
            <Banknote className="size-4" /> Post due fees{summary.pendingDrafts.length ? ` (${summary.pendingDrafts.length})` : ""}
          </Button>
        }
      />

      {justPosted !== null && justPosted > 0 && (
        <Card className="mb-4 flex items-center gap-2 border-success/30 bg-success/5 p-3 text-sm text-success">
          <CheckCircle2 className="size-4" /> Posted {justPosted} contract fee voucher{justPosted > 1 ? "s" : ""} to the GL.
        </Card>
      )}

      {/* Renewal intimation */}
      {dueRenewals.length > 0 && (
        <Card className="mb-4 border-warning/40 bg-warning/5 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><BellRing className="size-4 text-warning" /> {dueRenewals.length} contract{dueRenewals.length > 1 ? "s" : ""} need renewal attention</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {dueRenewals.map((c) => {
              const d = daysToEnd(c, AS_ON);
              return (
                <span key={c.id} className={cn("inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs", d < 0 ? "border-danger/40 text-danger" : "border-warning/40 text-foreground")}>
                  <CalendarClock className="size-3.5" /> {c.name} · {d < 0 ? `expired ${Math.abs(d)}d ago` : `ends ${formatDate(c.end)} (${d}d)`}
                </span>
              );
            })}
          </div>
        </Card>
      )}

      {/* Summary */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileSignature} label="Active contracts" plain={`${summary.active}`} />
        <Stat icon={Repeat} label="Annualised value" value={summary.annualisedValue} />
        <Stat icon={Banknote} label="Fees due to post" value={summary.pendingAmount} tone="warning" sub={`${summary.pendingDrafts.length} period(s)`} />
        <Stat icon={AlertTriangle} label="Expiring / expired" plain={`${summary.expiringSoon}`} tone={summary.expiringSoon ? "danger" : undefined} />
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border bg-muted/30 p-1 w-fit">
        <TabBtn icon={FileSignature} label="Register" active={tab === "register"} onClick={() => setTab("register")} />
        <TabBtn icon={FolderOpen} label={`Repository (${CONTRACT_DOCS.length})`} active={tab === "repository"} onClick={() => setTab("repository")} />
      </div>

      {tab === "register" ? (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Contract</th>
                  <th className="px-4 py-3 font-medium">Type</th>
                  <th className="px-4 py-3 text-right font-medium">Fee</th>
                  <th className="px-4 py-3 font-medium">Term</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Posted</th>
                  <th className="px-4 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((p) => (
                  <tr key={p.contract.id} className="border-b align-top last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2.5">
                      <div className="font-medium">{p.contract.name}</div>
                      <div className="text-[11px] text-muted-foreground">{p.contract.counterparty} · {p.contract.direction === "payable" ? "we pay" : "we bill"} · {docsFor(p.contract.id).length} doc(s)</div>
                    </td>
                    <td className="px-4 py-2.5"><Badge variant="outline" className="text-[10px]">{p.contract.category}</Badge></td>
                    <td className="px-4 py-2.5 text-right tabular">
                      <Money value={p.contract.fee} /><div className="text-[10px] text-muted-foreground">{p.contract.frequency}</div>
                    </td>
                    <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(p.contract.start)}<br />→ {formatDate(p.contract.end)}</td>
                    <td className="px-4 py-2.5"><Badge variant={STATUS_TONE[p.status]}>{statusLabel(p)}</Badge></td>
                    <td className="px-4 py-2.5 text-xs">
                      <span className="tabular">{p.postedCount}/{p.duePeriods.length}</span>
                      {p.pendingDrafts.length > 0 && <span className="ml-1 text-warning">· {p.pendingDrafts.length} due</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {p.pendingDrafts.length > 0 ? (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => postDrafts(p.pendingDrafts)}>
                          <Banknote className="size-3.5" /> Post {p.pendingDrafts.length}
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-success"><CheckCircle2 className="size-3.5" /> Up to date</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="border-b px-5 py-3 text-sm font-semibold">Contract document repository</div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 font-medium">Contract</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">Version</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 text-right font-medium">Size</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {CONTRACT_DOCS.map((d) => (
                <tr key={d.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-5 py-2.5"><span className="flex items-center gap-2"><FileText className="size-4 shrink-0 text-danger" /> {d.name}</span></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{contractById(d.contractId)?.name ?? d.contractId}</td>
                  <td className="px-4 py-2.5"><Badge variant={DOC_KIND_META[d.kind].tone} className="text-[10px]">{DOC_KIND_META[d.kind].label}</Badge></td>
                  <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{d.version}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(d.date)}</td>
                  <td className="px-4 py-2.5 text-right text-xs tabular text-muted-foreground">{d.sizeKb} KB</td>
                  <td className="px-4 py-2.5 text-right"><Download className="size-4 text-muted-foreground" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      <p className="mt-3 text-xs text-muted-foreground">
        &ldquo;Post due fees&rdquo; books the fixed periodic fee for each elapsed period (Dr expense / Cr payable, or Dr receivable / Cr income) — idempotent, so it never double-posts. Renewal reminders fire {60} days before a contract ends.
      </p>
    </>
  );
}

function TabBtn({ icon: Icon, label, active, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors", active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

function Stat({ icon: Icon, label, value, plain, sub, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value?: number; plain?: string; sub?: string; tone?: "warning" | "danger" }) {
  const toneCls = tone === "warning" ? "text-warning" : tone === "danger" ? "text-danger" : "";
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Icon className={cn("size-3.5", toneCls)} /> {label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular", toneCls)}>{plain ?? <Money value={value ?? 0} />}</p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}
