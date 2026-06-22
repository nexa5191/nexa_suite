"use client";

import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import {
  TP_TRANSACTIONS,
  tpSummary,
  ALP_LABELS,
  CATEGORY_LABELS,
} from "@/lib/tax/transfer-pricing";
import { AlertTriangle, FileCheck, Globe, Download } from "lucide-react";
import { cn } from "@/lib/utils";

export function TransferPricingClient() {
  const summary = tpSummary();

  function exportCsv() {
    const hdr = "Party,Country,Category,Description,Value,ALP Method,Benchmark Margin%,Actual Margin%,Adjustment,Documented";
    const rows = TP_TRANSACTIONS.map((t) =>
      [`"${t.relatedParty}"`, t.country, t.txnCategory, `"${t.description}"`,
        t.value, t.alpMethod, t.benchmarkMargin ?? "N/A", t.actualMargin ?? "N/A",
        t.adjustment, t.documented ? "Yes" : "No"].join(",")
    );
    const blob = new Blob([[hdr, ...rows].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "transfer-pricing-3CEB.csv";
    a.click();
  }

  return (
    <>
      <PageHeader
        title="Transfer Pricing — Form 3CEB"
        subtitle="International transactions & specified domestic transactions (Chapter X)"
        actions={
          <div className="flex gap-2">
            {summary.undocumented > 0 && (
              <Badge variant="danger">{summary.undocumented} undocumented</Badge>
            )}
            <Badge variant={summary.form3cebRequired ? "warning" : "default"}>
              {summary.form3cebRequired ? "Form 3CEB required" : "Below threshold"}
            </Badge>
          </div>
        }
      />

      {/* Summary KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: "Total TP Value", value: summary.totalValue, icon: <Globe className="size-4" /> },
          { label: "International Txns", value: summary.internationalValue, icon: <Globe className="size-4" /> },
          { label: "Specified Domestic (SDT)", value: summary.sdtValue, icon: <Globe className="size-4" /> },
          { label: "Potential TP Adjustment", value: summary.totalAdjustment, icon: <AlertTriangle className="size-4" /> },
        ].map((k) => (
          <Card key={k.label} className={cn("p-3", k.label.includes("Adjustment") && summary.totalAdjustment > 0 && "border-amber-400 bg-amber-50 dark:bg-amber-950/20")}>
            <p className="text-xs text-muted-foreground">{k.label}</p>
            <p className="mt-0.5 text-lg font-bold"><Money value={k.value} /></p>
          </Card>
        ))}
      </div>

      {/* Documentation alert */}
      {summary.undocumented > 0 && (
        <Card className="mb-4 flex items-start gap-3 border-red-400 bg-red-50 dark:bg-red-950/20 p-4">
          <AlertTriangle className="size-5 text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-sm text-red-700 dark:text-red-300">Documentation gap</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {summary.undocumented} transaction(s) lack Local File / benchmarking documentation.
              Penalty u/s 271AA: 2% of transaction value. Ensure documentation before CA certification.
            </p>
          </div>
        </Card>
      )}

      {/* Transactions */}
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b px-4 py-3">
          <FileCheck className="size-4 text-muted-foreground" />
          <span className="font-semibold text-sm">Covered Transactions (Form 3CEB Schedule)</span>
          <Button size="sm" variant="outline" className="ml-auto" onClick={exportCsv}>
            <Download className="size-4 mr-1" />CSV
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                {["Related Party", "Country", "Category", "Description", "Value", "ALP Method",
                  "Benchmark %", "Actual %", "Adjustment", "Documented"].map((h) => (
                  <th key={h} className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TP_TRANSACTIONS.map((t) => {
                const hasAdjustment = t.adjustment > 0;
                return (
                  <tr key={t.id} className={cn("border-b border-border/40 hover:bg-muted/20", !t.documented && "bg-red-50/30 dark:bg-red-950/10")}>
                    <td className="px-3 py-2.5 font-medium max-w-[160px]">
                      <p className="truncate">{t.relatedParty.split("(")[0].trim()}</p>
                      <p className="text-xs text-muted-foreground">{t.country}</p>
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={t.country === "IND" ? "default" : "primary"} className="text-[10px]">
                        {t.country === "IND" ? "SDT" : "International"}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs">{CATEGORY_LABELS[t.txnCategory]}</td>
                    <td className="px-3 py-2.5 text-xs max-w-[160px] truncate">{t.description}</td>
                    <td className="px-3 py-2.5 text-right font-medium"><Money value={t.value} /></td>
                    <td className="px-3 py-2.5">
                      <span title={ALP_LABELS[t.alpMethod]} className="font-mono text-xs">{t.alpMethod}</span>
                    </td>
                    <td className="px-3 py-2.5 text-right">{t.benchmarkMargin != null ? `${t.benchmarkMargin}%` : "–"}</td>
                    <td className="px-3 py-2.5 text-right">{t.actualMargin != null ? `${t.actualMargin}%` : "–"}</td>
                    <td className="px-3 py-2.5 text-right">
                      {hasAdjustment
                        ? <span className="text-amber-600 font-medium"><Money value={t.adjustment} /></span>
                        : <span className="text-emerald-600 text-xs">Within range</span>}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant={t.documented ? "success" : "danger"}>
                        {t.documented ? "Yes" : "Missing"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* ALP method reference */}
      <details className="mt-4">
        <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground">ALP method reference</summary>
        <Card className="mt-2 p-4">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {Object.entries(ALP_LABELS).map(([code, label]) => (
              <div key={code} className="flex items-center gap-2">
                <span className="font-mono text-xs font-semibold text-primary">{code}</span>
                <span className="text-xs text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Most Appropriate Method (MAM) rule applies — TNMM is most commonly used for service/management fee transactions.
            CUP is preferred for commodity transactions and inter-company loans.
          </p>
        </Card>
      </details>
    </>
  );
}
