"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, X, ArrowRight, Layers, CheckCircle2, AlertTriangle, Link2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { useJournal } from "@/components/accounting/journal-provider";
import { cn, formatDate } from "@/lib/utils";
import { ENTITIES } from "@/lib/accounting/org";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import {
  allIc,
  loadCreatedIc,
  saveCreatedIc,
  loadSettlements,
  saveSettlements,
  isSettled,
  icVariance,
  entityName,
  nextIcId,
  buildMirrorDrafts,
  IC_TYPE_META,
  type IcTransaction,
  type IcType,
} from "@/lib/intercompany/intercompany";

const TODAY = new Date().toISOString().slice(0, 10);
const TYPES = Object.keys(IC_TYPE_META) as IcType[];

export function IntercompanyClient() {
  const prefs = usePrefs();
  const { post } = useJournal();
  const [created, setCreated] = React.useState<IcTransaction[]>([]);
  const [settled, setSettled] = React.useState<Record<string, boolean>>({});
  const [adding, setAdding] = React.useState(false);
  const [typeFilter, setTypeFilter] = React.useState<"all" | IcType>("all");
  const [mirror, setMirror] = React.useState<{ tx: IcTransaction; from: string; to: string } | null>(null);
  const [mirrorErr, setMirrorErr] = React.useState<string[]>([]);

  React.useEffect(() => {
    setCreated(loadCreatedIc());
    setSettled(loadSettlements());
  }, []);

  const rows = allIc(created).filter((t) => {
    if (prefs.entityId !== "all" && t.fromEntityId !== prefs.entityId && t.toEntityId !== prefs.entityId) return false;
    if (typeFilter !== "all" && t.type !== typeFilter) return false;
    return true;
  });

  const volume = rows.reduce((s, t) => s + t.amount, 0);
  const openBal = rows.filter((t) => !isSettled(t, settled)).reduce((s, t) => s + t.amount, 0);
  const loansOut = rows.filter((t) => t.type === "loan" && !isSettled(t, settled)).reduce((s, t) => s + t.amount, 0);
  const variances = rows.filter((t) => icVariance(t) !== 0);

  function toggleSettle(t: IcTransaction) {
    setSettled((prev) => {
      const next = { ...prev, [t.id]: !isSettled(t, prev) };
      saveSettlements(next);
      return next;
    });
  }
  function addTxn(t: IcTransaction) {
    // Auto-mirror: post the provider voucher in `from` and the matching
    // counterparty voucher in `to`, so both companies carry real GL entries.
    setMirrorErr([]);
    const { from, to } = buildMirrorDrafts(t);
    const r1 = post(from);
    if (!r1.ok) {
      setMirrorErr(r1.errors);
      return;
    }
    const r2 = post(to);
    if (!r2.ok) {
      setMirrorErr(r2.errors);
      return;
    }
    setCreated((prev) => {
      const next = [...prev, t];
      saveCreatedIc(next);
      return next;
    });
    setMirror({ tx: t, from: r1.entry.voucherNo, to: r2.entry.voucherNo });
    setAdding(false);
  }

  return (
    <>
      <Link href="/group" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <Layers className="size-4" /> Group reporting
      </Link>
      <PageHeader
        title="Inter-company Transactions"
        subtitle="Related-party dealings between group entities. New deals auto-post mirrored vouchers in BOTH companies' books and eliminate on consolidation."
        actions={
          <Button onClick={() => setAdding((v) => !v)}>
            {adding ? <X className="size-4" /> : <Plus className="size-4" />} {adding ? "Cancel" : "New transaction"}
          </Button>
        }
      />

      {mirror && (
        <Card className="mb-4 flex items-start gap-2 border-success/40 bg-success/8 p-3 text-sm">
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
          <p className="text-muted-foreground">
            Mirrored to both ledgers — <span className="font-medium text-foreground">{entityName(mirror.tx.fromEntityId)}</span> {mirror.from}{" "}
            (Dr Inter-company Receivable / Cr {IC_TYPE_META[mirror.tx.type].fromBooking.split(" / ").pop()}) &amp;{" "}
            <span className="font-medium text-foreground">{entityName(mirror.tx.toEntityId)}</span> {mirror.to}{" "}
            (Dr {IC_TYPE_META[mirror.tx.type].toBooking.split(" / ").pop()} / Cr Inter-company Payable).
            <button onClick={() => setMirror(null)} className="ml-2 font-medium text-foreground hover:underline">Dismiss</button>
          </p>
        </Card>
      )}
      {mirrorErr.length > 0 && (
        <Card className="mb-4 border-danger/40 bg-danger/8 p-3">
          <p className="flex items-center gap-1.5 text-sm font-medium text-danger"><AlertTriangle className="size-4" /> Could not mirror the transaction</p>
          <ul className="mt-1 list-inside list-disc text-sm text-danger/90">{mirrorErr.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Total IC volume" value={volume} />
        <Kpi label="Open balances" value={openBal} accent />
        <Kpi label="Loans outstanding" value={loansOut} />
        <Kpi label="Reconciliation variances" value={variances.reduce((s, t) => s + Math.abs(icVariance(t)), 0)} highlight={variances.length > 0} count={variances.length} />
      </div>

      {adding && <AddIcForm created={created} onAdd={addTxn} />}

      <div className="mb-4 flex flex-wrap gap-1">
        {(["all", ...TYPES] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTypeFilter(k)}
            className={cn(
              "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
              typeFilter === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {k === "all" ? "All types" : IC_TYPE_META[k].label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Date</th>
                <th className="px-4 py-3 font-medium">Type</th>
                <th className="px-4 py-3 font-medium">Counterparties</th>
                <th className="px-4 py-3 font-medium">Booking (from / to)</th>
                <th className="px-4 py-3 text-right font-medium">Amount</th>
                <th className="px-4 py-3 text-right font-medium">Counterparty</th>
                <th className="px-4 py-3 font-medium">Reconciliation</th>
                <th className="px-4 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No inter-company transactions in this view.</td></tr>
              )}
              {rows.map((t) => {
                const m = IC_TYPE_META[t.type];
                const variance = icVariance(t);
                const counter = t.counterAmount ?? t.amount;
                const done = isSettled(t, settled);
                return (
                  <tr key={t.id} className="border-b align-top transition-colors last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(t.date)}</td>
                    <td className="px-4 py-3"><Badge variant="default">{m.label}</Badge></td>
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1.5 text-sm font-medium">
                        {entityName(t.fromEntityId)} <ArrowRight className="size-3 text-muted-foreground" /> {entityName(t.toEntityId)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{t.memo}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <span className="text-foreground">{m.fromBooking}</span><br />{m.toBooking}
                    </td>
                    <td className="px-4 py-3 text-right tabular font-semibold"><Money value={t.amount} /></td>
                    <td className="px-4 py-3 text-right tabular text-muted-foreground"><Money value={counter} /></td>
                    <td className="px-4 py-3">
                      {variance === 0 ? (
                        <span className="inline-flex items-center gap-1 text-xs text-success"><Link2 className="size-3.5" /> Matched</span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-danger">
                          <AlertTriangle className="size-3.5" /> Variance <Money value={variance} className="font-medium" bracketNegatives />
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => toggleSettle(t)} className="inline-flex">
                        {done ? <Badge variant="success" className="cursor-pointer"><CheckCircle2 className="size-3" /> Settled</Badge> : <Badge variant="warning" className="cursor-pointer">Open</Badge>}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function AddIcForm({ created, onAdd }: { created: IcTransaction[]; onAdd: (t: IcTransaction) => void }) {
  const [type, setType] = React.useState<IcType>("sale");
  const [from, setFrom] = React.useState(ENTITIES[0].id);
  const [to, setTo] = React.useState(ENTITIES[1].id);
  const [amount, setAmount] = React.useState("");
  const [date, setDate] = React.useState(TODAY);
  const [memo, setMemo] = React.useState("");
  const num = (s: string) => parseFloat(s) || 0;
  const valid = from !== to && num(amount) > 0 && memo;

  return (
    <Card className="mb-4 p-4">
      <h3 className="mb-3 text-sm font-semibold">New inter-company transaction</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <L label="Type">
          <Select value={type} onChange={(e) => setType(e.target.value as IcType)}>
            {TYPES.map((t) => <option key={t} value={t}>{IC_TYPE_META[t].label}</option>)}
          </Select>
        </L>
        <L label="From (provider)">
          <EntityCombobox value={from} onChange={setFrom} />
        </L>
        <L label="To (receiver)">
          <EntityCombobox value={to} onChange={setTo} />
        </L>
        <L label="Amount (₹)"><Input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0" /></L>
        <L label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></L>
        <L label="Memo"><Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="description" /></L>
      </div>
      {from === to && <p className="mt-2 text-xs text-danger">Provider and receiver must be different entities.</p>}
      <div className="mt-3 flex justify-end">
        <Button disabled={!valid} onClick={() => onAdd({ id: nextIcId(created), date, type, fromEntityId: from, toEntityId: to, amount: num(amount), memo, status: "open" })}>
          <Plus className="size-4" /> Add transaction
        </Button>
      </div>
    </Card>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ label, value, accent, highlight, count }: { label: string; value: number; accent?: boolean; highlight?: boolean; count?: number }) {
  return (
    <Card className={cn("p-4", accent && "border-primary/40", highlight && "border-danger/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular", accent && "text-primary", highlight && "text-danger")}>
        <Money value={value} compact />
        {count != null && count > 0 && <span className="ml-1.5 text-sm font-normal text-muted-foreground">({count})</span>}
      </p>
    </Card>
  );
}
