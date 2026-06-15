"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Loader2, Maximize2, Minimize2, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAccess } from "@/components/access/access-provider";
import { NAV_GROUPS, SECONDARY_NAV, FLAT_NAV, type NavItem } from "../nav-items";
import { useSplit, type PaneId, type SplitLayout } from "./split-provider";

const ALL_ITEMS = [...FLAT_NAV, ...SECONDARY_NAV];
const itemFor = (href: string) => ALL_ITEMS.find((i) => i.href === href);
const labelFor = (href: string) => itemFor(href)?.label ?? href;
const clamp = (r: number) => Math.max(0.2, Math.min(0.8, r));

// ---- Layout model ---------------------------------------------------------
// A layout is a binary tree: each branch splits horizontally or vertically into
// two children; leaves are panes. Depth 0 uses `ratio`, depth 1 uses `ratio2`.
type PaneNode = PaneId | { dir: "h" | "v"; a: PaneNode; b: PaneNode };

const TREES: Record<SplitLayout, PaneNode> = {
  cols: { dir: "h", a: "a", b: "b" },
  "l-split": { dir: "h", a: { dir: "v", a: "a", b: "b" }, b: "c" },
  "r-split": { dir: "h", a: "a", b: { dir: "v", a: "b", b: "c" } },
  "b-span": { dir: "v", a: { dir: "h", a: "a", b: "b" }, b: "c" },
  "t-span": { dir: "v", a: "c", b: { dir: "h", a: "a", b: "b" } },
};

const VISIBLE: Record<SplitLayout, PaneId[]> = {
  cols: ["a", "b"],
  "l-split": ["a", "b", "c"],
  "r-split": ["a", "b", "c"],
  "b-span": ["a", "b", "c"],
  "t-span": ["a", "b", "c"],
};

const LAYOUTS: { id: SplitLayout; label: string }[] = [
  { id: "cols", label: "Two columns" },
  { id: "l-split", label: "Split the left side in two" },
  { id: "r-split", label: "Split the right side in two" },
  { id: "b-span", label: "Two on top, one across the bottom" },
  { id: "t-span", label: "One across the top, two below" },
];

interface MenuGroup {
  label: string;
  items: NavItem[];
}

