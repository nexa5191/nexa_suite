// ---------------------------------------------------------------------------
// NEXA GSTR-2B ↔ Purchase-register (ITC) reconciliation.
//
// This is the matching finance teams actually pay for: compare the GSTR-2B
// auto-drafted by the GST portal (built from what the VENDOR filed) against the
// company's OWN purchase register (its recorded vendor bills), and classify
// every line so the ITC position is defensible.
//
// Two inputs:
//   1. Purchase register — derived from PURCHASE_ORDERS that carry an invoice,
//      with the vendor's GSTIN, taxable + GST split (intra → CGST+SGST, inter →
//      IGST). Blended rate: 18% on opex/services, 5% on inventory/raw materials.
//   2. GSTR-2B (as-downloaded) — a deterministic SEED that mostly mirrors the
//      register but carries realistic discrepancies (value mismatch, missing in
//      2B, missing in books, etc.).
//
// Matching: GSTIN + normalised invoice number, with an amount tolerance.
//
// No React, no I/O except the localStorage action helpers at the bottom
// (typeof-window guarded) — the maths renders identically on server & client.
// ---------------------------------------------------------------------------

import { PURCHASE_ORDERS, vendorById, type PurchaseOrder, type Vendor } from "@/lib/vendors";
import { entityById } from "@/lib/accounting/org";
import {
  natureOf,
  splitTax,
  stateCodeFromGstin,
  stateName,
  monthKeyOf,
  monthLabel,
  type GstSplit,
} from "@/lib/tax/gst";

const r2 = (n: number) => Math.round(n * 100) / 100;

// Entity state codes (Nexa Foods = Karnataka 29, Nexa Trading = Maharashtra 27).
// org.ts holds the entity GSTIN; the first two digits are the home state code.
function entityStateCode(entityId: string): string {
  const g = entityById(entityId)?.gstin;
  return g ? g.slice(0, 2) : "29";
}

/** Blended GST rate for a vendor: 5% on inventory/raw-materials, 18% on opex/services. */
export function blendedRate(vendor: Vendor | undefined): number {
  if (!vendor) return 18;
  return vendor.vClass === "Inventory" ? 5 : 18;
}

// ---------------------------------------------------------------------------
// 1. Purchase register (the company's books)
// ---------------------------------------------------------------------------

export interface BookBill {
  poId: string;
  vendorId: string;
  vendor: string;
  gstin: string;
  invoiceNo: string;
  date: string;
  period: string; // YYYY-MM
  entityId: string;
  rate: number;
  taxable: number;
  tax: number; // total GST
  cgst: number;
  sgst: number;
  igst: number;
  total: number; // invoice value incl. tax
}

