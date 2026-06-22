"use client";

import { useState } from "react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Button } from "@/components/ui/button";
import {
  noteShareCapital,
  noteReserves,
  noteBorrowings,
  noteFixedAssets,
  noteReceivables,
  notePayables,
  noteRevenue,
  noteRelatedParty,
  noteContingencies,
  SEGMENT_NOTE_REFERENCE,
} from "@/lib/accounting/notes";
import type { ReportFilters } from "@/lib/accounting/types";
import { Printer, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_FILTERS: ReportFilters = {
  entityId: "all",
  locationId: "all",
  state: "all",
  basis: "accrual",
  from: "2026-04-01",
  to: "2026-06-22",
};

interface NoteSection {
  num: number;
  title: string;
  key: string;
}

const NOTES: NoteSection[] = [
  { num: 1, title: "Share Capital", key: "share-capital" },
  { num: 2, title: "Reserves & Surplus", key: "reserves" },
  { num: 3, title: "Long-term Borrowings", key: "borrowings" },
  { num: 4, title: "Fixed Assets — Movement Schedule", key: "fixed-assets" },
  { num: 5, title: "Trade Receivables", key: "receivables" },
  { num: 6, title: "Trade Payables", key: "payables" },
  { num: 7, title: "Revenue from Operations", key: "revenue" },
  { num: 8, title: "Related Party Transactions", key: "related-party" },
  { num: 9, title: "Contingent Liabilities & Commitments", key: "contingencies" },
  { num: 10, title: "Segment Information", key: "segments" },
];

export function NotesClient() {
  const [expanded, setExpanded] = useState<Set<string>>(new Set(NOTES.map((n) => n.key)));
  const f = DEFAULT_FILTERS;

  const shareCapital = noteShareCapital();
  const reserves = noteReserves(f);
  const borrowings = noteBorrowings(f);
  const fixedAssets = noteFixedAssets(f);
  const receivables = noteReceivables(f);
  const payables = notePayables(f);
  const revenue = noteRevenue(f);
  const rpt = noteRelatedParty();
  const contingencies = noteContingencies();

  const toggle = (key: string) =>
    setExpanded((p) => { const n = new Set(p); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const isOpen = (key: string) => expanded.has(key);

  const NoteCard = ({ note, children }: { note: NoteSection; children: React.ReactNode }) => (
    <Card className="mb-4 overflow-hidden">
      <button
        className="flex w-full items-center gap-3 p-4 text-left hover:bg-muted/30"
        onClick={() => toggle(note.key)}
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {note.num}
        </span>
        <span className="font-semibold">{note.title}</span>
        <span className="ml-auto text-muted-foreground">
          {isOpen(note.key) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}
        </span>
      </button>
      {isOpen(note.key) && <div className="border-t px-4 pb-4 pt-3">{children}</div>}
    </Card>
  );

  const Tbl = ({ children }: { children: React.ReactNode }) => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  );
  const Th = ({ children, right }: { children: React.ReactNode; right?: boolean }) => (
    <th className={cn("border border-border/50 bg-muted/50 px-3 py-1.5 font-semibold text-xs", right && "text-right")}>{children}</th>
  );
  const Td = ({ children, right, bold }: { children: React.ReactNode; right?: boolean; bold?: boolean }) => (
    <td className={cn("border border-border/40 px-3 py-1.5 text-sm", right && "text-right tabular-nums", bold && "font-semibold")}>{children}</td>
  );
  const M = ({ value }: { value: number }) => <Money value={value} />;

  return (
    <>
      <PageHeader
        title="Notes to Financial Statements"
        subtitle={`For the year / period ended ${DEFAULT_FILTERS.to} — Schedule III, Companies Act 2013`}
        actions={
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setExpanded(new Set(NOTES.map((n) => n.key)))}>Expand all</Button>
            <Button variant="outline" size="sm" onClick={() => setExpanded(new Set())}>Collapse all</Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="size-4 mr-1" />Print</Button>
          </div>
        }
      />

      {/* Note 1 — Share Capital */}
      <NoteCard note={NOTES[0]}>
        <Tbl>
          <thead><tr><Th>Class</Th><Th right>No. of Shares</Th><Th right>Face Value (₹)</Th><Th right>Amount</Th></tr></thead>
          <tbody>
            {shareCapital.authorised.map((r, i) => (
              <tr key={i}><Td>{r.class}</Td><Td right>{r.shares.toLocaleString()}</Td><Td right>{r.faceValue}</Td><Td right><M value={r.amount} /></Td></tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-3 grid grid-cols-3 gap-3">
          {[{ label: "Issued", v: shareCapital.issued }, { label: "Subscribed", v: shareCapital.subscribed }, { label: "Paid-up", v: shareCapital.paidUp }].map((x) => (
            <div key={x.label} className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{x.label}</p>
              <p className="font-semibold"><M value={x.v} /></p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground font-medium">Reconciliation of shares outstanding</p>
        <Tbl>
          <thead><tr><Th>Movement</Th><Th right>No. of Shares</Th></tr></thead>
          <tbody>
            {shareCapital.reconciliation.map((r, i) => (
              <tr key={i}><Td>{r.label}</Td><Td right bold={i === shareCapital.reconciliation.length - 1}>{r.shares.toLocaleString()}</Td></tr>
            ))}
          </tbody>
        </Tbl>
      </NoteCard>

      {/* Note 2 — Reserves */}
      <NoteCard note={NOTES[1]}>
        <Tbl>
          <thead><tr><Th>Particulars</Th><Th right>Amount</Th></tr></thead>
          <tbody>
            <tr><Td>Opening balance</Td><Td right><M value={reserves.opening} /></Td></tr>
            <tr><Td>Add: Profit for the period transferred from P&L</Td><Td right><M value={reserves.additions} /></Td></tr>
            <tr><Td bold>Closing balance</Td><Td right bold><M value={reserves.closing} /></Td></tr>
          </tbody>
        </Tbl>
      </NoteCard>

      {/* Note 3 — Borrowings */}
      <NoteCard note={NOTES[2]}>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Secured</p>
        <Tbl>
          <thead><tr><Th>Lender</Th><Th right>Rate %</Th><Th>Maturity</Th><Th right>Balance</Th></tr></thead>
          <tbody>
            {borrowings.secured.map((r, i) => (
              <tr key={i}><Td>{r.lender}</Td><Td right>{r.rate.toFixed(2)}</Td><Td>{r.maturity}</Td><Td right><M value={r.balance} /></Td></tr>
            ))}
          </tbody>
        </Tbl>
        <p className="text-xs font-semibold text-muted-foreground mb-2 mt-4 uppercase tracking-wide">Unsecured</p>
        <Tbl>
          <thead><tr><Th>Lender</Th><Th right>Rate %</Th><Th>Maturity</Th><Th right>Balance</Th></tr></thead>
          <tbody>
            {borrowings.unsecured.map((r, i) => (
              <tr key={i}><Td>{r.lender}</Td><Td right>{r.rate.toFixed(2)}</Td><Td>{r.maturity}</Td><Td right><M value={r.balance} /></Td></tr>
            ))}
          </tbody>
        </Tbl>
        <div className="mt-2 flex justify-end gap-2 text-sm font-semibold">
          Total: <M value={borrowings.total} />
        </div>
      </NoteCard>

      {/* Note 4 — Fixed Assets */}
      <NoteCard note={NOTES[3]}>
        <Tbl>
          <thead>
            <tr>
              <Th>Category</Th>
              <Th right>Gross Blk (Open)</Th><Th right>Additions</Th><Th right>Disposals</Th><Th right>Gross Blk (Close)</Th>
              <Th right>Acc. Dep (Open)</Th><Th right>Charge</Th><Th right>On Disposals</Th><Th right>Acc. Dep (Close)</Th>
              <Th right>Net Block</Th>
            </tr>
          </thead>
          <tbody>
            {fixedAssets.map((r, i) => (
              <tr key={i}>
                <Td bold>{r.category}</Td>
                <Td right><M value={r.grossBlockOpen} /></Td>
                <Td right><M value={r.additions} /></Td>
                <Td right>{r.disposals > 0 ? <M value={r.disposals} /> : "–"}</Td>
                <Td right bold><M value={r.grossBlockClose} /></Td>
                <Td right><M value={r.accDepOpen} /></Td>
                <Td right><M value={r.depCharge} /></Td>
                <Td right>{r.onDisposals > 0 ? <M value={r.onDisposals} /> : "–"}</Td>
                <Td right bold><M value={r.accDepClose} /></Td>
                <Td right bold><M value={r.netBlock} /></Td>
              </tr>
            ))}
          </tbody>
        </Tbl>
      </NoteCard>

      {/* Note 5 — Receivables */}
      <NoteCard note={NOTES[4]}>
        <div className="grid grid-cols-2 gap-3 mb-3 sm:grid-cols-4">
          {[{ label: "Total Outstanding", v: receivables.outstanding }, { label: "Secured", v: receivables.secured },
            { label: "Unsecured", v: receivables.unsecured }, { label: "Doubtful", v: receivables.doubtful }].map((x) => (
            <div key={x.label} className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{x.label}</p>
              <p className="font-semibold"><M value={x.v} /></p>
            </div>
          ))}
        </div>
        <Tbl>
          <thead><tr><Th>Aging Bucket</Th><Th right>Amount</Th></tr></thead>
          <tbody>
            {receivables.agingBuckets.map((b, i) => (
              <tr key={i}><Td>{b.label}</Td><Td right><M value={b.amount} /></Td></tr>
            ))}
            <tr><Td bold>Total</Td><Td right bold><M value={receivables.outstanding} /></Td></tr>
          </tbody>
        </Tbl>
      </NoteCard>

      {/* Note 6 — Payables */}
      <NoteCard note={NOTES[5]}>
        <div className="grid grid-cols-3 gap-3 mb-3">
          {[{ label: "MSME Vendors", v: payables.msme }, { label: "Others", v: payables.others }, { label: "Total", v: payables.total }].map((x) => (
            <div key={x.label} className="rounded-lg bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">{x.label}</p>
              <p className="font-semibold"><M value={x.v} /></p>
            </div>
          ))}
        </div>
        <Tbl>
          <thead><tr><Th>Aging</Th><Th right>MSME</Th><Th right>Others</Th></tr></thead>
          <tbody>
            {payables.agingBuckets.map((b, i) => (
              <tr key={i}><Td>{b.label}</Td><Td right><M value={b.msme} /></Td><Td right><M value={b.others} /></Td></tr>
            ))}
          </tbody>
        </Tbl>
      </NoteCard>

      {/* Note 7 — Revenue */}
      <NoteCard note={NOTES[6]}>
        <Tbl>
          <thead><tr><Th>Category</Th><Th right>Domestic</Th><Th right>Export</Th><Th right>Total</Th></tr></thead>
          <tbody>
            {revenue.lines.map((r, i) => (
              <tr key={i}>
                <Td>{r.category}</Td><Td right><M value={r.domestic} /></Td><Td right><M value={r.export} /></Td><Td right bold><M value={r.total} /></Td>
              </tr>
            ))}
            <tr><Td bold>Total</Td><td className="border border-border/40 px-3 py-1.5" colSpan={2}></td><Td right bold><M value={revenue.total} /></Td></tr>
          </tbody>
        </Tbl>
      </NoteCard>

      {/* Note 8 — Related Party */}
      <NoteCard note={NOTES[7]}>
        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Related Parties</p>
        <Tbl>
          <thead><tr><Th>Party</Th><Th>Relationship</Th></tr></thead>
          <tbody>
            {rpt.parties.map((p, i) => <tr key={i}><Td>{p.name}</Td><Td>{p.relationship}</Td></tr>)}
          </tbody>
        </Tbl>
        <p className="text-xs font-semibold text-muted-foreground mb-2 mt-4 uppercase tracking-wide">Transactions</p>
        <Tbl>
          <thead><tr><Th>Party</Th><Th>Nature</Th><Th right>Amount</Th><Th right>Outstanding</Th></tr></thead>
          <tbody>
            {rpt.transactions.map((t, i) => (
              <tr key={i}><Td>{t.party}</Td><Td>{t.nature}</Td><Td right><M value={t.amount} /></Td><Td right><M value={t.outstanding} /></Td></tr>
            ))}
          </tbody>
        </Tbl>
      </NoteCard>

      {/* Note 9 — Contingencies */}
      <NoteCard note={NOTES[8]}>
        <div className="space-y-3">
          {contingencies.items.map((c, i) => (
            <div key={i} className="rounded-lg border border-border/50 p-3">
              <div className="flex items-start justify-between gap-4">
                <p className="text-sm font-medium">{c.description}</p>
                <div className="shrink-0 text-right">
                  <p className="font-semibold text-sm"><M value={c.amount} /></p>
                  <Badge variant="default" className="text-[10px] mt-1">Contingent</Badge>
                </div>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">{c.status}</p>
            </div>
          ))}
        </div>
      </NoteCard>

      {/* Note 10 — Segments */}
      <NoteCard note={NOTES[9]}>
        <p className="text-sm text-muted-foreground">{SEGMENT_NOTE_REFERENCE}</p>
        <a href="/reports/segments" className="mt-2 inline-flex text-sm font-medium text-primary hover:underline">
          View P&L by Segment →
        </a>
      </NoteCard>
    </>
  );
}
