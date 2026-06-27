export type ReturnReason =
  | "quality-issue"
  | "excess-delivery"
  | "wrong-product"
  | "transit-damage"
  | "customer-cancelled"
  | "near-expiry";

export type ReturnDisposition = "restock" | "rework" | "scrap" | "return-to-vendor" | "pending";

export type ReturnStatus =
  | "requested"
  | "approved"
  | "goods-received"
  | "credit-note-issued"
  | "closed";

export interface ReturnLine {
  itemName: string;
  hsn: string;
  qtyReturned: number;
  qtyApproved: number;
  uom: string;
  rate: number;
  amount: number;
  reason: ReturnReason;
  disposition: ReturnDisposition;
  originalInvoiceRef: string;
}

export interface CustomerReturn {
  id: string;
  ref: string;
  date: string;
  customerName: string;
  customerGstin: string;
  entityId: string;
  locationId: string;
  lines: ReturnLine[];
  totalReturned: number;
  creditNoteRef: string | null;
  creditNoteDate: string | null;
  status: ReturnStatus;
  receivedDate: string | null;
  remarks: string;
  approvedBy: string | null;
}

export const RETURN_STATUS_META: Record<
  ReturnStatus,
  { label: string; variant: "default" | "primary" | "warning" | "success" | "danger" }
> = {
  requested:           { label: "Requested",          variant: "default"  },
  approved:            { label: "Approved",            variant: "primary"  },
  "goods-received":    { label: "Goods Received",      variant: "warning"  },
  "credit-note-issued":{ label: "Credit Note Issued",  variant: "success"  },
  closed:              { label: "Closed",              variant: "success"  },
};

export const RETURN_REASON_META: Record<
  ReturnReason,
  { label: string; variant: "default" | "primary" | "warning" | "success" | "danger"; barColor: string }
> = {
  "quality-issue":      { label: "Quality Issue",       variant: "danger",  barColor: "bg-danger/70"            },
  "excess-delivery":    { label: "Excess Delivery",     variant: "warning", barColor: "bg-warning/70"           },
  "wrong-product":      { label: "Wrong Product",       variant: "primary", barColor: "bg-primary/70"           },
  "transit-damage":     { label: "Transit Damage",      variant: "danger",  barColor: "bg-danger/40"            },
  "customer-cancelled": { label: "Customer Cancelled",  variant: "default", barColor: "bg-muted-foreground/50"  },
  "near-expiry":        { label: "Near Expiry",         variant: "warning", barColor: "bg-warning/40"           },
};

export const RETURN_DISPOSITION_META: Record<
  ReturnDisposition,
  { label: string; variant: "default" | "primary" | "warning" | "success" | "danger" }
> = {
  restock:           { label: "Restock",           variant: "success"  },
  rework:            { label: "Rework",            variant: "warning"  },
  scrap:             { label: "Scrap",             variant: "danger"   },
  "return-to-vendor":{ label: "Return to Vendor",  variant: "primary"  },
  pending:           { label: "Pending",           variant: "default"  },
};

