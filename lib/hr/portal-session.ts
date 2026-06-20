// ---------------------------------------------------------------------------
// Portal session — the employee currently signed into "My Portal".
//
// The portal is self-service: the My Portal page, Tax Calculator and Tax
// Declaration all act on a single "current employee" instead of each carrying
// its own admin-style picker. We persist that choice to localStorage so it
// survives navigation between the portal routes, and broadcast changes in-tab
// so every mounted portal view stays in sync.
// ---------------------------------------------------------------------------

import * as React from "react";
import { EMPLOYEES } from "@/lib/hr/employees";

export const PORTAL_EMP_KEY = "nexa-portal-emp";
/** The default signed-in employee (matches the prior hard-coded default). */
export const DEFAULT_PORTAL_EMP = "emp-006";
const PORTAL_EMP_EVENT = "nexa-portal-emp-change";

function isValid(id: string): boolean {
  return EMPLOYEES.some((e) => e.id === id);
}

export function loadPortalEmployee(): string {
  if (typeof window === "undefined") return DEFAULT_PORTAL_EMP;
  try {
    const raw = localStorage.getItem(PORTAL_EMP_KEY);
    if (raw && isValid(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_PORTAL_EMP;
}

export function savePortalEmployee(id: string) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(PORTAL_EMP_KEY, id);
  } catch {
    /* ignore */
  }
  // Notify other portal views mounted in this tab (storage events don't fire
  // for the same document that wrote them).
  window.dispatchEvent(new CustomEvent(PORTAL_EMP_EVENT, { detail: id }));
}

/**
 * The current portal employee. SSR-equal default first, then the persisted
 * choice loads after mount (no hydration mismatch). Setting it persists and
 * syncs every other mounted portal view.
 */
export function usePortalEmployee(): readonly [string, (id: string) => void] {
  const [empId, setEmpId] = React.useState<string>(DEFAULT_PORTAL_EMP);

  React.useEffect(() => {
    setEmpId(loadPortalEmployee());

    const onCustom = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      if (id && isValid(id)) setEmpId(id);
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === PORTAL_EMP_KEY && e.newValue && isValid(e.newValue)) setEmpId(e.newValue);
    };
    window.addEventListener(PORTAL_EMP_EVENT, onCustom);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(PORTAL_EMP_EVENT, onCustom);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const update = React.useCallback((id: string) => {
    setEmpId(id);
    savePortalEmployee(id);
  }, []);

  return [empId, update] as const;
}
