"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { Currency, currencyByCode } from "@/lib/currency";
import { fontValue } from "@/lib/fonts";
import type { Basis } from "@/lib/accounting/types";
import { ALL, locationsForEntity } from "@/lib/accounting/org";

export type NavLayout = "left" | "top" | "right";

interface PrefsState {
  currencyCode: string;
  entityId: string;
  locationId: string;
  state: string;
  basis: Basis;
  nav: NavLayout;
  fontId: string;
}

interface PrefsContext extends PrefsState {
  currency: Currency;
  setCurrency: (code: string) => void;
  setEntity: (id: string) => void;
  setLocation: (id: string) => void;
  setState: (s: string) => void;
  setBasis: (b: Basis) => void;
  setNav: (n: NavLayout) => void;
  setFont: (id: string) => void;
}

const DEFAULTS: PrefsState = {
  currencyCode: "INR",
  entityId: ALL,
  locationId: ALL,
  state: ALL,
  basis: "accrual",
  nav: "left",
  fontId: "inter",
};

const KEY = "nexa-prefs";
const Ctx = createContext<PrefsContext | null>(null);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<PrefsState>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setS({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    // Persist with the resolved font CSS value so the boot script can apply it.
    const payload = { ...s, font: fontValue(s.fontId) };
    localStorage.setItem(KEY, JSON.stringify(payload));
    document.documentElement.style.setProperty("--font-sans", fontValue(s.fontId));
  }, [s, hydrated]);

  const value = useMemo<PrefsContext>(() => {
    return {
      ...s,
      currency: currencyByCode(s.currencyCode),
      setCurrency: (code) => setS((p) => ({ ...p, currencyCode: code })),
      setEntity: (id) =>
        setS((p) => {
          // Reset location if it no longer belongs to the chosen entity.
          const locs = locationsForEntity(id).map((l) => l.id);
          const locationId = p.locationId !== ALL && !locs.includes(p.locationId) ? ALL : p.locationId;
          return { ...p, entityId: id, locationId, state: ALL };
        }),
      setLocation: (id) => setS((p) => ({ ...p, locationId: id })),
      setState: (st) => setS((p) => ({ ...p, state: st })),
      setBasis: (b) => setS((p) => ({ ...p, basis: b })),
      setNav: (n) => setS((p) => ({ ...p, nav: n })),
      setFont: (id) => setS((p) => ({ ...p, fontId: id })),
    };
  }, [s]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function usePrefs() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePrefs must be used within PrefsProvider");
  return c;
}
