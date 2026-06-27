// ---------------------------------------------------------------------------
// NEXA vendor management — vendor master + purchase orders with a SPOC-driven
// invoice approval workflow.
//
// Workflow: a PO is raised by a SPOC (single point of contact — the employee
// who owns the purchase). When the vendor's invoice arrives, it must be
// approved by that SPOC. On approval the bill auto-flows to payment.
//
// Invoice-approval state is shared with the unified approvals engine: each
// awaiting-approval invoice is an Approval with id `apr-invoice-<poId>`, so a
// decision taken on /approvals and on /vendors reads/writes the same store.
// ---------------------------------------------------------------------------

import { employeeById } from "@/lib/hr/employees";
import type { Decision } from "@/lib/hr/approvals";

// Broad procurement/accounting class. The descriptive categories below each sit
// under one of these four buckets.
export type VendorClass = "Inventory" | "Opex" | "Capex" | "Employee";

export const CLASS_META: Record<VendorClass, { label: string; blurb: string; accountHint: string }> = {
  Inventory: { label: "Inventory vendors", blurb: "Goods bought for stock — raw materials, packaging.", accountHint: "Inventory / COGS" },
  Opex: { label: "Opex vendors", blurb: "Operating expenses — logistics, services, marketing, software.", accountHint: "Operating Expenses" },
  Capex: { label: "Capex vendors", blurb: "Capitalised assets — plant, equipment, IT hardware.", accountHint: "Fixed Assets" },
  Employee: { label: "Employee vendors", blurb: "Staff reimbursements & advances paid as payees.", accountHint: "Employee Payable" },
};

export const VENDOR_CLASSES: VendorClass[] = ["Inventory", "Opex", "Capex", "Employee"];

export type VendorCategory =
  | "Raw Materials"
  | "Packaging"
  | "Logistics"
  | "IT & Software"
  | "Marketing"
  | "Services"
  | "Capital Equipment"
  | "Office Equipment"
  | "Employee Claims";

/** Default broad class each descriptive category nests under. */
export const CATEGORY_CLASS: Record<VendorCategory, VendorClass> = {
  "Raw Materials": "Inventory",
  Packaging: "Inventory",
  Logistics: "Opex",
  "IT & Software": "Opex",
  Marketing: "Opex",
  Services: "Opex",
  "Capital Equipment": "Capex",
  "Office Equipment": "Capex",
  "Employee Claims": "Employee",
};

export type MsmeClass = "Micro" | "Small" | "Medium";

/** Lower-deduction certificate (Income-tax sec. 197) — TDS at a reduced rate. */
export interface Ldc {
  section: string; // TDS section it applies to, e.g. "194J"
  rate: number; // reduced rate %
  certNo: string;
  validFrom: string; // ISO
  validTo: string; // ISO
}

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  vClass: VendorClass;
  contact: string;
  email: string;
  phone: string;
  city: string;
  gstin: string;
  rating: number; // 1–5
  msme: boolean;
  msmeClass?: MsmeClass; // Udyam classification
  udyam?: string; // Udyam registration number
  ldc?: Ldc; // lower-deduction certificate, if held
  active: boolean;
}

/** Is a lower-deduction certificate valid for `section` on `date`? */
export function ldcRateFor(vendor: Vendor | undefined, section: string, date: string): Ldc | undefined {
  const l = vendor?.ldc;
  if (!l) return undefined;
  if (l.section !== section) return undefined;
  if (date < l.validFrom || date > l.validTo) return undefined;
  return l;
}

export interface POLine {
  item: string;
  qty: number;
  unitPrice: number; // base INR
  itemId?: string; // links to the inventory item master (drives the GRN receipt)
}

export interface POInvoice {
  number: string;
  date: string; // ISO
  amount: number; // base INR
}

// Audit record written every time lines/prices are changed.
export interface POAmendment {
  id: string;
  date: string;       // ISO
  reason: string;
  amendedBy: string;  // employeeId
  prevLines: POLine[];
  prevTotal: number;
  newLines: POLine[];
  newTotal: number;
}

// Base (seed) status. The effective status is derived together with the live
// approval decision — see effectiveStatus().
export type POBaseStatus = "issued" | "invoiced" | "paid";

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  title: string;
  date: string; // ISO — PO raised on
  lines: POLine[];
  total: number; // base INR — reflects latest amendment
  spocId: string; // employee who raised & owns the PO (the approver of its invoice)
  entityId: string;
  locationId: string;
  status: POBaseStatus;
  invoice?: POInvoice; // present once the vendor bills the PO
  payMode?: "bank" | "upi" | "cheque";
  paidOn?: string; // ISO — for historically paid POs
  amendments?: POAmendment[]; // ordered oldest → newest
  shortClosed?: boolean;
  committedAmount?: number; // set on short-close: value of goods actually received
}

// ---------------------------------------------------------------------------
// PO mutations store — patches for both seed and user-created POs.
// Stored separately so seed POs (immutable consts) can still be amended/closed.
// ---------------------------------------------------------------------------
export interface POMutation {
  amendments: POAmendment[];
  shortClosed?: boolean;
  committedAmount?: number;
  // Lines and total are derived from the last amendment's newLines/newTotal.
}

const PO_MUTATIONS_KEY = "nexa-po-mutations";

export const loadPOMutations = (): Record<string, POMutation> =>
  read<Record<string, POMutation>>(PO_MUTATIONS_KEY, {});

export const savePOMutations = (m: Record<string, POMutation>) =>
  write(PO_MUTATIONS_KEY, m);

