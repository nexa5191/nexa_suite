"use client";

import { Check } from "lucide-react";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { APP_FONTS } from "@/lib/fonts";
import { cn } from "@/lib/utils";

export function FontSetting() {
  const { fontId, setFont } = usePrefs();
  const categories = Array.from(new Set(APP_FONTS.map((f) => f.category)));

  return (
    <div className="space-y-4">
      {categories.map((cat) => (
        <div key={cat}>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{cat}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {APP_FONTS.filter((f) => f.category === cat).map((f) => {
              const active = fontId === f.id;
              return (
                <button
                  key={f.id}
                  onClick={() => setFont(f.id)}
                  style={{ fontFamily: f.cssVar }}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-3 py-2.5 text-left transition-colors",
                    active ? "border-primary bg-primary/5" : "border-input hover:bg-accent",
                  )}
                >
                  <span>
                    <span className="block text-sm font-semibold">{f.label}</span>
                    <span className="block text-xs text-muted-foreground">{f.preview}</span>
                  </span>
                  {active && <Check className="size-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
