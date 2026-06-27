export type RTVReason =
  | "quality-rejection"
  | "excess-quantity"
  | "wrong-item"
  | "damaged"
  | "expired"
  | "price-dispute";

export type RTVStatus =
  | "draft"
  | "approved"
  | "dispatched"
  | "credit-note-received"
  | "adjusted";

export interface RTVLine {
  itemName: string;
  hsn: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
  grnRef: string;
  reason: RTVReason;
}

export interface ReturnToVendor {
  id: string;
  ref: string;
  date: string;
  vendorId: string;
  poRef: string;
  locationId: string;
  lines: RTVLine[];
  totalAmount: number;
  gstAmount: number;
  totalWithGst: number;
  status: RTVStatus;
  debitNoteRef: string | null;
  debitNoteDate: string | null;
  debitNoteAmount: number;
  dispatchDate: string | null;
  vehicleNo: string;
  remarks: string;
  approvedBy: string | null;
  approvedAt: string | null;
}

export const RTV_STATUS_META: Record<
  RTVStatus,
  { label: string; variant: "default" | "primary" | "warning" | "success" | "danger" }
> = {
  draft:                  { label: "Draft",                variant: "default"  },
  approved:               { label: "Approved",             variant: "primary"  },
  dispatched:             { label: "Dispatched",           variant: "warning"  },
  "credit-note-received": { label: "Credit Note Received", variant: "success"  },
  adjusted:               { label: "Adjusted",             variant: "success"  },
};

export const RTV_REASON_META: Record<
  RTVReason,
  { label: string; variant: "default" | "primary" | "warning" | "success" | "danger" }
> = {
  "quality-rejection": { label: "Quality Rejection", variant: "danger"  },
  "excess-quantity":   { label: "Excess Quantity",   variant: "warning" },
  "wrong-item":        { label: "Wrong Item",        variant: "primary" },
  "damaged":           { label: "Damaged",           variant: "danger"  },
  "expired":           { label: "Expired",           variant: "warning" },
  "price-dispute":     { label: "Price Dispute",     variant: "default" },
};

