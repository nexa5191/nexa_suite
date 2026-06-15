"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { useSplit } from "./split-provider";

/**
 * App-wide "Ctrl/Cmd + click to open in split". A single capture-phase listener
 * intercepts modifier-clicks on any internal link (sidebar nav, list rows that
 * link to a detail page, etc.) and loads it into the split workspace instead of
 * navigating — a plain click still navigates normally.
 *
 * Mounted once in the shell. Disabled inside split panes (which are iframes of
 * the same app) so a click there behaves normally within that pane.
 */
export function SplitClickCatcher() {
  const { openInSplit } = useSplit();
  const pathname = usePathname();

  React.useEffect(() => {
    if (window.self !== window.top) return; // inside a split pane → leave clicks alone

    const onClick = (e: MouseEvent) => {
      // Left button, exactly Ctrl/Cmd (not with Alt/Shift, which mean other things).
      if (e.button !== 0 || !(e.ctrlKey || e.metaKey) || e.altKey || e.shiftKey) return;
      const el = e.target as HTMLElement | null;
      // Prefer an explicit row opt-in (data-split-href) so non-link rows work too;
      // otherwise fall back to any internal anchor.
      const tagged = el?.closest?.("[data-split-href]") as HTMLElement | null;
      const anchor = el?.closest?.("a[href]") as HTMLAnchorElement | null;
      let href = tagged?.getAttribute("data-split-href") || "";
      if (!href && anchor && anchor.target !== "_blank") href = anchor.getAttribute("href") || "";
      if (!href.startsWith("/") || href.startsWith("//")) return; // internal only
      e.preventDefault();
      e.stopPropagation();
      openInSplit(href, pathname);
    };

    // Capture phase so we beat Next.js's <Link> onClick and the browser's
    // default "open in new tab".
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [openInSplit, pathname]);

  return null;
}
