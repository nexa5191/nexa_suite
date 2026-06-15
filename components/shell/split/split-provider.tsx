"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";

export type PaneId = "a" | "b" | "c";

/**
 * Workspace arrangements:
 *   cols     A | B            (two columns — the classic split)
 *   l-split  (A / B) | C      left column split in two, right whole
 *   r-split  A | (B / C)      left whole, right column split in two
 *   b-span   (A | B) / C      two on top, one spanning the bottom
 *   t-span   C / (A | B)      one spanning the top, two below
 */
export type SplitLayout = "cols" | "l-split" | "r-split" | "b-span" | "t-span";

interface SplitState {
  open: boolean;
  /** Route (href) loaded in each pane's iframe. */
  panes: Record<PaneId, string>;
  layout: SplitLayout;
  /** Outer split position (0.2 – 0.8). */
  ratio: number;
  /** Inner / nested split position (0.2 – 0.8). */
  ratio2: number;
  /** When set, that pane fills the workspace. */
  max: PaneId | null;
}

interface SplitContext extends SplitState {
  toggle: () => void;
  close: () => void;
  setPane: (id: PaneId, href: string) => void;
  /** Open `href` in the right pane (B) and reveal the workspace. When
   *  `alongside` is given it loads into the left pane (A) — e.g. the list you
   *  launched from — so you get list | detail side by side. */
  openInSplit: (href: string, alongside?: string) => void;
  setLayout: (l: SplitLayout) => void;
  /** Close one pane: 3 panes → two columns of the survivors; 2 → exits split.
   *  Returns the surviving pane's href when it collapses to a single view
   *  (so the caller can navigate the main app there), else null. */
  closePane: (id: PaneId) => string | null;
  setRatio: (r: number) => void;
  setRatio2: (r: number) => void;
  setMax: (m: PaneId | null) => void;
}

const DEFAULTS: SplitState = {
  open: false,
  panes: { a: "/journal", b: "/invoicing", c: "/orders" },
  layout: "cols",
  ratio: 0.5,
  ratio2: 0.5,
  max: null,
};

const KEY = "nexa-split";
const Ctx = createContext<SplitContext | null>(null);

const clampRatio = (r: number) => Math.max(0.2, Math.min(0.8, r));

/** Pane ids each layout actually shows (in display order). */
export const VISIBLE_PANES: Record<SplitLayout, PaneId[]> = {
  cols: ["a", "b"],
  "l-split": ["a", "b", "c"],
  "r-split": ["a", "b", "c"],
  "b-span": ["a", "b", "c"],
  "t-span": ["a", "b", "c"],
};

export function SplitProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<SplitState>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        // `open` is intentionally not restored — start collapsed each session.
        const v = JSON.parse(raw) as Partial<SplitState> & { left?: string; right?: string };
        if (v.panes) {
          setS({ ...DEFAULTS, ...v, open: false, max: v.max ?? null });
        } else if (v.left) {
          // Migrate the old two-pane shape (left/right) into the new model.
          setS({
            ...DEFAULTS,
            panes: { a: v.left, b: v.right ?? DEFAULTS.panes.b, c: DEFAULTS.panes.c },
            ratio: typeof v.ratio === "number" ? v.ratio : 0.5,
            open: false,
          });
        }
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch {}
  }, [s, hydrated]);

  const value = useMemo<SplitContext>(
    () => ({
      ...s,
      toggle: () => setS((p) => ({ ...p, open: !p.open })),
      close: () => setS((p) => ({ ...p, open: false })),
      setPane: (id, href) => setS((p) => ({ ...p, panes: { ...p.panes, [id]: href } })),
      openInSplit: (href, alongside) =>
        setS((p) => ({
          ...p,
          panes: { ...p.panes, a: alongside ?? p.panes.a, b: href },
          layout: "cols",
          max: null,
          open: true,
        })),
      setLayout: (layout) => setS((p) => ({ ...p, layout, max: null })),
      closePane: (id) => {
        const remaining = VISIBLE_PANES[s.layout].filter((x) => x !== id);
        if (remaining.length >= 2) {
          // Collapse to two columns showing the survivors.
          const [first, second] = remaining;
          setS((p) => ({
            ...p,
            layout: "cols",
            max: null,
            panes: { ...p.panes, a: p.panes[first], b: p.panes[second] },
          }));
          return null;
        }
        // One (or none) left → leave the split workspace entirely.
        const survivor = remaining[0] ? s.panes[remaining[0]] : null;
        setS((p) => ({ ...p, open: false, max: null }));
        return survivor;
      },
      setRatio: (r) => setS((p) => ({ ...p, ratio: clampRatio(r) })),
      setRatio2: (r) => setS((p) => ({ ...p, ratio2: clampRatio(r) })),
      setMax: (m) => setS((p) => ({ ...p, max: m })),
    }),
    [s],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSplit() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useSplit must be used within SplitProvider");
  return c;
}
