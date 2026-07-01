// ---------------------------------------------------------------------------
// Page bookmarks / pins — per-user, persisted to localStorage.
// ---------------------------------------------------------------------------

export interface Bookmark {
  path: string;
  label: string;
}

const storageKey = (userId: string) => `nexa-bookmarks:${userId}`;

export function loadBookmarks(userId: string): Bookmark[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(storageKey(userId));
    return raw ? (JSON.parse(raw) as Bookmark[]) : [];
  } catch {
    return [];
  }
}

export function saveBookmarks(userId: string, bookmarks: Bookmark[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(userId), JSON.stringify(bookmarks));
  } catch {}
}

export function toggleBookmark(userId: string, path: string, label: string): Bookmark[] {
  const current = loadBookmarks(userId);
  const exists = current.some((b) => b.path === path);
  const next = exists
    ? current.filter((b) => b.path !== path)
    : [...current, { path, label }];
  saveBookmarks(userId, next);
  return next;
}
