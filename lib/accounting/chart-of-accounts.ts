import type { Account } from "./types";

// A compact but realistic chart of accounts. `subtype` controls grouping on the
// statements; `cashFlow` classifies balance-sheet movements for the cash-flow
// statement (indirect method). `isCash` marks the accounts that ARE cash.

export const CHART_OF_ACCOUNTS: Account[] = [
  // ---- Assets ----------------------------------------------------------
  { code: "1010", name: "Cash on Hand", type: "asset", subtype: "Cash & Bank", normal: "debit", cashFlow: "none", isCash: true },
  { code: "1015", name: "Petty Cash", type: "asset", subtype: "Cash & Bank", normal: "debit", cashFlow: "none", isCash: true, description: "Imprest float for small day-to-day expenses" },
  { code: "1020", name: "Bank — Current Account", type: "asset", subtype: "Cash & Bank", normal: "debit", cashFlow: "none", isCash: true },
  { code: "1030", name: "Bank — EEFC (Forex)", type: "asset", subtype: "Cash & Bank", normal: "debit", cashFlow: "none", isCash: true },
  { code: "1100", name: "Accounts Receivable", type: "asset", subtype: "Current Assets", normal: "debit", cashFlow: "operating" },
  { code: "1200", name: "Inventory", type: "asset", subtype: "Current Assets", normal: "debit", cashFlow: "operating" },
  { code: "1300", name: "GST Input Credit", type: "asset", subtype: "Current Assets", normal: "debit", cashFlow: "operating" },
  { code: "1310", name: "TDS Receivable", type: "asset", subtype: "Current Assets", normal: "debit", cashFlow: "operating", description: "TDS withheld by customers (Form 16A) — knocked off on certificate" },
  { code: "1320", name: "Inter-company Receivable", type: "asset", subtype: "Current Assets", normal: "debit", cashFlow: "operating", description: "Amounts owed by group entities — eliminates on consolidation" },
  { code: "1400", name: "Prepaid Expenses", type: "asset", subtype: "Current Assets", normal: "debit", cashFlow: "operating" },
  { code: "1500", name: "Plant & Equipment", type: "asset", subtype: "Fixed Assets", normal: "debit", cashFlow: "investing" },
  { code: "1510", name: "Furniture & Fixtures", type: "asset", subtype: "Fixed Assets", normal: "debit", cashFlow: "investing" },
  { code: "1590", name: "Accumulated Depreciation", type: "asset", subtype: "Fixed Assets", normal: "credit", cashFlow: "operating" },

  // ---- Liabilities -----------------------------------------------------
  { code: "2010", name: "Accounts Payable", type: "liability", subtype: "Current Liabilities", normal: "credit", cashFlow: "operating" },
  { code: "2015", name: "Goods Received Not Invoiced (GRNI)", type: "liability", subtype: "Current Liabilities", normal: "credit", cashFlow: "operating", description: "3-way-match clearing — goods receipted (GRN) but the vendor bill is not yet booked" },
  { code: "2020", name: "Inter-company Payable", type: "liability", subtype: "Current Liabilities", normal: "credit", cashFlow: "operating", description: "Amounts owed to group entities — eliminates on consolidation" },
  { code: "2100", name: "GST Output Payable", type: "liability", subtype: "Current Liabilities", normal: "credit", cashFlow: "operating" },
  { code: "2200", name: "TDS Payable", type: "liability", subtype: "Current Liabilities", normal: "credit", cashFlow: "operating" },
  { code: "2300", name: "Salaries Payable", type: "liability", subtype: "Current Liabilities", normal: "credit", cashFlow: "operating" },
  { code: "2310", name: "Employee Reimbursements Payable", type: "liability", subtype: "Current Liabilities", normal: "credit", cashFlow: "operating", description: "Approved staff expense claims awaiting payout" },
  { code: "2400", name: "Unearned Revenue", type: "liability", subtype: "Current Liabilities", normal: "credit", cashFlow: "operating" },
  { code: "2700", name: "Long-term Loan", type: "liability", subtype: "Non-current Liabilities", normal: "credit", cashFlow: "financing" },

  // ---- Equity ----------------------------------------------------------
  { code: "3010", name: "Share Capital", type: "equity", subtype: "Equity", normal: "credit", cashFlow: "financing" },
  { code: "3100", name: "Retained Earnings", type: "equity", subtype: "Equity", normal: "credit", cashFlow: "none" },
  { code: "3200", name: "Owner Drawings", type: "equity", subtype: "Equity", normal: "debit", cashFlow: "financing" },

  // ---- Income ----------------------------------------------------------
  { code: "4010", name: "Product Sales", type: "income", subtype: "Revenue", normal: "credit", cashFlow: "none" },
  { code: "4020", name: "Service Revenue", type: "income", subtype: "Revenue", normal: "credit", cashFlow: "none" },
  { code: "4030", name: "Export Sales", type: "income", subtype: "Revenue", normal: "credit", cashFlow: "none" },
  { code: "4040", name: "Sales Returns & Allowances", type: "income", subtype: "Revenue", normal: "debit", cashFlow: "none", description: "Contra-revenue — reduces sales (credit notes)" },
  { code: "4900", name: "Other Income", type: "income", subtype: "Other Income", normal: "credit", cashFlow: "none" },

  // ---- Cost of goods sold ---------------------------------------------
  { code: "5010", name: "Cost of Goods Sold", type: "expense", subtype: "Cost of Sales", normal: "debit", cashFlow: "none" },
  { code: "5020", name: "Freight Inward", type: "expense", subtype: "Cost of Sales", normal: "debit", cashFlow: "none" },
  { code: "5030", name: "Purchase Returns", type: "expense", subtype: "Cost of Sales", normal: "credit", cashFlow: "none", description: "Contra-expense — reduces purchases (debit notes)" },
  { code: "5040", name: "Loan Licence / Job-work Charges", type: "expense", subtype: "Cost of Sales", normal: "debit", cashFlow: "none", description: "Conversion charges paid to loan-licence manufacturers" },
  { code: "5050", name: "Third-party FG Purchases", type: "expense", subtype: "Cost of Sales", normal: "debit", cashFlow: "none", description: "Finished goods bought from contract manufacturers" },

  // ---- Operating expenses ---------------------------------------------
  { code: "6010", name: "Salaries & Wages", type: "expense", subtype: "Operating Expenses", normal: "debit", cashFlow: "none" },
  { code: "6020", name: "Rent", type: "expense", subtype: "Operating Expenses", normal: "debit", cashFlow: "none" },
  { code: "6030", name: "Utilities", type: "expense", subtype: "Operating Expenses", normal: "debit", cashFlow: "none" },
  { code: "6035", name: "Office & Admin Expenses", type: "expense", subtype: "Operating Expenses", normal: "debit", cashFlow: "none", description: "Printing, stationery, postage, refreshments & sundries" },
  { code: "6040", name: "Marketing & Advertising", type: "expense", subtype: "Operating Expenses", normal: "debit", cashFlow: "none" },
  { code: "6050", name: "Professional Fees", type: "expense", subtype: "Operating Expenses", normal: "debit", cashFlow: "none" },
  { code: "6060", name: "Software & Subscriptions", type: "expense", subtype: "Operating Expenses", normal: "debit", cashFlow: "none" },
  { code: "6070", name: "Travel & Conveyance", type: "expense", subtype: "Operating Expenses", normal: "debit", cashFlow: "none" },
  { code: "6080", name: "Depreciation", type: "expense", subtype: "Operating Expenses", normal: "debit", cashFlow: "none" },
  { code: "6900", name: "Bank Charges & Interest", type: "expense", subtype: "Finance Costs", normal: "debit", cashFlow: "none" },
];

