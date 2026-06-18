"use client";

import * as React from "react";
import { Users, Truck, Download, Printer } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Input, Label, Select } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { downloadCsv, printDocument } from "@/lib/export";
import {
  customerParties, vendorParties, customerLedger, vendorLedger, balanceLabel,
  type PartyKind, type PartyLedger,
} from "@/lib/finance/party-ledger";

export function PartyLedgerClient() {
  const [mounted, setMounted] = React.useState(false);
  const [kind, setKind] = React.useState<PartyKind>("customer");
  const [partyId, setPartyId] = React.useState("");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");

  React.useEffect(() => setMounted(true), []);

  const parties = React.useMemo(() => (mounted ? (kind === "customer" ? customerParties() : vendorParties()) : []), [kind, mounted]);

  // Keep a valid selection for the active mode.
  React.useEffect(() => {
    if (!mounted) return;
    if (!parties.some((p) => p.id === partyId)) setPartyId(parties[0]?.id ?? "");
  }, [parties, partyId, mounted]);

  const ledger = React.useMemo<PartyLedger | null>(() => {
    if (!mounted || !partyId) return null;
    return kind === "customer"
      ? customerLedger(partyId, from || null, to || null)
      : vendorLedger(partyId, from || null, to || null);
  }, [kind, partyId, from, to, mounted]);

  function exportCsv() {
    if (!ledger) return;
    const open = balanceLabel(ledger.opening, ledger.normalSide);
    const rows: (string | number)[][] = [["", "Opening balance", "", "", "", `${Math.round(open.amount)} ${open.side}`]];
    for (const l of ledger.lines) {
      rows.push([formatDate(l.date), l.particulars, l.ref, l.debit || "", l.credit || "", `${Math.round(l.balance)} ${l.side}`]);
    }
    const close = balanceLabel(ledger.closing, ledger.normalSide);
    rows.push(["", "Closing balance", "", ledger.totalDebit, ledger.totalCredit, `${Math.round(close.amount)} ${close.side}`]);
    downloadCsv(`${kind}-ledger-${ledger.partyName.replace(/\s+/g, "-")}`, ["Date", "Particulars", "Ref", "Debit", "Credit", "Balance"], rows);
  }

  function printStatement() {
    if (!ledger) return;
    printDocument(`Statement of Account — ${ledger.partyName}`, statementHtml(ledger));
  }

  return (
    <>
      <PageHeader
        title="Party Ledger"
        subtitle="Statement of account — every bill, receipt and payment for a customer or vendor with a running balance."
        actions={
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!ledger}><Download className="size-4" /> CSV</Button>
            <Button size="sm" variant="outline" onClick={printStatement} disabled={!ledger}><Printer className="size-4" /> Statement</Button>
          </div>
        }
      />

      {/* Controls */}
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-4">
        <div className="flex rounded-lg border bg-muted/30 p-1">
          <ModeBtn icon={Users} label="Customer" active={kind === "customer"} onClick={() => setKind("customer")} />
          <ModeBtn icon={Truck} label="Vendor" active={kind === "vendor"} onClick={() => setKind("vendor")} />
        </div>
        <div className="w-60">
          <Label>{kind === "customer" ? "Customer" : "Vendor"}</Label>
          <Select value={partyId} onChange={(e) => setPartyId(e.target.value)} className="mt-1">
            {parties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            {parties.length === 0 && <option value="">—</option>}
          </Select>
        </div>
        <div>
          <Label>From</Label>
          <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="mt-1 w-40" />
        </div>
        <div>
          <Label>To</Label>
          <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="mt-1 w-40" />
        </div>
        {(from || to) && (
          <Button size="sm" variant="ghost" onClick={() => { setFrom(""); setTo(""); }}>Clear dates</Button>
        )}
      </Card>

      {ledger && (
        <>
          {/* Summary */}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Opening balance" signed={ledger.opening} normalSide={ledger.normalSide} />
            <Stat label="Total debit" value={ledger.totalDebit} />
            <Stat label="Total credit" value={ledger.totalCredit} />
            <SummaryCard label="Closing balance" signed={ledger.closing} normalSide={ledger.normalSide} highlight />
          </div>

          {/* Statement */}
          <Card className="overflow-hidden">
            <div className="flex items-center justify-between border-b px-5 py-3">
              <div>
                <span className="text-sm font-semibold">{ledger.partyName}</span>
                {ledger.gstin && <span className="ml-2 font-mono text-xs text-muted-foreground">{ledger.gstin}</span>}
              </div>
              <span className="text-xs text-muted-foreground">
                {ledger.from || ledger.to ? `${ledger.from ? formatDate(ledger.from) : "start"} – ${ledger.to ? formatDate(ledger.to) : "today"}` : "Full history"}
              </span>
            </div>
            <div className="overflow-x-auto scrollbar-thin">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Date</th>
                    <th className="px-4 py-2.5 font-medium">Particulars</th>
                    <th className="px-4 py-2.5 font-medium">Ref</th>
                    <th className="px-4 py-2.5 text-right font-medium">Debit</th>
                    <th className="px-4 py-2.5 text-right font-medium">Credit</th>
                    <th className="px-4 py-2.5 text-right font-medium">Balance</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b bg-muted/10">
                    <td className="px-4 py-2 text-xs text-muted-foreground" colSpan={3}>Opening balance</td>
                    <td colSpan={2} />
                    <td className="px-4 py-2 text-right"><BalanceCell signed={ledger.opening} normalSide={ledger.normalSide} /></td>
                  </tr>
                  {ledger.lines.map((l, i) => (
                    <tr key={i} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(l.date)}</td>
                      <td className="px-4 py-2">
                        <Link href={l.sourceHref} className="hover:text-primary">{l.particulars}</Link>
                      </td>
                      <td className="px-4 py-2"><Badge variant={l.kind === "Invoice" || l.kind === "Bill" ? "primary" : "success"} className="text-[10px]">{l.kind}</Badge> <span className="font-mono text-xs text-muted-foreground">{l.ref}</span></td>
                      <td className="px-4 py-2 text-right tabular">{l.debit ? <Money value={l.debit} /> : <span className="text-muted-foreground/40">—</span>}</td>
                      <td className="px-4 py-2 text-right tabular">{l.credit ? <Money value={l.credit} /> : <span className="text-muted-foreground/40">—</span>}</td>
                      <td className="px-4 py-2 text-right tabular"><span className="font-medium"><Money value={l.balance} /></span> <span className="text-[10px] text-muted-foreground">{l.side}</span></td>
                    </tr>
                  ))}
                  {ledger.lines.length === 0 && (
                    <tr><td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">No transactions in this period.</td></tr>
                  )}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 bg-muted/30 font-semibold">
                    <td className="px-4 py-3" colSpan={3}>Closing balance</td>
                    <td className="px-4 py-3 text-right tabular"><Money value={ledger.totalDebit} /></td>
                    <td className="px-4 py-3 text-right tabular"><Money value={ledger.totalCredit} /></td>
                    <td className="px-4 py-3 text-right"><BalanceCell signed={ledger.closing} normalSide={ledger.normalSide} bold /></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Built from sales invoices &amp; receipts (customers) and vendor bills &amp; payments (vendors). Click a line to open its source document.
          </p>
        </>
      )}
    </>
  );
}

