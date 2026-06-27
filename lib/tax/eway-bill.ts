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

export const SEED_EWAYS: EwayBill[] = [];

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
