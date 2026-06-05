"use client";

import { useEffect, useRef, useState } from "react";
import { Palette } from "lucide-react";
import { ColorStudio } from "./color-studio";

export function ThemePopover() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="grid size-9 place-items-center rounded-md border bg-card transition-colors hover:bg-accent"
        aria-label="Theme"
        title="Customise theme"
      >
        <Palette className="size-[18px]" />
      </button>
      {open && (
        <div className="absolute right-0 top-11 z-50 w-80 animate-fade-in rounded-lg border bg-popover p-4 shadow-xl">
          <p className="mb-3 text-sm font-semibold">Theme studio</p>
          <ColorStudio compact />
        </div>
      )}
    </div>
  );
}
