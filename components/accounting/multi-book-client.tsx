"use client";

import * as React from "react";
import { BookCopy, Scale, Landmark, Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { downloadCsv } from "@/lib/export";
import { multiBook, type MultiBook } from "@/lib/accounting/multi-book";

export function MultiBookClient() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const mb = React.useMemo<MultiBook | null>(() => (mounted ? multiBook() : null), [mounted]);

  function exportCsv() {
    if (!mb) return;
    const rows: (string | number)[][] = [["Management PBT", mb.managementPbt]];
    mb.statutoryAdjustments.forEach((r) => rows.push([r.label, r.amount]));
    rows.push(["Statutory PBT (Ind AS)", mb.statutoryPbt]);
    mb.taxAdjustments.forEach((r) => rows.push([r.label, r.amount]));
    rows.push(["Taxable income (IT Act)", mb.taxableIncome], ["Tax @ 25.17%", mb.taxExpense]);
    downloadCsv("multi-book-bridge", ["Line", "Amount"], rows);
  }

  return (
    <>
      <PageHeader
        title="Multi-Book Ledger"
        subtitle="Parallel ledgers — Management, Statutory (Ind AS) and Tax (IT Act) from one set of transactions."
        actions={<Button size="sm" variant="outline" onClick={exportCsv} disabled={!mb}><Download className="size-4" /> Export CSV</Button>}
      />

      {mb && (
        <>
          {/* Three books */}
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <BookCard icon={BookCopy} label="Management" pbt={mb.books.management} pat={mb.pat.management} sub="Billing basis · book depreciation" />
            <BookCard icon={Scale} label="Statutory (Ind AS)" pbt={mb.books.statutory} pat={mb.pat.statutory} sub="Ind AS 115 & 116 applied" highlight />
            <BookCard icon={Landmark} label="Tax (IT Act)" pbt={mb.books.tax} taxable sub="Taxable income for return" />
          </div>

          {/* Book-to-tax bridge */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <span className="text-sm font-semibold">Book-to-tax bridge · {mb.fyLabel}</span>
              <Badge variant="outline">one entry → three books</Badge>
            </div>
            <div className="divide-y">
              <BridgeSubtotal label="Management PBT" amount={mb.managementPbt} />
              {mb.statutoryAdjustments.map((r, i) => <BridgeLine key={`s${i}`} {...r} />)}
              <BridgeSubtotal label="Statutory PBT — Ind AS" amount={mb.statutoryPbt} tone="primary" />
              {mb.taxAdjustments.map((r, i) => <BridgeLine key={`t${i}`} {...r} />)}
              <BridgeSubtotal label="Taxable income — IT Act" amount={mb.taxableIncome} tone="primary" />
              <BridgeLine label={`Income tax @ ${(mb.taxRate * 100).toFixed(2)}%`} amount={-mb.taxExpense} />
            </div>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Each book is derived from the same GL by applying its own recognition rules — Ind AS 115 (revenue deferral), Ind AS 116
            (leases) and Income-tax Act depreciation (block WDV) — exactly what a parallel-ledger ERP maintains automatically.
          </p>
        </>
      )}
    </>
  );
}

function BookCard({ icon: Icon, label, pbt, pat, sub, taxable, highlight }: { icon: React.ComponentType<{ className?: string }>; label: string; pbt: number; pat?: number; sub: string; taxable?: boolean; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", highlight && "border-primary/30 bg-primary/5")}>
      <p className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground"><Icon className="size-3.5" /> {label}</p>
      <p className="mt-1 text-2xl font-bold tabular"><Money value={pbt} bracketNegatives /></p>
      <p className="text-[11px] text-muted-foreground">{taxable ? "taxable income" : "profit before tax"}</p>
      {pat !== undefined && <p className="mt-1 text-xs text-muted-foreground">PAT <span className="font-medium text-foreground tabular"><Money value={pat} /></span></p>}
      <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>
    </Card>
  );
}

function BridgeLine({ label, amount, note }: { label: string; amount: number; note?: string }) {
  return (
    <div className="flex items-center justify-between px-5 py-2.5">
      <div>
        <p className="text-sm">{label}</p>
        {note && <p className="text-[11px] text-muted-foreground">{note}</p>}
      </div>
      <span className={cn("tabular text-sm font-medium", amount < 0 ? "text-danger" : "text-success")}>
        {amount >= 0 ? "+" : "−"}<Money value={Math.abs(amount)} />
      </span>
    </div>
  );
}

function BridgeSubtotal({ label, amount, tone }: { label: string; amount: number; tone?: "primary" }) {
  return (
    <div className={cn("flex items-center justify-between px-5 py-3", tone === "primary" ? "bg-primary/5" : "bg-muted/30")}>
      <p className="text-sm font-semibold">{label}</p>
      <span className="tabular text-base font-bold"><Money value={amount} bracketNegatives /></span>
    </div>
  );
}
