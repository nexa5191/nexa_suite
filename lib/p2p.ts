// ---------------------------------------------------------------------------
// NEXA Procure-to-Pay (P2P) trail — the 3-way-match lifecycle that turns a
// purchase order into goods received (GRN), then a booked vendor bill, then a
// payment. Every step posts a REAL double-entry voucher to the GL:
//
//   1. PO raised        — the order (lib/vendors.ts), no GL impact yet.
//   2. GRN (receipt)    — Dr Inventory / Expense / Fixed-Asset (ex-GST value)
//                         Cr GRNI clearing (2015).            [journal voucher]
//   3. Invoice booked   — Dr GRNI (clears it) + Dr GST Input (1300)
//                         Cr Accounts Payable (2010), gross.  [journal voucher]
//   4. Payment          — Dr AP / Cr Bank (− TDS) via Pay Bills.
//
// The PO total is treated as the GST-INCLUSIVE bill value so AP reconciles with
// what Pay Bills settles: taxable = total / (1 + rate), gst = total − taxable.
// A Capex GRN additionally capitalises a fixed asset (an "addition" in the
// register) for the ex-GST value.
//
// State (which steps are posted, and the voucher each produced) persists to
// localStorage under `nexa-p2p-state`, keyed by PO id.
// ---------------------------------------------------------------------------

import type { EntryDraft } from "@/lib/accounting/manual-entries";
import type { PurchaseOrder, VendorClass, VendorCategory, Vendor } from "@/lib/vendors";
import type { FixedAsset, AssetCategory } from "@/lib/assets/assets";
import { nextAssetTag, categoryMeta } from "@/lib/assets/assets";

// ---- GL accounts -----------------------------------------------------------
export const GRNI = "2015"; // Goods Received Not Invoiced (clearing)
export const GST_INPUT = "1300";
export const AP = "2010";
const INVENTORY = "1200";

/** Where a GRN debit lands, by vendor procurement class + descriptive category. */
const GRN_DEBIT_BY_CATEGORY: Record<VendorCategory, string> = {
  "Raw Materials": INVENTORY,
  Packaging: INVENTORY,
  Logistics: "5020", // Freight Inward
  "IT & Software": "6060", // Software & Subscriptions
  Marketing: "6040", // Marketing & Advertising
  Services: "6050", // Professional Fees
  "Capital Equipment": "1500", // Plant & Equipment
  "Office Equipment": "1510", // Furniture & Fixtures
  "Employee Claims": "6035", // Office & Admin
};

/** Capex vendor category → fixed-asset register category (for the addition). */
const ASSET_CATEGORY_BY_VENDOR: Partial<Record<VendorCategory, AssetCategory>> = {
  "Capital Equipment": "Plant & Machinery",
  "Office Equipment": "Office Equipment",
};

export function grnDebitAccount(vendor: Vendor | undefined): string {
  if (!vendor) return INVENTORY;
  return GRN_DEBIT_BY_CATEGORY[vendor.category] ?? INVENTORY;
}

