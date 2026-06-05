"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Uncontrolled expand/collapse section with a clickable header row. Used for
 * grouping and progressive-disclosure across list and report pages.
 */
export function Collapsible({
  header,
  children,
  defaultOpen = false,
  className,
  headerClassName,
}: {
  header: React.ReactNode;
  children: React.ReactNode;
  defaultOpen?: boolean;
  className?: string;
  headerClassName?: string;
}) {
  const [open, setOpen] = React.useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2 text-left transition-colors",
          headerClassName,
        )}
        aria-expanded={open}
      >
        <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <span className="min-w-0 flex-1">{header}</span>
      </button>
      {open && <div>{children}</div>}
    </div>
  );
}

/** Small inline chevron toggle for table rows that expand a detail panel. */
export function ExpandChevron({ open }: { open: boolean }) {
  return (
    <ChevronRight
      className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")}
    />
  );
}
