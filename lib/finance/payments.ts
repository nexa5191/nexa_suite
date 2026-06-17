// ---------------------------------------------------------------------------
// NEXA Payment execution — NEFT/RTGS/IMPS payment runs + bank-upload file.
//
// A payment run batches approved/outstanding vendor bills into a single bank
// upload. We remit from one entity's bank account per run (banks require a
// single debit account per bulk file), auto-pick the rail by amount band, and
// emit a realistic flat-file string the user can download and feed to their
// corporate-banking portal.
//
// Persistence (client-side):
//   nexa-payment-runs  → processed/created runs (array of PaymentRun)
//
// Bill settlement re-uses the existing Pay-Bills allocation store
// (loadPoPayments/savePoPayments) so a paid run marks its bills outstanding-0
// everywhere else in the app.
// ---------------------------------------------------------------------------

import {
  PURCHASE_ORDERS,
  vendorById,
  poOutstanding,
  loadPoPayments,
  savePoPayments,
  type PurchaseOrder,
} from "@/lib/vendors";
import { entityBank } from "@/lib/invoicing";

// Indian payment rails. RTGS is for high-value (>= ₹2L) real-time gross
// settlement; NEFT batches; IMPS is an instant low-value option.
export type PayMode = "RTGS" | "NEFT" | "IMPS";

/** RTGS floor — RBI sets the RTGS minimum at ₹2,00,000. */
export const RTGS_FLOOR = 200000;

/** Auto-select the rail from the amount band. */
export function pickMode(amount: number): PayMode {
  return amount >= RTGS_FLOOR ? "RTGS" : "NEFT";
}

/** Rails the user may pick for a given amount (IMPS only below the RTGS floor). */
export function modeOptions(amount: number): PayMode[] {
  return amount >= RTGS_FLOOR ? ["RTGS"] : ["NEFT", "IMPS"];
}

export interface PayableBill {
  poId: string;
  vendor: string;
  vendorGstin: string;
  beneficiaryAccount: string; // masked A/C number
  beneficiaryIfsc: string;
  billNo: string;
  billDate: string; // ISO
  amount: number; // base INR — outstanding
  mode: PayMode; // auto-selected rail
  entityId: string;
}

export interface PaymentRunBill {
  poId: string;
  vendor: string;
  beneficiaryAccount: string;
  beneficiaryIfsc: string;
  billNo: string;
  amount: number;
  mode: PayMode;
}

export type RunStatus = "draft" | "processed";

export interface PaymentRun {
  id: string;
  entityId: string;
  valueDate: string; // ISO
  createdOn: string; // ISO
  status: RunStatus;
  bills: PaymentRunBill[];
  total: number;
  count: number;
  modeMix: Record<PayMode, number>; // count of bills per rail
}

// ---------------------------------------------------------------------------
// Deterministic beneficiary bank details — seeded from the vendor id so the
// same vendor always renders the same masked A/C + IFSC (no Math.random; SSR-safe).
// ---------------------------------------------------------------------------
const BANK_IFSCS = ["HDFC0000425", "ICIC0001186", "SBIN0007341", "AXIS0000912", "KKBK0008021"];

