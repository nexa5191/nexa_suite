// ---------------------------------------------------------------------------
// Inline voucher comments with @mention support.
// Comments live outside the GL — they never affect balances or postings.
// ---------------------------------------------------------------------------

const STORAGE_KEY = "nexa-voucher-comments";

export interface VoucherComment {
  id: string;
  voucherId: string;
  text: string;
  authorId: string;
  createdAt: string;
  /** Employee IDs parsed from @emp-001 patterns in the text. */
  mentions: string[];
}

/** Extract @emp-001 style mention IDs from raw comment text. */
export function parseMentions(text: string): string[] {
  const re = /@(emp-\d+)/g;
  const ids: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text))) ids.push(m[1]);
  return [...new Set(ids)];
}

export function loadComments(): VoucherComment[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveComments(comments: VoucherComment[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(comments));
  } catch {}
}
