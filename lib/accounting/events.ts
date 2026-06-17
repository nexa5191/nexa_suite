import type { BusinessEvent } from "./types";
import { ENTITIES, LOCATIONS } from "./org";
import { MODULE_REVENUE_EVENTS } from "./revenue-bridge";

// Deterministic PRNG (mulberry32) so server and client render identical seed
// data — no Math.random / Date.now anywhere in the data layer.
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rnd = mulberry32(20240601);
const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
const between = (lo: number, hi: number) => Math.round(lo + rnd() * (hi - lo));

function iso(y: number, m: number, d: number) {
  return `${y}-${String(m).padStart(2, "0")}-${String(Math.min(d, 28)).padStart(2, "0")}`;
}

// Months covered: Apr 2024 → Jun 2026 — two full financial years (FY24-25 +
// FY25-26) plus the current year-to-date (FY26-27). 27 months in all.
const MONTHS: Array<[number, number]> = [];
for (let i = 0; i < 27; i++) {
  const m = ((3 + i) % 12) + 1;
  const y = 2024 + Math.floor((3 + i) / 12);
  MONTHS.push([y, m]);
}

const SALES_ACCOUNTS = ["4010", "4020"];
const EXPENSE_PURCHASE = ["5010", "5020", "6040", "6050", "6060", "6070"];

let counter = 0;
const id = () => `evt-${++counter}`;

const events: BusinessEvent[] = [];

// ---- Opening balances (1 Apr 2025) — equity, loan, fixed assets ----------
function opening(entityId: string, locationId: string, scale: number) {
  events.push({
    id: id(), kind: "transfer", category: "Capital", memo: "Share capital introduced",
    entityId, locationId, currency: "INR", amount: 5_000_000 * scale,
    accrualDate: iso(2024, 4, 1), cashDate: iso(2024, 4, 1),
    incomeOrExpenseAccount: "", contraAccount: "", cashAccount: "1020",
    debitAccount: "1020", creditAccount: "3010",
  });
  events.push({
    id: id(), kind: "transfer", category: "Financing", memo: "Term loan drawdown",
    entityId, locationId, currency: "INR", amount: 3_000_000 * scale,
    accrualDate: iso(2024, 4, 1), cashDate: iso(2024, 4, 1),
    incomeOrExpenseAccount: "", contraAccount: "", cashAccount: "1020",
    debitAccount: "1020", creditAccount: "2700",
  });
  events.push({
    id: id(), kind: "transfer", category: "Capex", memo: "Plant & equipment purchase",
    entityId, locationId, currency: "INR", amount: 4_200_000 * scale,
    accrualDate: iso(2024, 4, 2), cashDate: iso(2024, 4, 2),
    incomeOrExpenseAccount: "", contraAccount: "", cashAccount: "1020",
    debitAccount: "1500", creditAccount: "1020",
  });
}

