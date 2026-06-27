export type EwayBillType = "outward" | "inward" | "job-work" | "SKD/CKD" | "line-sales" | "other";
export type EwayStatus = "active" | "cancelled" | "expired" | "extended";
export type TransportMode = "road" | "rail" | "air" | "ship";

export interface EwayBill {
  id: string;
  ewbNo: string;
  date: string;
  validUpto: string;
  type: EwayBillType;
  subType: string;
  status: EwayStatus;
  fromGstin: string;
  fromTradeName: string;
  fromAddress: string;
  fromState: string;
  toGstin: string;
  toTradeName: string;
  toAddress: string;
  toState: string;
  transportMode: TransportMode;
  vehicleNo: string;
  transDocNo: string;
  distanceKm: number;
  taxableValue: number;
  igst: number;
  cgst: number;
  sgst: number;
  totalValue: number;
  documentType: "invoice" | "delivery-challan" | "credit-note" | "bill-of-entry";
  documentNo: string;
  hsn: string;
  itemDescription: string;
  linkedChallanRef: string | null;
}

export const INDIAN_STATES = [
  "Andhra Pradesh",
  "Assam",
  "Bihar",
  "Chhattisgarh",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Madhya Pradesh",
  "Maharashtra",
  "Odisha",
  "Punjab",
  "Rajasthan",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];

