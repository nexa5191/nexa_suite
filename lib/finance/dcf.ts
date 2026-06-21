// ---------------------------------------------------------------------------
// Discounted Cash Flow (DCF) model — multi-segment enterprise valuation.
//
// Each segment picks its own overhead allocation metric, making the drill-down
// sensitivity live: changing a segment's basis re-weights overhead distribution
// across all segments simultaneously.
//
// FCF per segment = NOPAT (after allocated overhead + tax) − Capex − ΔWC
// Terminal value  = FCF_n × (1 + g) / (WACC − g)   [Gordon Growth]
// Enterprise value = Σ PV(FCF) + Σ PV(TV) across all segments
// ---------------------------------------------------------------------------

export type AllocationBasis = "revenue" | "volume" | "headcount" | "equal" | "custom";

export const ALLOCATION_META: Record<AllocationBasis, { label: string; description: string }> = {
  revenue:   { label: "Revenue %",     description: "Overhead proportional to each segment's revenue share" },
  volume:    { label: "Prod. volume",  description: "Proportional to relative production volume index" },
  headcount: { label: "Headcount",     description: "Proportional to segment employee count" },
  equal:     { label: "Equal split",   description: "Overhead divided equally across segments" },
  custom:    { label: "Custom weight", description: "User-defined percentage weight" },
};

export interface DcfSegment {
  id: string;
  name: string;
  color: string;
  // Allocation basis (each segment owns this independently)
  allocationBasis: AllocationBasis;
  customWeight: number;  // used when basis = "custom" (0–100 scale, normalized at run time)
  volumeIndex: number;   // relative production volume (arbitrary scale)
  headcount: number;
  // Base year actuals (₹)
  baseRevenue: number;
  baseEbitda: number;
  baseCapex: number;
  baseWC: number;
  // Forward assumptions (editable per segment)
  revenueGrowth: number;        // % CAGR
  ebitdaMarginTarget: number;   // % of revenue at end of horizon (blended linearly)
  capexPct: number;             // capex as % of revenue
  wcPct: number;                // ΔWC as % of incremental revenue
}

export interface DcfParams {
  wacc: number;           // %
  terminalGrowth: number; // %
  taxRate: number;        // %
  years: number;          // projection horizon (1–10)
  sharedOverhead: number; // ₹/year, distributed by each segment's chosen basis
}

export interface YearProjection {
  year: number;
  revenue: number;
  ebitda: number;
  ebitdaMargin: number;       // %
  overhead: number;           // allocated overhead (expense)
  ebitdaAfterOH: number;
  tax: number;
  nopat: number;
  capex: number;
  deltaWC: number;
  fcf: number;
  pvFactor: number;
  pvFcf: number;
}

export interface SegmentDcf {
  segment: DcfSegment;
  years: YearProjection[];
  terminalValue: number;
  pvTerminal: number;
  sumPvFcf: number;
  npv: number;            // sumPvFcf + pvTerminal
  allocationWeight: number; // base-year weight (0–1) — for display
  allocationMetricValue: number; // the raw metric used (revenue / volumeIndex / headcount / etc.)
}

export interface ConsolidatedYear {
  year: number;
  revenue: number;
  ebitda: number;
  overhead: number;
  nopat: number;
  capex: number;
  deltaWC: number;
  fcf: number;
  pvFcf: number;
}

export interface SensitivityCell {
  wacc: number;
  g: number;
  ev: number;
}

export interface DcfResult {
  params: DcfParams;
  segments: SegmentDcf[];
  consolidated: ConsolidatedYear[];
  totalTerminalValue: number;
  pvTerminalConsolidated: number;
  enterpriseValue: number;
  sensitivity: SensitivityCell[][];  // [waccRow][gCol]
}

