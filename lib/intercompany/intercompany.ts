// ---------------------------------------------------------------------------
// NEXA inter-company transactions — the related-party dealings between the
// three group entities (Nexa Foods, Nexa Trading, Nexa Global). Each deal has
// a provider/seller/lender (`from`) and a receiver/buyer/borrower (`to`); on
// consolidation these net off (see lib/intercompany/consolidation.ts).
//
// `counterAmount` is what the counterparty recorded — usually equal, but a
// mismatch surfaces as an inter-company reconciliation variance.
// ---------------------------------------------------------------------------

import { entityById, locationsForEntity } from "@/lib/accounting/org";
import type { EntryDraft } from "@/lib/accounting/manual-entries";

export type IcType = "loan" | "sale" | "service-fee" | "royalty" | "expense-recharge";

export interface IcTypeMeta {
  type: IcType;
  label: string;
  fromBooking: string; // how the provider books it
  toBooking: string; // how the receiver books it
  pnl: "sales" | "services" | "none"; // P&L elimination bucket
  bs: "trade" | "loan" | "none"; // balance-sheet elimination bucket
}

export const IC_TYPE_META: Record<IcType, IcTypeMeta> = {
  loan: { type: "loan", label: "Inter-co loan", fromBooking: "Loan receivable", toBooking: "Loan payable", pnl: "none", bs: "loan" },
  sale: { type: "sale", label: "Goods sale", fromBooking: "Receivable / Revenue", toBooking: "Payable / COGS", pnl: "sales", bs: "trade" },
  "service-fee": { type: "service-fee", label: "Service fee", fromBooking: "Receivable / Other income", toBooking: "Payable / Opex", pnl: "services", bs: "trade" },
  royalty: { type: "royalty", label: "Brand royalty", fromBooking: "Receivable / Other income", toBooking: "Payable / Opex", pnl: "services", bs: "trade" },
  "expense-recharge": { type: "expense-recharge", label: "Cost recharge", fromBooking: "Receivable / Other income", toBooking: "Payable / Opex", pnl: "services", bs: "trade" },
};

export interface IcTransaction {
  id: string;
  date: string; // ISO
  type: IcType;
  fromEntityId: string;
  toEntityId: string;
  amount: number; // base INR — the provider's recorded value
  counterAmount?: number; // receiver's recorded value (defaults to amount)
  memo: string;
  status: "open" | "settled";
  settledDate?: string;
}

const T = (
  seq: number,
  date: string,
  type: IcType,
  from: string,
  to: string,
  amount: number,
  memo: string,
  status: "open" | "settled",
  opt?: { counterAmount?: number; settledDate?: string },
): IcTransaction => ({
  id: `ic-${String(seq).padStart(3, "0")}`,
  date,
  type,
  fromEntityId: from,
  toEntityId: to,
  amount,
  counterAmount: opt?.counterAmount,
  memo,
  status,
  settledDate: opt?.settledDate,
});

const IN = "ent-nexa-in";
const TR = "ent-nexa-trade";
const GL = "ent-nexa-global";

export const SEED_IC: IcTransaction[] = [];

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
const IC_KEY = "nexa-ic-transactions";
const IC_SETTLE_KEY = "nexa-ic-settlements";

function read<T2>(key: string, fallback: T2): T2 {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T2;
  } catch {
    /* ignore */
  }
  return fallback;
}
function write<T2>(key: string, value: T2) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const loadCreatedIc = () => read<IcTransaction[]>(IC_KEY, []);
export const saveCreatedIc = (t: IcTransaction[]) => write(IC_KEY, t);
export const loadSettlements = () => read<Record<string, boolean>>(IC_SETTLE_KEY, {});
export const saveSettlements = (s: Record<string, boolean>) => write(IC_SETTLE_KEY, s);

export function allIc(created: IcTransaction[]): IcTransaction[] {
  return [...SEED_IC, ...created].sort((a, b) => b.date.localeCompare(a.date));
}

/** Effective settled flag = override ?? seed status. */
export function isSettled(tx: IcTransaction, overrides: Record<string, boolean>): boolean {
  return overrides[tx.id] ?? tx.status === "settled";
}

export function icVariance(tx: IcTransaction): number {
  return (tx.counterAmount ?? tx.amount) - tx.amount;
}

export function entityName(id: string): string {
  return entityById(id)?.name ?? id;
}

// ---------------------------------------------------------------------------
// Double-sided GL posting — auto-mirror an IC deal into BOTH entities' books.
// The provider (`from`) recognises the receivable + income/loan-out; the
// receiver (`to`) recognises the payable + cost/loan-in. Both legs use the
// inter-company control accounts (1320 / 2020) so consolidation eliminates them
// cleanly. A sale in one company therefore becomes a purchase in the other.
// ---------------------------------------------------------------------------

const IC_RECEIVABLE = "1320";
const IC_PAYABLE = "2020";
const BANK = "1020";

// Per type: the provider's P&L/cash credit, and the receiver's P&L/cash debit.
const IC_POSTING: Record<IcType, { fromCredit: string; toDebit: string; cash: boolean }> = {
  loan: { fromCredit: BANK, toDebit: BANK, cash: true }, // funds move; no P&L
  sale: { fromCredit: "4010", toDebit: "5010", cash: false }, // revenue ↔ COGS
  "service-fee": { fromCredit: "4900", toDebit: "6050", cash: false }, // other income ↔ opex
  royalty: { fromCredit: "4900", toDebit: "6050", cash: false },
  "expense-recharge": { fromCredit: "4900", toDebit: "6050", cash: false },
};

const firstLoc = (entityId: string) => locationsForEntity(entityId)[0]?.id ?? "";
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Build the two mirrored vouchers for an IC deal (provider draft, receiver draft). */
export function buildMirrorDrafts(tx: IcTransaction): { from: EntryDraft; to: EntryDraft } {
  const m = IC_TYPE_META[tx.type];
  const p = IC_POSTING[tx.type];
  const amt = r2(tx.amount);
  const counter = r2(tx.counterAmount ?? tx.amount);

  const from: EntryDraft = {
    type: "journal",
    date: tx.date,
    narration: `IC ${m.label} to ${entityName(tx.toEntityId)} — ${tx.memo} [${tx.id}]`,
    entityId: tx.fromEntityId,
    locationId: firstLoc(tx.fromEntityId),
    currency: "INR",
    basis: "accrual",
    lines: [
      { accountCode: IC_RECEIVABLE, debit: amt, credit: 0 },
      { accountCode: p.fromCredit, debit: 0, credit: amt },
    ],
  };

  const to: EntryDraft = {
    type: "journal",
    date: tx.date,
    narration: `IC ${m.label} from ${entityName(tx.fromEntityId)} — ${tx.memo} [${tx.id}]`,
    entityId: tx.toEntityId,
    locationId: firstLoc(tx.toEntityId),
    currency: "INR",
    basis: "accrual",
    lines: [
      { accountCode: p.toDebit, debit: counter, credit: 0 },
      { accountCode: IC_PAYABLE, debit: 0, credit: counter },
    ],
  };

  return { from, to };
}

export function nextIcId(created: IcTransaction[]): string {
  let max = 0;
  for (const t of [...SEED_IC, ...created]) {
    const m = t.id.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `ic-${String(max + 1).padStart(3, "0")}`;
}
