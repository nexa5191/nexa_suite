"use client";

import * as React from "react";
import { useJournal } from "@/components/accounting/journal-provider";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { PageHeader } from "@/components/shell/page-header";
import { buildPnL, buildBalanceSheet } from "@/lib/accounting/reports";
import { cumulativeBalance } from "@/lib/accounting/ledger";
import { loadChartOfAccounts } from "@/lib/accounting/chart-of-accounts";
import type { ReportFilters } from "@/lib/accounting/types";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { Printer } from "lucide-react";

const FY_OPTIONS = [
  { label: "FY 2025-26 (Actual)", from: "2025-04-01", to: "2026-03-31" },
  { label: "FY 2024-25 (Actual)", from: "2024-04-01", to: "2025-03-31" },
  { label: "FY 2026-27 (Projected)", from: "2026-04-01", to: "2027-03-31" },
] as const;

const TABS = [
  "Form II — Operating Statement",
  "Form III — Balance Sheet",
  "Form IV/V — Working Capital & MPBF",
] as const;
type Tab = (typeof TABS)[number];

// ---------------------------------------------------------------------------
// Table primitives
// ---------------------------------------------------------------------------

function THead({ children }: { children: React.ReactNode }) {
  return (
    <tr className="bg-muted/40">
      <td
        colSpan={3}
        className="py-1.5 pl-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
      >
        {children}
      </td>
    </tr>
  );
}

function TRow({
  label,
  value,
  note,
  indent = 0,
  bold = false,
  topBorder = false,
}: {
  label: string;
  value?: number;
  note?: string;
  indent?: 0 | 1 | 2;
  bold?: boolean;
  topBorder?: boolean;
}) {
  return (
    <tr className={cn(topBorder && "border-t border-border", bold && "bg-muted/20")}>
      <td
        className={cn(
          "py-1 pr-4 text-sm",
          indent === 1 && "pl-5",
          indent === 2 && "pl-9",
          bold && "font-semibold",
        )}
      >
        {label}
      </td>
      <td className={cn("py-1 text-right text-sm tabular-nums w-36", bold && "font-semibold")}>
        {value !== undefined && <Money value={value} compact />}
      </td>
      <td className="py-1 pl-3 text-xs text-muted-foreground w-40">{note ?? ""}</td>
    </tr>
  );
}

