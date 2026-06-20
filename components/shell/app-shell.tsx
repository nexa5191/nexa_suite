"use client";

import { usePrefs } from "@/components/prefs/prefs-provider";
import { Sidebar } from "./sidebar";
import { Ribbon } from "./ribbon";
import { Topbar } from "./topbar";
import { MimicBanner } from "@/components/access/mimic-banner";
import { ModuleGuard } from "@/components/access/module-guard";
import { SplitView } from "./split/split-view";
import { SplitClickCatcher } from "./split/split-click";
import { CommandPalette } from "./command-palette";
import { CopilotPanel } from "@/components/copilot/copilot-panel";

export function AppShell({ children }: { children: React.ReactNode }) {
  const { nav } = usePrefs();
  const guarded = <ModuleGuard>{children}</ModuleGuard>;

  if (nav === "top") {
    return (
      <div className="min-h-screen">
        <MimicBanner />
        <Ribbon />
        <Topbar />
        <main className="mx-auto w-full max-w-[1400px] px-4 py-6">{guarded}</main>
        <SplitView />
        <SplitClickCatcher />
        <CommandPalette />
        <CopilotPanel />
      </div>
    );
  }

  // left or right sidebar
  return (
    <div className="flex min-h-screen flex-col">
      <MimicBanner />
      <div className="flex min-h-0 flex-1">
        {nav === "left" && <Sidebar side="left" />}
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar />
          <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">{guarded}</main>
        </div>
        {nav === "right" && <Sidebar side="right" />}
      </div>
      <SplitView />
      <SplitClickCatcher />
      <CommandPalette />
      <CopilotPanel />
    </div>
  );
}
