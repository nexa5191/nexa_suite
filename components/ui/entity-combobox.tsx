"use client";

import * as React from "react";
import { ChevronDown, ChevronRight, Search } from "lucide-react";
import {
  ENTITIES, ALL,
  topLevelEntities, childEntities, isGroupEntity,
} from "@/lib/accounting/org";
import { cn } from "@/lib/utils";

interface EntityComboboxProps {
  value: string;
  onChange: (id: string) => void;
  /** Include an "All entities" option (useful for report filters). */
  showAll?: boolean;
  /** Restrict to India entities only (GST / petty-cash forms). */
  indiaOnly?: boolean;
  id?: string;
  className?: string;
  placeholder?: string;
}

export function EntityCombobox({
  value, onChange, showAll = false, indiaOnly = false,
  id, className, placeholder = "Select entity…",
}: EntityComboboxProps) {
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
  const ref = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  const pool = indiaOnly ? ENTITIES.filter((e) => e.country === "India") : ENTITIES;

  // Close on outside click
  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  // Focus search input on open; auto-expand parent of selected outlet
  React.useEffect(() => {
    if (!open) return;
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
    // auto-expand the parent of the currently selected entity
    const sel = pool.find((e) => e.id === value);
    if (sel?.parentId) setExpandedGroups((p) => new Set([...p, sel.parentId!]));
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = value === ALL ? null : pool.find((e) => e.id === value);
  const label = value === ALL && showAll
    ? "All entities"
    : current?.name ?? placeholder;
  const isGrouped = current ? isGroupEntity(current.id) : false;

  const select = (id: string) => { onChange(id); setOpen(false); };

  const toggleExpand = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const q = query.toLowerCase().trim();
  const isSearching = q.length > 0;

  // Flat search results across pool
  const matches = isSearching ? pool.filter((e) => e.name.toLowerCase().includes(q)) : [];

  const topLevel = topLevelEntities().filter((e) => pool.includes(e));

  return (
    <div ref={ref} className={cn("relative", className)}>
      {/* Trigger */}
      <button
        id={id}
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center justify-between gap-2 rounded-md border bg-background px-3 text-sm shadow-sm",
          "hover:bg-accent/40 focus:outline-none focus:ring-2 focus:ring-primary/40 transition-colors",
          !current && !showAll && "text-muted-foreground",
        )}
      >
        <span className="flex-1 truncate text-left">
          {label}
          {isGrouped && (
            <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">group</span>
          )}
        </span>
        <ChevronDown className="size-3.5 shrink-0 text-muted-foreground" />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1 w-full min-w-[200px] rounded-lg border bg-card shadow-xl">
          {/* Search */}
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="size-3.5 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setOpen(false)}
              placeholder="Search entities…"
              className="h-5 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/60"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >✕</button>
            )}
          </div>

          <div className="max-h-56 overflow-y-auto py-1 scrollbar-thin">
            {/* ── Search mode ── */}
            {isSearching ? (
              <>
                {showAll && "all entities".includes(q) && (
                  <Row label="All entities" selected={value === ALL} onClick={() => select(ALL)} />
                )}
                {matches.length === 0 && (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">No matches</p>
                )}
                {matches.map((ent) => {
                  const parent = ent.parentId ? pool.find((e) => e.id === ent.parentId) : null;
                  return (
                    <Row
                      key={ent.id}
                      label={ent.name}
                      sublabel={parent ? parent.name : isGroupEntity(ent.id) ? "rollup" : undefined}
                      selected={value === ent.id}
                      onClick={() => select(ent.id)}
                      highlight={q}
                    />
                  );
                })}
              </>
            ) : (
              /* ── Tree mode ── */
              <>
                {showAll && (
                  <>
                    <Row label="All entities" selected={value === ALL} onClick={() => select(ALL)} />
                    <div className="mx-2 my-1 border-t" />
                  </>
                )}
                {topLevel.map((ent) => {
                  const children = childEntities(ent.id).filter((c) => pool.includes(c));
                  const hasChildren = children.length > 0;
                  const expanded = expandedGroups.has(ent.id);
                  return (
                    <React.Fragment key={ent.id}>
                      <div className="flex items-center gap-0.5 px-1">
                        {hasChildren ? (
                          <button
                            type="button"
                            onClick={(e) => toggleExpand(ent.id, e)}
                            className="flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-accent/60"
                          >
                            {expanded
                              ? <ChevronDown className="size-3" />
                              : <ChevronRight className="size-3" />}
                          </button>
                        ) : (
                          <span className="size-5 shrink-0" />
                        )}
                        <Row
                          label={ent.name}
                          sublabel={hasChildren ? "rollup" : ent.country !== "India" ? ent.country : undefined}
                          selected={value === ent.id}
                          onClick={() => select(ent.id)}
                          className="flex-1"
                        />
                      </div>
                      {hasChildren && expanded && (
                        <div className="ml-6">
                          {children.map((child) => (
                            <Row
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

// ── internal row ──────────────────────────────────────────────────────────────
function Row({
  label, sublabel, selected, onClick, indent, className, highlight,
}: {
  label: string; sublabel?: string; selected: boolean;
  onClick: () => void; indent?: boolean; className?: string; highlight?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-1.5 rounded px-2 py-1.5 text-left text-xs transition-colors",
        selected
          ? "bg-primary/10 text-primary font-medium"
          : "text-foreground hover:bg-accent/50",
        indent && "pl-3",
        className,
      )}
    >
      {indent && <span className="shrink-0 text-muted-foreground/40">└</span>}
      <span className="flex-1 truncate">
        {highlight ? <Highlight text={label} q={highlight} /> : label}
      </span>
      {sublabel && (
        <span className="shrink-0 rounded bg-muted px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
          {sublabel}
        </span>
      )}
      {selected && <span className="shrink-0 text-[9px] text-primary">✓</span>}
    </button>
  );
}

function Highlight({ text, q }: { text: string; q: string }) {
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded-sm bg-primary/20 px-0.5 font-semibold text-primary">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}
