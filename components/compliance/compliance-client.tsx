"use client";

import * as React from "react";
import { ShieldCheck, RefreshCw, ScrollText, Landmark, Receipt, Clock, CheckCircle2, CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import {
  RULE_SYNC, GST_RATES, TDS_RULES, STATUTORY_RULES, RULE_CHANGES, CHANGE_KIND_META,
} from "@/lib/compliance/rules";

export function ComplianceClient() {
  return (
    <>
      <PageHeader
        title="Compliance Rules"
        subtitle="Statutory rates and rules NEXA applies — delivered as a live config feed, not a software upgrade. Always current."
        actions={
          <Badge variant="success" className="h-7 gap-1.5 px-3">
            <ShieldCheck className="size-3.5" /> Always compliant
          </Badge>
        }
      />

      {/* Sync status */}
      <Card className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
        <span className="flex items-center gap-2 text-sm font-medium">
          <RefreshCw className="size-4 text-primary" /> Rule feed v{RULE_SYNC.version}
        </span>
        <span className="text-sm text-muted-foreground">Last synced <b className="text-foreground">{formatDate(RULE_SYNC.lastSynced)}</b></span>
        <span className="text-sm text-muted-foreground">Next check <b className="text-foreground">{formatDate(RULE_SYNC.nextCheck)}</b></span>
        <span className="ml-auto text-xs text-muted-foreground">{RULE_SYNC.source}</span>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[1fr_22rem]">
        {/* Left — the rate/rule tables */}
        <div className="space-y-4">
          {/* GST rates */}
          <Card className="overflow-hidden">
            <CardHeader><CardTitle className="flex items-center gap-2"><Receipt className="size-4" /> GST rate schedule</CardTitle></CardHeader>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Rate</th>
                    <th className="px-4 py-2.5 font-medium">Slab</th>
                    <th className="px-4 py-2.5 font-medium">Typical supplies</th>
                    <th className="px-4 py-2.5 font-medium">Effective</th>
                  </tr>
                </thead>
                <tbody>
                  {GST_RATES.map((g) => (
                    <tr key={g.rate} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-semibold tabular">{g.rate}%</td>
                      <td className="px-4 py-2.5">{g.label}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{g.examples}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(g.effectiveFrom)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* TDS sections */}
          <Card className="overflow-hidden">
            <CardHeader><CardTitle className="flex items-center gap-2"><Landmark className="size-4" /> TDS sections · FY 2025-26</CardTitle></CardHeader>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Section</th>
                    <th className="px-4 py-2.5 font-medium">Nature</th>
                    <th className="px-4 py-2.5 font-medium">Rate</th>
                    <th className="px-4 py-2.5 font-medium">Threshold</th>
                  </tr>
                </thead>
                <tbody>
                  {TDS_RULES.map((t) => (
                    <tr key={t.section} className="border-b last:border-0">
                      <td className="px-4 py-2.5 font-mono text-xs font-semibold">{t.section}</td>
                      <td className="px-4 py-2.5">
                        {t.nature}
                        {t.note && <span className="ml-1.5 text-[11px] text-primary">· {t.note}</span>}
                      </td>
                      <td className="px-4 py-2.5 tabular">{t.rate}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{t.threshold}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Statutory rules */}
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><ScrollText className="size-4" /> Key statutory rules</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {STATUTORY_RULES.map((r) => (
                <div key={r.key} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{r.title}</p>
                    <span className="text-[11px] text-muted-foreground">since {formatDate(r.effectiveFrom)}</span>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{r.body}</p>
                  <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">{r.citation}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Right — the change feed */}
        <div>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Clock className="size-4" /> Regulatory update feed</CardTitle></CardHeader>
            <CardContent>
              <ol className="relative space-y-4 border-l pl-5">
                {RULE_CHANGES.map((c, i) => {
                  const meta = CHANGE_KIND_META[c.kind];
                  const upcoming = c.status === "upcoming";
                  return (
                    <li key={i} className="relative">
                      <span className={cn(
                        "absolute -left-[27px] flex size-5 items-center justify-center rounded-full ring-4 ring-card",
                        upcoming ? "bg-muted text-muted-foreground" : "bg-success/15 text-success",
                      )}>
                        {upcoming ? <CalendarClock className="size-3" /> : <CheckCircle2 className="size-3" />}
                      </span>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={meta.tone} className="text-[10px]">{meta.label}</Badge>
                        {upcoming
                          ? <Badge variant="outline" className="text-[10px]">Upcoming</Badge>
                          : <Badge variant="success" className="text-[10px]">Applied automatically</Badge>}
                      </div>
                      <p className="mt-1 text-sm font-medium">{c.title}</p>
                      <p className="text-xs text-muted-foreground">{c.detail}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">Effective {formatDate(c.date)}</p>
                    </li>
                  );
                })}
              </ol>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
