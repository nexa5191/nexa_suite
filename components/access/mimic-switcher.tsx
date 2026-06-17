"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Eye, Check, SlidersHorizontal, Search } from "lucide-react";
import { useAccess } from "./access-provider";
import { cn } from "@/lib/utils";

/**
 * Compact "view-as" switcher in the topbar — the strategic, always-reachable
 * entry point for swapping into another user's role. Only shown to users who
 * can manage access. Picking a teammate starts mimic mode; the amber banner
 * then offers the exit. Reuses the click-outside popover pattern.
 */
export function MimicSwitcher() {
  const { members, roles, currentUserId, canManage, isMimicking, startMimic, exitMimic } = useAccess();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  // Clear the search each time the menu closes so it opens fresh.
  useEffect(() => {
    if (!open) setQuery("");
  }, [open]);

  const roleLabel = (roleId: string) => roles.find((r) => r.id === roleId)?.label ?? "";

  // Filter by name, email or role — only meaningful while the menu is open.
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return members;
    return members.filter((m) =>
      [m.name, m.email, roleLabel(m.roleId)].some((s) => s.toLowerCase().includes(q)),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, members, roles]);

  // Hidden entirely for roles that can't manage access (and aren't mimicking).
  if (!canManage && !isMimicking) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "grid size-9 place-items-center rounded-md border bg-card transition-colors hover:bg-accent",
          isMimicking && "border-amber-500 text-amber-600",
        )}
        aria-label="View as"
        title="View as another user"
      >
        <Eye className="size-[18px]" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-64 animate-fade-in rounded-lg border bg-popover p-2 shadow-xl">
          <p className="px-2 pb-1.5 pt-1 text-xs font-semibold text-muted-foreground">View the app as</p>
          <div className="relative mb-1.5">
            <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name, email or role…"
              className="h-8 w-full rounded-md border border-input bg-card pl-7 pr-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {filtered.length === 0 && (
              <li className="px-2 py-3 text-center text-xs text-muted-foreground">No users match “{query}”.</li>
            )}
            {filtered.map((m) => {
              const acting = m.id === currentUserId;
              return (
                <li key={m.id}>
                  <button
                    onClick={() => { if (!acting) { startMimic(m.id); setOpen(false); } }}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                      acting ? "bg-primary/10 text-primary" : "hover:bg-accent",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">{m.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{roleLabel(m.roleId)}</span>
                    </span>
                    {acting && <Check className="size-4 shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="mt-1 flex items-center justify-between border-t pt-2">
            {isMimicking ? (
              <button
                onClick={() => { exitMimic(); setOpen(false); }}
                className="rounded-md px-2 py-1 text-xs font-medium text-amber-600 hover:bg-accent"
              >
                Exit mimic mode
              </button>
            ) : (
              <span className="px-2 text-xs text-muted-foreground">You’re yourself</span>
            )}
            <Link
              href="/setup"
              onClick={() => setOpen(false)}
              className="flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <SlidersHorizontal className="size-3" /> Manage
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
