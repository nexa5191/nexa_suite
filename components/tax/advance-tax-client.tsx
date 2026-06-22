"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { computeAdvanceTax, DEMO_ADVANCE_TAX } from "@/lib/tax/advance-tax";
import { AlertTriangle, CheckCircle2, Clock, CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

export function AdvanceTaxClient() {
  const [estimatedRevenue, setEstimatedRevenue] = useState(45000000);
  const [estimatedExpenses, setEstimatedExpenses] = useState(32000000);
  const [tdsCredit, setTdsCredit] = useState(1200000);

  const ct = computeAdvanceTax(estimatedRevenue, estimatedExpenses, tdsCredit);

  const statusIcon: Record<string, React.ReactNode> = {
    paid: <CheckCircle2 className="size-4 text-emerald-500" />,
    short: <AlertTriangle className="size-4 text-amber-500" />,
    pending: <Clock className="size-4 text-muted-foreground" />,
    "due-today": <CalendarClock className="size-4 text-primary" />,
  };

  const statusVariant: Record<string, "success" | "warning" | "default" | "primary"> = {
    paid: "success",
    short: "warning",
    pending: "default",
    "due-today": "primary",
  };

  return (
    <>
      <PageHeader
        title="Advance Tax"
        subtitle="Sec. 207–211 installment schedule + 234B/234C interest computation"
        actions={
          <Badge variant={ct.total234c + ct.total234b > 0 ? "warning" : "success"}>
            {ct.total234c + ct.total234b > 0
              ? `234C/234B interest: ₹${((ct.total234c + ct.total234b) / 100000).toFixed(1)}L`
              : "No interest liability"}
          </Badge>
        }
      />

      {/* Inputs */}
      <Card className="mb-4 p-4">
        <p className="mb-3 text-sm font-semibold">Estimated figures for FY {ct.fy}</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          {[
            { label: "Estimated Revenue (₹)", key: "rev", value: estimatedRevenue, setter: setEstimatedRevenue },
            { label: "Deductible Expenses (₹)", key: "exp", value: estimatedExpenses, setter: setEstimatedExpenses },
            { label: "Expected TDS Credit (₹)", key: "tds", value: tdsCredit, setter: setTdsCredit },
          ].map((f) => (
            <div key={f.key}>
              <label className="mb-1 block text-xs text-muted-foreground">{f.label}</label>
              <input
                type="number"
                className="w-full rounded border bg-background px-3 py-1.5 text-sm"
                value={f.value}
                onChange={(e) => f.setter(Number(e.target.value))}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* Tax computation summary */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Taxable Income", value: ct.taxableIncome },
          { label: "Gross Tax (22%)", value: ct.grossTax },
          { label: "Total Liability (after TDS)", value: ct.totalLiability },
          { label: "Net Payable (incl. interest)", value: ct.netPayable },
        ].map((k) => (
          <Card key={k.label} className={cn("p-3", k.label.includes("Payable") && ct.netPayable > 0 && "border-amber-400 bg-amber-50 dark:bg-amber-950/20")}>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-0.5 text-lg font-bold"><Money value={k.value} /></p>
          </Card>
        ))}
      </div>

      {/* Installment schedule */}
      <Card className="mb-4 overflow-hidden">
        <div className="border-b px-4 py-3 font-semibold text-sm">Installment Schedule</div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Quarter", "Due Date", "Required (Cum %)", "Required (₹)", "Paid (₹)", "Shortfall", "234C Interest", "Status"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ct.installments.map((inst) => (
                <tr key={inst.quarter} className={cn("border-b border-border/40", inst.status === "pending" && "opacity-60")}>
                  <td className="px-3 py-2.5 font-medium">{inst.quarter}</td>
                  <td className="px-3 py-2.5 font-mono text-xs">{inst.dueDate}</td>
                  <td className="px-3 py-2.5 text-center">{inst.requiredCumPct}%</td>
                  <td className="px-3 py-2.5 text-right"><Money value={inst.requiredCumAmount} /></td>
                  <td className="px-3 py-2.5 text-right"><Money value={inst.paidCumAmount} /></td>
                  <td className="px-3 py-2.5 text-right">
                    {inst.shortfall > 0 ? <span className="text-amber-600 font-medium"><Money value={inst.shortfall} /></span> : <span className="text-emerald-600">–</span>}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {inst.sec234cInterest > 0 ? <span className="text-red-600 font-medium"><Money value={inst.sec234cInterest} /></span> : "–"}
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge variant={statusVariant[inst.status]} className="flex w-fit items-center gap-1">
                      {statusIcon[inst.status]}
                      {inst.status === "due-today" ? "Due today" : inst.status.charAt(0).toUpperCase() + inst.status.slice(1)}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Interest summary */}
      {(ct.total234c > 0 || ct.total234b > 0) && (
        <Card className="border-amber-400 bg-amber-50 dark:bg-amber-950/20 p-4">
          <p className="font-semibold text-sm mb-2 text-amber-800 dark:text-amber-200">Interest Liability</p>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Sec. 234C — Deferment of installments", value: ct.total234c },
              { label: "Sec. 234B — Shortfall in advance tax", value: ct.total234b },
              { label: "Total interest", value: ct.total234c + ct.total234b },
            ].map((r) => (
              <div key={r.label}>
                <p className="text-xs text-muted-foreground">{r.label}</p>
                <p className="font-bold text-amber-700 dark:text-amber-300"><Money value={r.value} /></p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Interest under Sec. 234C is computed @ 1% per month on the shortfall at each due date. Sec. 234B applies
            if total advance tax paid is less than 90% of assessed tax.
          </p>
        </Card>
      )}
    </>
  );
}
