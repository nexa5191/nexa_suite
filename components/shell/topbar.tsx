"use client";

import { useEffect, useState } from "react";
import { Sparkles, Pin, PinOff } from "lucide-react";
import { usePathname } from "next/navigation";
import { ContextBar } from "./context-bar";
import { ThemePopover } from "@/components/theme/theme-popover";
import { MimicSwitcher } from "@/components/access/mimic-switcher";
import { ApprovalsBell } from "./approvals-bell";
import { MobileNav } from "./mobile-nav";
import { SplitToggle } from "./split/split-toggle";
import { CommandSearch } from "./command-search";
import { OPEN_COPILOT_EVENT } from "@/components/copilot/copilot-panel";
import { useAccess } from "@/components/access/access-provider";
import { loadBookmarks, toggleBookmark } from "@/lib/bookmarks";
import { FLAT_NAV } from "./nav-items";
import { cn } from "@/lib/utils";

function BookmarkButton() {
  const pathname = usePathname();
  const { currentUserId } = useAccess();
  const [pinned, setPinned] = useState(false);

  useEffect(() => {
    setPinned(loadBookmarks(currentUserId).some((b) => b.path === pathname));
  }, [pathname, currentUserId]);

  useEffect(() => {
    const onChanged = () => setPinned(loadBookmarks(currentUserId).some((b) => b.path === pathname));
    window.addEventListener("nexa:bookmark-changed", onChanged);
    return () => window.removeEventListener("nexa:bookmark-changed", onChanged);
  }, [pathname, currentUserId]);

  const toggle = () => {
    // Find the best label for this path
    const exact = FLAT_NAV.find((i) => i.href === pathname);
    const prefix = [...FLAT_NAV]
      .filter((i) => i.href !== "/" && pathname.startsWith(i.href))
      .sort((a, b) => b.href.length - a.href.length)[0];
    const navItem = exact ?? prefix;
    const label =
      navItem?.label ??
      pathname
        .split("/")
        .filter(Boolean)
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " "))
        .join(" › ");

    toggleBookmark(currentUserId, pathname, label);
    setPinned((p) => !p);
    window.dispatchEvent(new CustomEvent("nexa:bookmark-changed"));
  };

  return (
    <button
      onClick={toggle}
      title={pinned ? "Remove pin" : "Pin this page"}
      className={cn(
        "rounded-md p-1.5 transition-colors hover:bg-accent",
        pinned ? "text-primary" : "text-muted-foreground",
      )}
    >
      {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
    </button>
  );
}

function CopilotButton() {
  return (
    <button
      onClick={() => window.dispatchEvent(new CustomEvent(OPEN_COPILOT_EVENT))}
      title="Ask NEXA Copilot (Ctrl/⌘ J)"
      className="flex h-8 items-center gap-1.5 rounded-md border border-primary/30 bg-primary/5 px-2.5 text-xs font-medium text-primary transition-colors hover:bg-primary/10"
    >
      <Sparkles className="size-3.5" />
      <span className="hidden sm:inline">Ask AI</span>
    </button>
  );
}

export function Topbar() {
  return (
    <header data-chrome className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4">
        <MobileNav />
        <ContextBar className="hidden flex-1 lg:flex" />
        <div className="flex flex-1 items-center justify-end gap-2 lg:flex-none">
          <BookmarkButton />
          <CopilotButton />
          <CommandSearch />
          <MimicSwitcher />
          <SplitToggle />
          <ApprovalsBell />
          <ThemePopover />
        </div>
      </div>
      {/* On small screens the scope bar wraps below */}
      <div className="border-t px-4 py-2 lg:hidden">
        <ContextBar />
      </div>
    </header>
  );
}
