// ---------------------------------------------------------------------------
// Contracts register — AMCs, subscriptions, retainers and licences with a fixed
// recurring fee. Two things on top of the register:
//   1. Auto-post the fixed fee each period to the GL (idempotent — re-running
//      never double-posts), mirroring the depreciation-posting pattern.
//   2. Renewal intimation — flag contracts nearing their end date.
// ---------------------------------------------------------------------------

import { entityById } from "@/lib/accounting/org";
import { AS_ON } from "@/lib/finance/receivables";
import type { EntryDraft, ManualEntry } from "@/lib/accounting/manual-entries";

export type ContractDirection = "payable" | "receivable";
export type ContractCategory = "AMC" | "Subscription" | "Retainer" | "Licence" | "Insurance";
export type Frequency = "monthly" | "quarterly" | "annual";

export interface Contract {
  id: string;
  name: string;
  counterparty: string;
  direction: ContractDirection; // payable = we pay; receivable = we bill
  category: ContractCategory;
  fee: number; // fixed fee per billing period
  frequency: Frequency;
  start: string; // ISO
  end: string; // ISO
  entityId: string;
  locationId: string;
}

const AP = "2010", AR = "1100";
const EXPENSE_FOR: Record<ContractCategory, string> = {
  AMC: "6035", Subscription: "6060", Licence: "6060", Retainer: "6050", Insurance: "6035",
};
const INCOME_ACCOUNT = "4020"; // Service Revenue

/** Renewal window — contracts ending within this many days are "expiring". */
export const RENEWAL_WINDOW_DAYS = 60;

export const CONTRACTS: Contract[] = [
  { id: "ct-1", name: "HVAC & DG-set AMC", counterparty: "CoolAir Facility Services", direction: "payable", category: "AMC", fee: 18_000, frequency: "monthly", start: "2025-04-01", end: "2026-06-30", entityId: "ent-nexa-in", locationId: "loc-blr" },
  { id: "ct-2", name: "ERP & email cloud subscription", counterparty: "CloudStack Technologies", direction: "payable", category: "Subscription", fee: 65_000, frequency: "monthly", start: "2025-07-01", end: "2027-06-30", entityId: "ent-nexa-in", locationId: "loc-blr" },
  { id: "ct-3", name: "Fire & safety AMC", counterparty: "SafeGuard Systems", direction: "payable", category: "AMC", fee: 30_000, frequency: "quarterly", start: "2025-04-01", end: "2026-08-10", entityId: "ent-nexa-trade", locationId: "loc-mum" },
  { id: "ct-4", name: "Legal & secretarial retainer", counterparty: "Lex & Associates", direction: "payable", category: "Retainer", fee: 50_000, frequency: "monthly", start: "2026-01-01", end: "2026-12-31", entityId: "ent-nexa-in", locationId: "loc-blr" },
  { id: "ct-5", name: "Cold-chain monitoring licence", counterparty: "ChainSense IoT", direction: "payable", category: "Licence", fee: 120_000, frequency: "annual", start: "2025-05-01", end: "2026-04-30", entityId: "ent-nexa-trade", locationId: "loc-mum" },
  { id: "ct-6", name: "Data-insights AMC (billed)", counterparty: "QuickBasket", direction: "receivable", category: "AMC", fee: 50_000, frequency: "monthly", start: "2025-10-01", end: "2026-09-30", entityId: "ent-nexa-in", locationId: "loc-blr" },
];

// ---- Contract document repository ------------------------------------------

export type DocKind = "agreement" | "sla" | "amendment" | "renewal" | "po" | "insurance";

export interface ContractDoc {
  id: string;
  contractId: string;
  name: string;
  kind: DocKind;
  date: string; // ISO — signed/effective date
  version: string;
  sizeKb: number;
}

export const DOC_KIND_META: Record<DocKind, { label: string; tone: "primary" | "success" | "warning" | "default" }> = {
  agreement: { label: "Agreement", tone: "primary" },
  sla: { label: "SLA", tone: "success" },
  amendment: { label: "Amendment", tone: "warning" },
  renewal: { label: "Renewal", tone: "success" },
  po: { label: "PO", tone: "default" },
  insurance: { label: "Insurance", tone: "default" },
};

export const CONTRACT_DOCS: ContractDoc[] = [
  { id: "cd-1", contractId: "ct-1", name: "HVAC AMC — master agreement.pdf", kind: "agreement", date: "2025-03-28", version: "v1.0", sizeKb: 412 },
  { id: "cd-2", contractId: "ct-1", name: "HVAC AMC — SLA annexure.pdf", kind: "sla", date: "2025-03-28", version: "v1.0", sizeKb: 188 },
  { id: "cd-3", contractId: "ct-2", name: "CloudStack ERP — subscription order form.pdf", kind: "agreement", date: "2025-06-25", version: "v2.1", sizeKb: 356 },
  { id: "cd-4", contractId: "ct-2", name: "CloudStack — DPA & security addendum.pdf", kind: "amendment", date: "2025-09-12", version: "v2.2", sizeKb: 274 },
  { id: "cd-5", contractId: "ct-3", name: "SafeGuard fire AMC — agreement.pdf", kind: "agreement", date: "2025-03-30", version: "v1.0", sizeKb: 298 },
  { id: "cd-6", contractId: "ct-4", name: "Lex & Associates — retainer LOE.pdf", kind: "agreement", date: "2025-12-20", version: "v1.0", sizeKb: 210 },
  { id: "cd-7", contractId: "ct-5", name: "ChainSense IoT — licence & PO.pdf", kind: "po", date: "2025-04-22", version: "v1.0", sizeKb: 164 },
  { id: "cd-8", contractId: "ct-6", name: "QuickBasket data-insights AMC — MSA.pdf", kind: "agreement", date: "2025-09-25", version: "v1.0", sizeKb: 488 },
  { id: "cd-9", contractId: "ct-6", name: "QuickBasket — renewal addendum FY26.pdf", kind: "renewal", date: "2026-03-15", version: "v1.1", sizeKb: 132 },
];

