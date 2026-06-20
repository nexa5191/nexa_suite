"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Undo2, ChevronRight, NotebookPen, Upload, Repeat } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { useJournal } from "@/components/accounting/journal-provider";
import { NewJournalEntry } from "@/components/accounting/new-journal-entry";
import { entryTotals, voucherType, type ManualEntry } from "@/lib/accounting/manual-entries";
import { accountSafe } from "@/lib/accounting/chart-of-accounts";
import { entityById, locationById } from "@/lib/accounting/org";
import { partyName } from "@/lib/accounting/parties";
import { cn, formatDate } from "@/lib/utils";
import { useNewIntent } from "@/lib/commands/new-intent";

const BASIS_LABEL: Record<string, string> = { accrual: "Accrual", cash: "Cash", both: "Both" };

function statusBadge(e: ManualEntry) {
  if (e.reversalOf) return <Badge variant="warning">Reversal</Badge>;
  if (e.status === "reversed") return <Badge variant="danger">Reversed</Badge>;
  return <Badge variant="success">Posted</Badge>;
}

export function JournalRegisterClient() {
  const { entries, reverse } = useJournal();
  const [showNew, setShowNew] = useState(false);
  useNewIntent(() => setShowNew(true));
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);

  const term = q.trim().toLowerCase();
  const rows = useMemo(() => {
    return entries
      .filter(
        (e) =>
          !term ||
          e.voucherNo.toLowerCase().includes(term) ||
          e.narration.toLowerCase().includes(term),
      )
      // Newest first: by date, then by voucher sequence.
      .slice()
      .sort((a, b) => (a.date === b.date ? b.voucherNo.localeCompare(a.voucherNo) : a.date < b.date ? 1 : -1));
  }, [entries, term]);

  const postedCount = entries.filter((e) => e.status === "posted" && !e.reversalOf).length;

  // Surface accruals/provisions that will auto-reverse on a future date so they
  // don't silently flip the books — soonest first.
  const today = new Date().toISOString().slice(0, 10);
  const upcomingReversals = entries
    .filter((e) => e.autoReverse && e.reverseDate && e.status === "posted" && !e.reversalOf && e.reverseDate >= today)
    .sort((a, b) => (a.reverseDate! < b.reverseDate! ? -1 : 1));

  return (
    <>
      <PageHeader
        title="Journal Entries"
        subtitle="Manually posted double-entry vouchers · corrections by reversal (audit trail preserved)"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative w-full sm:w-56">
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search voucher / narration…" />
            </div>
            <Link
              href="/journal-entries/upload"
              className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-input bg-card px-3 text-sm font-medium shadow-sm transition-colors hover:bg-accent"
            >
              <Upload className="size-4" /> Upload
            </Link>
            <Button onClick={() => setShowNew(true)} className="shrink-0">
              <Plus className="size-4" /> New entry
            </Button>
          </div>
        }
      />

      <NewJournalEntry open={showNew} onClose={() => setShowNew(false)} />

      {upcomingReversals.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning/10 px-4 py-2.5 text-sm">
          <Repeat className="size-4 shrink-0 text-warning" />
          <span>
            <strong>{upcomingReversals.length}</strong> auto-reversing {upcomingReversals.length === 1 ? "entry" : "entries"} scheduled — next:{" "}
            <span className="font-mono text-xs">{upcomingReversals[0].voucherNo}</span> reverses {formatDate(upcomingReversals[0].reverseDate!)}.
          </span>
        </div>
      )}

      <div className="mb-3 grid grid-cols-3 gap-3">
        <Stat label="Total vouchers" value={entries.length.toLocaleString("en-IN")} />
        <Stat label="Active (posted)" value={postedCount.toLocaleString("en-IN")} />
        <Stat label="Reversed" value={entries.filter((e) => e.status === "reversed").length.toLocaleString("en-IN")} />
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
              <th className="w-8 px-3 py-2.5" />
              <th className="px-3 py-2.5 font-medium">Voucher</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 font-medium">Date</th>
              <th className="px-3 py-2.5 font-medium">Narration</th>
              <th className="px-3 py-2.5 font-medium">Entity / Location</th>
              <th className="px-3 py-2.5 font-medium">Basis</th>
              <th className="px-3 py-2.5 text-right font-medium">Amount</th>
              <th className="px-3 py-2.5 font-medium">Status</th>
              <th className="px-3 py-2.5 text-right font-medium">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => {
              const ent = entityById(e.entityId);
              const loc = locationById(e.locationId);
              const total = entryTotals(e.lines).debit;
              const isOpen = expanded === e.id;
              const canReverse = e.status === "posted" && !e.reversalOf;
              return (
                <Fragment key={e.id}>
                  <tr
                    onClick={() => setExpanded(isOpen ? null : e.id)}
                    className={cn(
                      "cursor-pointer border-b border-border/40 last:border-0 hover:bg-accent/30",
                      e.status === "reversed" && "text-muted-foreground",
                    )}
                  >
                    <td className="px-3 py-2.5">
                      <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">{e.voucherNo}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Badge variant="primary">{voucherType(e.type).label}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDate(e.date)}</td>
                    <td className="px-3 py-2.5">
                      <span className="block max-w-[280px] truncate">{e.narration}</span>
                      {e.partyId && <span className="text-xs text-muted-foreground">{partyName(e.partyId)}</span>}
                      {e.autoReverse && e.reverseDate && (
                        <Badge variant="warning" className="mt-0.5">↺ auto-reverses {formatDate(e.reverseDate)}</Badge>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-xs text-muted-foreground">
                      {ent?.name} · {loc?.name}
                    </td>
                    <td className="px-3 py-2.5">
                      <Badge variant="default">{BASIS_LABEL[e.basis] ?? e.basis}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular">
                      <Money value={total} />
                    </td>
                    <td className="px-3 py-2.5">{statusBadge(e)}</td>
                    <td className="px-3 py-2.5 text-right">
                      {canReverse ? (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            reverse(e.id);
                          }}
                        >
                          <Undo2 className="size-4" /> Reverse
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr className="border-b border-border/40 bg-muted/20">
                      <td />
                      <td colSpan={9} className="px-3 py-3">
                        <div className="overflow-hidden rounded-lg border bg-card">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                                <th className="px-3 py-2 font-medium">Account</th>
                                <th className="px-3 py-2 text-right font-medium">Debit</th>
                                <th className="px-3 py-2 text-right font-medium">Credit</th>
                              </tr>
                            </thead>
                            <tbody>
                              {e.lines.map((l, i) => {
                                const acc = accountSafe(l.accountCode);
                                return (
                                  <tr key={i} className="border-b border-border/40 last:border-0">
                                    <td className="px-3 py-2">
                                      <span className="font-mono text-xs text-muted-foreground">{l.accountCode}</span>{" "}
                                      <span className="font-medium">{acc?.name}</span>
                                      {l.memo && <span className="block text-xs text-muted-foreground">{l.memo}</span>}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular">
                                      {l.debit ? <Money value={l.debit} /> : <span className="text-muted-foreground">—</span>}
                                    </td>
                                    <td className="px-3 py-2 text-right tabular">
                                      {l.credit ? <Money value={l.credit} /> : <span className="text-muted-foreground">—</span>}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                        {e.reversedBy && (
                          <p className="mt-2 text-xs text-muted-foreground">Reversed by a later voucher.</p>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <NotebookPen className="mx-auto mb-2 size-8 text-muted-foreground/50" />
                  <p className="text-sm text-muted-foreground">
                    {entries.length === 0 ? "No journal entries posted yet." : "No vouchers match your search."}
                  </p>
                  {entries.length === 0 && (
                    <Button onClick={() => setShowNew(true)} className="mt-3">
                      <Plus className="size-4" /> Post your first entry
                    </Button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular">{value}</p>
    </div>
  );
}
