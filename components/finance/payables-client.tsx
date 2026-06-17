"use client";

import * as React from "react";
import { ShieldAlert } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { AS_ON, AGING_BUCKETS, bucketMeta } from "@/lib/finance/receivables";
import {
  apOpenItems,
  apAgingBuckets,
  vendorAging,
  apSummary,
  MSME_TERM_DAYS,
} from "@/lib/finance/payables";

export function PayablesClient() {
  const buckets = React.useMemo(() => apAgingBuckets(AS_ON), []);
  const vendors = React.useMemo(() => vendorAging(AS_ON), []);
  const items = React.useMemo(() => apOpenItems(AS_ON), []);
  const summary = React.useMemo(() => apSummary(AS_ON), []);
  const grandTotal = vendors.reduce((s, v) => s + v.total, 0);

  return (
    <>
      <PageHeader
        title="Payables & Aging"
        subtitle={`AP aging from vendor bills · 30-day terms (45-day for MSME) · as on ${formatDate(AS_ON)}`}
      />

      {/* Summary cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total payable" value={summary.totalPayable} />
        <SummaryCard label="Due this week" value={summary.dueThisWeek} tone="warning" />
        <SummaryCard label="Overdue" value={summary.overdue} tone="danger" />
        <SummaryCard label="MSME dues" value={summary.msmeDue} note={`${summary.msmeBreaches} past 45 days`} />
      </div>

      {/* MSME callout */}
      <Card className="mb-4 flex items-start gap-3 border-warning/40 bg-warning/5 p-4">
        <ShieldAlert className="mt-0.5 size-5 shrink-0 text-warning" />
        <div className="text-sm">
          <p className="font-semibold">MSME {MSME_TERM_DAYS}-day rule</p>
          <p className="text-muted-foreground">
            Under MSMED Act sec. 15, dues to registered Micro & Small enterprises must be settled within {MSME_TERM_DAYS} days
            of acceptance; delay attracts compound interest (sec. 16) and a sec. 43B(h) income-tax disallowance.
            {summary.msmeBreaches > 0
              ? ` ${summary.msmeBreaches} MSME bill(s) are currently past the window.`
              : " No MSME bills are currently in breach."}
          </p>
        </div>
      </Card>

      {/* Aging matrix */}
      <Card className="mb-4 overflow-hidden">
        <div className="border-b px-5 py-3 text-sm font-semibold">AP aging — vendor × bucket</div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Vendor</th>
                {AGING_BUCKETS.map((b) => (
                  <th key={b.key} className="px-4 py-3 text-right font-medium">{b.label}</th>
                ))}
                <th className="px-5 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.vendorId} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                  <td className="px-5 py-3 font-medium">
                    {v.name}
                    {v.msme && <Badge variant="primary" className="ml-2">MSME</Badge>}
                    {v.msmeBreach && <Badge variant="danger" className="ml-1.5">45d breach</Badge>}
                  </td>
                  {AGING_BUCKETS.map((b) => (
                    <td key={b.key} className="px-4 py-3 text-right tabular">
                      {v.buckets[b.key] > 0 ? <Money value={v.buckets[b.key]} /> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right font-semibold tabular"><Money value={v.total} /></td>
                </tr>
              ))}
              {vendors.length === 0 && (
                <tr><td colSpan={AGING_BUCKETS.length + 2} className="px-5 py-8 text-center text-muted-foreground">No open payables.</td></tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-5 py-3">Total</td>
                {AGING_BUCKETS.map((b) => (
                  <td key={b.key} className="px-4 py-3 text-right tabular"><Money value={buckets[b.key]} /></td>
                ))}
                <td className="px-5 py-3 text-right tabular"><Money value={grandTotal} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Open bills */}
      <Card className="overflow-hidden">
        <div className="border-b px-5 py-3 text-sm font-semibold">Open bills</div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">Bill no</th>
                <th className="px-5 py-3 font-medium">Due</th>
                <th className="px-5 py-3 text-right font-medium">Days</th>
                <th className="px-5 py-3 text-right font-medium">Outstanding</th>
                <th className="px-5 py-3 font-medium">MSME</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const bm = bucketMeta(it.bucket);
                return (
                  <tr key={it.poId} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-3 font-medium">{it.vendorName}</td>
                    <td className="px-5 py-3 text-muted-foreground">{it.billNo}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {formatDate(it.dueDate)}
                      {it.dueThisWeek && <Badge variant="warning" className="ml-2">this week</Badge>}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Badge variant={bm.tone}>{it.days > 0 ? `${it.days}d` : "current"}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular"><Money value={it.outstanding} /></td>
                    <td className="px-5 py-3">
                      {it.msme ? (
                        <Badge variant={it.msmeBreach ? "danger" : "primary"}>{it.msmeBreach ? "45d breach" : "MSME"}</Badge>
                      ) : (
                        <span className="text-muted-foreground/40">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">No open bills.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function SummaryCard({ label, value, note, tone }: { label: string; value: number; note?: string; tone?: "danger" | "warning" }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular", tone === "danger" && "text-danger", tone === "warning" && "text-warning")}>
        <Money value={value} />
      </p>
      {note && <p className="mt-0.5 text-xs text-muted-foreground">{note}</p>}
    </Card>
  );
}
