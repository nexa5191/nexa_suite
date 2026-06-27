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

export const SEED_CHALLANS: DeliveryChallan[] = [];

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
