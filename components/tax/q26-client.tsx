"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import { Q26_DEDUCTEES, q26Returns } from "@/lib/tax/q26";
import { Download, FileText } from "lucide-react";
import { cn } from "@/lib/utils";

export function Q26Client() {
  const [activeQuarter, setActiveQuarter] = useState<string | null>(null);
  const returns = q26Returns();
  const quarters = returns.map((r) => r.quarter);

  const deductees = activeQuarter
    ? Q26_DEDUCTEES.filter((d) => d.quarter === activeQuarter)
    : Q26_DEDUCTEES;

  const activeReturn = returns.find((r) => r.quarter === activeQuarter);

  function exportCsv() {
    const hdr = "Quarter,Section,Deductee,PAN,Payment Date,Amount Paid,TDS Rate%,TDS Deducted,TDS Deposited,Challan";
    const rows = deductees.map((d) =>
      [d.quarter, d.section, `"${d.deducteeName}"`, d.deducteePan,
        d.paymentDate, d.amountPaid, d.tdsRate, d.tdsDeducted, d.tdsDeposited, d.challanNo ?? "–"].join(",")
    );
    const blob = new Blob([[hdr, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `26Q-${activeQuarter ?? "all"}.csv`;
    a.click();
  }

  return (
    <>
      <PageHeader
        title="Form 26Q — Non-Salary TDS Return"
        subtitle="Quarterly TDS return on professional fees, rent, contractor payments, etc."
      />

      {/* Quarter cards */}
      <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {returns.map((r) => (
          <Card
            key={r.quarter}
            className={cn(
              "cursor-pointer p-3 transition-colors hover:border-primary",
              activeQuarter === r.quarter && "border-primary bg-primary/5"
            )}
            onClick={() => setActiveQuarter(activeQuarter === r.quarter ? null : r.quarter)}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-muted-foreground">{r.quarter}</p>
              <Badge variant={r.filed ? "success" : r.lateFee > 0 ? "danger" : "warning"}>
                {r.filed ? "Filed" : r.lateFee > 0 ? "Overdue" : "Pending"}
              </Badge>
            </div>
            <p className="text-sm font-bold"><Money value={r.totalTdsDeducted} /></p>
            <p className="text-xs text-muted-foreground">TDS deducted · {r.totalDeductees} deductees</p>
            {r.lateFee > 0 && (
              <p className="mt-1 text-xs text-red-600 font-medium">
                234E: ₹{r.lateFee.toLocaleString()} ({r.lateFeeDays}d late)
              </p>
            )}
            {r.filed && r.filedOn && <p className="mt-1 text-xs text-emerald-600">Filed {r.filedOn}</p>}
            <p className="mt-1 text-xs text-muted-foreground">Due: {r.dueDate}</p>
          </Card>
        ))}
      </div>

      {/* Summary if quarter selected */}
      {activeReturn && (
        <Card className="mb-4 p-4">
          <p className="font-semibold text-sm mb-3">{activeReturn.quarter} — Return Summary</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 text-sm">
            <div><p className="text-xs text-muted-foreground">TAN</p><p className="font-mono font-medium">{activeReturn.tan}</p></div>
            <div><p className="text-xs text-muted-foreground">Total Amount Paid</p><p className="font-medium"><Money value={activeReturn.totalAmountPaid} /></p></div>
            <div><p className="text-xs text-muted-foreground">TDS Deducted</p><p className="font-medium"><Money value={activeReturn.totalTdsDeducted} /></p></div>
            <div><p className="text-xs text-muted-foreground">TDS Deposited</p><p className="font-medium"><Money value={activeReturn.totalTdsDeposited} /></p></div>
          </div>
        </Card>
      )}

      {/* Deductee table */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <FileText className="size-4 text-muted-foreground" />
          <span className="font-semibold text-sm">
            {activeQuarter ? `Deductees — ${activeQuarter}` : "All Deductees"}
          </span>
          <div className="ml-auto flex gap-2">
            {activeQuarter && (
              <Button size="sm" variant="outline" onClick={() => setActiveQuarter(null)}>Clear filter</Button>
            )}
            <Button size="sm" variant="outline" onClick={exportCsv}><Download className="size-4 mr-1" />CSV</Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Quarter", "Section", "Deductee", "PAN", "Payment Date", "Amount Paid", "Rate%", "TDS Deducted", "Challan"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {deductees.map((d) => (
                <tr key={d.id} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-3 py-2 text-xs">{d.quarter}</td>
                  <td className="px-3 py-2 font-mono text-xs">{d.section}</td>
                  <td className="px-3 py-2">{d.deducteeName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{d.deducteePan}</td>
                  <td className="px-3 py-2 text-xs">{d.paymentDate}</td>
                  <td className="px-3 py-2 text-right"><Money value={d.amountPaid} /></td>
                  <td className="px-3 py-2 text-right">{d.tdsRate}%</td>
                  <td className="px-3 py-2 text-right font-medium"><Money value={d.tdsDeducted} /></td>
                  <td className="px-3 py-2">
                    {d.challanNo
                      ? <Badge variant="success" className="text-[10px]">{d.challanNo.slice(-8)}</Badge>
                      : <Badge variant="warning" className="text-[10px]">Pending</Badge>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
