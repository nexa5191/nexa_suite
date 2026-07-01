// ---------------------------------------------------------------------------
// Vouchers — user-posted double-entry transactions of every kind.
//
// One model (`ManualEntry`) backs all voucher types (Journal, Sales, Purchase,
// Payment, Receipt, Contra, Debit/Credit Note, Stock, Asset, Bank). The `type`
// drives the guided form, the numbering prefix, the GL category and the posting
// validation, but every voucher ultimately resolves to balanced Dr/Cr lines.
//
// Standards alignment:
//  • Double-entry: Σ debits = Σ credits — enforced before posting (IAS + GAAP).
//  • Accruals basis (IAS 1): defaults to accrual; "both" also posts to cash.
//  • Audit trail (GAAP): posted vouchers are immutable; correction is by
//    reversal (offsetting entry), never edit/delete. Auto-reversing vouchers
//    (accruals/provisions) carry their own future reversal automatically.
//  • Sequential numbering: gapless per-type references (SAL-0001, PAY-0001…).
//  • Period control: no posting before the books opened or in the future.
//  • Sub-ledgers: a `partyId` ties AR/AP movements to a third party.
// ---------------------------------------------------------------------------

import type { Posting, Basis } from "./types";
import { accountSafe } from "./chart-of-accounts";
import { locationById, entityById } from "./org";
import { partyName, type PartyKind } from "./parties";
import { isPeriodLocked } from "./period-close";

/** The date the books opened — no entry may be posted before this. */
export const BOOKS_OPENING = "2024-04-01";

/** A voucher may post to the accrual ledger, the cash ledger, or both. */
export type EntryBasis = Basis | "both";

export type EntryStatus = "draft" | "posted" | "reversed";

export type VoucherType =
  | "journal"
  | "sales"
  | "purchase"
  | "payment"
  | "receipt"
  | "contra"
  | "debit_note"
  | "credit_note"
  | "stock"
  | "asset"
  | "bank";

export interface VoucherTypeDef {
  id: VoucherType;
  label: string;
  prefix: string;
  category: string;
  /** Which third parties are relevant ("none" hides the party picker). */
  partyKind: PartyKind | "any" | "none";
  /** Guided types build lines from a quick-fill panel; free types use the line editor. */
  guided: boolean;
  defaultBasis: EntryBasis;
  /** The module this voucher conceptually belongs to (for placement/labels). */
  module: string;
  hint: string;
}

// Common account codes used by the guided builders.
const AR = "1100"; // Accounts Receivable
const AP = "2010"; // Accounts Payable
const GST_OUTPUT = "2100";
const GST_INPUT = "1300";
const SALES = "4010";
const SALES_RETURNS = "4040";
const PURCHASE_RETURNS = "5030";
const COGS = "5010";
const BANK = "1020";
const INVENTORY = "1200";
const FIXED_ASSET = "1500";
const TDS_PAYABLE = "2200"; // TDS we deduct on vendor payments — deposit via challan
const TDS_RECEIVABLE = "1310"; // TDS customers withhold on our bills — claim via certificate

