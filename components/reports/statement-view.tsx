"use client";

import { Fragment, useMemo, useRef, useState } from "react";
import { Printer, ChevronRight } from "lucide-react";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Button } from "@/components/ui/button";
import { ExcelExport } from "@/components/excel/excel-export";
import { Drawer } from "@/components/ui/modal";
import { Money } from "@/components/ui/money";
import type { ReportSheet } from "@/lib/xlsx/report";
import type { ReportFilters } from "@/lib/accounting/types";
import { filteredPostings } from "@/lib/accounting/ledger";
import { accountSafe } from "@/lib/accounting/chart-of-accounts";
import { formatMoney, type Currency } from "@/lib/currency";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export interface StatementDetail {
  label: string;
  amount?: number;
  hint?: string;
}

export interface StatementRow {
  key: string;
  label: string;
  amount?: number;
  level?: number;
  variant?: "group" | "line" | "subtotal" | "total" | "spacer" | "note";
  hint?: string;
  /** Contributing lines revealed when the row is expanded (drill-down). */
  detail?: StatementDetail[];
  /** GL account codes whose postings compose this row's amount — enables drill-through. */
  drillCodes?: string[];
}

export function StatementView({
  title,
  subtitle,
  scopeLabel,
  periodLabel,
  basisLabel,
  rows,
  filters,
}: {
  title: string;
  subtitle?: string;
  scopeLabel: string;
  periodLabel: string;
  basisLabel?: string;
  rows: StatementRow[];
  /** When provided, amounts with drillCodes become clickable and open a GL drill-through drawer. */
  filters?: ReportFilters;
}) {
  const { currency } = usePrefs();
  const tableRef = useRef<HTMLTableElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [drill, setDrill] = useState<{ codes: string[]; label: string } | null>(null);
  const fmt = (n: number) => formatMoney(n, currency);
  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const drillPostings = useMemo(() => {
    if (!drill || !filters) return [];
    const set = new Set(drill.codes);
    return filteredPostings(filters).filter((p) => set.has(p.accountCode));
  }, [drill, filters]);

  // Excel export through the shared formatting tool. Amounts are converted to the
  // active display currency; scope, period and basis ride along as meta lines.
  function buildSheets(): ReportSheet[] {
    const indent = (lvl?: number) => "    ".repeat(lvl ?? 0);
    return [
      {
        name: title.slice(0, 28) || "Statement",
        title,
        subtitle,
        meta: [scopeLabel, periodLabel, basisLabel, `Currency: ${currency.code}`].filter(Boolean) as string[],
        columns: [
          { header: "Particulars", key: "label", type: "text", width: 46 },
          { header: "Amount", key: "amount", type: "money", width: 18 },
        ],
        rows: rows
          .filter((r) => r.variant !== "spacer")
          .map((r) => {
            const bold = r.variant === "group" || r.variant === "total" || r.variant === "subtotal";
            const style = bold ? { bold: true } : undefined;
            return {
              label: {
                value: `${indent(r.level)}${r.label}${r.hint ? `  (${r.hint})` : ""}`,
                style,
              },
              amount:
                r.amount === undefined
                  ? { value: "", style }
                  : { value: r.amount * currency.rate, style },
            };
          }),
      },
    ];
  }

  function exportPdf() {
    const win = window.open("", "_blank", "width=900,height=720");
    if (!win) return;
    const body = rows
      .map((r) => {
        if (r.variant === "spacer") return `<tr><td colspan="2" style="height:8px"></td></tr>`;
        const bold = r.variant === "total" || r.variant === "subtotal" || r.variant === "group";
        const top = r.variant === "total" ? "border-top:2px solid #222;" : "";
        const pad = 8 + (r.level ?? 0) * 18;
        const amt = r.amount === undefined ? "" : fmt(r.amount);
        return `<tr style="${top}">
          <td style="padding:5px 8px;padding-left:${pad}px;font-weight:${bold ? 600 : 400}">${r.label}</td>
          <td style="padding:5px 8px;text-align:right;font-weight:${bold ? 600 : 400};font-variant-numeric:tabular-nums">${amt}</td>
        </tr>`;
      })
      .join("");
    win.document.write(`<!doctype html><html><head><title>${title}</title>
      <style>
        body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#1a1a1a;margin:40px;}
        .brand{font-weight:800;font-size:18px;color:#1d4ed8;letter-spacing:-.02em}
        h1{font-size:20px;margin:6px 0 2px}
        .meta{color:#555;font-size:12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:13px}
      </style></head><body>
      <div class="brand">▲ NEXA</div>
      <h1>${title}</h1>
      <div class="meta">${[scopeLabel, periodLabel, basisLabel, currency.code].filter(Boolean).join(" &nbsp;•&nbsp; ")}</div>
      <table>${body}</table>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <>
    <div className="rounded-lg border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-bold">{title}</h2>
          <p className="text-xs text-muted-foreground">
            {subtitle ? `${subtitle} · ` : ""}{scopeLabel} · {periodLabel}
          </p>
        </div>
        <div className="flex gap-2">
          <ExcelExport filename={title.replace(/\s+/g, "-").toLowerCase()} build={buildSheets} label="Excel" />
          <Button variant="outline" size="sm" onClick={exportPdf}>
            <Printer className="size-4" /> PDF
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto p-2 sm:p-4">
        <table ref={tableRef} className="w-full text-sm">
          <tbody>
            {rows.map((r) => {
              if (r.variant === "spacer") return <tr key={r.key}><td className="h-3" /></tr>;
              const isGroup = r.variant === "group";
              const isTotal = r.variant === "total";
              const isSub = r.variant === "subtotal";
              const isNote = r.variant === "note";
              const hasDetail = !!r.detail && r.detail.length > 0;
              const isOpen = expanded.has(r.key);
              const pad = (r.level ?? 0) * 18 + 8;
              return (
                <Fragment key={r.key}>
                  <tr
                    className={cn(
                      "border-b border-border/40 last:border-0",
                      isGroup && "bg-muted/40",
                      isTotal && "border-t-2 border-t-foreground/70",
                      hasDetail && "cursor-pointer hover:bg-accent/40",
                    )}
                    onClick={hasDetail ? () => toggle(r.key) : undefined}
                  >
                    <td
                      className={cn(
                        "py-2 pr-4",
                        (isGroup || isTotal) && "font-semibold",
                        isSub && "font-medium",
                        isNote && "text-xs text-muted-foreground",
                      )}
                      style={{ paddingLeft: `${pad}px` }}
                    >
                      <span className="flex items-center gap-1.5">
                        {hasDetail && (
                          <ChevronRight
                            className={cn("-ml-5 size-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")}
                          />
                        )}
                        <span>{r.label}</span>
                        {r.hint && <span className="ml-1 text-xs font-normal text-muted-foreground">{r.hint}</span>}
                      </span>
                    </td>
                    <td
                      className={cn(
                        "py-2 pl-4 pr-2 text-right tabular",
                        (isGroup || isTotal) && "font-semibold",
                        isSub && "font-medium",
                        isNote && "text-xs text-muted-foreground",
                      )}
                    >
                      {r.amount === undefined ? "" : r.drillCodes && filters ? (
                        <button
                          className="tabular hover:text-primary hover:underline decoration-dashed underline-offset-2 cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); setDrill({ codes: r.drillCodes!, label: r.label }); }}
                          title="View transactions"
                        >
                          {fmt(r.amount)}
                        </button>
                      ) : fmt(r.amount)}
                    </td>
                  </tr>
                  {hasDetail && isOpen &&
                    r.detail!.map((d, i) => (
                      <tr key={`${r.key}-d${i}`} className="border-b border-border/30 bg-muted/20 last:border-0">
                        <td className="py-1.5 pr-4 text-xs text-muted-foreground" style={{ paddingLeft: `${pad + 22}px` }}>
                          {d.label}
                          {d.hint && <span className="ml-2 text-muted-foreground/70">{d.hint}</span>}
                        </td>
                        <td className="py-1.5 pl-4 pr-2 text-right text-xs tabular text-muted-foreground">
                          {d.amount === undefined ? "" : fmt(d.amount)}
                        </td>
                      </tr>
                    ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>

    {/* ---- GL Drill-through drawer ---------------------------------------- */}
    <Drawer
      open={!!drill}
      onClose={() => setDrill(null)}
      title={drill ? `Transactions: ${drill.label}` : ""}
      subtitle={drill ? `${scopeLabel} · ${periodLabel}` : ""}
      width="max-w-2xl"
    >
      {drill && (
        <DrillTable postings={drillPostings} currency={currency} />
      )}
    </Drawer>
    </>
  );
}

function DrillTable({
  postings,
  currency,
}: {
  postings: ReturnType<typeof filteredPostings>;
  currency: Currency;
}) {
  const fmt = (n: number) => formatMoney(n, currency);
  if (postings.length === 0) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No transactions in this period.</p>;
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">{postings.length} posting{postings.length !== 1 ? "s" : ""}</p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b bg-muted/40">
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Date</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Account</th>
              <th className="px-3 py-2 text-left font-medium text-muted-foreground">Narration</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Dr</th>
              <th className="px-3 py-2 text-right font-medium text-muted-foreground">Cr</th>
            </tr>
          </thead>
          <tbody>
            {postings.map((p) => {
              const acct = accountSafe(p.accountCode);
              return (
                <tr key={p.id} className="border-b border-border/40 last:border-0 hover:bg-accent/30">
                  <td className="px-3 py-1.5 tabular text-muted-foreground whitespace-nowrap">{formatDate(p.date)}</td>
                  <td className="px-3 py-1.5">
                    <span className="text-muted-foreground">{p.accountCode}</span>
                    {acct && <span className="ml-1">{acct.name}</span>}
                  </td>
                  <td className="px-3 py-1.5 text-muted-foreground max-w-48 truncate">{p.memo || "—"}</td>
                  <td className="px-3 py-1.5 text-right tabular">{p.debit > 0 ? fmt(p.debit) : ""}</td>
                  <td className="px-3 py-1.5 text-right tabular">{p.credit > 0 ? fmt(p.credit) : ""}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t bg-muted/40">
              <td colSpan={3} className="px-3 py-1.5 text-xs font-medium text-muted-foreground">Total</td>
              <td className="px-3 py-1.5 text-right tabular font-medium">
                {fmt(postings.reduce((s, p) => s + p.debit, 0))}
              </td>
              <td className="px-3 py-1.5 text-right tabular font-medium">
                {fmt(postings.reduce((s, p) => s + p.credit, 0))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
