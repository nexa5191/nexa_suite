// ---------------------------------------------------------------------------
// Revenue bridge — turns operational-module activity into ledger events.
//
// The Orders, Invoicing and Professional-services modules each hold their own
// rich datasets, but historically they lived in a parallel universe: none of
// their numbers reached the P&L / Balance Sheet / Cash Flow / GST returns. This
// module derives balanced `sale` BusinessEvents from that activity so every
// rupee a module reports is traceable in the financial statements:
//
//   • Orders        → recognised (shipped/delivered) GMV, aggregated per entity
//                     per month, booked to Product Sales (4010).
//   • Invoicing     → each posted product invoice, booked to Product Sales
//                     (4010) or Export Sales (4030) per its GST treatment.
//   • Services      → each finalised/paid time-invoice, booked to Service
//                     Revenue (4020).
//
// The generated events are concatenated into BUSINESS_EVENTS (see events.ts) and
// expand through the SAME double-entry pipeline as everything else, so they are
// balanced by construction and respect GST, AR settlement and the cash basis.
// Manual journal vouchers already reach the ledger via the JournalProvider, so
// together all four flows now show up in the reports.
// ---------------------------------------------------------------------------

import type { BusinessEvent } from "./types";
import { locationsForEntity } from "./org";
import { ORDERS, type OrderStatus } from "@/lib/orders";
import { SEED_INVOICES, computeTotals, gstTreatment, accountById } from "@/lib/invoicing";
import { SEED_TIME_INVOICES, asInvoiceLines } from "@/lib/services/time-invoice";

const primaryLoc = (entityId: string) => locationsForEntity(entityId)[0]?.id ?? "loc-blr";

/** Deterministic, Date.now-free date arithmetic for settlement lags. */
function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

// ---- Orders → monthly recognised revenue per entity ------------------------
function orderRevenueEvents(): BusinessEvent[] {
  const RECOGNISED = new Set<OrderStatus>(["shipped", "delivered"]);
  const map = new Map<
    string,
    { entityId: string; locationId: string; month: string; net: number; count: number }
  >();
  for (const o of ORDERS) {
    if (!RECOGNISED.has(o.status)) continue;
    const month = o.date.slice(0, 7);
    const key = `${o.entityId}|${month}`;
    const e =
      map.get(key) ?? { entityId: o.entityId, locationId: o.locationId, month, net: 0, count: 0 };
    e.net += o.amount;
    e.count += 1;
    map.set(key, e);
  }
  const out: BusinessEvent[] = [];
  let n = 0;
  for (const e of map.values()) {
    const [yy, mm] = e.month.split("-").map(Number);
    const nm = mm === 12 ? 1 : mm + 1;
    const ny = mm === 12 ? yy + 1 : yy;
    out.push({
      id: `ord-rev-${++n}`,
      kind: "sale",
      category: "Orders",
      memo: `Marketplace & D2C orders — ${e.count} orders (${e.month})`,
      entityId: e.entityId,
      locationId: e.locationId,
      currency: "INR",
      amount: Math.round(e.net),
      accrualDate: `${e.month}-25`,
      // Marketplace/COD remittances settle on the next-month payout cycle.
      cashDate: `${ny}-${String(nm).padStart(2, "0")}-10`,
      incomeOrExpenseAccount: "4010",
      contraAccount: "1100",
      cashAccount: "1020",
    });
  }
  return out;
}

// ---- Invoicing → one sale event per posted product invoice -----------------
function invoiceRevenueEvents(): BusinessEvent[] {
  const out: BusinessEvent[] = [];
  let n = 0;
  for (const inv of SEED_INVOICES) {
    if (inv.status === "draft") continue;
    const acc = accountById(inv.accountId);
    if (!acc) continue;
    const treatment = gstTreatment(inv.entityId, acc.stateCode);
    const totals = computeTotals(inv.lines, inv.discountType, inv.discountValue, treatment);
    const net = Math.round(totals.taxable);
    if (net <= 0) continue;
    const collected = inv.status === "paid" || inv.status === "partial";
    out.push({
      id: `inv-rev-${++n}`,
      kind: "sale",
      category: "Invoicing",
      memo: `Invoice ${inv.number} — ${acc.name}`,
      entityId: inv.entityId,
      locationId: primaryLoc(inv.entityId),
      currency: "INR",
      amount: net,
      accrualDate: inv.date,
      cashDate: collected ? addDays(inv.dueDate, -2) : null,
      incomeOrExpenseAccount: treatment === "export" ? "4030" : "4010",
      contraAccount: "1100",
      cashAccount: "1020",
    });
  }
  return out;
}

// ---- Services → one sale event per finalised/paid time-invoice -------------
function servicesRevenueEvents(): BusinessEvent[] {
  const out: BusinessEvent[] = [];
  let n = 0;
  for (const inv of SEED_TIME_INVOICES) {
    if (inv.status === "draft") continue;
    const acc = accountById(inv.accountId);
    if (!acc) continue;
    const treatment = gstTreatment(inv.entityId, acc.stateCode);
    const totals = computeTotals(asInvoiceLines(inv.lines), "none", 0, treatment);
    const net = Math.round(totals.taxable);
    if (net <= 0) continue;
    const collected = inv.status === "paid";
    out.push({
      id: `svc-rev-${++n}`,
      kind: "sale",
      category: "Services",
      memo: `Services invoice ${inv.number} — ${acc.name}`,
      entityId: inv.entityId,
      locationId: primaryLoc(inv.entityId),
      currency: "INR",
      amount: net,
      accrualDate: inv.date,
      cashDate: collected ? addDays(inv.date, 12) : null,
      incomeOrExpenseAccount: "4020",
      contraAccount: "1100",
      cashAccount: "1020",
    });
  }
  return out;
}

/** All module-derived sale events, merged into BUSINESS_EVENTS in events.ts. */
export const MODULE_REVENUE_EVENTS: BusinessEvent[] = [
  ...orderRevenueEvents(),
  ...invoiceRevenueEvents(),
  ...servicesRevenueEvents(),
];