export const VOUCHER_TYPES: VoucherTypeDef[] = [
  { id: "journal", label: "Journal (JV)", prefix: "JV", category: "Journal", partyKind: "any", guided: false, defaultBasis: "accrual", module: "Accounting", hint: "Free-form adjusting entry. Toggle auto-reverse for accruals & provisions." },
  { id: "sales", label: "Sales", prefix: "SAL", category: "Sales", partyKind: "customer", guided: true, defaultBasis: "accrual", module: "Invoicing", hint: "Dr Receivable / Cr Sales + GST output." },
  { id: "purchase", label: "Purchase", prefix: "PUR", category: "Purchases", partyKind: "vendor", guided: true, defaultBasis: "accrual", module: "Vendors", hint: "Dr Expense + GST input / Cr Payable." },
  { id: "payment", label: "Payment", prefix: "PAY", category: "Payment", partyKind: "any", guided: true, defaultBasis: "both", module: "Banking", hint: "Money out — Dr payable/expense / Cr Bank, deducting TDS to TDS Payable. Deposit it via challan in GST & TDS." },
  { id: "receipt", label: "Receipt", prefix: "REC", category: "Receipt", partyKind: "any", guided: true, defaultBasis: "both", module: "Banking", hint: "Money in — Dr Bank + TDS Receivable (withheld by customer) / Cr receivable/income. Claim it via certificate in GST & TDS." },
  { id: "contra", label: "Contra", prefix: "CON", category: "Contra", partyKind: "none", guided: true, defaultBasis: "both", module: "Banking", hint: "Cash ↔ bank / bank ↔ bank transfers." },
  { id: "debit_note", label: "Debit Note", prefix: "DN", category: "Debit Note", partyKind: "vendor", guided: true, defaultBasis: "accrual", module: "Vendors", hint: "Purchase return — Dr Payable / Cr Purchase returns + GST reversal." },
  { id: "credit_note", label: "Credit Note", prefix: "CN", category: "Credit Note", partyKind: "customer", guided: true, defaultBasis: "accrual", module: "Invoicing", hint: "Sales return — Dr Sales returns + GST / Cr Receivable." },
  { id: "stock", label: "Stock Journal", prefix: "STK", category: "Stock", partyKind: "none", guided: false, defaultBasis: "accrual", module: "Inventory", hint: "Inventory movements & adjustments (Dr/Cr Inventory)." },
  { id: "asset", label: "Asset", prefix: "AST", category: "Fixed Assets", partyKind: "vendor", guided: true, defaultBasis: "accrual", module: "Fixed Assets", hint: "Capitalise a fixed asset — Dr Asset / Cr Bank or Payable." },
  { id: "bank", label: "Bank", prefix: "BNK", category: "Bank", partyKind: "any", guided: true, defaultBasis: "both", module: "Banking", hint: "Direct bank deposit or withdrawal." },
];

const TYPE_BY_ID = new Map(VOUCHER_TYPES.map((t) => [t.id, t]));
export function voucherType(id: VoucherType): VoucherTypeDef {
  return TYPE_BY_ID.get(id) ?? VOUCHER_TYPES[0];
}

export interface ManualEntryLine {
  accountCode: string;
  debit: number;
  credit: number;
  /** Optional line-level narration (SAP "item text") — flows into the posting memo. */
  memo?: string;
}

export interface ManualEntry {
  id: string;
  voucherNo: string;
  type: VoucherType;
  date: string;
  narration: string;
  entityId: string;
  locationId: string;
  currency: string;
  basis: EntryBasis;
  partyId?: string;
  costCenter?: string;
  lines: ManualEntryLine[];
  status: EntryStatus;
  /** Accrual that reverses automatically on `reverseDate` (provisions etc.). */
  autoReverse?: boolean;
  reverseDate?: string;
  reversalOf?: string; // id of the entry this one reverses (manual reversal)
  reversedBy?: string;
  createdAt: string;
}

export type EntryDraft = Omit<
  ManualEntry,
  "id" | "voucherNo" | "status" | "createdAt" | "reversalOf" | "reversedBy"
>;

const STORAGE_KEY = "nexa-journal-entries";
const EPSILON = 0.005;

export const round2 = (n: number) => Math.round(n * 100) / 100;
const isCash = (code: string) => !!accountSafe(code)?.isCash;

export function entryTotals(lines: ManualEntryLine[]) {
  let debit = 0;
  let credit = 0;
  for (const l of lines) {
    debit += Number(l.debit) || 0;
    credit += Number(l.credit) || 0;
  }
  debit = round2(debit);
  credit = round2(credit);
  return { debit, credit, difference: round2(debit - credit), balanced: Math.abs(debit - credit) < EPSILON };
}

// ---- Guided line builders -------------------------------------------------