export const SEED_RETURNS: CustomerReturn[] = [
  {
    id: "crn-001",
    ref: "CRN-2526-001",
    date: "2026-05-08",
    customerName: "Metro Cash & Carry India Pvt Ltd",
    customerGstin: "07AAACM1234C1Z8",
    entityId: "ent-nexa-trade",
    locationId: "loc-mum",
    lines: [
      { itemName: "Atta 5 kg (Whole Wheat)", hsn: "1101", qtyReturned: 200, qtyApproved: 200, uom: "PKT", rate: 180, amount: 36000, reason: "quality-issue", disposition: "rework", originalInvoiceRef: "INV-2526-0081" },
      { itemName: "Sunflower Oil 1 L", hsn: "1512", qtyReturned: 100, qtyApproved: 95, uom: "BTL", rate: 140, amount: 13300, reason: "quality-issue", disposition: "scrap", originalInvoiceRef: "INV-2526-0081" },
    ],
    totalReturned: 49300,
    creditNoteRef: "CN-2526-001",
    creditNoteDate: "2026-05-16",
    status: "closed",
    receivedDate: "2026-05-14",
    remarks: "Atta bags showed visible mould on inner lining. 5 oil bottles had compromised seals.",
    approvedBy: "emp-020",
  },
  {
    id: "crn-002",
    ref: "CRN-2526-002",
    date: "2026-05-12",
    customerName: "Spencer's Retail Ltd",
    customerGstin: "29AABCS5678D1Z2",
    entityId: "ent-nexa-trade",
    locationId: "loc-del",
    lines: [
      { itemName: "Ready-to-eat Poha 500 g", hsn: "1904", qtyReturned: 500, qtyApproved: 480, uom: "PKT", rate: 65, amount: 31200, reason: "transit-damage", disposition: "rework", originalInvoiceRef: "INV-2526-0094" },
    ],
    totalReturned: 31200,
    creditNoteRef: "CN-2526-002",
    creditNoteDate: "2026-05-21",
    status: "credit-note-issued",
    receivedDate: "2026-05-18",
    remarks: "20 packets with torn outer film excluded from approved qty; balance repackaging in progress.",
    approvedBy: "emp-023",
  },
  {
    id: "crn-003",
    ref: "CRN-2526-003",
    date: "2026-05-20",
    customerName: "Reliance Retail Ventures Ltd",
    customerGstin: "27AAACR9012E1Z4",
    entityId: "ent-nexa-trade",
    locationId: "loc-mum",
    lines: [
      { itemName: "Premium Basmati Rice 1 kg", hsn: "1006", qtyReturned: 300, qtyApproved: 300, uom: "PKT", rate: 220, amount: 66000, reason: "excess-delivery", disposition: "restock", originalInvoiceRef: "INV-2526-0102" },
    ],
    totalReturned: 66000,
    creditNoteRef: null,
    creditNoteDate: null,
    status: "goods-received",
    receivedDate: "2026-05-28",
    remarks: "Customer's warehouse was over-allotted 300 packets; items in perfect condition for restock.",
    approvedBy: "emp-020",
  },
  {
    id: "crn-004",
    ref: "CRN-2526-004",
    date: "2026-05-28",
    customerName: "Star Bazaar (Tesco Hindustan Wholesale)",
    customerGstin: "29AABCS3456F1Z6",
    entityId: "ent-nexa-in",
    locationId: "loc-blr",
    lines: [
      { itemName: "Organic Rice 5 kg", hsn: "1006", qtyReturned: 150, qtyApproved: 150, uom: "BAG", rate: 450, amount: 67500, reason: "wrong-product", disposition: "return-to-vendor", originalInvoiceRef: "INV-2526-0115" },
    ],
    totalReturned: 67500,
    creditNoteRef: null,
    creditNoteDate: null,
    status: "approved",
    receivedDate: null,
    remarks: "Customer ordered standard white rice; dispatched organic variety by picking error. Routing back to vendor GreenLeaf Agro.",
    approvedBy: "emp-023",
  },
  {
    id: "crn-005",
    ref: "CRN-2526-005",
    date: "2026-06-02",
    customerName: "BigBasket (Supermarket Grocery Supplies Pvt Ltd)",
    customerGstin: "29AABCB7890G1Z8",
    entityId: "ent-nexa-trade",
    locationId: "loc-mum",
    lines: [
      { itemName: "Mixed Spice Pack 100 g", hsn: "0910", qtyReturned: 400, qtyApproved: 400, uom: "PKT", rate: 95, amount: 38000, reason: "customer-cancelled", disposition: "restock", originalInvoiceRef: "INV-2526-0128" },
      { itemName: "Mango Pickle 400 g", hsn: "2001", qtyReturned: 200, qtyApproved: 200, uom: "JAR", rate: 85, amount: 17000, reason: "customer-cancelled", disposition: "restock", originalInvoiceRef: "INV-2526-0128" },
    ],
    totalReturned: 55000,
    creditNoteRef: null,
    creditNoteDate: null,
    status: "requested",
    receivedDate: null,
    remarks: "Customer cancelled seasonal promo order; goods still sealed and within shelf life.",
    approvedBy: null,
  },
  {
    id: "crn-006",
    ref: "CRN-2526-006",
    date: "2026-06-05",
    customerName: "D-Mart (Avenue Supermarts Ltd)",
    customerGstin: "27AAACA2345H1Z0",
    entityId: "ent-nexa-trade",
    locationId: "loc-mum",
    lines: [
      { itemName: "Atta 5 kg (Whole Wheat)", hsn: "1101", qtyReturned: 1000, qtyApproved: 1000, uom: "PKT", rate: 180, amount: 180000, reason: "near-expiry", disposition: "scrap", originalInvoiceRef: "INV-2526-0139" },
    ],
    totalReturned: 180000,
    creditNoteRef: "CN-2526-003",
    creditNoteDate: "2026-06-12",
    status: "credit-note-issued",
    receivedDate: "2026-06-10",
    remarks: "Atta batch expiring in 10 days; per trade agreement items within 15-day shelf life are returnable.",
    approvedBy: "emp-020",
  },
  {
    id: "crn-007",
    ref: "CRN-2526-007",
    date: "2026-06-10",
    customerName: "Vishal Mega Mart Pvt Ltd",
    customerGstin: "07AABCV6789J1Z4",
    entityId: "ent-nexa-trade",
    locationId: "loc-del",
    lines: [
      { itemName: "Sunflower Oil 1 L", hsn: "1512", qtyReturned: 200, qtyApproved: 190, uom: "BTL", rate: 140, amount: 26600, reason: "quality-issue", disposition: "rework", originalInvoiceRef: "INV-2526-0147" },
    ],
    totalReturned: 26600,
    creditNoteRef: null,
    creditNoteDate: null,
    status: "goods-received",
    receivedDate: "2026-06-15",
    remarks: "10 bottles with broken tamper-proof rings withheld. 190 bottles cleared for deodorisation re-run.",
    approvedBy: "emp-023",
  },
  {
    id: "crn-008",
    ref: "CRN-2526-008",
    date: "2026-06-14",
    customerName: "Nilgiris Dairy Farm Ltd",
    customerGstin: "33AABCN1234K1Z2",
    entityId: "ent-nexa-in",
    locationId: "loc-blr",
    lines: [
      { itemName: "Premium Basmati Rice 1 kg", hsn: "1006", qtyReturned: 100, qtyApproved: 100, uom: "PKT", rate: 220, amount: 22000, reason: "transit-damage", disposition: "restock", originalInvoiceRef: "INV-2526-0158" },
      { itemName: "Organic Rice 5 kg", hsn: "1006", qtyReturned: 50, qtyApproved: 50, uom: "BAG", rate: 450, amount: 22500, reason: "transit-damage", disposition: "restock", originalInvoiceRef: "INV-2526-0158" },
    ],
    totalReturned: 44500,
    creditNoteRef: "CN-2526-004",
    creditNoteDate: "2026-06-20",
    status: "closed",
    receivedDate: "2026-06-18",
    remarks: "Outer packaging damaged in transit; inner seals intact. Inspection confirmed restockable.",
    approvedBy: "emp-020",
  },
  {
    id: "crn-009",
    ref: "CRN-2526-009",
    date: "2026-06-18",
    customerName: "SPAR Hypermarkets India Pvt Ltd",
    customerGstin: "29AAACS5678L1Z0",
    entityId: "ent-nexa-in",
    locationId: "loc-blr",
    lines: [
      { itemName: "Atta 5 kg (Whole Wheat)", hsn: "1101", qtyReturned: 300, qtyApproved: 300, uom: "PKT", rate: 180, amount: 54000, reason: "excess-delivery", disposition: "restock", originalInvoiceRef: "INV-2526-0169" },
    ],
    totalReturned: 54000,
    creditNoteRef: null,
    creditNoteDate: null,
    status: "requested",
    receivedDate: null,
    remarks: "Dispatched 800 units vs 500 on order. Customer confirmed receipt of correct 500. Returning 300.",
    approvedBy: null,
  },
  {
    id: "crn-010",
    ref: "CRN-2526-010",
    date: "2026-06-22",
    customerName: "Heritage Foods Ltd",
    customerGstin: "36AABCH9012M1Z8",
    entityId: "ent-nexa-trade",
    locationId: "loc-mum",
    lines: [
      { itemName: "Ready-to-eat Poha 500 g", hsn: "1904", qtyReturned: 250, qtyApproved: 250, uom: "PKT", rate: 65, amount: 16250, reason: "wrong-product", disposition: "return-to-vendor", originalInvoiceRef: "INV-2526-0175" },
    ],
    totalReturned: 16250,
    creditNoteRef: null,
    creditNoteDate: null,
    status: "approved",
    receivedDate: null,
    remarks: "Customer ordered flavoured poha variant; plain variety dispatched in error. Routing to investigate vendor SKU mapping.",
    approvedBy: "emp-023",
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

const RETURNS_KEY = "nexa-customer-returns";

export const loadReturns = () => load<CustomerReturn>(RETURNS_KEY);
export const saveReturns = (v: CustomerReturn[]) => save(RETURNS_KEY, v);
export function allReturns(added: CustomerReturn[]) { return [...SEED_RETURNS, ...added]; }

export function nextCRNRef(added: CustomerReturn[]): string {
  const all = allReturns(added);
  let max = 0;
  for (const r of all) {
    const n = parseInt(r.ref.split("-").pop() ?? "0", 10);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return `CRN-2526-${String(max + 1).padStart(3, "0")}`;
}

export function nextCNRef(added: CustomerReturn[]): string {
  const all = allReturns(added);
  let max = 0;
  for (const r of all) {
    if (!r.creditNoteRef) continue;
    const n = parseInt(r.creditNoteRef.split("-").pop() ?? "0", 10);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return `CN-2526-${String(max + 1).padStart(3, "0")}`;
}
