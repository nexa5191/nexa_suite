"use client";

import { Fragment, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus, Undo2, ChevronRight, NotebookPen, Upload, Repeat,
  Trash2, CheckSquare, Square, Pencil, MessageSquare, Send as SendIcon,
  FileEdit,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Money } from "@/components/ui/money";
import { VoucherComments } from "@/components/accounting/voucher-comments";
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
  if (e.status === "draft") return <Badge variant="warning">Draft</Badge>;
  if (e.reversalOf) return <Badge variant="warning">Reversal</Badge>;
  if (e.status === "reversed") return <Badge variant="danger">Reversed</Badge>;
  return <Badge variant="success">Posted</Badge>;
}

// ---------------------------------------------------------------------------
// Bulk-edit modal
// ---------------------------------------------------------------------------
function BulkEditModal({
  count,
  onApply,
  onClose,
}: {
  count: number;
  onApply: (field: "narration" | "costCenter", value: string) => void;
  onClose: () => void;
}) {
  const [field, setField] = useState<"narration" | "costCenter">("narration");
  const [value, setValue] = useState("");

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit ${count} voucher${count === 1 ? "" : "s"}`}
      description="The new value will overwrite the chosen field on every selected voucher."
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={() => { onApply(field, value); onClose(); }} disabled={!value.trim()}>
            Apply to all
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <Label>Field to update</Label>
          <Select value={field} onChange={(e) => setField(e.target.value as "narration" | "costCenter")} className="mt-1">
            <option value="narration">Narration</option>
            <option value="costCenter">Cost centre</option>
          </Select>
        </div>
        <div>
          <Label>New value</Label>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={field === "narration" ? "Enter narration…" : "e.g. Operations, Finance…"}
            className="mt-1"
            autoFocus
          />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Post-draft confirmation modal (shows errors if validation fails)
// ---------------------------------------------------------------------------
function PostDraftErrors({ errors, onClose }: { errors: string[]; onClose: () => void }) {
  return (
    <Modal
      open
      onClose={onClose}
      title="Draft cannot be posted"
      description="Fix these issues before posting."
      footer={<Button onClick={onClose}>OK</Button>}
    >
      <ul className="list-inside list-disc space-y-1 text-sm text-danger">
        {errors.map((e, i) => <li key={i}>{e}</li>)}
      </ul>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function JournalRegisterClient() {
  const { entries, reverse, postDraft, deleteDraft, updateEntries, comments } = useJournal();
  const [showNew, setShowNew] = useState(false);
  useNewIntent(() => setShowNew(true));
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [expandedTab, setExpandedTab] = useState<"lines" | "comments">("lines");
  const [filter, setFilter] = useState<"all" | "draft">("all");

  // Bulk-select state
  const [selected, setSelected] = useState(new Set<string>());
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [draftErrors, setDraftErrors] = useState<string[] | null>(null);

  const term = q.trim().toLowerCase();
  const rows = useMemo(() => {
    return entries
      .filter((e) => {
        if (filter === "draft" && e.status !== "draft") return false;
        return (
          !term ||
          e.voucherNo.toLowerCase().includes(term) ||
          e.narration.toLowerCase().includes(term) ||
          (e.costCenter?.toLowerCase().includes(term) ?? false)
        );
      })
      .slice()
      .sort((a, b) => {
        // Drafts first, then newest first by date + voucher
        if (a.status === "draft" && b.status !== "draft") return -1;
        if (a.status !== "draft" && b.status === "draft") return 1;
        return a.date === b.date ? b.voucherNo.localeCompare(a.voucherNo) : a.date < b.date ? 1 : -1;
      });
  }, [entries, term, filter]);

  const postedCount = entries.filter((e) => e.status === "posted" && !e.reversalOf).length;
  const draftCount = entries.filter((e) => e.status === "draft").length;

  const today = new Date().toISOString().slice(0, 10);
  const upcomingReversals = entries
    .filter((e) => e.autoReverse && e.reverseDate && e.status === "posted" && !e.reversalOf && e.reverseDate >= today)
    .sort((a, b) => (a.reverseDate! < b.reverseDate! ? -1 : 1));

  // Selection helpers
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const someSelected = selected.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map((r) => r.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleBulkApply = (field: "narration" | "costCenter", value: string) => {
    updateEntries([...selected], { [field]: value });
    setSelected(new Set());
  };

  const handlePostDraft = (id: string) => {
    const result = postDraft(id);
    if (!result.ok) setDraftErrors(result.errors);
  };

  const commentCountFor = (id: string) => comments.filter((c) => c.voucherId === id).length;

  return (
    <>
      <PageHeader
        title="Journal Entries"
        subtitle="Manually posted double-entry vouchers · corrections by reversal (audit trail preserved)"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex rounded-lg border text-xs font-medium overflow-hidden">
              <button
                onClick={() => setFilter("all")}
                className={cn("px-3 py-1.5 transition-colors", filter === "all" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
              >
                All ({entries.length})
              </button>
              <button
                onClick={() => setFilter("draft")}
                className={cn("px-3 py-1.5 transition-colors", filter === "draft" ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
              >
                Drafts {draftCount > 0 && `(${draftCount})`}
              </button>
            </div>
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
      {showBulkEdit && (
        <BulkEditModal
          count={selected.size}
          onApply={handleBulkApply}
          onClose={() => setShowBulkEdit(false)}
        />
      )}
      {draftErrors && (
        <PostDraftErrors errors={draftErrors} onClose={() => setDraftErrors(null)} />
      )}

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

      {/* Bulk action bar */}
      {someSelected && (
        <div className="mb-2 flex items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-2.5 text-sm">
          <span className="font-medium text-primary">{selected.size} selected</span>
          <Button size="sm" variant="outline" onClick={() => setShowBulkEdit(true)}>
            <Pencil className="size-3.5" /> Edit fields
          </Button>
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-muted-foreground hover:text-foreground">
            Deselect all
          </button>
        </div>
      )}

      <div className="max-h-[70vh] overflow-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
              <th className="w-9 px-3 py-2.5">
                <button onClick={toggleAll} className="text-muted-foreground hover:text-foreground">
                  {allSelected ? <CheckSquare className="size-4" /> : <Square className="size-4" />}
                </button>
              </th>
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
              const isDraft = e.status === "draft";
              const cmtCount = commentCountFor(e.id);
              return (
                <Fragment key={e.id}>
                  <tr
                    onClick={() => {
                      setExpanded(isOpen ? null : e.id);
                      setExpandedTab("lines");
                    }}
                    className={cn(
                      "cursor-pointer border-b border-border/40 last:border-0 hover:bg-accent/30",
                      e.status === "reversed" && "text-muted-foreground",
                      isDraft && "bg-warning/5",
                    )}
                  >
                    <td className="px-3 py-2.5" onClick={(ev) => ev.stopPropagation()}>
                      <button onClick={() => toggleOne(e.id)} className="text-muted-foreground hover:text-foreground">
                        {selected.has(e.id) ? <CheckSquare className="size-4 text-primary" /> : <Square className="size-4" />}
                      </button>
                    </td>
                    <td className="px-3 py-2.5">
                      <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs">{e.voucherNo}</td>
                    <td className="whitespace-nowrap px-3 py-2.5">
                      <Badge variant="primary">{voucherType(e.type).label}</Badge>
                    </td>
                    <td className="whitespace-nowrap px-3 py-2.5 text-muted-foreground">{formatDate(e.date)}</td>
                    <td className="px-3 py-2.5">
                      <span className="block max-w-[240px] truncate">{e.narration || <span className="italic text-muted-foreground/50">No narration</span>}</span>
                      {e.partyId && <span className="text-xs text-muted-foreground">{partyName(e.partyId)}</span>}
                      {e.costCenter && <span className="ml-1 text-xs text-muted-foreground">· {e.costCenter}</span>}
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
                    <td className="px-3 py-2.5 text-right" onClick={(ev) => ev.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        {cmtCount > 0 && (
                          <button
                            onClick={() => { setExpanded(e.id); setExpandedTab("comments"); }}
                            className="flex items-center gap-0.5 text-xs text-muted-foreground hover:text-foreground"
                            title="View comments"
                          >
                            <MessageSquare className="size-3.5" />
                            <span>{cmtCount}</span>
                          </button>
                        )}
                        {isDraft && (
                          <>
                            <Button variant="outline" size="sm" onClick={() => handlePostDraft(e.id)}>
                              <SendIcon className="size-3.5" /> Post
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => deleteDraft(e.id)}
                              className="text-danger hover:border-danger hover:text-danger"
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </>
                        )}
                        {canReverse && (
                          <Button variant="outline" size="sm" onClick={() => reverse(e.id)}>
                            <Undo2 className="size-4" /> Reverse
                          </Button>
                        )}
                        {!isDraft && !canReverse && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>

                  {isOpen && (
                    <tr className="border-b border-border/40 bg-muted/20">
                      <td colSpan={2} />
                      <td colSpan={9} className="px-3 py-3">
                        {/* Tabs */}
                        <div className="mb-3 flex gap-0 overflow-hidden rounded-lg border text-xs font-medium w-fit">
                          <button
                            onClick={() => setExpandedTab("lines")}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 transition-colors",
                              expandedTab === "lines" ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                            )}
                          >
                            <FileEdit className="size-3.5" /> GL Lines
                          </button>
                          <button
                            onClick={() => setExpandedTab("comments")}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1.5 transition-colors",
                              expandedTab === "comments" ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                            )}
                          >
                            <MessageSquare className="size-3.5" />
                            Comments {cmtCount > 0 && `(${cmtCount})`}
                          </button>
                        </div>

                        {expandedTab === "lines" && (
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
                            {e.reversedBy && (
                              <p className="p-2 text-xs text-muted-foreground">Reversed by a later voucher.</p>
                            )}
                          </div>
                        )}

                        {expandedTab === "comments" && (
                          <div className="rounded-lg border bg-card p-3">
                            <VoucherComments voucherId={e.id} />
                          </div>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={11} className="px-4 py-12 text-center">
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
