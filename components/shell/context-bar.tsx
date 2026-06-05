"use client";

import { Building2, MapPin, Map as MapIcon, Layers } from "lucide-react";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Select } from "@/components/ui/input";
import { CURRENCIES } from "@/lib/currency";
import { ENTITIES, ALL, locationsForEntity, statesForEntity } from "@/lib/accounting/org";
import { cn } from "@/lib/utils";

// The accounting "scope" bar — entity / location / state / basis / currency.
// These drive every report consistently, so they live in the chrome.
export function ContextBar({ className }: { className?: string }) {
  const p = usePrefs();
  const locations = locationsForEntity(p.entityId);
  const states = statesForEntity(p.entityId);

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Field icon={<Building2 className="size-3.5" />}>
        <Select value={p.entityId} onChange={(e) => p.setEntity(e.target.value)} className="h-8 min-w-[150px] border-0 bg-transparent pl-1 shadow-none">
          <option value={ALL}>All entities</option>
          {ENTITIES.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </Select>
      </Field>

      <Field icon={<MapPin className="size-3.5" />}>
        <Select value={p.locationId} onChange={(e) => p.setLocation(e.target.value)} className="h-8 min-w-[140px] border-0 bg-transparent pl-1 shadow-none">
          <option value={ALL}>All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>
      </Field>

      <Field icon={<MapIcon className="size-3.5" />}>
        <Select value={p.state} onChange={(e) => p.setState(e.target.value)} className="h-8 min-w-[120px] border-0 bg-transparent pl-1 shadow-none">
          <option value={ALL}>All states</option>
          {states.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </Select>
      </Field>

      {/* Basis toggle — the conceptual heart, kept as a clear segmented control */}
      <div className="inline-flex h-8 items-center rounded-md border bg-card p-0.5 shadow-sm">
        {(["accrual", "cash"] as const).map((b) => (
          <button
            key={b}
            onClick={() => p.setBasis(b)}
            className={cn(
              "h-7 rounded px-2.5 text-xs font-semibold capitalize transition-colors",
              p.basis === b ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
            )}
            title={`${b} basis of accounting`}
          >
            {b}
          </button>
        ))}
      </div>

      <Field icon={<Layers className="size-3.5" />}>
        <Select value={p.currencyCode} onChange={(e) => p.setCurrency(e.target.value)} className="h-8 min-w-[92px] border-0 bg-transparent pl-1 shadow-none">
          {CURRENCIES.map((c) => (
            <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
          ))}
        </Select>
      </Field>
    </div>
  );
}

function Field({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="inline-flex h-8 items-center rounded-md border bg-card pl-2 shadow-sm">
      <span className="text-muted-foreground">{icon}</span>
      {children}
    </div>
  );
}
