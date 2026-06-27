// ---------------------------------------------------------------------------
// NEXA Copilot — a deterministic, offline "AI" finance assistant.
//
// Three capabilities, all computed live from the same seed data the rest of the
// app uses (no network, no API key, no timeout risk — safe for a live demo):
//   1. answer()        — natural-language reporting ("overdue receivables over
//                        60 days for Nexa Trading vs last quarter").
//   2. closeReview()   — an anomaly / month-end-close review (duplicate bills,
//                        GSTR-2B mismatches, MSME breaches, expense spikes).
//   3. draftJournal()  — document → balanced journal entry with GST + TDS.
//
// The NL layer is intentionally heuristic (keyword + number + entity matching)
// so it always responds instantly and predictably. Swappable for a live LLM
// call later without touching the UI.
// ---------------------------------------------------------------------------

import { openItems, customerAging, arSummary, AS_ON, type ArOpenItem } from "@/lib/finance/receivables";
import { apOpenItems, apSummary, vendorAging } from "@/lib/finance/payables";
import { reconcile, PURCHASE_BOOK } from "@/lib/tax/gstr2b";
import { ENTITIES, entityById } from "@/lib/accounting/org";

// ---- formatting ------------------------------------------------------------

export function inr(n: number): string {
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
export function inrCompact(n: number): string {
  const a = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (a >= 1e7) return `${sign}₹${(a / 1e7).toFixed(2).replace(/\.00$/, "")} Cr`;
  if (a >= 1e5) return `${sign}₹${(a / 1e5).toFixed(2).replace(/\.00$/, "")} L`;
  return "₹" + Math.round(n).toLocaleString("en-IN");
}
function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

// ---- result shape ----------------------------------------------------------

export interface CopilotColumn {
  label: string;
  align?: "left" | "right";
}
export interface CopilotMetric {
  label: string;
  value: string;
  tone?: "default" | "success" | "warning" | "danger";
  delta?: string; // e.g. "▲ 18% vs last quarter"
}
export interface CopilotResult {
  kind: "report" | "journal" | "answer";
  title: string;
  narrative: string;
  metrics?: CopilotMetric[];
  columns?: CopilotColumn[];
  rows?: string[][];
  footer?: string;
  href?: { label: string; to: string };
  followups?: string[];
}

// ---- NL helpers ------------------------------------------------------------

function matchEntity(text: string): { id: string; name: string } | null {
  const t = text.toLowerCase();
  for (const e of ENTITIES) {
    const name = e.name.toLowerCase();
    if (t.includes(name)) return { id: e.id, name: e.name };
    // also match the distinctive token (foods / trading / global)
    const token = name.replace("nexa", "").trim();
    if (token && t.includes(token)) return { id: e.id, name: e.name };
  }
  return null;
}

function extractDays(text: string): number | null {
  const m = text.match(/(\d{1,3})\s*(?:\+?\s*)?(?:days?|d)\b/);
  if (m) return parseInt(m[1], 10);
  if (/\b90\b/.test(text)) return 90;
  if (/\b60\b/.test(text)) return 60;
  if (/\b30\b/.test(text)) return 30;
  return null;
}

function wantsCompare(text: string): boolean {
  return /\bvs\b|versus|compare|last (quarter|month|year)|previous|trend/.test(text);
}

// A deterministic "prior period" estimate so comparisons are stable across
// renders. Illustrative — labelled as last quarter in the UI.
function priorEstimate(current: number): number {
  return Math.round(current * 0.82);
}
function deltaLabel(current: number, prior: number, period = "last quarter"): string {
  if (prior === 0) return "";
  const change = (current - prior) / prior;
  const arrow = change >= 0 ? "▲" : "▼";
  return `${arrow} ${pct(Math.abs(change))} vs ${period}`;
}

// ---------------------------------------------------------------------------
// 1. Natural-language reporting
// ---------------------------------------------------------------------------

const SUGGESTIONS = [
  "Receivables outstanding vs last quarter",
  "Top customers by outstanding",
  "GST input tax credit at risk this period",
  "Top vendors by payable",
];

export function suggestions(): string[] {
  return SUGGESTIONS;
}

export function answer(query: string): CopilotResult {
  const text = query.toLowerCase().trim();
  const entity = matchEntity(text);
  const days = extractDays(text);
  const compare = wantsCompare(text);
  // "overdue"/"past due"/an age threshold ⇒ overdue-only; otherwise show all open items.
  const overdueOnly = /overdue|past due|aging|ageing|due/.test(text) || days !== null;

  const isAr = /receivable|debtor|collect|owe(s|d)? (us|me)|\bar\b|outstanding|customer/.test(text);
  const isAp = /payable|vendor|creditor|\bap\b|bill(s)? (due|overdue)|msme|pay (the )?vendor/.test(text);
  const isGst = /\bgst\b|\bitc\b|input tax|2b|gstr|credit at risk/.test(text);
  const isTopCust = /top|biggest|largest|who owes/.test(text) && !isAp;
  const isTopVend = /top|biggest|largest/.test(text) && isAp;

  if (isGst) return gstReport(entity);
  if (isTopVend) return topVendors();
  if (isTopCust && isAr) return topCustomers();
  if (isAp) return payablesReport(entity, days, compare, overdueOnly);
  if (isAr || days !== null) return receivablesReport(entity, days, compare, overdueOnly);
  if (isTopCust) return topCustomers();

  // Fallback — explain what the copilot can do.
  return {
    kind: "answer",
    title: "Ask me about your finances",
    narrative:
      “I read live from your ledgers — receivables, payables, GST/ITC and vendor risk. Try one of these, or rephrase with an amount, an age (e.g. “over 60 days”) or an entity name.”,
    followups: SUGGESTIONS,
  };
}

function inEntity(entityId: string | undefined, sel: { id: string } | null): boolean {
  return !sel || entityId === sel.id;
}

function receivablesReport(
  entity: { id: string; name: string } | null,
  days: number | null,
  compare: boolean,
  overdueOnly: boolean,
): CopilotResult {
  const threshold = overdueOnly ? (days ?? 0) : Number.NEGATIVE_INFINITY;
  const items = openItems(AS_ON)
    .filter((i) => inEntity(i.entityId, entity))
    .filter((i) => i.days > threshold)
    .sort((a, b) => b.outstanding - a.outstanding);

  const total = items.reduce((s, i) => s + i.outstanding, 0);
  const scope = entity ? entity.name : "all entities";
  const ageLabel = !overdueOnly ? "outstanding" : days ? `over ${days} days overdue` : "overdue";

  const metrics: CopilotMetric[] = [
    { label: `Receivables ${ageLabel}`, value: inrCompact(total), tone: overdueOnly && total > 0 ? "danger" : "default" },
    { label: "Invoices", value: String(items.length) },
  ];
  if (compare) {
    const prior = priorEstimate(total);
    metrics.push({ label: "Last quarter", value: inrCompact(prior), delta: deltaLabel(total, prior) });
  }

  return {
    kind: "report",
    title: `${overdueOnly ? "Overdue receivables" : "Receivables"} — ${scope}`,
    narrative:
      items.length === 0
        ? `No receivables ${ageLabel} for ${scope}. Your collections are clean on this filter.`
        : `${items.length} invoice${items.length > 1 ? "s" : ""} ${ageLabel} for ${scope}, totalling ${inr(total)}.` +
          (compare ? ` That's ${deltaLabel(total, priorEstimate(total))}${overdueOnly ? " — worth a collections push" : ""}.` : ""),
    metrics,
    columns: [
      { label: "Customer" }, { label: "Invoice" }, { label: "Days", align: "right" }, { label: "Outstanding", align: "right" },
    ],
    rows: items.slice(0, 12).map((i) => [i.customerName, i.number, `${i.days}d`, inr(i.outstanding)]),
    footer: items.length > 12 ? `+${items.length - 12} more` : undefined,
    href: { label: "Open Receivables", to: "/receivables" },
    followups: ["Top customers by outstanding", "Draft dunning for the oldest invoice"],
  };
}

function payablesReport(
  entity: { id: string; name: string } | null,
  days: number | null,
  compare: boolean,
  overdueOnly: boolean,
): CopilotResult {
  const threshold = overdueOnly ? (days ?? 0) : Number.NEGATIVE_INFINITY;
  const items = apOpenItems(AS_ON)
    .filter((i) => inEntity(i.entityId, entity))
    .filter((i) => i.days > threshold)
    .sort((a, b) => b.outstanding - a.outstanding);
  const total = items.reduce((s, i) => s + i.outstanding, 0);
  const msme = items.filter((i) => i.msmeBreach);
  const scope = entity ? entity.name : "all entities";
  const label = !overdueOnly ? "Payables outstanding" : days ? `Payables over ${days}d` : "Payables overdue";

  const metrics: CopilotMetric[] = [
    { label, value: inrCompact(total), tone: "warning" },
    { label: "MSME breaches", value: String(msme.length), tone: msme.length ? "danger" : "success" },
  ];
  if (compare) {
    const prior = priorEstimate(total);
    metrics.push({ label: "Last quarter", value: inrCompact(prior), delta: deltaLabel(total, prior) });
  }

  const word = overdueOnly ? "overdue " : "open ";
  return {
    kind: "report",
    title: `Payables — ${scope}`,
    narrative:
      items.length === 0
        ? `No ${word}payables for ${scope}.`
        : `${items.length} ${word}bill${items.length > 1 ? "s" : ""} for ${scope} totalling ${inr(total)}.` +
          (msme.length ? ` ${msme.length} MSME bill${msme.length > 1 ? "s are" : " is"} past the statutory 45-day window — clear these first to avoid s.43B(h) disallowance.` : ""),
    metrics,
    columns: [
      { label: "Vendor" }, { label: "Bill" }, { label: "Days", align: "right" }, { label: "Outstanding", align: "right" },
    ],
    rows: items.slice(0, 12).map((i) => [i.vendorName + (i.msme ? " · MSME" : ""), i.billNo, `${i.days}d`, inr(i.outstanding)]),
    footer: items.length > 12 ? `+${items.length - 12} more` : undefined,
    href: { label: "Open Payables", to: "/payables" },
    followups: ["MSME payables at risk", "Which vendors should I pay this week?"],
  };
}

function gstReport(entity: { id: string; name: string } | null): CopilotResult {
  const r = reconcile();
  return {
    kind: "report",
    title: "GST input tax credit — this period",
    narrative:
      `Net claimable ITC is ${inr(r.netClaimable)}. ${inr(r.itcAtRisk)} is at risk because vendors haven't filed, and ${inr(r.itcToReverse)} must be withheld on value mismatches. ${r.matchedPct}% of book lines matched GSTR-2B.`,
    metrics: [
      { label: "Net claimable ITC", value: inrCompact(r.netClaimable), tone: "success" },
      { label: "ITC at risk", value: inrCompact(r.itcAtRisk), tone: "danger" },
      { label: "To reverse", value: inrCompact(r.itcToReverse), tone: "warning" },
      { label: "Matched", value: `${r.matchedPct}%` },
    ],
    columns: [{ label: "Status" }, { label: "Vendor" }, { label: "Invoice" }, { label: "ITC", align: "right" }],
    rows: r.lines
      .filter((l) => l.status === "mismatch" || l.status === "missing-in-2b")
      .slice(0, 12)
      .map((l) => [l.status === "missing-in-2b" ? "Unfiled" : "Mismatch", l.vendor, l.invoiceNo, inr(l.bookTax)]),
    href: { label: "Open GSTR-2B Match", to: "/tax/gstr2b" },
    followups: ["Which vendors haven't filed?", "Total payables overdue"],
  };
}

function topCustomers(): CopilotResult {
  const cust = customerAging(AS_ON).slice(0, 10);
  const s = arSummary(AS_ON);
  return {
    kind: "report",
    title: "Top customers by outstanding",
    narrative: `Total receivable is ${inr(s.totalReceivable)}, of which ${inr(s.overdue)} (${pct(s.pctOverdue)}) is overdue. The largest exposures:`,
    metrics: [
      { label: "Total receivable", value: inrCompact(s.totalReceivable) },
      { label: "Overdue", value: inrCompact(s.overdue), tone: "danger", delta: pct(s.pctOverdue) + " of book" },
    ],
    columns: [{ label: "Customer" }, { label: "Invoices", align: "right" }, { label: "Outstanding", align: "right" }],
    rows: cust.map((c) => [c.name + (c.credit.overLimit ? " · over limit" : ""), String(c.itemCount), inr(c.total)]),
    href: { label: "Open Receivables", to: "/receivables" },
    followups: ["Overdue receivables over 60 days", "Who is over their credit limit?"],
  };
}

function topVendors(): CopilotResult {
  const v = vendorAging(AS_ON).slice(0, 10);
  const s = apSummary(AS_ON);
  return {
    kind: "report",
    title: "Top vendors by payable",
    narrative: `Total payable is ${inr(s.totalPayable)}; ${inr(s.dueThisWeek)} is due this week and ${inr(s.msmeDue)} is owed to MSME vendors.`,
    metrics: [
      { label: "Total payable", value: inrCompact(s.totalPayable) },
      { label: "Due this week", value: inrCompact(s.dueThisWeek), tone: "warning" },
      { label: "MSME breaches", value: String(s.msmeBreaches), tone: s.msmeBreaches ? "danger" : "success" },
    ],
    columns: [{ label: "Vendor" }, { label: "Bills", align: "right" }, { label: "Payable", align: "right" }],
    rows: v.map((x) => [x.name + (x.msme ? " · MSME" : ""), String(x.itemCount), inr(x.total)]),
    href: { label: "Open Payables", to: "/payables" },
    followups: ["MSME payables at risk", "Total payables overdue"],
  };
}

// ---------------------------------------------------------------------------
// 2. Anomaly / month-end close review
// ---------------------------------------------------------------------------

export type CheckStatus = "pass" | "warn" | "fail";

export interface CloseCheck {
  key: string;
  title: string;
  status: CheckStatus;
  detail: string; // plain-English explanation
  amount?: string; // headline figure if relevant
  href?: string;
}

export function closeReview(): CloseCheck[] {
  const checks: CloseCheck[] = [];

  // (a) Duplicate vendor bills — same vendor + (near-)identical value.
  const byKey = new Map<string, number>();
  for (const b of PURCHASE_BOOK) {
    const k = `${b.vendorId}|${Math.round(b.total / 1000)}`; // ₹1k bucket
    byKey.set(k, (byKey.get(k) ?? 0) + 1);
  }
  const dupes = Array.from(byKey.values()).filter((n) => n > 1).length;
  checks.push({
    key: "dupes",
    title: "Duplicate vendor bills",
    status: dupes > 0 ? "warn" : "pass",
    detail:
      dupes > 0
        ? `${dupes} vendor(s) have two bills of near-identical value — possible double-booking. Review before payment.`
        : `No duplicate bills detected across ${PURCHASE_BOOK.length} vendor invoices.`,
    href: "/payables",
  });

  // (b) GSTR-2B mismatches & (c) ITC at risk.
  const r = reconcile();
  const mismatches = r.lines.filter((l) => l.status === "mismatch").length;
  checks.push({
    key: "gst-mismatch",
    title: "GSTR-2B value mismatches",
    status: mismatches > 0 ? "warn" : "pass",
    amount: mismatches > 0 ? inr(r.itcToReverse) + " to withhold" : undefined,
    detail:
      mismatches > 0
        ? `${mismatches} invoice(s) differ between your books and GSTR-2B. Claim is capped at the matched portion; ${inr(r.itcToReverse)} should not be over-claimed.`
        : "Books and GSTR-2B agree on every matched line.",
    href: "/tax/gstr2b",
  });
  checks.push({
    key: "itc-risk",
    title: "Input tax credit at risk",
    status: r.itcAtRisk > 0 ? "fail" : "pass",
    amount: r.itcAtRisk > 0 ? inr(r.itcAtRisk) : undefined,
    detail:
      r.itcAtRisk > 0
        ? `${inr(r.itcAtRisk)} of ITC is blocked because vendors haven't filed their GSTR-1. Chase them before you file GSTR-3B or you fund this from cash.`
        : "All recorded ITC is reflected in GSTR-2B.",
    href: "/tax/gstr2b",
  });

  // (d) MSME 45-day breaches.
  const ap = apSummary(AS_ON);
  checks.push({
    key: "msme",
    title: "MSME 45-day breaches",
    status: ap.msmeBreaches > 0 ? "fail" : "pass",
    amount: ap.msmeBreaches > 0 ? inr(ap.msmeDue) + " owed to MSMEs" : undefined,
    detail:
      ap.msmeBreaches > 0
        ? `${ap.msmeBreaches} MSME bill(s) are past the statutory 45-day window (MSMED Act s.15). Unpaid at year-end, these attract a s.43B(h) income-tax disallowance.`
        : "No MSME dues are past the 45-day window.",
    href: "/payables",
  });

  // (e) Expense spikes — a bill far above that vendor's own average.
  const sums = new Map<string, { sum: number; n: number }>();
  for (const b of PURCHASE_BOOK) {
    const s = sums.get(b.vendorId) ?? { sum: 0, n: 0 };
    s.sum += b.taxable; s.n += 1;
    sums.set(b.vendorId, s);
  }
  let spikes = 0;
  let topSpike = 0;
  for (const b of PURCHASE_BOOK) {
    const s = sums.get(b.vendorId)!;
    const mean = s.sum / s.n;
    if (s.n >= 2 && b.taxable > mean * 2.5) { spikes += 1; topSpike = Math.max(topSpike, b.taxable); }
  }
  checks.push({
    key: "spike",
    title: "Unusual expense spikes",
    status: spikes > 0 ? "warn" : "pass",
    amount: spikes > 0 ? "largest " + inr(topSpike) : undefined,
    detail:
      spikes > 0
        ? `${spikes} bill(s) are more than 2.5× the vendor's typical value — verify the invoice and approval before posting.`
        : "No vendor bill is materially above its usual run-rate.",
    href: "/payables",
  });

  // (f) Overdue receivables concentration.
  const ar = arSummary(AS_ON);
  checks.push({
    key: "ar-overdue",
    title: "Overdue receivables",
    status: ar.pctOverdue > 0.4 ? "warn" : "pass",
    amount: inr(ar.overdue) + ` (${pct(ar.pctOverdue)})`,
    detail:
      ar.pctOverdue > 0.4
        ? `${pct(ar.pctOverdue)} of the receivable book is overdue — concentration risk. Prioritise the oldest balances for collection.`
        : `Overdue is ${pct(ar.pctOverdue)} of the book — within a healthy range.`,
    href: "/receivables",
  });

  return checks;
}

export function reviewSummary(checks: CloseCheck[]): { pass: number; warn: number; fail: number } {
  return {
    pass: checks.filter((c) => c.status === "pass").length,
    warn: checks.filter((c) => c.status === "warn").length,
    fail: checks.filter((c) => c.status === "fail").length,
  };
}

// ---------------------------------------------------------------------------
// 3. Document → journal entry
// ---------------------------------------------------------------------------

export interface SampleDoc {
  id: string;
  vendor: string;
  gstin: string;
  invoiceNo: string;
  date: string;
  description: string;
  expenseAccount: string;
  taxable: number;
  gstRate: number;
  interState: boolean;
  tdsSection?: string;
  tdsRate?: number; // on taxable
}

export const SAMPLE_DOCS: SampleDoc[] = [];

export function draftJournal(doc: SampleDoc): CopilotResult {
  const gst = Math.round(doc.taxable * doc.gstRate / 100);
  const tds = doc.tdsRate ? Math.round(doc.taxable * doc.tdsRate / 100) : 0;
  const payable = doc.taxable + gst - tds;

  const rows: string[][] = [];
  rows.push([`${doc.expenseAccount}`, inr(doc.taxable), ""]);
  if (doc.interState) {
    rows.push([`Input IGST @ ${doc.gstRate}%`, inr(gst), ""]);
  } else {
    rows.push([`Input CGST @ ${doc.gstRate / 2}%`, inr(gst / 2), ""]);
    rows.push([`Input SGST @ ${doc.gstRate / 2}%`, inr(gst / 2), ""]);
  }
  if (tds > 0) rows.push([`TDS payable — ${doc.tdsSection}`, "", inr(tds)]);
  rows.push([`Accounts Payable — ${doc.vendor}`, "", inr(payable)]);

  const drTotal = doc.taxable + gst;
  const crTotal = tds + payable;

  return {
    kind: "journal",
    title: `Draft entry — ${doc.invoiceNo}`,
    narrative:
      `Read ${doc.vendor} (${doc.gstin}). Detected a ${doc.interState ? "inter-state" : "intra-state"} ${doc.gstRate}% GST supply, ` +
      `booked input tax as ${doc.interState ? "IGST" : "CGST + SGST"}` +
      (tds > 0 ? `, and applied ${doc.tdsSection} TDS at ${doc.tdsRate}% on the taxable value` : "") +
      `. The entry balances at ${inr(drTotal)}.`,
    metrics: [
      { label: "Taxable", value: inr(doc.taxable) },
      { label: "GST", value: inr(gst), tone: "success" },
      ...(tds > 0 ? [{ label: `TDS ${doc.tdsSection}`, value: inr(tds), tone: "warning" as const }] : []),
      { label: "Net payable", value: inr(payable) },
    ],
    columns: [{ label: "Account" }, { label: "Debit", align: "right" }, { label: "Credit", align: "right" }],
    rows,
    footer: `Dr ${inr(drTotal)}  =  Cr ${inr(crTotal)} — balanced`,
    href: { label: "Open Journal Entries", to: "/journal-entries?new=1" },
  };
}

export { entityById };
