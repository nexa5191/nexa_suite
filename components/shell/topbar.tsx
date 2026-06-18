"use client";

import { Sparkles } from "lucide-react";
import { ContextBar } from "./context-bar";
import { ThemePopover } from "@/components/theme/theme-popover";
import { MimicSwitcher } from "@/components/access/mimic-switcher";
import { ApprovalsBell } from "./approvals-bell";
import { MobileNav } from "./mobile-nav";
import { SplitToggle } from "./split/split-toggle";
import { CommandSearch } from "./command-search";
import { OPEN_COPILOT_EVENT } from "@/components/copilot/copilot-panel";

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
