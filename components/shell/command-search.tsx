"use client";

import { Search } from "lucide-react";

/** Topbar affordance that opens the command palette — makes Ctrl/Cmd+K discoverable.
 *  Icon-only to match the other topbar controls and keep the scope bar on one line. */
export function CommandSearch() {
  const open = () => window.dispatchEvent(new Event("nexa:open-command-palette"));
  return (
    <button
      onClick={open}
      aria-label="Search pages (Ctrl/Cmd+K)"
      title="Search — Ctrl/Cmd K"
      className="inline-flex size-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      <Search className="size-4" />
    </button>
  );
}
