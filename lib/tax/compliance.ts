// ---------------------------------------------------------------------------
// NEXA tax compliance state — the "review & lock" layer over the returns.
//
// A return period moves through a maker-checker workflow:
//   open → (preparer submits) → in_review → (reviewer approves+files) → filed
//                              ↘ (reviewer returns) → open
//   filed → (reviewer reopens to revise) → open
// A `filed` period is LOCKED: its rows can't be re-filed until reopened. Every
// transition is appended to an immutable review trail.
//
// Returns tracked independently per period: GSTR-1 (outward) and GSTR-3B
// (summary/payment). Plus per-document ITC claims, TDS deposits & certificates,
// and the electronic cash ledger. All client-side, persisted under nexa-tax-*.
// ---------------------------------------------------------------------------

export type ReturnKey = "gstr1" | "gstr3b";
export const RETURN_KEYS: ReturnKey[] = ["gstr1", "gstr3b"];
export const RETURN_LABEL: Record<ReturnKey, string> = {
  gstr1: "GSTR-1",
  gstr3b: "GSTR-3B",
};

export type FilingStatus = "open" | "in_review" | "filed";

export const FILING_META: Record<FilingStatus, { label: string; variant: "default" | "warning" | "success" }> = {
  open: { label: "Open", variant: "default" },
  in_review: { label: "In review", variant: "warning" },
  filed: { label: "Filed & locked", variant: "success" },
};

export type ReviewAction =
  | "submitted" // preparer → in_review
  | "approved" // reviewer files & locks
  | "returned" // reviewer sends back to preparer
  | "reopened"; // reviewer unlocks a filed period

export interface ReviewEvent {
  ts: string; // ISO timestamp (set client-side at action time)
  action: ReviewAction;
  by: string; // employee id
  note?: string;
  ref?: string; // ARN on filing
}

export interface FilingState {
  status: FilingStatus;
  preparedBy?: string;
  reviewedBy?: string;
  arn?: string; // acknowledgement reference number once filed
  filedOn?: string;
  trail: ReviewEvent[];
}

const EMPTY: FilingState = { status: "open", trail: [] };

const filingKey = (rk: ReturnKey, period: string) => `${rk}:${period}`;

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
const FILINGS_KEY = "nexa-tax-filings";
const ITC_KEY = "nexa-tax-itc";
const TDSP_KEY = "nexa-tax-tdsp";
const TDSR_KEY = "nexa-tax-tdsr";
const CASH_KEY = "nexa-tax-cash";

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

// ---- seed: everything up to & including Apr 2026 is already filed -----------
// Gives the demo a clear locked history vs an open current quarter, and makes
// the books-vs-return recon show a realistic "unfiled" gap for May/Jun 2026.
const SEED_FILED_THROUGH = "2026-04";

function seedFiling(rk: ReturnKey, period: string): FilingState {
  if (period <= SEED_FILED_THROUGH) {
    return {
      status: "filed",
      preparedBy: "emp-006",
      reviewedBy: "emp-002",
      arn: `AA${period.replace("-", "")}${rk === "gstr1" ? "1" : "3"}000${period.slice(5)}`,
      filedOn: `${period}-18`,
      trail: [
        { ts: `${period}-15T10:00:00`, action: "submitted", by: "emp-006", note: "Auto-prepared from books." },
        { ts: `${period}-18T16:30:00`, action: "approved", by: "emp-002", ref: "filed on portal" },
      ],
    };
  }
  return EMPTY;
}

export type FilingStore = Record<string, FilingState>;

export function loadFilings(): FilingStore {
  return read<FilingStore>(FILINGS_KEY, {});
}
export function saveFilings(s: FilingStore) {
  write(FILINGS_KEY, s);
}

/** Effective filing state = user override, else the seeded default. */
export function filingState(store: FilingStore, rk: ReturnKey, period: string): FilingState {
  return store[filingKey(rk, period)] ?? seedFiling(rk, period);
}

export function isLocked(store: FilingStore, rk: ReturnKey, period: string): boolean {
  return filingState(store, rk, period).status === "filed";
}

