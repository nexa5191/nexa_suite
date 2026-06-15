// ---------------------------------------------------------------------------
// Bulk journal-entry import. Turns a pasted/uploaded CSV into validated
// EntryDrafts grouped by a voucher reference, with per-voucher diagnostics so
// the user can fix the file before anything is posted.
//
// CSV shape (one row per ledger line; lines sharing a Ref form one voucher):
//   Ref, Date, Narration, Entity, Location, AccountCode, Debit, Credit
// Entity/Location/Account accept either the id/code or the display name.
// ---------------------------------------------------------------------------

import { parseCsv, toCsv } from "@/lib/csv/csv";
import { ENTITIES, LOCATIONS } from "./org";
import { CHART_OF_ACCOUNTS, accountSafe } from "./chart-of-accounts";
import { BOOKS_OPENING, entryTotals, validateDraft, type EntryDraft, type ManualEntryLine } from "./manual-entries";

export const IMPORT_COLUMNS = ["Ref", "Date", "Narration", "Entity", "Location", "AccountCode", "Debit", "Credit"] as const;

export interface ImportLine {
  rowNum: number; // 1-based line in the source file (incl. header)
  accountCode: string;
  accountName?: string;
  debit: number;
  credit: number;
}

export interface ImportVoucher {
  ref: string;
  draft: EntryDraft | null; // null only when the header fields can't resolve
  date: string;
  narration: string;
  entityName: string;
  locationName: string;
  lines: ImportLine[];
  totals: { debit: number; credit: number; balanced: boolean };
  errors: string[];
  valid: boolean;
}

export interface ImportResult {
  vouchers: ImportVoucher[];
  headerError?: string;
  validCount: number;
  totalCount: number;
}

// ---- value resolvers -------------------------------------------------------

function normDate(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t); // dd/mm/yyyy or dd-mm-yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return null;
}

function parseAmount(s: string): number {
  const cleaned = s.replace(/[^0-9.\-]/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : NaN;
}

function resolveEntity(s: string) {
  const t = s.trim().toLowerCase();
  return ENTITIES.find((e) => e.id.toLowerCase() === t || e.name.toLowerCase() === t);
}

function resolveLocation(s: string, entityId: string) {
  const t = s.trim().toLowerCase();
  return LOCATIONS.find((l) => l.entityId === entityId && (l.id.toLowerCase() === t || l.name.toLowerCase() === t));
}

function resolveAccount(s: string): string | null {
  const t = s.trim();
  if (accountSafe(t)) return t;
  const byName = CHART_OF_ACCOUNTS.find((a) => a.name.toLowerCase() === t.toLowerCase());
  return byName?.code ?? null;
}

// ---- parser ----------------------------------------------------------------

export function parseJournalImport(csvText: string, today: string): ImportResult {
  const rows = parseCsv(csvText);
  if (rows.length === 0) return { vouchers: [], headerError: "The file is empty.", validCount: 0, totalCount: 0 };

  // Map expected columns by header name (order-independent, case-insensitive).
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx: Record<string, number> = {};
  for (const col of IMPORT_COLUMNS) idx[col] = header.indexOf(col.toLowerCase());
  const missing = IMPORT_COLUMNS.filter((c) => idx[c] === -1);
  if (missing.length) {
    return {
      vouchers: [],
      headerError: `Missing column${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}. Expected header: ${IMPORT_COLUMNS.join(", ")}.`,
      validCount: 0,
      totalCount: 0,
    };
  }

  const cell = (r: string[], col: (typeof IMPORT_COLUMNS)[number]) => (r[idx[col]] ?? "").trim();

  // Group data rows by Ref, preserving first-seen order.
  const order: string[] = [];
  const groups = new Map<string, { rows: string[][]; rowNums: number[] }>();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const ref = cell(r, "Ref") || `(row ${i + 1})`;
    if (!groups.has(ref)) {
      groups.set(ref, { rows: [], rowNums: [] });
      order.push(ref);
    }
    groups.get(ref)!.rows.push(r);
    groups.get(ref)!.rowNums.push(i + 1);
  }

  const vouchers: ImportVoucher[] = [];
  for (const ref of order) {
    const g = groups.get(ref)!;
    const head = g.rows[0];
    const errors: string[] = [];

    const dateRaw = cell(head, "Date");
    const date = normDate(dateRaw);
    if (!date) errors.push(`Bad date "${dateRaw}" — use YYYY-MM-DD or DD/MM/YYYY.`);

    const narration = cell(head, "Narration");
    const entityRaw = cell(head, "Entity");
    const entity = resolveEntity(entityRaw);
    if (!entity) errors.push(`Unknown entity "${entityRaw}".`);

    const locationRaw = cell(head, "Location");
    const location = entity ? resolveLocation(locationRaw, entity.id) : undefined;
    if (entity && !location) errors.push(`Unknown location "${locationRaw}" for ${entity.name}.`);

    const lines: ImportLine[] = [];
    const draftLines: ManualEntryLine[] = [];
    g.rows.forEach((r, li) => {
      const rowNum = g.rowNums[li];
      const accRaw = cell(r, "AccountCode");
      const code = resolveAccount(accRaw);
      if (!code) errors.push(`Line ${rowNum}: unknown account "${accRaw}".`);
      const debit = parseAmount(cell(r, "Debit"));
      const credit = parseAmount(cell(r, "Credit"));
      if (Number.isNaN(debit) || Number.isNaN(credit)) errors.push(`Line ${rowNum}: amount is not a number.`);
      const d = Number.isNaN(debit) ? 0 : debit;
      const c = Number.isNaN(credit) ? 0 : credit;
      lines.push({ rowNum, accountCode: code ?? accRaw, accountName: code ? accountSafe(code)?.name : undefined, debit: d, credit: c });
      draftLines.push({ accountCode: code ?? "", debit: d, credit: c });
    });

    const totals = entryTotals(draftLines);

    let draft: EntryDraft | null = null;
    if (entity && location && date) {
      draft = {
        type: "journal",
        date,
        narration,
        entityId: entity.id,
        locationId: location.id,
        currency: entity.currency,
        basis: "accrual",
        lines: draftLines,
      };
      // Fold in the accounting rules (balance, ≥2 lines, period window, …),
      // de-duped against the resolution errors we already raised.
      for (const e of validateDraft(draft, today)) if (!errors.includes(e)) errors.push(e);
    }

    vouchers.push({
      ref,
      draft: errors.length === 0 ? draft : null,
      date: date ?? dateRaw,
      narration,
      entityName: entity?.name ?? entityRaw,
      locationName: location?.name ?? locationRaw,
      lines,
      totals: { debit: totals.debit, credit: totals.credit, balanced: totals.balanced },
      errors,
      valid: errors.length === 0,
    });
  }

  return {
    vouchers,
    validCount: vouchers.filter((v) => v.valid).length,
    totalCount: vouchers.length,
  };
}

/** A ready-to-edit CSV template with the header and one balanced sample voucher. */
export function importTemplateCsv(): string {
  return toCsv([
    [...IMPORT_COLUMNS],
    ["JV-IMP-1", "2026-05-31", "Accrue May electricity", "Nexa Foods", "Bengaluru HQ", "6030", "18000", "0"],
    ["JV-IMP-1", "2026-05-31", "Accrue May electricity", "Nexa Foods", "Bengaluru HQ", "2010", "0", "18000"],
  ]);
}

export { BOOKS_OPENING };
