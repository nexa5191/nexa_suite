// ---------------------------------------------------------------------------
// NEXA Receivables — AR aging, dunning and credit-limit engine.
//
// Builds on the Invoicing module (lib/invoicing.ts): every open invoice
// (outstanding > 0) is an AR open item bucketed by days-overdue from its
// due date vs the in-app "today" (2026-06-18). From those buckets we derive
// a per-customer aging summary, a dunning level + templated reminder, and a
// deterministic credit limit / exposure / utilisation.
//
// Persistence (client-side):
//   nexa-credit-limits   → per-customer credit-limit overrides (Record<accId, INR>)
//   nexa-ar-collections  → per-invoice collection actions (Record<invId, action>)
// ---------------------------------------------------------------------------

import {
  allInvoices,
  loadCreatedInvoices,
  loadInvoicePayments,
  loadStatusOverrides,
  effectiveStatus,
  outstandingOf,
  invoiceTotal,
  SEED_INVOICES,
  type Invoice,
} from "@/lib/invoicing";
import { accountById, ACCOUNTS, type CrmAccount } from "@/lib/crm";

/** The aging "as-on" date used across the app (today, in-app). */
export const AS_ON = "2026-06-18";

// ---------------------------------------------------------------------------
// Aging buckets
// ---------------------------------------------------------------------------

// Bucket keys are now derived from the active scheme, so this is just a string.
export type BucketKey = string;

export interface AgingBucket {
  key: BucketKey;
  label: string;
  from: number; // inclusive lower day bound (days overdue); "current" is -Infinity..0
  to: number | null; // inclusive upper day bound; null ⇒ open-ended
  /** Tailwind-friendly badge tone for days-overdue badges. */
  tone: "success" | "default" | "warning" | "danger";
  /** Dunning level this bucket maps to (worst bucket drives a customer's level). */
  dunning: DunningLevel;
}

/** Default breakpoints — upper day bounds dividing the overdue buckets. */
export const DEFAULT_BREAKPOINTS = [30, 60, 90];

function toneForFrom(from: number): AgingBucket["tone"] {
  if (from <= 0) return "success";
  if (from <= 30) return "default";
  if (from <= 90) return "warning";
  return "danger";
}
function dunningForFrom(from: number): DunningLevel {
  if (from <= 0) return 0;
  if (from <= 30) return 1;
  if (from <= 90) return 2;
  return 3;
}
function makeBucket(from: number, to: number | null): AgingBucket {
  if (to === null) {
    const base = from - 1; // label the open-ended bucket by its lower threshold ("90+")
    return { key: `d${base}_plus`, label: `${base}+`, from, to, tone: toneForFrom(from), dunning: dunningForFrom(from) };
  }
  return { key: `d${from}_${to}`, label: `${from}–${to}`, from, to, tone: toneForFrom(from), dunning: dunningForFrom(from) };
}

/** Sanitise breakpoints to ascending, positive, de-duplicated integers. */
export function cleanBreakpoints(breaks: number[]): number[] {
  return Array.from(new Set(breaks.filter((n) => Number.isFinite(n) && n > 0).map((n) => Math.round(n)))).sort(
    (a, b) => a - b,
  );
}

/** Build an ordered aging scheme from ascending positive day breakpoints. */
export function schemeFromBreakpoints(breaks: number[]): AgingBucket[] {
  const bps = cleanBreakpoints(breaks);
  const defs: AgingBucket[] = [
    { key: "current", label: "Current", from: -Infinity, to: 0, tone: "success", dunning: 0 },
  ];
  let lower = 1;
  for (const bp of bps) {
    defs.push(makeBucket(lower, bp));
    lower = bp + 1;
  }
  defs.push(makeBucket(lower, null)); // open-ended final bucket
  return defs;
}

/** The default aging scheme (Current · 1–30 · 31–60 · 61–90 · 90+). */
export const AGING_BUCKETS: AgingBucket[] = schemeFromBreakpoints(DEFAULT_BREAKPOINTS);

export function bucketMeta(key: BucketKey, scheme: AgingBucket[] = AGING_BUCKETS): AgingBucket {
  return scheme.find((b) => b.key === key) ?? scheme[0];
}