export const SEED_EWAYS: EwayBill[] = [
  {
    id: "ewb-001",
    ewbNo: "780132456789",
    date: "2026-06-25",
    validUpto: "2026-06-30",
    type: "outward",
    subType: "Supply",
    status: "active",
    fromGstin: "29ABCDE1234F1Z5",
    fromTradeName: "Nexa Foods Pvt Ltd",
    fromAddress: "Electronics City, Bengaluru, KA 560100",
    fromState: "Karnataka",
    toGstin: "27AABCM1234A1Z5",
    toTradeName: "Metro Cash & Carry India Pvt Ltd",
    toAddress: "Taloja MIDC, Navi Mumbai, MH 410208",
    toState: "Maharashtra",
    transportMode: "road",
    vehicleNo: "KA51AB1234",
    transDocNo: "VRL/2526/34521",
    distanceKm: 1000,
    taxableValue: 790000,
    igst: 142200,
    cgst: 0,
    sgst: 0,
    totalValue: 932200,
    documentType: "invoice",
    documentNo: "INV-2526-0142",
    hsn: "1006",
    itemDescription: "Basmati Rice Premium & Wheat Flour",
    linkedChallanRef: "DC-2526-001",
  },
  {
    id: "ewb-002",
    ewbNo: "790412345678",
    date: "2026-06-23",
    validUpto: "2026-07-03",
    type: "outward",
    subType: "Supply",
    status: "active",
    fromGstin: "29ABCDE1234F1Z5",
    fromTradeName: "Nexa Foods Pvt Ltd",
    fromAddress: "Electronics City, Bengaluru, KA 560100",
    fromState: "Karnataka",
    toGstin: "07AABCD5678F1Z2",
    toTradeName: "Reliance Retail Ltd — Delhi",
    toAddress: "Okhla Industrial Area Phase I, New Delhi, DL 110020",
    toState: "Delhi",
    transportMode: "road",
    vehicleNo: "KA52CD5678",
    transDocNo: "TCI/2526/10234",
    distanceKm: 2000,
    taxableValue: 1200000,
    igst: 216000,
    cgst: 0,
    sgst: 0,
    totalValue: 1416000,
    documentType: "invoice",
    documentNo: "INV-2526-0138",
    hsn: "1006",
    itemDescription: "Basmati Rice Premium 25 kg bags",
    linkedChallanRef: null,
  },
  {
    id: "ewb-003",
    ewbNo: "801234567890",
    date: "2026-06-24",
    validUpto: "2026-07-04",
    type: "outward",
    subType: "Supply",
    status: "active",
    fromGstin: "29ABCDE1234F1Z5",
    fromTradeName: "Nexa Foods Pvt Ltd",
    fromAddress: "Electronics City, Bengaluru, KA 560100",
    fromState: "Karnataka",
    toGstin: "19AABCE9012G1Z8",
    toTradeName: "Kolkata Wholesale Foods Pvt Ltd",
    toAddress: "Strand Road, Kolkata, WB 700001",
    toState: "West Bengal",
    transportMode: "rail",
    vehicleNo: "RR/SBC/KOL/2526",
    transDocNo: "IR/2526/RR54321",
    distanceKm: 2000,
    taxableValue: 850000,
    igst: 153000,
    cgst: 0,
    sgst: 0,
    totalValue: 1003000,
    documentType: "invoice",
    documentNo: "INV-2526-0135",
    hsn: "1701",
    itemDescription: "Sugar 25 kg bags & Refined Sunflower Oil 15 L",
    linkedChallanRef: null,
  },
  {
    id: "ewb-004",
    ewbNo: "812345678901",
    date: "2026-06-22",
    validUpto: "2026-07-05",
    type: "inward",
    subType: "Supply",
    status: "active",
    fromGstin: "03AABCW1234H1Z6",
    fromTradeName: "Punjab Wheat Traders Association",
    fromAddress: "Grain Market, Ludhiana, PB 141003",
    fromState: "Punjab",
    toGstin: "29ABCDE1234F1Z5",
    toTradeName: "Nexa Foods Pvt Ltd",
    toAddress: "Mysuru Plant, Hebbal Industrial Area, Mysuru, KA 570016",
    toState: "Karnataka",
    transportMode: "road",
    vehicleNo: "PB10EF8901",
    transDocNo: "SF/2526/87654",
    distanceKm: 2500,
    taxableValue: 920000,
    igst: 165600,
    cgst: 0,
    sgst: 0,
    totalValue: 1085600,
    documentType: "invoice",
    documentNo: "PWT/2526/0089",
    hsn: "1001",
    itemDescription: "Wheat (HD-2967 variety) — raw grain",
    linkedChallanRef: null,
  },
  {
    id: "ewb-005",
    ewbNo: "823456789012",
    date: "2026-06-25",
    validUpto: "2026-06-29",
    type: "outward",
    subType: "Supply",
    status: "active",
    fromGstin: "29ABCDE1234F1Z5",
    fromTradeName: "Nexa Foods Pvt Ltd",
    fromAddress: "Mysuru Plant, Hebbal Industrial Area, Mysuru, KA 570016",
    fromState: "Karnataka",
    toGstin: "27ABCDE1234F3Z1",
    toTradeName: "Nexa Foods — Pune Outlet",
    toAddress: "Gat No. 102, Chakan Industrial Area, Pune, MH 410501",
    toState: "Maharashtra",
    transportMode: "road",
    vehicleNo: "MH12DE3456",
    transDocNo: "VRL/2526/34899",
    distanceKm: 800,
    taxableValue: 435000,
    igst: 78300,
    cgst: 0,
    sgst: 0,
    totalValue: 513300,
    documentType: "delivery-challan",
    documentNo: "DC-2526-004",
    hsn: "1512",
    itemDescription: "Basmati Rice 25 kg & Refined Sunflower Oil 15 L",
    linkedChallanRef: "DC-2526-004",
  },
  {
    id: "ewb-006",
    ewbNo: "834567890123",
    date: "2026-06-26",
    validUpto: "2026-06-27",
    type: "job-work",
    subType: "Job Work",
    status: "active",
    fromGstin: "29ABCDE1234F1Z5",
    fromTradeName: "Nexa Foods Pvt Ltd",
    fromAddress: "Electronics City, Bengaluru, KA 560100",
    fromState: "Karnataka",
    toGstin: "29AABCP5678C1Z9",
    toTradeName: "Precision Grain Processors Pvt Ltd",
    toAddress: "Industrial Area, Hebbal, Mysuru, KA 570016",
    toState: "Karnataka",
    transportMode: "road",
    vehicleNo: "KA09BC4567",
    transDocNo: "GATI/2526/22341",
    distanceKm: 160,
    taxableValue: 301000,
    igst: 0,
    cgst: 27090,
    sgst: 27090,
    totalValue: 355180,
    documentType: "delivery-challan",
    documentNo: "DC-2526-003",
    hsn: "1001",
    itemDescription: "Wheat & Chana — raw grain for job work processing",
    linkedChallanRef: "DC-2526-003",
  },
  {
    id: "ewb-007",
    ewbNo: "845678901234",
    date: "2026-06-26",
    validUpto: "2026-07-01",
    type: "outward",
    subType: "Supply",
    status: "active",
    fromGstin: "29ABCDE1234F1Z5",
    fromTradeName: "Nexa Foods Pvt Ltd",
    fromAddress: "Electronics City, Bengaluru, KA 560100",
    fromState: "Karnataka",
    toGstin: "27AABCB1234G1Z7",
    toTradeName: "BigBasket Warehouse (Mumbai)",
    toAddress: "Bhiwandi Logistics Park, Thane, MH 421302",
    toState: "Maharashtra",
    transportMode: "air",
    vehicleNo: "BLR-BOM/IND6E2345",
    transDocNo: "IE/2526/AWB88901",
    distanceKm: 1000,
    taxableValue: 490000,
    igst: 88200,
    cgst: 0,
    sgst: 0,
    totalValue: 578200,
    documentType: "invoice",
    documentNo: "INV-2526-0145",
    hsn: "1514",
    itemDescription: "Mustard Oil 15 L & Turmeric Powder 25 kg",
    linkedChallanRef: null,
  },
  {
    id: "ewb-008",
    ewbNo: "856789012345",
    date: "2026-06-25",
    validUpto: "2026-06-29",
    type: "line-sales",
    subType: "Line Sales",
    status: "active",
    fromGstin: "27ABCDE1234F2Z3",
    fromTradeName: "Nexa Trading LLP",
    fromAddress: "Mumbai Depot, Bhiwandi, MH 421302",
    fromState: "Maharashtra",
    toGstin: "36AABCD9876E1Z3",
    toTradeName: "D-Mart Retail Ltd (Hyderabad)",
    toAddress: "Vipps Centre, Jubilee Hills, Hyderabad, TS 500033",
    toState: "Telangana",
    transportMode: "road",
    vehicleNo: "MH04GH9012",
    transDocNo: "KWE/2526/LR11234",
    distanceKm: 800,
    taxableValue: 620000,
    igst: 111600,
    cgst: 0,
    sgst: 0,
    totalValue: 731600,
    documentType: "invoice",
    documentNo: "INV-2526-0141",
    hsn: "1101",
    itemDescription: "Wheat Flour (Atta) 50 kg bags",
    linkedChallanRef: null,
  },
  {
    id: "ewb-009",
    ewbNo: "867890123456",
    date: "2026-06-26",
    validUpto: "2026-06-28",
    type: "outward",
    subType: "Supply",
    status: "active",
    fromGstin: "29ABCDE1234F1Z5",
    fromTradeName: "Nexa Foods Pvt Ltd",
    fromAddress: "Electronics City, Bengaluru, KA 560100",
    fromState: "Karnataka",
    toGstin: "33AABCI1234L1Z8",
    toTradeName: "ITC Foods Ltd",
    toAddress: "Anna Salai, Chennai, TN 600002",
    toState: "Tamil Nadu",
    transportMode: "ship",
    vehicleNo: "VESSEL/BLRCHN/0627",
    transDocNo: "CSL/2526/BL44567",
    distanceKm: 350,
    taxableValue: 350000,
    igst: 63000,
    cgst: 0,
    sgst: 0,
    totalValue: 413000,
    documentType: "delivery-challan",
    documentNo: "DC-2526-011",
    hsn: "0910",
    itemDescription: "Spice Blend Mix samples & Wheat Flour Heritage",
    linkedChallanRef: "DC-2526-011",
  },
  {
    id: "ewb-010",
    ewbNo: "878901234567",
    date: "2026-06-15",
    validUpto: "2026-06-18",
    type: "outward",
    subType: "Supply",
    status: "expired",
    fromGstin: "29ABCDE1234F1Z5",
    fromTradeName: "Nexa Foods Pvt Ltd",
    fromAddress: "Electronics City, Bengaluru, KA 560100",
    fromState: "Karnataka",
    toGstin: "36AABCD9876E1Z3",
    toTradeName: "D-Mart Retail Ltd (Hyderabad)",
    toAddress: "Kukatpally, Hyderabad, TS 500072",
    toState: "Telangana",
    transportMode: "road",
    vehicleNo: "KA53GH3456",
    transDocNo: "VRL/2526/31122",
    distanceKm: 600,
    taxableValue: 537500,
    igst: 96750,
    cgst: 0,
    sgst: 0,
    totalValue: 634250,
    documentType: "invoice",
    documentNo: "INV-2526-0121",
    hsn: "1101",
    itemDescription: "Wheat Flour 50 kg & Sugar 25 kg",
    linkedChallanRef: "DC-2526-005",
  },
  {
    id: "ewb-011",
    ewbNo: "889012345678",
    date: "2026-06-18",
    validUpto: "2026-06-20",
    type: "outward",
    subType: "Supply",
    status: "expired",
    fromGstin: "29ABCDE1234F1Z5",
    fromTradeName: "Nexa Foods Pvt Ltd",
    fromAddress: "Electronics City, Bengaluru, KA 560100",
    fromState: "Karnataka",
    toGstin: "33AABCB1234G1Z7",
    toTradeName: "BigBasket Warehouse (Chennai)",
    toAddress: "Ambattur Industrial Estate, Chennai, TN 600058",
    toState: "Tamil Nadu",
    transportMode: "road",
    vehicleNo: "KA01GH8901",
    transDocNo: "DELHIVERY/2526/D99123",
    distanceKm: 350,
    taxableValue: 480000,
    igst: 86400,
    cgst: 0,
    sgst: 0,
    totalValue: 566400,
    documentType: "invoice",
    documentNo: "INV-2526-0127",
    hsn: "1512",
    itemDescription: "Refined Sunflower Oil 15 L cans",
    linkedChallanRef: null,
  },
  {
    id: "ewb-012",
    ewbNo: "890123456789",
    date: "2026-06-10",
    validUpto: "2026-06-15",
    type: "inward",
    subType: "Supply",
    status: "expired",
    fromGstin: "27AABCW5678I1Z1",
    fromTradeName: "Western Mills Ltd",
    fromAddress: "MIDC Satpur, Nashik, MH 422007",
    fromState: "Maharashtra",
    toGstin: "29ABCDE1234F1Z5",
    toTradeName: "Nexa Foods Pvt Ltd",
    toAddress: "Electronics City, Bengaluru, KA 560100",
    toState: "Karnataka",
    transportMode: "road",
    vehicleNo: "MH15KL5678",
    transDocNo: "SAFEX/2526/S34221",
    distanceKm: 1000,
    taxableValue: 1050000,
    igst: 189000,
    cgst: 0,
    sgst: 0,
    totalValue: 1239000,
    documentType: "invoice",
    documentNo: "WMILL/2526/0234",
    hsn: "1101",
    itemDescription: "Wheat Flour (commercial grade) 50 kg bags",
    linkedChallanRef: null,
  },
  {
    id: "ewb-013",
    ewbNo: "901234567890",
    date: "2026-05-20",
    validUpto: "2026-05-30",
    type: "outward",
    subType: "Supply",
    status: "expired",
    fromGstin: "29ABCDE1234F1Z5",
    fromTradeName: "Nexa Foods Pvt Ltd",
    fromAddress: "Electronics City, Bengaluru, KA 560100",
    fromState: "Karnataka",
    toGstin: "07AABCD5678F1Z2",
    toTradeName: "Reliance Retail Ltd — Delhi",
    toAddress: "Okhla Industrial Area Phase I, New Delhi, DL 110020",
    toState: "Delhi",
    transportMode: "rail",
    vehicleNo: "RR/SBC/NDLS/2526",
    transDocNo: "IR/2526/RR54009",
    distanceKm: 2000,
    taxableValue: 750000,
    igst: 135000,
    cgst: 0,
    sgst: 0,
    totalValue: 885000,
    documentType: "invoice",
    documentNo: "INV-2526-0098",
    hsn: "1006",
    itemDescription: "Basmati Rice Premium 25 kg bags",
    linkedChallanRef: null,
  },
  {
    id: "ewb-014",
    ewbNo: "912345678901",
    date: "2026-06-20",
    validUpto: "2026-06-25",
    type: "outward",
    subType: "Supply",
    status: "cancelled",
    fromGstin: "29ABCDE1234F1Z5",
    fromTradeName: "Nexa Foods Pvt Ltd",
    fromAddress: "Electronics City, Bengaluru, KA 560100",
    fromState: "Karnataka",
    toGstin: "24AABCG9012J1Z4",
    toTradeName: "Grocery Mart Ltd — Ahmedabad",
    toAddress: "GIDC Vatva, Ahmedabad, GJ 382445",
    toState: "Gujarat",
    transportMode: "road",
    vehicleNo: "KA55MN1234",
    transDocNo: "VRL/2526/34101",
    distanceKm: 1500,
    taxableValue: 600000,
    igst: 108000,
    cgst: 0,
    sgst: 0,
    totalValue: 708000,
    documentType: "invoice",
    documentNo: "INV-2526-0131",
    hsn: "1006",
    itemDescription: "Basmati Rice Premium 25 kg bags",
    linkedChallanRef: null,
  },
  {
    id: "ewb-015",
    ewbNo: "923456789012",
    date: "2026-06-19",
    validUpto: "2026-06-23",
    type: "outward",
    subType: "Supply",
    status: "cancelled",
    fromGstin: "27ABCDE1234F2Z3",
    fromTradeName: "Nexa Trading LLP",
    fromAddress: "Mumbai Depot, Bhiwandi, MH 421302",
    fromState: "Maharashtra",
    toGstin: "08AABCJ1234K1Z7",
    toTradeName: "Rajasthan Food Distributors",
    toAddress: "Sanganer, Jaipur, RJ 302029",
    toState: "Rajasthan",
    transportMode: "road",
    vehicleNo: "MH04PQ7890",
    transDocNo: "GATI/2526/22109",
    distanceKm: 1200,
    taxableValue: 420000,
    igst: 75600,
    cgst: 0,
    sgst: 0,
    totalValue: 495600,
    documentType: "invoice",
    documentNo: "INV-2526-0128",
    hsn: "1701",
    itemDescription: "Sugar M-grade 50 kg bags",
    linkedChallanRef: null,
  },
  {
    id: "ewb-016",
    ewbNo: "934567890123",
    date: "2026-06-21",
    validUpto: "2026-06-23",
    type: "outward",
    subType: "Supply",
    status: "cancelled",
    fromGstin: "29ABCDE1234F1Z5",
    fromTradeName: "Nexa Foods Pvt Ltd",
    fromAddress: "Mysuru Plant, Hebbal Industrial Area, Mysuru, KA 570016",
    fromState: "Karnataka",
    toGstin: "37AABCA1234L1Z9",
    toTradeName: "AP Agro Wholesale Market",
    toAddress: "Kurnool Road, Guntur, AP 522001",
    toState: "Andhra Pradesh",
    transportMode: "road",
    vehicleNo: "KA09TU2345",
    transDocNo: "TCI/2526/10567",
    distanceKm: 700,
    taxableValue: 380000,
    igst: 68400,
    cgst: 0,
    sgst: 0,
    totalValue: 448400,
    documentType: "invoice",
    documentNo: "INV-2526-0133",
    hsn: "0713",
    itemDescription: "Chana Dal 25 kg & Masoor Dal 25 kg bags",
    linkedChallanRef: null,
  },
];