export interface GuidedInput {
  amount: number; // taxable / principal amount
  gstRate: number; // percent (0, 5, 12, 18, 28) — sales/purchase/notes
  tdsRate: number; // percent — TDS withheld on payment / receipt (194C/J/I/Q…)
  bankAccount: string; // cash/bank leg for payment/receipt/contra/bank/asset
  counterAccount: string; // income / expense / asset / "against" leg
  fromAccount: string; // contra source
  toAccount: string; // contra destination
  settleNow: boolean; // sales/purchase/asset: settled in cash vs on credit
  direction: "in" | "out"; // bank deposit vs withdrawal
  // Optional itemisation: split a sales/purchase bill across several income /
  // cost accounts. When non-empty it supersedes `amount` + `counterAccount`,
  // and GST is charged on the sum of the lines.
  costLines: { accountCode: string; amount: number }[];
}

export function defaultGuidedInput(type: VoucherType): GuidedInput {
  const counter: Record<string, string> = {
    sales: SALES,
    purchase: COGS,
    payment: AP,
    receipt: AR,
    debit_note: PURCHASE_RETURNS,
    credit_note: SALES_RETURNS,
    asset: FIXED_ASSET,
    bank: AP,
  };
  return {
    amount: 0,
    gstRate: type === "sales" || type === "purchase" || type === "debit_note" || type === "credit_note" ? 18 : 0,
    tdsRate: 0,
    bankAccount: BANK,
    counterAccount: counter[type] ?? "",
    fromAccount: "1010", // Cash on Hand
    toAccount: BANK,
    settleNow: false,
    direction: "in",
    costLines: [],
  };
}

/** Sum + GST for an itemised (multi-line) sales/purchase bill. */
function itemisedTotals(g: GuidedInput) {
  const valid = g.costLines.filter((l) => l.accountCode && (Number(l.amount) || 0) > 0);
  const base = round2(valid.reduce((s, l) => s + (Number(l.amount) || 0), 0));
  const gst = round2((base * (Number(g.gstRate) || 0)) / 100);
  return { valid, base, gst, gross: round2(base + gst) };
}

const line = (accountCode: string, debit: number, credit: number): ManualEntryLine => ({
  accountCode,
  debit: round2(debit),
  credit: round2(credit),
});

