// ---------------------------------------------------------------------------
// NEXA accounting domain model
// ---------------------------------------------------------------------------

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";

export type Basis = "accrual" | "cash";

// Cash-flow statement classification (indirect/direct method buckets).
export type CashFlowSection = "operating" | "investing" | "financing" | "none";

export interface Account {
  code: string; // e.g. "1100"
  name: string;
  type: AccountType;
  subtype: string; // grouping within a statement, e.g. "Current Assets"
  normal: "debit" | "credit";
  cashFlow: CashFlowSection;
  description?: string;
  isCash?: boolean; // bank / cash accounts — drive the cash ledger & cash flow
}

export interface Entity {
  id: string;
  name: string;
  legalName: string;
  currency: string; // functional currency code
  country: string;
  gstin?: string;
  /** Set on outlet / subsidiary entities; the parent is a rollup group. */
  parentId?: string;
}

export interface Location {
  id: string;
  entityId: string;
  name: string;
  city: string;
  state: string; // Indian state — drives multi-state reporting
  stateCode: string; // GST state code, e.g. "29"
}

// A single side of a double-entry posting, already resolved to base currency.
export interface Posting {
  id: string;
  eventId: string;
  date: string; // ISO date the line is recognised on
  accountCode: string;
  debit: number; // base currency (INR)
  credit: number;
  entityId: string;
  locationId: string;
  state: string;
  currency: string; // currency the event was originally transacted in
  basis: Basis; // which ledger this posting belongs to
  memo: string;
  category: string; // event category, for drill-down (e.g. "Sales", "Payroll")
}

// A business event is the source-of-truth; it expands into accrual + cash
// postings. Storing events (not just postings) keeps both bases consistent.
export interface BusinessEvent {
  id: string;
  category: string;
  memo: string;
  entityId: string;
  locationId: string;
  currency: string;
  amount: number; // base currency (INR), positive
  accrualDate: string; // when economically recognised (invoice/bill date)
  cashDate: string | null; // when cash actually moved (null = still open)
  // Accounts touched. The "income/expense" leg differs between bases only in
  // timing; the contra legs (AR/AP vs Cash) differ in account.
  kind:
    | "sale" // revenue: Dr AR / Cr Income  (cash: Dr Cash / Cr Income)
    | "purchase" // expense: Dr Expense / Cr AP (cash: Dr Expense / Cr Cash)
    | "payment_in" // settle AR: Dr Cash / Cr AR (accrual only; folded into sale for cash)
    | "payment_out" // settle AP: Dr AP / Cr Cash (accrual only; folded into purchase for cash)
    | "transfer" // balance-sheet only: Dr X / Cr Y (e.g. equity, loan, asset buy)
    ;
  incomeOrExpenseAccount: string; // P&L account for sale/purchase
  contraAccount: string; // AR for sale, AP for purchase, or the cash/other account
  cashAccount: string; // bank/cash account used when settled
  // For "transfer" events: explicit debit/credit accounts.
  debitAccount?: string;
  creditAccount?: string;
}

export interface ReportLine {
  code: string;
  label: string;
  type: AccountType;
  subtype: string;
  amount: number;
  level: number; // indentation depth for the statement tree
  isGroup: boolean;
  isTotal?: boolean;
}

export interface ReportFilters {
  entityId: string; // "all" or entity id
  locationId: string; // "all" or location id
  state: string; // "all" or state name
  basis: Basis;
  from: string; // ISO
  to: string; // ISO
}
