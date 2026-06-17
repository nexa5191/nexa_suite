// ---------------------------------------------------------------------------
// Sales Orders dataset — the order-level data that flows in from connected OMS
// sources (Unicommerce, Shopify, Increff, EasyEcom) via the Connections hub.
//
// Deterministic seed (mulberry32) so server & client render identically — no
// Math.random / Date.now in the data layer. Orders reference real finished-good
// SKUs so value ties back to the catalogue.
// ---------------------------------------------------------------------------

import { FINISHED_ITEMS, itemById } from "@/lib/inventory/items";

export type OrderStatus =
  | "new"
  | "confirmed"
  | "packed"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "returned";

export type PaymentMode = "Prepaid" | "COD";

export interface SalesOrder {
  id: string;
  orderNo: string;
  date: string; // ISO order date
  channel: string;
  source: string; // OMS connector id (unicommerce / shopify / …)
  customer: string;
  state: string;
  entityId: string; // Nexa entity that books the order (ties to the ledger)
  locationId: string; // fulfilment location
  itemId: string;
  qty: number;
  rate: number;
  amount: number; // qty × rate (base INR)
  status: OrderStatus;
  payment: PaymentMode;
  fulfilledOn?: string; // ISO when delivered
}

// Channel → OMS source that ingests it, and the entity/location that books it.
// Marketplace + own-storefront volume sells from Nexa Foods (Bengaluru); the
// distributor & quick-commerce lanes are served by Nexa Trading (Mumbai).
export const CHANNELS: { name: string; source: string; entityId: string; locationId: string }[] = [
  { name: "Amazon", source: "unicommerce", entityId: "ent-nexa-in", locationId: "loc-blr" },
  { name: "Flipkart", source: "increff", entityId: "ent-nexa-in", locationId: "loc-blr" },
  { name: "Shopify Store", source: "shopify", entityId: "ent-nexa-in", locationId: "loc-blr" },
  { name: "Website D2C", source: "easyecom", entityId: "ent-nexa-in", locationId: "loc-blr" },
  { name: "Quick Commerce", source: "unicommerce", entityId: "ent-nexa-trade", locationId: "loc-mum" },
  { name: "Distributor", source: "increff", entityId: "ent-nexa-trade", locationId: "loc-mum" },
];

export const STATUS_META: Record<
  OrderStatus,
  { label: string; variant: "default" | "primary" | "warning" | "success" | "danger"; funnel: boolean }
> = {
  new: { label: "New", variant: "default", funnel: true },
  confirmed: { label: "Confirmed", variant: "primary", funnel: true },
  packed: { label: "Packed", variant: "primary", funnel: true },
  shipped: { label: "Shipped", variant: "warning", funnel: true },
  delivered: { label: "Delivered", variant: "success", funnel: true },
  cancelled: { label: "Cancelled", variant: "danger", funnel: false },
  returned: { label: "Returned", variant: "danger", funnel: false },
};

export const FUNNEL_ORDER: OrderStatus[] = ["new", "confirmed", "packed", "shipped", "delivered"];

function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(20240602);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));
const iso = (y: number, m: number, d: number) => `${y}-${String(m).padStart(2, "0")}-${String(Math.min(d, 28)).padStart(2, "0")}`;

// Apr 2024 → Jun 2026 — two full FYs plus the current year-to-date (27 months).
const MONTHS: Array<[number, number]> = [];
for (let i = 0; i < 27; i++) {
  const m = ((3 + i) % 12) + 1;
  const y = 2024 + Math.floor((3 + i) / 12);
  MONTHS.push([y, m]);
}

const CUSTOMERS = [
  "Aarav Sharma", "Priya Menon", "Rohan Gupta", "Ananya Iyer", "Vikram Singh", "Sneha Reddy",
  "Karthik Nair", "Meera Joshi", "Arjun Patel", "Divya Rao", "FreshMart Retail", "BlueMart Stores",
  "QuickKart", "DailyNeeds Hyperlocal", "Sunrise Provisions", "Green Basket", "Metro Cash & Carry",
];
const STATES = ["Karnataka", "Maharashtra", "Delhi", "Tamil Nadu", "Telangana", "Gujarat", "West Bengal"];

