export type TransferStatus = "draft" | "dispatched" | "in-transit" | "received" | "cancelled";

export interface TransferLine {
  itemId: string;
  qtyRequested: number;
  qtyDispatched: number;
  qtyReceived: number;
  uom: string;
  fromBin: string | null;
  toBin: string | null;
}

export interface TransferOrder {
  id: string;
  ref: string;
  fromLocationId: string;
  toLocationId: string;
  status: TransferStatus;
  dispatchDate: string | null;
  expectedArrival: string | null;
  receivedDate: string | null;
  lines: TransferLine[];
  remarks: string;
  createdAt: string;
}

export const TRANSFER_STATUS_META: Record<
  TransferStatus,
  { label: string; variant: "default" | "primary" | "success" | "warning" | "danger" }
> = {
  draft:       { label: "Draft",      variant: "default"  },
  dispatched:  { label: "Dispatched", variant: "primary"  },
  "in-transit":{ label: "In Transit", variant: "warning"  },
  received:    { label: "Received",   variant: "success"  },
  cancelled:   { label: "Cancelled",  variant: "danger"   },
};

export const SEED_TRANSFERS: TransferOrder[] = [];

const TRANSFERS_KEY = "nexa-transfers";

export function loadTransfers(): TransferOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(TRANSFERS_KEY);
    if (raw) return JSON.parse(raw) as TransferOrder[];
  } catch { /* ignore */ }
  return [];
}

export function saveTransfers(transfers: TransferOrder[]) {
  try { localStorage.setItem(TRANSFERS_KEY, JSON.stringify(transfers)); } catch { /* ignore */ }
}

export function allTransfers(saved: TransferOrder[]): TransferOrder[] {
  if (saved.length === 0) return [...SEED_TRANSFERS];
  return [
    ...SEED_TRANSFERS.map((t) => saved.find((s) => s.id === t.id) ?? t),
    ...saved.filter((t) => !SEED_TRANSFERS.some((s) => s.id === t.id)),
  ];
}

export function nextTransferRef(transfers: TransferOrder[]): string {
  const max = transfers
    .map((t) => t.ref.match(/^TRF-2526-(\d+)$/))
    .filter(Boolean)
    .reduce((n, m) => Math.max(n, parseInt(m![1], 10)), 0);
  return `TRF-2526-${String(max + 1).padStart(3, "0")}`;
}

export function daysInTransit(dispatchDate: string, today: string): number {
  return Math.round((new Date(today).getTime() - new Date(dispatchDate).getTime()) / 86400000);
}

export function hasShortage(t: TransferOrder): boolean {
  return t.status === "received" && t.lines.some((l) => l.qtyReceived < l.qtyDispatched);
}
