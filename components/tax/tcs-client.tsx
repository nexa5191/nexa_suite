"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { TCS_TRANSACTIONS, TCS_SECTIONS, tcsSummaryByPeriod, tcsTotal } from "@/lib/tax/tcs";
import { Download, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TcsClient() {
  const [period, setPeriod] = useState("all");
  const totals = tcsTotal();
  const summaries = tcsSummaryByPeriod();
  const periods = Array.from(new Set(TCS_TRANSACTIONS.map((t) => t.period))).sort();
  const rows = period === "all" ? TCS_TRANSACTIONS : TCS_TRANSACTIONS.filter((t) => t.period === period);

  function exportCsv() {
    const hdr = "Date,Period,Section,Nature,Buyer,PAN,Sale Value,TCS Rate%,TCS Amount,Remitted,Challan";
    const body = rows.map((r) =>
      [r.date, r.period, r.section, `"${r.nature}"`, `"${r.buyerName}"`, r.buyerPan || "N/A",
        r.saleValue, r.tcsRate, r.tcsAmount, r.remitted ? "Yes" : "No", r.challanNo ?? "–"].join(",")
    );
    const blob = new Blob([[hdr, ...body].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `tcs-${period}.csv`;
    a.click();
  }

  return (
    <>
      <PageHeader
        title="TCS — Tax Collected at Source"
        subtitle="Form 27EQ quarterly return tracking (Chapter XVII-BB)"
        actions={
          <Badge variant={totals.pending > 0 ? "warning" : "success"}>
            {totals.pending > 0 ? `₹${(totals.pending / 100000).toFixed(1)}L pending remittance` : "All remitted"}
          </Badge>
        }
      />

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total Sales (TCS applicable)", value: totals.sales },
          { label: "TCS Collected", value: totals.tcs },
          { label: "Remitted to Govt.", value: totals.remitted },
          { label: "Pending Remittance", value: totals.pending },
        ].map((k) => (
          <Card key={k.label} className="p-3">
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-0.5 text-lg font-bold"><Money value={k.value} /></p>
          </Card>
        ))}
      </div>

      {/* Period summary */}
      <Card className="mb-4 overflow-hidden">
        <div className="border-b px-4 py-3 font-semibold text-sm">By Period (Form 27EQ quarters)</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Period", "Transactions", "Total Sales", "TCS Collected", "Remitted", "Pending", "Status"].map((h) => (
                  <th key={h} className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {summaries.map((s) => (
                <tr key={s.period} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-2 font-mono text-xs">{s.period}</td>
                  <td className="px-4 py-2">{s.txnCount}</td>
                  <td className="px-4 py-2"><Money value={s.totalSales} /></td>
                  <td className="px-4 py-2 font-medium"><Money value={s.totalTcs} /></td>
                  <td className="px-4 py-2 text-emerald-600"><Money value={s.remitted} /></td>
                  <td className="px-4 py-2 text-amber-600"><Money value={s.pending} /></td>
                  <td className="px-4 py-2">
                    <Badge variant={s.pending === 0 ? "success" : "warning"}>{s.pending === 0 ? "Filed" : "Pending"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Transaction detail */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <Receipt className="size-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Transactions</span>
          <select className="ml-auto rounded border bg-background px-2 py-1 text-sm" value={period} onChange={(e) => setPeriod(e.target.value)}>
            <option value="all">All periods</option>
            {periods.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <Button size="sm" variant="outline" onClick={exportCsv}><Download className="size-4 mr-1" />CSV</Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Date", "Section", "Nature", "Buyer", "PAN", "Sale Value", "Rate%", "TCS", "Remitted"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs">{r.date}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.section}</td>
                  <td className="px-3 py-2 text-xs max-w-[160px] truncate">{r.nature}</td>
                  <td className="px-3 py-2">{r.buyerName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{r.buyerPan || <span className="text-amber-600">No PAN</span>}</td>
                  <td className="px-3 py-2 text-right"><Money value={r.saleValue} /></td>
                  <td className="px-3 py-2 text-right">{r.tcsRate}%</td>
                  <td className="px-3 py-2 text-right font-medium"><Money value={r.tcsAmount} /></td>
                  <td className="px-3 py-2">
                    <Badge variant={r.remitted ? "success" : "warning"}>{r.remitted ? r.challanNo!.slice(-8) : "Pending"}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Rate reference */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">TCS rate reference table</summary>
        <Card className="mt-2 overflow-hidden">
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-muted/40">
              {["Section", "Nature", "Rate (with PAN)%", "Rate (no PAN)%", "Threshold"].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {TCS_SECTIONS.map((s, i) => (
                <tr key={i} className="border-b border-border/40">
                  <td className="px-3 py-1.5 font-mono text-xs">{s.section}</td>
                  <td className="px-3 py-1.5 text-xs">{s.nature}</td>
                  <td className="px-3 py-1.5 text-right">{s.rateResident}%</td>
                  <td className="px-3 py-1.5 text-right">{s.rateNoPan}%</td>
                  <td className="px-3 py-1.5 text-right">{s.threshold > 0 ? <Money value={s.threshold} /> : "Nil"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </details>
    </>
  );
}