export function docsFor(contractId: string): ContractDoc[] {
  return CONTRACT_DOCS.filter((d) => d.contractId === contractId);
}
export function contractById(id: string): Contract | undefined {
  return CONTRACTS.find((c) => c.id === id);
}

// ---- date helpers ----------------------------------------------------------

function addMonths(iso: string, k: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const idx = (m - 1) + k;
  const yy = y + Math.floor(idx / 12);
  const mm = (idx % 12 + 12) % 12;
  return `${yy}-${String(mm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86_400_000);
}
const stepMonths = (f: Frequency) => (f === "monthly" ? 1 : f === "quarterly" ? 3 : 12);

export function periodsPerYear(f: Frequency): number {
  return f === "monthly" ? 12 : f === "quarterly" ? 4 : 1;
}
export function annualValue(c: Contract): number {
  return c.fee * periodsPerYear(c.frequency);
}

// ---- status / renewal ------------------------------------------------------

export type ContractStatus = "active" | "expiring" | "expired";

export function daysToEnd(c: Contract, asOn: string = AS_ON): number {
  return daysBetween(asOn, c.end);
}
export function contractStatus(c: Contract, asOn: string = AS_ON): ContractStatus {
  const d = daysToEnd(c, asOn);
  if (d < 0) return "expired";
  if (d <= RENEWAL_WINDOW_DAYS) return "expiring";
  return "active";
}

/** Contracts needing renewal attention (expiring soon or already expired), soonest first. */
export function renewals(asOn: string = AS_ON): Contract[] {
  return CONTRACTS
    .filter((c) => contractStatus(c, asOn) !== "active")
    .sort((a, b) => daysToEnd(a, asOn) - daysToEnd(b, asOn));
}

// ---- due periods & auto-posting --------------------------------------------

export interface DuePeriod { date: string; key: string }

/** Periods whose fee should have been posted by `asOn` (start ≤ asOn ≤ end). */
export function duePeriods(c: Contract, asOn: string = AS_ON): DuePeriod[] {
  const step = stepMonths(c.frequency);
  const out: DuePeriod[] = [];
  for (let k = 0; ; k++) {
    const date = addMonths(c.start, k * step);
    if (date > asOn || date > c.end) break;
    out.push({ date, key: date });
  }
  return out;
}

export const contractNarration = (c: Contract, periodDate: string) => `${c.category} ${c.id} — ${periodDate}`;

export function isPeriodPosted(entries: ManualEntry[], c: Contract, periodDate: string): boolean {
  const narration = contractNarration(c, periodDate);
  return entries.some((e) => e.status === "posted" && e.narration === narration);
}

export function buildContractDraft(c: Contract, periodDate: string): EntryDraft {
  const lines =
    c.direction === "payable"
      ? [
          { accountCode: EXPENSE_FOR[c.category], debit: c.fee, credit: 0 },
          { accountCode: AP, debit: 0, credit: c.fee },
        ]
      : [
          { accountCode: AR, debit: c.fee, credit: 0 },
          { accountCode: INCOME_ACCOUNT, debit: 0, credit: c.fee },
        ];
  return {
    type: "journal",
    date: periodDate,
    narration: contractNarration(c, periodDate),
    entityId: c.entityId,
    locationId: c.locationId,
    currency: entityById(c.entityId)?.currency ?? "INR",
    basis: "accrual",
    lines,
  };
}

export interface ContractPlan {
  contract: Contract;
  status: ContractStatus;
  duePeriods: DuePeriod[];
  postedCount: number;
  pendingDrafts: EntryDraft[];
  pendingAmount: number;
}

export function planContract(c: Contract, entries: ManualEntry[], asOn: string = AS_ON): ContractPlan {
  const due = duePeriods(c, asOn);
  const pendingDrafts: EntryDraft[] = [];
  let postedCount = 0;
  for (const p of due) {
    if (isPeriodPosted(entries, c, p.date)) postedCount++;
    else pendingDrafts.push(buildContractDraft(c, p.date));
  }
  return {
    contract: c,
    status: contractStatus(c, asOn),
    duePeriods: due,
    postedCount,
    pendingDrafts,
    pendingAmount: pendingDrafts.length * c.fee,
  };
}

export interface ContractsSummary {
  active: number;
  annualisedValue: number;
  pendingAmount: number;
  pendingDrafts: EntryDraft[];
  expiringSoon: number;
}

export function contractsSummary(entries: ManualEntry[], asOn: string = AS_ON): { plans: ContractPlan[]; summary: ContractsSummary } {
  const plans = CONTRACTS.map((c) => planContract(c, entries, asOn));
  const pendingDrafts = plans.flatMap((p) => p.pendingDrafts);
  const summary: ContractsSummary = {
    active: plans.filter((p) => p.status !== "expired").length,
    annualisedValue: CONTRACTS.reduce((s, c) => s + annualValue(c), 0),
    pendingAmount: pendingDrafts.reduce((s, d) => s + (Number(d.lines[0].debit) || 0), 0),
    pendingDrafts,
    expiringSoon: plans.filter((p) => p.status === "expiring" || p.status === "expired").length,
  };
  return { plans, summary };
}

export { AS_ON };
