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

// Base (seed) status. The effective status is derived together with the live
// approval decision — see effectiveStatus().
export type POBaseStatus = "issued" | "invoiced" | "paid";

export interface PurchaseOrder {
  id: string;
  vendorId: string;
  title: string;
  date: string; // ISO — PO raised on
  lines: POLine[];
  total: number; // base INR
  spocId: string; // employee who raised & owns the PO (the approver of its invoice)
  entityId: string;
  locationId: string;
  status: POBaseStatus;
  invoice?: POInvoice; // present once the vendor bills the PO
  payMode?: "bank" | "upi" | "cheque";
  paidOn?: string; // ISO — for historically paid POs
}

// The first six vendors are the stable pool the tax dataset fans purchases over
// (see TAX_VENDOR_POOL) — keep them and their order fixed so the GST/TDS demo
// data stays deterministic. Capex/Employee vendors are appended after.
export const VENDORS: Vendor[] = [
  { id: "ven-1", name: "Sterling Foods Pvt Ltd", category: "Raw Materials", vClass: "Inventory", contact: "Rakesh Iyer", email: "sales@sterlingfoods.in", phone: "+91 98860 11200", city: "Mumbai", gstin: "27AADES1234C1Z2", rating: 5, msme: true, msmeClass: "Small", udyam: "UDYAM-MH-18-0011200", active: true },
  { id: "ven-2", name: "BlueOcean Packaging", category: "Packaging", vClass: "Inventory", contact: "Sneha Pillai", email: "orders@blueocean.in", phone: "+91 99000 22112", city: "Bengaluru", gstin: "29AAFCB5678D1Z9", rating: 4, msme: true, msmeClass: "Micro", udyam: "UDYAM-KR-03-0022112", active: true },
  { id: "ven-3", name: "Apex Logistics", category: "Logistics", vClass: "Opex", contact: "Mohan Das", email: "ops@apexlogistics.in", phone: "+91 98450 33445", city: "New Delhi", gstin: "07AAGCA9012E1Z4", rating: 4, msme: false, active: true },
  { id: "ven-4", name: "TechNova Solutions", category: "IT & Software", vClass: "Opex", contact: "Asha Verma", email: "billing@technova.in", phone: "+91 97400 55667", city: "Bengaluru", gstin: "29AALCT3456F1Z1", rating: 4, msme: false, ldc: { section: "194J", rate: 2, certNo: "197/BLR/2026/00417", validFrom: "2025-04-01", validTo: "2026-03-31" }, active: true },
  { id: "ven-5", name: "GreenLeaf Agro", category: "Raw Materials", vClass: "Inventory", contact: "Karan Shah", email: "hello@greenleafagro.in", phone: "+91 99300 77889", city: "Mysuru", gstin: "29AAHCG7890G1Z7", rating: 3, msme: true, msmeClass: "Micro", udyam: "UDYAM-KR-29-0077889", active: true },
  { id: "ven-6", name: "PrintWorks Media", category: "Marketing", vClass: "Opex", contact: "Nisha Reddy", email: "studio@printworks.in", phone: "+91 96320 99001", city: "Mumbai", gstin: "27AAJCP2345H1Z3", rating: 4, msme: true, msmeClass: "Small", udyam: "UDYAM-MH-18-0099001", active: false },
  // ---- Capex vendors ----
  { id: "ven-7", name: "Meridian Machine Tools", category: "Capital Equipment", vClass: "Capex", contact: "Suresh Patil", email: "sales@meridiantools.in", phone: "+91 98220 44556", city: "Pune", gstin: "27AAKCM6789J1Z5", rating: 5, msme: false, ldc: { section: "194Q", rate: 0.05, certNo: "197/PN/2026/01188", validFrom: "2025-04-01", validTo: "2026-03-31" }, active: true },
  { id: "ven-8", name: "Cubix Office Systems", category: "Office Equipment", vClass: "Capex", contact: "Deepa Menon", email: "accounts@cubix.in", phone: "+91 99010 66778", city: "Bengaluru", gstin: "29AALCC4567K1Z2", rating: 4, msme: true, msmeClass: "Small", udyam: "UDYAM-KR-03-0066778", active: true },
  // ---- Employee-class payee (links to the Reimbursements module) ----
  { id: "ven-emp", name: "Employee Expense Claims", category: "Employee Claims", vClass: "Employee", contact: "Payroll & Finance", email: "reimbursements@nexa.example", phone: "—", city: "Bengaluru", gstin: "—", rating: 5, msme: false, active: true },
];

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

