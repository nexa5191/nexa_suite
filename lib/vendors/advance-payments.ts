// ---------------------------------------------------------------------------
// Vendor advance payments — money disbursed to a supplier before a bill is
// booked. Common in capex procurement (equipment deposits) and large inventory
// contracts (seasonal raw-material bookings).
//
// An advance begins as "pending". It is knocked off ("adjusted") against a PO
// or purchase bill once the goods/services are received and billed; the
// adjusted amount reduces the bill payable. If the vendor refunds the advance
// (order cancelled etc.) the status becomes "refunded".
//
// Partial knock-off: adjustedAmount may be < amount while status stays
// "pending"; when adjustedAmount == amount the status flips to "adjusted".
//
// Seed data uses mulberry32 for a deterministic but varied dataset.
// Persistence: nexa-advances (localStorage).
// ---------------------------------------------------------------------------

import { PURCHASE_ORDERS, VENDORS } from "@/lib/vendors";

export type AdvanceStatus = "pending" | "adjusted" | "refunded";

export interface AdvancePayment {
  id: string;
  ref: string;                    // ADV-2526-001
  vendorId: string;
  poId: string | null;            // linked PO if any
  amount: number;                 // ₹ disbursed
  date: string;                   // ISO
  purpose: string;
  status: AdvanceStatus;
  adjustedAgainst: string | null; // bill/PO ref on knock-off
  adjustedAmount: number;
  adjustedDate: string | null;
}

// ---- seed ------------------------------------------------------------------

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20260627);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const between = (lo: number, hi: number) =>
  Math.round(lo + rnd() * (hi - lo));

// Round to nearest thousand for realism.
const roundK = (n: number) => Math.round(n / 1000) * 1000;

const PURPOSES = [
  "Security deposit — long-term supply contract",
  "Advance against machinery order",
  "Mobilisation advance — packaging contract",
  "Raw-material booking advance (seasonal)",
  "Tooling deposit — custom mould",
  "Advance against software licence",
  "Equipment installation deposit",
  "Retention advance — annual logistics contract",
];

// Filter out employee-class vendors (not relevant for trade advances).
const ELIGIBLE_VENDORS = VENDORS.filter((v) => v.vClass !== "Employee");

// Only POs in "issued" or "paid" status are candidates for linkage.
const LINKABLE_POS = PURCHASE_ORDERS.filter(
  (p) => p.status === "issued" || p.status === "paid",
);

function makeSeedAdvance(seq: number): AdvancePayment {
  const vendor = pick(ELIGIBLE_VENDORS);
  const vendorPOs = LINKABLE_POS.filter((p) => p.vendorId === vendor.id);
  const linkPO = rnd() > 0.3 && vendorPOs.length > 0 ? pick(vendorPOs) : null;

  const amount = roundK(between(50_000, 800_000));
  const month = between(1, 6);
  const day = between(1, 28);
  const date = `2026-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  const statusRoll = rnd();
  let status: AdvanceStatus = "pending";
  let adjustedAgainst: string | null = null;
  let adjustedAmount = 0;
  let adjustedDate: string | null = null;

  if (statusRoll < 0.3) {
    status = "adjusted";
    adjustedAgainst = linkPO ? linkPO.id : `BILL-2526-${String(seq + 100).padStart(3, "0")}`;
    adjustedAmount = amount;
    const adjDay = Math.min(28, day + between(7, 30));
    adjustedDate = `2026-${String(Math.min(month + 1, 6)).padStart(2, "0")}-${String(adjDay).padStart(2, "0")}`;
  } else if (statusRoll < 0.45) {
    status = "refunded";
    adjustedAgainst = null;
    adjustedAmount = amount;
    const adjDay = Math.min(28, day + between(5, 20));
    adjustedDate = `2026-${String(Math.min(month + 1, 6)).padStart(2, "0")}-${String(adjDay).padStart(2, "0")}`;
  } else if (statusRoll < 0.6 && linkPO) {
    // Partial knock-off but still pending
    status = "pending";
    adjustedAmount = roundK(between(amount * 0.3, amount * 0.7));
    adjustedAgainst = linkPO.id;
    const adjDay = Math.min(28, day + between(7, 20));
    adjustedDate = `2026-${String(month).padStart(2, "0")}-${String(adjDay).padStart(2, "0")}`;
  }

  return {
    id: `adv-${seq}`,
    ref: `ADV-2526-${String(seq).padStart(3, "0")}`,
    vendorId: vendor.id,
    poId: linkPO?.id ?? null,
    amount,
    date,
    purpose: pick(PURPOSES),
    status,
    adjustedAgainst,
    adjustedAmount,
    adjustedDate,
  };
}

export const SEED_ADVANCES: AdvancePayment[] = [];

// ---- localStorage ----------------------------------------------------------

const ADVANCES_KEY = "nexa-advances";

function lsRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}
function lsWrite<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const loadAdvances = (): AdvancePayment[] =>
  lsRead<AdvancePayment[]>(ADVANCES_KEY, SEED_ADVANCES);

export const saveAdvances = (advances: AdvancePayment[]) =>
  lsWrite(ADVANCES_KEY, advances);

// ---- helpers ---------------------------------------------------------------

export function advanceSummary(advances: AdvancePayment[]) {
  const pending = advances.filter((a) => a.status === "pending");
  const totalOutstanding = pending.reduce((s, a) => s + a.amount - a.adjustedAmount, 0);
  const totalAdjustedFY = advances
    .filter((a) => a.status === "adjusted" || a.adjustedAmount > 0)
    .reduce((s, a) => s + a.adjustedAmount, 0);
  return { totalOutstanding, totalAdjustedFY, pendingCount: pending.length };
}

export const STATUS_META: Record<
  AdvanceStatus,
  { label: string; variant: "default" | "warning" | "success" | "primary" }
> = {
  pending: { label: "Pending", variant: "warning" },
  adjusted: { label: "Adjusted", variant: "success" },
  refunded: { label: "Refunded", variant: "default" },
};

/** Generate the next sequential ADV ref from existing advances. */
export function nextAdvRef(advances: AdvancePayment[]): string {
  let max = 0;
  for (const a of advances) {
    const n = parseInt(a.ref.replace("ADV-2526-", ""), 10);
    if (!Number.isNaN(n)) max = Math.max(max, n);
  }
  return `ADV-2526-${String(max + 1).padStart(3, "0")}`;
}
