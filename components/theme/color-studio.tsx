"use client";

import { Moon, Sun, Monitor, RotateCcw } from "lucide-react";
import { useTheme } from "./theme-provider";
import { PRESETS, RADIUS_OPTIONS, ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

export function ColorStudio({ compact = false }: { compact?: boolean }) {
  const { theme, setTheme, resetTheme } = useTheme();

  return (
    <div className="space-y-5">
      {/* Mode */}
      <div className="space-y-2">
        <Heading>Appearance</Heading>
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              { v: "light", label: "Light", icon: Sun },
              { v: "dark", label: "Dark", icon: Moon },
              { v: "system", label: "System", icon: Monitor },
            ] as { v: ThemeMode; label: string; icon: typeof Sun }[]
          ).map((m) => (
            <button
              key={m.v}
              onClick={() => setTheme({ mode: m.v })}
              className={cn(
                "flex flex-col items-center gap-1 rounded-md border py-2.5 text-xs font-medium transition-colors",
                theme.mode === m.v
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input text-muted-foreground hover:bg-accent",
              )}
            >
              <m.icon className="size-4" />
              {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Presets */}
      <div className="space-y-2">
        <Heading>Accent colour</Heading>
        <div className="grid grid-cols-5 gap-2">
          {PRESETS.map((p) => {
            const active = theme.hue === p.hue && theme.saturation === p.saturation;
            return (
              <button
                key={p.name}
                title={p.name}
                onClick={() => setTheme({ hue: p.hue, saturation: p.saturation, lightness: p.lightness })}
                className={cn(
                  "h-8 rounded-md ring-offset-2 ring-offset-card transition-all",
                  active && "ring-2 ring-foreground",
                )}
                style={{ background: `hsl(${p.hue} ${p.saturation}% ${p.lightness}%)` }}
              />
            );
          })}
        </div>
      </div>

      {/* Fine tune */}
      <div className="space-y-3">
        <Slider
          label="Hue"
          value={theme.hue}
          min={0}
          max={360}
          onChange={(v) => setTheme({ hue: v })}
          trackStyle={{
            background:
              "linear-gradient(to right, hsl(0 80% 55%), hsl(60 80% 55%), hsl(120 80% 55%), hsl(180 80% 55%), hsl(240 80% 55%), hsl(300 80% 55%), hsl(360 80% 55%))",
          }}
        />
        <Slider
          label="Saturation"
          value={theme.saturation}
          min={0}
          max={100}
          suffix="%"
          onChange={(v) => setTheme({ saturation: v })}
          trackStyle={{
            background: `linear-gradient(to right, hsl(${theme.hue} 0% 55%), hsl(${theme.hue} 100% 55%))`,
          }}
        />
        <Slider
          label="Lightness"
          value={theme.lightness}
          min={20}
          max={80}
          suffix="%"
          onChange={(v) => setTheme({ lightness: v })}
          trackStyle={{
            background: `linear-gradient(to right, hsl(${theme.hue} ${theme.saturation}% 25%), hsl(${theme.hue} ${theme.saturation}% 75%))`,
          }}
        />
      </div>

      {/* Radius */}
      <div className="space-y-2">
        <Heading>Corner radius</Heading>
        <div className="flex gap-2">
          {RADIUS_OPTIONS.map((r) => (
            <button
              key={r}
              onClick={() => setTheme({ radius: r })}
              className={cn(
                "flex-1 rounded-md border py-2 text-xs font-medium transition-colors",
                theme.radius === r
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-input text-muted-foreground hover:bg-accent",
              )}
            >
              {(r / 100).toFixed(2)}
            </button>
          ))}
        </div>
      </div>

      {!compact && (
        <button
          onClick={resetTheme}
          className="flex items-center gap-2 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="size-3.5" /> Reset to defaults
        </button>
      )}
    </div>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold text-foreground">{children}</p>;
}

function Slider({
  label,
  value,
  min,
  max,
  onChange,
  trackStyle,
  suffix = "",
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
  trackStyle?: React.CSSProperties;
  suffix?: string;
}) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="tabular text-xs font-semibold">{value}{suffix}</span>
      </div>
      <div className="relative h-4 rounded-full" style={trackStyle}>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="nexa-range absolute inset-0 h-4 w-full cursor-pointer appearance-none bg-transparent"
        />
      </div>
    </div>
  );
}
