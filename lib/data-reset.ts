// Bare-shell reset. Every module persists its data under a `nexa-*`
// localStorage key. Clearing those keys returns every module to its empty
// starting state. We clear by prefix (so dynamic keys like
// `nexa-budget:<entity>:<fy>` are covered automatically) and keep only
// appearance/layout preferences, which are not business data.

/** Appearance & export-formatting keys preserved across a reset. */
const KEEP = new Set<string>([
  "nexa-prefs", // currency / entity scope / nav layout / font
  "nexa-theme", // accent colour, light/dark, radius
  "nexa-xlsx-templates", // saved Excel formatting presets
  "nexa-xlsx-active-template",
  "nexa-report-period", // selected reporting period (a view preference)
  "nexa-access", // roles, members & module provisioning — not business data
]);

/** Human-readable list of modules cleared on reset. */
export const RESET_MODULES = [
  "Journal entries & GL postings",
  "Sales invoices & payments",
  "Vendors, POs & approvals",
  "Inventory movements & production",
  "Fixed assets & disposals",
  "Bank accounts & reconciliation",
  "Tax filings & ITC/TDS workings",
  "Inter-company transactions",
  "Budgets & business plan",
  "HR — payroll, leave & tasks",
  "CRM pipeline & contacts",
  "Contracts, leases & FX items",
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
