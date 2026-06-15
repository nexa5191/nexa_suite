"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { setManualPostings } from "@/lib/accounting/ledger";
import {
  type ManualEntry,
  type EntryDraft,
  buildReversal,
  createEntry,
  expandManualEntries,
  loadEntries,
  saveEntries,
  validateDraft,
} from "@/lib/accounting/manual-entries";

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
}

const Ctx = createContext<JournalContext | null>(null);

function todayIso(): string {
  // Client-only (effect/handler context) — fine to read the wall clock here.
  return new Date().toISOString().slice(0, 10);
}

export function JournalProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ManualEntry[]>([]);
  const [version, setVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from localStorage after mount (SSR renders with no manual entries).
  useEffect(() => {
    const loaded = loadEntries();
    setEntries(loaded);
    setManualPostings(expandManualEntries(loaded));
    setVersion((v) => v + 1);
    setHydrated(true);
  }, []);

  // Keep the ledger + storage in sync with any change after hydration.
  useEffect(() => {
    if (!hydrated) return;
    setManualPostings(expandManualEntries(entries));
    saveEntries(entries);
    setVersion((v) => v + 1);
  }, [entries, hydrated]);

  const post = useCallback<JournalContext["post"]>(
    (draft) => {
      const errors = validateDraft(draft, todayIso());
      if (errors.length) return { ok: false, errors };
      const created = createEntry(draft, entries, new Date().toISOString());
      setEntries((prev) => [...prev, created]);
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
          // Number each new voucher against the growing list so refs stay gapless.
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

  const value = useMemo<JournalContext>(
    () => ({ entries, version, post, postMany, reverse }),
    [entries, version, post, postMany, reverse],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useJournal(): JournalContext {
  const c = useContext(Ctx);
  if (!c) throw new Error("useJournal must be used within JournalProvider");
  return c;
}