/** Empty per-bucket totals for a scheme — every bucket key seeded to 0. */
export function emptyBucketTotals(scheme: AgingBucket[] = AGING_BUCKETS): BucketTotals {
  const t: BucketTotals = {};
  for (const b of scheme) t[b.key] = 0;
  return t;
}

/** Whole days between two ISO dates (b − a). */
export function daysBetween(aIso: string, bIso: string): number {
  const a = new Date(aIso).getTime();
  const b = new Date(bIso).getTime();
  return Math.round((b - a) / 86_400_000);
}

/** Days overdue (negative ⇒ not yet due) for a due date vs as-on. */
export function daysOverdue(dueDate: string, asOn: string = AS_ON): number {
  return daysBetween(dueDate, asOn);
}

export function bucketForDays(days: number, scheme: AgingBucket[] = AGING_BUCKETS): BucketKey {
  for (const b of scheme) {
    if (days >= b.from && days <= (b.to ?? Infinity)) return b.key;
  }
  return scheme[scheme.length - 1].key;
}

/** Dunning level from raw days overdue — independent of the bucket scheme. */
export function dunningForDays(days: number): DunningLevel {
  if (days <= 0) return 0;
  if (days <= 30) return 1;
  if (days <= 90) return 2;
  return 3;
}

// ---------------------------------------------------------------------------
// Dunning
// ---------------------------------------------------------------------------

export type DunningLevel = 0 | 1 | 2 | 3;

export interface DunningMeta {
  level: DunningLevel;
  label: string;
  variant: "default" | "primary" | "warning" | "danger";
  nextAction: string;
}

export const DUNNING_LEVELS: DunningMeta[] = [
  { level: 0, label: "Reminder", variant: "default", nextAction: "Send a friendly payment reminder" },
  { level: 1, label: "First notice", variant: "primary", nextAction: "Send the first overdue notice & call the buyer" },
  { level: 2, label: "Second notice", variant: "warning", nextAction: "Escalate to the account owner; request a promise-to-pay date" },
  { level: 3, label: "Final / legal", variant: "danger", nextAction: "Issue a final demand; put the account on credit hold" },
];

export function dunningMeta(level: DunningLevel): DunningMeta {
  return DUNNING_LEVELS.find((d) => d.level === level) ?? DUNNING_LEVELS[0];
}

/** Templated reminder body for an open item at its dunning level. */
export function reminderTemplate(item: ArOpenItem): string {
  const meta = dunningMeta(item.dunning);
  const amt = `INR ${Math.round(item.outstanding).toLocaleString("en-IN")}`;
  const head = `Dear ${item.customerName},`;
  const ref = `Invoice ${item.number} dated ${item.date} for ${amt} (due ${item.dueDate}).`;
  switch (item.dunning) {
    case 0:
      return `${head}\n\nA gentle reminder that ${ref} is coming due. Kindly arrange payment on or before the due date. Please ignore this note if payment is already in process.\n\nWarm regards,\nNEXA Accounts Receivable`;
    case 1:
      return `${head}\n\n${ref} is now ${item.days} day(s) overdue. We request settlement at the earliest. Do let us know if you need a copy of the invoice or a payment link.\n\nRegards,\nNEXA Accounts Receivable`;
    case 2:
      return `${head}\n\nDespite earlier reminders, ${ref} remains unpaid and is ${item.days} day(s) overdue. Please share a firm promise-to-pay date by return. Continued delay may affect your available credit.\n\nRegards,\nNEXA Accounts Receivable`;
    default:
      return `${head}\n\nFINAL NOTICE: ${ref} is ${item.days} day(s) overdue and now under collections review. Unless cleared within 7 days, the account will be placed on credit hold and the matter referred for further action.\n\nNEXA Accounts Receivable`;
  }
}

// ---------------------------------------------------------------------------
// Open items
// ---------------------------------------------------------------------------

export interface ArOpenItem {
  id: string; // invoice id
  number: string;
  accountId: string;
  entityId: string; // billing entity (Nexa Foods / Trading / Global)
  customerName: string;
  date: string; // ISO invoice date
  dueDate: string; // ISO
  total: number; // base INR
  outstanding: number; // base INR
  days: number; // days overdue (negative ⇒ not yet due)
  bucket: BucketKey;
  dunning: DunningLevel;
}

