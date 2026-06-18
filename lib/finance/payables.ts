// ---------------------------------------------------------------------------
// NEXA Payables — AP aging mirrored from the vendor/PO module.
//
// Every purchase order that has been billed (po.invoice present) with an
// outstanding balance is an AP open item. Due date is assumed to be 30 days
// from the vendor's invoice date; items are bucketed by days-overdue vs the
// in-app "today" (2026-06-18). MSME vendors carry a statutory 45-day rule
// (MSMED Act sec. 15) which we surface as a callout.
// ---------------------------------------------------------------------------

import {
  PURCHASE_ORDERS,
  poOutstanding,
  loadPoPayments,
  vendorById,
  effectiveStatus,
  type PurchaseOrder,
  type Vendor,
} from "@/lib/vendors";
import {
  AS_ON,
  AGING_BUCKETS,
  bucketForDays,
  bucketMeta,
  emptyBucketTotals,
  daysBetween,
  daysOverdue,
  type AgingBucket,
  type BucketKey,
  type BucketTotals,
} from "@/lib/finance/receivables";

/** Standard supplier credit term (days) assumed from the invoice date. */
export const AP_TERM_DAYS = 30;
/** Statutory MSME payment window (MSMED Act sec. 15) in days. */
export const MSME_TERM_DAYS = 45;

export interface ApOpenItem {
  poId: string;
  billNo: string;
  vendorId: string;
  vendorName: string;
  msme: boolean;
  invoiceDate: string; // ISO
  dueDate: string; // ISO (invoiceDate + term)
  amount: number; // base INR billed
  outstanding: number; // base INR still owed
  days: number; // days overdue (negative ⇒ not yet due)
  bucket: BucketKey;
  dueThisWeek: boolean;
  msmeBreach: boolean; // MSME vendor & past the 45-day window
}

/** Add `days` to an ISO date, returning an ISO (date-only) string. */
function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Every open AP item (billed PO with outstanding > 0), bucketed. */
export function apOpenItems(asOn: string = AS_ON, scheme: AgingBucket[] = AGING_BUCKETS): ApOpenItem[] {
  const payments = loadPoPayments();
  const items: ApOpenItem[] = [];
  for (const po of PURCHASE_ORDERS) {
    if (!po.invoice) continue;
    const status = effectiveStatus(po, {});
    if (status === "paid" || status === "rejected") continue;
    const outstanding = poOutstanding(po, payments);
    if (outstanding <= 0) continue;
    const vendor = vendorById(po.vendorId);
    const invoiceDate = po.invoice.date;
    const term = vendor?.msme ? MSME_TERM_DAYS : AP_TERM_DAYS;
    const dueDate = addDays(invoiceDate, term);
    const days = daysOverdue(dueDate, asOn);
    const bucket = bucketForDays(days, scheme);
    const toDue = daysBetween(asOn, dueDate);
    items.push({
      poId: po.id,
      billNo: po.invoice.number,
      vendorId: po.vendorId,
      vendorName: vendor?.name ?? "—",
      msme: !!vendor?.msme,
      invoiceDate,
      dueDate,
      amount: po.invoice.amount,
      outstanding,
      days,
      bucket,
      dueThisWeek: toDue >= 0 && toDue <= 7,
      msmeBreach: !!vendor?.msme && daysBetween(invoiceDate, asOn) > MSME_TERM_DAYS,
    });
  }
  return items.sort((a, b) => b.days - a.days);
}

/** Firm-wide AP totals per aging bucket. */
export function apAgingBuckets(asOn: string = AS_ON, scheme: AgingBucket[] = AGING_BUCKETS): BucketTotals {
  const totals = emptyBucketTotals(scheme);
  for (const it of apOpenItems(asOn, scheme)) totals[it.bucket] += it.outstanding;
  return totals;
}

export interface VendorAp {
  vendorId: string;
  name: string;
  msme: boolean;
  buckets: BucketTotals;
  total: number;
  worstBucket: BucketKey;
  dueThisWeek: number; // amount due within 7 days
  msmeBreach: boolean;
  itemCount: number;
}

export function vendorAging(asOn: string = AS_ON, scheme: AgingBucket[] = AGING_BUCKETS): VendorAp[] {
  const items = apOpenItems(asOn, scheme);
  const byVendor = new Map<string, ApOpenItem[]>();
  for (const it of items) {
    const list = byVendor.get(it.vendorId) ?? [];
    list.push(it);
    byVendor.set(it.vendorId, list);
  }
  // Worst (most overdue) bucket first — scheme is ordered current → oldest.
  const order = [...scheme].reverse().map((b) => b.key);
  const out: VendorAp[] = [];
  for (const [vendorId, list] of byVendor) {
    const buckets = emptyBucketTotals(scheme);
    let total = 0;
    let dueThisWeek = 0;
    for (const it of list) {
      buckets[it.bucket] += it.outstanding;
      total += it.outstanding;
      if (it.dueThisWeek) dueThisWeek += it.outstanding;
    }
    const worstBucket = order.find((k) => buckets[k] > 0) ?? scheme[0].key;
    out.push({
      vendorId,
      name: list[0].vendorName,
      msme: list[0].msme,
      buckets,
      total,
      worstBucket,
      dueThisWeek,
      msmeBreach: list.some((i) => i.msmeBreach),
      itemCount: list.length,
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

export interface ApSummary {
  totalPayable: number;
  dueThisWeek: number;
  overdue: number;
  msmeDue: number; // open AP owed to MSME vendors
  msmeBreaches: number; // count of MSME bills past 45 days
}

export function apSummary(asOn: string = AS_ON): ApSummary {
  const items = apOpenItems(asOn);
  return {
    totalPayable: items.reduce((s, i) => s + i.outstanding, 0),
    dueThisWeek: items.filter((i) => i.dueThisWeek).reduce((s, i) => s + i.outstanding, 0),
    overdue: items.filter((i) => i.days > 0).reduce((s, i) => s + i.outstanding, 0),
    msmeDue: items.filter((i) => i.msme).reduce((s, i) => s + i.outstanding, 0),
    msmeBreaches: items.filter((i) => i.msmeBreach).length,
  };
}

export { bucketMeta, type BucketKey, type BucketTotals, type PurchaseOrder, type Vendor };
