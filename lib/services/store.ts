// Tiny localStorage helpers shared across the Services pack (projects,
// timesheets, conflicts, time-based invoices). Mirrors the read/write helpers
// used elsewhere in NEXA, kept in one place for the sector.

export function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}