function TableWrap({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b bg-muted/30">
        <h2 className="font-semibold">{title}</h2>
        {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="p-4 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b">
              <th className="text-left py-1.5 text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                Particulars
              </th>
              <th className="text-right py-1.5 text-xs font-semibold uppercase text-muted-foreground tracking-wide w-36">
                Amount (₹)
              </th>
              <th className="py-1.5 w-40" />
            </tr>
          </thead>
          <tbody>{children}</tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function CmaClient() {
  // version subscription → re-renders when journal entries are posted
  const { version: _v } = useJournal();
  const prefs = usePrefs();
  const [fyIdx, setFyIdx] = React.useState(0);
  const [tab, setTab] = React.useState<Tab>(TABS[0]);

  const fy = FY_OPTIONS[fyIdx];
  const filters: ReportFilters = {
    entityId: prefs.entityId,
    locationId: prefs.locationId,
    state: prefs.state,
    basis: "accrual",
    from: fy.from,
    to: fy.to,
  };

  const pnl = buildPnL(filters);
  const bs = buildBalanceSheet(filters);
  const bal = cumulativeBalance(filters, fy.to);

  // ---- Current Assets ---------------------------------------------------
  const cashAmt = loadChartOfAccounts().filter((a) => a.isCash).reduce(
    (s, a) => s + (bal.get(a.code) ?? 0),
    0,
  );
  const ar = bal.get("1100") ?? 0;
  const inventory = bal.get("1200") ?? 0;
  const gstItc = bal.get("1300") ?? 0;
  const tdsr = bal.get("1310") ?? 0;
  const prepaid = bal.get("1400") ?? 0;
  const totalCA = cashAmt + ar + inventory + gstItc + tdsr + prepaid;

  // ---- Current Liabilities ----------------------------------------------
  const ap = -(bal.get("2010") ?? 0);
  const grni = -(bal.get("2015") ?? 0);
  const gstOut = -(bal.get("2100") ?? 0);
  const tdsPay = -(bal.get("2200") ?? 0);
  const salPay = -(bal.get("2300") ?? 0);
  const unearnedRev = -(bal.get("2400") ?? 0);
  const totalCL = ap + grni + gstOut + tdsPay + salPay + unearnedRev;

  const nwc = totalCA - totalCL;
  const currentRatio = totalCL > 0 ? totalCA / totalCL : 0;

  // ---- Long-term / Equity -----------------------------------------------
  const ltLoan = -(bal.get("2700") ?? 0);
  const shareCapital = -(bal.get("3010") ?? 0);
  const totalEquity = shareCapital + bs.retainedEarnings;

  // ---- Fixed Assets (net block) ----------------------------------------
  const fa1500 = bal.get("1500") ?? 0;
  const fa1510 = bal.get("1510") ?? 0;
  const accumDepr = bal.get("1590") ?? 0; // credit-normal → stored as negative debit balance
  const netFA = fa1500 + fa1510 + accumDepr;

  // ---- MPBF (Tandon Method 2) ------------------------------------------
  const mpbf = Math.max(0, 0.75 * nwc);

  // ---- KPI strip values ------------------------------------------------
  const kpis = [
    { label: "Net Revenue", value: pnl.totalRevenue },
    { label: "EBIT", value: pnl.operatingProfit },
    { label: "Net Profit (PAT)", value: pnl.netProfit },
    { label: "Net Working Capital", value: nwc },
    { label: "MPBF (Method 2)", value: mpbf },
    { label: "Current Ratio", raw: currentRatio.toFixed(2) + "x" },
  ];

  return (
    <>
      <PageHeader
        title="CMA Data / Lender Package"
        subtitle={`Credit Monitoring Arrangement — ${fy.label}. Standard format for working-capital loan assessment.`}
        actions={
          <div className="flex items-center gap-2">
            <select
              value={fyIdx}
              onChange={(e) => setFyIdx(+e.target.value)}
              className="rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {FY_OPTIONS.map((o, i) => (
                <option key={o.label} value={i}>
                  {o.label}
                </option>
              ))}
            </select>
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-md border border-input bg-background px-3 py-1.5 text-sm shadow-sm hover:bg-accent transition-colors"
            >
              <Printer className="size-4" />
              Print / PDF
            </button>
          </div>
        }
      />

      {/* Summary KPI strip */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-lg border bg-card px-4 py-2.5 shadow-sm">
            <p className="text-xs font-medium text-muted-foreground">{k.label}</p>
            {"raw" in k ? (
              <p className="mt-0.5 text-lg font-bold leading-tight">{k.raw}</p>
            ) : (
              <p
                className={cn(
                  "mt-0.5 text-lg font-bold leading-tight",
                  (k.value ?? 0) < 0 && "text-destructive",
                )}
              >
                <Money value={k.value ?? 0} compact />
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Tab bar */}
      <div className="mb-4 flex gap-0 border-b">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Form II — Operating Statement                                        */}
      {/* ------------------------------------------------------------------ */}
      {tab === "Form II — Operating Statement" && (
        <TableWrap
          title="Form II — Operating Statement"
          subtitle={`${fy.label} · Accrual basis · figures in ₹`}
        >
          <THead>A. Revenue from Operations</THead>
          {pnl.revenue.flatMap((s) => s.rows).map((r) => (
            <TRow key={r.code} label={r.name} value={r.amount} indent={1} />
          ))}
          <TRow label="Total Revenue from Operations" value={pnl.totalRevenue} bold topBorder />

          {pnl.totalOtherIncome > 0 && (
            <>
              <THead>A2. Other Income</THead>
              {pnl.otherIncome.flatMap((s) => s.rows).map((r) => (
                <TRow key={r.code} label={r.name} value={r.amount} indent={1} />
              ))}
              <TRow label="Total Other Income" value={pnl.totalOtherIncome} bold topBorder />
            </>
          )}

          <THead>B. Cost of Goods Sold / Cost of Production</THead>
          {pnl.cogs.flatMap((s) => s.rows).map((r) => (
            <TRow key={r.code} label={r.name} value={r.amount} indent={1} />
          ))}
          <TRow label="Total Cost of Goods Sold (B)" value={pnl.totalCogs} bold topBorder />

          <THead>C. Gross Profit (A – B)</THead>
          <TRow
            label="Gross Profit"
            value={pnl.grossProfit}
            note={`GP Margin: ${(pnl.grossMargin * 100).toFixed(1)}%`}
            bold
          />

          <THead>D. Operating Expenses (SG&A)</THead>
          {pnl.opex.flatMap((s) => s.rows).map((r) => (
            <TRow key={r.code} label={r.name} value={r.amount} indent={1} />
          ))}
          <TRow label="Total Operating Expenses (D)" value={pnl.totalOpex} bold topBorder />

          <THead>E. Operating Profit / EBIT (C – D)</THead>
          <TRow label="EBIT (Earnings before Interest & Tax)" value={pnl.operatingProfit} bold />

          {pnl.totalFinance > 0 && (
            <>
              <THead>F. Finance / Interest Costs</THead>
              {pnl.finance.flatMap((s) => s.rows).map((r) => (
                <TRow key={r.code} label={r.name} value={r.amount} indent={1} />
              ))}
              <TRow label="Total Finance Costs (F)" value={pnl.totalFinance} bold topBorder />
            </>
          )}

          <THead>G. Profit Before Tax / PAT (E – F)</THead>
          <TRow
            label="Net Profit (PAT — excl. tax provision)"
            value={pnl.netProfit}
            note={`Net Margin: ${(pnl.netMargin * 100).toFixed(1)}%`}
            bold
          />
          {pnl.totalFinance > 0 && (
            <TRow
              label="Interest Coverage Ratio (EBIT / Finance Cost)"
              note={`${(pnl.operatingProfit / pnl.totalFinance).toFixed(2)}x`}
              indent={1}
            />
          )}
        </TableWrap>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Form III — Balance Sheet                                             */}
      {/* ------------------------------------------------------------------ */}
      {tab === "Form III — Balance Sheet" && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <TableWrap
            title="Form III-A — Sources of Funds"
            subtitle={`As at ${fy.to}`}
          >
            <THead>A. Owned Funds (Net Worth)</THead>
            <TRow label="Share Capital" value={shareCapital} indent={1} />
            <TRow label="Retained Earnings / Reserves" value={bs.retainedEarnings} indent={1} />
            <TRow label="Total Net Worth (A)" value={totalEquity} bold topBorder />

            <THead>B. Borrowed Funds</THead>
            <TRow label="Long-term Loan" value={ltLoan} indent={1} />
            <TRow
              label="Short-term Bank Borrowings (WC)"
              value={0}
              indent={1}
              note="Nil per books"
            />
            <TRow label="Total Borrowings (B)" value={ltLoan} bold topBorder />

            <THead>Total (A + B)</THead>
            <TRow label="Total Capital Employed" value={totalEquity + ltLoan} bold />
            {totalEquity > 0 && (
              <TRow
                label="Total Outside Liabilities / TNW (TOL/TNW)"
                note={`${((ltLoan + totalCL) / totalEquity).toFixed(2)}x`}
                indent={1}
              />
            )}
          </TableWrap>

          <TableWrap
            title="Form III-B — Application of Funds"
            subtitle={`As at ${fy.to}`}
          >
            <THead>C. Fixed Assets (Net Block)</THead>
            <TRow label="Plant & Equipment" value={fa1500} indent={1} />
            <TRow label="Furniture & Fixtures" value={fa1510} indent={1} />
            <TRow label="Less: Accumulated Depreciation" value={accumDepr} indent={1} />
            <TRow label="Net Fixed Assets (C)" value={netFA} bold topBorder />

            <THead>D. Net Working Capital</THead>
            <TRow label="Current Assets" value={totalCA} indent={1} />
            <TRow label="Less: Current Liabilities" value={-totalCL} indent={1} />
            <TRow label="Net Working Capital (D)" value={nwc} bold topBorder />

            <THead>Total (C + D)</THead>
            <TRow label="Total Assets Deployed" value={netFA + nwc} bold />
            <TRow
              label="Balance-Sheet Check (Assets – Liab & Equity)"
              note={`${bs.check < 0.5 ? "✓ Balanced" : "⚠ Gap: ₹" + bs.check.toFixed(0)}`}
              indent={1}
            />
          </TableWrap>
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* Form IV/V — Working Capital & MPBF                                  */}
      {/* ------------------------------------------------------------------ */}
      {tab === "Form IV/V — Working Capital & MPBF" && (
        <div className="space-y-4">
          <TableWrap
            title="Form IV — Current Assets & Current Liabilities"
            subtitle={`As at ${fy.to} · Accrual basis`}
          >
            <THead>Current Assets (A)</THead>
            <TRow label="Cash & Bank Balances" value={cashAmt} indent={1} />
            <TRow label="Accounts Receivable (Trade Debtors)" value={ar} indent={1} />
            <TRow label="Inventories (Raw Material, WIP, FG)" value={inventory} indent={1} />
            <TRow label="GST Input Tax Credit (ITC)" value={gstItc} indent={1} />
            <TRow label="TDS Receivable" value={tdsr} indent={1} />
            <TRow label="Prepaid Expenses & Advances" value={prepaid} indent={1} />
            <TRow
              label="Total Current Assets (A)"
              value={totalCA}
              bold
              topBorder
              note={totalCA > 0 ? `${((ar / totalCA) * 100).toFixed(0)}% receivables` : undefined}
            />

            <THead>Current Liabilities (B) — Excluding Bank Finance</THead>
            <TRow label="Accounts Payable (Trade Creditors)" value={ap} indent={1} />
            <TRow label="GRNI (Goods Received Not Invoiced)" value={grni} indent={1} />
            <TRow label="GST Output Payable" value={gstOut} indent={1} />
            <TRow label="TDS / Statutory Payable" value={tdsPay} indent={1} />
            <TRow label="Salaries & Employee Payable" value={salPay} indent={1} />
            <TRow label="Advance from Customers (Unearned Revenue)" value={unearnedRev} indent={1} />
            <TRow label="Total Current Liabilities (B)" value={totalCL} bold topBorder />

            <THead>Working Capital Summary</THead>
            <TRow label="Net Working Capital (NWC = A – B)" value={nwc} bold />
            <TRow
              label="Current Ratio (A / B)"
              note={
                totalCL > 0
                  ? `${currentRatio.toFixed(2)}x  (RBI norm: ≥ 1.33)`
                  : "No current liabilities"
              }
              indent={1}
            />
            <TRow
              label="Quick Ratio ((Cash + AR) / CL)"
              note={
                totalCL > 0
                  ? `${((cashAmt + ar) / totalCL).toFixed(2)}x`
                  : "N/A"
              }
              indent={1}
            />
          </TableWrap>

          <TableWrap
            title="Form V — Maximum Permissible Bank Finance (MPBF)"
            subtitle="Tandon Committee Norms — as adopted by RBI"
          >
            <THead>Method 2 (RBI Preferred — Working Capital Gap Approach)</THead>
            <TRow
              label="Step 1: Total Current Assets (A)"
              value={totalCA}
              indent={1}
            />
            <TRow
              label="Step 2: Less — Current Liabilities other than bank borrowings (B)"
              value={totalCL}
              indent={1}
            />
            <TRow
              label="Step 3: Net Current Assets / Working Capital Gap (A – B)"
              value={nwc}
              bold
              topBorder
            />
            <TRow
              label="Step 4: 75% of Net Current Assets"
              value={0.75 * nwc}
              indent={1}
              bold
            />
            <TRow
              label="Step 5: Less — Existing Bank Finance in WC"
              value={0}
              indent={1}
              note="Nil per books"
            />
            <TRow
              label="MPBF — Method 2"
              value={mpbf}
              bold
              topBorder
              note="Recommended WC loan limit"
            />

            <THead>Method 1 (Alternative — 25% of WCR)</THead>
            <TRow
              label="25% of Total Current Assets (Working Capital Requirement)"
              value={0.25 * totalCA}
              indent={1}
              bold
            />
            <TRow
              label="MPBF — Method 1"
              value={0.25 * totalCA}
              bold
              topBorder
            />

            <THead>Key Financial Ratios for Banker</THead>
            <TRow
              label="Current Ratio"
              note={`${currentRatio.toFixed(2)}x  (norm: ≥ 1.33)`}
            />
            <TRow
              label="Debt-Equity Ratio (LTL / Net Worth)"
              note={totalEquity > 0 ? `${(ltLoan / Math.max(totalEquity, 1)).toFixed(2)}x` : "—"}
            />
            <TRow
              label="Interest Coverage Ratio (EBIT / Finance Cost)"
              note={
                pnl.totalFinance > 0
                  ? `${(pnl.operatingProfit / pnl.totalFinance).toFixed(2)}x`
                  : "No interest charges"
              }
            />
            <TRow
              label="TOL / TNW (Total Outside Liabilities / Tangible Net Worth)"
              note={
                totalEquity > 0
                  ? `${((ltLoan + totalCL) / Math.max(totalEquity, 1)).toFixed(2)}x  (norm: ≤ 3)`
                  : "—"
              }
            />
            <TRow
              label="Gross Profit Margin"
              note={`${(pnl.grossMargin * 100).toFixed(1)}%`}
            />
            <TRow label="Net Profit Margin" note={`${(pnl.netMargin * 100).toFixed(1)}%`} />
          </TableWrap>
        </div>
      )}
    </>
  );
}