// ---- transitions (pure; caller persists the returned store) ----------------
function withEvent(state: FilingState, ev: ReviewEvent): FilingState {
  return { ...state, trail: [...state.trail, ev] };
}

export function submitForReview(
  store: FilingStore,
  rk: ReturnKey,
  period: string,
  by: string,
  now: string,
  note?: string,
): FilingStore {
  const cur = filingState(store, rk, period);
  if (cur.status !== "open") return store;
  const next = withEvent({ ...cur, status: "in_review", preparedBy: by }, { ts: now, action: "submitted", by, note });
  return { ...store, [filingKey(rk, period)]: next };
}

/** Segregation of duties: the reviewer who files must not be the preparer. */
export function canApprove(state: FilingState, by: string): boolean {
  return state.status === "in_review" && state.preparedBy !== by;
}

export function approveAndFile(
  store: FilingStore,
  rk: ReturnKey,
  period: string,
  by: string,
  now: string,
  arn: string,
): FilingStore {
  const cur = filingState(store, rk, period);
  if (cur.status !== "in_review") return store;
  // Maker-checker control: the preparer cannot approve their own return.
  if (cur.preparedBy === by) return store;
  const next = withEvent(
    { ...cur, status: "filed", reviewedBy: by, arn, filedOn: now.slice(0, 10) },
    { ts: now, action: "approved", by, ref: arn },
  );
  return { ...store, [filingKey(rk, period)]: next };
}

export function returnForRework(
  store: FilingStore,
  rk: ReturnKey,
  period: string,
  by: string,
  now: string,
  note: string,
): FilingStore {
  const cur = filingState(store, rk, period);
  if (cur.status !== "in_review") return store;
  const next = withEvent({ ...cur, status: "open" }, { ts: now, action: "returned", by, note });
  return { ...store, [filingKey(rk, period)]: next };
}

export function reopenFiled(
  store: FilingStore,
  rk: ReturnKey,
  period: string,
  by: string,
  now: string,
  note?: string,
): FilingStore {
  const cur = filingState(store, rk, period);
  if (cur.status !== "filed") return store;
  const next = withEvent({ ...cur, status: "open", arn: undefined, filedOn: undefined }, { ts: now, action: "reopened", by, note });
  return { ...store, [filingKey(rk, period)]: next };
}

// ---------------------------------------------------------------------------
// Per-document compliance flags
// ---------------------------------------------------------------------------
export interface ItcFlag {
  claimed: boolean;
  held: boolean;
}
export type ItcStore = Record<string, ItcFlag>;
export const loadItc = () => read<ItcStore>(ITC_KEY, {});
export const saveItc = (s: ItcStore) => write(ITC_KEY, s);

export interface TdsDeposit {
  deposited: boolean;
  challan?: string;
}
export type TdsPayableStore = Record<string, TdsDeposit>;
export const loadTdsPayable = () => read<TdsPayableStore>(TDSP_KEY, {});
export const saveTdsPayable = (s: TdsPayableStore) => write(TDSP_KEY, s);

export interface TdsCert {
  certified: boolean;
  certNo?: string;
}
export type TdsReceivableStore = Record<string, TdsCert>;
export const loadTdsReceivable = () => read<TdsReceivableStore>(TDSR_KEY, {});
export const saveTdsReceivable = (s: TdsReceivableStore) => write(TDSR_KEY, s);

// ---------------------------------------------------------------------------
// Electronic cash ledger (user deposits via challan; 3B settlements derived)
// ---------------------------------------------------------------------------
export interface CashDeposit {
  id: string;
  date: string;
  ref: string; // challan CIN
  igst: number;
  cgst: number;
  sgst: number;
}
export const loadCashDeposits = () => read<CashDeposit[]>(CASH_KEY, []);
export const saveCashDeposits = (d: CashDeposit[]) => write(CASH_KEY, d);

export const SEED_CASH: CashDeposit[] = [];

export function allCashDeposits(user: CashDeposit[]): CashDeposit[] {
  return [...SEED_CASH, ...user].sort((a, b) => a.date.localeCompare(b.date));
}
