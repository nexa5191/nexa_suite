// ---------------------------------------------------------------------------
// NEXA e-Invoicing (IRN / IRP) + e-Way bills.
//
// Under GST, B2B (and export) invoices above the turnover threshold must be
// reported to an Invoice Registration Portal (IRP, run by NIC). The IRP returns
// an Invoice Reference Number (IRN, 64-char hash), an acknowledgement number /
// date and a digitally-signed QR code. Separately, an e-Way bill is required
// when consignment value > ₹50,000 and goods move (inter-state always; intra-
// state above the state threshold).
//
// This module derives e-invoice eligibility & deterministic fake-but-realistic
// IRN/EWB artefacts straight from the sales invoices in lib/invoicing.ts. There
// is no backend — "generation" simply records status locally.
//
// Persistence (client-side):
//   nexa-einvoice → Record<invoiceId, { status, generatedOn }>
// ---------------------------------------------------------------------------

import {
  SEED_INVOICES,
  allInvoices,
  invoiceTotal,
  computeTotals,
  gstTreatment,
  entityLetterhead,
  type Invoice,
  type GstTreatment,
  type InvoiceTotals,
} from "@/lib/invoicing";
import { accountById } from "@/lib/crm";

// ---------------------------------------------------------------------------
// Status & records
// ---------------------------------------------------------------------------

export type EInvoiceStatus = "pending" | "generated" | "cancelled";

/** Locally-persisted generation state for a single invoice. */
export interface EInvoiceState {
  status: EInvoiceStatus;
  generatedOn: string; // ISO datetime
}

export type EInvoiceStateMap = Record<string, EInvoiceState>;

/** A fully-derived e-invoice record for an eligible invoice. */
export interface EInvoiceRecord {
  invoiceId: string;
  invoiceNumber: string;
  accountId: string;
  customerName: string;
  customerGstin: string;
  entityId: string;
  entityName: string;
  supplierGstin: string;
  date: string; // ISO
  value: number; // base INR — invoiceTotal
  treatment: GstTreatment;
  totals: InvoiceTotals;
  status: EInvoiceStatus;
  generatedOn: string | null;
  // IRP artefacts (deterministic, derived from the invoice)
  irn: string; // 64-char lowercase hex
  ackNo: string; // 15 digits
  ackDate: string; // ISO date
  signedQr: string; // signed-QR placeholder payload
  cancelDeadline: string; // ISO — IRN cancellable within 24h of generation
  // e-Way bill
  ewayRequired: boolean;
  eway: EWayBill | null;
}

/** Derived e-Way bill for a movement of goods. */
export interface EWayBill {
  ewbNo: string; // 12 digits
  invoiceId: string;
  distanceKm: number;
  validFrom: string; // ISO date
  validUntil: string; // ISO date
  transporter: string;
  transporterId: string; // 15-char TRANSIN/GSTIN-like
  vehicleNo: string;
  mode: "Road";
  treatment: GstTreatment;
  value: number;
}

// ---------------------------------------------------------------------------
// Deterministic string hash → hex expander (no crypto, no Math.random)
// ---------------------------------------------------------------------------

/** 32-bit FNV-1a hash of a string. */
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    // h *= 16777619, kept in 32-bit space
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Expand a seed string into `len` lowercase hex chars, fully deterministic. */
function hexExpand(seed: string, len: number): string {
  let out = "";
  let counter = 0;
  while (out.length < len) {
    const h = fnv1a(`${seed}#${counter}`);
    out += h.toString(16).padStart(8, "0");
    counter++;
  }
  return out.slice(0, len);
}

/** Deterministic decimal digit string of `len` digits derived from a seed. */
function digitExpand(seed: string, len: number): string {
  let out = "";
  let counter = 0;
  while (out.length < len) {
    const h = fnv1a(`${seed}@${counter}`);
    out += String(h).padStart(10, "0");
    counter++;
  }
  // avoid a leading zero so the number "looks" full-length
  const digits = out.slice(0, len).split("");
  if (digits[0] === "0") digits[0] = "7";
  return digits.join("");
}

// ---------------------------------------------------------------------------
// Eligibility & derivation
// ---------------------------------------------------------------------------

const EWAY_THRESHOLD = 50000; // ₹ consignment value above which an e-Way bill is due

/** Place-of-supply state code for the customer (used for GST treatment). */
function customerStateCode(inv: Invoice): string {
  return accountById(inv.accountId)?.stateCode ?? "29";
}

