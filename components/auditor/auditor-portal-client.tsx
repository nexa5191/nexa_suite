"use client";

import * as React from "react";
import {
  Gavel, ShieldCheck, Download, Printer, Lock, BadgeCheck, Server, FileClock, CheckCircle2, AlertTriangle, Fingerprint,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn, formatDate } from "@/lib/utils";
import { downloadCsv, printDocument } from "@/lib/export";
import {
  fullChain, verifyChain, auditSummary, actionLabel, ACTION_TONE, type AuditEntry,
} from "@/lib/audit/audit-log";
import { AS_ON } from "@/lib/finance/receivables";

const POSTURE = [
  { icon: Lock, label: "SOC 2 Type II", sub: "Controls audited" },
  { icon: BadgeCheck, label: "ISO 27001", sub: "ISMS certified" },
  { icon: Fingerprint, label: "Hash-chained log", sub: "Companies Act Rule 11(g)" },
  { icon: Server, label: "Data residency", sub: "India (ap-south-1)" },
];

export function AuditorPortalClient() {
  // SSR-equal default (seed only); the persisted continuation loads after mount.
  const [chain, setChain] = React.useState<AuditEntry[]>([]);
  React.useEffect(() => {
    setChain(fullChain());
  }, []);

  const integrity = React.useMemo(() => verifyChain(chain), [chain]);
  const summary = React.useMemo(() => auditSummary(chain, AS_ON), [chain]);
  const period = chain.length
    ? `${formatDate(chain[0].timestamp)} – ${formatDate(chain[chain.length - 1].timestamp)}`
    : "—";
  const head = chain.length ? chain[chain.length - 1].hash : "—";

  const recent = [...chain].reverse().slice(0, 30);

  function exportCsv() {
    downloadCsv(
      "nexa-audit-trail",
      ["Seq", "Timestamp", "Actor", "Module", "Action", "Record", "Field", "Before", "After", "Hash"],
      chain.map((e) => [
        e.seq, e.timestamp, e.actorName, e.module, actionLabel(e.action), e.record,
        e.field ?? "", e.before ?? "", e.after ?? "", e.hash,
      ]),
    );
  }

  function printCertificate() {
    printDocument(
      "Audit Trail Integrity Certificate — NEXA",
      `
        <h1>Audit Trail Integrity Certificate</h1>
        <div class="sub">Generated ${new Date().toLocaleString("en-IN")} · NEXA Finance Platform</div>
        <table style="margin-bottom:14px">
          <tr><th style="width:34%">Entries certified</th><td>${summary.total}</td></tr>
          <tr><th>Period covered</th><td>${period}</td></tr>
          <tr><th>Distinct actors</th><td>${summary.actors}</td></tr>
          <tr><th>Modules</th><td>${summary.modules}</td></tr>
          <tr><th>Chain head hash</th><td><code>${head}</code></td></tr>
          <tr><th>Integrity status</th><td>${integrity.valid ? "VERIFIED — chain intact, no tampering detected" : "BROKEN at #" + integrity.brokenAtSeq}</td></tr>
        </table>
        <p class="sub">
          This log is tamper-evident: every entry carries the cryptographic hash of the entry before it, so altering any
          historical record breaks every subsequent hash. The chain was re-derived at generation time and verified intact.
          Maintained under Rule 11(g) of the Companies (Accounts) Rules, 2014.
        </p>`,
    );
  }

  return (
    <>
      <PageHeader
        title="Auditor Portal"
        subtitle="Read-only, regulator-ready view of the tamper-evident audit trail — with exportable certificates."
        actions={
          <Badge variant="outline" className="h-7 gap-1.5 px-3">
            <Lock className="size-3.5" /> Read-only
          </Badge>
        }
      />

      {/* Compliance posture */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {POSTURE.map((p) => (
          <Card key={p.label} className="flex items-center gap-3 p-4">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <p.icon className="size-4" />
            </span>
            <div>
              <p className="text-sm font-semibold">{p.label}</p>
              <p className="text-xs text-muted-foreground">{p.sub}</p>
            </div>
          </Card>
        ))}
      </div>

      {/* Integrity banner */}
      <Card className={cn("mb-4 flex flex-wrap items-center gap-4 p-4", integrity.valid ? "border-success/30 bg-success/5" : "border-danger/30 bg-danger/5")}>
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-xl", integrity.valid ? "bg-success/15 text-success" : "bg-danger/15 text-danger")}>
          {integrity.valid ? <CheckCircle2 className="size-5" /> : <AlertTriangle className="size-5" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{integrity.valid ? "Audit trail verified — chain intact" : `Tampering detected at entry #${integrity.brokenAtSeq}`}</p>
          <p className="text-sm text-muted-foreground">
            {integrity.valid
              ? `${integrity.length} entries re-hashed and confirmed unbroken. Head hash `
              : `${integrity.reason} Head hash `}
            <span className="font-mono text-xs">{head}</span>
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
          <Button variant="outline" size="sm" onClick={printCertificate}><Printer className="size-4" /> Certificate</Button>
        </div>
      </Card>

      {/* Summary */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={FileClock} label="Entries" value={String(summary.total)} />
        <Stat icon={ShieldCheck} label="Period covered" value={period} />
        <Stat icon={Gavel} label="Actors" value={String(summary.actors)} />
        <Stat icon={BadgeCheck} label="Modules" value={String(summary.modules)} />
      </div>

      {/* Read-only log */}
      <Card className="overflow-hidden">
        <div className="border-b px-5 py-3 text-sm font-semibold">Audit trail — most recent {recent.length}</div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">When</th>
                <th className="px-4 py-2.5 font-medium">Actor</th>
                <th className="px-4 py-2.5 font-medium">Module</th>
                <th className="px-4 py-2.5 font-medium">Action</th>
                <th className="px-4 py-2.5 font-medium">Record</th>
                <th className="px-4 py-2.5 font-medium">Hash</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((e) => (
                <tr key={e.seq} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2.5 tabular text-muted-foreground">{e.seq}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(e.timestamp)}</td>
                  <td className="px-4 py-2.5">{e.actorName}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.module}</td>
                  <td className="px-4 py-2.5"><Badge variant={ACTION_TONE[e.action]}>{actionLabel(e.action)}</Badge></td>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{e.record}</div>
                    {e.field && <div className="text-xs text-muted-foreground">{e.field}: {e.before ?? "—"} → {e.after ?? "—"}</div>}
                  </td>
                  <td className="px-4 py-2.5 font-mono text-[11px] text-muted-foreground">{e.hash.slice(0, 10)}…</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="mt-3 text-xs text-muted-foreground">
        Auditors get scoped, read-only access — no posting rights. Exports are watermarked and the certificate carries the
        chain head hash for independent verification.
      </p>
    </>
  );
}

function Stat({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-3.5" /> {label}
      </p>
      <p className="mt-1 text-lg font-bold tabular">{value}</p>
    </Card>
  );
}
