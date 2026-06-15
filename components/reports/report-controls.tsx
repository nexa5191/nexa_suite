"use client";

import { useMemo } from "react";
import { CalendarRange, Printer } from "lucide-react";
import { Select, Input } from "@/components/ui/input";
import { financialYears } from "@/lib/accounting/periods";
import type { ReportController } from "./use-report";
import { cn } from "@/lib/utils";

// Period picker — preset chips, a Custom toggle, and a financial-year dropdown.
// The global scope (entity / location / state / basis / currency) lives in the
// topbar, so this bar stays lean.
export function ReportControls({
  ctl,
  asOf = false,
}: {
  ctl: ReportController;
  asOf?: boolean;
}) {
  const isCustom = ctl.custom !== null;
  const fyears = useMemo(() => financialYears(new Date()), []);
  // Reflect the active FY in the dropdown when the custom range matches one.
  const activeFy = fyears.find((f) => isCustom && ctl.period.from === f.from && ctl.period.to === f.to)?.id ?? "";

  return (
    <div data-no-print className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-sm">
      <CalendarRange className="ml-1 size-4 shrink-0 text-muted-foreground" />

      <div className="flex flex-wrap items-center gap-1">
        {ctl.presets.map((p) => (
          <button
            key={p.id}
            onClick={() => ctl.setPeriodId(p.id)}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
              !isCustom && ctl.periodId === p.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            {asOf ? p.label.replace("This ", "").replace("Last ", "Prev ") : p.label}
          </button>
        ))}
        {/* Custom toggle — reveals the date inputs. */}
        <button
          onClick={() => ctl.setCustom(isCustom ? null : { from: ctl.period.from, to: ctl.period.to })}
          className={cn(
            "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
            isCustom ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent",
          )}
        >
          Custom
        </button>
      </div>

      {isCustom && (
        <div className="flex items-center gap-1.5">
          {!asOf && (
            <Input
              type="date"
              value={ctl.period.from}
              onChange={(e) => ctl.setCustom({ from: e.target.value, to: ctl.period.to })}
              className="h-8 w-[140px] text-xs ring-1 ring-primary"
            />
          )}
          {!asOf && <span className="text-xs text-muted-foreground">to</span>}
          <Input
            type="date"
            value={ctl.period.to}
            onChange={(e) => ctl.setCustom({ from: ctl.period.from, to: e.target.value })}
            className="h-8 w-[140px] text-xs ring-1 ring-primary"
          />
        </div>
      )}

      {/* Financial-year jump + print/PDF */}
      <div className="ml-auto flex items-center gap-1.5">
        <Select
          aria-label="Financial year"
          value={activeFy}
          onChange={(e) => {
            const fy = fyears.find((f) => f.id === e.target.value);
            if (fy) ctl.setCustom({ from: fy.from, to: fy.to });
          }}
          className="h-8 w-[150px] text-xs"
        >
          <option value="">Financial year…</option>
          {fyears.map((f) => (
            <option key={f.id} value={f.id}>
              {f.label}
            </option>
          ))}
        </Select>
        <button
          onClick={() => window.print()}
          title="Print / Save as PDF"
          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-xs font-medium shadow-sm transition-colors hover:bg-accent"
        >
          <Printer className="size-3.5" /> PDF
        </button>
      </div>
    </div>
  );
}