/** Clean, searchable module picker — replaces the native <select>. */
function PaneMenu({
  href,
  onPick,
  canSee,
}: {
  href: string;
  onPick: (href: string) => void;
  canSee: (key: string) => boolean;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const current = itemFor(href);
  const Icon = current?.icon;

  const groups = useMemo<MenuGroup[]>(() => {
    const raw: MenuGroup[] = [
      ...NAV_GROUPS.map((g) => ({ label: g.label, items: g.items })),
      { label: "More", items: SECONDARY_NAV },
    ];
    const needle = q.trim().toLowerCase();
    return raw
      .map((g) => ({
        label: g.label,
        items: g.items.filter((i) => canSee(i.key) && (!needle || i.label.toLowerCase().includes(needle))),
      }))
      .filter((g) => g.items.length > 0);
  }, [q, canSee]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) {
      document.addEventListener("mousedown", onClick);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
    return () => document.removeEventListener("mousedown", onClick);
  }, [open]);

  function choose(next: string) {
    setOpen(false);
    setQ("");
    if (next !== href) onPick(next);
  }

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors",
          open ? "border-primary bg-accent/40" : "bg-background hover:bg-accent/40",
        )}
        title="Choose module"
      >
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground" />}
        <span className="min-w-0 flex-1 truncate text-left">{labelFor(href)}</span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-50 w-72 max-w-[calc(100vw-1rem)] animate-fade-in overflow-hidden rounded-lg border bg-popover shadow-xl">
          <div className="flex items-center gap-2 border-b px-2.5 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  e.stopPropagation();
                  setOpen(false);
                }
              }}
              placeholder="Search modules…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>

          <div className="max-h-[min(60vh,22rem)] overflow-y-auto py-1">
            {groups.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No modules match.</p>
            ) : (
              groups.map((g) => (
                <div key={g.label} className="mb-0.5">
                  <p className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {g.label}
                  </p>
                  {g.items.map((i) => {
                    const active = i.href === href;
                    return (
                      <button
                        key={i.href}
                        onClick={() => choose(i.href)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors",
                          active ? "bg-primary/10 font-medium text-primary" : "hover:bg-accent",
                        )}
                      >
                        <i.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-muted-foreground")} />
                        <span className="truncate">{i.label}</span>
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** A single pane: module picker header + the module rendered in an iframe. */
function Pane({
  id,
  href,
  maximized,
  onMaximize,
  onClose,
  canSee,
}: {
  id: PaneId;
  href: string;
  maximized: boolean;
  onMaximize: () => void;
  onClose: () => void;
  canSee: (key: string) => boolean;
}) {
  const { setPane } = useSplit();
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    // Safety net: never let the spinner stick if `load` is missed.
    const t = setTimeout(() => setLoading(false), 6000);
    return () => clearTimeout(t);
  }, [href]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <div className="flex h-11 shrink-0 items-center gap-2 border-b bg-card px-2">
        <PaneMenu href={href} onPick={(h) => setPane(id, h)} canSee={canSee} />
        <button
          onClick={onMaximize}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          title={maximized ? "Back to split" : "Maximize this pane"}
        >
          {maximized ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
        </button>
        <button
          onClick={onClose}
          className="grid size-7 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
          title="Close this pane"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="relative min-h-0 flex-1">
        <iframe
          key={href}
          src={href}
          title={labelFor(href)}
          onLoad={() => setLoading(false)}
          className={cn(
            "absolute inset-0 size-full border-0 bg-background transition-opacity duration-200",
            loading ? "opacity-0" : "opacity-100",
          )}
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-0 grid place-items-center bg-background transition-opacity duration-200",
            loading ? "opacity-100" : "opacity-0",
          )}
        >
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading {labelFor(href)}…
          </div>
        </div>
      </div>
    </div>
  );
}

/** Tiny pictogram of a layout, drawn with the button's current colour. */
function LayoutGlyph({ id }: { id: SplitLayout }) {
  const cell = "flex-1 rounded-[1px] bg-current";
  const wrap = "flex h-3.5 w-[18px]";
  const colA = (
    <div className="flex flex-1 flex-col gap-[2px]">
      <div className={cell} />
      <div className={cell} />
    </div>
  );
  const rowA = (
    <div className="flex flex-1 gap-[2px]">
      <div className={cell} />
      <div className={cell} />
    </div>
  );
  switch (id) {
    case "cols":
      return (
        <div className={cn(wrap, "gap-[2px]")}>
          <div className={cell} />
          <div className={cell} />
        </div>
      );
    case "l-split":
      return (
        <div className={cn(wrap, "gap-[2px]")}>
          {colA}
          <div className={cell} />
        </div>
      );
    case "r-split":
      return (
        <div className={cn(wrap, "gap-[2px]")}>
          <div className={cell} />
          {colA}
        </div>
      );
    case "b-span":
      return (
        <div className={cn(wrap, "flex-col gap-[2px]")}>
          {rowA}
          <div className={cell} />
        </div>
      );
    case "t-span":
      return (
        <div className={cn(wrap, "flex-col gap-[2px]")}>
          <div className={cell} />
          {rowA}
        </div>
      );
  }
}

export function SplitView() {
  const { open, panes, layout, ratio, ratio2, max, close, setLayout, setRatio, setRatio2, setMax, closePane } = useSplit();
  const { can } = useAccess();
  const router = useRouter();

  // Close a pane; if that collapses the workspace to a single view, take the
  // surviving module full-screen in the main app.
  const handleClose = (id: PaneId) => {
    const survivor = closePane(id);
    if (survivor) router.push(survivor);
  };
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<{ depth: number; dir: "h" | "v" } | null>(null);
  const [mobilePane, setMobilePane] = useState<PaneId>("a");

  const [embedded, setEmbedded] = useState(true);
  useEffect(() => {
    setEmbedded(window.self !== window.top);
  }, []);
  const [everOpened, setEverOpened] = useState(false);
  useEffect(() => {
    if (open) setEverOpened(true);
  }, [open]);
  const [isDesktop, setIsDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Drag-to-resize a divider; listeners on window so it tracks over iframes.
  useEffect(() => {
    if (!drag) return;
    const onMove = (e: MouseEvent) => {
      const el = (drag.depth === 0 ? outerRef : innerRef).current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const v =
        drag.dir === "h" ? (e.clientX - rect.left) / rect.width : (e.clientY - rect.top) / rect.height;
      (drag.depth === 0 ? setRatio : setRatio2)(clamp(v));
    };
    const onUp = () => setDrag(null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [drag, setRatio, setRatio2]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  // Keep the mobile tab valid for the active layout.
  useEffect(() => {
    if (!VISIBLE[layout].includes(mobilePane)) setMobilePane("a");
  }, [layout, mobilePane]);

  if (embedded || !everOpened) return null;

  const leaf = (id: PaneId) => (
    <div key={`pane-${id}`} className="flex min-h-0 min-w-0 flex-1 flex-col">
      <Pane
        id={id}
        href={panes[id]}
        maximized={false}
        onMaximize={() => setMax(max === id ? null : id)}
        onClose={() => handleClose(id)}
        canSee={can}
      />
    </div>
  );

  // Render the layout tree. Plain function (not a component) so panes don't
  // remount — and thus iframes don't reload — on re-render / drag.
  const renderNode = (n: PaneNode, depth: number): JSX.Element => {
    if (typeof n === "string") return leaf(n);
    const isH = n.dir === "h";
    const r = depth === 0 ? ratio : ratio2;
    const ref = depth === 0 ? outerRef : innerRef;
    return (
      <div
        ref={ref}
        className={cn("relative flex min-h-0 min-w-0 flex-1", isH ? "flex-row" : "flex-col")}
      >
        <div
          style={isH ? { width: `${r * 100}%` } : { height: `${r * 100}%` }}
          className="flex min-h-0 min-w-0 flex-col"
        >
          {renderNode(n.a, depth + 1)}
        </div>
        <div
          onMouseDown={() => setDrag({ depth, dir: n.dir })}
          className={cn(
            "group relative z-10 shrink-0 bg-border transition-colors hover:bg-primary",
            isH ? "w-1.5 cursor-col-resize" : "h-1.5 cursor-row-resize",
          )}
          title="Drag to resize"
        >
          <span className={cn("absolute", isH ? "inset-y-0 -left-1 -right-1" : "inset-x-0 -top-1 -bottom-1")} />
        </div>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">{renderNode(n.b, depth + 1)}</div>
      </div>
    );
  };

  const visible = VISIBLE[layout];

  return (
    <div className={cn("fixed inset-0 z-40 flex flex-col bg-background", !open && "hidden")}>
      {/* Workspace bar */}
      <div className="flex h-11 shrink-0 items-center gap-3 border-b bg-card px-3">
        <span className="text-sm font-semibold">Split workspace</span>

        {/* Layout picker */}
        <div className="flex items-center gap-1 rounded-lg border bg-background p-0.5">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLayout(l.id)}
              title={l.label}
              aria-pressed={layout === l.id}
              className={cn(
                "grid h-7 w-8 place-items-center rounded-md transition-colors",
                layout === l.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
              )}
            >
              <LayoutGlyph id={l.id} />
            </button>
          ))}
        </div>

        <button
          onClick={close}
          className="ml-auto flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition-colors hover:bg-accent"
          title="Exit split screen (Esc)"
        >
          <X className="size-4" />
          Exit
        </button>
      </div>

      {isDesktop ? (
        <div className="relative flex min-h-0 flex-1">
          {max ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <Pane id={max} href={panes[max]} maximized onMaximize={() => setMax(null)} onClose={() => handleClose(max)} canSee={can} />
            </div>
          ) : (
            renderNode(TREES[layout], 0)
          )}
          {/* While dragging, this catches the cursor so iframes don't swallow it. */}
          {drag && (
            <div className={cn("absolute inset-0 z-20", drag.dir === "h" ? "cursor-col-resize" : "cursor-row-resize")} />
          )}
        </div>
      ) : (
        /* Mobile: tab switch + the single active pane */
        <>
          <div className="flex shrink-0 gap-1 overflow-x-auto border-b bg-card px-2 py-1.5">
            {visible.map((id) => (
              <button
                key={id}
                onClick={() => setMobilePane(id)}
                className={cn(
                  "min-w-0 flex-1 truncate rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  mobilePane === id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {labelFor(panes[id])}
              </button>
            ))}
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <Pane
              id={mobilePane}
              href={panes[mobilePane]}
              maximized={false}
              onMaximize={() => {
                const i = visible.indexOf(mobilePane);
                setMobilePane(visible[(i + 1) % visible.length]);
              }}
              onClose={() => handleClose(mobilePane)}
              canSee={can}
            />
          </div>
        </>
      )}
    </div>
  );
}