for (const ent of ENTITIES) {
  const locs = LOCATIONS.filter((l) => l.entityId === ent.id);
  const scale = ent.id === "ent-nexa-global" ? 0.6 : ent.id === "ent-nexa-trade" ? 1.2 : 1;
  opening(ent.id, locs[0].id, scale);

  for (const [y, m] of MONTHS) {
    for (const loc of locs) {
      // ---- Sales (3–6 per month per location) ----
      const nSales = between(3, 6);
      for (let i = 0; i < nSales; i++) {
        const day = between(2, 27);
        const isExport = ent.id === "ent-nexa-global" || (loc.state !== "Karnataka" && rnd() < 0.15);
        const acct = isExport ? "4030" : pick(SALES_ACCOUNTS);
        const amount = between(40, 900) * 1000 * scale;
        // ~75% collected; collection lag 5–40 days.
        const collected = rnd() < 0.78;
        const lag = between(5, 40);
        const cd = collected ? iso(y, m, Math.min(28, day + lag > 28 ? 28 : day + lag)) : null;
        events.push({
          id: id(), kind: "sale", category: "Sales",
          memo: `${isExport ? "Export" : "Domestic"} sale — INV-${y}${String(m).padStart(2, "0")}-${100 + i}`,
          entityId: ent.id, locationId: loc.id, currency: isExport ? ent.currency : "INR",
          amount, accrualDate: iso(y, m, day), cashDate: cd,
          incomeOrExpenseAccount: acct, contraAccount: "1100",
          cashAccount: isExport && ent.id === "ent-nexa-global" ? "1020" : "1020",
        });
      }

      // ---- Purchases (2–4 per month) ----
      const nBuys = between(2, 4);
      for (let i = 0; i < nBuys; i++) {
        const day = between(2, 27);
        const acct = pick(EXPENSE_PURCHASE);
        const amount = between(20, 400) * 1000 * scale;
        const paid = rnd() < 0.82;
        const lag = between(3, 30);
        const cd = paid ? iso(y, m, day + lag > 28 ? 28 : day + lag) : null;
        events.push({
          id: id(), kind: "purchase", category: "Purchases",
          memo: `Vendor bill — BILL-${y}${String(m).padStart(2, "0")}-${200 + i}`,
          entityId: ent.id, locationId: loc.id, currency: "INR",
          amount, accrualDate: iso(y, m, day), cashDate: cd,
          incomeOrExpenseAccount: acct, contraAccount: "2010", cashAccount: "1020",
        });
      }
    }

    // ---- Monthly recurring (rent, salaries, utilities, software) ----
    const base = locs[0].id;
    const recur: Array<[string, string, number]> = [
      ["6010", "Payroll run", 320_000 * scale],
      ["6020", "Office & plant rent", 110_000 * scale],
      ["6030", "Electricity & water", 48_000 * scale],
      ["6060", "SaaS subscriptions", 26_000 * scale],
    ];
    for (const [acct, memo, amt] of recur) {
      // Salaries accrue month-end, paid 5th of next month (creates a payable).
      const isPayroll = acct === "6010";
      const accrualD = iso(y, m, 28);
      const nm = m === 12 ? 1 : m + 1;
      const ny = m === 12 ? y + 1 : y;
      const cashD = isPayroll ? iso(ny, nm, 5) : iso(y, m, 26);
      events.push({
        id: id(), kind: "purchase", category: isPayroll ? "Payroll" : "Overheads",
        memo, entityId: ent.id, locationId: base, currency: "INR", amount: amt,
        accrualDate: accrualD, cashDate: cashD,
        incomeOrExpenseAccount: acct, contraAccount: isPayroll ? "2300" : "2010",
        cashAccount: "1020",
      });
    }

    // ---- Loan-licence job-work & third-party FG purchases (manufacturing
    // entities only) — surface as Cost of Sales in P&L, cost audit & reports.
    if (ent.id !== "ent-nexa-global") {
      const day = 12;
      const llPaid = iso(y, m, 22);
      events.push({
        id: id(), kind: "purchase", category: "Loan Licence",
        memo: "Loan-licence job-work — Sunraj Oil Mills",
        entityId: ent.id, locationId: base, currency: "INR", amount: 90_000 * scale,
        accrualDate: iso(y, m, day), cashDate: llPaid,
        incomeOrExpenseAccount: "5040", contraAccount: "2010", cashAccount: "1020",
      });
      events.push({
        id: id(), kind: "purchase", category: "Third-party Purchase",
        memo: "Third-party FG purchase — Annapurna Rice",
        entityId: ent.id, locationId: base, currency: "INR", amount: 160_000 * scale,
        accrualDate: iso(y, m, day), cashDate: iso(y, m, 24),
        incomeOrExpenseAccount: "5050", contraAccount: "2010", cashAccount: "1020",
      });
    }

    // ---- Monthly depreciation (non-cash; accrual basis only) ----
    events.push({
      id: id(), kind: "transfer", category: "Depreciation", memo: "Monthly depreciation",
      entityId: ent.id, locationId: base, currency: "INR", amount: 35_000 * scale,
      accrualDate: iso(y, m, 28), cashDate: null,
      incomeOrExpenseAccount: "", contraAccount: "", cashAccount: "",
      debitAccount: "6080", creditAccount: "1590",
    });
  }
}

// The generated backbone above (opening balances, wholesale sales, purchases,
// payroll, overheads, depreciation) plus revenue derived from the operational
// modules — Orders, Invoicing and Professional-services billing — so those
// modules show up in the P&L, Balance Sheet, Cash Flow, General Ledger and GST
// returns instead of living in a parallel universe. See revenue-bridge.ts.
export const BUSINESS_EVENTS: BusinessEvent[] = events.concat(MODULE_REVENUE_EVENTS);

// GST applies to domestic India flows only.
export function gstRateFor(ev: BusinessEvent): number {
  if (ev.kind === "transfer") return 0;
  if (ev.incomeOrExpenseAccount === "4030") return 0; // exports zero-rated
  if (ev.entityId === "ent-nexa-global") return 0;
  return 0.18;
}
