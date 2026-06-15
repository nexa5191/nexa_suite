"use client";

import { ContextBar } from "./context-bar";
import { ThemePopover } from "@/components/theme/theme-popover";
import { MimicSwitcher } from "@/components/access/mimic-switcher";
import { ApprovalsBell } from "./approvals-bell";
import { MobileNav } from "./mobile-nav";
import { SplitToggle } from "./split/split-toggle";
import { CommandSearch } from "./command-search";

export function Topbar() {
  return (
    <header data-chrome className="sticky top-0 z-20 border-b bg-background/85 backdrop-blur">
      <div className="flex h-14 items-center gap-3 px-4">
        <MobileNav />
        <ContextBar className="hidden flex-1 lg:flex" />
        <div className="flex flex-1 items-center justify-end gap-2 lg:flex-none">
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