export function invoiceTreatment(inv: Invoice): GstTreatment {
  return gstTreatment(inv.entityId, customerStateCode(inv));
}

/**
 * e-invoice eligibility: B2B with a customer GSTIN, OR an export.
 * A customer with no GSTIN that is not an export (B2C) is skipped.
 */
export function einvoiceEligible(inv: Invoice): boolean {
  const treatment = invoiceTreatment(inv);
  if (treatment === "export") return true;
  const gstin = accountById(inv.accountId)?.gstin ?? "";
  return !!gstin && gstin !== "—";
}

/** Seeded inter-city distance (km) for the e-Way bill, deterministic per invoice. */
function seedDistance(inv: Invoice): number {
  // 40–840 km, deterministic from the invoice number
  return 40 + (fnv1a(`dist:${inv.number}`) % 801);
}

/** Whether an e-Way bill is required for this invoice. */
export function ewayRequired(inv: Invoice): boolean {
  const treatment = invoiceTreatment(inv);
  if (treatment === "export") return false; // moved under shipping bill, not EWB
  const value = invoiceTotal(inv);
  if (value <= EWAY_THRESHOLD) return false;
  // inter-state: always; intra-state: above the same threshold here
  return true;
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + (iso.length <= 10 ? "T00:00:00Z" : ""));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Build the deterministic IRN (64-char hex) for an invoice. */
export function buildIrn(inv: Invoice): string {
  const gstin = entityLetterhead(inv.entityId).gstin;
  const value = Math.round(invoiceTotal(inv));
  return hexExpand(`${inv.number}|${gstin}|${value}`, 64);
}

/** Build a deterministic e-Way bill for an invoice at a given distance. */
export function buildEway(inv: Invoice, distanceKm: number): EWayBill {
  const seed = `eway:${inv.number}`;
  const ewbNo = digitExpand(seed, 12);
  // validity: 1 day per 200 km (minimum 1 day), from the invoice date
  const days = Math.max(1, Math.ceil(distanceKm / 200));
  const validFrom = inv.date;
  const validUntil = addDays(validFrom, days);

  const TRANSPORTERS = [
    "VRL Logistics Ltd",
    "TCI Freight",
    "Safexpress Pvt Ltd",
    "Delhivery Ltd",
    "Gati-KWE",
  ];
  const transporter = TRANSPORTERS[fnv1a(`tr:${inv.number}`) % TRANSPORTERS.length];
  const transporterId = `88AAA${hexExpand(`trid:${inv.number}`, 4).toUpperCase()}${digitExpand(`trno:${inv.number}`, 4)}Z5`.slice(0, 15);

  const stateLetters = ["KA", "MH", "DL", "TN", "GJ"];
  const sl = stateLetters[fnv1a(`veh:${inv.number}`) % stateLetters.length];
  const vehNum = digitExpand(`vehno:${inv.number}`, 4);
  const vehSeries = hexExpand(`vehser:${inv.number}`, 2).replace(/[0-9]/g, "X").toUpperCase();
  const vehicleNo = `${sl}${digitExpand(`vehrto:${inv.number}`, 2)}${vehSeries}${vehNum}`;

  return {
    ewbNo,
    invoiceId: inv.id,
    distanceKm,
    validFrom,
    validUntil,
    transporter,
    transporterId,
    vehicleNo,
    mode: "Road",
    treatment: invoiceTreatment(inv),
    value: Math.round(invoiceTotal(inv)),
  };
}

/**
 * Derive the full e-invoice record for an invoice, folding in any locally-saved
 * generation state. Returns null if the invoice is not e-invoice eligible.
 */
