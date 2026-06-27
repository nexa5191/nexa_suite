// ---------------------------------------------------------------------------
// NEXA Invoicing — GST-compliant sales invoices (accounts receivable).
//
// Bill-to comes from the CRM account master (lib/crm.ts). Amounts are stored in
// base currency (INR) like the rest of NEXA and converted at render time.
//
// GST treatment is derived from the issuing entity's state vs the customer's
// place of supply: intra-state → CGST + SGST, inter-state → IGST, and an
// overseas customer / Nexa Global → zero-rated export.
//
// Persistence (client-side):
//   nexa-invoices        → user-created invoices (array)
//   nexa-invoice-status  → status overrides for any invoice (Record<id, status>)
// ---------------------------------------------------------------------------

import { ACCOUNTS, accountById, type CrmAccount } from "@/lib/crm";
import { ENTITIES, entityById } from "@/lib/accounting/org";

export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue";

export const INVOICE_STATUSES: { key: InvoiceStatus; label: string; variant: "default" | "primary" | "warning" | "success" | "danger" }[] = [
  { key: "draft", label: "Draft", variant: "default" },
  { key: "sent", label: "Sent", variant: "primary" },
  { key: "partial", label: "Part-paid", variant: "warning" },
  { key: "paid", label: "Paid", variant: "success" },
  { key: "overdue", label: "Overdue", variant: "danger" },
];

export function statusMeta(s: InvoiceStatus) {
  return INVOICE_STATUSES.find((x) => x.key === s) ?? INVOICE_STATUSES[0];
}

export interface InvoiceLine {
  desc: string;
  hsn: string;
  qty: number;
  rate: number; // base INR per unit
  gstRate: number; // %
  itemId?: string; // linked finished-good SKU → drives stock dispatch on save
}

export type DiscountType = "none" | "percent" | "amount";

export interface BillToOverride {
  name?: string;
  address?: string;
  gstin?: string;
}

export interface Invoice {
  id: string;
  number: string;
  accountId: string;
  entityId: string;
  date: string; // ISO
  dueDate: string; // ISO
  status: InvoiceStatus;
  lines: InvoiceLine[];
  discountType: DiscountType;
  discountValue: number;
  notes: string;
  signatoryId: string; // employee
  billTo?: BillToOverride; // optional manual override of the account's bill-to
  // Multi-currency: if currency is set and not INR, fxRate (INR per 1 FC unit) is required.
  // All line rates are in the invoice currency; GL posting converts to INR at fxRate.
  currency?: string;   // ISO 4217 e.g. "USD", "EUR". Omit or "INR" = domestic
  fxRate?: number;     // INR per 1 unit of currency (e.g. 83.5 for USD)
}

// ---- per-entity invoice number prefix & state ----
const ENTITY_PREFIX: Record<string, string> = {};
const ENTITY_STATE_CODE: Record<string, string> = {};
const ENTITY_BANK: Record<string, string> = {};
const ENTITY_ADDRESS: Record<string, string> = {};

export interface Letterhead {
  name: string;
  legalName: string;
  gstin: string;
  address: string;
  bank: string;
  stateCode: string;
}

export function entityLetterhead(entityId: string): Letterhead {
  const e = entityById(entityId);
  return {
    name: e?.name ?? "—",
    legalName: e?.legalName ?? e?.name ?? "—",
    gstin: e?.gstin ?? "",
    address: ENTITY_ADDRESS[entityId] ?? "",
    bank: ENTITY_BANK[entityId] ?? "",
    stateCode: entityStateCode(entityId),
  };
}

export const FY_LABEL = "26-27";

export function entityPrefix(entityId: string) {
  return ENTITY_PREFIX[entityId] ?? "NX";
}
export function entityStateCode(entityId: string) {
  return ENTITY_STATE_CODE[entityId] ?? "29";
}
export function entityBank(entityId: string) {
  return ENTITY_BANK[entityId] ?? "";
}

export type GstTreatment = "intra" | "inter" | "export";

export function gstTreatment(entityId: string, customerStateCode: string): GstTreatment {
  const es = entityStateCode(entityId);
  if (es === "SG" || customerStateCode === "SG") return "export";
  return es === customerStateCode ? "intra" : "inter";
}

export interface InvoiceTotals {
  subtotal: number;
  discountAmt: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  totalTax: number;
  total: number;
  treatment: GstTreatment;
}

/** Core money engine — discount is applied proportionally before GST. */
export function computeTotals(
  lines: InvoiceLine[],
  discountType: DiscountType,
  discountValue: number,
  treatment: GstTreatment,
): InvoiceTotals {
  const subtotal = lines.reduce((s, l) => s + l.qty * l.rate, 0);
  const discountAmt =
    discountType === "amount"
      ? Math.min(discountValue || 0, subtotal)
      : discountType === "percent"
      ? (subtotal * (discountValue || 0)) / 100
      : 0;
  const frac = subtotal > 0 ? 1 - discountAmt / subtotal : 1;

  let cgst = 0, sgst = 0, igst = 0, taxable = 0;
  for (const l of lines) {
    const base = l.qty * l.rate * frac;
    taxable += base;
    if (treatment === "export") continue;
    const tax = (base * l.gstRate) / 100;
    if (treatment === "intra") {
      cgst += tax / 2;
      sgst += tax / 2;
    } else {
      igst += tax;
    }
  }
  const totalTax = cgst + sgst + igst;
  return {
    subtotal,
    discountAmt,
    taxable,
    cgst,
    sgst,
    igst,
    totalTax,
    total: taxable + totalTax,
    treatment,
  };
}