// ---------------------------------------------------------------------------
// Seed data — NEXA Foods three product segments + realistic base-year figures
// ---------------------------------------------------------------------------
export const DEFAULT_SEGMENTS: DcfSegment[] = [
  {
    id: "seg-wheat", name: "Wheat Products", color: "#3b82f6",
    allocationBasis: "revenue", customWeight: 65, volumeIndex: 70, headcount: 45,
    baseRevenue: 9_50_00_000, baseEbitda: 1_66_00_000, baseCapex: 38_00_000, baseWC: 72_00_000,
    revenueGrowth: 12, ebitdaMarginTarget: 20, capexPct: 4, wcPct: 8,
  },
  {
    id: "seg-rice", name: "Rice Products", color: "#10b981",
    allocationBasis: "volume", customWeight: 20, volumeIndex: 18, headcount: 12,
    baseRevenue: 2_80_00_000, baseEbitda: 42_00_000, baseCapex: 7_00_000, baseWC: 22_00_000,
    revenueGrowth: 18, ebitdaMarginTarget: 18, capexPct: 2.5, wcPct: 10,
  },
  {
    id: "seg-oil", name: "Oil Products", color: "#f59e0b",
    allocationBasis: "headcount", customWeight: 15, volumeIndex: 12, headcount: 8,
    baseRevenue: 2_40_00_000, baseEbitda: 28_80_000, baseCapex: 5_00_000, baseWC: 18_00_000,
    revenueGrowth: 8, ebitdaMarginTarget: 14, capexPct: 2, wcPct: 6,
  },
];

export const DEFAULT_PARAMS: DcfParams = {
  wacc: 12,
  terminalGrowth: 4,
  taxRate: 25,
  years: 5,
  sharedOverhead: 1_60_00_000,
};

// ---------------------------------------------------------------------------
// Core computation
// ---------------------------------------------------------------------------

/** Compute per-segment overhead allocation weights for a given year's revenues. */
function allocationWeights(segments: DcfSegment[], yearRevs: number[]): number[] {
  const n = segments.length;

  const rawMetric = segments.map((seg, i) => {
    switch (seg.allocationBasis) {
      case "revenue":   return yearRevs[i];
      case "volume":    return seg.volumeIndex;
      case "headcount": return seg.headcount;
      case "equal":     return 1;
      case "custom":    return seg.customWeight;
    }
  });

  const total = rawMetric.reduce((s, v) => s + v, 0);
  return rawMetric.map((v) => (total > 0 ? v / total : 1 / n));
}

/** Simple EV computation — used inside the sensitivity grid to avoid nesting runDcf. */
function computeEV(
  segments: DcfSegment[],
  wacc: number,
  terminalGrowth: number,
  taxRate: number,
  years: number,
  sharedOverhead: number,
): number {
  const wD = wacc / 100;
  const gD = terminalGrowth / 100;
  const tD = taxRate / 100;

  const segRevsByYear = segments.map((seg) =>
    Array.from({ length: years }, (_, t) => seg.baseRevenue * Math.pow(1 + seg.revenueGrowth / 100, t + 1))
  );

  let ev = 0;
  segments.forEach((seg, si) => {
    let pvFcfs = 0;
    let lastFcf = 0;
    for (let t = 0; t < years; t++) {
      const yr = t + 1;
      const prevRev = t === 0 ? seg.baseRevenue : segRevsByYear[si][t - 1];
      const revenue = segRevsByYear[si][t];
      const baseMgn = seg.baseRevenue > 0 ? (seg.baseEbitda / seg.baseRevenue) * 100 : 0;
      const mgn = baseMgn + (seg.ebitdaMarginTarget - baseMgn) * (yr / years);
      const ebitda = revenue * mgn / 100;
      const yearRevs = segRevsByYear.map((r) => r[t]);
      const weights = allocationWeights(segments, yearRevs);
      const overhead = sharedOverhead * weights[si];
      const ebitdaAOH = ebitda - overhead;
      const nopat = Math.max(0, ebitdaAOH) * (1 - tD);
      const capex = revenue * seg.capexPct / 100;
      const deltaWC = (revenue - prevRev) * seg.wcPct / 100;
      const fcf = nopat - capex - deltaWC;
      pvFcfs += fcf / Math.pow(1 + wD, yr);
      lastFcf = fcf;
    }
    const tv = wD > gD ? lastFcf * (1 + gD) / (wD - gD) : 0;
    ev += pvFcfs + tv / Math.pow(1 + wD, years);
  });
  return ev;
}

