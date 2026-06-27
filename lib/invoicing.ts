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
const ENTITY_PREFIX: Record<string, string> = {
  "ent-nexa-in": "NXF",
  "ent-nexa-trade": "NXT",
  "ent-nexa-global": "NXG",
};
const ENTITY_STATE_CODE: Record<string, string> = {
  "ent-nexa-in": "29", // Karnataka
  "ent-nexa-trade": "27", // Maharashtra
  "ent-nexa-global": "SG", // Singapore (export)
};
const ENTITY_BANK: Record<string, string> = {
  "ent-nexa-in": "HDFC Bank · A/c 5011 2233 4455 · IFSC HDFC0000291 · UPI nexafoods@hdfcbank",
  "ent-nexa-trade": "ICICI Bank · A/c 6022 7788 1122 · IFSC ICIC0000271 · UPI nexatrading@icici",
  "ent-nexa-global": "DBS Bank · A/c 0012-345678 · SWIFT DBSSSGSG",
};
const ENTITY_ADDRESS: Record<string, string> = {
  "ent-nexa-in": "No. 42, 1st Main, Koramangala Industrial Layout, Bengaluru 560095 · accounts@nexafoods.in · +91 80 4123 7000",
  "ent-nexa-trade": "Unit 3, Andheri-Kurla Road, Sakinaka, Mumbai 400072 · billing@nexatrading.in · +91 22 4567 9000",
  "ent-nexa-global": "8 Marina Boulevard #21-03, Marina Bay Financial Centre, Singapore 018981 · finance@nexa.global · +65 6800 1200",
};

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

interface RawInvoice {
  acc: string;
  seq: number;
  date: string;
  due: string;
  status: InvoiceStatus;
  signatory: string;
  fy?: string; // FY label for the invoice number (defaults to the current FY)
  discountType?: DiscountType;
  discountValue?: number;
  notes?: string;
  lines: InvoiceLine[];
}

const L = (desc: string, hsn: string, qty: number, rate: number, gstRate: number): InvoiceLine => ({ desc, hsn, qty, rate, gstRate });

