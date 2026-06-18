"use client";

import * as React from "react";
import Link from "next/link";
import { Send, X, Check, MailWarning, CalendarClock, Pencil, BookUser } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Input } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { useAgingScheme, AgingBucketEditor } from "@/components/finance/aging-buckets";
import {
  AS_ON,
  agingBuckets,
  customerAging,
  openItems,
  arSummary,
  dunningMeta,
  bucketMeta,
  reminderTemplate,
  effectiveCreditLimit,
  loadCreditLimits,
  saveCreditLimits,
  loadCollections,
  saveCollections,
  derivedCreditLimit,
  type ArOpenItem,
  type CustomerAr,
  type CollectionAction,
  type BucketKey,
} from "@/lib/finance/receivables";

export function ReceivablesClient() {
  const [limits, setLimits] = React.useState<Record<string, number>>({});
  const [collections, setCollections] = React.useState<Record<string, CollectionAction>>({});
  const [preview, setPreview] = React.useState<ArOpenItem | null>(null);
  const [editLimit, setEditLimit] = React.useState<string | null>(null);

  const aging = useAgingScheme();
  const { scheme } = aging;

  React.useEffect(() => {
    setLimits(loadCreditLimits());
    setCollections(loadCollections());
  }, []);

  // Recompute derived views whenever overrides/actions/bucket scheme change.
  const buckets = React.useMemo(() => agingBuckets(AS_ON, scheme), [scheme]);
  const customers = React.useMemo(() => customerAging(AS_ON, scheme), [limits, scheme]);
  const items = React.useMemo(() => openItems(AS_ON, scheme), [scheme]);
  const summary = React.useMemo(() => arSummary(AS_ON), [limits]);
  const grandTotal = customers.reduce((s, c) => s + c.total, 0);

  function updateLimit(accountId: string, raw: string) {
    const val = Number(raw.replace(/[^0-9.]/g, ""));
    setLimits((prev) => {
      const next = { ...prev };
      if (!val || val <= 0) delete next[accountId];
      else next[accountId] = Math.round(val);
      saveCreditLimits(next);
      return next;
    });
  }

  function logAction(invId: string, patch: CollectionAction) {
    setCollections((prev) => {
      const next = { ...prev, [invId]: { ...prev[invId], ...patch } };
      saveCollections(next);
      return next;
    });
  }

  function sendReminder(item: ArOpenItem) {
    logAction(item.id, { dunningSent: item.dunning, lastContacted: AS_ON });
    setPreview(null);
  }

  function logPromise(item: ArOpenItem) {
    const guess = new Date(AS_ON);
    guess.setDate(guess.getDate() + 7);
    logAction(item.id, { promiseToPayDate: guess.toISOString().slice(0, 10), lastContacted: AS_ON });
  }

  return (
    <>
      <PageHeader
        title="Receivables & Collections"
        subtitle={`AR aging, dunning and credit limits · as on ${formatDate(AS_ON)}`}
        actions={
          <Link href="/reports/ledgers" className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent">
            <BookUser className="size-4" /> Customer ledger
          </Link>
        }
      />

      {/* Summary cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard label="Total receivable" value={summary.totalReceivable} />
        <SummaryCard label="Overdue" value={summary.overdue} tone="danger" />
        <SummaryCard label="% overdue" plain={`${Math.round(summary.pctOverdue * 100)}%`} />
        <SummaryCard label="Over credit limit" plain={String(summary.customersOverLimit)} tone={summary.customersOverLimit ? "danger" : undefined} />
      </div>

      {/* Aging matrix */}
      <Card className="mb-4 overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <span className="text-sm font-semibold">AR aging — customer × bucket</span>
          <AgingBucketEditor breaks={aging.breaks} onChange={aging.update} onReset={aging.reset} isDefault={aging.isDefault} />
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Customer</th>
                {scheme.map((b) => (
                  <th key={b.key} className="px-4 py-3 text-right font-medium">{b.label}</th>
                ))}
                <th className="px-5 py-3 text-right font-medium">Total</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.accountId} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                  <td className="px-5 py-3 font-medium">
                    {c.name}
                    {c.credit.overLimit && <Badge variant="danger" className="ml-2">Over limit</Badge>}
                  </td>
                  {scheme.map((b) => (
                    <td key={b.key} className="px-4 py-3 text-right tabular">
                      {c.buckets[b.key] > 0 ? <Money value={c.buckets[b.key]} /> : <span className="text-muted-foreground/40">—</span>}
                    </td>
                  ))}
                  <td className="px-5 py-3 text-right font-semibold tabular"><Money value={c.total} /></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30 font-semibold">
                <td className="px-5 py-3">Total</td>
                {scheme.map((b) => (
                  <td key={b.key} className="px-4 py-3 text-right tabular"><Money value={buckets[b.key]} /></td>
                ))}
                <td className="px-5 py-3 text-right tabular"><Money value={grandTotal} /></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Collections worklist */}
      <Card className="mb-4 overflow-hidden">
        <div className="border-b px-5 py-3 text-sm font-semibold">Collections worklist</div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Due</th>
                <th className="px-5 py-3 text-right font-medium">Days</th>
                <th className="px-5 py-3 text-right font-medium">Outstanding</th>
                <th className="px-5 py-3 font-medium">Dunning</th>
                <th className="px-5 py-3 font-medium">Credit util.</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => {
                const bm = bucketMeta(it.bucket, scheme);
                const dm = dunningMeta(it.dunning);
                const util = creditUtil(it.accountId, limits, customers);
                const action = collections[it.id];
                return (
                  <tr key={it.id} className="border-b align-top transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-3 font-medium">{it.number}</td>
                    <td className="px-5 py-3 text-muted-foreground">{it.customerName}</td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(it.dueDate)}</td>
                    <td className="px-5 py-3 text-right">
                      <Badge variant={bm.tone}>{it.days > 0 ? `${it.days}d` : "current"}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold tabular"><Money value={it.outstanding} /></td>
                    <td className="px-5 py-3"><Badge variant={dm.variant}>{dm.label}</Badge></td>
                    <td className="px-5 py-3">
                      <UtilBar pct={util} />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        <button onClick={() => setPreview(it)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent">
                          <Send className="size-3.5" /> Reminder
                        </button>
                        <button onClick={() => logPromise(it)} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs font-medium hover:bg-accent">
                          <CalendarClock className="size-3.5" /> P2P
                        </button>
                      </div>
                      {(action?.dunningSent !== undefined || action?.promiseToPayDate) && (
                        <div className="mt-1 flex flex-wrap items-center justify-end gap-1 text-[11px] text-muted-foreground">
                          {action?.dunningSent !== undefined && (
                            <span className="inline-flex items-center gap-1 text-success"><Check className="size-3" /> {dunningMeta(action.dunningSent).label} sent</span>
                          )}
                          {action?.promiseToPayDate && (
                            <span className="inline-flex items-center gap-1"><CalendarClock className="size-3" /> PTP {formatDate(action.promiseToPayDate)}</span>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr><td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">No open receivables.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Credit-limit editor */}
      <Card className="overflow-hidden">
        <div className="border-b px-5 py-3 text-sm font-semibold">Credit limits & exposure</div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 text-right font-medium">Exposure (open AR)</th>
                <th className="px-5 py-3 text-right font-medium">Credit limit</th>
                <th className="px-5 py-3 text-right font-medium">Available</th>
                <th className="px-5 py-3 font-medium">Utilisation</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => {
                const eff = effectiveCreditLimit(c.accountId, limits);
                const exposure = c.total;
                const available = eff - exposure;
                const isEditing = editLimit === c.accountId;
                return (
                  <tr key={c.accountId} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-3 font-medium">{c.name}</td>
                    <td className="px-5 py-3 text-right tabular"><Money value={exposure} /></td>
                    <td className="px-5 py-3 text-right">
                      {isEditing ? (
                        <div className="flex items-center justify-end gap-1">
                          <Input
                            type="number"
                            defaultValue={eff}
                            className="h-8 w-32 text-right"
                            autoFocus
                            onBlur={(e) => { updateLimit(c.accountId, e.target.value); setEditLimit(null); }}
                            onKeyDown={(e) => { if (e.key === "Enter") { updateLimit(c.accountId, (e.target as HTMLInputElement).value); setEditLimit(null); } }}
                          />
                        </div>
                      ) : (
                        <button onClick={() => setEditLimit(c.accountId)} className="inline-flex items-center gap-1.5 tabular hover:text-primary">
                          <Money value={eff} />
                          {c.credit.isOverridden && <Badge variant="primary" className="text-[10px]">custom</Badge>}
                          <Pencil className="size-3 text-muted-foreground" />
                        </button>
                      )}
                    </td>
                    <td className={cn("px-5 py-3 text-right tabular", available < 0 && "text-danger font-semibold")}><Money value={available} /></td>
                    <td className="px-5 py-3"><UtilBar pct={eff > 0 ? exposure / eff : 0} /></td>
                  </tr>
                );
              })}
              {customers.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-8 text-center text-muted-foreground">No customers with open AR.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="border-t px-5 py-2.5 text-xs text-muted-foreground">
          Limits default to ~2 billing cycles of history; click a figure to override (saved locally).
        </p>
      </Card>

      {preview && <ReminderModal item={preview} onSend={() => sendReminder(preview)} onClose={() => setPreview(null)} />}
    </>
  );
}

function creditUtil(accountId: string, limits: Record<string, number>, customers: CustomerAr[]): number {
  const c = customers.find((x) => x.accountId === accountId);
  const limit = effectiveCreditLimit(accountId, limits) || derivedCreditLimit(accountId);
  if (!c || limit <= 0) return 0;
  return c.total / limit;
}

function UtilBar({ pct }: { pct: number }) {
  const clamped = Math.min(1, Math.max(0, pct));
  const over = pct > 1;
  const tone = over ? "bg-danger" : pct > 0.8 ? "bg-warning" : "bg-primary";
  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
        <div className={cn("h-full rounded-full", tone)} style={{ width: `${clamped * 100}%` }} />
      </div>
      <span className={cn("tabular text-xs", over ? "text-danger font-semibold" : "text-muted-foreground")}>{Math.round(pct * 100)}%</span>
    </div>
  );
}

function SummaryCard({ label, value, plain, tone }: { label: string; value?: number; plain?: string; tone?: "danger" }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular", tone === "danger" && "text-danger")}>
        {plain ?? <Money value={value ?? 0} />}
      </p>
    </Card>
  );
}

function ReminderModal({ item, onSend, onClose }: { item: ArOpenItem; onSend: () => void; onClose: () => void }) {
  const dm = dunningMeta(item.dunning);
  const body = reminderTemplate(item);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-lg p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <MailWarning className="size-3.5" /> Reminder preview
            </p>
            <h3 className="mt-0.5 font-semibold">{item.customerName} · {item.number}</h3>
            <p className="text-xs text-muted-foreground">Dunning level: <Badge variant={dm.variant}>{dm.label}</Badge> · {dm.nextAction}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>
        <pre className="mt-3 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border bg-muted/30 p-3 text-sm leading-relaxed">{body}</pre>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={onSend}><Send className="size-4" /> Mark as sent</Button>
        </div>
      </Card>
    </div>
  );
}
