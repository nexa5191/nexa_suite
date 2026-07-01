// ---------------------------------------------------------------------------
// Recently viewed pages — per-user, persisted to localStorage.
// ---------------------------------------------------------------------------

const MAX_RECENT = 10;

export interface RecentPage {
  path: string;
  label: string;
  visitedAt: string;
}

const storageKey = (userId: string) => `nexa-recently-viewed:${userId}`;

export function loadRecent(userId: string): RecentPage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as RecentPage[]) : [];
  } catch {
    return [];
  }
}

export function pushRecent(userId: string, path: string, label: string): void {
  if (typeof window === "undefined") return;
  const filtered = loadRecent(userId).filter((p) => p.path !== path);
  const next: RecentPage[] = [
    { path, label, visitedAt: new Date().toISOString() },
    ...filtered,
  ].slice(0, MAX_RECENT);
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(next));
  } catch {}
}
