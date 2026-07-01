"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Undo2, X } from "lucide-react";
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
import { useJournal } from "@/components/accounting/journal-provider";
import { isTypingTarget } from "@/lib/commands/keybindings";

// ---------------------------------------------------------------------------
// Undo toast — appears after any successful post, auto-dismisses after 8s.
// Ctrl+Z triggers undo while toast is visible.
// ---------------------------------------------------------------------------
function UndoToast() {
  const { lastPosted, clearLastPosted, reverse } = useJournal();
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!lastPosted) { setVisible(false); return; }
    setVisible(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { clearLastPosted(); setVisible(false); }, 8000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [lastPosted, clearLastPosted]);

  useEffect(() => {
    if (!visible) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "z" && (e.ctrlKey || e.metaKey) && !isTypingTarget(e.target)) {
        e.preventDefault();
        handleUndo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lastPosted]);

  const handleUndo = () => {
    if (!lastPosted) return;
    reverse(lastPosted.id);
    clearLastPosted();
    setVisible(false);
  };

  if (!visible || !lastPosted) return null;

  return (
    <div
      role="status"
      className="fixed bottom-5 right-5 z-50 flex items-center gap-3 rounded-xl border bg-card px-4 py-3 shadow-xl text-sm animate-fade-in"
    >
      <CheckCircle2 className="size-4 text-success shrink-0" />
      <span>
        <span className="font-mono text-xs font-semibold">{lastPosted.voucherNo}</span> posted
      </span>
      <button
        onClick={handleUndo}
        className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium hover:bg-accent transition-colors"
      >
        <Undo2 className="size-3.5" /> Undo
        <kbd className="ml-1 rounded bg-muted px-1 py-0.5 text-[10px]">Ctrl Z</kbd>
      </button>
      <button
        onClick={() => { clearLastPosted(); setVisible(false); }}
        className="text-muted-foreground hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}


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
        <UndoToast />
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
      <UndoToast />
    </div>
  );
}
