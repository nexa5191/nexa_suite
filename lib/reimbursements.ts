// ---------------------------------------------------------------------------
// NEXA employee reimbursements — staff expense claims with an approve → pay
// workflow that posts REAL double-entry vouchers:
//
//   Approve → journal: Dr Expense head / Cr Employee Reimbursements Payable (2310)
//   Pay     → payment: Dr Employee Reimbursements Payable / Cr Bank
//
// Claims (seed + user-created) live in localStorage; their workflow state and the
// ids of the vouchers they generated are tracked separately so a claim can be
// advanced without mutating the seed.
// ---------------------------------------------------------------------------

import type { EntryDraft, ManualEntry } from "@/lib/accounting/manual-entries";

export const EMP_PAYABLE_ACCOUNT = "2310";
export const DEFAULT_BANK = "1020";
export const REIMB_PARTY = "other-employee"; // sub-ledger party (see lib/accounting/parties)

export type ReimbStatus = "draft" | "submitted" | "approved" | "paid" | "rejected";

export const STATUS_META: Record<ReimbStatus, { label: string; variant: "default" | "warning" | "success" | "danger" | "primary" }> = {
  draft: { label: "Draft", variant: "default" },
  submitted: { label: "Awaiting approval", variant: "warning" },
  approved: { label: "Approved · to pay", variant: "primary" },
  paid: { label: "Reimbursed", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
};

/** Reimbursement categories → the GL expense account they post to. */
export interface ReimbCategory {
  label: string;
  accountCode: string;
}

export const REIMB_CATEGORIES: ReimbCategory[] = [
  { label: "Travel & lodging", accountCode: "6070" },
  { label: "Local conveyance", accountCode: "6070" },
  { label: "Meals & refreshments", accountCode: "6035" },
  { label: "Client entertainment", accountCode: "6040" },
  { label: "Office supplies", accountCode: "6035" },
  { label: "Mobile & internet", accountCode: "6060" },
  { label: "Training & development", accountCode: "6050" },
];

export function reimbCategory(label: string): ReimbCategory {
  return REIMB_CATEGORIES.find((c) => c.label === label) ?? REIMB_CATEGORIES[0];
}

export interface Reimbursement {
  id: string;
  employeeId: string;
  entityId: string;
  locationId: string;
  claimDate: string; // when raised
  expenseDate: string; // when the expense was incurred
  category: string; // ReimbCategory label
  description: string;
  amount: number; // base INR
  seedStatus: ReimbStatus; // starting state for seed/created claims
}

export const SEED_REIMBURSEMENTS: Reimbursement[] = [];

// ---- workflow state + persistence ------------------------------------------
export interface ReimbState {
  status?: ReimbStatus;
  accrualVoucherId?: string; // voucher posted on approval
  paymentVoucherId?: string; // voucher posted on payment
  approvedBy?: string;
  paidOn?: string;
}
export type ReimbStateStore = Record<string, ReimbState>;

const CREATED_KEY = "nexa-reimb-created";
const STATE_KEY = "nexa-reimb-state";

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

export const loadCreatedReimbursements = () => read<Reimbursement[]>(CREATED_KEY, []);
export const saveCreatedReimbursements = (r: Reimbursement[]) => write(CREATED_KEY, r);
export const loadReimbState = () => read<ReimbStateStore>(STATE_KEY, {});
export const saveReimbState = (s: ReimbStateStore) => write(STATE_KEY, s);

export function allReimbursements(created: Reimbursement[]): Reimbursement[] {
  return [...SEED_REIMBURSEMENTS, ...created];
}

export function effectiveStatus(r: Reimbursement, store: ReimbStateStore): ReimbStatus {
  return store[r.id]?.status ?? r.seedStatus;
}

export function nextReimbId(created: Reimbursement[]): string {
  let max = SEED_REIMBURSEMENTS.length;
  for (const r of created) {
    const m = r.id.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `reimb-${String(max + 1).padStart(3, "0")}`;
}

// ---- voucher drafts --------------------------------------------------------
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Accrue the approved claim — Dr Expense head / Cr Employee Payable. */
export function accrualDraft(r: Reimbursement, employeeName: string): EntryDraft {
  const amt = round2(r.amount);
  return {
    type: "journal",
    date: new Date().toISOString().slice(0, 10),
    narration: `Reimbursement — ${employeeName} · ${r.category} · ${r.description}`,
    entityId: r.entityId,
    locationId: r.locationId,
    currency: "INR",
    basis: "accrual",
    partyId: REIMB_PARTY,
    lines: [
      { accountCode: reimbCategory(r.category).accountCode, debit: amt, credit: 0 },
      { accountCode: EMP_PAYABLE_ACCOUNT, debit: 0, credit: amt },
    ],
  };
}

/** Pay the approved claim — Dr Employee Payable / Cr Bank. */
export function paymentDraft(r: Reimbursement, employeeName: string, bankAccount = DEFAULT_BANK): EntryDraft {
  const amt = round2(r.amount);
  return {
    type: "payment",
    date: new Date().toISOString().slice(0, 10),
    narration: `Reimbursement payout — ${employeeName} · ${r.description}`,
    entityId: r.entityId,
    locationId: r.locationId,
    currency: "INR",
    basis: "both",
    partyId: REIMB_PARTY,
    lines: [
      { accountCode: EMP_PAYABLE_ACCOUNT, debit: amt, credit: 0 },
      { accountCode: bankAccount, debit: 0, credit: amt },
    ],
  };
}

/** Total approved-but-unpaid liability (what's sitting in account 2310). */
export function outstandingPayable(entries: ManualEntry[]): number {
  let bal = 0;
  for (const e of entries) {
    for (const l of e.lines) {
      if (l.accountCode === EMP_PAYABLE_ACCOUNT) bal += (Number(l.credit) || 0) - (Number(l.debit) || 0);
    }
  }
  return round2(bal);
}
