"use client";

import { CalendarRange } from "lucide-react";
import { Select, Input } from "@/components/ui/input";
import type { ReportController } from "./use-report";
import { cn } from "@/lib/utils";

// Period picker — preset chips plus a custom range. The global scope (entity /
// location / state / basis / currency) lives in the topbar, so this stays lean.
export function ReportControls({
  ctl,
  asOf = false,
}: {
  ctl: ReportController;
  asOf?: boolean;
}) {
  const isCustom = ctl.custom !== null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-sm">
      <div className="flex items-center gap-1.5 pl-1 pr-1 text-muted-foreground">
        <CalendarRange className="size-4" />
        <span className="text-xs font-medium">{asOf ? "As at" : "Period"}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {ctl.presets.map((p) => (
          <button
            key={p.id}
            onClick={() => ctl.setPeriodId(p.id)}
            className={cn(
              "rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
              !isCustom && ctl.periodId === p.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {asOf ? p.label.replace("This ", "").replace("Last ", "Prev ") : p.label}
          </button>
        ))}
      </div>
      <div className="ml-auto flex items-center gap-1.5">
        {!asOf && (
          <Input
            type="date"
            value={ctl.period.from}
            onChange={(e) => ctl.setCustom({ from: e.target.value, to: ctl.period.to })}
            className={cn("h-8 w-[140px] text-xs", isCustom && "ring-1 ring-primary")}
          />
        )}
        <span className="text-xs text-muted-foreground">{asOf ? "" : "to"}</span>
        <Input
          type="date"
          value={ctl.period.to}
          onChange={(e) =>
            ctl.setCustom({ from: asOf ? ctl.period.from : ctl.period.from, to: e.target.value })
          }
          className={cn("h-8 w-[140px] text-xs", isCustom && "ring-1 ring-primary")}
        />
      </div>
    </div>
  );
}