export function einvoiceFor(inv: Invoice, states: EInvoiceStateMap = {}): EInvoiceRecord | null {
  if (!einvoiceEligible(inv)) return null;

  const acc = accountById(inv.accountId);
  const letterhead = entityLetterhead(inv.entityId);
  const treatment = invoiceTreatment(inv);
  const totals = computeTotals(inv.lines, inv.discountType, inv.discountValue, treatment);
  const value = Math.round(totals.total);

  const irn = buildIrn(inv);
  const ackNo = digitExpand(`ack:${inv.number}|${letterhead.gstin}`, 15);
  // ack date is the invoice date in this demo (IRP reports on the same day)
  const ackDate = inv.date;
  const signedQr = `IRP-SIGNED-QR · ${irn.slice(0, 24)}… · GSTIN ${letterhead.gstin} · ${inv.number} · ₹${value} · ${ackNo}`;

  const st = states[inv.id];
  const status: EInvoiceStatus = st?.status ?? "pending";
  const generatedOn = st?.generatedOn ?? null;
  const cancelDeadline = generatedOn ? addDays(generatedOn.slice(0, 10), 1) : addDays(inv.date, 1);

  const needsEway = ewayRequired(inv);
  const distanceKm = seedDistance(inv);

  return {
    invoiceId: inv.id,
    invoiceNumber: inv.number,
    accountId: inv.accountId,
    customerName: acc?.name ?? "—",
    customerGstin: acc?.gstin ?? "—",
    entityId: inv.entityId,
    entityName: letterhead.name,
    supplierGstin: letterhead.gstin,
    date: inv.date,
    value,
    treatment,
    totals,
    status,
    generatedOn,
    irn,
    ackNo,
    ackDate,
    signedQr,
    cancelDeadline,
    ewayRequired: needsEway,
    eway: needsEway ? buildEway(inv, distanceKm) : null,
  };
}

/** All e-invoice-eligible records (seed + created), newest first. */
export function eligibleRecords(
  created: Invoice[],
  states: EInvoiceStateMap = {},
): EInvoiceRecord[] {
  return allInvoices(created)
    .map((inv) => einvoiceFor(inv, states))
    .filter((r): r is EInvoiceRecord => r !== null);
}

/** Eligible records filtered to a single entity (or all). */
export function recordsForEntity(
  created: Invoice[],
  states: EInvoiceStateMap,
  entityId: string,
): EInvoiceRecord[] {
  const all = eligibleRecords(created, states);
  return entityId === "all" ? all : all.filter((r) => r.entityId === entityId);
}

// ---------------------------------------------------------------------------
// Summary aggregator
// ---------------------------------------------------------------------------

export interface EInvoiceSummary {
  eligible: number;
  generated: number;
  pending: number;
  cancelled: number;
  ewayRequired: number;
  ewayActive: number; // required AND generated
  totalValue: number;
  totalTaxable: number;
  totalCgst: number;
  totalSgst: number;
  totalIgst: number;
}

export function summarise(records: EInvoiceRecord[]): EInvoiceSummary {
  const s: EInvoiceSummary = {
    eligible: records.length,
    generated: 0,
    pending: 0,
    cancelled: 0,
    ewayRequired: 0,
    ewayActive: 0,
    totalValue: 0,
    totalTaxable: 0,
    totalCgst: 0,
    totalSgst: 0,
    totalIgst: 0,
  };
  for (const r of records) {
    if (r.status === "generated") s.generated++;
    else if (r.status === "cancelled") s.cancelled++;
    else s.pending++;
    if (r.ewayRequired) {
      s.ewayRequired++;
      if (r.status === "generated") s.ewayActive++;
    }
    s.totalValue += r.value;
    s.totalTaxable += r.totals.taxable;
    s.totalCgst += r.totals.cgst;
    s.totalSgst += r.totals.sgst;
    s.totalIgst += r.totals.igst;
  }
  return s;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export const EINVOICE_KEY = "nexa-einvoice";

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

export const loadEInvoiceStates = () => read<EInvoiceStateMap>(EINVOICE_KEY, {});
export const saveEInvoiceStates = (m: EInvoiceStateMap) => write(EINVOICE_KEY, m);

/** Mark an invoice's IRN as generated (now). Returns the new map. */
export function markGenerated(
  states: EInvoiceStateMap,
  invoiceId: string,
  now: string = new Date().toISOString(),
): EInvoiceStateMap {
  return { ...states, [invoiceId]: { status: "generated", generatedOn: now } };
}

/** Cancel a previously-generated IRN. Returns the new map. */
export function markCancelled(
  states: EInvoiceStateMap,
  invoiceId: string,
  now: string = new Date().toISOString(),
): EInvoiceStateMap {
  const prev = states[invoiceId];
  return {
    ...states,
    [invoiceId]: { status: "cancelled", generatedOn: prev?.generatedOn ?? now },
  };
}

/** Generate IRNs for every still-pending eligible record in the list. */
export function generateAllPending(
  states: EInvoiceStateMap,
  records: EInvoiceRecord[],
  now: string = new Date().toISOString(),
): EInvoiceStateMap {
  let next = states;
  for (const r of records) {
    if (r.status === "pending") next = markGenerated(next, r.invoiceId, now);
  }
  return next;
}

// Re-exports for convenience in the client.
export { SEED_INVOICES };
export type { Invoice, GstTreatment, InvoiceTotals };
