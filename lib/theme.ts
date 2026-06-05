// Theme engine: a single accent (HSL) drives --primary/--ring and a derived
// 5-colour analogous chart palette. Persisted to localStorage; applied to the
// document root by the theme provider and a pre-paint inline script.

export type ThemeMode = "light" | "dark" | "system";

export interface ThemeConfig {
  hue: number; // 0-360
  saturation: number; // 0-100
  lightness: number; // 0-100
  radius: number; // rem * 100 (e.g. 70 => 0.70rem)
  mode: ThemeMode;
}

export const DEFAULT_THEME: ThemeConfig = {
  hue: 222,
  saturation: 75,
  lightness: 52,
  radius: 70,
  mode: "system",
};

export const THEME_KEY = "nexa-theme";

export interface ThemePreset {
  name: string;
  hue: number;
  saturation: number;
  lightness: number;
}

export const PRESETS: ThemePreset[] = [
  { name: "Indigo", hue: 243, saturation: 75, lightness: 58 },
  { name: "Royal", hue: 222, saturation: 75, lightness: 52 },
  { name: "Ocean", hue: 200, saturation: 80, lightness: 46 },
  { name: "Teal", hue: 176, saturation: 62, lightness: 40 },
  { name: "Emerald", hue: 154, saturation: 60, lightness: 40 },
  { name: "Amber", hue: 36, saturation: 92, lightness: 50 },
  { name: "Rose", hue: 344, saturation: 78, lightness: 54 },
  { name: "Violet", hue: 268, saturation: 70, lightness: 58 },
  { name: "Slate", hue: 215, saturation: 25, lightness: 40 },
  { name: "Crimson", hue: 350, saturation: 70, lightness: 48 },
];

export const RADIUS_OPTIONS = [0, 35, 70, 110, 160];

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Offsets (degrees) used to fan an accent hue into an analogous chart palette.
const CHART_OFFSETS = [0, 34, -28, 66, -54];

export function chartPalette(t: ThemeConfig, dark: boolean) {
  return CHART_OFFSETS.map((off, i) => {
    const hue = (t.hue + off + 360) % 360;
    const sat = clamp(t.saturation - (i === 0 ? 0 : 6), 30, 95);
    const light = clamp(t.lightness + (dark ? 8 : 0) + (i % 2 === 0 ? 0 : 6), 20, 78);
    return `${hue} ${sat}% ${light}%`;
  });
}

export function resolveMode(mode: ThemeMode): "light" | "dark" {
  if (mode === "system") {
    if (typeof window !== "undefined" && window.matchMedia) {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }
  return mode;
}

export function applyTheme(t: ThemeConfig) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const dark = resolveMode(t.mode) === "dark";
  root.classList.toggle("dark", dark);

  const light = clamp(t.lightness + (dark ? 6 : 0), 10, 90);
  const primary = `${t.hue} ${t.saturation}% ${light}%`;
  root.style.setProperty("--primary", primary);
  root.style.setProperty("--ring", primary);
  // Choose a readable foreground for the accent.
  root.style.setProperty("--primary-foreground", light > 62 ? "222 30% 12%" : "0 0% 100%");

  chartPalette(t, dark).forEach((c, i) => {
    root.style.setProperty(`--chart-${i + 1}`, c);
  });

  root.style.setProperty("--radius", `${(t.radius / 100).toFixed(2)}rem`);
}

export function loadTheme(): ThemeConfig {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const raw = window.localStorage.getItem(THEME_KEY);
    if (!raw) return DEFAULT_THEME;
    return { ...DEFAULT_THEME, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_THEME;
  }
}

export function saveTheme(t: ThemeConfig) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(THEME_KEY, JSON.stringify(t));
}

/** Inline script string injected pre-paint to avoid a flash of default theme. */
export const THEME_BOOT_SCRIPT = `
(function(){
  try {
    var t = JSON.parse(localStorage.getItem('${THEME_KEY}') || 'null') || ${JSON.stringify(DEFAULT_THEME)};
    var m = t.mode === 'system'
      ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
      : t.mode;
    var dark = m === 'dark';
    var root = document.documentElement;
    if (dark) root.classList.add('dark');
    var light = Math.max(10, Math.min(90, t.lightness + (dark ? 6 : 0)));
    var primary = t.hue + ' ' + t.saturation + '% ' + light + '%';
    root.style.setProperty('--primary', primary);
    root.style.setProperty('--ring', primary);
    root.style.setProperty('--primary-foreground', light > 62 ? '222 30% 12%' : '0 0% 100%');
    root.style.setProperty('--radius', (t.radius/100).toFixed(2) + 'rem');
    var prefs = JSON.parse(localStorage.getItem('nexa-prefs') || 'null');
    if (prefs && prefs.font) root.style.setProperty('--font-sans', prefs.font);
  } catch (e) {}
})();
`;