function ModeBtn({ icon: Icon, label, active, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors", active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
      <Icon className="size-4" /> {label}
    </button>
  );
}

function BalanceCell({ signed, normalSide, bold }: { signed: number; normalSide: "Dr" | "Cr"; bold?: boolean }) {
  const b = balanceLabel(signed, normalSide);
  return (
    <span className={cn("tabular", bold && "font-bold")}>
      <Money value={b.amount} /> <span className="text-[10px] text-muted-foreground">{b.side}</span>
    </span>
  );
}

function SummaryCard({ label, signed, normalSide, highlight }: { label: string; signed: number; normalSide: "Dr" | "Cr"; highlight?: boolean }) {
  const b = balanceLabel(signed, normalSide);
  return (
    <Card className={cn("p-4", highlight && "border-primary/30 bg-primary/5")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular">
        <Money value={b.amount} /> <span className="text-sm font-normal text-muted-foreground">{b.side}</span>
      </p>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular"><Money value={value} /></p>
    </Card>
  );
}

// ---- printable statement ---------------------------------------------------

function statementHtml(l: PartyLedger): string {
  const money = (n: number) => (n ? `₹${Math.round(n).toLocaleString("en-IN")}` : "");
  const bal = (signed: number) => { const b = balanceLabel(signed, l.normalSide); return `₹${Math.round(b.amount).toLocaleString("en-IN")} ${b.side}`; };
  const rows = l.lines.map((x) => `
    <tr>
      <td>${formatDate(x.date)}</td>
      <td>${x.particulars}</td>
      <td>${x.ref}</td>
      <td class="n">${money(x.debit)}</td>
      <td class="n">${money(x.credit)}</td>
      <td class="n">${bal(signedAt(l, x))}</td>
    </tr>`).join("");
  const range = l.from || l.to ? `${l.from ? formatDate(l.from) : "start"} – ${l.to ? formatDate(l.to) : "today"}` : "Full history";
  return `
    <h1>Statement of Account</h1>
    <div class="sub">${l.partyName}${l.gstin ? " · " + l.gstin : ""} · ${range}</div>
    <table>
      <thead><tr><th>Date</th><th>Particulars</th><th>Ref</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th></tr></thead>
      <tbody>
        <tr><td colspan="5">Opening balance</td><td class="n">${bal(l.opening)}</td></tr>
        ${rows}
      </tbody>
      <tfoot>
        <tr><td colspan="3">Closing balance</td><td class="n">${money(l.totalDebit)}</td><td class="n">${money(l.totalCredit)}</td><td class="n">${bal(l.closing)}</td></tr>
      </tfoot>
    </table>
    <p class="sub" style="margin-top:14px">${l.partyKind === "customer" ? "Amounts shown Dr are receivable from the customer." : "Amounts shown Cr are payable to the vendor."} Generated by NEXA.</p>`;
}

// The line's running balance as a party-normal signed number, for the print view.
function signedAt(l: PartyLedger, line: PartyLedger["lines"][number]): number {
  return line.side === l.normalSide ? line.balance : -line.balance;
}
