// ---------------------------------------------------------------------------
// The downloadable upload helper. Builds a styled multi-sheet workbook so the
// person preparing the file has everything in one place: how-to instructions, a
// ready-to-fill template, and — pulled *fresh at download time* — the current
// chart of accounts, entities/locations and voucher types to copy valid codes
// from. A plain single-sheet CSV variant is kept for quick edits.
// ---------------------------------------------------------------------------

import { CHART_OF_ACCOUNTS } from "./chart-of-accounts";
import { ENTITIES, LOCATIONS, entityById } from "./org";
import { VOUCHER_TYPES } from "./manual-entries";
import { toCsv } from "@/lib/csv/csv";
import type { CellInput, Workbook, XlsxStyle } from "@/lib/xlsx/xlsx";

// ---- shared cell styles ----------------------------------------------------
const TITLE: XlsxStyle = { bold: true, fontSize: 15, fontColor: "0F172A" };
const SUB: XlsxStyle = { fontColor: "64748B" };
const SECTION: XlsxStyle = { bold: true, fontSize: 12, fontColor: "1F2937" };
const HEAD: XlsxStyle = { bold: true, fontColor: "FFFFFF", fill: "1F2937", border: "all" };
const HEAD_REQ: XlsxStyle = { bold: true, fontColor: "FFFFFF", fill: "B91C1C", border: "all" };
const HEAD_NUM: XlsxStyle = { bold: true, fontColor: "FFFFFF", fill: "B91C1C", border: "all", align: "right" };
const CELL: XlsxStyle = { border: "all" };
const CELL_MUTED: XlsxStyle = { border: "all", fontColor: "64748B" };
const CELL_NUM: XlsxStyle = { border: "all", align: "right", numFmt: "#,##0.00" };
const CELL_CODE: XlsxStyle = { border: "all", fontName: "Consolas" };
const EX: XlsxStyle = { border: "all", fontColor: "94A3B8", italic: true };
const EX_NUM: XlsxStyle = { border: "all", fontColor: "94A3B8", italic: true, align: "right" };
const KEY: XlsxStyle = { bold: true, fontColor: "0F172A" };

const c = (value: string | number, style: XlsxStyle): CellInput => ({ value, style });

// Column layout of the data template (required columns flagged in red).
const COLUMNS: { name: string; required?: boolean; numeric?: boolean; help: string; width: number }[] = [
  { name: "Doc", help: "Document key — lines sharing it become ONE voucher. Leave blank to treat the whole file as one document.", width: 12 },
  { name: "Type", help: "Voucher type — see the 'Voucher Types' sheet. Defaults to Journal.", width: 12 },
  { name: "Date", help: "Posting date — YYYY-MM-DD or DD/MM/YYYY.", width: 13 },
  { name: "Entity", help: "Company — name or id from the 'Entities & Locations' sheet.", width: 16 },
  { name: "Location", help: "Branch — must belong to the entity (see 'Entities & Locations').", width: 16 },
  { name: "Basis", help: "Accrual, Cash, or Both. Defaults to Accrual.", width: 10 },
  { name: "Narration", help: "Document header text — what the voucher is for.", width: 30 },
  { name: "AutoReverse", help: "Yes to auto-post an offsetting voucher later (accruals/provisions). Blank = No.", width: 12 },
  { name: "ReverseDate", help: "Date the auto-reversal posts (only when AutoReverse = Yes). Must be on/after Date.", width: 13 },
  { name: "Account", required: true, help: "G/L account — code or name from the 'G/L Accounts' sheet.", width: 14 },
  { name: "Debit", required: true, numeric: true, help: "Debit amount (0 if this line is a credit).", width: 12 },
  { name: "Credit", required: true, numeric: true, help: "Credit amount (0 if this line is a debit).", width: 12 },
  { name: "LineText", help: "Optional line-level narration (SAP item text) — flows into the GL memo.", width: 28 },
];

// ---- Instructions sheet ----------------------------------------------------
function instructionsSheet(today: string) {
  const rows: CellInput[][] = [];
  rows.push([c("NEXA — Document Upload Template", TITLE)]);
  rows.push([c(`Generated ${today}. Fill the 'Template' sheet, then upload this file (.xlsx or CSV) on Journal Entries → Upload.`, SUB)]);
  rows.push([]);
  rows.push([c("How it works", SECTION)]);
  rows.push([c("1. One row per ledger line. Rows that share the same 'Doc' value group into a single balanced voucher.", CELL_MUTED)]);
  rows.push([c("2. Each voucher must balance: total Debit = total Credit, with at least two lines.", CELL_MUTED)]);
  rows.push([c("3. Copy valid values from the 'G/L Accounts', 'Entities & Locations' and 'Voucher Types' sheets.", CELL_MUTED)]);
  rows.push([c("4. Anything unrecognised loads with a sensible default and is flagged for you to fix on screen — nothing posts until you confirm.", CELL_MUTED)]);
  rows.push([c("5. Delete the grey example rows on the 'Template' sheet before uploading.", CELL_MUTED)]);
  rows.push([]);
  rows.push([c("Columns", SECTION)]);
  rows.push([c("Column", HEAD), c("Required", HEAD), c("Meaning", HEAD)]);
  for (const col of COLUMNS) {
    rows.push([
      c(col.name, CELL_CODE),
      c(col.required ? "Required" : "Optional", col.required ? { ...CELL, bold: true, fontColor: "B91C1C" } : CELL_MUTED),
      c(col.help, CELL),
    ]);
  }
  return {
    name: "Instructions",
    rows,
    cols: [{ width: 16 }, { width: 12 }, { width: 90 }],
    merges: ["A1:C1", "A2:C2"],
  };
}