const EWAY_KEY = "nexa-eway-bills";

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

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function daysBetween(from: string, to: string): number {
  const ms = new Date(to + "T00:00:00Z").getTime() - new Date(from + "T00:00:00Z").getTime();
  return Math.round(ms / 86400000);
}

/** Validity period in days given a distance (1 day per 200 km, min 1, max 15). */
export function validityDays(distanceKm: number): number {
  return Math.min(15, Math.max(1, Math.ceil(distanceKm / 200)));
}

/** Compute live status — a bill might have expired since it was created. */
export function liveStatus(bill: EwayBill, today: string): EwayStatus {
  if (bill.status === "cancelled") return "cancelled";
  if (bill.validUpto < today) return "expired";
  return bill.status;
}

export function isExpiringWithin24h(bill: EwayBill, today: string): boolean {
  const st = liveStatus(bill, today);
  if (st === "cancelled" || st === "expired") return false;
  return bill.validUpto <= addDays(today, 1);
}

export function expiryLabel(bill: EwayBill, today: string): string {
  const diff = daysBetween(today, bill.validUpto);
  if (diff > 1) return `Expires in ${diff}d`;
  if (diff === 1) return "Expires tomorrow";
  if (diff === 0) return "Expires today";
  const ago = Math.abs(diff);
  return `Expired ${ago}d ago`;
}

