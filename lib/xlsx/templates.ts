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
  fontSize: number; // body font size (pt)
  currencySymbol: string; // prefix used in money number formats ("₹", "$", "")
  showTitleBlock: boolean; // render title + meta rows above the table
  borders: boolean; // thin borders on body cells
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
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 11,
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
    fontSize: 10,
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
    return Array.isArray(arr) ? arr.map((t) => ({ ...t, builtin: false })) : [];
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
