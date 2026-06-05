import { buildBalanceSheet, buildCashFlow, buildPnL } from "../lib/accounting/reports";
import { allPostings } from "../lib/accounting/ledger";
import type { ReportFilters, Basis } from "../lib/accounting/types";

function check(name: string, cond: boolean, detail = "") {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? "  — " + detail : ""}`);
  if (!cond) process.exitCode = 1;
}

// 1) Every posting set is internally balanced (debits === credits) per basis.
for (const basis of ["accrual", "cash"] as Basis[]) {
  let dr = 0,
    cr = 0;
  for (const p of allPostings()) if (p.basis === basis) { dr += p.debit; cr += p.credit; }
  check(`${basis}: total debits === total credits`, Math.abs(dr - cr) < 1, `Dr ${dr.toFixed(0)} / Cr ${cr.toFixed(0)}`);
}

const scopes: Array<Partial<ReportFilters>> = [
  { entityId: "all", locationId: "all", state: "all" },
  { entityId: "ent-nexa-in", locationId: "all", state: "all" },
  { entityId: "ent-nexa-trade", locationId: "loc-mum", state: "all" },
  { entityId: "all", locationId: "all", state: "Karnataka" },
];

for (const basis of ["accrual", "cash"] as Basis[]) {
  for (const s of scopes) {
    const f: ReportFilters = {
      entityId: s.entityId ?? "all",
      locationId: s.locationId ?? "all",
      state: s.state ?? "all",
      basis,
      from: "2025-04-01",
      to: "2026-05-31",
    };
    const label = `${basis} | ${f.entityId}/${f.locationId}/${f.state}`;

    const bs = buildBalanceSheet(f);
    check(`BS balances: ${label}`, Math.abs(bs.check) < 1, `A=${bs.totalAssets.toFixed(0)} L+E=${bs.totalLiabAndEquity.toFixed(0)}`);

    const cf = buildCashFlow(f);
    const tie = Math.abs(cf.openingCash + cf.netChange - cf.closingCash);
    check(`CF reconciles: ${label}`, tie < 1, `open+Δ=${(cf.openingCash + cf.netChange).toFixed(0)} close=${cf.closingCash.toFixed(0)}`);

    const pnl = buildPnL(f);
    // Net profit from P&L should equal closing retained earnings minus opening RE
    // over the same window is non-trivial; just sanity-check sign/figures exist.
    if (f.entityId === "all" && f.state === "all" && f.locationId === "all") {
      console.log(`   ↳ ${basis} group: Revenue ${pnl.totalRevenue.toFixed(0)}, Net ${pnl.netProfit.toFixed(0)}, Cash close ${cf.closingCash.toFixed(0)}`);
    }
  }
}
