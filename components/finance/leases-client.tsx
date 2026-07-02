"use client";

import * as React from "react";
import { Building, Scale, TrendingDown, Wallet, Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { downloadCsv } from "@/lib/export";
import { leaseSummary, schedule, LEASES, AS_ON, type Lease } from "@/lib/finance/leases";

export function LeasesClient() {
  const { positions, summary } = leaseSummary(AS_ON);
  const [selId, setSelId] = React.useState(LEASES[0]?.id ?? "");
  const sel = LEASES.find((l) => l.id === selId);
  const selPos = positions.find((p) => p.lease.id === selId);
  const sched = sel ? schedule(sel) : [];

  function exportCsv() {
    downloadCsv("lease-liabilities", ["Asset", "Location", "Commenced", "Term (m)", "ROU NBV", "Liability", "Current", "Non-current", "Monthly interest", "Monthly dep"],
      positions.map((p) => [p.lease.asset, p.lease.location, p.lease.commencement, p.lease.termMonths, p.rouNbv, p.liability, p.currentLiability, p.nonCurrentLiability, p.thisMonthInterest, p.thisMonthDep]));
  }

  // LEASES is never seeded (no leases exist yet) — show an empty state
  // instead of crashing below on sel/selPos being undefined.
  if (!sel || !selPos) {
    return (
      <>
        <PageHeader
          title="Lease Accounting"
          subtitle={`Ind AS 116 — right-of-use assets & lease liabilities · as on ${formatDate(AS_ON)}`}
        />
        <Card className="p-8 text-center text-sm text-muted-foreground">No leases configured yet.</Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Lease Accounting"
        subtitle={`Ind AS 116 — right-of-use assets & lease liabilities · as on ${formatDate(AS_ON)}`}
        actions={<Button size="sm" variant="outline" onClick={exportCsv}><Download className="size-4" /> Export CSV</Button>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Building} label="ROU asset (NBV)" value={summary.rouNbv} />
        <Stat icon={Scale} label="Lease liability" value={summary.liability} highlight />
        <Stat icon={Wallet} label="Current portion" value={summary.currentLiability} sub={`Non-current ${inrC(summary.nonCurrentLiability)}`} />
        <Stat icon={TrendingDown} label="Monthly P&L charge" value={summary.monthlyCharge} sub={`vs cash rent ${inrC(summary.monthlyCashRent)}`} tone="danger" />
      </div>

      {/* Leases */}
      <Card className="mb-4 overflow-hidden">
        <div className="border-b px-5 py-3 text-sm font-semibold">Lease portfolio</div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Term</th>
                <th className="px-4 py-3 text-right font-medium">ROU NBV</th>
                <th className="px-4 py-3 text-right font-medium">Liability</th>
                <th className="px-4 py-3 text-right font-medium">Current</th>
                <th className="px-4 py-3 text-right font-medium">Mo. interest</th>
                <th className="px-4 py-3 text-right font-medium">Mo. dep</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {positions.map((p) => (
                <tr key={p.lease.id} className={cn("border-b last:border-0 hover:bg-accent/40", p.lease.id === selId && "bg-primary/5")}>
                  <td className="px-4 py-2.5">
                    <div className="font-medium">{p.lease.asset}</div>
                    <div className="text-[11px] text-muted-foreground">{p.lease.location} · {p.lease.annualRate}% IBR</div>
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">{p.elapsed}/{p.lease.termMonths} mo</td>
                  <td className="px-4 py-2.5 text-right tabular"><Money value={p.rouNbv} /></td>
                  <td className="px-4 py-2.5 text-right tabular font-medium"><Money value={p.liability} /></td>
                  <td className="px-4 py-2.5 text-right tabular text-muted-foreground"><Money value={p.currentLiability} /></td>
                  <td className="px-4 py-2.5 text-right tabular text-muted-foreground"><Money value={p.thisMonthInterest} /></td>
                  <td className="px-4 py-2.5 text-right tabular text-muted-foreground"><Money value={p.thisMonthDep} /></td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant={p.lease.id === selId ? "primary" : "outline"} className="h-7 px-2 text-xs" onClick={() => setSelId(p.lease.id)}>Schedule</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Amortization schedule */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <span className="text-sm font-semibold">{sel.asset} — liability amortisation</span>
          <Badge variant="outline">first 12 of {sel.termMonths} months · ROU cost {inrC(selPos.rouCost)}</Badge>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Month</th>
                <th className="px-4 py-2.5 text-right font-medium">Opening</th>
                <th className="px-4 py-2.5 text-right font-medium">Interest</th>
                <th className="px-4 py-2.5 text-right font-medium">Payment</th>
                <th className="px-4 py-2.5 text-right font-medium">Principal</th>
                <th className="px-4 py-2.5 text-right font-medium">Closing</th>
              </tr>
            </thead>
            <tbody>
              {sched.slice(0, 12).map((r) => (
                <tr key={r.period} className={cn("border-b last:border-0", r.period === selPos.elapsed + 1 && "bg-primary/5")}>
                  <td className="px-4 py-2 text-muted-foreground">{r.period}</td>
                  <td className="px-4 py-2 text-right tabular"><Money value={r.opening} /></td>
                  <td className="px-4 py-2 text-right tabular text-danger"><Money value={r.interest} /></td>
                  <td className="px-4 py-2 text-right tabular"><Money value={r.payment} /></td>
                  <td className="px-4 py-2 text-right tabular"><Money value={r.principal} /></td>
                  <td className="px-4 py-2 text-right tabular font-medium"><Money value={r.closing} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

const inrC = (n: number) => `₹${(n / 100000).toFixed(1)}L`;

function Stat({ icon: Icon, label, value, sub, tone, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; sub?: string; tone?: "danger"; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", highlight && "border-primary/30 bg-primary/5")}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Icon className={cn("size-3.5", tone === "danger" && "text-danger")} /> {label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular", tone === "danger" && "text-danger")}><Money value={value} /></p>
      {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
    </Card>
  );
}
