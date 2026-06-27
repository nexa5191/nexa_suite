// ---------------------------------------------------------------------------
// Vendor portal — session + uploaded invoices.
//
// The portal simulates a supplier-facing self-service surface. A vendor
// "signs in" by selecting themselves from the VENDORS list; the choice is
// persisted to localStorage so navigating between portal tabs keeps the
// context. Invoices uploaded through the portal are held in a separate
// array (nexa-vendor-invoices) distinct from PO.invoice, giving Finance a
// queue to review before they merge them into the PO workflow.
// ---------------------------------------------------------------------------

import { VENDORS } from "@/lib/vendors";

// ---- session ---------------------------------------------------------------

export const VENDOR_PORTAL_SESSION_KEY = "nexa-vendor-portal-session";
export const DEFAULT_PORTAL_VENDOR = VENDORS.find((v) => v.active && v.vClass !== "Employee")?.id ?? VENDORS[0].id;

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

function isValidVendor(id: string): boolean {
  return VENDORS.some((v) => v.id === id);
}

export function loadPortalVendor(): string {
  if (typeof window === "undefined") return DEFAULT_PORTAL_VENDOR;
  try {
    const raw = localStorage.getItem(VENDOR_PORTAL_SESSION_KEY);
    if (raw && isValidVendor(raw)) return raw;
  } catch {
    /* ignore */
  }
  return DEFAULT_PORTAL_VENDOR;
}

export function savePortalVendor(id: string) {
  write(VENDOR_PORTAL_SESSION_KEY, id);
}

// ---- uploaded invoices ------------------------------------------------------

export type VendorInvoiceStatus = "pending" | "approved" | "paid";

export interface VendorInvoice {
  id: string;
  vendorId: string;
  poId: string;
  invoiceNo: string;
  date: string;        // ISO
  amount: number;      // base INR
  fileName: string;    // simulated attachment name
  status: VendorInvoiceStatus;
  submittedAt: string; // ISO datetime
}

const VENDOR_INVOICES_KEY = "nexa-vendor-invoices";

export const loadVendorInvoices = (): VendorInvoice[] =>
  read<VendorInvoice[]>(VENDOR_INVOICES_KEY, []);

export const saveVendorInvoices = (inv: VendorInvoice[]) =>
  write(VENDOR_INVOICES_KEY, inv);

export const INVOICE_STATUS_META: Record<
  VendorInvoiceStatus,
  { label: string; variant: "default" | "warning" | "success" | "primary" }
> = {
  pending: { label: "Pending review", variant: "warning" },
  approved: { label: "Approved", variant: "success" },
  paid: { label: "Paid", variant: "primary" },
};
