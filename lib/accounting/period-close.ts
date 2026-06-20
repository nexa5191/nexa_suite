// ---------------------------------------------------------------------------
// Period close & locking — open/close/lock accounting periods per entity.
//
// A locked period rejects new manual postings (enforced in validateDraft), the
// way SAP/Oracle prevent back-dated entries into a closed book. State persists
// to localStorage; the close checklist drives a controlled month-end close.
// ---------------------------------------------------------------------------

export type PeriodStatus = "open" | "soft-closed" | "locked";

export const PERIOD_STATUS_META: Record<PeriodStatus, { label: string; tone: "success" | "warning" | "danger" }> = {
  open: { label: "Open", tone: "success" },
  "soft-closed": { label: "Soft-closed", tone: "warning" },
  locked: { label: "Locked", tone: "danger" },
};

const KEY = "nexa-period-close";

export function periodOf(dateIso: string): string {
  return dateIso.slice(0, 7); // YYYY-MM
}

function read(): Record<string, PeriodStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, PeriodStatus>) : {};
  } catch {
    return {};
  }
}
function write(v: Record<string, PeriodStatus>) {
  try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* ignore */ }
}

const k = (entityId: string, period: string) => `${entityId}|${period}`;

export function loadPeriodStatus(): Record<string, PeriodStatus> {
  return read();
}
export function statusOf(entityId: string, period: string): PeriodStatus {
  return read()[k(entityId, period)] ?? "open";
}
export function setPeriodStatus(entityId: string, period: string, status: PeriodStatus): void {
  const store = read();
  if (status === "open") delete store[k(entityId, period)];
  else store[k(entityId, period)] = status;
  write(store);
}

/** A locked period blocks new postings. (soft-closed warns but still allows them.) */
export function isPeriodLocked(entityId: string, dateIso: string): boolean {
  return statusOf(entityId, periodOf(dateIso)) === "locked";
}

// ---- Month-end close checklist --------------------------------------------

export interface CloseTask {
  key: string;
  label: string;
  module: string;
  href: string;
}

export const CLOSE_CHECKLIST: CloseTask[] = [
  { key: "ar", label: "Receivables reconciled & aged", module: "AR", href: "/receivables" },
  { key: "ap", label: "Payables reconciled, MSME cleared", module: "AP", href: "/payables" },
  { key: "bank", label: "Bank reconciliation complete", module: "Banking", href: "/banking" },
  { key: "depr", label: "Depreciation posted", module: "Assets", href: "/assets" },
  { key: "payroll", label: "Payroll run posted to GL", module: "Payroll", href: "/hr/payroll" },
  { key: "gst", label: "GST returns filed (GSTR-1 / 3B)", module: "Tax", href: "/tax" },
  { key: "fx", label: "FX revaluation run", module: "Finance", href: "/reports/fx-revaluation" },
  { key: "accruals", label: "Accruals & provisions booked", module: "GL", href: "/journal-entries" },
];

const CHECK_KEY = "nexa-close-checklist";

export function loadChecklist(): Record<string, Record<string, boolean>> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(CHECK_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}
export function saveChecklistFor(scope: string, state: Record<string, boolean>): void {
  const all = loadChecklist();
  all[scope] = state;
  try { localStorage.setItem(CHECK_KEY, JSON.stringify(all)); } catch { /* ignore */ }
}

/** Recent month periods, newest first. */
export function recentPeriods(asOn: string, count = 6): string[] {
  const [y, m] = asOn.slice(0, 7).split("-").map((x) => parseInt(x, 10));
  const out: string[] = [];
  let yy = y, mm = m;
  for (let i = 0; i < count; i++) {
    out.push(`${yy}-${String(mm).padStart(2, "0")}`);
    mm -= 1;
    if (mm === 0) { mm = 12; yy -= 1; }
  }
  return out;
}
