"use client";

import * as React from "react";
import { Check, Flag, BookCheck, AlertTriangle, BookX, Scale, ShieldAlert, Download, FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Label, Select } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { downloadCsv, printDocument } from "@/lib/export";
import { entityById } from "@/lib/accounting/org";
import {
  reconcile,
  availablePeriods,
  bookEntities,
  placeLabelFor,
  vendorGroups,
  loadActions,
  saveActions,
  STATUS_META,
  ACTION_META,
  ALL_PERIOD,
  type ReconStatus,
  type ReconLine,
  type VendorReconGroup,
  type ActionStore,
  type LineAction,
} from "@/lib/tax/gstr2b";

const FILTERS: { key: ReconStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "matched", label: "Matched" },
  { key: "mismatch", label: "Value mismatch" },
  { key: "missing-in-2b", label: "Missing in 2B" },
  { key: "missing-in-books", label: "Missing in books" },
];

export function Gstr2bClient() {
  const periods = React.useMemo(() => availablePeriods(), []);
  const entities = React.useMemo(() => bookEntities(), []);

  const [period, setPeriod] = React.useState<string>(periods[0]?.key ?? ALL_PERIOD);
  const [entityId, setEntityId] = React.useState<string>(ALL_PERIOD);
  const [filter, setFilter] = React.useState<ReconStatus | "all">("all");
  const [actions, setActions] = React.useState<ActionStore>({});
  const [stmtVendor, setStmtVendor] = React.useState<string>("");

  React.useEffect(() => {
    setActions(loadActions());
  }, []);

  const result = React.useMemo(() => reconcile(period, entityId), [period, entityId]);
  const groups = React.useMemo(() => vendorGroups(result), [result]);

  // Period / entity labels reused by exports.
  const periodLabel = period === ALL_PERIOD ? "All periods" : (periods.find((p) => p.key === period)?.label ?? period);
  const entityLabel = entityId === ALL_PERIOD ? "All entities" : (entityById(entityId)?.name ?? entityId);
  const periodTag = period === ALL_PERIOD ? "all-periods" : period;

  // The chosen vendor for a shareable statement (default: the one with the most to fix).
  const activeGroup = groups.find((g) => g.vendorId === stmtVendor) ?? groups[0];

  const setAction = (id: string, action: LineAction) => {
    setActions((prev) => {
      // toggle off if the same action is clicked again
      const next: ActionStore = { ...prev };
      if (next[id] === action) delete next[id];
      else next[id] = action;
      saveActions(next);
      return next;
    });
  };

  const visible = result.lines.filter((l) => filter === "all" || l.status === filter);

  function exportCsv() {
    downloadCsv(
      `gstr2b-recon-${periodTag}`,
      [
        "Status", "Vendor", "GSTIN", "Place of supply", "Invoice no", "Date", "Rate %",
        "Book taxable", "Book tax", "2B taxable", "2B tax", "Difference (taxable)",
        "ITC eligible", "ITC claimable", "Action", "Note",
      ],
      visible.map((l) => [
        STATUS_META[l.status].label, l.vendor, l.gstin, placeLabelFor(l.gstin), l.invoiceNo,
        formatDate(l.date), l.rate, l.bookValue, l.bookTax, l.b2bValue, l.b2bTax, l.difference,
        l.itcEligible ? "Y" : "N", l.itcAmount, actions[l.id] ? ACTION_META[actions[l.id]].label : "",
        l.note,
      ]),
    );
  }

  function exportVendorStatement() {
    if (!activeGroup) return;
    printDocument(
      `GSTR-2B Reconciliation — ${activeGroup.vendor}`,
      vendorStatementHtml(activeGroup, periodLabel, entityLabel),
    );
  }

  // per-status counts for the chips
  const counts = React.useMemo(() => {
    const c: Record<string, number> = { all: result.lines.length };
    for (const l of result.lines) c[l.status] = (c[l.status] ?? 0) + 1;
    return c;
  }, [result.lines]);

  return (
    <>
      <PageHeader
        title="GSTR-2B Reconciliation"
        subtitle="Match the portal's auto-drafted GSTR-2B against your purchase register and lock down your eligible input tax credit."
      />

      {/* Filters: period + entity */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-44">
          <Label>Return period</Label>
          <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="mt-1">
            <option value={ALL_PERIOD}>All periods</option>
            {periods.map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </Select>
        </div>
        <div className="w-52">
          <Label>Entity</Label>
          <Select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="mt-1">
            <option value={ALL_PERIOD}>All entities</option>
            {entities.map((en) => (
              <option key={en.id} value={en.id}>{en.name}</option>
            ))}
          </Select>
        </div>

        {/* Exports — full CSV + a per-vendor statement to share with the vendor */}
        <div className="ml-auto flex flex-wrap items-end gap-2">
          <Button size="sm" variant="outline" className="h-9" onClick={exportCsv} disabled={visible.length === 0}>
            <Download className="size-4" /> Export CSV
          </Button>
          {groups.length > 0 && (
            <div>
              <Label className="text-[11px]">Vendor statement</Label>
              <div className="mt-1 flex items-center gap-2">
                <Select
                  value={activeGroup?.vendorId ?? ""}
                  onChange={(e) => setStmtVendor(e.target.value)}
                  className="h-9 w-48"
                >
                  {groups.map((g) => (
                    <option key={g.vendorId} value={g.vendorId}>
                      {g.vendor}{g.discrepancyCount > 0 ? ` (${g.discrepancyCount} to fix)` : ""}
                    </option>
                  ))}
                </Select>
                <Button size="sm" variant="outline" className="h-9" onClick={exportVendorStatement} disabled={!activeGroup}>
                  <FileText className="size-4" /> Statement
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard icon={<BookCheck className="size-4" />} label="ITC as per books" value={result.itcAsPerBooks} />
        <SummaryCard icon={<Scale className="size-4" />} label="ITC as per 2B" value={result.itcAsPer2b} />
        <SummaryCard
          icon={<Check className="size-4" />}
          label="Matched"
          plain={`${result.matchedPct}%`}
          sub={`${result.matchedCount} of ${result.lines.filter((l) => l.status !== "missing-in-books").length} book lines`}
        />
        <SummaryCard
          icon={<ShieldAlert className="size-4" />}
          label="ITC at risk"
          value={result.itcAtRisk}
          danger
          sub="vendor hasn't filed"
        />
      </div>

      {/* Net-claimable strip */}
      <Card className="mb-4">
        <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 text-sm">
          <span className="flex items-center gap-1.5 font-medium">
            <BookCheck className="size-4 text-success" /> Net claimable ITC:
            <span className="font-bold text-success"><Money value={result.netClaimable} /></span>
          </span>
          <span className="text-muted-foreground">
            To reverse / withhold: <Money value={result.itcToReverse} className="text-warning" />
          </span>
          <span className="text-muted-foreground">
            At risk: <Money value={result.itcAtRisk} className="text-danger" />
          </span>
        </CardContent>
      </Card>

      {/* Status filter chips */}
      <div className="mb-4 flex flex-wrap gap-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              f.key === filter ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {f.label}
            <span className={cn(
              "rounded-full px-1.5 text-xs",
              f.key === filter ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground",
            )}>
              {counts[f.key] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Reconciliation table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Vendor</th>
                <th className="px-4 py-3 font-medium">Invoice</th>
                <th className="px-4 py-3 text-right font-medium">Book value</th>
                <th className="px-4 py-3 text-right font-medium">2B value</th>
                <th className="px-4 py-3 text-right font-medium">Difference</th>
                <th className="px-4 py-3 text-right font-medium">ITC eligible</th>
                <th className="px-4 py-3 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((l) => {
                const meta = STATUS_META[l.status];
                const act = actions[l.id];
                return (
                  <tr key={l.id} className="border-b align-top transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-4 py-3">
                      <Badge variant={meta.tone}>{meta.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.vendor}</div>
                      <div className="text-xs text-muted-foreground">{l.gstin} · {placeLabelFor(l.gstin)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium">{l.invoiceNo}</div>
                      <div className="text-xs text-muted-foreground">{formatDate(l.date)} · {l.rate}% GST</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular">
                      {l.bookValue > 0 ? <Money value={l.bookValue} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right tabular">
                      {l.b2bValue > 0 ? <Money value={l.b2bValue} /> : <span className="text-muted-foreground">—</span>}
                    </td>
                    <td className={cn("px-4 py-3 text-right tabular", l.difference !== 0 && "font-semibold text-danger")}>
                      {l.difference === 0 ? <span className="text-muted-foreground">—</span> : <Money value={l.difference} bracketNegatives />}
                    </td>
                    <td className="px-4 py-3 text-right tabular">
                      {l.itcEligible ? <Money value={l.itcAmount} /> : <span className="text-xs text-danger">Blocked</span>}
                    </td>
                    <td className="px-4 py-3">
                      {act ? (
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={ACTION_META[act].tone}>{ACTION_META[act].label}</Badge>
                          <button
                            onClick={() => setAction(l.id, act)}
                            className="text-xs text-muted-foreground hover:text-foreground hover:underline"
                          >
                            undo
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 px-2 text-xs"
                            onClick={() => setAction(l.id, "accept")}
                          >
                            <Check className="size-3.5" /> Accept ITC
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs"
                            onClick={() => setAction(l.id, "followup")}
                          >
                            <Flag className="size-3.5" /> Follow up
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">
                    No lines for this filter.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Legend */}
      <Card className="mt-4">
        <CardHeader>
          <CardTitle>How to read this</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 pb-4 sm:grid-cols-2">
          <Legend icon={<Check className="size-4 text-success" />} title="Matched" body={STATUS_META.matched.blurb} />
          <Legend icon={<AlertTriangle className="size-4 text-warning" />} title="Value mismatch" body={STATUS_META.mismatch.blurb} />
          <Legend icon={<ShieldAlert className="size-4 text-danger" />} title="Missing in 2B" body={STATUS_META["missing-in-2b"].blurb} />
          <Legend icon={<BookX className="size-4 text-muted-foreground" />} title="Missing in books" body={STATUS_META["missing-in-books"].blurb} />
        </CardContent>
      </Card>
    </>
  );
}

function SummaryCard({
  icon, label, value, plain, sub, danger,
}: {
  icon: React.ReactNode;
  label: string;
  value?: number;
  plain?: string;
  sub?: string;
  danger?: boolean;
}) {
  return (
    <Card className={cn(danger && "border-danger/30 bg-danger/5")}>
      <CardContent className="py-4">
        <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span className={cn(danger && "text-danger")}>{icon}</span>
          {label}
        </div>
        <p className={cn("mt-1 text-2xl font-bold tabular", danger && "text-danger")}>
          {plain ?? <Money value={value ?? 0} />}
        </p>
        {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function Legend({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5">{icon}</span>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{body}</p>
      </div>
    </div>
  );
}

// --- Per-vendor statement (print-to-PDF) ------------------------------------

const inr = (n: number) => (n > 0 ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—");

function actionText(l: ReconLine): string {
  switch (l.status) {
    case "missing-in-2b":
      return "Not reflected in GSTR-2B — please file this invoice in your GSTR-1.";
    case "mismatch":
      return l.difference > 0
        ? "Value you filed is lower than our invoice — please verify & amend."
        : "Value you filed is higher than our invoice — please verify & amend.";
    case "missing-in-books":
      return "In your filing but not in our books — please share the invoice copy.";
    default:
      return "Matched — no action required.";
  }
}

function vendorStatementHtml(group: VendorReconGroup, periodLabel: string, entityLabel: string): string {
  const generated = new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  const rows = group.lines
    .map((l) => `
      <tr>
        <td>${l.invoiceNo}</td>
        <td>${formatDate(l.date)}</td>
        <td class="n">${l.rate}%</td>
        <td class="n">${inr(l.b2bValue)}</td>
        <td class="n">${inr(l.bookValue)}</td>
        <td class="n">${l.difference === 0 ? "—" : inr(Math.abs(l.difference))}</td>
        <td>${STATUS_META[l.status].label}</td>
        <td>${actionText(l)}</td>
      </tr>`)
    .join("");

  return `
    <h1>GSTR-2B Reconciliation Statement</h1>
    <div class="sub">${periodLabel} · ${entityLabel} · generated ${generated}</div>
    <table style="margin-bottom:14px">
      <tr><th style="width:22%">Vendor</th><td>${group.vendor}</td></tr>
      <tr><th>GSTIN</th><td>${group.gstin}</td></tr>
      <tr><th>Invoices in scope</th><td>${group.lines.length} · ${group.discrepancyCount} needing action</td></tr>
      ${group.itcAtRisk > 0 ? `<tr><th>ITC pending on filing</th><td>${inr(group.itcAtRisk)}</td></tr>` : ""}
    </table>
    <p class="sub">
      As part of our input-tax-credit reconciliation against GSTR-2B for ${periodLabel}, the following invoices were
      compared between your filing and our purchase records. Kindly action the items marked below.
    </p>
    <table>
      <thead>
        <tr>
          <th>Invoice no</th><th>Date</th><th class="n">Rate</th>
          <th class="n">As filed (2B)</th><th class="n">Our books</th><th class="n">Difference</th>
          <th>Status</th><th>Action needed</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="sub" style="margin-top:18px">
      Values shown are taxable amounts. This statement is generated from our books and the GSTR-2B auto-drafted by the
      GST portal; please reconcile against your own records and revert with any corrections.
    </p>`;
}