const RAW_INVOICES: RawInvoice[] = [
  {
    acc: "acc-001", seq: 1, date: "2026-05-16", due: "2026-05-31", status: "paid", signatory: "emp-002",
    lines: [L("Wheat flour (50kg bag)", "1101", 120, 1850, 5), L("Sunflower oil (15L tin)", "1512", 80, 1650, 5)],
    notes: "Fortnightly supply — first half of May.",
  },
  {
    acc: "acc-001", seq: 2, date: "2026-06-01", due: "2026-06-16", status: "sent", signatory: "emp-002",
    lines: [L("Wheat flour (50kg bag)", "1101", 140, 1850, 5), L("Basmati rice (25kg)", "1006", 60, 2400, 5), L("Sunflower oil (15L tin)", "1512", 90, 1650, 5)],
    notes: "Fortnightly supply — second half of May.",
  },
  {
    acc: "acc-002", seq: 1, date: "2026-05-10", due: "2026-05-25", status: "paid", signatory: "emp-002",
    discountType: "percent", discountValue: 4,
    lines: [L("Specialty 00 flour (25kg)", "1101", 40, 2200, 5), L("Extra-virgin olive oil (5L)", "1509", 30, 4200, 12)],
    notes: "Monthly standing order. 4% loyalty discount applied.",
  },
  {
    acc: "acc-002", seq: 2, date: "2026-06-02", due: "2026-06-17", status: "overdue", signatory: "emp-002",
    discountType: "percent", discountValue: 4,
    lines: [L("Specialty 00 flour (25kg)", "1101", 45, 2200, 5), L("Durum semolina (25kg)", "1103", 25, 1900, 5)],
  },
  {
    acc: "acc-004", seq: 1, date: "2026-06-03", due: "2026-06-18", status: "sent", signatory: "emp-002",
    lines: [L("Private-label atta (10kg)", "1101", 500, 360, 5), L("Packaging & labelling", "9989", 1, 28000, 18)],
    notes: "Trial run for the private-label SKU.",
  },
  {
    acc: "acc-006", seq: 1, date: "2026-05-28", due: "2026-06-27", status: "sent", signatory: "emp-002",
    lines: [L("Organic rice — 20ft container (FOB)", "1006", 1, 980000, 0), L("Assorted spices — pallet", "0910", 12, 18500, 0)],
    notes: "Export — zero-rated under LUT. Incoterms: FOB Chennai.",
  },

  // ---- History: FreshMart (acc-001) — fortnightly staples, FY24-25 & FY25-26
  {
    acc: "acc-001", seq: 11, date: "2024-10-15", due: "2024-10-30", status: "paid", signatory: "emp-002", fy: "24-25",
    lines: [L("Wheat flour (50kg bag)", "1101", 100, 1850, 5), L("Sunflower oil (15L tin)", "1512", 60, 1650, 5)],
    notes: "First contract shipment.",
  },
  {
    acc: "acc-001", seq: 12, date: "2024-12-12", due: "2024-12-27", status: "paid", signatory: "emp-002", fy: "24-25",
    lines: [L("Wheat flour (50kg bag)", "1101", 130, 1850, 5), L("Atta (10kg)", "1101", 400, 360, 5)],
  },
  {
    acc: "acc-001", seq: 13, date: "2025-02-14", due: "2025-03-01", status: "paid", signatory: "emp-002", fy: "24-25",
    lines: [L("Wheat flour (50kg bag)", "1101", 120, 1850, 5), L("Sunflower oil (15L tin)", "1512", 70, 1650, 5)],
  },
  {
    acc: "acc-001", seq: 14, date: "2025-06-18", due: "2025-07-03", status: "paid", signatory: "emp-002", fy: "25-26",
    lines: [L("Wheat flour (50kg bag)", "1101", 140, 1850, 5), L("Atta (10kg)", "1101", 500, 360, 5)],
  },
  {
    acc: "acc-001", seq: 15, date: "2025-09-20", due: "2025-10-05", status: "paid", signatory: "emp-002", fy: "25-26",
    lines: [L("Wheat flour (50kg bag)", "1101", 150, 1850, 5), L("Sunflower oil (15L tin)", "1512", 80, 1650, 5)],
  },
  {
    acc: "acc-001", seq: 16, date: "2025-12-15", due: "2025-12-30", status: "paid", signatory: "emp-002", fy: "25-26",
    lines: [L("Wheat flour (50kg bag)", "1101", 160, 1850, 5), L("Atta (10kg)", "1101", 600, 360, 5)],
  },
  {
    acc: "acc-001", seq: 17, date: "2026-02-20", due: "2026-03-07", status: "paid", signatory: "emp-002", fy: "25-26",
    lines: [L("Wheat flour (50kg bag)", "1101", 150, 1850, 5), L("Sunflower oil (15L tin)", "1512", 85, 1650, 5)],
  },

  // ---- History: Spencer's Gourmet (acc-002, Nexa Trading) — monthly specialty
  {
    acc: "acc-002", seq: 11, date: "2025-02-11", due: "2025-02-26", status: "paid", signatory: "emp-002", fy: "24-25",
    discountType: "percent", discountValue: 4,
    lines: [L("Specialty 00 flour (25kg)", "1101", 35, 2200, 5), L("Extra-virgin olive oil (5L)", "1509", 25, 4200, 12)],
    notes: "Pilot converted to standing order.",
  },
  {
    acc: "acc-002", seq: 12, date: "2025-05-20", due: "2025-06-04", status: "paid", signatory: "emp-002", fy: "25-26",
    discountType: "percent", discountValue: 4,
    lines: [L("Specialty 00 flour (25kg)", "1101", 40, 2200, 5), L("Durum semolina (25kg)", "1103", 20, 1900, 5)],
  },
  {
    acc: "acc-002", seq: 13, date: "2025-08-12", due: "2025-08-27", status: "paid", signatory: "emp-002", fy: "25-26",
    discountType: "percent", discountValue: 4,
    lines: [L("Specialty 00 flour (25kg)", "1101", 42, 2200, 5), L("Extra-virgin olive oil (5L)", "1509", 28, 4200, 12)],
  },
  {
    acc: "acc-002", seq: 14, date: "2025-11-10", due: "2025-11-25", status: "paid", signatory: "emp-002", fy: "25-26",
    discountType: "percent", discountValue: 4,
    lines: [L("Specialty 00 flour (25kg)", "1101", 45, 2200, 5), L("Durum semolina (25kg)", "1103", 22, 1900, 5)],
  },
  {
    acc: "acc-002", seq: 15, date: "2026-01-15", due: "2026-01-30", status: "paid", signatory: "emp-002", fy: "25-26",
    discountType: "percent", discountValue: 4,
    lines: [L("Specialty 00 flour (25kg)", "1101", 44, 2200, 5), L("Extra-virgin olive oil (5L)", "1509", 30, 4200, 12)],
  },
];


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
