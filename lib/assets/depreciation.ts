// ---------------------------------------------------------------------------
// NEXA depreciation & capital-appraisal maths. Pure functions over a
// FixedAsset. Depreciation runs month-by-month (deterministic) so accumulated
// depreciation and net book value can be read as at any date; the per-FY
// schedule is just those months bucketed by Indian financial year.
// ---------------------------------------------------------------------------

import type { FixedAsset } from "./assets";

const r2 = (n: number) => Math.round(n * 100) / 100;
const ymIndex = (iso: string) => parseInt(iso.slice(0, 4), 10) * 12 + (parseInt(iso.slice(5, 7), 10) - 1);

/** Effective WDV rate (fraction p.a.). Uses the asset's rate, else derives it. */
export function wdvRate(asset: FixedAsset): number {
  if (asset.wdvRate != null) return asset.wdvRate / 100;
  // r = 1 - (salvage/cost)^(1/life)
  const ratio = asset.salvage > 0 ? asset.salvage / asset.cost : 0.05;
  return 1 - Math.pow(ratio, 1 / asset.usefulLifeYears);
}

/** Per-month depreciation over the asset's whole life (length = life × 12). */
export function monthlySeries(asset: FixedAsset): number[] {
  const months = Math.max(1, Math.round(asset.usefulLifeYears * 12));
  const out: number[] = [];
  if (asset.method === "SLM") {
    const m = (asset.cost - asset.salvage) / months;
    for (let i = 0; i < months; i++) out.push(m);
    return out;
  }
  // WDV — reduce balance each asset-year, spread evenly across its 12 months.
  const r = wdvRate(asset);
  let nbv = asset.cost;
  for (let y = 0; y < asset.usefulLifeYears; y++) {
    let yearDep = nbv * r;
    if (nbv - yearDep < asset.salvage) yearDep = Math.max(0, nbv - asset.salvage);
    const per = yearDep / 12;
    for (let k = 0; k < 12; k++) out.push(per);
    nbv -= yearDep;
  }
  return out;
}

/** Whole-of-life total depreciation (cost − salvage, give or take rounding). */
export function totalDepreciation(asset: FixedAsset): number {
  return r2(monthlySeries(asset).reduce((s, d) => s + d, 0));
}

/** Months the asset has been in service as at `asOf` (clamped to its life). */
export function monthsInService(asset: FixedAsset, asOf: string): number {
  const elapsed = ymIndex(asOf) - ymIndex(asset.acquisitionDate) + 1; // include acquisition month
  return Math.max(0, Math.min(elapsed, Math.round(asset.usefulLifeYears * 12)));
}

export function accumulatedDepreciation(asset: FixedAsset, asOf: string): number {
  const n = monthsInService(asset, asOf);
  const s = monthlySeries(asset);
  return r2(s.slice(0, n).reduce((a, d) => a + d, 0));
}

export function netBookValue(asset: FixedAsset, asOf: string): number {
  return r2(asset.cost - accumulatedDepreciation(asset, asOf));
}

/** Depreciation charged within a single FY (Apr–Mar) named by its start year. */
export function depreciationInFy(asset: FixedAsset, fyStartYear: number): number {
  const s = monthlySeries(asset);
  const start = ymIndex(asset.acquisitionDate);
  let total = 0;
  for (let i = 0; i < s.length; i++) {
    const abs = start + i;
    const year = Math.floor(abs / 12);
    const month = (abs % 12) + 1;
    const fy = month >= 4 ? year : year - 1;
    if (fy === fyStartYear) total += s[i];
  }
  return r2(total);
}

export const fyLabel = (startYear: number) => `FY ${String(startYear).slice(2)}-${String(startYear + 1).slice(2)}`;

export interface ScheduleRow {
  fyStartYear: number;
  label: string;
  opening: number;
  depreciation: number;
  closing: number;
  accumulated: number;
}

/** Full per-FY depreciation schedule from acquisition to end of life. */
export function depreciationSchedule(asset: FixedAsset): ScheduleRow[] {
  const s = monthlySeries(asset);
  const start = ymIndex(asset.acquisitionDate);
  const byFy = new Map<number, number>();
  for (let i = 0; i < s.length; i++) {
    const abs = start + i;
    const year = Math.floor(abs / 12);
    const month = (abs % 12) + 1;
    const fy = month >= 4 ? year : year - 1;
    byFy.set(fy, (byFy.get(fy) ?? 0) + s[i]);
  }
  const rows: ScheduleRow[] = [];
  let opening = asset.cost;
  let accum = 0;
  for (const fy of Array.from(byFy.keys()).sort((a, b) => a - b)) {
    const dep = r2(byFy.get(fy)!);
    const closing = r2(opening - dep);
    accum = r2(accum + dep);
    rows.push({ fyStartYear: fy, label: fyLabel(fy), opening: r2(opening), depreciation: dep, closing, accumulated: accum });
    opening = closing;
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Capital appraisal — payback period & rates of return
// ---------------------------------------------------------------------------
export interface Appraisal {
  annualBenefit: number;
  simplePaybackYears: number | null; // null when the asset has no measured benefit
  cumulative: { year: number; cashflow: number; cumulative: number }[];
  netBenefitOverLife: number;
  roi: number; // total return on cost (%)
  arr: number; // accounting rate of return (%)
  annualSlmDep: number;
}

export function appraise(asset: FixedAsset): Appraisal {
  const life = asset.usefulLifeYears;
  const annualSlmDep = r2((asset.cost - asset.salvage) / life);
  const benefit = asset.annualBenefit;

  // cumulative cash flows: year 0 outflow = cost; salvage recovered in final year.
  const cumulative: Appraisal["cumulative"] = [{ year: 0, cashflow: -asset.cost, cumulative: -asset.cost }];
  let cum = -asset.cost;
  for (let y = 1; y <= life; y++) {
    const inflow = benefit + (y === life ? asset.salvage : 0);
    cum = r2(cum + inflow);
    cumulative.push({ year: y, cashflow: r2(inflow), cumulative: cum });
  }

  let payback: number | null = null;
  if (benefit > 0) {
    // interpolate the year the cumulative crosses zero
    for (let i = 1; i < cumulative.length; i++) {
      if (cumulative[i].cumulative >= 0) {
        const prev = cumulative[i - 1].cumulative;
        const frac = prev < 0 ? -prev / (cumulative[i].cumulative - prev) : 0;
        payback = r2(cumulative[i - 1].year + frac);
        break;
      }
    }
    if (payback === null) payback = r2(asset.cost / benefit); // beyond modelled life
  }

  const netBenefitOverLife = r2(benefit * life + asset.salvage - asset.cost);
  const roi = r2((netBenefitOverLife / asset.cost) * 100);
  const avgInvestment = (asset.cost + asset.salvage) / 2;
  const arr = benefit > 0 ? r2(((benefit - annualSlmDep) / avgInvestment) * 100) : 0;

  return { annualBenefit: benefit, simplePaybackYears: payback, cumulative, netBenefitOverLife, roi, arr, annualSlmDep };
}
