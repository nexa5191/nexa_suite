"use client";

import { usePrefs, NavLayout } from "@/components/prefs/prefs-provider";
import { cn } from "@/lib/utils";

const OPTIONS: { value: NavLayout; label: string; hint: string }[] = [
  { value: "left", label: "Left sidebar", hint: "Classic vertical nav" },
  { value: "top", label: "Top ribbon", hint: "Horizontal nav bar" },
  { value: "right", label: "Right sidebar", hint: "Vertical nav, right side" },
];

export function NavLayoutSetting() {
  const { nav, setNav } = usePrefs();
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {OPTIONS.map((o) => {
        const active = nav === o.value;
        return (
          <button
            key={o.value}
            onClick={() => setNav(o.value)}
            className={cn(
              "rounded-lg border p-3 text-left transition-colors",
              active ? "border-primary bg-primary/5" : "border-input hover:bg-accent",
            )}
          >
            <Preview layout={o.value} active={active} />
            <p className="mt-2 text-sm font-semibold">{o.label}</p>
            <p className="text-xs text-muted-foreground">{o.hint}</p>
          </button>
        );
      })}
    </div>
  );
}

function Preview({ layout, active }: { layout: NavLayout; active: boolean }) {
  const bar = active ? "bg-primary" : "bg-muted-foreground/30";
  const panel = "bg-muted";
  return (
    <div className="flex h-16 gap-1 overflow-hidden rounded border bg-card p-1">
      {layout === "left" && <div className={cn("w-1/4 rounded-sm", bar)} />}
      <div className="flex flex-1 flex-col gap-1">
        {layout === "top" && <div className={cn("h-1/4 rounded-sm", bar)} />}
        <div className={cn("flex-1 rounded-sm", panel)} />
      </div>
      {layout === "right" && <div className={cn("w-1/4 rounded-sm", bar)} />}
    </div>
  );
}