export function runDcf(segments: DcfSegment[], params: DcfParams): DcfResult {
  const { wacc, terminalGrowth, taxRate, years, sharedOverhead } = params;
  const wD = wacc / 100;
  const gD = terminalGrowth / 100;
  const tD = taxRate / 100;

  // Pre-compute projected revenues for each segment per year
  const segRevsByYear = segments.map((seg) =>
    Array.from({ length: years }, (_, t) => seg.baseRevenue * Math.pow(1 + seg.revenueGrowth / 100, t + 1))
  );

  // Base-year allocation weights (for display in drill-down header)
  const baseRevs = segments.map((s) => s.baseRevenue);
  const baseWeights = allocationWeights(segments, baseRevs);

  const segDcfs: SegmentDcf[] = segments.map((seg, si) => {
    const yearProjs: YearProjection[] = Array.from({ length: years }, (_, t) => {
      const yr = t + 1;
      const prevRev = t === 0 ? seg.baseRevenue : segRevsByYear[si][t - 1];
      const revenue = segRevsByYear[si][t];

      // EBITDA margin: blend from base to target over the horizon
      const baseMgn = seg.baseRevenue > 0 ? (seg.baseEbitda / seg.baseRevenue) * 100 : 0;
      const blendedMgn = baseMgn + (seg.ebitdaMarginTarget - baseMgn) * (yr / years);
      const ebitda = revenue * blendedMgn / 100;

      // Overhead: use year-t cross-segment revenue for "revenue" basis weights
      const yearRevs = segRevsByYear.map((r) => r[t]);
      const weights = allocationWeights(segments, yearRevs);
      const overhead = sharedOverhead * weights[si];

      const ebitdaAfterOH = ebitda - overhead;
      const tax = Math.max(0, ebitdaAfterOH * tD);
      const nopat = ebitdaAfterOH - tax;
      const capex = revenue * seg.capexPct / 100;
      const deltaWC = (revenue - prevRev) * seg.wcPct / 100;
      const fcf = nopat - capex - deltaWC;
      const pvFactor = 1 / Math.pow(1 + wD, yr);

      return {
        year: yr, revenue, ebitda, ebitdaMargin: blendedMgn,
        overhead, ebitdaAfterOH, tax, nopat, capex, deltaWC, fcf,
        pvFactor, pvFcf: fcf * pvFactor,
      };
    });

    const lastFcf = yearProjs[yearProjs.length - 1].fcf;
    const terminalValue = wD > gD ? lastFcf * (1 + gD) / (wD - gD) : 0;
    const pvTerminal = terminalValue / Math.pow(1 + wD, years);
    const sumPvFcf = yearProjs.reduce((s, y) => s + y.pvFcf, 0);

    // Raw metric value for display
    const rawMetric = (() => {
      switch (seg.allocationBasis) {
        case "revenue":   return seg.baseRevenue;
        case "volume":    return seg.volumeIndex;
        case "headcount": return seg.headcount;
        case "equal":     return 1;
        case "custom":    return seg.customWeight;
      }
    })();

    return {
      segment: seg, years: yearProjs, terminalValue, pvTerminal,
      sumPvFcf, npv: sumPvFcf + pvTerminal,
      allocationWeight: baseWeights[si],
      allocationMetricValue: rawMetric,
    };
  });

  // Consolidated timeline
  const consolidated: ConsolidatedYear[] = Array.from({ length: years }, (_, t) => ({
    year: t + 1,
    revenue:   segDcfs.reduce((s, sd) => s + sd.years[t].revenue, 0),
    ebitda:    segDcfs.reduce((s, sd) => s + sd.years[t].ebitda, 0),
    overhead:  sharedOverhead,
    nopat:     segDcfs.reduce((s, sd) => s + sd.years[t].nopat, 0),
    capex:     segDcfs.reduce((s, sd) => s + sd.years[t].capex, 0),
    deltaWC:   segDcfs.reduce((s, sd) => s + sd.years[t].deltaWC, 0),
    fcf:       segDcfs.reduce((s, sd) => s + sd.years[t].fcf, 0),
    pvFcf:     segDcfs.reduce((s, sd) => s + sd.years[t].pvFcf, 0),
  }));

  const totalTV = segDcfs.reduce((s, sd) => s + sd.terminalValue, 0);
  const pvTVConsolidated = segDcfs.reduce((s, sd) => s + sd.pvTerminal, 0);
  const enterpriseValue = segDcfs.reduce((s, sd) => s + sd.npv, 0);

  // Sensitivity grid — WACC ±2pp (5 steps) × terminal growth ±1pp (5 steps)
  const waccSteps = [-2, -1, 0, 1, 2].map((d) => wacc + d);
  const gSteps = [-1, -0.5, 0, 0.5, 1].map((d) => terminalGrowth + d);
  const sensitivity: SensitivityCell[][] = waccSteps.map((w) =>
    gSteps.map((g) => ({
      wacc: w, g,
      ev: g >= w ? 0 : computeEV(segments, w, g, taxRate, years, sharedOverhead),
    }))
  );

  return { params, segments, consolidated, totalTerminalValue: totalTV, pvTerminalConsolidated: pvTVConsolidated, enterpriseValue, sensitivity };
}
