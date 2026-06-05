// Central demo-data reset. Every module persists its user edits under a
// `nexa-*` localStorage key on top of the deterministic seed dataset. Clearing
// those keys returns every module to its fresh, mutually-consistent seed — so
// "reset" is how we clean out accumulated data and reload fresh test data.
//
// We clear by prefix (so dynamic keys like `nexa-budget:<entity>:<fy>` are
// covered automatically) and keep only the appearance/layout preferences the
// user has chosen, which are not "business data".

/** Appearance & export-formatting keys preserved across a reset. */
const KEEP = new Set<string>([
  "nexa-prefs", // currency / entity scope / nav layout / font
  "nexa-theme", // accent colour, light/dark, radius
  "nexa-xlsx-templates", // saved Excel formatting presets
  "nexa-xlsx-active-template",
  "nexa-report-period", // selected reporting period (a view preference)
]);

/** Human-readable summary of the operational modules a reset restores. */
export const RESET_MODULES = [
  "CRM pipeline, journeys & tags",
  "Sales invoices & statuses",
  "Vendor & document approvals",
  "Inventory movements & production",
  "Fixed assets & disposals",
  "Bank reconciliation matches",
  "Tax filings & ITC/TDS workings",
  "Inter-company transactions & settlements",
  "Budgets, assumptions & business plan",
  "Leave policy, payroll runs & tasks",
];

/** Returns the operational `nexa-*` keys currently present in localStorage. */
export function operationalKeys(): string[] {
  if (typeof window === "undefined") return [];
  const out: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith("nexa-") && !KEEP.has(k)) out.push(k);
  }
  return out;
}

/** How many operational keys currently hold user edits. */
export function pendingChangeCount(): number {
  return operationalKeys().length;
}

/**
 * Clears all operational data, returning every module to fresh seed. Appearance
 * preferences are kept unless `includeAppearance` is set. Callers should reload
 * the page afterwards so in-memory React state is rebuilt from seed.
 */
export function resetDemoData(opts: { includeAppearance?: boolean } = {}) {
  if (typeof window === "undefined") return;
  const remove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith("nexa-")) continue;
    if (!opts.includeAppearance && KEEP.has(k)) continue;
    remove.push(k);
  }
  remove.forEach((k) => localStorage.removeItem(k));
}