/** Normalise an invoice number for matching — case-fold, drop non-alphanumerics. */
export function normInvoice(no: string): string {
  return no.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

function billFromPo(po: PurchaseOrder): BookBill | null {
  if (!po.invoice) return null;
  const vendor = vendorById(po.vendorId);
  const gstin = vendor?.gstin ?? "—";
  const rate = blendedRate(vendor);
  // po.invoice.amount is treated as the invoice's TAXABLE base; tax is computed on top.
  const taxable = po.invoice.amount;
  const supplierState = gstin.length >= 2 && gstin !== "—" ? stateCodeFromGstin(gstin) : entityStateCode(po.entityId);
  const nature = natureOf(supplierState, entityStateCode(po.entityId));
  const split: GstSplit = splitTax(taxable, rate, nature);
  return {
    poId: po.id,
    vendorId: po.vendorId,
    vendor: vendor?.name ?? "—",
    gstin,
    invoiceNo: po.invoice.number,
    date: po.invoice.date,
    period: monthKeyOf(po.invoice.date),
    entityId: po.entityId,
    rate,
    taxable: r2(split.taxable),
    tax: r2(split.tax),
    cgst: r2(split.cgst),
    sgst: r2(split.sgst),
    igst: r2(split.igst),
    total: r2(split.gross),
  };
}

/** The company's purchase register — every PO that has been invoiced. */
export const PURCHASE_BOOK: BookBill[] = PURCHASE_ORDERS
  .map(billFromPo)
  .filter((b): b is BookBill => b !== null);

// ---------------------------------------------------------------------------
// 2. GSTR-2B (as-downloaded from the portal — what vendors filed)
// ---------------------------------------------------------------------------
// Each row is keyed to a known vendor; taxable is the value the VENDOR filed.
// `itcEligible` follows the portal's "ITC available" flag (Y/N). We author this
// deterministically so the reconciliation tells a realistic story.

export interface B2bLine {
  vendorId: string;
  gstin: string;
  invoiceNo: string;
  date: string;
  taxable: number; // value the vendor filed
  itcEligible: boolean; // portal "ITC available" flag
}

const B2B_SEED: B2bLine[] = [];

// ---------------------------------------------------------------------------
// 3. Reconciliation engine
// ---------------------------------------------------------------------------

export type ReconStatus = "matched" | "mismatch" | "missing-in-2b" | "missing-in-books";

export const STATUS_META: Record<ReconStatus, { label: string; tone: "success" | "warning" | "danger" | "default"; blurb: string }> = {
  matched: { label: "Matched", tone: "success", blurb: "Books and 2B agree — ITC fully available." },
  mismatch: { label: "Value mismatch", tone: "warning", blurb: "Vendor filed a different value — reconcile before claiming." },
  "missing-in-2b": { label: "Missing in 2B", tone: "danger", blurb: "Recorded in books but the vendor hasn't filed — ITC at risk / blocked." },
  "missing-in-books": { label: "Missing in books", tone: "default", blurb: "In 2B but not recorded — an unbilled / unrecorded purchase." },
};

export interface ReconLine {
  id: string;
  status: ReconStatus;
  vendor: string;
  vendorId: string;
  gstin: string;
  invoiceNo: string;
  period: string; // YYYY-MM (from whichever side is present)
  date: string;
  rate: number;
  bookValue: number; // taxable per books (0 if missing in books)
  b2bValue: number; // taxable per 2B (0 if missing in 2B)
  bookTax: number;
  b2bTax: number;
  difference: number; // bookValue - b2bValue (taxable)
  itcEligible: boolean; // is the underlying ITC eligible (portal flag, default true for book-only)
  // the ITC amount this line contributes to the "available" pool once accepted
  itcAmount: number;
  note: string;
}

// Amount tolerance for treating a value difference as a match (rounding / minor).
export const MATCH_TOLERANCE = 2000;

/** Compute the tax a 2B line would carry, using the book bill's nature/rate. */
function b2bTaxFor(line: B2bLine, entityStateCode: string, rate: number): number {
  const supplierState = stateCodeFromGstin(line.gstin);
  const nature = natureOf(supplierState, entityStateCode);
  return r2(splitTax(line.taxable, rate, nature).tax);
}

export interface ReconResult {
  period: string; // selected period key, or "all"
  entityId: string; // selected entity, or "all"
  lines: ReconLine[];
  // ITC summary
  itcAsPerBooks: number; // total eligible ITC in the books
  itcAsPer2b: number; // total eligible ITC reflected in 2B
  itcAvailable: number; // matched + (mismatch capped at 2B) — what's safely claimable
  itcAtRisk: number; // missing-in-2b → vendor hasn't filed
  itcToReverse: number; // mismatch shortfall (book > 2B) that must not be over-claimed
  netClaimable: number; // itcAvailable
  matchedCount: number;
  totalCount: number;
  matchedPct: number; // % of book lines that matched
}

export const ALL_PERIOD = "all";

/** Distinct monthly periods present across books + 2B, newest first. */
export function availablePeriods(): { key: string; label: string }[] {
  const set = new Set<string>();
  for (const b of PURCHASE_BOOK) set.add(b.period);
  for (const l of B2B_SEED) set.add(monthKeyOf(l.date));
  return Array.from(set)
    .sort((a, b) => b.localeCompare(a))
    .map((key) => ({ key, label: monthLabel(key) }));
}

/** Entities that appear in the purchase book. */
export function bookEntities(): { id: string; name: string }[] {
  const ids = Array.from(new Set(PURCHASE_BOOK.map((b) => b.entityId)));
  return ids.map((id) => ({ id, name: entityById(id)?.name ?? id }));
}

export function placeLabelFor(gstin: string): string {
  if (!gstin || gstin === "—") return "—";
  return stateName(stateCodeFromGstin(gstin));
}

/**
 * Run the reconciliation for a period + entity filter.
 * `period` is "all" or a YYYY-MM key; `entityId` is "all" or an entity id.
 */
export function reconcile(period: string = ALL_PERIOD, entityId: string = ALL_PERIOD): ReconResult {
  const inPeriod = (p: string) => period === ALL_PERIOD || p === period;
  const inEntity = (e: string) => entityId === ALL_PERIOD || e === entityId;

  const books = PURCHASE_BOOK.filter((b) => inPeriod(b.period) && inEntity(b.entityId));
  // 2B is keyed to vendor; tie each 2B row to an entity via the book bill if any,
  // else infer the entity from the vendor's first book bill so entity filtering works.
  const vendorEntity = new Map<string, string>();
  for (const b of PURCHASE_BOOK) if (!vendorEntity.has(b.vendorId)) vendorEntity.set(b.vendorId, b.entityId);

  const twob = B2B_SEED.filter((l) => {
    const p = monthKeyOf(l.date);
    const e = vendorEntity.get(l.vendorId) ?? "ent-nexa-in";
    return inPeriod(p) && inEntity(e);
  });

  const lines: ReconLine[] = [];
  const usedB2b = new Set<number>();

  // Pass 1: walk the books, find a matching 2B line by GSTIN + normalised invoice.
  for (const b of books) {
    const idx = twob.findIndex((l, i) =>
      !usedB2b.has(i) &&
      l.gstin === b.gstin &&
      normInvoice(l.invoiceNo) === normInvoice(b.invoiceNo),
    );
    const eState = entityStateCode(b.entityId);

    if (idx === -1) {
      // No 2B counterpart → ITC at risk.
      lines.push({
        id: `recon-${b.poId}`,
        status: "missing-in-2b",
        vendor: b.vendor,
        vendorId: b.vendorId,
        gstin: b.gstin,
        invoiceNo: b.invoiceNo,
        period: b.period,
        date: b.date,
        rate: b.rate,
        bookValue: b.taxable,
        b2bValue: 0,
        bookTax: b.tax,
        b2bTax: 0,
        difference: r2(b.taxable),
        itcEligible: true,
        itcAmount: 0, // not available until the vendor files
        note: "Recorded in books but not auto-drafted in GSTR-2B — vendor has not filed. ITC at risk.",
      });
      continue;
    }

    usedB2b.add(idx);
    const l = twob[idx];
    const b2bTax = b2bTaxFor(l, eState, b.rate);
    const diff = r2(b.taxable - l.taxable);
    const matched = Math.abs(diff) <= MATCH_TOLERANCE;
    const eligible = l.itcEligible;

    if (matched && eligible) {
      lines.push({
        id: `recon-${b.poId}`,
        status: "matched",
        vendor: b.vendor,
        vendorId: b.vendorId,
        gstin: b.gstin,
        invoiceNo: b.invoiceNo,
        period: b.period,
        date: b.date,
        rate: b.rate,
        bookValue: b.taxable,
        b2bValue: l.taxable,
        bookTax: b.tax,
        b2bTax,
        difference: diff,
        itcEligible: true,
        itcAmount: b.tax, // fully claimable
        note: "Books and 2B agree within tolerance — ITC fully available.",
      });
    } else {
      // Value mismatch (or 2B flags ITC ineligible). Safe ITC = the lower of the two.
      const safeTax = eligible ? Math.min(b.tax, b2bTax) : 0;
      lines.push({
        id: `recon-${b.poId}`,
        status: "mismatch",
        vendor: b.vendor,
        vendorId: b.vendorId,
        gstin: b.gstin,
        invoiceNo: b.invoiceNo,
        period: b.period,
        date: b.date,
        rate: b.rate,
        bookValue: b.taxable,
        b2bValue: l.taxable,
        bookTax: b.tax,
        b2bTax,
        difference: diff,
        itcEligible: eligible,
        itcAmount: safeTax,
        note: eligible
          ? `Vendor filed a different value (Δ ${diff > 0 ? "books higher" : "2B higher"}). Claim limited to the matched portion.`
          : "GSTR-2B marks this credit ineligible — do not claim until corrected.",
      });
    }
  }

  // Pass 2: any 2B rows never matched → in 2B but not in books.
  twob.forEach((l, i) => {
    if (usedB2b.has(i)) return;
    const vendor = vendorById(l.vendorId);
    const rate = blendedRate(vendor);
    const eState = vendorEntity.has(l.vendorId)
      ? entityStateCode(vendorEntity.get(l.vendorId)!)
      : "29";
    const b2bTax = b2bTaxFor(l, eState, rate);
    lines.push({
      id: `recon-2b-${normInvoice(l.invoiceNo)}`,
      status: "missing-in-books",
      vendor: vendor?.name ?? "—",
      vendorId: l.vendorId,
      gstin: l.gstin,
      invoiceNo: l.invoiceNo,
      period: monthKeyOf(l.date),
      date: l.date,
      rate,
      bookValue: 0,
      b2bValue: l.taxable,
      bookTax: 0,
      b2bTax,
      difference: r2(-l.taxable),
      itcEligible: l.itcEligible,
      itcAmount: 0, // can't claim until it's booked
      note: "Appears in GSTR-2B but not recorded in the purchase register — book the vendor bill to claim.",
    });
  });

  // Sort: by status severity then vendor for a stable, readable order.
  const order: Record<ReconStatus, number> = { mismatch: 0, "missing-in-2b": 1, matched: 2, "missing-in-books": 3 };
  lines.sort((a, b) => order[a.status] - order[b.status] || a.vendor.localeCompare(b.vendor));

  // ---- ITC summary ----
  const itcAsPerBooks = r2(books.reduce((s, b) => s + b.tax, 0));
  const itcAsPer2b = r2(
    twob.reduce((s, l) => {
      if (!l.itcEligible) return s;
      const e = vendorEntity.has(l.vendorId) ? entityStateCode(vendorEntity.get(l.vendorId)!) : "29";
      return s + b2bTaxFor(l, e, blendedRate(vendorById(l.vendorId)));
    }, 0),
  );

  const itcAvailable = r2(lines.reduce((s, ln) => s + ln.itcAmount, 0));
  const itcAtRisk = r2(
    lines.filter((l) => l.status === "missing-in-2b").reduce((s, l) => s + l.bookTax, 0),
  );
  const itcToReverse = r2(
    lines
      .filter((l) => l.status === "mismatch")
      .reduce((s, l) => s + Math.max(0, l.bookTax - l.itcAmount), 0),
  );

  const bookLineCount = lines.filter((l) => l.status !== "missing-in-books").length;
  const matchedCount = lines.filter((l) => l.status === "matched").length;
  const matchedPct = bookLineCount === 0 ? 0 : Math.round((matchedCount / bookLineCount) * 100);

  return {
    period,
    entityId,
    lines,
    itcAsPerBooks,
    itcAsPer2b,
    itcAvailable,
    itcAtRisk,
    itcToReverse,
    netClaimable: itcAvailable,
    matchedCount,
    totalCount: lines.length,
    matchedPct,
  };
}

// ---------------------------------------------------------------------------
// 3b. Vendor grouping — for sharing a reconciliation statement with a vendor
// ---------------------------------------------------------------------------

export interface VendorReconGroup {
  vendorId: string;
  vendor: string;
  gstin: string;
  lines: ReconLine[];
  /** Lines where the vendor must act — value mismatches + invoices they haven't filed. */
  discrepancyCount: number;
  itcAtRisk: number; // book tax stuck because the vendor hasn't filed
}

/** Group a reconciliation result by vendor, for per-vendor statements. */
export function vendorGroups(result: ReconResult): VendorReconGroup[] {
  const map = new Map<string, ReconLine[]>();
  for (const l of result.lines) {
    const arr = map.get(l.vendorId) ?? [];
    arr.push(l);
    map.set(l.vendorId, arr);
  }
  const groups: VendorReconGroup[] = [];
  for (const [vendorId, lines] of map) {
    const discrepancyCount = lines.filter(
      (l) => l.status === "mismatch" || l.status === "missing-in-2b",
    ).length;
    const itcAtRisk = r2(
      lines.filter((l) => l.status === "missing-in-2b").reduce((s, l) => s + l.bookTax, 0),
    );
    groups.push({
      vendorId,
      vendor: lines[0].vendor,
      gstin: lines[0].gstin,
      lines,
      discrepancyCount,
      itcAtRisk,
    });
  }
  // Vendors with the most to fix first.
  return groups.sort((a, b) => b.discrepancyCount - a.discrepancyCount || a.vendor.localeCompare(b.vendor));
}

// ---------------------------------------------------------------------------
// 4. Persistence — per-line user action (accept ITC / reject / follow-up)
// ---------------------------------------------------------------------------

export type LineAction = "accept" | "followup" | "reject";

export type ActionStore = Record<string, LineAction>; // recon line id → action

export const GSTR2B_KEY = "nexa-gstr2b";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}
function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const loadActions = (): ActionStore => read<ActionStore>(GSTR2B_KEY, {});
export const saveActions = (a: ActionStore) => write(GSTR2B_KEY, a);

export const ACTION_META: Record<LineAction, { label: string; tone: "success" | "warning" | "danger" }> = {
  accept: { label: "ITC accepted", tone: "success" },
  followup: { label: "Following up", tone: "warning" },
  reject: { label: "ITC rejected", tone: "danger" },
};
