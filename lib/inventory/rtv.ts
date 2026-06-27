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

export const SEED_RTVS: ReturnToVendor[] = [];

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
