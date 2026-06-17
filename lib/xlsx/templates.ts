// Excel export templates — named, savable formatting presets ("like in Excel":
// save / edit / load). Built-ins ship with the app; user templates are stored
// in localStorage so they persist and travel with every export across modules.

export interface ExcelTemplate {
  id: string;
  name: string;
  builtin?: boolean;
  accent: string; // header row fill (hex, no #)
  headerText: string; // header font colour
  titleColor: string; // report title colour
  bandColor: string | null; // zebra-stripe fill, or null for plain rows
  totalFill: string; // totals row fill
  totalText: string; // totals row font colour
  gridColor: string; // (kept for parity / future use)
  fontName: string; // font family (Calibri, Arial, …)
  fontSize: number; // body font size (pt)
  headerBold: boolean; // header row bold
  headerItalic: boolean; // header row italic
  moneyDecimals: number; // decimal places in money/number formats (0–2)
  currencySymbol: string; // prefix used in money number formats ("₹", "$", "")
  showTitleBlock: boolean; // render title + meta rows above the table
  borders: boolean; // thin borders on body cells
  bodyText: string; // data-row font colour
  bodyBold: boolean; // data rows bold
  bodyItalic: boolean; // data rows italic
  totalBold: boolean; // totals row bold
  totalItalic: boolean; // totals row italic
}

// Defaults for knobs added after the first templates shipped — used to upgrade
// older saved presets so they always have every field.
export const TEMPLATE_DEFAULTS = {
  fontName: "Calibri",
  headerBold: true,
  headerItalic: false,
  moneyDecimals: 0,
  bodyText: "111827",
  bodyBold: false,
  bodyItalic: false,
  totalBold: true,
  totalItalic: false,
} as const;

/** Fill any missing fields on a (possibly older) stored template. */
export function normalizeTemplate(t: Partial<ExcelTemplate> & { id: string; name: string }): ExcelTemplate {
  return { ...BUILTIN_TEMPLATES[0], ...TEMPLATE_DEFAULTS, ...t };
}

export const BUILTIN_TEMPLATES: ExcelTemplate[] = [
  {
    id: "nexa-default",
    name: "NEXA Default",
    builtin: true,
    accent: "4F46E5",
    headerText: "FFFFFF",
    titleColor: "111827",
    bandColor: "F5F3FF",
    totalFill: "EEF2FF",
    totalText: "1E1B4B",
    gridColor: "D1D5DB",
    fontName: "Calibri",
    fontSize: 11,
    headerBold: true,
    headerItalic: false,
    moneyDecimals: 0,
    bodyText: "111827",
    bodyBold: false,
    bodyItalic: false,
    totalBold: true,
    totalItalic: false,
    currencySymbol: "₹",
    showTitleBlock: true,
    borders: true,
  },
  {
    id: "finance-green",
    name: "Finance Green",
    builtin: true,
    accent: "047857",
    headerText: "FFFFFF",
    titleColor: "064E3B",
    bandColor: "ECFDF5",
    totalFill: "D1FAE5",
    totalText: "064E3B",
    gridColor: "A7F3D0",
    fontName: "Calibri",
    fontSize: 11,
    headerBold: true,
    headerItalic: false,
    moneyDecimals: 0,
    bodyText: "111827",
    bodyBold: false,
    bodyItalic: false,
    totalBold: true,
    totalItalic: false,
    currencySymbol: "₹",
    showTitleBlock: true,
    borders: true,
  },
  {
    id: "slate-minimal",
    name: "Slate Minimal",
    builtin: true,
    accent: "1F2937",
    headerText: "FFFFFF",
    titleColor: "111827",
    bandColor: null,
    totalFill: "F3F4F6",
    totalText: "111827",
    gridColor: "E5E7EB",
    fontName: "Calibri",
    fontSize: 11,
    headerBold: true,
    headerItalic: false,
    moneyDecimals: 0,
    bodyText: "111827",
    bodyBold: false,
    bodyItalic: false,
    totalBold: true,
    totalItalic: false,
    currencySymbol: "₹",
    showTitleBlock: true,
    borders: false,
  },
  {
    id: "mono-print",
    name: "Mono Print",
    builtin: true,
    accent: "FFFFFF",
    headerText: "111827",
    titleColor: "111827",
    bandColor: null,
    totalFill: "FFFFFF",
    totalText: "111827",
    gridColor: "111827",
    fontName: "Cambria",
    fontSize: 10,
    headerBold: true,
    headerItalic: false,
    moneyDecimals: 0,
    bodyText: "111827",
    bodyBold: false,
    bodyItalic: false,
    totalBold: true,
    totalItalic: false,
    currencySymbol: "",
    showTitleBlock: true,
    borders: true,
  },
];

const KEY = "nexa-xlsx-templates";
const ACTIVE_KEY = "nexa-xlsx-active-template";

export function loadUserTemplates(): ExcelTemplate[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as ExcelTemplate[];
    return Array.isArray(arr) ? arr.map((t) => normalizeTemplate({ ...t, builtin: false })) : [];
  } catch {
    return [];
  }
}

export function saveUserTemplates(list: ExcelTemplate[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.filter((t) => !t.builtin)));
  } catch {}
}

export function allTemplates(): ExcelTemplate[] {
  return [...BUILTIN_TEMPLATES, ...loadUserTemplates()];
}

export function templateById(id: string): ExcelTemplate {
  return allTemplates().find((t) => t.id === id) ?? BUILTIN_TEMPLATES[0];
}

export function upsertTemplate(t: ExcelTemplate): ExcelTemplate[] {
  const user = loadUserTemplates();
  const idx = user.findIndex((x) => x.id === t.id);
  const next = { ...t, builtin: false };
  if (idx >= 0) user[idx] = next;
  else user.push(next);
  saveUserTemplates(user);
  return allTemplates();
}

export function deleteTemplate(id: string): ExcelTemplate[] {
  saveUserTemplates(loadUserTemplates().filter((t) => t.id !== id));
  return allTemplates();
}

export function newTemplateId(): string {
  // Deterministic-ish unique id without Math.random (id seeded off existing set).
  const user = loadUserTemplates();
  let n = user.length + 1;
  while (user.some((t) => t.id === `tpl-${n}`)) n++;
  return `tpl-${n}`;
}

export function getActiveTemplateId(): string {
  if (typeof window === "undefined") return BUILTIN_TEMPLATES[0].id;
  try {
    return localStorage.getItem(ACTIVE_KEY) ?? BUILTIN_TEMPLATES[0].id;
  } catch {
    return BUILTIN_TEMPLATES[0].id;
  }
}

export function setActiveTemplateId(id: string) {
  try {
    localStorage.setItem(ACTIVE_KEY, id);
  } catch {}
}
