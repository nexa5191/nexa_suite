"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ClipboardCheck, Check, X, ArrowRight } from "lucide-react";
import { cn, formatDate } from "@/lib/utils";
import { allApprovals, loadDecisions, saveDecisions, type Decision } from "@/lib/hr/approvals";
import { KIND_META } from "@/components/hr/approval-meta";
import type { ApprovalKind } from "@/lib/hr/types";

const KINDS: ApprovalKind[] = ["leave", "financial", "document"];
// Fired (same-tab) whenever a decision is made, so every approvals surface — the
// bell, the dashboard widget, the page — can re-read in sync.
const SYNC_EVENT = "nexa-approvals-changed";

export function ApprovalsBell() {
  const [open, setOpen] = useState(false);
  const [decisions, setDecisions] = useState<Record<string, Decision>>({});
  const ref = useRef<HTMLDivElement>(null);

  // allApprovals() is deterministic seed data — safe to read on the client.
  const approvals = useMemo(() => allApprovals(), []);

  const refresh = () => setDecisions(loadDecisions());
  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener(SYNC_EVENT, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(SYNC_EVENT, onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  const pending = approvals.filter((a) => decisions[a.id] == null);
  const count = pending.length;

  function decide(id: string, decision: Decision) {
    setDecisions((prev) => {
      const next = { ...prev, [id]: decision };
      saveDecisions(next);
      return next;
    });
    window.dispatchEvent(new Event(SYNC_EVENT));
  }

  const pendingByKind = (k: ApprovalKind) => pending.filter((a) => a.kind === k);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative grid size-9 place-items-center rounded-md border bg-card transition-colors hover:bg-accent"
        aria-label={`Approvals — ${count} pending`}
        title={`${count} pending approval${count === 1 ? "" : "s"}`}
      >
        <ClipboardCheck className="size-[18px]" />
        {count > 0 && (
          <span className="absolute -right-1.5 -top-1.5 grid min-w-[18px] place-items-center rounded-full bg-primary px-1 text-[10px] font-bold leading-[18px] text-primary-foreground">
            {count > 99 ? "99+" : count}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-11 z-50 w-96 max-w-[calc(100vw-2rem)] animate-fade-in overflow-hidden rounded-lg border bg-popover shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <p className="text-sm font-semibold">Approvals</p>
            <span className="text-xs text-muted-foreground">{count} pending</span>
          </div>

          <div className="max-h-[60vh] overflow-y-auto">
            {count === 0 ? (
              <p className="px-4 py-10 text-center text-sm text-muted-foreground">
                You&apos;re all caught up — nothing pending.
              </p>
            ) : (
              KINDS.map((k) => {
                const items = pendingByKind(k);
                if (items.length === 0) return null;
                const meta = KIND_META[k];
                return (
                  <div key={k} className="border-b last:border-b-0">
                    <div className="flex items-center gap-2 bg-muted/40 px-4 py-1.5 text-xs font-semibold text-muted-foreground">
                      <meta.Icon className="size-3.5" />
                      {meta.label}
                      <span className="ml-auto font-normal">{items.length}</span>
                    </div>
                    {items.slice(0, 4).map((a) => (
                      <div key={a.id} className="flex items-center gap-2 px-4 py-2.5 hover:bg-accent/40">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{a.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {a.requestedByName} · {formatDate(a.requestedOn)}
                          </p>
                        </div>
                        <button
                          onClick={() => decide(a.id, "rejected")}
                          className="grid size-7 place-items-center rounded-md border text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          title="Reject"
                        >
                          <X className="size-3.5" />
                        </button>
                        <button
                          onClick={() => decide(a.id, "approved")}
                          className="grid size-7 place-items-center rounded-md bg-primary text-primary-foreground transition-colors hover:opacity-90"
                          title="Approve"
                        >
                          <Check className="size-3.5" />
                        </button>
                      </div>
                    ))}
                    {items.length > 4 && (
                      <p className="px-4 pb-2 text-xs text-muted-foreground">+{items.length - 4} more</p>
                    )}
                  </div>
                );
              })
            )}
          </div>

          <Link
            href="/approvals"
            onClick={() => setOpen(false)}
            className={cn(
              "flex items-center justify-center gap-1.5 border-t px-4 py-2.5 text-sm font-medium",
              "text-primary transition-colors hover:bg-accent/50",
            )}
          >
            Open approvals screen <ArrowRight className="size-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
