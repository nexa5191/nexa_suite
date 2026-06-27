// ---------------------------------------------------------------------------
// TCS — Tax Collected at Source (Chapter XVII-BB, Income Tax Act 1961)
//
// Sellers of specified goods/services collect tax at source from buyers at the
// time of receipt of payment or debiting the buyer's account, whichever is
// earlier. Remittance by 7th of following month; quarterly return in Form 27EQ.
// ---------------------------------------------------------------------------

export interface TcsSection {
  section: string;
  nature: string;
  rateResident: number;   // % for resident buyers with PAN
  rateNoPan: number;      // % for buyers without PAN (higher)
  threshold: number;       // annual threshold (0 = no threshold)
}

export const TCS_SECTIONS: TcsSection[] = [
  { section: "206C(1)", nature: "Alcoholic liquor for human consumption", rateResident: 1, rateNoPan: 2, threshold: 0 },
  { section: "206C(1)", nature: "Timber obtained under forest lease", rateResident: 2.5, rateNoPan: 5, threshold: 0 },
  { section: "206C(1)", nature: "Any other forest produce", rateResident: 2.5, rateNoPan: 5, threshold: 0 },
  { section: "206C(1)", nature: "Scrap", rateResident: 1, rateNoPan: 2, threshold: 0 },
  { section: "206C(1)", nature: "Minerals — coal/iron ore/lignite", rateResident: 1, rateNoPan: 2, threshold: 0 },
  { section: "206C(1C)", nature: "Parking lot / toll plaza / mining / quarrying lease", rateResident: 2, rateNoPan: 4, threshold: 0 },
  { section: "206C(1F)", nature: "Motor vehicle sale > ₹10 lakh", rateResident: 1, rateNoPan: 2, threshold: 1000000 },
  { section: "206C(1G)", nature: "Foreign remittance — LRS > ₹7 lakh", rateResident: 20, rateNoPan: 20, threshold: 700000 },
  { section: "206C(1G)", nature: "Overseas tour package", rateResident: 20, rateNoPan: 20, threshold: 0 },
  { section: "206C(1H)", nature: "Sale of goods > ₹50 lakh (turnover > ₹10 cr)", rateResident: 0.1, rateNoPan: 1, threshold: 5000000 },
];

export interface TcsTransaction {
  id: string;
  date: string;
  period: string;       // YYYY-MM
  section: string;
  nature: string;
  buyerName: string;
  buyerPan: string;     // "" → no PAN
  saleValue: number;
  tcsRate: number;
  tcsAmount: number;
  collected: boolean;
  remitted: boolean;
  challanNo?: string;
}

// Deterministic seed data — 3 months of representative TCS collections.
function makeId(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  return `tcs-${Math.abs(h).toString(16).slice(0, 8)}`;
}

const BUYERS: { name: string; pan: string }[] = [];

function seedTxn(idx: number, month: string, section: TcsSection, buyer: typeof BUYERS[0], saleValue: number): TcsTransaction {
  const hasPan = !!buyer.pan;
  const rate = hasPan ? section.rateResident : section.rateNoPan;
  const tcs = Math.round((saleValue * rate) / 100);
  const filed = month <= "2026-04";
  return {
    id: makeId(`${idx}-${month}-${section.section}`),
    date: `${month}-${String(10 + (idx % 15)).padStart(2, "0")}`,
    period: month,
    section: section.section,
    nature: section.nature,
    buyerName: buyer.name,
    buyerPan: buyer.pan,
    saleValue,
    tcsRate: rate,
    tcsAmount: tcs,
    collected: true,
    remitted: filed,
    challanNo: filed ? `OLTAS${month.replace("-", "")}${idx.toString().padStart(4, "0")}` : undefined,
  };
}

export const TCS_TRANSACTIONS: TcsTransaction[] = [];

export interface TcsSummary {
  period: string;
  totalSales: number;
  totalTcs: number;
  remitted: number;
  pending: number;
  txnCount: number;
}

export function tcsSummaryByPeriod(): TcsSummary[] {
  const map = new Map<string, TcsSummary>();
  for (const t of TCS_TRANSACTIONS) {
    const cur = map.get(t.period) ?? { period: t.period, totalSales: 0, totalTcs: 0, remitted: 0, pending: 0, txnCount: 0 };
    cur.totalSales += t.saleValue;
    cur.totalTcs += t.tcsAmount;
    if (t.remitted) cur.remitted += t.tcsAmount;
    else cur.pending += t.tcsAmount;
    cur.txnCount += 1;
    map.set(t.period, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.period.localeCompare(b.period));
}

export function tcsTotal(): { sales: number; tcs: number; remitted: number; pending: number } {
  return TCS_TRANSACTIONS.reduce(
    (acc, t) => ({
      sales: acc.sales + t.saleValue,
      tcs: acc.tcs + t.tcsAmount,
      remitted: acc.remitted + (t.remitted ? t.tcsAmount : 0),
      pending: acc.pending + (t.remitted ? 0 : t.tcsAmount),
    }),
    { sales: 0, tcs: 0, remitted: 0, pending: 0 }
  );
}
