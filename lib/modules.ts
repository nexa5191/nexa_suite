// ---------------------------------------------------------------------------
// Modules & functions — the access registry that powers per-function
// provisioning.
//
// A "module" is a NAV group (Accounting, Sales & Revenue, …) and a "function"
// is a NAV item inside it (Journal Entries, Invoicing, …). Everything here is
// keyed on the item's STABLE `key` — never the URL — so provisioning and RBAC
// survive routes being renamed. The only place a URL is touched is
// owningNavKey(), which translates the live pathname back to a key at the route
// guard boundary. Enablement itself lives in AccessProvider (localStorage).
// ---------------------------------------------------------------------------

import { NAV_GROUPS, FLAT_NAV, type NavItem } from "@/components/shell/nav-items";

/**
 * Functions that can never be turned off — the dashboard and the personal /
 * configuration pages a user always needs to operate (and to reach the setup
 * page itself). Identified by key. Everything else is gateable.
 */
export const ALWAYS_ON: readonly string[] = [
  "dashboard",
  "setup",
  "settings",
  "portal",
  "help",
];

export function isAlwaysOn(key: string): boolean {
  return ALWAYS_ON.includes(key);
}

export interface ModuleDef {
  id: string;
  label: string;
  /** Gateable functions in this module (always-on items are excluded). */
  items: NavItem[];
}

const slug = (label: string) =>
  label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

/** The modules shown on the setup page — NAV groups with their gateable items. */
export const MODULES: ModuleDef[] = NAV_GROUPS.map((g) => ({
  id: slug(g.label),
  label: g.label,
  items: g.items.filter((i) => !isAlwaysOn(i.key)),
})).filter((m) => m.items.length > 0);

/** Every function key the access layer can gate (used for counts / "select all"). */
export const GATEABLE_KEYS: string[] = MODULES.flatMap((m) => m.items.map((i) => i.key));

/** Module id that owns a function key (for role grants that work per-module). */
export function moduleIdForKey(key: string): string | null {
  return MODULES.find((m) => m.items.some((i) => i.key === key))?.id ?? null;
}

/**
 * The gateable function KEY that "owns" a given pathname, or null when the path
 * belongs to no module (e.g. /setup, /settings). Used by the route guard:
 * /leave/config inherits from /leave, /hr/payroll from payroll itself. Picks the
 * longest matching href so nested routes resolve to the right owner. This is the
 * sole URL→key translation point; nothing else reasons about URLs.
 */
export function owningNavKey(pathname: string): string | null {
  let best: NavItem | null = null;
  for (const item of FLAT_NAV) {
    if (isAlwaysOn(item.key)) continue;
    if (pathname === item.href || pathname.startsWith(item.href + "/")) {
      if (!best || item.href.length > best.href.length) best = item;
    }
  }
  return best?.key ?? null;
}