function rollStatus(monthsAgo: number): OrderStatus {
  const r = rnd();
  // Recent orders are still mid-funnel; older ones are mostly delivered.
  if (monthsAgo <= 0) {
    if (r < 0.25) return "new";
    if (r < 0.5) return "confirmed";
    if (r < 0.7) return "packed";
    if (r < 0.9) return "shipped";
    if (r < 0.95) return "delivered";
    return "cancelled";
  }
  if (r < 0.86) return "delivered";
  if (r < 0.91) return "shipped";
  if (r < 0.96) return "returned";
  return "cancelled";
}

function build(): SalesOrder[] {
  const out: SalesOrder[] = [];
  let n = 0;
  MONTHS.forEach(([y, m], mi) => {
    const monthsAgo = MONTHS.length - 1 - mi;
    const count = between(26, 40); // orders per month
    for (let i = 0; i < count; i++) {
      const ch = pick(CHANNELS);
      const item = pick(FINISHED_ITEMS);
      const qty = between(1, item.uom === "pcs" && item.rate < 100 ? 24 : 6);
      const rate = item.rate;
      const day = between(1, 28);
      const status = rollStatus(monthsAgo);
      out.push({
        id: `so-${++n}`,
        orderNo: `ORD-${y}${String(m).padStart(2, "0")}-${String(1000 + i)}`,
        date: iso(y, m, day),
        channel: ch.name,
        source: ch.source,
        customer: pick(CUSTOMERS),
        state: pick(STATES),
        entityId: ch.entityId,
        locationId: ch.locationId,
        itemId: item.id,
        qty,
        rate,
        amount: qty * rate,
        status,
        payment: rnd() < 0.62 ? "Prepaid" : "COD",
        fulfilledOn: status === "delivered" ? iso(y, m, Math.min(28, day + between(1, 6))) : undefined,
      });
    }
  });
  return out;
}

export const ORDERS: SalesOrder[] = build();

// ---- Aggregations ---------------------------------------------------------

export interface OrderKpis {
  count: number;
  gmv: number;
  units: number;
  aov: number;
  deliveredPct: number;
  returnRate: number;
  cancelRate: number;
}

export function orderKpis(orders: SalesOrder[]): OrderKpis {
  const count = orders.length;
  const gmv = orders.reduce((s, o) => s + o.amount, 0);
  const units = orders.reduce((s, o) => s + o.qty, 0);
  const delivered = orders.filter((o) => o.status === "delivered").length;
  const returned = orders.filter((o) => o.status === "returned").length;
  const cancelled = orders.filter((o) => o.status === "cancelled").length;
  return {
    count,
    gmv,
    units,
    aov: count ? gmv / count : 0,
    deliveredPct: count ? delivered / count : 0,
    returnRate: count ? returned / count : 0,
    cancelRate: count ? cancelled / count : 0,
  };
}

export function monthlyOrders(orders: SalesOrder[]): { month: string; orders: number; gmv: number }[] {
  const m = new Map<string, { orders: number; gmv: number }>();
  for (const o of orders) {
    const k = o.date.slice(0, 7);
    const e = m.get(k) ?? { orders: 0, gmv: 0 };
    e.orders += 1;
    e.gmv += o.amount;
    m.set(k, e);
  }
  return [...m.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([month, v]) => ({ month, ...v }));
}

export function byChannel(orders: SalesOrder[]): { channel: string; orders: number; gmv: number }[] {
  const m = new Map<string, { orders: number; gmv: number }>();
  for (const o of orders) {
    const e = m.get(o.channel) ?? { orders: 0, gmv: 0 };
    e.orders += 1;
    e.gmv += o.amount;
    m.set(o.channel, e);
  }
  return [...m.entries()].map(([channel, v]) => ({ channel, ...v })).sort((a, b) => b.gmv - a.gmv);
}

export function statusCounts(orders: SalesOrder[]): Record<OrderStatus, number> {
  const base = { new: 0, confirmed: 0, packed: 0, shipped: 0, delivered: 0, cancelled: 0, returned: 0 };
  for (const o of orders) base[o.status] += 1;
  return base;
}

export function topSkus(orders: SalesOrder[], limit = 6): { itemId: string; name: string; units: number; gmv: number }[] {
  const m = new Map<string, { units: number; gmv: number }>();
  for (const o of orders) {
    const e = m.get(o.itemId) ?? { units: 0, gmv: 0 };
    e.units += o.qty;
    e.gmv += o.amount;
    m.set(o.itemId, e);
  }
  return [...m.entries()]
    .map(([itemId, v]) => ({ itemId, name: itemById(itemId)?.name ?? itemId, ...v }))
    .sort((a, b) => b.gmv - a.gmv)
    .slice(0, limit);
}
