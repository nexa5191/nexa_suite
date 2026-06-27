export type ChallanType = "sale" | "returnable" | "job-work" | "branch-transfer" | "sample";
export type ChallanStatus = "draft" | "issued" | "delivered" | "returned" | "invoiced" | "cancelled";

export interface ChallanLine {
  itemName: string;
  hsn: string;
  qty: number;
  uom: string;
  rate: number;
  amount: number;
}

export interface DeliveryChallan {
  id: string;
  ref: string;
  date: string;
  type: ChallanType;
  entityId: string;
  consigneeName: string;
  consigneeAddress: string;
  consigneeGstin: string;
  vehicleNo: string;
  driverName: string;
  dispatchFrom: string;
  deliverTo: string;
  lines: ChallanLine[];
  totalQty: number;
  totalAmount: number;
  status: ChallanStatus;
  linkedInvoiceRef: string | null;
  ewayBillNo: string | null;
  remarks: string;
}

export const SEED_CHALLANS: DeliveryChallan[] = [
  {
    id: "dc-001",
    ref: "DC-2526-001",
    date: "2026-06-20",
    type: "sale",
    entityId: "ent-nexa-in",
    consigneeName: "Metro Cash & Carry India Pvt Ltd",
    consigneeAddress: "Survey No. 14, Whitefield Road, Bengaluru, KA 560066",
    consigneeGstin: "29AABCM1234A1Z5",
    vehicleNo: "KA51AB1234",
    driverName: "Ramu Naik",
    dispatchFrom: "Bengaluru HQ",
    deliverTo: "Whitefield, Bengaluru",
    lines: [
      { itemName: "Basmati Rice Premium 25 kg", hsn: "1006", qty: 200, uom: "Bag", rate: 3000, amount: 600000 },
      { itemName: "Wheat Flour (Atta) 50 kg", hsn: "1101", qty: 100, uom: "Bag", rate: 1900, amount: 190000 },
    ],
    totalQty: 300,
    totalAmount: 790000,
    status: "invoiced",
    linkedInvoiceRef: "INV-2526-0142",
    ewayBillNo: "780132456789",
    remarks: "Tax invoice to follow within 24 hours",
  },
  {
    id: "dc-002",
    ref: "DC-2526-002",
    date: "2026-06-18",
    type: "returnable",
    entityId: "ent-nexa-in",
    consigneeName: "Reliance Fresh Processing Division",
    consigneeAddress: "Plot 5A, Taloja MIDC, Navi Mumbai, MH 410208",
    consigneeGstin: "27AADCR1234B1Z2",
    vehicleNo: "MH04GH5678",
    driverName: "Suresh Pawar",
    dispatchFrom: "Bengaluru HQ",
    deliverTo: "Taloja MIDC, Navi Mumbai",
    lines: [
      { itemName: "SS Food Drums 200 L (Returnable)", hsn: "7310", qty: 50, uom: "Nos", rate: 8000, amount: 400000 },
    ],
    totalQty: 50,
    totalAmount: 400000,
    status: "returned",
    linkedInvoiceRef: null,
    ewayBillNo: "790245678901",
    remarks: "Drums to be returned within 7 days. Security deposit ₹4,00,000",
  },
  {
    id: "dc-003",
    ref: "DC-2526-003",
    date: "2026-06-24",
    type: "job-work",
    entityId: "ent-nexa-in",
    consigneeName: "Precision Grain Processors Pvt Ltd",
    consigneeAddress: "Industrial Area, Hebbal, Mysuru, KA 570016",
    consigneeGstin: "29AABCP5678C1Z9",
    vehicleNo: "KA09BC4567",
    driverName: "Hanumappa G",
    dispatchFrom: "Mysuru Plant",
    deliverTo: "Hebbal Industrial Area, Mysuru",
    lines: [
      { itemName: "Wheat (Raw, for cleaning & grading)", hsn: "1001", qty: 5000, uom: "Kg", rate: 25, amount: 125000 },
      { itemName: "Chana (Raw, for grading)", hsn: "0713", qty: 2000, uom: "Kg", rate: 88, amount: 176000 },
    ],
    totalQty: 7000,
    totalAmount: 301000,
    status: "issued",
    linkedInvoiceRef: null,
    ewayBillNo: null,
    remarks: "Job work — cleaning and grading. Return within 10 working days",
  },
  {
    id: "dc-004",
    ref: "DC-2526-004",
    date: "2026-06-19",
    type: "branch-transfer",
    entityId: "ent-nexa-in",
    consigneeName: "Nexa Foods — Pune Outlet",
    consigneeAddress: "Gat No. 102, Chakan Industrial Area, Pune, MH 410501",
    consigneeGstin: "27ABCDE1234F3Z1",
    vehicleNo: "MH12DE3456",
    driverName: "Pratap Shinde",
    dispatchFrom: "Bengaluru HQ",
    deliverTo: "Chakan, Pune",
    lines: [
      { itemName: "Basmati Rice Premium 25 kg", hsn: "1006", qty: 100, uom: "Bag", rate: 3000, amount: 300000 },
      { itemName: "Refined Sunflower Oil 15 L", hsn: "1512", qty: 50, uom: "Can", rate: 2700, amount: 135000 },
    ],
    totalQty: 150,
    totalAmount: 435000,
    status: "delivered",
    linkedInvoiceRef: null,
    ewayBillNo: "801345678901",
    remarks: "Stock transfer for Pune outlet replenishment",
  },
  {
    id: "dc-005",
    ref: "DC-2526-005",
    date: "2026-06-22",
    type: "sale",
    entityId: "ent-nexa-in",
    consigneeName: "D-Mart Retail Ltd (Hyderabad)",
    consigneeAddress: "Vipps Centre, Jubilee Hills, Hyderabad, TS 500033",
    consigneeGstin: "36AABCD9876E1Z3",
    vehicleNo: "TS09EF7890",
    driverName: "Venkateswara Rao",
    dispatchFrom: "Bengaluru HQ",
    deliverTo: "Jubilee Hills, Hyderabad",
    lines: [
      { itemName: "Wheat Flour (Atta) 50 kg", hsn: "1101", qty: 200, uom: "Bag", rate: 1900, amount: 380000 },
      { itemName: "Sugar 25 kg", hsn: "1701", qty: 150, uom: "Bag", rate: 1050, amount: 157500 },
    ],
    totalQty: 350,
    totalAmount: 537500,
    status: "delivered",
    linkedInvoiceRef: null,
    ewayBillNo: "812456789012",
    remarks: "Invoice to be raised after delivery confirmation",
  },
  {
    id: "dc-006",
    ref: "DC-2526-006",
    date: "2026-06-27",
    type: "sale",
    entityId: "ent-nexa-in",
    consigneeName: "BigBasket Warehouse (Chennai)",
    consigneeAddress: "Plot 18, Ambattur Industrial Estate, Chennai, TN 600058",
    consigneeGstin: "33AABCB1234G1Z7",
    vehicleNo: "KA01GH2345",
    driverName: "Murugan K",
    dispatchFrom: "Bengaluru HQ",
    deliverTo: "Ambattur Industrial Estate, Chennai",
    lines: [
      { itemName: "Mustard Oil 15 L", hsn: "1514", qty: 100, uom: "Can", rate: 2400, amount: 240000 },
      { itemName: "Turmeric Powder 25 kg", hsn: "0910", qty: 50, uom: "Bag", rate: 5000, amount: 250000 },
    ],
    totalQty: 150,
    totalAmount: 490000,
    status: "issued",
    linkedInvoiceRef: null,
    ewayBillNo: "823567890123",
    remarks: "",
  },
  {
    id: "dc-007",
    ref: "DC-2526-007",
    date: "2026-06-16",
    type: "returnable",
    entityId: "ent-nexa-in",
    consigneeName: "Hindustan Unilever Ltd — Co-Pack Unit",
    consigneeAddress: "Chakala, Andheri East, Mumbai, MH 400093",
    consigneeGstin: "27AAACH0999Q1Z4",
    vehicleNo: "MH01KL9012",
    driverName: "Pradeep Kamble",
    dispatchFrom: "Bengaluru HQ",
    deliverTo: "Chakala, Andheri East, Mumbai",
    lines: [
      { itemName: "SS Mixing Vessels 500 L (Returnable)", hsn: "7321", qty: 10, uom: "Nos", rate: 50000, amount: 500000 },
      { itemName: "Plastic Pallets (Returnable)", hsn: "3926", qty: 20, uom: "Nos", rate: 5000, amount: 100000 },
    ],
    totalQty: 30,
    totalAmount: 600000,
    status: "cancelled",
    linkedInvoiceRef: null,
    ewayBillNo: null,
    remarks: "Cancelled — dispute over return terms and conditions",
  },
  {
    id: "dc-008",
    ref: "DC-2526-008",
    date: "2026-06-27",
    type: "sale",
    entityId: "ent-nexa-in",
    consigneeName: "More Supermarket — Mysuru",
    consigneeAddress: "Lakshmipuram Main Road, Mysuru, KA 570004",
    consigneeGstin: "29AABCM4567H1Z3",
    vehicleNo: "",
    driverName: "",
    dispatchFrom: "Mysuru Plant",
    deliverTo: "Lakshmipuram, Mysuru",
    lines: [
      { itemName: "Basmati Rice Premium 25 kg", hsn: "1006", qty: 50, uom: "Bag", rate: 3000, amount: 150000 },
      { itemName: "Chana Dal 25 kg", hsn: "0713", qty: 30, uom: "Bag", rate: 2375, amount: 71250 },
    ],
    totalQty: 80,
    totalAmount: 221250,
    status: "draft",
    linkedInvoiceRef: null,
    ewayBillNo: null,
    remarks: "Pending vehicle allocation",
  },
  {
    id: "dc-009",
    ref: "DC-2526-009",
    date: "2026-06-23",
    type: "sale",
    entityId: "ent-nexa-in",
    consigneeName: "Star Bazaar (Tata) — Bengaluru",
    consigneeAddress: "Sigma Mall, Cunningham Road, Bengaluru, KA 560052",
    consigneeGstin: "29AATCS1234K1Z1",
    vehicleNo: "KA03MN6789",
    driverName: "Shiva Kumar",
    dispatchFrom: "Bengaluru HQ",
    deliverTo: "Cunningham Road, Bengaluru",
    lines: [
      { itemName: "Refined Sunflower Oil 1 L Pouch", hsn: "1512", qty: 1000, uom: "Nos", rate: 175, amount: 175000 },
      { itemName: "Wheat Flour (Atta) 1 kg Pack", hsn: "1101", qty: 2000, uom: "Nos", rate: 42, amount: 84000 },
    ],
    totalQty: 3000,
    totalAmount: 259000,
    status: "delivered",
    linkedInvoiceRef: null,
    ewayBillNo: "834678901234",
    remarks: "Invoice pending — awaiting GRN confirmation from consignee",
  },
  {
    id: "dc-010",
    ref: "DC-2526-010",
    date: "2026-06-25",
    type: "branch-transfer",
    entityId: "ent-nexa-trade",
    consigneeName: "Nexa Trading LLP — Delhi Branch",
    consigneeAddress: "Plot 22, Okhla Industrial Area Phase II, New Delhi, DL 110020",
    consigneeGstin: "07ABCDE1234F2Z3",
    vehicleNo: "DL08PQ1234",
    driverName: "Ramesh Kumar",
    dispatchFrom: "Mumbai Depot",
    deliverTo: "Okhla Industrial Area, Delhi",
    lines: [
      { itemName: "Basmati Rice Premium 25 kg", hsn: "1006", qty: 200, uom: "Bag", rate: 3000, amount: 600000 },
      { itemName: "Wheat Flour (Atta) 50 kg", hsn: "1101", qty: 100, uom: "Bag", rate: 1900, amount: 190000 },
    ],
    totalQty: 300,
    totalAmount: 790000,
    status: "issued",
    linkedInvoiceRef: null,
    ewayBillNo: "845789012345",
    remarks: "Monthly stock transfer to Delhi branch",
  },
  {
    id: "dc-011",
    ref: "DC-2526-011",
    date: "2026-06-21",
    type: "sample",
    entityId: "ent-nexa-in",
    consigneeName: "ITC Foods Ltd — R&D Division",
    consigneeAddress: "ITC Centre, 760 Anna Salai, Chennai, TN 600002",
    consigneeGstin: "33AABCI1234L1Z8",
    vehicleNo: "TN07RS3456",
    driverName: "Selvam P",
    dispatchFrom: "Bengaluru HQ",
    deliverTo: "Anna Salai, Chennai",
    lines: [
      { itemName: "Spice Blend Mix 500 g (Sample)", hsn: "0910", qty: 20, uom: "Pouch", rate: 500, amount: 10000 },
      { itemName: "Wheat Flour Heritage 1 kg (Sample)", hsn: "1101", qty: 10, uom: "Pack", rate: 80, amount: 800 },
    ],
    totalQty: 30,
    totalAmount: 10800,
    status: "delivered",
    linkedInvoiceRef: null,
    ewayBillNo: null,
    remarks: "Product samples for R&D evaluation — no commercial value",
  },
  {
    id: "dc-012",
    ref: "DC-2526-012",
    date: "2026-06-27",
    type: "sale",
    entityId: "ent-nexa-in",
    consigneeName: "Godrej Nature's Basket",
    consigneeAddress: "Vittal Mallya Road, Bengaluru, KA 560001",
    consigneeGstin: "29AAACG1234M1Z2",
    vehicleNo: "KA19TU4567",
    driverName: "Lokesh N",
    dispatchFrom: "Bengaluru HQ",
    deliverTo: "Vittal Mallya Road, Bengaluru",
    lines: [
      { itemName: "Basmati Rice Premium 25 kg", hsn: "1006", qty: 80, uom: "Bag", rate: 3000, amount: 240000 },
      { itemName: "Mustard Oil 1 L Bottle", hsn: "1514", qty: 500, uom: "Nos", rate: 170, amount: 85000 },
    ],
    totalQty: 580,
    totalAmount: 325000,
    status: "issued",
    linkedInvoiceRef: null,
    ewayBillNo: "856890123456",
    remarks: "Premium product line — same-day Bengaluru delivery",
  },
];