const COA_KEY = "nexa-chart-of-accounts";
export function loadChartOfAccounts(): Account[] {
  if (typeof window === "undefined") return CHART_OF_ACCOUNTS;
  try {
    const r = localStorage.getItem(COA_KEY);
    const p = r ? JSON.parse(r) as Account[] : null;
    if (Array.isArray(p) && p.length) return p;
  } catch { /* ignore */ }
  return CHART_OF_ACCOUNTS;
}

const BY_CODE = new Map(CHART_OF_ACCOUNTS.map((a) => [a.code, a]));

export function account(code: string): Account {
  const a = BY_CODE.get(code);
  if (!a) throw new Error(`Unknown account code: ${code}`);
  return a;
}

export function accountSafe(code: string): Account | undefined {
  return BY_CODE.get(code);
}

// Statement ordering helpers.
export const TYPE_ORDER: Record<string, number> = {
  asset: 0,
  liability: 1,
  equity: 2,
  income: 3,
  expense: 4,
};

export const SUBTYPE_ORDER = [
  "Cash & Bank",
  "Current Assets",
  "Fixed Assets",
  "Current Liabilities",
  "Non-current Liabilities",
  "Equity",
  "Revenue",
  "Other Income",
  "Cost of Sales",
  "Operating Expenses",
  "Finance Costs",
];
