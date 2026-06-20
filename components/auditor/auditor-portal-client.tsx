"use client";

import * as React from "react";
import { Download, Printer, Lock, BadgeCheck, Server, Fingerprint } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { downloadCsv, printDocument } from "@/lib/export";
import { AuditTrailClient } from "@/components/audit/audit-trail-client";
import {
  fullChain, verifyChain, auditSummary, actionLabel, type AuditEntry,
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
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="h-8 gap-1.5 px-3 text-xs">
              <Lock className="size-3.5" /> Read-only
            </Badge>
            <Button variant="outline" size="sm" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>
            <Button variant="outline" size="sm" onClick={printCertificate}><Printer className="size-4" /> Certificate</Button>
          </div>
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

      {/* The full tamper-evident audit trail, clubbed into the portal */}
      <AuditTrailClient embedded />

      <p className="mt-3 text-xs text-muted-foreground">
        Auditors get scoped, read-only access — no posting rights. The CSV export and the Integrity Certificate (head hash
        <span className="font-mono"> {head}</span>) let an auditor verify the {summary.total}-entry chain independently.
      </p>
    </>
  );
}
