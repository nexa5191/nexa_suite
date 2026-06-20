// ---------------------------------------------------------------------------
// SAP-style document upload. Unlike the flat CSV importer, this turns an
// uploaded/pasted file into *editable* documents — a header (company / date /
// type) plus its line items — that the user reviews and corrects on screen
// before anything is committed to the ledger.
//
// Parsing is deliberately lenient: unknown entities/accounts/dates are coerced
// to sensible defaults (or left blank) rather than rejected, so the file always
// lands in the editor. Posting validity is judged live from the edited state.
//
// Accepted columns (case-insensitive, order-independent; only Account + the two
// amount columns are required):
//   Doc/Ref, Type, Date, Entity, Location, Basis, Narration,
//   Account/AccountCode, Debit, Credit, LineText
// Lines sharing a Doc/Ref become one document; a file with no Doc column loads
// as a single document.
// ---------------------------------------------------------------------------

import { parseCsv } from "@/lib/csv/csv";
import { ENTITIES, LOCATIONS, locationsForEntity } from "./org";
import { CHART_OF_ACCOUNTS, accountSafe } from "./chart-of-accounts";
import {
  BOOKS_OPENING,
  VOUCHER_TYPES,
  entryTotals,
  validateDraft,
  type EntryBasis,
  type EntryDraft,
  type VoucherType,
} from "./manual-entries";

export interface EditableLine {
  id: string;
  accountCode: string; // "" until resolved/picked
  debit: string; // kept as raw strings while editing
  credit: string;
  text: string;
}

export interface EditableDoc {
  id: string;
  ref: string; // free-text document key (informational)
  type: VoucherType;
  date: string; // YYYY-MM-DD
  entityId: string;
  locationId: string;
  basis: EntryBasis;
  narration: string;
  /** Accrual/provision that posts an offsetting voucher on `reverseDate`. */
  autoReverse: boolean;
  reverseDate: string; // YYYY-MM-DD (used only when autoReverse)
  lines: EditableLine[];
}

// Columns recognised on import. Account + Debit + Credit are the hard minimum.
export const UPLOAD_COLUMNS = [
  "Doc",
  "Type",
  "Date",
  "Entity",
  "Location",
  "Basis",
  "Narration",
  "AutoReverse",
  "ReverseDate",
  "Account",
  "Debit",
  "Credit",
  "LineText",
] as const;

// Header aliases so common spreadsheet wordings still map.
const COLUMN_ALIASES: Record<string, string[]> = {
  Doc: ["doc", "ref", "reference", "document", "voucher"],
  Type: ["type", "vouchertype"],
  Date: ["date", "docdate", "postingdate"],
  Entity: ["entity", "company", "companycode"],
  Location: ["location", "branch", "site"],
  Basis: ["basis"],
  Narration: ["narration", "header", "headertext", "description"],
  AutoReverse: ["autoreverse", "reverse", "reversing", "accrual?"],
  ReverseDate: ["reversedate", "reversaldate", "reverseon"],
  Account: ["account", "accountcode", "glaccount", "gl", "code"],
  Debit: ["debit", "dr"],
  Credit: ["credit", "cr"],
  LineText: ["linetext", "text", "item", "particulars"],
};

const truthy = (s: string) => /^(y|yes|true|1|x)$/i.test(s.trim());

let SEQ = 0;
const uid = (p: string) => `${p}-${(SEQ += 1).toString(36)}`;

export const blankLine = (): EditableLine => ({ id: uid("ln"), accountCode: "", debit: "", credit: "", text: "" });

export function blankDoc(entityId?: string, today?: string): EditableDoc {
  const ent = ENTITIES.find((e) => e.id === entityId) ?? ENTITIES[0];
  return {
    id: uid("doc"),
    ref: "",
    type: "journal",
    date: today ?? BOOKS_OPENING,
    entityId: ent.id,
    locationId: locationsForEntity(ent.id)[0]?.id ?? "",
    basis: "accrual",
    narration: "",
    autoReverse: false,
    reverseDate: "",
    lines: [blankLine(), blankLine()],
  };
}

// ---- lenient value resolvers ----------------------------------------------

function normDate(s: string, fallback: string): string {
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  const m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(t); // dd/mm/yyyy
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return fallback;
}

function resolveEntityId(s: string): string {
  const t = s.trim().toLowerCase();
  return (ENTITIES.find((e) => e.id.toLowerCase() === t || e.name.toLowerCase() === t) ?? ENTITIES[0]).id;
}

function resolveLocationId(s: string, entityId: string): string {
  const t = s.trim().toLowerCase();
  const inEntity = LOCATIONS.filter((l) => l.entityId === entityId);
  return (inEntity.find((l) => l.id.toLowerCase() === t || l.name.toLowerCase() === t) ?? inEntity[0])?.id ?? "";
}

function resolveAccountCode(s: string): string {
  const t = s.trim();
  if (!t) return "";
  if (accountSafe(t)) return t;
  return CHART_OF_ACCOUNTS.find((a) => a.name.toLowerCase() === t.toLowerCase())?.code ?? "";
}

