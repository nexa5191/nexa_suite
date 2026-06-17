"use client";

import { Eye, X } from "lucide-react";
import { useAccess } from "./access-provider";

/**
 * Sticky banner shown only while an admin is mimicking (viewing-as) another
 * user — ported from Touchstone's MimicBanner. Shows who you're viewing as +
 * their role, and an Exit button that restores the original user. Because
 * access state is client-side, exiting just flips state — no reload.
 */
export function MimicBanner() {
  const { isMimicking, currentUser, currentRole, mimicOriginal, exitMimic } = useAccess();

  if (!isMimicking) return null;

  return (
    <div data-chrome className="sticky top-0 z-[60] bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-2 text-white shadow-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Eye className="size-4 shrink-0" />
          <span className="truncate text-xs font-semibold">
            Viewing as <strong className="font-bold">{currentUser?.name ?? currentUser?.email}</strong>
            {currentRole && <span className="font-normal opacity-80"> · {currentRole.label}</span>}
          </span>
          {mimicOriginal && (
            <span className="hidden text-[11px] opacity-80 sm:inline">
              (you are <strong>{mimicOriginal.name ?? mimicOriginal.email}</strong>)
            </span>
          )}
        </div>
        <button
          onClick={exitMimic}
          className="flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold transition-colors hover:bg-white/30"
        >
          <X className="size-3" />
          Exit Mimic Mode
        </button>
      </div>
    </div>
  );
}
