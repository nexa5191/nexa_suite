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

export type VendorCategory =
  | "Raw Materials"
  | "Packaging"
  | "Logistics"
  | "IT & Software"
  | "Marketing"
  | "Services";

export interface Vendor {
  id: string;
  name: string;
  category: VendorCategory;
  contact: string;
  email: string;
  phone: string;
  city: string;
  gstin: string;
  rating: number; // 1–5
  msme: boolean;
  active: boolean;
}

export interface POLine {
  item: string;
  qty: number;
  unitPrice: number; // base INR
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

export const VENDORS: Vendor[] = [
  { id: "ven-1", name: "Sterling Foods Pvt Ltd", category: "Raw Materials", contact: "Rakesh Iyer", email: "sales@sterlingfoods.in", phone: "+91 98860 11200", city: "Mumbai", gstin: "27AADES1234C1Z2", rating: 5, msme: true, active: true },
  { id: "ven-2", name: "BlueOcean Packaging", category: "Packaging", contact: "Sneha Pillai", email: "orders@blueocean.in", phone: "+91 99000 22112", city: "Bengaluru", gstin: "29AAFCB5678D1Z9", rating: 4, msme: true, active: true },
  { id: "ven-3", name: "Apex Logistics", category: "Logistics", contact: "Mohan Das", email: "ops@apexlogistics.in", phone: "+91 98450 33445", city: "New Delhi", gstin: "07AAGCA9012E1Z4", rating: 4, msme: false, active: true },
  { id: "ven-4", name: "TechNova Solutions", category: "IT & Software", contact: "Asha Verma", email: "billing@technova.in", phone: "+91 97400 55667", city: "Bengaluru", gstin: "29AALCT3456F1Z1", rating: 4, msme: false, active: true },
  { id: "ven-5", name: "GreenLeaf Agro", category: "Raw Materials", contact: "Karan Shah", email: "hello@greenleafagro.in", phone: "+91 99300 77889", city: "Mysuru", gstin: "29AAHCG7890G1Z7", rating: 3, msme: true, active: true },
  { id: "ven-6", name: "PrintWorks Media", category: "Marketing", contact: "Nisha Reddy", email: "studio@printworks.in", phone: "+91 96320 99001", city: "Mumbai", gstin: "27AAJCP2345H1Z3", rating: 4, msme: true, active: false },
];

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
    lines: [{ item: "Wheat flour (50kg)", qty: 40, unitPrice: 1850 }, { item: "Sunflower oil (15L)", qty: 30, unitPrice: 1650 }] },
  { id: "PO-2008", vendorId: "ven-2", title: "Retail cartons & labels", date: "2026-05-30", spocId: "emp-021", entityId: "ent-nexa-trade", locationId: "loc-mum", status: "invoiced", invoiceNo: "BOP-2026-441", invoiceDate: "2026-06-04",
    lines: [{ item: "Printed carton (12x)", qty: 500, unitPrice: 42 }, { item: "Barcode label roll", qty: 60, unitPrice: 320 }] },
  { id: "PO-2009", vendorId: "ven-4", title: "Annual ERP license renewal", date: "2026-06-01", spocId: "emp-005", entityId: "ent-nexa-in", locationId: "loc-blr", status: "invoiced", invoiceNo: "TN-2026-1180", invoiceDate: "2026-06-04",
    lines: [{ item: "ERP subscription (annual)", qty: 1, unitPrice: 480000 }] },
  { id: "PO-2010", vendorId: "ven-3", title: "Outbound freight — May", date: "2026-05-31", spocId: "emp-020", entityId: "ent-nexa-in", locationId: "loc-mys", status: "invoiced", invoiceNo: "APX/4821", invoiceDate: "2026-06-02",
    lines: [{ item: "FTL Bengaluru→Delhi", qty: 6, unitPrice: 38000 }] },

  // ---- issued, no invoice yet ----
  { id: "PO-2011", vendorId: "ven-5", title: "Organic grains — Q2 contract", date: "2026-06-02", spocId: "emp-024", entityId: "ent-nexa-in", locationId: "loc-blr", status: "issued",
    lines: [{ item: "Organic rice (25kg)", qty: 80, unitPrice: 2200 }] },
  { id: "PO-2012", vendorId: "ven-2", title: "Stretch wrap & tape", date: "2026-06-04", spocId: "emp-021", entityId: "ent-nexa-trade", locationId: "loc-del", status: "issued",
    lines: [{ item: "Stretch wrap roll", qty: 100, unitPrice: 280 }, { item: "Packing tape (pk-6)", qty: 40, unitPrice: 210 }] },

  // ---- already paid (history) ----
  { id: "PO-2001", vendorId: "ven-1", title: "Raw material restock", date: "2026-02-10", spocId: "emp-023", entityId: "ent-nexa-trade", locationId: "loc-mum", status: "paid", invoiceNo: "STF/25-26/0061", invoiceDate: "2026-02-14", payMode: "bank", paidOn: "2026-02-20",
    lines: [{ item: "Wheat flour (50kg)", qty: 30, unitPrice: 1820 }] },
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