export function isCapex(vendor: Vendor | undefined): boolean {
  return vendor?.vClass === "Capex";
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Split a GST-inclusive total into ex-GST taxable + GST. rate 0 → no GST. */
export function splitInclusive(total: number, rate: number): { taxable: number; gst: number; gross: number } {
  const taxable = rate > 0 ? r2(total / (1 + rate / 100)) : r2(total);
  const gst = r2(total - taxable);
  return { taxable, gst, gross: r2(total) };
}

// ---- per-PO trail state ----------------------------------------------------
export interface GrnPosted {
  date: string;
  voucherNo: string;
  account: string; // the debit account used
  taxable: number;
  assetId?: string; // set when a Capex GRN capitalised an asset
  assetTag?: string;
}
export interface InvoicePosted {
  date: string;
  voucherNo: string;
  number: string; // vendor bill number
  rate: number; // GST rate applied
  taxable: number;
  gst: number;
  gross: number;
}
export interface P2PEntry {
  grn?: GrnPosted;
  invoice?: InvoicePosted;
}
export type P2PStore = Record<string, P2PEntry>;

const P2P_KEY = "nexa-p2p-state";

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

export const loadP2P = () => read<P2PStore>(P2P_KEY, {});
export const saveP2P = (s: P2PStore) => write(P2P_KEY, s);

// ---- trail stage -----------------------------------------------------------
export type P2PStage = "ordered" | "received" | "invoiced" | "paid";

export const STAGE_ORDER: P2PStage[] = ["ordered", "received", "invoiced", "paid"];

export const STAGE_META: Record<P2PStage, { label: string; step: string }> = {
  ordered: { label: "PO raised", step: "Order" },
  received: { label: "Goods received", step: "GRN" },
  invoiced: { label: "Invoice booked", step: "Bill" },
  paid: { label: "Paid", step: "Pay" },
};

/**
 * Derive the live trail stage. The seed status (issued/invoiced/paid) provides
 * the starting context; posted GRN/invoice vouchers and recorded payments move
 * it forward. `paid` wins once the bill's outstanding hits zero.
 */
export function p2pStage(
  po: PurchaseOrder,
  st: P2PEntry | undefined,
  paid: number,
): P2PStage {
  const billed = !!st?.invoice || (!!po.invoice && po.status !== "issued");
  const billAmount = st?.invoice?.gross ?? po.invoice?.amount ?? po.total;
  if (po.status === "paid") return "paid";
  if (billed && paid >= billAmount - 0.5) return "paid";
  if (billed) return "invoiced";
  if (st?.grn) return "received";
  return "ordered";
}

/** Has this PO's invoice come from the live GL trail (vs. a pre-GL seed bill)? */
export function isSeedBill(po: PurchaseOrder, st: P2PEntry | undefined): boolean {
  return !st?.invoice && !!po.invoice && po.status !== "issued";
}

// ---- 3-way match (PO · GRN · bill) -----------------------------------------
export const DEFAULT_MATCH_TOLERANCE_PCT = 2;

export interface MatchResult {
  matched: boolean;
  billAmount: number;
  variance: number; // abs INR vs PO total
  variancePct: number; // % of PO total
  grnReceived: boolean;
  way: 2 | 3; // 3-way when a GRN exists, else 2-way (PO ↔ bill)
  reason: string;
}

/**
 * Compare a vendor bill to its PO (and GRN, if received) for auto-approval.
 * The bill matches when its amount is within tolerance of the PO total; a posted
 * GRN promotes this from a 2-way to a full 3-way verification.
 */
export function matchPoInvoice(
  po: PurchaseOrder,
  st: P2PEntry | undefined,
  tolerancePct: number = DEFAULT_MATCH_TOLERANCE_PCT,
): MatchResult {
  const billAmount = r2(st?.invoice?.gross ?? po.invoice?.amount ?? 0);
  const variance = r2(Math.abs(billAmount - po.total));
  const variancePct = po.total > 0 ? r2((variance / po.total) * 100) : billAmount > 0 ? 100 : 0;
  const grnReceived = !!st?.grn;
  const matched = variancePct <= tolerancePct;
  const way: 2 | 3 = grnReceived ? 3 : 2;
  const reason = matched
    ? grnReceived
      ? "3-way match — PO, GRN & bill agree"
      : "PO ↔ bill match"
    : `Variance ${variancePct}% exceeds ${tolerancePct}% tolerance`;
  return { matched, billAmount, variance, variancePct, grnReceived, way, reason };
}

// ---- voucher drafts --------------------------------------------------------
const line = (accountCode: string, debit: number, credit: number) => ({
  accountCode,
  debit: r2(debit),
  credit: r2(credit),
});

/**
 * GRN voucher — receipt of goods/services/asset against the PO at ex-GST value.
 * Dr <debitAccount> / Cr GRNI clearing.
 */
export function buildGrnDraft(
  po: PurchaseOrder,
  vendor: Vendor | undefined,
  date: string,
  taxable: number,
): EntryDraft {
  const acct = grnDebitAccount(vendor);
  return {
    type: "journal",
    date,
    narration: `GRN ${po.id} · Goods received from ${vendor?.name ?? "vendor"} — ${po.title}`,
    entityId: po.entityId,
    locationId: po.locationId,
    currency: "INR",
    basis: "accrual",
    lines: [line(acct, taxable, 0), line(GRNI, 0, taxable)],
  };
}

/**
 * Invoice-booking voucher — vendor bill received. Clears GRNI, books the input
 * GST credit, raises the payable. Dr GRNI + Dr GST Input / Cr AP (gross).
 */
export function buildInvoiceDraft(
  po: PurchaseOrder,
  vendor: Vendor | undefined,
  date: string,
  billNo: string,
  taxable: number,
  gst: number,
): EntryDraft {
  const gross = r2(taxable + gst);
  const lines = [line(GRNI, taxable, 0)];
  if (gst > 0) lines.push(line(GST_INPUT, gst, 0));
  lines.push(line(AP, 0, gross));
  return {
    type: "journal",
    date,
    narration: `Bill ${billNo} · ${vendor?.name ?? "vendor"} against ${po.id}`,
    entityId: po.entityId,
    locationId: po.locationId,
    currency: "INR",
    basis: "accrual",
    lines,
  };
}

/** Build the fixed-asset record a Capex GRN capitalises (caller persists it). */
export function buildAssetFromPo(
  po: PurchaseOrder,
  vendor: Vendor | undefined,
  date: string,
  cost: number,
  created: FixedAsset[],
): FixedAsset {
  const category = (vendor && ASSET_CATEGORY_BY_VENDOR[vendor.category]) ?? "Plant & Machinery";
  const meta = categoryMeta(category);
  const { id, tag } = nextAssetTag(created);
  return {
    id,
    tag,
    name: po.title,
    category,
    entityId: po.entityId,
    locationId: po.locationId,
    acquisitionDate: date,
    cost: r2(cost),
    salvage: Math.round((cost * 5) / 100),
    usefulLifeYears: meta.defaultLife,
    method: meta.defaultMethod,
    annualBenefit: 0,
    supplier: vendor?.name,
  };
}