const RAW: RawPO[] = [
  // ---- invoiced, awaiting the SPOC's approval (these drive the approvals queue) ----
  { id: "PO-2007", vendorId: "ven-1", title: "Wheat & edible oil — June restock", date: "2026-05-28", spocId: "emp-023", entityId: "ent-nexa-trade", locationId: "loc-mum", status: "invoiced", invoiceNo: "STF/26-27/0192", invoiceDate: "2026-06-03",
    lines: [{ item: "Wheat flour (50kg)", qty: 40, unitPrice: 1850, itemId: "fg-flour50" }, { item: "Sunflower oil (15L)", qty: 30, unitPrice: 1650, itemId: "fg-oil15" }] },
  { id: "PO-2008", vendorId: "ven-2", title: "Retail cartons & labels", date: "2026-05-30", spocId: "emp-021", entityId: "ent-nexa-trade", locationId: "loc-mum", status: "invoiced", invoiceNo: "BOP-2026-441", invoiceDate: "2026-06-04",
    lines: [{ item: "Printed carton (12x)", qty: 500, unitPrice: 42, itemId: "pm-carton" }, { item: "Barcode label roll", qty: 60, unitPrice: 320, itemId: "pm-label" }] },
  { id: "PO-2009", vendorId: "ven-4", title: "Annual ERP license renewal", date: "2026-06-01", spocId: "emp-005", entityId: "ent-nexa-in", locationId: "loc-blr", status: "invoiced", invoiceNo: "TN-2026-1180", invoiceDate: "2026-06-04",
    lines: [{ item: "ERP subscription (annual)", qty: 1, unitPrice: 480000 }] },
  { id: "PO-2010", vendorId: "ven-3", title: "Outbound freight — May", date: "2026-05-31", spocId: "emp-020", entityId: "ent-nexa-in", locationId: "loc-mys", status: "invoiced", invoiceNo: "APX/4821", invoiceDate: "2026-06-02",
    lines: [{ item: "FTL Bengaluru→Delhi", qty: 6, unitPrice: 38000 }] },

  // ---- issued, no invoice yet ----
  { id: "PO-2011", vendorId: "ven-5", title: "Organic grains — Q2 contract", date: "2026-06-02", spocId: "emp-024", entityId: "ent-nexa-in", locationId: "loc-blr", status: "issued",
    lines: [{ item: "Organic rice (25kg)", qty: 80, unitPrice: 2200, itemId: "fg-rice25" }] },
  { id: "PO-2012", vendorId: "ven-2", title: "Stretch wrap & tape", date: "2026-06-04", spocId: "emp-021", entityId: "ent-nexa-trade", locationId: "loc-del", status: "issued",
    lines: [{ item: "Stretch wrap roll", qty: 100, unitPrice: 280 }, { item: "Packing tape (pk-6)", qty: 40, unitPrice: 210 }] },

  // ---- already paid (history) ----
  { id: "PO-2001", vendorId: "ven-1", title: "Raw material restock", date: "2026-02-10", spocId: "emp-023", entityId: "ent-nexa-trade", locationId: "loc-mum", status: "paid", invoiceNo: "STF/25-26/0061", invoiceDate: "2026-02-14", payMode: "bank", paidOn: "2026-02-20",
    lines: [{ item: "Wheat flour (50kg)", qty: 30, unitPrice: 1820, itemId: "fg-flour50" }] },
  { id: "PO-2002", vendorId: "ven-4", title: "Laptops — engineering", date: "2026-03-05", spocId: "emp-005", entityId: "ent-nexa-in", locationId: "loc-blr", status: "paid", invoiceNo: "TN-2026-880", invoiceDate: "2026-03-08", payMode: "bank", paidOn: "2026-03-15",
    lines: [{ item: "Laptop 14\" (i7/16GB)", qty: 4, unitPrice: 92000 }] },
  { id: "PO-2003", vendorId: "ven-6", title: "Brand campaign collateral", date: "2026-04-12", spocId: "emp-003", entityId: "ent-nexa-trade", locationId: "loc-mum", status: "paid", invoiceNo: "PW-3390", invoiceDate: "2026-04-15", payMode: "upi", paidOn: "2026-04-22",
    lines: [{ item: "Brochure design + print", qty: 2000, unitPrice: 18 }] },
];

export const PURCHASE_ORDERS: PurchaseOrder[] = RAW.map((r) => ({
  id: r.id,
  vendorId: r.vendorId,
  title: r.title,
  date: r.date,
  lines: r.lines,
  total: sum(r.lines),
  spocId: r.spocId,
  entityId: r.entityId,
  locationId: r.locationId,
  status: r.status,
  invoice: r.invoiceNo
    ? { number: r.invoiceNo, date: r.invoiceDate ?? r.date, amount: sum(r.lines) }
    : undefined,
  payMode: r.payMode,
  paidOn: r.paidOn,
}));

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