/** Merge mutations into a flat PO list. Returns new objects — originals untouched. */
export function applyPOMutations(
  pos: PurchaseOrder[],
  mutations: Record<string, POMutation>,
): PurchaseOrder[] {
  return pos.map((po) => {
    const m = mutations[po.id];
    if (!m) return po;
    const lastAmend = m.amendments.at(-1);
    return {
      ...po,
      lines: lastAmend?.newLines ?? po.lines,
      total: lastAmend?.newTotal ?? po.total,
      amendments: m.amendments,
      shortClosed: m.shortClosed,
      committedAmount: m.committedAmount,
    };
  });
}

// The first six vendors are the stable pool the tax dataset fans purchases over
// (see TAX_VENDOR_POOL) — keep them and their order fixed so the GST/TDS demo
// data stays deterministic. Capex/Employee vendors are appended after.
export const VENDORS: Vendor[] = [];

/** Stable subset the tax dataset fans purchases over (deterministic). */
export const TAX_VENDOR_POOL: Vendor[] = VENDORS.slice(0, 6);

export function vendorsByClass(vClass: VendorClass): Vendor[] {
  return VENDORS.filter((v) => v.vClass === vClass);
}

const sum = (lines: POLine[]) => lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);

interface RawPO {
  id: string;
  vendorId: string;
  title: string;
  date: string;
  lines: POLine[];
  spocId: string;
  entityId: string;
  locationId: string;
  status: POBaseStatus;
  invoiceNo?: string;
  invoiceDate?: string;
  payMode?: PurchaseOrder["payMode"];
  paidOn?: string;
}

export const PURCHASE_ORDERS: PurchaseOrder[] = [];

// ---- lookups ----
export function vendorById(id: string) {
  return VENDORS.find((v) => v.id === id);
}
export function vendorName(id: string) {
  return vendorById(id)?.name ?? "—";
}
export function poById(id: string) {
  return PURCHASE_ORDERS.find((p) => p.id === id);
}

// ---- SPOC invoice-approval workflow ----

export const invoiceApprovalId = (poId: string) => `apr-invoice-${poId}`;

export type POEffectiveStatus =
  | "issued" // PO raised, vendor yet to bill
  | "pending-approval" // invoice received, awaiting SPOC sign-off
  | "approved-paid" // SPOC approved → auto-paid
  | "rejected" // SPOC rejected the invoice
  | "paid"; // historically settled

/** Resolve the live status by combining the seed status with the SPOC decision. */
export function effectiveStatus(po: PurchaseOrder, decisions: Record<string, Decision>): POEffectiveStatus {
  if (po.status === "issued") return "issued";
  if (po.status === "paid") return "paid";
  // base status === "invoiced" → look at the shared approval decision
  const d = decisions[invoiceApprovalId(po.id)];
  if (d === "approved") return "approved-paid";
  if (d === "rejected") return "rejected";
  return "pending-approval";
}

/** POs whose invoice is awaiting the SPOC's approval (the seed-pending set). */
export function invoicesAwaitingApproval(): PurchaseOrder[] {
  return PURCHASE_ORDERS.filter((p) => p.status === "invoiced" && p.invoice);
}

/** Auto-generated payment reference once an invoice is approved. */
export function autoPaymentRef(po: PurchaseOrder) {
  return `AUTO-PAY/${po.id}`;
}

export function spocName(po: PurchaseOrder) {
  return employeeById(po.spocId)?.name ?? "—";
}

// ---- bill payments (Pay Bills allocation) ----------------------------------
// Cumulative amount paid against each PO's bill, so a single payment voucher can
// settle several bills (full or part). Keyed by PO id → INR paid.
const PO_PAYMENTS_KEY = "nexa-po-payments";

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

export const loadPoPayments = () => read<Record<string, number>>(PO_PAYMENTS_KEY, {});
export const savePoPayments = (p: Record<string, number>) => write(PO_PAYMENTS_KEY, p);

/** Amount still owed on a PO's bill after part-payments. */
export function poOutstanding(po: PurchaseOrder, payments: Record<string, number>): number {
  if (!po.invoice) return 0;
  return Math.max(0, Math.round(po.invoice.amount - (payments[po.id] ?? 0)));
}

// ---- User-created PO persistence -------------------------------------------
const ADDED_POS_KEY = "nexa-added-pos";

export const loadAddedPOs = (): PurchaseOrder[] => read<PurchaseOrder[]>(ADDED_POS_KEY, []);
export const saveAddedPOs = (pos: PurchaseOrder[]) => write(ADDED_POS_KEY, pos);
export function allPOs(added: PurchaseOrder[]): PurchaseOrder[] {
  return [...PURCHASE_ORDERS, ...added];
}

function nextPOId(added: PurchaseOrder[]): string {
  const all = allPOs(added);
  let max = 2012;
  for (const p of all) {
    const n = parseInt(p.id.replace("PO-", ""), 10);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return `PO-${max + 1}`;
}
export function buildNewPO(
  added: PurchaseOrder[],
  fields: Omit<PurchaseOrder, "id" | "total">,
): PurchaseOrder {
  const total = fields.lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  return { ...fields, id: nextPOId(added), total };
}

/** COA subtypes that represent spend for each vendor class (used by budget balance). */
export const CLASS_COA_SUBTYPES: Record<VendorClass, string[]> = {
  Inventory: ["Cost of Sales"],
  Opex: ["Operating Expenses", "Finance Costs"],
  Capex: ["Fixed Assets"],
  Employee: ["Operating Expenses"],
};
