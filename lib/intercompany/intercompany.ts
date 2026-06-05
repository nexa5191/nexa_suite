// ---------------------------------------------------------------------------
// NEXA inter-company transactions — the related-party dealings between the
// three group entities (Nexa Foods, Nexa Trading, Nexa Global). Each deal has
// a provider/seller/lender (`from`) and a receiver/buyer/borrower (`to`); on
// consolidation these net off (see lib/intercompany/consolidation.ts).
//
// `counterAmount` is what the counterparty recorded — usually equal, but a
// mismatch surfaces as an inter-company reconciliation variance.
// ---------------------------------------------------------------------------

import { entityById } from "@/lib/accounting/org";

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

export const SEED_IC: IcTransaction[] = [
  T(1, "2025-04-05", "loan", IN, TR, 5_000_000, "Working-capital loan to Trading LLP", "open"),
  T(2, "2025-05-20", "sale", IN, TR, 2_400_000, "Finished-goods supply — Mumbai depot", "open"),
  T(3, "2025-06-01", "service-fee", IN, GL, 1_200_000, "Shared services & management fee", "open"),
  T(4, "2025-06-15", "royalty", IN, GL, 600_000, "Brand royalty — Nexa trademark", "settled", { settledDate: "2025-09-30" }),
  T(5, "2025-07-10", "expense-recharge", IN, TR, 480_000, "ERP & IT cost recharge", "settled", { settledDate: "2025-10-12" }),
  T(6, "2025-08-02", "sale", TR, GL, 1_800_000, "Export consolidation — Trading to Global", "open"),
  T(7, "2025-09-18", "loan", IN, GL, 3_000_000, "Capex loan — Singapore office build-out", "open"),
  T(8, "2025-10-05", "service-fee", TR, IN, 900_000, "Distribution & logistics fee to Foods", "open"),
  T(9, "2025-11-12", "sale", IN, TR, 1_500_000, "Festive-season FG batch", "settled", { settledDate: "2026-01-20" }),
  T(10, "2026-01-08", "expense-recharge", IN, GL, 750_000, "Expat payroll recharge", "open", { counterAmount: 720_000 }),
  T(11, "2026-02-14", "royalty", IN, TR, 300_000, "Brand royalty — Trading", "open"),
  T(12, "2026-03-22", "service-fee", IN, GL, 540_000, "Finance shared-services — Q4", "open", { counterAmount: 540_000 }),
];

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

export function nextIcId(created: IcTransaction[]): string {
  let max = 0;
  for (const t of [...SEED_IC, ...created]) {
    const m = t.id.match(/(\d+)$/);
    if (m) max = Math.max(max, parseInt(m[1], 10));
  }
  return `ic-${String(max + 1).padStart(3, "0")}`;
}
