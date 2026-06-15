// Per-user keyboard shortcut helpers for the command palette.
//
// Bindings are user-configurable (not static across the tenant): each user maps
// a command key -> a single chord (e.g. "Alt+I"). We persist per user id so two
// people on the same browser/profile don't clobber each other's muscle memory.

/** The chord that always opens the palette; never reassignable. */
export const PALETTE_CHORD = "Mod+K";

const IS_MAC =
  typeof navigator !== "undefined" && /mac|iphone|ipad/i.test(navigator.platform || navigator.userAgent);

/** True while typing in a field — we suppress shortcut dispatch here. */
export function isTypingTarget(el: EventTarget | null): boolean {
  const node = el as HTMLElement | null;
  if (!node) return false;
  const tag = node.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || node.isContentEditable;
}

/**
 * Normalise a keydown into a stable chord string, or null for a lone modifier
 * press. Ctrl and Meta both fold to "Mod" so a binding works cross-platform
 * (Ctrl on Windows/Linux, ⌘ on macOS).
 */
export function chordFromEvent(e: KeyboardEvent): string | null {
  const k = e.key;
  if (k === "Control" || k === "Meta" || k === "Alt" || k === "Shift") return null;
  const parts: string[] = [];
  if (e.ctrlKey || e.metaKey) parts.push("Mod");
  if (e.altKey) parts.push("Alt");
  if (e.shiftKey) parts.push("Shift");
  parts.push(k.length === 1 ? k.toUpperCase() : k);
  return parts.join("+");
}

/**
 * A chord is acceptable as a custom binding only if it carries a non-Shift
 * modifier — otherwise it would hijack ordinary typing. Returns a human reason
 * when rejected, or null when valid.
 */
export function rejectReason(chord: string): string | null {
  if (chord === PALETTE_CHORD) return "Reserved for the command palette";
  const hasModifier = chord.startsWith("Mod+") || chord.startsWith("Alt+") || chord.includes("+Alt+");
  // Function keys (F1..F12) are safe on their own; everything else needs a modifier.
  const isFnKey = /^F\d{1,2}$/.test(chord);
  if (!hasModifier && !isFnKey) return "Add Ctrl/⌘ or Alt so it won't clash with typing";
  return null;
}

/** Pretty-print a chord for display, e.g. "Mod+Shift+I" -> "⌘ ⇧ I" / "Ctrl Shift I". */
export function formatChord(chord: string): string {
  return chord
    .split("+")
    .map((p) => {
      if (p === "Mod") return IS_MAC ? "⌘" : "Ctrl";
      if (p === "Alt") return IS_MAC ? "⌥" : "Alt";
      if (p === "Shift") return IS_MAC ? "⇧" : "Shift";
      if (p === "ArrowUp") return "↑";
      if (p === "ArrowDown") return "↓";
      if (p === "Enter") return "↵";
      if (p === " ") return "Space";
      return p;
    })
    .join(IS_MAC ? " " : " ");
}

export type Bindings = Record<string, string>; // commandKey -> chord

const keyFor = (userId: string) => `nexa-keybindings:${userId}`;

export function loadBindings(userId: string): Bindings {
  try {
    const raw = localStorage.getItem(keyFor(userId));
    return raw ? (JSON.parse(raw) as Bindings) : {};
  } catch {
    return {};
  }
}

export function saveBindings(userId: string, b: Bindings): void {
  try {
    localStorage.setItem(keyFor(userId), JSON.stringify(b));
  } catch {}
}

/**
 * Assign `chord` to `commandKey`, transferring it off any other command that
 * held it (a chord maps to at most one command). Pass chord=null to clear.
 */
export function applyBinding(b: Bindings, commandKey: string, chord: string | null): Bindings {
  const next: Bindings = {};
  for (const [k, c] of Object.entries(b)) {
    if (k === commandKey) continue; // drop the old binding for this command
    if (chord && c === chord) continue; // steal the chord from whoever had it
    next[k] = c;
  }
  if (chord) next[commandKey] = chord;
  return next;
}

/** Reverse map for dispatch: chord -> commandKey. */
export function chordIndex(b: Bindings): Record<string, string> {
  const idx: Record<string, string> = {};
  for (const [k, c] of Object.entries(b)) idx[c] = k;
  return idx;
}