/** Build the Dr/Cr lines for a guided voucher type from the quick-fill input. */
export function buildGuidedLines(type: VoucherType, g: GuidedInput): ManualEntryLine[] {
  const amt = Number(g.amount) || 0;
  const gst = round2((amt * (Number(g.gstRate) || 0)) / 100);
  const gross = round2(amt + gst);
  switch (type) {
    case "sales": {
      const dr = g.settleNow ? g.bankAccount : AR;
      const it = itemisedTotals(g);
      if (it.valid.length > 0) {
        const lines = [line(dr, it.gross, 0)];
        it.valid.forEach((l) => lines.push(line(l.accountCode, 0, round2(Number(l.amount) || 0))));
        if (it.gst) lines.push(line(GST_OUTPUT, 0, it.gst));
        return lines;
      }
      const lines = [line(dr, gross, 0), line(g.counterAccount || SALES, 0, amt)];
      if (gst) lines.push(line(GST_OUTPUT, 0, gst));
      return lines;
    }
    case "purchase": {
      const cr = g.settleNow ? g.bankAccount : AP;
      const it = itemisedTotals(g);
      if (it.valid.length > 0) {
        const lines = it.valid.map((l) => line(l.accountCode, round2(Number(l.amount) || 0), 0));
        if (it.gst) lines.push(line(GST_INPUT, it.gst, 0));
        lines.push(line(cr, 0, it.gross));
        return lines;
      }
      const lines = [line(g.counterAccount || COGS, amt, 0)];
      if (gst) lines.push(line(GST_INPUT, gst, 0));
      lines.push(line(cr, 0, gross));
      return lines;
    }
    case "payment": {
      // Pay a vendor / settle a payable, optionally deducting TDS at source:
      // Dr payable/expense (gross) / Cr TDS payable (withheld) + Cr bank (net).
      const tds = round2((amt * (Number(g.tdsRate) || 0)) / 100);
      const lines = [line(g.counterAccount || AP, amt, 0)];
      if (tds) lines.push(line(TDS_PAYABLE, 0, tds));
      lines.push(line(g.bankAccount, 0, round2(amt - tds)));
      return lines;
    }
    case "receipt": {
      // Collect from a customer who withheld TDS on our bill:
      // Dr bank (net) + Dr TDS receivable (withheld) / Cr receivable/income (gross).
      const tds = round2((amt * (Number(g.tdsRate) || 0)) / 100);
      const lines = [line(g.bankAccount, round2(amt - tds), 0)];
      if (tds) lines.push(line(TDS_RECEIVABLE, tds, 0));
      lines.push(line(g.counterAccount || AR, 0, amt));
      return lines;
    }
    case "contra":
      return [line(g.toAccount, amt, 0), line(g.fromAccount, 0, amt)];
    case "bank":
      return g.direction === "in"
        ? [line(g.bankAccount, amt, 0), line(g.counterAccount, 0, amt)]
        : [line(g.counterAccount, amt, 0), line(g.bankAccount, 0, amt)];
    case "debit_note": {
      const lines = [line(AP, gross, 0), line(g.counterAccount || PURCHASE_RETURNS, 0, amt)];
      if (gst) lines.push(line(GST_INPUT, 0, gst));
      return lines;
    }
    case "credit_note": {
      const lines = [line(g.counterAccount || SALES_RETURNS, amt, 0)];
      if (gst) lines.push(line(GST_OUTPUT, gst, 0));
      lines.push(line(AR, 0, gross));
      return lines;
    }
    case "asset": {
      const cr = g.settleNow ? g.bankAccount : AP;
      return [line(g.counterAccount || FIXED_ASSET, amt, 0), line(cr, 0, amt)];
    }
    default:
      return [];
  }
}

// ---- Validation -----------------------------------------------------------

const accountType = (code: string) => accountSafe(code)?.type;
const accountSubtype = (code: string) => accountSafe(code)?.subtype;