export const SEED_RTVS: ReturnToVendor[] = [
  {
    id: "rtv-001",
    ref: "RTV-2526-001",
    date: "2026-05-15",
    vendorId: "ven-1",
    poRef: "PO-2007",
    locationId: "loc-mys",
    lines: [
      { itemName: "Wheat Flour (50 kg)", hsn: "1101", qty: 500, uom: "KG", rate: 42, amount: 21000, grnRef: "GRN-0001", reason: "quality-rejection" },
    ],
    totalAmount: 21000,
    gstAmount: 3780,
    totalWithGst: 24780,
    status: "credit-note-received",
    debitNoteRef: "DN-2526-001",
    debitNoteDate: "2026-05-22",
    debitNoteAmount: 24780,
    dispatchDate: "2026-05-18",
    vehicleNo: "KA-01-AB-1234",
    remarks: "Batch WHT-2606-A failed moisture test (>14%). Entire returned lot rejected by QC.",
    approvedBy: "emp-023",
    approvedAt: "2026-05-16",
  },
  {
    id: "rtv-002",
    ref: "RTV-2526-002",
    date: "2026-05-18",
    vendorId: "ven-2",
    poRef: "PO-2008",
    locationId: "loc-mum",
    lines: [
      { itemName: "Printed Carton (12x)", hsn: "4819", qty: 200, uom: "PCS", rate: 42, amount: 8400, grnRef: "GRN-0002", reason: "excess-quantity" },
      { itemName: "Barcode Label Roll", hsn: "4821", qty: 30, uom: "ROL", rate: 320, amount: 9600, grnRef: "GRN-0002", reason: "excess-quantity" },
    ],
    totalAmount: 18000,
    gstAmount: 3240,
    totalWithGst: 21240,
    status: "dispatched",
    debitNoteRef: null,
    debitNoteDate: null,
    debitNoteAmount: 0,
    dispatchDate: "2026-05-21",
    vehicleNo: "MH-04-CD-5678",
    remarks: "PO-2008 called for 300 cartons and 90 rolls; vendor shipped 500 and 120. Returning surplus stock.",
    approvedBy: "emp-021",
    approvedAt: "2026-05-19",
  },
  {
    id: "rtv-003",
    ref: "RTV-2526-003",
    date: "2026-05-22",
    vendorId: "ven-5",
    poRef: "PO-2011",
    locationId: "loc-blr",
    lines: [
      { itemName: "Organic Rice (25 kg bag)", hsn: "1006", qty: 20, uom: "BAG", rate: 2200, amount: 44000, grnRef: "GRN-0003", reason: "damaged" },
    ],
    totalAmount: 44000,
    gstAmount: 7920,
    totalWithGst: 51920,
    status: "approved",
    debitNoteRef: null,
    debitNoteDate: null,
    debitNoteAmount: 0,
    dispatchDate: null,
    vehicleNo: "",
    remarks: "20 bags arrived with torn jute sacks; rice contaminated by moisture during transit. Photographic evidence shared.",
    approvedBy: "emp-024",
    approvedAt: "2026-05-23",
  },
  {
    id: "rtv-004",
    ref: "RTV-2526-004",
    date: "2026-05-28",
    vendorId: "ven-1",
    poRef: "PO-2007",
    locationId: "loc-mys",
    lines: [
      { itemName: "Sunflower Oil (15 L)", hsn: "1512", qty: 80, uom: "LTR", rate: 110, amount: 8800, grnRef: "GRN-0001", reason: "expired" },
    ],
    totalAmount: 8800,
    gstAmount: 1584,
    totalWithGst: 10384,
    status: "approved",
    debitNoteRef: null,
    debitNoteDate: null,
    debitNoteAmount: 0,
    dispatchDate: null,
    vehicleNo: "",
    remarks: "Post-GRN audit found batch expiry date 2026-04-30 — already past at time of receipt. GRN-0001 corrected.",
    approvedBy: "emp-023",
    approvedAt: "2026-05-29",
  },
  {
    id: "rtv-005",
    ref: "RTV-2526-005",
    date: "2026-06-01",
    vendorId: "ven-2",
    poRef: "PO-2012",
    locationId: "loc-del",
    lines: [
      { itemName: "Stretch Wrap Roll", hsn: "3926", qty: 50, uom: "ROL", rate: 280, amount: 14000, grnRef: "GRN-0004", reason: "wrong-item" },
      { itemName: "Packing Tape (pk-6)", hsn: "3919", qty: 20, uom: "PK", rate: 210, amount: 4200, grnRef: "GRN-0004", reason: "wrong-item" },
    ],
    totalAmount: 18200,
    gstAmount: 3276,
    totalWithGst: 21476,
    status: "credit-note-received",
    debitNoteRef: "DN-2526-002",
    debitNoteDate: "2026-06-08",
    debitNoteAmount: 21476,
    dispatchDate: "2026-06-04",
    vehicleNo: "MH-04-EF-9012",
    remarks: "PO-2012 specified heavy-duty grade; received standard grade. Tape SKU also incorrect (ordered BT-3K, received BT-2S).",
    approvedBy: "emp-021",
    approvedAt: "2026-06-02",
  },
  {
    id: "rtv-006",
    ref: "RTV-2526-006",
    date: "2026-06-05",
    vendorId: "ven-7",
    poRef: "PO-CAP-2526-04",
    locationId: "loc-blr",
    lines: [
      { itemName: "Conveyor Belt Drive Unit", hsn: "8431", qty: 2, uom: "PCS", rate: 85000, amount: 170000, grnRef: "GRN-0005", reason: "price-dispute" },
    ],
    totalAmount: 170000,
    gstAmount: 30600,
    totalWithGst: 200600,
    status: "draft",
    debitNoteRef: null,
    debitNoteDate: null,
    debitNoteAmount: 0,
    dispatchDate: null,
    vehicleNo: "",
    remarks: "Agreed PO rate ₹80,000/unit. Invoice billed at ₹85,000/unit. Pending vendor's revised credit note.",
    approvedBy: null,
    approvedAt: null,
  },
  {
    id: "rtv-007",
    ref: "RTV-2526-007",
    date: "2026-06-08",
    vendorId: "ven-5",
    poRef: "PO-2011",
    locationId: "loc-mys",
    lines: [
      { itemName: "Organic Rice (25 kg bag)", hsn: "1006", qty: 15, uom: "BAG", rate: 2200, amount: 33000, grnRef: "GRN-0003", reason: "quality-rejection" },
    ],
    totalAmount: 33000,
    gstAmount: 5940,
    totalWithGst: 38940,
    status: "adjusted",
    debitNoteRef: "DN-2526-003",
    debitNoteDate: "2026-06-15",
    debitNoteAmount: 38940,
    dispatchDate: "2026-06-10",
    vehicleNo: "KA-01-GH-3456",
    remarks: "Second batch from GreenLeaf Agro; FSSAI lab test showed aflatoxin levels above permissible limit. Credit applied to AP ledger.",
    approvedBy: "emp-024",
    approvedAt: "2026-06-09",
  },
  {
    id: "rtv-008",
    ref: "RTV-2526-008",
    date: "2026-06-12",
    vendorId: "ven-1",
    poRef: "PO-2007",
    locationId: "loc-mum",
    lines: [
      { itemName: "Wheat Flour (50 kg)", hsn: "1101", qty: 1000, uom: "KG", rate: 42, amount: 42000, grnRef: "GRN-0001", reason: "excess-quantity" },
      { itemName: "Sunflower Oil (15 L)", hsn: "1512", qty: 50, uom: "LTR", rate: 110, amount: 5500, grnRef: "GRN-0001", reason: "excess-quantity" },
    ],
    totalAmount: 47500,
    gstAmount: 8550,
    totalWithGst: 56050,
    status: "draft",
    debitNoteRef: null,
    debitNoteDate: null,
    debitNoteAmount: 0,
    dispatchDate: null,
    vehicleNo: "",
    remarks: "PO quantities fulfilled; vendor shipped additional 1,000 KG flour and 50 LTR oil beyond PO scope.",
    approvedBy: null,
    approvedAt: null,
  },
  {
    id: "rtv-009",
    ref: "RTV-2526-009",
    date: "2026-06-15",
    vendorId: "ven-8",
    poRef: "PO-2002",
    locationId: "loc-blr",
    lines: [
      { itemName: "Office Chair (Ergonomic High-Back)", hsn: "9401", qty: 3, uom: "PCS", rate: 8500, amount: 25500, grnRef: "GRN-0006", reason: "wrong-item" },
    ],
    totalAmount: 25500,
    gstAmount: 4590,
    totalWithGst: 30090,
    status: "credit-note-received",
    debitNoteRef: "DN-2526-004",
    debitNoteDate: "2026-06-19",
    debitNoteAmount: 30090,
    dispatchDate: "2026-06-17",
    vehicleNo: "KA-05-IJ-7890",
    remarks: "Ordered high-back executive chairs (SKU EC-HB-01); received mid-back visitor chairs (SKU VC-MB-03).",
    approvedBy: "emp-005",
    approvedAt: "2026-06-16",
  },
  {
    id: "rtv-010",
    ref: "RTV-2526-010",
    date: "2026-06-18",
    vendorId: "ven-2",
    poRef: "PO-2012",
    locationId: "loc-del",
    lines: [
      { itemName: "Printed Carton (12x)", hsn: "4819", qty: 150, uom: "PCS", rate: 42, amount: 6300, grnRef: "GRN-0002", reason: "quality-rejection" },
      { itemName: "Packing Tape (pk-6)", hsn: "3919", qty: 25, uom: "PK", rate: 210, amount: 5250, grnRef: "GRN-0002", reason: "quality-rejection" },
    ],
    totalAmount: 11550,
    gstAmount: 2079,
    totalWithGst: 13629,
    status: "dispatched",
    debitNoteRef: null,
    debitNoteDate: null,
    debitNoteAmount: 0,
    dispatchDate: "2026-06-21",
    vehicleNo: "MH-04-KL-2345",
    remarks: "Cartons showed delamination on handles under load test. Tape adhesive failed peel strength test.",
    approvedBy: "emp-021",
    approvedAt: "2026-06-19",
  },
];

function load<T>(key: string): T[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch { return []; }
}

function save<T>(key: string, items: T[]) {
  try { localStorage.setItem(key, JSON.stringify(items)); } catch { /* ignore */ }
}

const RTV_KEY = "nexa-rtv";

export const loadRTVs = () => load<ReturnToVendor>(RTV_KEY);
export const saveRTVs = (v: ReturnToVendor[]) => save(RTV_KEY, v);
export function allRTVs(added: ReturnToVendor[]) { return [...SEED_RTVS, ...added]; }

export function nextRTVRef(added: ReturnToVendor[]): string {
  const all = allRTVs(added);
  let max = 0;
  for (const r of all) {
    const n = parseInt(r.ref.split("-").pop() ?? "0", 10);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return `RTV-2526-${String(max + 1).padStart(3, "0")}`;
}

export function nextDNRef(added: ReturnToVendor[]): string {
  const all = allRTVs(added);
  let max = 0;
  for (const r of all) {
    if (!r.debitNoteRef) continue;
    const n = parseInt(r.debitNoteRef.split("-").pop() ?? "0", 10);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return `DN-2526-${String(max + 1).padStart(3, "0")}`;
}
