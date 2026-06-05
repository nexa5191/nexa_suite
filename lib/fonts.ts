// Font registry. Each font exposes a CSS variable wired up in app/layout.tsx.
// The active font sets --font-sans on <html> (handled by the prefs provider).

export interface AppFont {
  id: string;
  label: string;
  cssVar: string; // the --font-* variable provided by next/font
  preview: string;
  category: "Sans" | "Display" | "Serif" | "Mono";
}

export const APP_FONTS: AppFont[] = [
  { id: "inter", label: "Inter", cssVar: "var(--font-inter)", preview: "Clean & neutral", category: "Sans" },
  { id: "manrope", label: "Manrope", cssVar: "var(--font-manrope)", preview: "Geometric & modern", category: "Sans" },
  { id: "jakarta", label: "Plus Jakarta Sans", cssVar: "var(--font-jakarta)", preview: "Friendly & rounded", category: "Sans" },
  { id: "outfit", label: "Outfit", cssVar: "var(--font-outfit)", preview: "Crisp display", category: "Display" },
  { id: "space", label: "Space Grotesk", cssVar: "var(--font-space)", preview: "Techy display", category: "Display" },
  { id: "sourceserif", label: "Source Serif 4", cssVar: "var(--font-sourceserif)", preview: "Editorial serif", category: "Serif" },
  { id: "lora", label: "Lora", cssVar: "var(--font-lora)", preview: "Warm serif", category: "Serif" },
  { id: "ibmplex", label: "IBM Plex Mono", cssVar: "var(--font-ibmplex)", preview: "Ledger mono", category: "Mono" },
  { id: "jetbrains", label: "JetBrains Mono", cssVar: "var(--font-jetbrains)", preview: "Code mono", category: "Mono" },
  { id: "dmsans", label: "DM Sans", cssVar: "var(--font-dmsans)", preview: "Low-contrast grotesque", category: "Sans" },
  { id: "poppins", label: "Poppins", cssVar: "var(--font-poppins)", preview: "Geometric & bold", category: "Sans" },
  { id: "sora", label: "Sora", cssVar: "var(--font-sora)", preview: "Modern & wide", category: "Display" },
  { id: "worksans", label: "Work Sans", cssVar: "var(--font-worksans)", preview: "Optimised for UI", category: "Sans" },
  { id: "figtree", label: "Figtree", cssVar: "var(--font-figtree)", preview: "Soft & humanist", category: "Sans" },
  { id: "merriweather", label: "Merriweather", cssVar: "var(--font-merriweather)", preview: "Classic reading serif", category: "Serif" },
  { id: "firacode", label: "Fira Code", cssVar: "var(--font-firacode)", preview: "Ligature mono", category: "Mono" },
  { id: "system", label: "System UI", cssVar: "ui-sans-serif, system-ui, sans-serif", preview: "Native OS font", category: "Sans" },
];

export function fontValue(id: string): string {
  return APP_FONTS.find((f) => f.id === id)?.cssVar ?? "var(--font-inter)";
}