interface OpenItemSources {
  invoices: Invoice[];
  payments: Record<string, number>;
  overrides: Record<string, ReturnType<typeof effectiveStatus>>;
}

function sources(): OpenItemSources {
  const invoices = allInvoices(loadCreatedInvoices());
  return {
    invoices,
    payments: loadInvoicePayments(),
    overrides: loadStatusOverrides(),
  };
}

/** Every open AR item (outstanding > 0, not draft), bucketed, newest first. */
export function openItems(asOn: string = AS_ON, scheme: AgingBucket[] = AGING_BUCKETS): ArOpenItem[] {
  const { invoices, payments, overrides } = sources();
  const items: ArOpenItem[] = [];
  for (const inv of invoices) {
    const status = effectiveStatus(inv, overrides);
    if (status === "draft" || status === "paid") continue;
    const outstanding = outstandingOf(inv, payments);
    if (outstanding <= 0) continue;
    const acc = accountById(inv.accountId);
    const days = daysOverdue(inv.dueDate, asOn);
    const bucket = bucketForDays(days, scheme);
    items.push({
      id: inv.id,
      number: inv.number,
      accountId: inv.accountId,
      entityId: inv.entityId,
      customerName: acc?.name ?? "—",
      date: inv.date,
      dueDate: inv.dueDate,
      total: invoiceTotal(inv),
      outstanding,
      days,
      bucket,
      dunning: dunningForDays(days),
    });
  }
  return items.sort((a, b) => b.days - a.days);
}

export type BucketTotals = Record<BucketKey, number>;

/** Firm-wide AR totals per aging bucket. */
export function agingBuckets(asOn: string = AS_ON, scheme: AgingBucket[] = AGING_BUCKETS): BucketTotals {
  const totals = emptyBucketTotals(scheme);
  for (const it of openItems(asOn, scheme)) totals[it.bucket] += it.outstanding;
  return totals;
}

// ---------------------------------------------------------------------------
// Per-customer aging summary
// ---------------------------------------------------------------------------

export interface CustomerAr {
  accountId: string;
  name: string;
  buckets: BucketTotals;
  total: number; // total open AR
  worstBucket: BucketKey; // oldest bucket carrying a balance
  dunning: DunningLevel; // derived from the worst bucket
  credit: CreditStatus;
  itemCount: number;
}

export function customerAging(asOn: string = AS_ON, scheme: AgingBucket[] = AGING_BUCKETS): CustomerAr[] {
  const items = openItems(asOn, scheme);
  const byAcc = new Map<string, ArOpenItem[]>();
  for (const it of items) {
    const list = byAcc.get(it.accountId) ?? [];
    list.push(it);
    byAcc.set(it.accountId, list);
  }

  const limits = loadCreditLimits();
  const out: CustomerAr[] = [];
  // Worst (most overdue) bucket first — the scheme is ordered current → oldest.
  const order = [...scheme].reverse().map((b) => b.key);

  for (const [accountId, list] of byAcc) {
    const buckets = emptyBucketTotals(scheme);
    let total = 0;
    let maxDays = -Infinity;
    for (const it of list) {
      buckets[it.bucket] += it.outstanding;
      total += it.outstanding;
      if (it.days > maxDays) maxDays = it.days;
    }
    const worstBucket = order.find((k) => buckets[k] > 0) ?? scheme[0].key;
    out.push({
      accountId,
      name: list[0].customerName,
      buckets,
      total,
      worstBucket,
      dunning: dunningForDays(maxDays),
      credit: creditStatusFor(accountId, total, limits),
      itemCount: list.length,
    });
  }
  return out.sort((a, b) => b.total - a.total);
}

// ---------------------------------------------------------------------------
// Credit limits & exposure
// ---------------------------------------------------------------------------

export interface CreditStatus {
  accountId: string;
  limit: number; // effective limit (override ?? derived)
  derivedLimit: number; // deterministic baseline
  isOverridden: boolean;
  exposure: number; // open AR
  utilisation: number; // 0..1+ (exposure / limit)
  available: number; // limit − exposure (can go negative)
  overLimit: boolean;
}