export function validateDraft(draft: EntryDraft, today: string): string[] {
  const errors: string[] = [];
  const def = voucherType(draft.type);

  if (!draft.narration.trim()) errors.push("A narration (description) is required.");
  if (!draft.entityId) errors.push("Select an entity.");
  if (!draft.locationId) errors.push("Select a location.");

  if (!draft.date) {
    errors.push("A posting date is required.");
  } else if (draft.date < BOOKS_OPENING) {
    errors.push(`Date is before the books opened (${BOOKS_OPENING}).`);
  } else if (draft.date > today) {
    errors.push("Posting date cannot be in the future.");
  } else if (draft.entityId && isPeriodLocked(draft.entityId, draft.date)) {
    errors.push(`Period ${draft.date.slice(0, 7)} is locked for this entity — reopen it in Financial Close to post here.`);
  }

  // Party requirement for sub-ledger voucher types.
  if (["sales", "purchase", "debit_note", "credit_note"].includes(draft.type) && !draft.partyId) {
    errors.push(`Select a ${def.partyKind === "vendor" ? "vendor" : "customer"} for this ${def.label.toLowerCase()}.`);
  }

  const usable = draft.lines.filter((l) => (Number(l.debit) || 0) !== 0 || (Number(l.credit) || 0) !== 0);
  if (usable.length < 2) errors.push("An entry needs at least two lines.");

  for (const [i, l] of usable.entries()) {
    const n = i + 1;
    const d = Number(l.debit) || 0;
    const c = Number(l.credit) || 0;
    if (!l.accountCode || !accountSafe(l.accountCode)) errors.push(`Line ${n}: choose a valid account.`);
    if (d < 0 || c < 0) errors.push(`Line ${n}: amounts cannot be negative.`);
    if (d > 0 && c > 0) errors.push(`Line ${n}: enter either a debit or a credit, not both.`);
    if (d === 0 && c === 0) errors.push(`Line ${n}: enter a debit or credit amount.`);
  }

  const { debit, credit, balanced } = entryTotals(usable);
  if (debit === 0 && credit === 0) {
    errors.push("The entry has no amounts.");
  } else if (!balanced) {
    errors.push(`Debits (${debit.toLocaleString("en-IN")}) must equal credits (${credit.toLocaleString("en-IN")}).`);
  }

  // Type-specific posting rules.
  const debits = usable.filter((l) => (Number(l.debit) || 0) > 0).map((l) => l.accountCode);
  const credits = usable.filter((l) => (Number(l.credit) || 0) > 0).map((l) => l.accountCode);
  switch (draft.type) {
    case "payment":
      if (!credits.some(isCash)) errors.push("Payment must credit a bank or cash account.");
      break;
    case "receipt":
      if (!debits.some(isCash)) errors.push("Receipt must debit a bank or cash account.");
      break;
    case "contra":
      if (!usable.every((l) => isCash(l.accountCode))) errors.push("Contra entries may only move between cash & bank accounts.");
      break;
    case "bank":
      if (![...debits, ...credits].some(isCash)) errors.push("A bank voucher must touch a bank or cash account.");
      break;
    case "sales":
      if (!credits.some((c) => accountType(c) === "income")) errors.push("Sales must credit an income account.");
      break;
    case "purchase":
      if (!debits.some((c) => accountType(c) === "expense" || c === INVENTORY)) errors.push("Purchase must debit an expense or inventory account.");
      break;
    case "credit_note":
      if (!credits.includes(AR)) errors.push("Credit note must credit Accounts Receivable (1100).");
      break;
    case "debit_note":
      if (!debits.includes(AP)) errors.push("Debit note must debit Accounts Payable (2010).");
      break;
    case "asset":
      if (!debits.some((c) => accountSubtype(c) === "Fixed Assets")) errors.push("Asset voucher must debit a Fixed Assets account.");
      break;
    case "stock":
      if (![...debits, ...credits].includes(INVENTORY)) errors.push("Stock journal must touch the Inventory account (1200).");
      break;
  }

  // Auto-reversal window.
  if (draft.autoReverse) {
    if (!draft.reverseDate) errors.push("Choose a reversal date for the auto-reversing entry.");
    else if (draft.reverseDate <= draft.date) errors.push("The reversal date must be after the posting date.");
  }

  return errors;
}

// ---- Voucher numbering (per type) -----------------------------------------