// ---- Template sheet (the one the user fills) -------------------------------
function templateSheet() {
  const header = COLUMNS.map((col) =>
    c(col.name, col.required ? (col.numeric ? HEAD_NUM : HEAD_REQ) : HEAD),
  );
  // Two worked examples: a reversing accrual (2 lines) and a simple JV (2 lines).
  const ex = (vals: (string | number)[]) =>
    vals.map((v, i) => c(v, COLUMNS[i].numeric ? EX_NUM : EX));
  const rows: CellInput[][] = [
    header,
    ex(["DOC-1", "Journal", "2026-05-31", "Nexa Foods", "Bengaluru HQ", "Accrual", "Accrue May electricity", "Yes", "2026-06-01", "6030", 18000, 0, "Power & fuel"]),
    ex(["DOC-1", "Journal", "2026-05-31", "Nexa Foods", "Bengaluru HQ", "Accrual", "Accrue May electricity", "Yes", "2026-06-01", "2010", 0, 18000, "Accrued payable"]),
    ex(["DOC-2", "Journal", "2026-05-31", "Nexa Foods", "Bengaluru HQ", "Accrual", "Reclassify courier to admin", "No", "", "6035", 4500, 0, "Office & admin"]),
    ex(["DOC-2", "Journal", "2026-05-31", "Nexa Foods", "Bengaluru HQ", "Accrual", "Reclassify courier to admin", "No", "", "6070", 0, 4500, "From travel"]),
  ];
  return {
    name: "Template",
    rows,
    cols: COLUMNS.map((col) => ({ width: col.width })),
    freeze: { rows: 1 },
  };
}

// ---- G/L Accounts sheet (fresh pull) ---------------------------------------
function glSheet() {
  const rows: CellInput[][] = [
    [c("Code", HEAD), c("Account name", HEAD), c("Type", HEAD), c("Subtype", HEAD), c("Normal balance", HEAD)],
  ];
  for (const a of CHART_OF_ACCOUNTS) {
    rows.push([
      c(a.code, CELL_CODE),
      c(a.name, CELL),
      c(a.type, CELL_MUTED),
      c(a.subtype, CELL_MUTED),
      c(a.normal === "debit" ? "Debit" : "Credit", CELL_MUTED),
    ]);
  }
  return {
    name: "G/L Accounts",
    rows,
    cols: [{ width: 9 }, { width: 34 }, { width: 12 }, { width: 22 }, { width: 14 }],
    freeze: { rows: 1 },
  };
}

// ---- Entities & Locations sheet --------------------------------------------
function orgSheet() {
  const rows: CellInput[][] = [];
  rows.push([c("Entities", SECTION)]);
  rows.push([c("Entity name", HEAD), c("Currency", HEAD)]);
  for (const e of ENTITIES) rows.push([c(e.name, CELL), c(e.currency, CELL_MUTED)]);
  rows.push([]);
  rows.push([c("Locations", SECTION)]);
  rows.push([c("Location", HEAD), c("Belongs to entity", HEAD), c("State", HEAD)]);
  for (const l of LOCATIONS) {
    rows.push([c(l.name, CELL), c(entityById(l.entityId)?.name ?? l.entityId, CELL_MUTED), c(l.state ?? "—", CELL_MUTED)]);
  }
  return { name: "Entities & Locations", rows, cols: [{ width: 22 }, { width: 22 }, { width: 16 }] };
}

// ---- Voucher Types sheet ---------------------------------------------------
function typesSheet() {
  const rows: CellInput[][] = [
    [c("Type (use either)", HEAD), c("Code", HEAD), c("What it does", HEAD)],
  ];
  for (const t of VOUCHER_TYPES) rows.push([c(t.label, KEY), c(t.id, CELL_CODE), c(t.hint, CELL)]);
  return { name: "Voucher Types", rows, cols: [{ width: 18 }, { width: 14 }, { width: 70 }] };
}

/** Full helper workbook — built fresh on every call so the reference data is current. */
export function uploadTemplateWorkbook(today: string): Workbook {
  return {
    creator: "NEXA",
    sheets: [instructionsSheet(today), templateSheet(), glSheet(), orgSheet(), typesSheet()],
  };
}

/** Plain CSV template (single sheet) for quick edits — header + two example rows. */
export function uploadTemplateCsv(): string {
  return toCsv([
    COLUMNS.map((col) => col.name),
    ["DOC-1", "Journal", "2026-05-31", "Nexa Foods", "Bengaluru HQ", "Accrual", "Accrue May electricity", "Yes", "2026-06-01", "6030", "18000", "0", "Power & fuel"],
    ["DOC-1", "Journal", "2026-05-31", "Nexa Foods", "Bengaluru HQ", "Accrual", "Accrue May electricity", "Yes", "2026-06-01", "2010", "0", "18000", "Accrued payable"],
  ]);
}
