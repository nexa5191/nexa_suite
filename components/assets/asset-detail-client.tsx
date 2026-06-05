"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Building2, TrendingUp, Trash2, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { formatMoney } from "@/lib/currency";
import { cn, formatDate } from "@/lib/utils";
import { entityById, locationById } from "@/lib/accounting/org";
import {
  allAssets,
  loadCreatedAssets,
  loadDisposals,
  saveDisposals,
  DEP_EXPENSE_ACCOUNT,
  ACCUM_DEP_ACCOUNT,
  type FixedAsset,
  type Disposal,
} from "@/lib/assets/assets";
import {
  depreciationSchedule,
  accumulatedDepreciation,
  netBookValue,
  depreciationInFy,
  appraise,
  wdvRate,
  type Appraisal,
} from "@/lib/assets/depreciation";

const TODAY = new Date().toISOString().slice(0, 10);
const CUR_FY = (() => {
  const y = Number(TODAY.slice(0, 4));
  return Number(TODAY.slice(5, 7)) >= 4 ? y : y - 1;
})();

export function AssetDetailClient({ assetId }: { assetId: string }) {
  const [created, setCreated] = React.useState<FixedAsset[]>([]);
  const [disposals, setDisposals] = React.useState<Disposal[]>([]);
  const [proceeds, setProceeds] = React.useState("");

  React.useEffect(() => {
    setCreated(loadCreatedAssets());
    setDisposals(loadDisposals());
  }, []);

  const asset = allAssets(created).find((a) => a.id === assetId);
  if (!asset) {
    return (
      <Card className="p-10 text-center">
        <p className="text-sm text-muted-foreground">Asset not found.</p>
        <Link href="/assets" className="mt-3 inline-block text-sm text-primary hover:underline">← Back to register</Link>
      </Card>
    );
  }

  const disposal = disposals.find((d) => d.assetId === asset.id);
  const ap = appraise(asset);
  const schedule = depreciationSchedule(asset);
  const nbv = netBookValue(asset, TODAY);
  const accum = accumulatedDepreciation(asset, TODAY);
  const depFy = depreciationInFy(asset, CUR_FY);

  function recordDisposal() {
    const p = parseFloat(proceeds) || 0;
    const next = [...disposals.filter((d) => d.assetId !== asset!.id), { assetId: asset!.id, date: TODAY, proceeds: p }];
    setDisposals(next);
    saveDisposals(next);
    setProceeds("");
  }
  function reverseDisposal() {
    const next = disposals.filter((d) => d.assetId !== asset!.id);
    setDisposals(next);
    saveDisposals(next);
  }

  const gainLoss = disposal ? disposal.proceeds - nbv : 0;

  return (
    <>
      <Link href="/assets" className="mb-3 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" /> Fixed assets
      </Link>
      <PageHeader
        title={asset.name}
        subtitle={`${asset.tag} · ${asset.category} · ${entityById(asset.entityId)?.name} — ${locationById(asset.locationId)?.name}`}
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={asset.method === "WDV" ? "primary" : "default"}>
              {asset.method}{asset.method === "WDV" ? ` @ ${(wdvRate(asset) * 100).toFixed(0)}%` : ` · ${asset.usefulLifeYears}y`}
            </Badge>
            {disposal ? <Badge variant="danger">Disposed</Badge> : <Badge variant="success">Active</Badge>}
          </div>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Capitalised cost" value={asset.cost} />
        <Kpi label="Accumulated depreciation" value={accum} />
        <Kpi label="Net book value (today)" value={nbv} accent />
        <Kpi label={`Depreciation FY ${CUR_FY % 100}-${(CUR_FY + 1) % 100}`} value={depFy} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        {/* appraisal */}
        <Card className="lg:col-span-2 p-5">
          <h3 className="mb-1 flex items-center gap-1.5 text-sm font-semibold">
            <TrendingUp className="size-4 text-primary" /> Capital appraisal
          </h3>
          <p className="mb-4 text-xs text-muted-foreground">
            Expected annual benefit (cash inflow / cost saving) of <Money value={asset.annualBenefit} /> drives payback &amp; return.
          </p>

          {asset.annualBenefit > 0 ? (
            <>
              <div className="grid grid-cols-2 gap-3">
                <Appr label="Payback period" value={ap.simplePaybackYears != null ? `${ap.simplePaybackYears.toFixed(2)} yrs` : "—"} highlight />
                <Appr label="Total ROI (over life)" value={`${ap.roi.toFixed(0)}%`} />
                <Appr label="Accounting rate of return" value={`${ap.arr.toFixed(1)}%`} />
                <Appr label="Net benefit over life" value={<Money value={ap.netBenefitOverLife} compact />} />
              </div>
              <PaybackChart ap={ap} life={asset.usefulLifeYears} />
            </>
          ) : (
            <p className="rounded-md bg-muted/50 p-4 text-sm text-muted-foreground">
              No measurable annual benefit recorded for this asset (e.g. office fit-out), so payback isn't applicable.
            </p>
          )}
        </Card>

        {/* depreciation schedule */}
        <Card className="lg:col-span-3 overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Depreciation schedule — {asset.method === "SLM" ? "straight line" : "written-down value"}
            </h3>
          </div>
          <div className="max-h-[360px] overflow-y-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">FY</th>
                  <th className="px-4 py-2.5 text-right font-medium">Opening</th>
                  <th className="px-4 py-2.5 text-right font-medium">Depreciation</th>
                  <th className="px-4 py-2.5 text-right font-medium">Closing</th>
                  <th className="px-4 py-2.5 text-right font-medium">Accumulated</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((r) => (
                  <tr key={r.fyStartYear} className={cn("border-b last:border-0", r.fyStartYear === CUR_FY && "bg-primary/5")}>
                    <td className="px-4 py-2">
                      {r.label}
                      {r.fyStartYear === CUR_FY && <Badge variant="primary" className="ml-2">current</Badge>}
                    </td>
                    <td className="px-4 py-2 text-right tabular text-muted-foreground"><Money value={r.opening} /></td>
                    <td className="px-4 py-2 text-right tabular font-medium"><Money value={r.depreciation} /></td>
                    <td className="px-4 py-2 text-right tabular"><Money value={r.closing} /></td>
                    <td className="px-4 py-2 text-right tabular text-muted-foreground"><Money value={r.accumulated} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t px-4 py-2 text-[11px] text-muted-foreground">
            Posts to {DEP_EXPENSE_ACCOUNT} Depreciation / {ACCUM_DEP_ACCOUNT} Accumulated Depreciation. Salvage value <Money value={asset.salvage} />. Supplier: {asset.supplier ?? "—"}.
          </p>
        </Card>
      </div>

      {/* disposal */}
      <Card className="mt-4 p-5">
        <h3 className="mb-3 flex items-center gap-1.5 text-sm font-semibold"><Trash2 className="size-4" /> Disposal</h3>
        {disposal ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="text-sm">
              Disposed {formatDate(disposal.date)} for <Money value={disposal.proceeds} className="font-semibold" />.
            </div>
            <Badge variant={gainLoss >= 0 ? "success" : "danger"}>
              {gainLoss >= 0 ? "Gain" : "Loss"} on disposal: <Money value={Math.abs(gainLoss)} />
            </Badge>
            <Button variant="outline" size="sm" onClick={reverseDisposal} className="ml-auto"><RotateCcw className="size-4" /> Reverse</Button>
          </div>
        ) : (
          <div className="flex flex-wrap items-end gap-3">
            <p className="text-sm text-muted-foreground">Current net book value is <Money value={nbv} className="font-medium text-foreground" />. Record sale proceeds to compute gain/loss.</p>
            <div className="ml-auto flex items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-muted-foreground">Sale proceeds (₹)</span>
                <Input value={proceeds} onChange={(e) => setProceeds(e.target.value)} inputMode="decimal" placeholder="0" className="w-40" />
              </label>
              <Button onClick={recordDisposal} disabled={!proceeds}>Record disposal</Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}

// Keep meta referenced (category accounting hint shown in tooltip-style title).
function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className={cn("p-4", accent && "border-primary/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular", accent && "text-primary")}>
        <Money value={value} compact />
      </p>
    </Card>
  );
}

function Appr({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", highlight && "border-primary/40 bg-primary/5")}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold tabular", highlight && "text-primary")}>{value}</p>
    </div>
  );
}

