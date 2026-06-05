import type { KeyboardEvent } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(iso: string, opts?: Intl.DateTimeFormatOptions) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...opts,
  });
}

export function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    month: "short",
    year: "2-digit",
  });
}

/** Stable id from a string seed — avoids Math.random for deterministic SSR. */
export function slugId(prefix: string, seed: string | number) {
  return `${prefix}-${String(seed)}`;
}

/**
 * Blocks ArrowUp/ArrowDown from nudging a number input — users key in values.
 * Use on raw `<input type="number">` that don't go through the shared Input component.
 */
export function noNumberNudge(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault();
}
