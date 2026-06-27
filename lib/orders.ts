// ---------------------------------------------------------------------------
// Sales Orders dataset — the order-level data that flows in from connected OMS
// sources (Unicommerce, Shopify, Increff, EasyEcom) via the Connections hub.
//
// Deterministic seed (mulberry32) so server & client render identically — no
// Math.random / Date.now in the data layer. Orders reference real finished-good
// SKUs so value ties back to the catalogue.
// ---------------------------------------------------------------------------

import { itemById } from "@/lib/inventory/items";

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
export const CHANNELS: { name: string; source: string; entityId: string; locationId: string }[] = [];

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

export const ORDERS: SalesOrder[] = [];

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