function maxSeqForPrefix(entries: ManualEntry[], prefix: string): number {
  const re = new RegExp(`^${prefix}-(\\d+)$`);
  let max = 0;
  for (const e of entries) {
    const m = re.exec(e.voucherNo);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return max;
}

export function nextVoucherNo(entries: ManualEntry[], type: VoucherType): string {
  const prefix = voucherType(type).prefix;
  return `${prefix}-${String(maxSeqForPrefix(entries, prefix) + 1).padStart(4, "0")}`;
}

// ---- Posting & reversal ---------------------------------------------------

export function createDraftEntry(draft: EntryDraft, nowIso: string): ManualEntry {
  return {
    ...draft,
    id: `draft-${nowIso}-${Math.random().toString(36).slice(2, 6)}`,
    voucherNo: "DRAFT",
    status: "draft",
    createdAt: nowIso,
  };
}

export function createEntry(draft: EntryDraft, existing: ManualEntry[], nowIso: string): ManualEntry {
  const lines = draft.lines
    .filter((l) => (Number(l.debit) || 0) !== 0 || (Number(l.credit) || 0) !== 0)
    .map((l) => ({ accountCode: l.accountCode, debit: round2(Number(l.debit) || 0), credit: round2(Number(l.credit) || 0) }));
  const prefix = voucherType(draft.type).prefix;
  return {
    ...draft,
    lines,
    id: `${prefix.toLowerCase()}-${maxSeqForPrefix(existing, prefix) + 1}-${nowIso}`,
    voucherNo: nextVoucherNo(existing, draft.type),
    status: "posted",
    createdAt: nowIso,
  };
}

export function buildReversal(original: ManualEntry, date: string): EntryDraft {
  return {
    type: original.type,
    date,
    narration: `Reversal of ${original.voucherNo} — ${original.narration}`,
    entityId: original.entityId,
    locationId: original.locationId,
    currency: original.currency,
    basis: original.basis,
    partyId: original.partyId,
    costCenter: original.costCenter,
    lines: original.lines.map((l) => ({ accountCode: l.accountCode, debit: l.credit, credit: l.debit })),
  };
}

// ---- Expansion to ledger postings -----------------------------------------

const basesFor = (b: EntryBasis): Basis[] => (b === "both" ? ["accrual", "cash"] : [b]);

export function expandManualEntries(entries: ManualEntry[]): Posting[] {
  const out: Posting[] = [];
  for (const e of entries) {
    if (e.status === "draft") continue;
    const loc = locationById(e.locationId);
    const state = loc?.state ?? "—";
    const def = voucherType(e.type);
    const category = e.reversalOf ? "Reversal" : def.category;
    const who = e.partyId ? ` · ${partyName(e.partyId)}` : "";
    const baseMemo = `${e.voucherNo} · ${e.narration}${who}`;

    const emit = (eventId: string, date: string, swap: boolean, memo: string, cat: string) => {
      for (const basis of basesFor(e.basis)) {
        e.lines.forEach((l, i) => {
          const debit = swap ? Number(l.credit) || 0 : Number(l.debit) || 0;
          const credit = swap ? Number(l.debit) || 0 : Number(l.credit) || 0;
          if (debit === 0 && credit === 0) return;
          out.push({
            id: `pst-${eventId}-${basis}-${i}`,
            eventId,
            date,
            accountCode: l.accountCode,
            debit,
            credit,
            entityId: e.entityId,
            locationId: e.locationId,
            state,
            currency: e.currency,
            basis,
            // Line-level narration (SAP item text) sharpens the GL memo when present.
            memo: l.memo ? `${memo} — ${l.memo}` : memo,
            category: cat,
          });
        });
      }
    };

    emit(`man-${e.id}`, e.date, false, baseMemo, category);
    // Auto-reversing accrual: post the offsetting entry on the reversal date.
    if (e.autoReverse && e.reverseDate) {
      emit(`man-${e.id}-auto`, e.reverseDate, true, `Auto-reversal of ${e.voucherNo}`, "Auto-reversal");
    }
  }
  return out;
}

export function isManualPosting(eventId: string): boolean {
  return eventId.startsWith("man-");
}

export function manualEntryIdFromPosting(eventId: string): string {
  return eventId.replace(/^man-/, "").replace(/-auto$/, "");
}

// ---- Party-wise balances (sub-ledger) -------------------------------------

/** Net AR/AP balance per party, derived from posted vouchers (base currency). */
export function partyBalances(entries: ManualEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) {
    if (!e.partyId) continue;
    for (const l of e.lines) {
      if (l.accountCode !== AR && l.accountCode !== AP) continue;
      // Receivable (AR) is debit-normal, payable (AP) credit-normal.
      const signed = (Number(l.debit) || 0) - (Number(l.credit) || 0);
      m.set(e.partyId, (m.get(e.partyId) ?? 0) + signed);
    }
  }
  return m;
}

// ---- Persistence (localStorage; SSR-guarded) ------------------------------

export function loadEntries(): ManualEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Back-fill the `type` for vouchers saved before voucher types existed.
    return (parsed as ManualEntry[]).map((e) => ({ ...e, type: e.type ?? "journal" }));
  } catch {
    return [];
  }
}

export function saveEntries(entries: ManualEntry[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch {}
}

export function currencyForEntity(entityId: string): string {
  return entityById(entityId)?.currency ?? "INR";
}
