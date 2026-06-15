"use client";

import { Search } from "lucide-react";
import { formatChord, PALETTE_CHORD } from "@/lib/commands/keybindings";

/** Topbar affordance that opens the command palette — makes Mod+K discoverable. */
export function CommandSearch() {
  const open = () => window.dispatchEvent(new Event("nexa:open-command-palette"));
  return (
    <button
      onClick={open}
      aria-label="Search pages"
      className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-sm text-muted-foreground shadow-sm transition-colors hover:bg-accent hover:text-foreground"
    >
      <Search className="size-4" />
      <span className="hidden lg:inline">Search…</span>
      <kbd className="hidden rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium lg:inline">
        {formatChord(PALETTE_CHORD)}
      </kbd>
    </button>
  );
}
