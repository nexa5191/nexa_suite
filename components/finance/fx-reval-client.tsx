"use client";

import * as React from "react";
import { TrendingUp, TrendingDown, Scale, Globe, BookCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Label } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { entityById } from "@/lib/accounting/org";
import {
  FX_OPEN_ITEMS,
  FX_CURRENCIES,
  fxSymbol,
  loadRateRows,
  saveRateRows,
  ratesFromRows,
  runRevaluation,
  buildRevalJournal,
  journalTotals,
  type RateRow,
  type FxCurrency,
  type FxItemType,
  type FxRevalLine,
} from "@/lib/finance/fx-reval";

const TYPE_TONE: Record<FxItemType, "primary" | "warning" | "success"> = {
  AR: "primary",
  AP: "warning",
  Bank: "success",
};
const TYPE_LABEL: Record<FxItemType, string> = {
  AR: "Receivable",
  AP: "Payable",
  Bank: "Bank",
};

/** Foreign-currency amount like "$12,000" — NOT base INR, so not <Money>. */
function fc(amount: number, currency: FxCurrency): string {
  return `${fxSymbol(currency)}${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function FxRevalClient() {
  const [rows, setRows] = React.useState<RateRow[]>(() => loadRateRows());

  React.useEffect(() => {
    setRows(loadRateRows());
  }, []);

  const rates = React.useMemo(() => ratesFromRows(rows), [rows]);
  const result = React.useMemo(() => runRevaluation(FX_OPEN_ITEMS, rates), [rates]);
  const journal = React.useMemo(() => buildRevalJournal(result), [result]);
  const jTotals = React.useMemo(() => journalTotals(journal), [journal]);

  function setRate(currency: FxCurrency, value: string) {
    const n = parseFloat(value);
    setRows((prev) => {
      const next = prev.map((r) =>
        r.currency === currency ? { ...r, periodEndInr: Number.isFinite(n) ? n : 0 } : r,
      );
      saveRateRows(next);
      return next;
    });
  }

  // Group the open-items lines by currency for subtotalling.
  const grouped = React.useMemo(() => {
    const map = new Map<FxCurrency, FxRevalLine[]>();
    for (const l of result.lines) {
      const arr = map.get(l.item.currency) ?? [];
      arr.push(l);
      map.set(l.item.currency, arr);
    }
    return FX_CURRENCIES.filter((c) => map.has(c)).map((c) => ({
      currency: c,
      lines: map.get(c)!,
      agg: result.byCurrency[c],
    }));
  }, [result]);

  return (
    <>
      <PageHeader
        title="FX Revaluation"
        subtitle="Period-end restatement of foreign-currency open items · as on 31 May 2026"
      />

      {/* Editable rate table */}
      <Card className="mb-4">
        <CardHeader>
          <CardTitle>Closing rates · INR per 1 foreign unit</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {rows.map((r) => {
              const drift = r.periodEndInr - r.baselineInr;
              return (
                <div key={r.currency} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{r.currency}</span>
                    <span className="text-xs text-muted-foreground">{fxSymbol(r.currency)}</span>
                  </div>
                  <Label className="mt-2 block">Period-end rate</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={r.periodEndInr}
                    onChange={(e) => setRate(r.currency, e.target.value)}
                    className="mt-1 tabular"
                  />
                  <p className="mt-1.5 text-[11px] text-muted-foreground">
                    Baseline {r.baselineInr.toFixed(2)}
                    {Math.abs(drift) >= 0.01 && (
                      <span className={cn("ml-1 font-medium", drift > 0 ? "text-success" : "text-danger")}>
                        ({drift > 0 ? "+" : ""}{drift.toFixed(2)})
                      </span>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<Globe className="size-4" />}
          label="FC exposure (revalued)"
          value={result.exposureInr}
        />
        <SummaryCard
          icon={<TrendingUp className="size-4 text-success" />}
          label="Unrealised gain"
          value={result.totalGain}
          tone="success"
        />
        <SummaryCard
          icon={<TrendingDown className="size-4 text-danger" />}
          label="Unrealised loss"
          value={result.totalLoss}
          tone="danger"
        />
        <SummaryCard
          icon={<Scale className="size-4" />}
          label="Net impact"
          value={result.net}
          colored
        />
      </div>

      {/* Open-items table, grouped by currency */}
      <Card className="mb-4 overflow-hidden">
        <CardHeader>
          <CardTitle>Open foreign-currency monetary items</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Document</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 text-right font-medium">FC amount</th>
                <th className="px-5 py-3 text-right font-medium">Booked rate</th>
                <th className="px-5 py-3 text-right font-medium">Period-end</th>
                <th className="px-5 py-3 text-right font-medium">Booked INR</th>
                <th className="px-5 py-3 text-right font-medium">Revalued INR</th>
                <th className="px-5 py-3 text-right font-medium">Gain / (loss)</th>
              </tr>
            </thead>
            <tbody>
              {grouped.map((g) => (
                <React.Fragment key={g.currency}>
                  <tr className="border-b bg-muted/20">
                    <td colSpan={8} className="px-5 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      {g.currency} · {fxSymbol(g.currency)}
                    </td>
                  </tr>
                  {g.lines.map((l) => {
                    const ent = entityById(l.item.entityId);
                    return (
                      <tr key={l.item.id} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                        <td className="px-5 py-3">
                          <div className="font-medium">{l.item.party}</div>
                          <div className="text-xs text-muted-foreground">
                            {ent?.name ?? "—"} · {formatDate(l.item.docDate)}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge variant={TYPE_TONE[l.item.type]}>{TYPE_LABEL[l.item.type]}</Badge>
                        </td>
                        <td className="px-5 py-3 text-right tabular">{fc(l.item.fcAmount, l.item.currency)}</td>
                        <td className="px-5 py-3 text-right tabular text-muted-foreground">{l.item.bookedRateInr.toFixed(2)}</td>
                        <td className="px-5 py-3 text-right tabular">{rates[l.item.currency].toFixed(2)}</td>
                        <td className="px-5 py-3 text-right tabular"><Money value={l.bookedInr} /></td>
                        <td className="px-5 py-3 text-right tabular"><Money value={l.revaluedInr} /></td>
                        <td className="px-5 py-3 text-right tabular font-medium">
                          <Money value={l.gainLossInr} colored bracketNegatives />
                        </td>
                      </tr>
                    );
                  })}
                  <tr className="border-b bg-muted/30 text-xs font-semibold">
                    <td className="px-5 py-2" colSpan={5}>{g.currency} subtotal</td>
                    <td className="px-5 py-2 text-right tabular">
                      <Money value={g.lines.reduce((s, l) => s + l.bookedInr, 0)} />
                    </td>
                    <td className="px-5 py-2 text-right tabular">
                      <Money value={g.lines.reduce((s, l) => s + l.revaluedInr, 0)} />
                    </td>
                    <td className="px-5 py-2 text-right tabular">
                      <Money value={g.agg.gainLossInr} colored bracketNegatives />
                    </td>
                  </tr>
                </React.Fragment>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 text-sm font-bold">
                <td className="px-5 py-3" colSpan={6}>Net unrealised impact</td>
                <td className="px-5 py-3 text-right text-xs font-normal text-muted-foreground">
                  Gain <Money value={result.totalGain} compact /> · Loss <Money value={result.totalLoss} compact />
                </td>
                <td className="px-5 py-3 text-right tabular">
                  <Money value={result.net} colored bracketNegatives />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Revaluation journal */}
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookCheck className="size-4 text-muted-foreground" /> Revaluation journal · 31 May 2026
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground">
            Restatement entry that would post to the GL. Unrealised — not yet realised on settlement.
          </p>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Account</th>
                  <th className="px-4 py-2.5 font-medium">Narration</th>
                  <th className="px-4 py-2.5 text-right font-medium">Debit</th>
                  <th className="px-4 py-2.5 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {journal.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-muted-foreground">
                      No movement — period-end rates equal the booked rates.
                    </td>
                  </tr>
                ) : (
                  journal.map((j, i) => (
                    <tr key={i} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                      <td className="px-4 py-2.5 font-medium">{j.account}</td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">{j.note}</td>
                      <td className="px-4 py-2.5 text-right tabular">{j.debit ? <Money value={j.debit} /> : <span className="text-muted-foreground">—</span>}</td>
                      <td className="px-4 py-2.5 text-right tabular">{j.credit ? <Money value={j.credit} /> : <span className="text-muted-foreground">—</span>}</td>
                    </tr>
                  ))
                )}
              </tbody>
              {journal.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 font-bold">
                    <td className="px-4 py-2.5" colSpan={2}>
                      Total
                      <Badge variant={Math.round(jTotals.debit) === Math.round(jTotals.credit) ? "success" : "danger"} className="ml-2">
                        {Math.round(jTotals.debit) === Math.round(jTotals.credit) ? "Balanced" : "Out of balance"}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular"><Money value={jTotals.debit} /></td>
                    <td className="px-4 py-2.5 text-right tabular"><Money value={jTotals.credit} /></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function SummaryCard({
  icon,
  label,
  value,
  tone,
  colored,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone?: "success" | "danger";
  colored?: boolean;
}) {
  return (
    <Card className={cn("p-4", tone === "success" && "border-success/30 bg-success/5", tone === "danger" && "border-danger/30 bg-danger/5")}>
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {icon} {label}
      </div>
      <p
        className={cn(
          "mt-2 text-xl font-bold tabular",
          tone === "success" && "text-success",
          tone === "danger" && "text-danger",
        )}
      >
        <Money value={value} colored={colored} bracketNegatives={colored} />
      </p>
    </Card>
  );
}
