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

export const SEED_TRANSFERS: TransferOrder[] = [
  {
    id: "trf-001",
    ref: "TRF-2526-001",
    fromLocationId: "loc-mys",
    toLocationId: "loc-blr",
    status: "received",
    dispatchDate: "2026-05-28",
    expectedArrival: "2026-06-01",
    receivedDate: "2026-06-02",
    remarks: "Monthly BLR replenishment",
    createdAt: "2026-05-27",
    lines: [
      { itemId: "fg-flour50", qtyRequested: 150, qtyDispatched: 150, qtyReceived: 150, uom: "pcs", fromBin: "DSP-01", toBin: "RCV-01" },
      { itemId: "fg-atta10",  qtyRequested: 200, qtyDispatched: 200, qtyReceived: 200, uom: "pcs", fromBin: "DSP-01", toBin: "RCV-01" },
      { itemId: "fg-atta1",   qtyRequested: 1000,qtyDispatched: 1000,qtyReceived: 1000,uom: "pcs", fromBin: "DSP-02", toBin: "RCV-01" },
    ],
  },
  {
    id: "trf-002",
    ref: "TRF-2526-002",
    fromLocationId: "loc-mys",
    toLocationId: "loc-mum",
    status: "received",
    dispatchDate: "2026-05-25",
    expectedArrival: "2026-05-28",
    receivedDate: "2026-05-28",
    remarks: "MUM depot stock top-up",
    createdAt: "2026-05-24",
    lines: [
      { itemId: "fg-flour50", qtyRequested: 200, qtyDispatched: 200, qtyReceived: 200, uom: "pcs", fromBin: "DSP-01", toBin: "S-01-01" },
      { itemId: "fg-rice25",  qtyRequested: 150, qtyDispatched: 150, qtyReceived: 150, uom: "pcs", fromBin: "DSP-02", toBin: "S-01-01" },
      { itemId: "fg-oil15",   qtyRequested: 100, qtyDispatched: 100, qtyReceived:  95, uom: "pcs", fromBin: "DSP-01", toBin: "S-01-02" },
    ],
  },
  {
    id: "trf-003",
    ref: "TRF-2526-003",
    fromLocationId: "loc-mys",
    toLocationId: "loc-del",
    status: "in-transit",
    dispatchDate: "2026-06-20",
    expectedArrival: "2026-07-01",
    receivedDate: null,
    remarks: "DEL branch quarterly stock",
    createdAt: "2026-06-18",
    lines: [
      { itemId: "fg-flour50", qtyRequested: 100, qtyDispatched: 100, qtyReceived: 0, uom: "pcs", fromBin: "DSP-01", toBin: null },
      { itemId: "fg-atta10",  qtyRequested: 300, qtyDispatched: 300, qtyReceived: 0, uom: "pcs", fromBin: "DSP-02", toBin: null },
    ],
  },
  {
    id: "trf-004",
    ref: "TRF-2526-004",
    fromLocationId: "loc-mum",
    toLocationId: "loc-pune",
    status: "in-transit",
    dispatchDate: "2026-06-18",
    expectedArrival: "2026-06-25",
    receivedDate: null,
    remarks: "Pune outlet replenishment",
    createdAt: "2026-06-17",
    lines: [
      { itemId: "fg-flour50", qtyRequested: 50, qtyDispatched: 50, qtyReceived: 0, uom: "pcs", fromBin: "S-01-01", toBin: null },
      { itemId: "fg-rice25",  qtyRequested: 40, qtyDispatched: 40, qtyReceived: 0, uom: "pcs", fromBin: "P-02",    toBin: null },
    ],
  },
  {
    id: "trf-005",
    ref: "TRF-2526-005",
    fromLocationId: "loc-mys",
    toLocationId: "loc-hyd",
    status: "dispatched",
    dispatchDate: "2026-06-22",
    expectedArrival: "2026-07-02",
    receivedDate: null,
    remarks: "HYD outlet initial stock",
    createdAt: "2026-06-21",
    lines: [
      { itemId: "fg-atta10", qtyRequested: 150, qtyDispatched: 150, qtyReceived: 0, uom: "pcs", fromBin: "DSP-02", toBin: null },
      { itemId: "fg-atta1",  qtyRequested: 500, qtyDispatched: 500, qtyReceived: 0, uom: "pcs", fromBin: "DSP-02", toBin: null },
    ],
  },
  {
    id: "trf-006",
    ref: "TRF-2526-006",
    fromLocationId: "loc-mys",
    toLocationId: "loc-chn",
    status: "draft",
    dispatchDate: null,
    expectedArrival: null,
    receivedDate: null,
    remarks: "CHN outlet launch stock",
    createdAt: "2026-06-25",
    lines: [
      { itemId: "fg-flour50", qtyRequested: 80, qtyDispatched: 0, qtyReceived: 0, uom: "pcs", fromBin: null, toBin: null },
      { itemId: "fg-oil15",   qtyRequested: 60, qtyDispatched: 0, qtyReceived: 0, uom: "pcs", fromBin: null, toBin: null },
    ],
  },
  {
    id: "trf-007",
    ref: "TRF-2526-007",
    fromLocationId: "loc-mys",
    toLocationId: "loc-mum",
    status: "received",
    dispatchDate: "2026-06-01",
    expectedArrival: "2026-06-04",
    receivedDate: "2026-06-05",
    remarks: "Urgent MUM restock — flour",
    createdAt: "2026-05-31",
    lines: [
      { itemId: "fg-flour50", qtyRequested: 100, qtyDispatched: 100, qtyReceived:  95, uom: "pcs", fromBin: "DSP-01", toBin: "RCV-01" },
      { itemId: "fg-atta1",   qtyRequested: 300, qtyDispatched: 300, qtyReceived: 300, uom: "pcs", fromBin: "DSP-02", toBin: "RCV-01" },
    ],
  },
  {
    id: "trf-008",
    ref: "TRF-2526-008",
    fromLocationId: "loc-blr",
    toLocationId: "loc-mum",
    status: "in-transit",
    dispatchDate: "2026-06-25",
    expectedArrival: "2026-06-30",
    receivedDate: null,
    remarks: "BLR overflow to MUM depot",
    createdAt: "2026-06-24",
    lines: [
      { itemId: "fg-atta10", qtyRequested: 80,  qtyDispatched: 80,  qtyReceived: 0, uom: "pcs", fromBin: "S-01-02", toBin: null },
      { itemId: "fg-atta1",  qtyRequested: 200, qtyDispatched: 200, qtyReceived: 0, uom: "pcs", fromBin: "P-01",    toBin: null },
    ],
  },
  {
    id: "trf-009",
    ref: "TRF-2526-009",
    fromLocationId: "loc-mys",
    toLocationId: "loc-pune",
    status: "draft",
    dispatchDate: null,
    expectedArrival: null,
    receivedDate: null,
    remarks: "Pune seasonal restock",
    createdAt: "2026-06-26",
    lines: [
      { itemId: "fg-flour50",    qtyRequested: 60, qtyDispatched: 0, qtyReceived: 0, uom: "pcs", fromBin: null, toBin: null },
      { itemId: "fg-rice25",     qtyRequested: 50, qtyDispatched: 0, qtyReceived: 0, uom: "pcs", fromBin: null, toBin: null },
      { itemId: "fg-semolina25", qtyRequested: 30, qtyDispatched: 0, qtyReceived: 0, uom: "pcs", fromBin: null, toBin: null },
    ],
  },
  {
    id: "trf-010",
    ref: "TRF-2526-010",
    fromLocationId: "loc-mys",
    toLocationId: "loc-del",
    status: "received",
    dispatchDate: "2026-06-05",
    expectedArrival: "2026-06-08",
    receivedDate: "2026-06-10",
    remarks: "DEL branch monthly stock",
    createdAt: "2026-06-04",
    lines: [
      { itemId: "fg-flour50", qtyRequested: 150, qtyDispatched: 150, qtyReceived: 150, uom: "pcs", fromBin: "DSP-01", toBin: "RCV-01" },
      { itemId: "fg-rice25",  qtyRequested: 100, qtyDispatched: 100, qtyReceived: 100, uom: "pcs", fromBin: "DSP-02", toBin: "RCV-01" },
      { itemId: "fg-atta10",  qtyRequested: 400, qtyDispatched: 400, qtyReceived: 400, uom: "pcs", fromBin: "DSP-02", toBin: "RCV-01" },
    ],
  },
];

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
