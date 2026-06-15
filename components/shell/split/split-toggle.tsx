"use client";

import { Columns2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSplit } from "./split-provider";

/** Topbar button that opens/closes the split-screen multitasking workspace. */
export function SplitToggle() {
  const { open, toggle } = useSplit();
  return (
    <button
      onClick={toggle}
      className={cn(
        "grid size-9 place-items-center rounded-md border transition-colors",
        open ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-accent",
      )}
      aria-label="Split screen"
      aria-pressed={open}
      title={open ? "Exit split screen" : "Split screen — work on two modules at once. Tip: Ctrl/⌘-click any link to open it here."}
    >
      <Columns2 className="size-[18px]" />
    </button>
  );
}
