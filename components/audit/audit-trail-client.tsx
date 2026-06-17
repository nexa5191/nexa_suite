"use client";

import * as React from "react";
import {
  ShieldCheck, ShieldAlert, Link2, Search, X, Fingerprint, ArrowRight, RotateCcw,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  fullChain, verifyChain, auditModules, auditActors, auditSummary, actionLabel,
  ACTION_TONE, type AuditEntry,
} from "@/lib/audit/audit-log";

const TODAY = "2026-06-18";

function fmtTs(iso: string) {
  const [d, t] = iso.split("T");
  return `${d} ${(t ?? "").slice(0, 5)}`;
}

export function AuditTrailClient() {
  const base = React.useMemo(() => fullChain(), []);
  const [moduleF, setModuleF] = React.useState("all");
  const [actorF, setActorF] = React.useState("all");
  const [q, setQ] = React.useState("");
  const [detail, setDetail] = React.useState<AuditEntry | null>(null);
  // Demo-only: simulate an after-the-fact edit to one row to prove the chain breaks.
  const [tamperSeq, setTamperSeq] = React.useState<number | null>(null);

  const chain = React.useMemo(() => {
    if (tamperSeq === null) return base;
    return base.map((e) => (e.seq === tamperSeq ? { ...e, after: (e.after ?? "") + " (edited)" } : e));
  }, [base, tamperSeq]);

  const verification = React.useMemo(() => verifyChain(chain), [chain]);
  const summary = auditSummary(chain, TODAY);
  const modules = auditModules(base);
  const actors = auditActors(base);

  const rows = chain
    .filter((e) => moduleF === "all" || e.module === moduleF)
    .filter((e) => actorF === "all" || e.actorName === actorF)
    .filter((e) => {
      if (!q.trim()) return true;
      const hay = `${e.record} ${e.module} ${e.actorName} ${e.before ?? ""} ${e.after ?? ""}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    })
    .slice()
    .reverse(); // newest first

  return (
    <>
      <PageHeader
        title="Audit Trail"
        subtitle="Tamper-evident edit log — Companies Act 2013, Rule 11(g). Every change is hash-chained to the previous record."
        actions={
          <Badge variant={verification.valid ? "success" : "danger"} className="h-8 px-3 text-xs">
            {verification.valid ? <ShieldCheck className="size-3.5" /> : <ShieldAlert className="size-3.5" />}
            {verification.valid ? "Chain verified" : `Tampered at #${verification.brokenAtSeq}`}
          </Badge>
        }
      />

      {/* Integrity strip */}
      <Card className={cn("mb-4 flex flex-wrap items-center justify-between gap-3 p-4", verification.valid ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5")}>
        <div className="flex items-center gap-3">
          <span className={cn("flex size-10 items-center justify-center rounded-full", verification.valid ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}>
            {verification.valid ? <Fingerprint className="size-5" /> : <ShieldAlert className="size-5" />}
          </span>
          <div>
            <p className="font-semibold">{verification.valid ? "Ledger integrity intact" : "Integrity check failed"}</p>
            <p className="text-xs text-muted-foreground">
              {verification.valid
                ? `All ${verification.length} entries hash-chained and verified back to genesis.`
                : verification.reason}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tamperSeq === null ? (
            <Button variant="outline" size="sm" onClick={() => setTamperSeq(base[Math.floor(base.length / 2)].seq)}>
              <ShieldAlert className="size-4" /> Simulate tampering
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setTamperSeq(null)}>
              <RotateCcw className="size-4" /> Restore
            </Button>
          )}
        </div>
      </Card>

      {/* Summary */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total events" value={String(summary.total)} />
        <Stat label="Today" value={String(summary.today)} />
        <Stat label="Users" value={String(summary.actors)} />
        <Stat label="Modules covered" value={String(summary.modules)} />
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search record, value, user…" className="pl-9" />
        </div>
        <Select value={moduleF} onChange={(e) => setModuleF(e.target.value)} className="h-9 w-44">
          <option value="all">All modules</option>
          {modules.map((m) => <option key={m} value={m}>{m}</option>)}
        </Select>
        <Select value={actorF} onChange={(e) => setActorF(e.target.value)} className="h-9 w-44">
          <option value="all">All users</option>
          {actors.map((a) => <option key={a.name} value={a.name}>{a.name}</option>)}
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} event{rows.length === 1 ? "" : "s"}</span>
      </div>

      {/* Log table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Timestamp</th>
                <th className="px-4 py-3 font-medium">User</th>
                <th className="px-4 py-3 font-medium">Module</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Record / change</th>
                <th className="px-4 py-3 font-medium">Hash</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => {
                const broken = !verification.valid && verification.brokenAtSeq !== null && e.seq >= verification.brokenAtSeq;
                return (
                  <tr
                    key={e.seq}
                    onClick={() => setDetail(e)}
                    className={cn("cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50", broken && "bg-danger/5")}
                  >
                    <td className="px-4 py-3 tabular text-muted-foreground">{e.seq}</td>
                    <td className="whitespace-nowrap px-4 py-3 tabular text-muted-foreground">{fmtTs(e.timestamp)}</td>
                    <td className="px-4 py-3 font-medium">{e.actorName}</td>
                    <td className="px-4 py-3 text-muted-foreground">{e.module}</td>
                    <td className="px-4 py-3"><Badge variant={ACTION_TONE[e.action]} className="text-[10px]">{actionLabel(e.action)}</Badge></td>
                    <td className="px-4 py-3">
                      <span className="font-medium">{e.record}</span>
                      {e.field && (
                        <span className="ml-2 inline-flex items-center gap-1 text-xs text-muted-foreground">
                          {e.field}: <span className="line-through">{e.before}</span> <ArrowRight className="size-3" /> <span className="text-foreground">{e.after}</span>
                        </span>
                      )}
                      {!e.field && e.after && <span className="ml-2 text-xs text-muted-foreground">{e.after}</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("inline-flex items-center gap-1 font-mono text-[11px]", broken ? "text-danger" : "text-muted-foreground")}>
                        <Link2 className="size-3" />{e.hash.slice(0, 10)}…
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        Each entry stores the hash of the entry before it, so altering any historical row changes its hash and breaks every
        link that follows — which the integrity check flags instantly. Use “Simulate tampering” to see a back-dated edit
        invalidate the chain. In production this log is append-only and write-protected at the database layer.
      </p>

      {detail && <DetailModal entry={detail} onClose={() => setDetail(null)} />}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular">{value}</p>
    </Card>
  );
}

function DetailModal({ entry, onClose }: { entry: AuditEntry; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">Audit entry · #{entry.seq}</p>
            <h3 className="mt-0.5 font-semibold">{entry.module} — {actionLabel(entry.action)}</h3>
            <p className="text-xs text-muted-foreground">{fmtTs(entry.timestamp)} · {entry.actorName}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="mt-3 space-y-2 text-sm">
          <Row label="Record">{entry.record}</Row>
          {entry.field && <Row label="Field">{entry.field}</Row>}
          {entry.before !== null && <Row label="Before"><span className="line-through text-muted-foreground">{entry.before}</span></Row>}
          {entry.after !== null && <Row label="After">{entry.after}</Row>}
        </div>

        <div className="mt-4 space-y-2 rounded-lg bg-muted/50 p-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Hash chain</p>
          <Row label="Prev"><span className="font-mono text-xs">{entry.prevHash}</span></Row>
          <Row label="This"><span className="font-mono text-xs text-foreground">{entry.hash}</span></Row>
        </div>
      </Card>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className="text-right">{children}</span>
    </div>
  );
}