export function invoiceTotal(inv: Invoice): number {
  const acc = accountById(inv.accountId);
  const treatment = gstTreatment(inv.entityId, acc?.stateCode ?? "29");
  return computeTotals(inv.lines, inv.discountType, inv.discountValue, treatment).total;
}

// ---------------------------------------------------------------------------
// Number → words (Indian system) — for the "amount in words" line.
// ---------------------------------------------------------------------------
const ONES = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoWords(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? " " + ONES[n % 10] : ""}`;
}
function threeWords(n: number): string {
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${h ? ONES[h] + " Hundred" : ""}${h && rest ? " " : ""}${rest ? twoWords(rest) : ""}`.trim();
}
export function indianWords(n: number): string {
  n = Math.round(n);
  if (n === 0) return "Zero";
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const parts: string[] = [];
  if (crore) parts.push(`${twoWords(crore)} Crore`);
  if (lakh) parts.push(`${twoWords(lakh)} Lakh`);
  if (thousand) parts.push(`${twoWords(thousand)} Thousand`);
  if (n) parts.push(threeWords(n));
  return parts.join(" ");
}
function intlWords(n: number): string {
  n = Math.round(n);
  if (n === 0) return "Zero";
  const million = Math.floor(n / 1000000); n %= 1000000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const parts: string[] = [];
  if (million) parts.push(`${threeWords(million)} Million`);
  if (thousand) parts.push(`${threeWords(thousand)} Thousand`);
  if (n) parts.push(threeWords(n));
  return parts.join(" ");
}

/** Amount-in-words in the active display currency. */
export function amountInWords(value: number, currencyCode: string, currencyName: string): string {
  const plural = ["USD", "GBP", "EUR", "SGD", "AED"].includes(currencyCode) ? "s" : "";
  const words = currencyCode === "INR" ? indianWords(value) : intlWords(value);
  return `${currencyName}${plural} ${words} Only`;
}

// ---------------------------------------------------------------------------
// Seed invoices
// ---------------------------------------------------------------------------
export const SEED_INVOICES: Invoice[] = [];

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
export const INVOICES_KEY = "nexa-invoices";
export const INVOICE_STATUS_KEY = "nexa-invoice-status";

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

export const loadCreatedInvoices = () => read<Invoice[]>(INVOICES_KEY, []);
export const saveCreatedInvoices = (i: Invoice[]) => write(INVOICES_KEY, i);

export const loadStatusOverrides = () => read<Record<string, InvoiceStatus>>(INVOICE_STATUS_KEY, {});
export const saveStatusOverrides = (s: Record<string, InvoiceStatus>) => write(INVOICE_STATUS_KEY, s);

// Cumulative amount received against each invoice (drives part-payment & the
// Receive Payment allocation screen). Keyed by invoice id → INR received.
export const INVOICE_PAYMENTS_KEY = "nexa-invoice-payments";
export const loadInvoicePayments = () => read<Record<string, number>>(INVOICE_PAYMENTS_KEY, {});
export const saveInvoicePayments = (p: Record<string, number>) => write(INVOICE_PAYMENTS_KEY, p);

/** Amount still due on an invoice after part-payments. */
export function outstandingOf(inv: Invoice, payments: Record<string, number>): number {
  return Math.max(0, Math.round(invoiceTotal(inv) - (payments[inv.id] ?? 0)));
}

/** Seed + created invoices, newest first. */
export function allInvoices(created: Invoice[]): Invoice[] {
  return [...SEED_INVOICES, ...created].sort((a, b) => b.date.localeCompare(a.date));
}

export function effectiveStatus(inv: Invoice, overrides: Record<string, InvoiceStatus>): InvoiceStatus {
  return overrides[inv.id] ?? inv.status;
}

/** Next sequential invoice number for an entity across seed + created. */
export function nextInvoiceNumber(entityId: string, created: Invoice[]): string {
  const prefix = entityPrefix(entityId);
  const all = [...SEED_INVOICES, ...created].filter((i) => i.entityId === entityId);
  let max = 100;
  for (const i of all) {
    const m = i.number.match(/\/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `${prefix}/${FY_LABEL}/${String(max + 1).padStart(4, "0")}`;
}

/** Convenience for the builder — every entity the firm can invoice from. */
export function billingEntities() {
  return ENTITIES;
}

export function accountsForEntity(entityId: string): CrmAccount[] {
  return ACCOUNTS.filter((a) => a.entityId === entityId);
}

export { accountById, entityById };