/**
 * Deterministic credit limit per customer — roughly two months of historical
 * billing, rounded to a clean figure, with a sensible floor. No randomness, so
 * it's stable across renders/SSR.
 */
export function derivedCreditLimit(accountId: string): number {
  const billed = SEED_INVOICES.filter((i) => i.accountId === accountId).reduce(
    (s, i) => s + invoiceTotal(i),
    0,
  );
  const months = Math.max(1, SEED_INVOICES.filter((i) => i.accountId === accountId).length);
  const monthly = billed / months;
  const raw = monthly * 2; // ~two billing cycles of headroom
  // Round up to the nearest ₹50,000, floor at ₹2,00,000.
  const rounded = Math.ceil(raw / 50_000) * 50_000;
  return Math.max(200_000, rounded);
}

export function effectiveCreditLimit(
  accountId: string,
  limits: Record<string, number> = loadCreditLimits(),
): number {
  const override = limits[accountId];
  return typeof override === "number" && override > 0 ? override : derivedCreditLimit(accountId);
}

export function creditStatusFor(
  accountId: string,
  exposure: number,
  limits: Record<string, number> = loadCreditLimits(),
): CreditStatus {
  const derived = derivedCreditLimit(accountId);
  const override = limits[accountId];
  const isOverridden = typeof override === "number" && override > 0;
  const limit = isOverridden ? override : derived;
  const utilisation = limit > 0 ? exposure / limit : 0;
  return {
    accountId,
    limit,
    derivedLimit: derived,
    isOverridden,
    exposure,
    utilisation,
    available: limit - exposure,
    overLimit: exposure > limit,
  };
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export const CREDIT_LIMITS_KEY = "nexa-credit-limits";
export const AR_COLLECTIONS_KEY = "nexa-ar-collections";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}
function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const loadCreditLimits = () => read<Record<string, number>>(CREDIT_LIMITS_KEY, {});
export const saveCreditLimits = (l: Record<string, number>) => write(CREDIT_LIMITS_KEY, l);

export interface CollectionAction {
  lastContacted?: string; // ISO
  promiseToPayDate?: string; // ISO
  note?: string;
  dunningSent?: DunningLevel; // last dunning level sent
}

export const loadCollections = () => read<Record<string, CollectionAction>>(AR_COLLECTIONS_KEY, {});
export const saveCollections = (c: Record<string, CollectionAction>) => write(AR_COLLECTIONS_KEY, c);

// ---- Aging bucket scheme (shared by AR & AP) -------------------------------

export const AGING_BUCKETS_KEY = "nexa-aging-buckets";

/** Persisted breakpoints, or the defaults. */
export function loadBreakpoints(): number[] {
  const v = read<number[]>(AGING_BUCKETS_KEY, DEFAULT_BREAKPOINTS);
  const cleaned = cleanBreakpoints(Array.isArray(v) ? v : DEFAULT_BREAKPOINTS);
  return cleaned.length ? cleaned : DEFAULT_BREAKPOINTS;
}
export const saveBreakpoints = (b: number[]) => write(AGING_BUCKETS_KEY, cleanBreakpoints(b));
/** The active aging scheme derived from persisted breakpoints. */
export const loadBucketScheme = (): AgingBucket[] => schemeFromBreakpoints(loadBreakpoints());

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface ArSummary {
  totalReceivable: number;
  overdue: number;
  pctOverdue: number; // 0..1
  customersOverLimit: number;
}

export function arSummary(asOn: string = AS_ON): ArSummary {
  const items = openItems(asOn);
  const totalReceivable = items.reduce((s, i) => s + i.outstanding, 0);
  const overdue = items.filter((i) => i.days > 0).reduce((s, i) => s + i.outstanding, 0);
  const customersOverLimit = customerAging(asOn).filter((c) => c.credit.overLimit).length;
  return {
    totalReceivable,
    overdue,
    pctOverdue: totalReceivable > 0 ? overdue / totalReceivable : 0,
    customersOverLimit,
  };
}

export { ACCOUNTS, type CrmAccount };
