"use client";

import * as React from "react";
import { Building2, MapPin, Map as MapIcon, Layers, ChevronDown, ChevronRight } from "lucide-react";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { Select } from "@/components/ui/input";
import { CURRENCIES } from "@/lib/currency";
import { ALL, loadEntities, loadLocations } from "@/lib/accounting/org";
import type { Entity, Location } from "@/lib/accounting/types";
import { cn } from "@/lib/utils";

// The accounting "scope" bar — entity / location / state / basis / currency.
export function ContextBar({ className }: { className?: string }) {
  const p = usePrefs();
  // Load org data after mount so SSR and client initial renders both start
  // with [] — avoiding the hydration mismatch from module-level localStorage reads.
  const [entities, setEntities] = React.useState<Entity[]>([]);
  const [allLocations, setAllLocations] = React.useState<Location[]>([]);
  React.useEffect(() => {
    const ents = loadEntities();
    const locs = loadLocations();
    setEntities(ents);
    setAllLocations(locs);
  }, []);

  const locations = React.useMemo(() => {
    if (p.entityId === ALL) return allLocations;
    const children = entities.filter((e) => e.parentId === p.entityId).map((e) => e.id);
    const ids = new Set(children.length > 0 ? [p.entityId, ...children] : [p.entityId]);
    return allLocations.filter((l) => ids.has(l.entityId));
  }, [p.entityId, entities, allLocations]);

  const states = React.useMemo(
    () => Array.from(new Set(locations.map((l) => l.state))),
    [locations],
  );

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <EntityPicker value={p.entityId} onChange={p.setEntity} entities={entities} />

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

      {/* Basis toggle */}
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

// ── Hierarchical entity picker ─────────────────────────────────────────────────
function EntityPicker({ value, onChange, entities }: { value: string; onChange: (id: string) => void; entities: Entity[] }) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set(["ent-nexa-in"]));
  const ref = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus search input when dropdown opens
  React.useEffect(() => {
    if (open) { setQuery(""); setTimeout(() => inputRef.current?.focus(), 0); }
  }, [open]);

  const current = value === ALL ? null : entities.find((e) => e.id === value);
  const currentLabel = value === ALL ? "All entities" : current?.name ?? "All entities";
  const isGroup = current ? entities.some((e) => e.parentId === current.id) : false;

  const select = (id: string) => { onChange(id); setOpen(false); };

  const toggleGroup = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const q = query.toLowerCase().trim();
  const topLevel = entities.filter((e) => !e.parentId);

  // When searching: flatten all entities and filter by name; highlight matches
  const isSearching = q.length > 0;
  const matchAll = isSearching
    ? entities.filter((e) => e.name.toLowerCase().includes(q))
    : [];

  // Auto-expand parent groups whose children match the search
  const matchParents = new Set(matchAll.filter((e) => e.parentId).map((e) => e.parentId!));

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card pl-2 pr-1.5 shadow-sm text-sm hover:bg-accent/50 transition-colors"
      >
        <Building2 className="size-3.5 text-muted-foreground shrink-0" />
        <span className="max-w-[140px] truncate text-sm">
          {currentLabel}
          {isGroup && <span className="ml-1 text-[10px] text-muted-foreground font-normal">group</span>}
        </span>
        <ChevronDown className="size-3 text-muted-foreground ml-0.5" />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 min-w-[220px] rounded-lg border bg-card shadow-xl text-sm">
          {/* Search input */}
          <div className="flex items-center gap-1.5 border-b px-2.5 py-2">
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
              placeholder="Search entities…"
              className="h-6 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            />
            {query && (
              <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                <span className="text-[10px]">✕</span>
              </button>
            )}
          </div>

          <div className="max-h-64 overflow-y-auto py-1">
            {/* ── Search results (flat) ── */}
            {isSearching ? (
              <>
                {"all entities".includes(q) && (
                  <PickerRow label="All entities" selected={value === ALL} onClick={() => select(ALL)} />
                )}
                {matchAll.length === 0 && !"all entities".includes(q) && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matches</p>
                )}
                {matchAll.map((ent) => {
                  const parent = ent.parentId ? entities.find((e) => e.id === ent.parentId) : null;
                  const hasKids = entities.some((e) => e.parentId === ent.id);
                  return (
                    <PickerRow
                      key={ent.id}
                      label={ent.name}
                      sublabel={parent ? parent.name : hasKids ? "rollup" : ent.country !== "India" ? ent.country : undefined}
                      selected={value === ent.id}
                      onClick={() => select(ent.id)}
                      highlight={q}
                    />
                  );
                })}
              </>
            ) : (
              /* ── Tree view (no query) ── */
              <>
                <PickerRow label="All entities" selected={value === ALL} onClick={() => select(ALL)} />
                <div className="my-1 mx-2 border-t" />

                {topLevel.map((ent) => {
                  const hasChildren = entities.some((e) => e.parentId === ent.id);
                  const expanded = expandedGroups.has(ent.id) || matchParents.has(ent.id);
                  return (
                    <React.Fragment key={ent.id}>
                      <div className="flex items-center gap-0.5 px-1">
                        {hasChildren ? (
                          <button
                            onClick={(e) => toggleGroup(ent.id, e)}
                            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent/60"
                          >
                            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
                          </button>
                        ) : (
                          <span className="size-5 shrink-0" />
                        )}
                        <PickerRow
                          label={ent.name}
                          sublabel={hasChildren ? "rollup" : ent.country !== "India" ? ent.country : undefined}
                          selected={value === ent.id}
                          onClick={() => select(ent.id)}
                          className="flex-1"
                        />
                      </div>

                      {hasChildren && expanded && (
                        <div className="ml-6">
                          {entities.filter((e) => e.parentId === ent.id).map((child) => (
                            <PickerRow
                              key={child.id}
                              label={child.name}
                              indent
                              selected={value === child.id}
                              onClick={() => select(child.id)}
                            />
                          ))}
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function PickerRow({
  label, sublabel, selected, onClick, indent, className, highlight,
}: {
  label: string; sublabel?: string; selected: boolean;
  onClick: () => void; indent?: boolean; className?: string; highlight?: string;
}) {
  const labelNode = highlight
    ? highlightMatch(label, highlight)
    : <span className="flex-1 truncate">{label}</span>;

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors",
        selected ? "bg-primary/10 text-primary font-medium" : "text-foreground hover:bg-accent/50",
        indent && "pl-3",
        className,
      )}
    >
      {indent && <span className="text-muted-foreground/50 shrink-0">└</span>}
      {labelNode}
      {sublabel && (
        <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-medium text-muted-foreground uppercase tracking-wide">
          {sublabel}
        </span>
      )}
      {selected && <span className="shrink-0 text-[9px] text-primary">✓</span>}
    </button>
  );
}

function highlightMatch(text: string, q: string) {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <span className="flex-1 truncate">{text}</span>;
  return (
    <span className="flex-1 truncate">
      {text.slice(0, idx)}
      <mark className="bg-primary/20 text-primary rounded-sm px-0.5 font-semibold">{text.slice(idx, idx + q.length)}</mark>
      {text.slice(idx + q.length)}
    </span>
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
