"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setManualPostings } from "@/lib/accounting/ledger";
import {
  type ManualEntry,
  type EntryDraft,
  buildReversal,
  createDraftEntry,
  createEntry,
  expandManualEntries,
  loadEntries,
  nextVoucherNo,
  saveEntries,
  validateDraft,
} from "@/lib/accounting/manual-entries";
import {
  type VoucherComment,
  loadComments,
  saveComments,
  parseMentions,
} from "@/lib/accounting/comments";

interface JournalContext {
  entries: ManualEntry[];
  /** Monotonic counter; bumps whenever postings change so consumers recompute. */
  version: number;
  /** Validate + post a draft. Returns the new entry, or a list of errors. */
  post: (draft: EntryDraft) => { ok: true; entry: ManualEntry } | { ok: false; errors: string[] };
  /** Bulk-post drafts (e.g. CSV import) — gapless numbering, one state commit. */
  postMany: (drafts: EntryDraft[]) => { posted: number; failed: { index: number; errors: string[] }[] };
  /** Reverse a posted entry (GAAP: correction by offsetting entry, not delete). */
  reverse: (id: string) => void;
  /** Last successfully posted entry — used to drive the undo toast. */
  lastPosted: ManualEntry | null;
  clearLastPosted: () => void;
  /** Save an incomplete entry as a draft (no validation, no voucherNo). */
  saveDraft: (draft: EntryDraft) => ManualEntry;
  /** Validate a draft and promote it to posted. */
  postDraft: (id: string) => { ok: true; entry: ManualEntry } | { ok: false; errors: string[] };
  /** Permanently discard a draft. */
  deleteDraft: (id: string) => void;
  /** Patch narration / costCenter on any entries (bulk edit). */
  updateEntries: (ids: string[], patch: Partial<Pick<ManualEntry, "narration" | "costCenter">>) => void;
  /** Inline comments keyed to voucher IDs. */
  comments: VoucherComment[];
  addComment: (voucherId: string, text: string, authorId: string) => VoucherComment;
}

const Ctx = createContext<JournalContext | null>(null);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [comments, setComments] = useState<VoucherComment[]>([]);
  const [version, setVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);
  const [lastPosted, setLastPosted] = useState<ManualEntry | null>(null);

  useEffect(() => {
    const loaded = loadEntries();
    setEntries(loaded);
    setManualPostings(expandManualEntries(loaded));
    setComments(loadComments());
    setVersion((v) => v + 1);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    setManualPostings(expandManualEntries(entries));
    saveEntries(entries);
    setVersion((v) => v + 1);
  }, [entries, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    saveComments(comments);
  }, [comments, hydrated]);

  const post = useCallback<JournalContext["post"]>(
    (draft) => {
      const errors = validateDraft(draft, todayIso());
      if (errors.length) return { ok: false, errors };
      const created = createEntry(draft, entries, new Date().toISOString());
      setEntries((prev) => [...prev, created]);
      setLastPosted(created);
      return { ok: true, entry: created };
    },
    [entries],
  );

  const postMany = useCallback<JournalContext["postMany"]>(
    (drafts) => {
      const today = todayIso();
      const now = new Date().toISOString();
      const failed: { index: number; errors: string[] }[] = [];
      setEntries((prev) => {
        const acc = [...prev];
        drafts.forEach((draft, index) => {
          const errors = validateDraft(draft, today);
          if (errors.length) {
            failed.push({ index, errors });
            return;
          }
          acc.push(createEntry(draft, acc, now));
        });
        return acc;
      });
      return { posted: drafts.length - failed.length, failed };
    },
    [],
  );

  const reverse = useCallback((id: string) => {
    setEntries((prev) => {
      const original = prev.find((e) => e.id === id);
      if (!original || original.status === "reversed" || original.reversalOf) return prev;
      const now = new Date().toISOString();
      const reversalDraft = buildReversal(original, todayIso());
      const reversal = createEntry(reversalDraft, prev, now);
      reversal.reversalOf = original.id;
      return prev
        .map((e): ManualEntry => (e.id === id ? { ...e, status: "reversed", reversedBy: reversal.id } : e))
        .concat(reversal);
    });
  }, []);

  const clearLastPosted = useCallback(() => setLastPosted(null), []);

  const saveDraft = useCallback<JournalContext["saveDraft"]>((draft) => {
    const entry = createDraftEntry(draft, new Date().toISOString());
    setEntries((prev) => [...prev, entry]);
    return entry;
  }, []);

  const postDraft = useCallback<JournalContext["postDraft"]>(
    (id) => {
      const draft = entries.find((e) => e.id === id && e.status === "draft");
      if (!draft) return { ok: false, errors: ["Draft not found."] };

      const entryDraft: EntryDraft = {
        type: draft.type,
        date: draft.date,
        narration: draft.narration,
        entityId: draft.entityId,
        locationId: draft.locationId,
        currency: draft.currency,
        basis: draft.basis,
        partyId: draft.partyId,
        costCenter: draft.costCenter,
        lines: draft.lines,
        autoReverse: draft.autoReverse,
        reverseDate: draft.reverseDate,
      };

      const errors = validateDraft(entryDraft, todayIso());
      if (errors.length) return { ok: false, errors };

      const othersForNumbering = entries.filter((e) => e.id !== id);
      const voucherNo = nextVoucherNo(othersForNumbering, draft.type);
      const posted: ManualEntry = { ...draft, voucherNo, status: "posted" };
      setEntries((prev) => prev.map((e) => (e.id === id ? posted : e)));
      setLastPosted(posted);
      return { ok: true, entry: posted };
    },
    [entries],
  );

  const deleteDraft = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => !(e.id === id && e.status === "draft")));
  }, []);

  const updateEntries = useCallback(
    (ids: string[], patch: Partial<Pick<ManualEntry, "narration" | "costCenter">>) => {
      const idSet = new Set(ids);
      setEntries((prev) => prev.map((e) => (idSet.has(e.id) ? { ...e, ...patch } : e)));
    },
    [],
  );

  const addComment = useCallback<JournalContext["addComment"]>(
    (voucherId, text, authorId) => {
      const comment: VoucherComment = {
        id: `cmt-${new Date().toISOString()}-${Math.random().toString(36).slice(2, 6)}`,
        voucherId,
        text,
        authorId,
        createdAt: new Date().toISOString(),
        mentions: parseMentions(text),
      };
      setComments((prev) => [...prev, comment]);
      return comment;
    },
    [],
  );

  const value = useMemo<JournalContext>(
    () => ({
      entries,
      version,
      post,
      postMany,
      reverse,
      lastPosted,
      clearLastPosted,
      saveDraft,
      postDraft,
      deleteDraft,
      updateEntries,
      comments,
      addComment,
    }),
    [
      entries, version, post, postMany, reverse,
      lastPosted, clearLastPosted, saveDraft, postDraft, deleteDraft, updateEntries,
      comments, addComment,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJournal(): JournalContext {
  const c = useContext(Ctx);
  if (!c) throw new Error("useJournal must be used within JournalProvider");
  return c;
}
