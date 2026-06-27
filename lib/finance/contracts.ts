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

export const CONTRACTS: Contract[] = [];

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

export const CONTRACT_DOCS: ContractDoc[] = [];

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
