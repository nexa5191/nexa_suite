"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { Search, CornerDownLeft, Keyboard, X } from "lucide-react";
import { NAV_GROUPS, SECONDARY_NAV, COMMAND_ACTIONS, type NavItem } from "./nav-items";
import { NEW_INTENT_EVENT } from "@/lib/commands/new-intent";
import { useAccess } from "@/components/access/access-provider";
import { useSplit } from "@/components/shell/split/split-provider";
import { cn } from "@/lib/utils";
import {
  PALETTE_CHORD,
  chordFromEvent,
  rejectReason,
  formatChord,
  isTypingTarget,
  loadBindings,
  saveBindings,
  applyBinding,
  chordIndex,
  type Bindings,
} from "@/lib/commands/keybindings";

interface Command extends NavItem {
  group: string;
}

const RECENT_MAX = 6;

/** Lightweight subsequence fuzzy match with a relevance score (higher = better). */
function score(query: string, text: string): number {
  if (!query) return 0;
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const idx = t.indexOf(q);
  if (idx === 0) return 100; // prefix
  if (idx > 0) return 60 - idx; // substring, earlier is better
  // subsequence fallback
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) if (t[i] === q[qi]) qi++;
  return qi === q.length ? 20 : -1;
}

export function CommandPalette() {
  const router = useRouter();
  const pathname = usePathname();
  const { can, currentUserId } = useAccess();
  const { openInSplit } = useSplit();

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const [bindings, setBindings] = React.useState<Bindings>({});
  const [recent, setRecent] = React.useState<string[]>([]);
  /** commandKey currently capturing a new chord, or null. */
  const [capturing, setCapturing] = React.useState<string | null>(null);
  const [captureError, setCaptureError] = React.useState<string | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLDivElement>(null);

  // All reachable commands: quick create-actions + gated nav (RBAC-filtered) +
  // always-present chrome.
  const commands = React.useMemo<Command[]>(() => {
    const actions = COMMAND_ACTIONS.map((i) => ({ ...i, group: "Create" }));
    const gated = NAV_GROUPS.flatMap((g) =>
      g.items.filter((i) => can(i.key)).map((i) => ({ ...i, group: g.label })),
    );
    const chrome = SECONDARY_NAV.map((i) => ({ ...i, group: "Settings" }));
    return [...actions, ...gated, ...chrome];
  }, [can]);

  const byKey = React.useMemo(() => {
    const m: Record<string, Command> = {};
    for (const c of commands) m[c.key] = c;
    return m;
  }, [commands]);

  // Per-user persisted state, (re)loaded when the acting user changes.
  React.useEffect(() => {
    setBindings(loadBindings(currentUserId));
    try {
      const raw = localStorage.getItem(`nexa-cmd-recent:${currentUserId}`);
      setRecent(raw ? (JSON.parse(raw) as string[]) : []);
    } catch {
      setRecent([]);
    }
  }, [currentUserId]);

  const recentChordIndex = React.useMemo(() => chordIndex(bindings), [bindings]);

  // Filtered + ranked results. Empty query => recents first, then everything.
  const results = React.useMemo<Command[]>(() => {
    if (!query.trim()) {
      const recents = recent.map((k) => byKey[k]).filter(Boolean);
      const rest = commands.filter((c) => !recent.includes(c.key));
      return [...recents, ...rest];
    }
    return commands
      .map((c) => ({ c, s: Math.max(score(query, c.label), score(query, c.group) - 30) }))
      .filter((x) => x.s > -1)
      .sort((a, b) => b.s - a.s)
      .map((x) => x.c);
  }, [query, commands, recent, byKey]);

  const showingRecents = !query.trim() && recent.length > 0;

  React.useEffect(() => setActive(0), [query]);

  const close = React.useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
    setCapturing(null);
    setCaptureError(null);
  }, []);

  const go = React.useCallback(
    (cmd: Command | undefined, split = false) => {
      if (!cmd) return;
      // Bump into recents (most-recent first, de-duped, capped).
      setRecent((prev) => {
        const next = [cmd.key, ...prev.filter((k) => k !== cmd.key)].slice(0, RECENT_MAX);
        saveRecent(currentUserId, next);
        return next;
      });
      close();
      if (split) {
        openInSplit(cmd.href, pathname);
        return;
      }
      router.push(cmd.href);
      // A "New …" action targeting the route you're already on won't remount the
      // page, so router.push alone won't open the form — nudge the mounted page.
      const qi = cmd.href.indexOf("?");
      const targetPath = qi === -1 ? cmd.href : cmd.href.slice(0, qi);
      if (qi !== -1 && cmd.href.includes("new=1") && pathname === targetPath) {
        window.dispatchEvent(new CustomEvent(NEW_INTENT_EVENT));
      }
    },
    [router, close, currentUserId, openInSplit, pathname],
  );

  const persistBindings = React.useCallback(
    (next: Bindings) => {
      setBindings(next);
      saveBindings(currentUserId, next);
    },
    [currentUserId],
  );

  // Global listener: opens the palette (Mod+K) and dispatches custom chords when
  // the palette is closed and the user isn't typing in a field.
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const chord = chordFromEvent(e);
      if (chord === PALETTE_CHORD) {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (open || !chord || isTypingTarget(e.target)) return;
      const cmdKey = recentChordIndex[chord];
      if (cmdKey && byKey[cmdKey]) {
        e.preventDefault();
        go(byKey[cmdKey]);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("nexa:open-command-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("nexa:open-command-palette", onOpen);
    };
  }, [open, recentChordIndex, byKey, go]);

  // Focus the field whenever the palette opens.
  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the active row in view as the user arrows through results.
  React.useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const onInputKeyDown = (e: React.KeyboardEvent) => {
    // Capture mode: the next chord becomes the binding for `capturing`.
    if (capturing) {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setCapturing(null);
        setCaptureError(null);
        return;
      }
      const chord = chordFromEvent(e.nativeEvent);
      if (!chord) return; // lone modifier — keep waiting
      const reason = rejectReason(chord);
      if (reason) {
        setCaptureError(reason);
        return;
      }
      persistBindings(applyBinding(bindings, capturing, chord));
      setCapturing(null);
      setCaptureError(null);
      return;
    }

    if (e.key === "Escape") {
      close();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[active], e.ctrlKey || e.metaKey);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto p-4 pt-[12vh]">
      <div className="fixed inset-0 bg-foreground/40 backdrop-blur-[2px]" onClick={close} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="relative z-10 w-full max-w-xl overflow-hidden rounded-xl border bg-card text-card-foreground shadow-xl animate-fade-in"
      >
        {/* Search field */}
        <div className="flex items-center gap-2.5 border-b px-3.5">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onInputKeyDown}
            placeholder={capturing ? "Press a shortcut… (Esc to cancel)" : "Search pages…"}
            className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          <kbd className="hidden shrink-0 rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:block">
            {formatChord(PALETTE_CHORD)}
          </kbd>
        </div>

        {captureError && (
          <div className="border-b bg-destructive/10 px-3.5 py-1.5 text-xs text-destructive">{captureError}</div>
        )}

        {/* Results */}
        <div ref={listRef} className="max-h-[52vh] overflow-y-auto scrollbar-thin py-1.5">
          {showingRecents && (
            <div className="px-3.5 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
              Recent
            </div>
          )}
          {results.length === 0 && (
            <div className="px-3.5 py-8 text-center text-sm text-muted-foreground">No matches for “{query}”.</div>
          )}
          {results.map((cmd, i) => {
            const isActive = i === active;
            const chord = bindings[cmd.key];
            const isCapturing = capturing === cmd.key;
            const isCurrent = pathname === cmd.href;
            return (
              <div
                key={cmd.key}
                data-idx={i}
                onMouseEnter={() => setActive(i)}
                onClick={(e) => go(cmd, e.ctrlKey || e.metaKey)}
                className={cn(
                  "mx-1.5 flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm",
                  isActive ? "bg-accent text-foreground" : "text-muted-foreground",
                )}
              >
                <cmd.icon className="size-[18px] shrink-0" />
                <span className="flex-1 truncate text-foreground">
                  {cmd.label}
                  {isCurrent && <span className="ml-2 text-[10px] text-muted-foreground">current</span>}
                </span>
                <span className="shrink-0 text-[11px] text-muted-foreground/70">{cmd.group}</span>

                {/* Shortcut chip + assign affordance */}
                {isCapturing ? (
                  <span className="shrink-0 rounded border border-primary bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                    Press keys…
                  </span>
                ) : chord ? (
                  <span className="flex shrink-0 items-center gap-1">
                    <kbd className="rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
                      {formatChord(chord)}
                    </kbd>
                    <button
                      title="Remove shortcut"
                      onClick={(ev) => {
                        ev.stopPropagation();
                        persistBindings(applyBinding(bindings, cmd.key, null));
                      }}
                      className="rounded p-0.5 text-muted-foreground hover:bg-background hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  </span>
                ) : (
                  <button
                    title="Assign a shortcut"
                    onClick={(ev) => {
                      ev.stopPropagation();
                      setCaptureError(null);
                      setCapturing(cmd.key);
                      inputRef.current?.focus();
                    }}
                    className={cn(
                      "shrink-0 rounded p-1 text-muted-foreground hover:bg-background hover:text-foreground",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  >
                    <Keyboard className="size-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer hint */}
        <div className="flex items-center gap-4 border-t px-3.5 py-2 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <CornerDownLeft className="size-3" /> open
          </span>
          <span>↑↓ navigate</span>
          <span>{formatChord("Mod+Enter")} split</span>
          <span className="flex items-center gap-1">
            <Keyboard className="size-3" /> assign shortcut
          </span>
        </div>
      </div>
    </div>
  );
}

function saveRecent(userId: string, list: string[]) {
  try {
    localStorage.setItem(`nexa-cmd-recent:${userId}`, JSON.stringify(list));
  } catch {}
}