function resolveType(s: string): VoucherType {
  const t = s.trim().toLowerCase();
  if (!t) return "journal";
  const hit = VOUCHER_TYPES.find((v) => v.id.toLowerCase() === t || v.label.toLowerCase() === t);
  return (hit?.id as VoucherType) ?? "journal";
}

function resolveBasis(s: string): EntryBasis {
  const t = s.trim().toLowerCase();
  return t === "cash" ? "cash" : t === "both" ? "both" : "accrual";
}

const cleanAmount = (s: string): string => {
  const c = s.replace(/[^0-9.\-]/g, "");
  const n = Number(c);
  return c && Number.isFinite(n) && n !== 0 ? String(n) : "";
};

// ---- parse ----------------------------------------------------------------

export interface ParseResult {
  docs: EditableDoc[];
  error?: string;
}

export function parseUpload(csvText: string, today: string): ParseResult {
  return parseUploadGrid(parseCsv(csvText), today);
}

/** Same as parseUpload but from an already-parsed grid (e.g. an .xlsx sheet). */
export function parseUploadGrid(rows: string[][], today: string): ParseResult {
  if (rows.length === 0) return { docs: [], error: "The file is empty." };

  const header = rows[0].map((h) => h.trim().toLowerCase().replace(/[\s_]/g, ""));
  const idx: Record<string, number> = {};
  for (const col of UPLOAD_COLUMNS) {
    idx[col] = header.findIndex((h) => COLUMN_ALIASES[col].includes(h));
  }
  for (const must of ["Account", "Debit", "Credit"]) {
    if (idx[must] === -1) {
      return {
        docs: [],
        error: `Missing the "${must}" column. Minimum columns: Account, Debit, Credit (plus optional Doc, Type, Date, Entity, Location, Basis, Narration, LineText).`,
      };
    }
  }

  const cell = (r: string[], col: string) => (idx[col] === -1 ? "" : (r[idx[col]] ?? "").trim());

  // Group rows into documents by the Doc key (first-seen order). No Doc column
  // → everything is one document.
  const order: string[] = [];
  const groups = new Map<string, string[][]>();
  for (let i = 1; i < rows.length; i++) {
    const key = (idx.Doc === -1 ? "" : cell(rows[i], "Doc")) || "__single__";
    if (!groups.has(key)) {
      groups.set(key, []);
      order.push(key);
    }
    groups.get(key)!.push(rows[i]);
  }

  const docs = order.map((key) => {
    const g = groups.get(key)!;
    const head = g[0];
    const entityId = resolveEntityId(cell(head, "Entity"));
    const date = normDate(cell(head, "Date"), today);
    const autoReverse = truthy(cell(head, "AutoReverse"));
    return {
      id: uid("doc"),
      ref: key === "__single__" ? "" : key,
      type: resolveType(cell(head, "Type")),
      date,
      entityId,
      locationId: resolveLocationId(cell(head, "Location"), entityId),
      basis: resolveBasis(cell(head, "Basis")),
      narration: cell(head, "Narration"),
      autoReverse,
      reverseDate: autoReverse ? normDate(cell(head, "ReverseDate"), date) : "",
      lines: g.map((r) => ({
        id: uid("ln"),
        accountCode: resolveAccountCode(cell(r, "Account")),
        debit: cleanAmount(cell(r, "Debit")),
        credit: cleanAmount(cell(r, "Credit")),
        text: cell(r, "LineText"),
      })),
    } satisfies EditableDoc;
  });

  return { docs };
}

// ---- build + validate ------------------------------------------------------

export function docTotals(doc: EditableDoc) {
  return entryTotals(doc.lines.map((l) => ({ accountCode: l.accountCode, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })));
}

export function buildDraft(doc: EditableDoc): EntryDraft {
  const ent = ENTITIES.find((e) => e.id === doc.entityId) ?? ENTITIES[0];
  return {
    type: doc.type,
    date: doc.date,
    narration: doc.narration,
    entityId: doc.entityId,
    locationId: doc.locationId,
    currency: ent.currency,
    basis: doc.basis,
    autoReverse: doc.autoReverse || undefined,
    reverseDate: doc.autoReverse ? doc.reverseDate : undefined,
    lines: doc.lines
      // keep only lines the user actually filled in
      .filter((l) => l.accountCode || l.debit || l.credit)
      .map((l) => ({
        accountCode: l.accountCode,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        memo: l.text.trim() || undefined,
      })),
  };
}

/** Posting errors for one edited document (balance, accounts, period, …). */
export function validateDoc(doc: EditableDoc, today: string): string[] {
  const errors: string[] = [];
  doc.lines.forEach((l, i) => {
    if (!l.accountCode && (l.debit || l.credit)) errors.push(`Line ${i + 1}: pick an account.`);
    if (l.debit && l.credit) errors.push(`Line ${i + 1}: enter a debit or a credit, not both.`);
  });
  if (doc.autoReverse) {
    if (!doc.reverseDate) errors.push("Auto-reverse is on — set a reversal date.");
    else if (doc.reverseDate < doc.date) errors.push("Reversal date must be on or after the document date.");
  }
  for (const e of validateDraft(buildDraft(doc), today)) if (!errors.includes(e)) errors.push(e);
  return errors;
}

export { BOOKS_OPENING };
