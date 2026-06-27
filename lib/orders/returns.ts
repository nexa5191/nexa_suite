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

export const SEED_RETURNS: CustomerReturn[] = [];

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