const DC_KEY = "nexa-delivery-challans";

function lsRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch { /* ignore */ }
  return fallback;
}

function lsWrite<T>(key: string, val: T): void {
  try { localStorage.setItem(key, JSON.stringify(val)); } catch { /* ignore */ }
}

export function loadChallans(): DeliveryChallan[] {
  const stored = lsRead<DeliveryChallan[] | null>(DC_KEY, null);
  if (stored) return stored;
  return [...SEED_CHALLANS];
}

export function saveChallans(challans: DeliveryChallan[]): void {
  lsWrite(DC_KEY, challans);
}

export function nextRef(challans: DeliveryChallan[]): string {
  const nums = challans
    .map((c) => parseInt(c.ref.split("-")[2] ?? "0", 10))
    .filter((n) => !isNaN(n));
  const max = nums.length > 0 ? Math.max(...nums) : 0;
  return `DC-2526-${String(max + 1).padStart(3, "0")}`;
}

export function createChallan(
  draft: Omit<DeliveryChallan, "id" | "ref" | "totalQty" | "totalAmount">,
  existing: DeliveryChallan[],
): DeliveryChallan {
  return {
    ...draft,
    id: `dc-${Date.now()}`,
    ref: nextRef(existing),
    totalQty: draft.lines.reduce((s, l) => s + l.qty, 0),
    totalAmount: draft.lines.reduce((s, l) => s + l.amount, 0),
  };
}
