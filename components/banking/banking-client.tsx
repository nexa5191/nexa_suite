"use client";

import * as React from "react";
import { Landmark, Link2, Unlink, Wand2, CheckCircle2, Plus, ArrowDownLeft, ArrowUpRight, Sparkles, ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { VoucherButton } from "@/components/accounting/voucher-button";
import { cn, formatDate } from "@/lib/utils";
import { monthLabel } from "@/lib/tax/gst";
import {
  BANK_ACCOUNTS,
  bankAccountLabel,
  bookLines,
  statementLines,
  loadMatches,
  saveMatches,
  loadBooked,
  saveBooked,
  type MatchStore,
  type BookedStore,
} from "@/lib/banking/banking";
import { autoMatch, reconcile, suggestionsFor, type MatchMap } from "@/lib/banking/reconcile";

const MONTHS = ["2026-05", "2026-04", "2026-03", "2026-02", "2026-01", "2025-12"];
function rangeOf(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const last = new Date(y, mo, 0).getDate();
  return { from: `${m}-01`, to: `${m}-${String(last).padStart(2, "0")}` };
}

export function BankingClient() {
  const [month, setMonth] = React.useState("2026-05");
  const [accountId, setAccountId] = React.useState(BANK_ACCOUNTS[0].id);
  const [matchStore, setMatchStore] = React.useState<MatchStore>({});
  const [bookedStore, setBookedStore] = React.useState<BookedStore>({});
  const [selBook, setSelBook] = React.useState<string | null>(null);
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setMatchStore(loadMatches());
    setBookedStore(loadBooked());
  }, []);

  const acc = BANK_ACCOUNTS.find((b) => b.id === accountId)!;
  const { from, to } = rangeOf(month);
  const key = `${accountId}|${month}`;

  const book = React.useMemo(() => bookLines(acc, from, to), [accountId, from, to]);
  const stmt = React.useMemo(() => statementLines(acc, from, to), [accountId, from, to]);

  // initialise this account/period's matches by auto-matching, once.
  React.useEffect(() => {
    setMatchStore((prev) => {
      if (prev[key]) return prev;
      const m = autoMatch(book, stmt, {});
      const next = { ...prev, [key]: m };
      saveMatches(next);
      return next;
    });
    setSelBook(null);
    setDismissed(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const matches: MatchMap = matchStore[key] ?? {};
  const booked = bookedStore[key] ?? [];

  const rec = reconcile(acc, book, stmt, matches, booked);
  const matchedBookIds = new Set(Object.values(matches));
  const matchedStmtIds = new Set(Object.keys(matches));
  const bookedSet = new Set(booked);
  const bookById = React.useMemo(() => new Map(book.map((b) => [b.id, b])), [book]);

  // Amount/date-only proposals (UTR-verified ones are already auto-committed),
  // minus any the user waved off this session.
  const suggestions = React.useMemo(
    () => suggestionsFor(book, stmt, matches).filter((p) => !dismissed.has(p.stmtId)),
    [book, stmt, matches, dismissed],
  );
  /** A committed match is UTR-verified when book & statement refs agree. */
  const isUtrVerified = (stmtId: string) => {
    const b = bookById.get(matches[stmtId]);
    const s = stmt.find((x) => x.id === stmtId);
    return !!b && !!s && !!s.ref && s.ref === b.ref;
  };

  function setMatches(m: MatchMap) {
    setMatchStore((prev) => {
      const next = { ...prev, [key]: m };
      saveMatches(next);
      return next;
    });
  }
  function runAuto() {
    setMatches(autoMatch(book, stmt, matches));
    setSelBook(null);
  }
  function acceptSuggestion(stmtId: string, bookId: string) {
    setMatches({ ...matches, [stmtId]: bookId });
  }
  function acceptAllSuggestions() {
    const m = { ...matches };
    for (const s of suggestions) m[s.stmtId] = s.bookId;
    setMatches(m);
  }
  function dismissSuggestion(stmtId: string) {
    setDismissed((prev) => new Set(prev).add(stmtId));
  }
  function unmatch(stmtId: string) {
    const m = { ...matches };
    delete m[stmtId];
    setMatches(m);
  }
  function clickStmt(stmtId: string, amount: number) {
    if (!selBook) return;
    const b = book.find((x) => x.id === selBook);
    if (!b || b.amount !== amount) return; // equal-amount matches only
    setMatches({ ...matches, [stmtId]: selBook });
    setSelBook(null);
  }
  function bookEntry(stmtId: string) {
    setBookedStore((prev) => {
      const cur = prev[key] ?? [];
      const next = { ...prev, [key]: cur.includes(stmtId) ? cur.filter((x) => x !== stmtId) : [...cur, stmtId] };
      saveBooked(next);
      return next;
    });
  }

  const selBookLine = selBook ? book.find((b) => b.id === selBook) : null;

  return (
    <>
      <PageHeader
        title="Bank Reconciliation"
        subtitle="Match the books to each bank statement across all entities, then bridge the balances with a reconciliation statement."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <VoucherButton type="receipt" label="Receipt" variant="outline" size="sm" />
            <VoucherButton type="payment" label="Payment" variant="outline" size="sm" />
            <VoucherButton type="contra" label="Contra" variant="outline" size="sm" />
            <VoucherButton type="bank" label="Bank" variant="outline" size="sm" />
            <Select value={month} onChange={(e) => setMonth(e.target.value)} className="h-9 w-40">
              {MONTHS.map((m) => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </Select>
          </div>
        }
      />

      {/* account tabs with live match progress */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {BANK_ACCOUNTS.map((b) => {
          const bk = bookLines(b, from, to);
          const st = statementLines(b, from, to);
          const m = matchStore[`${b.id}|${month}`] ?? autoMatch(bk, st, {});
          const r = reconcile(b, bk, st, m, bookedStore[`${b.id}|${month}`] ?? []);
          const active = b.id === accountId;
          return (
            <button
              key={b.id}
              onClick={() => setAccountId(b.id)}
              className={cn(
                "rounded-lg border p-3 text-left transition-colors",
                active ? "border-primary bg-primary/5 shadow-sm" : "bg-card hover:bg-accent/50",
              )}
            >
              <p className="flex items-center gap-1.5 text-sm font-semibold">
                <Landmark className="size-3.5 text-muted-foreground" /> {b.bankName}
              </p>
              <p className="text-[11px] text-muted-foreground">{bankAccountLabel(b).split(" · ")[0]} · {b.currency}</p>
              <div className="mt-2 flex items-center justify-between">
                <Money value={r.bookBalance} compact className="text-sm font-bold" />
                <Badge variant={r.matchedPct === 100 ? "success" : r.matchedPct >= 80 ? "warning" : "default"}>
                  {r.matchedPct}% matched
                </Badge>
              </div>
            </button>
          );
        })}
      </div>

      {/* selected account KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Balance per books" value={rec.bookBalance} />
        <Kpi label="Balance per statement" value={rec.statementBalance} />
        <Kpi label="Reconciling items" value={rec.unmatchedBook.length + rec.unmatchedStmt.length} plain accent />
        <div className="flex items-center justify-center rounded-lg border bg-card px-4 py-2.5 shadow-sm">
          <Button variant="outline" onClick={runAuto} className="w-full">
            <Wand2 className="size-4" /> Auto-match
          </Button>
        </div>
      </div>

      {selBookLine && (
        <div className="mb-3 flex items-center justify-between rounded-lg border border-primary/40 bg-primary/5 px-4 py-2 text-sm">
          <span>Selected book line: <strong>{selBookLine.memo}</strong> · <Money value={selBookLine.amount} /> — now click a matching statement line.</span>
          <Button size="sm" variant="ghost" onClick={() => setSelBook(null)}>Clear</Button>
        </div>
      )}

      {suggestions.length > 0 && (
        <Card className="mb-4 border-primary/40 bg-primary/5 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold">
              <Sparkles className="size-4 text-primary" /> {suggestions.length} suggested match{suggestions.length > 1 ? "es" : ""}
              <span className="font-normal text-muted-foreground">— amount lines up but no UTR to confirm</span>
            </h3>
            <Button size="sm" onClick={acceptAllSuggestions}>Accept all</Button>
          </div>
          <div className="space-y-1.5">
            {suggestions.map((sg) => {
              const b = bookById.get(sg.bookId);
              const s = stmt.find((x) => x.id === sg.stmtId);
              if (!b || !s) return null;
              return (
                <div key={sg.stmtId} className="flex items-center gap-3 rounded-md border bg-card px-3 py-2 text-sm">
                  <span className="flex-1 truncate">
                    <strong>{s.description}</strong> <Money value={s.amount} className="text-muted-foreground" /> · {formatDate(s.date)}
                    <span className="ml-1 text-[11px] text-muted-foreground">↔ {b.memo}</span>
                  </span>
                  <Badge variant="warning" className="text-[10px]">{sg.reason}</Badge>
                  <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => acceptSuggestion(sg.stmtId, sg.bookId)}>Accept</Button>
                  <Button size="sm" variant="ghost" className="h-7 px-2" onClick={() => dismissSuggestion(sg.stmtId)}>Dismiss</Button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* matching workspace */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        {/* books */}
        <Card className="overflow-hidden">
          <PaneHeader title="Cash book" sub={`${book.length} entries · ${rec.unmatchedBook.length} unmatched`} />
          <div className="max-h-[460px] overflow-y-auto scrollbar-thin">
            <LineTable>
              {book.map((b) => {
                const matched = matchedBookIds.has(b.id);
                const selected = selBook === b.id;
                return (
                  <Row
                    key={b.id}
                    date={b.date}
                    desc={b.memo}
                    sub={b.ref}
                    amount={b.amount}
                    matched={matched}
                    selected={selected}
                    onClick={matched ? undefined : () => setSelBook(selected ? null : b.id)}
                  />
                );
              })}
              {book.length === 0 && <EmptyRow />}
            </LineTable>
          </div>
        </Card>

        {/* statement */}
        <Card className="overflow-hidden">
          <PaneHeader title="Bank statement" sub={`${stmt.length} lines · ${rec.unmatchedStmt.length} to action`} />
          <div className="max-h-[460px] overflow-y-auto scrollbar-thin">
            <LineTable>
              {stmt.map((s) => {
                const matched = matchedStmtIds.has(s.id);
                const isBooked = bookedSet.has(s.id);
                const bankOnly = s.kind !== "normal" || (!matched && s.id.startsWith("bo-"));
                return (
                  <Row
                    key={s.id}
                    date={s.date}
                    desc={s.description}
                    sub={s.ref}
                    amount={s.amount}
                    matched={matched || isBooked}
                    tag={s.kind === "charge" ? "Charge" : s.kind === "interest" ? "Interest" : undefined}
                    onClick={matched || isBooked ? (matched ? () => unmatch(s.id) : undefined) : () => clickStmt(s.id, s.amount)}
                    action={
                      !matched && !isBooked && bankOnly ? (
                        <Button size="sm" variant="outline" className="h-6 px-1.5 text-[11px]" onClick={(e) => { e.stopPropagation(); bookEntry(s.id); }}>
                          <Plus className="size-3" /> Book
                        </Button>
                      ) : matched ? (
                        <span className="inline-flex items-center gap-1">
                          {isUtrVerified(s.id) && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] text-success" title="Matched on bank UTR"><ShieldCheck className="size-3" /> UTR</span>
                          )}
                          <span className="inline-flex items-center gap-0.5 text-[11px] text-muted-foreground"><Unlink className="size-3" /> Unmatch</span>
                        </span>
                      ) : isBooked ? (
                        <Badge variant="success" className="text-[10px]">Booked</Badge>
                      ) : null
                    }
                  />
                );
              })}
              {stmt.length === 0 && <EmptyRow />}
            </LineTable>
          </div>
        </Card>
      </div>

      {/* BRS */}
      <Card className="p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Link2 className="size-4" /> Bank reconciliation statement — {monthLabel(month)}</h3>
          <Badge variant={Math.abs(rec.difference) < 1 ? "success" : "danger"}>
            {Math.abs(rec.difference) < 1 ? <><CheckCircle2 className="size-3" /> Reconciled</> : `Diff ₹${rec.difference.toFixed(0)}`}
          </Badge>
        </div>
        <div className="mx-auto max-w-xl">
          {rec.brs.map((l) => (
            <div key={l.label} className={cn("flex items-center justify-between py-2 text-sm", l.isTotal ? "border-y font-semibold" : "border-b border-dashed text-muted-foreground")}>
              <span>{l.label}</span>
              <Money value={l.amount} className={cn("tabular", l.isTotal && "font-bold")} bracketNegatives />
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}

function PaneHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      <span className="text-[11px] text-muted-foreground">{sub}</span>
    </div>
  );
}

function LineTable({ children }: { children: React.ReactNode }) {
  return <table className="w-full text-sm"><tbody>{children}</tbody></table>;
}

function Row({
  date, desc, sub, amount, matched, selected, tag, action, onClick,
}: {
  date: string; desc: string; sub: string; amount: number; matched?: boolean; selected?: boolean; tag?: string; action?: React.ReactNode; onClick?: () => void;
}) {
  return (
    <tr
      onClick={onClick}
      className={cn(
        "border-b last:border-0 transition-colors",
        onClick && "cursor-pointer hover:bg-accent/50",
        matched && "opacity-55",
        selected && "bg-primary/10 ring-1 ring-inset ring-primary",
      )}
    >
      <td className="w-px whitespace-nowrap px-3 py-2 align-top text-[11px] text-muted-foreground">{formatDate(date)}</td>
      <td className="px-2 py-2">
        <p className="flex items-center gap-1.5 font-medium leading-tight">
          {amount >= 0 ? <ArrowDownLeft className="size-3.5 text-success" /> : <ArrowUpRight className="size-3.5 text-danger" />}
          {desc}
          {tag && <Badge variant="warning" className="text-[10px]">{tag}</Badge>}
        </p>
        <p className="font-mono text-[10px] text-muted-foreground">{sub}</p>
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right align-top tabular font-semibold">
        <Money value={amount} bracketNegatives />
        {action && <div className="mt-0.5">{action}</div>}
      </td>
    </tr>
  );
}

function EmptyRow() {
  return <tr><td className="px-4 py-10 text-center text-sm text-muted-foreground">No entries this period.</td></tr>;
}

function Kpi({ label, value, accent, plain }: { label: string; value: number; accent?: boolean; plain?: boolean }) {
  return (
    <Card className={cn("p-4", accent && "border-primary/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular", accent && "text-primary")}>
        {plain ? value : <Money value={value} compact />}
      </p>
    </Card>
  );
}