// ---- cumulative-cashflow payback chart (inline SVG) ------------------------
function PaybackChart({ ap, life }: { ap: Appraisal; life: number }) {
  const { currency } = usePrefs();
  const W = 320;
  const H = 150;
  const pad = { l: 8, r: 8, t: 12, b: 18 };
  const pts = ap.cumulative;
  const xs = (y: number) => pad.l + (y / life) * (W - pad.l - pad.r);
  const min = Math.min(...pts.map((p) => p.cumulative));
  const max = Math.max(...pts.map((p) => p.cumulative), 0);
  const ys = (v: number) => {
    const t = (v - min) / (max - min || 1);
    return H - pad.b - t * (H - pad.t - pad.b);
  };
  const line = pts.map((p) => `${xs(p.year)},${ys(p.cumulative)}`).join(" ");
  const zeroY = ys(0);
  const pb = ap.simplePaybackYears;

  return (
    <div className="mt-4">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Cumulative cash flow</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Cumulative cash flow payback chart">
        {/* zero baseline */}
        <line x1={pad.l} y1={zeroY} x2={W - pad.r} y2={zeroY} stroke="currentColor" className="text-border" strokeDasharray="3 3" />
        {/* area under/over */}
        <polyline points={line} fill="none" stroke="currentColor" className="text-primary" strokeWidth={2} />
        {pts.map((p) => (
          <circle key={p.year} cx={xs(p.year)} cy={ys(p.cumulative)} r={2.5} className={p.cumulative >= 0 ? "fill-success" : "fill-danger"} />
        ))}
        {/* payback marker */}
        {pb != null && pb <= life && (
          <line x1={xs(pb)} y1={pad.t} x2={xs(pb)} y2={H - pad.b} stroke="currentColor" className="text-primary/50" strokeDasharray="2 2" />
        )}
        {/* year axis labels */}
        <text x={pad.l} y={H - 4} className="fill-muted-foreground text-[8px]">Y0</text>
        <text x={W - pad.r} y={H - 4} textAnchor="end" className="fill-muted-foreground text-[8px]">Y{life}</text>
      </svg>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>Outlay {formatMoney(ap.cumulative[0].cashflow, currency)}</span>
        <span>{pb != null ? `Breaks even ~Y${Math.ceil(pb)}` : "No payback"}</span>
      </div>
    </div>
  );
}