function seedNum(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** Masked beneficiary A/C number — last 4 visible, like a bank statement. */
export function beneficiaryAccount(vendorId: string): string {
  const last4 = String(seedNum(vendorId) % 10000).padStart(4, "0");
  return `XXXXXX${last4}`;
}

/** Deterministic IFSC for the vendor's bank branch. */
export function beneficiaryIfsc(vendorId: string): string {
  return BANK_IFSCS[seedNum(vendorId) % BANK_IFSCS.length];
}

// ---------------------------------------------------------------------------
// Payable bills — every PO with an invoice and a positive outstanding balance.
// (approved-paid / invoiced / paid all reduce to "is there money still owed?")
// ---------------------------------------------------------------------------
export function payableBills(payments: Record<string, number> = loadPoPayments()): PayableBill[] {
  const out: PayableBill[] = [];
  for (const po of PURCHASE_ORDERS) {
    if (!po.invoice) continue;
    const amount = poOutstanding(po, payments);
    if (amount <= 0) continue;
    const v = vendorById(po.vendorId);
    out.push({
      poId: po.id,
      vendor: v?.name ?? po.vendorId,
      vendorGstin: v?.gstin ?? "—",
      beneficiaryAccount: beneficiaryAccount(po.vendorId),
      beneficiaryIfsc: beneficiaryIfsc(po.vendorId),
      billNo: po.invoice.number,
      billDate: po.invoice.date,
      amount,
      mode: pickMode(amount),
      entityId: po.entityId,
    });
  }
  return out.sort((a, b) => b.amount - a.amount);
}

/** Payable bills remitted from a single entity's bank account. */
export function payableBillsForEntity(
  entityId: string,
  payments: Record<string, number> = loadPoPayments(),
): PayableBill[] {
  return payableBills(payments).filter((b) => b.entityId === entityId);
}

function emptyMix(): Record<PayMode, number> {
  return { RTGS: 0, NEFT: 0, IMPS: 0 };
}

/** Assemble a draft run from the selected payable bills. */
export function buildRun(entityId: string, valueDate: string, bills: PayableBill[]): PaymentRun {
  const modeMix = emptyMix();
  let total = 0;
  const runBills: PaymentRunBill[] = bills.map((b) => {
    modeMix[b.mode] += 1;
    total += b.amount;
    return {
      poId: b.poId,
      vendor: b.vendor,
      beneficiaryAccount: b.beneficiaryAccount,
      beneficiaryIfsc: b.beneficiaryIfsc,
      billNo: b.billNo,
      amount: b.amount,
      mode: b.mode,
    };
  });
  return {
    id: `RUN-${entityId.replace("ent-nexa-", "").toUpperCase()}-${seedNum(valueDate + runBills.map((b) => b.poId).join()).toString(36).slice(0, 6).toUpperCase()}`,
    entityId,
    valueDate,
    createdOn: "2026-06-18",
    status: "draft",
    bills: runBills,
    total,
    count: runBills.length,
    modeMix,
  };
}

// ---------------------------------------------------------------------------
// Bank-upload file — a realistic bulk NEFT/RTGS flat-file (CSV) string.
// Header row + one row per beneficiary, terminated with a control total.
// Columns: BeneficiaryName, AccountNo, IFSC, Amount, Mode, Reference, ValueDate.
// ---------------------------------------------------------------------------
const CSV_HEADER = "BeneficiaryName,AccountNo,IFSC,Amount,Mode,Reference,ValueDate";

function csvCell(s: string): string {
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function paymentRef(run: PaymentRun, bill: PaymentRunBill): string {
  return `${run.id}/${bill.poId}`;
}

/** Build the bank-upload flat-file string for a run. */
export function buildBankFile(run: PaymentRun): string {
  const lines: string[] = [CSV_HEADER];
  for (const b of run.bills) {
    lines.push(
      [
        csvCell(b.vendor),
        b.beneficiaryAccount,
        b.beneficiaryIfsc,
        b.amount.toFixed(2),
        b.mode,
        csvCell(paymentRef(run, b)),
        run.valueDate,
      ].join(","),
    );
  }
  // Control trailer — total record count + value, as most portals expect.
  lines.push(`# DEBIT,${entityBank(run.entityId)}`);
  lines.push(`# TOTAL RECORDS,${run.count},TOTAL VALUE,${run.total.toFixed(2)}`);
  return lines.join("\r\n");
}

/** Suggested download filename for a run's bank file. */
export function bankFileName(run: PaymentRun): string {
  return `${run.id}-${run.valueDate}.csv`;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
export const PAYMENT_RUNS_KEY = "nexa-payment-runs";

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

export const loadPaymentRuns = (): PaymentRun[] => read<PaymentRun[]>(PAYMENT_RUNS_KEY, []);
export const savePaymentRuns = (runs: PaymentRun[]) => write(PAYMENT_RUNS_KEY, runs);

/**
 * Process a run: persist it as `processed` and settle its bills against the
 * shared Pay-Bills allocation store (so outstanding → 0 everywhere).
 * Returns the saved run list.
 */
export function processRun(run: PaymentRun): PaymentRun[] {
  const payments = loadPoPayments();
  for (const b of run.bills) {
    const po: PurchaseOrder | undefined = PURCHASE_ORDERS.find((p) => p.id === b.poId);
    const billAmount = po?.invoice?.amount ?? b.amount;
    payments[b.poId] = billAmount; // mark fully settled
  }
  savePoPayments(payments);

  const processed: PaymentRun = { ...run, status: "processed" };
  const runs = [processed, ...loadPaymentRuns().filter((r) => r.id !== run.id)];
  savePaymentRuns(runs);
  return runs;
}