export function canExtend(bill: EwayBill, today: string): boolean {
  const st = liveStatus(bill, today);
  if (st === "cancelled" || st === "expired") return false;
  return daysBetween(bill.date, bill.validUpto) < 15;
}

export function extendBill(bill: EwayBill): EwayBill {
  return {
    ...bill,
    validUpto: addDays(bill.validUpto, 1),
    status: "extended",
  };
}

export function loadEways(): EwayBill[] {
  const stored = lsRead<EwayBill[] | null>(EWAY_KEY, null);
  if (stored) return stored;
  return [...SEED_EWAYS];
}

export function saveEways(bills: EwayBill[]): void {
  lsWrite(EWAY_KEY, bills);
}

export function nextEwbNo(bills: EwayBill[]): string {
  const nums = bills
    .map((b) => parseInt(b.ewbNo, 10))
    .filter((n) => !isNaN(n) && n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : 934567890123;
  return String(max + 1);
}

export function createEway(
  draft: Omit<EwayBill, "id" | "ewbNo" | "status" | "igst" | "cgst" | "sgst" | "totalValue" | "validUpto">,
  existing: EwayBill[],
): EwayBill {
  const isInterState = draft.fromState !== draft.toState;
  const igst = isInterState ? Math.round(draft.taxableValue * 0.18) : 0;
  const cgst = isInterState ? 0 : Math.round(draft.taxableValue * 0.09);
  const sgst = isInterState ? 0 : Math.round(draft.taxableValue * 0.09);
  const days = validityDays(draft.distanceKm);
  const validUpto = addDays(draft.date, days);
  return {
    ...draft,
    id: `ewb-${Date.now()}`,
    ewbNo: nextEwbNo(existing),
    status: "active",
    igst,
    cgst,
    sgst,
    totalValue: draft.taxableValue + igst + cgst + sgst,
    validUpto,
  };
}
