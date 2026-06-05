"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { ThemeConfig, DEFAULT_THEME, applyTheme, loadTheme, saveTheme } from "@/lib/theme";

interface ThemeContext {
  theme: ThemeConfig;
  setTheme: (patch: Partial<ThemeConfig>) => void;
  resetTheme: () => void;
}

const Ctx = createContext<ThemeContext | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeConfig>(DEFAULT_THEME);

  useEffect(() => {
    const t = loadTheme();
    setThemeState(t);
    applyTheme(t);
  }, []);

  // React to OS theme changes when in "system" mode.
  useEffect(() => {
    if (theme.mode !== "system" || typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => applyTheme(theme);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  const setTheme = useCallback((patch: Partial<ThemeConfig>) => {
    setThemeState((prev) => {
      const next = { ...prev, ...patch };
      const root = document.documentElement;
      root.classList.add("theme-transition");
      applyTheme(next);
      saveTheme(next);
      window.setTimeout(() => root.classList.remove("theme-transition"), 450);
      return next;
    });
  }, []);

  const resetTheme = useCallback(() => setTheme(DEFAULT_THEME), [setTheme]);

  return <Ctx.Provider value={{ theme, setTheme, resetTheme }}>{children}</Ctx.Provider>;
}

export function useTheme() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
