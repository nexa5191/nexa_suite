"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Building2, ChevronRight, X } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { cn, formatDate } from "@/lib/utils";
import { entityById, locationById, ENTITIES, locationsForEntity } from "@/lib/accounting/org";
import {
  allAssets,
  loadCreatedAssets,
  saveCreatedAssets,
  categoryMeta,
  nextAssetTag,
  CATEGORY_META,
  type FixedAsset,
  type AssetCategory,
  type DepMethod,
} from "@/lib/assets/assets";
import {
  accumulatedDepreciation,
  netBookValue,
  depreciationInFy,
  appraise,
} from "@/lib/assets/depreciation";

const TODAY = new Date().toISOString().slice(0, 10);
const CUR_FY = (() => {
  const y = Number(TODAY.slice(0, 4));
  const m = Number(TODAY.slice(5, 7));
  return m >= 4 ? y : y - 1;
})();

export function AssetsClient() {
  const prefs = usePrefs();
  const [created, setCreated] = React.useState<FixedAsset[]>([]);
  const [cat, setCat] = React.useState<"all" | AssetCategory>("all");
  const [q, setQ] = React.useState("");
  const [adding, setAdding] = React.useState(false);

  React.useEffect(() => setCreated(loadCreatedAssets()), []);

  const assets = allAssets(created).filter((a) => {
    if (prefs.entityId !== "all" && a.entityId !== prefs.entityId) return false;
    if (cat !== "all" && a.category !== cat) return false;
    if (q && !`${a.name} ${a.tag} ${a.supplier ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const gross = assets.reduce((s, a) => s + a.cost, 0);
  const accum = assets.reduce((s, a) => s + accumulatedDepreciation(a, TODAY), 0);
  const net = gross - accum;
  const depThisFy = assets.reduce((s, a) => s + depreciationInFy(a, CUR_FY), 0);

  function addAsset(a: FixedAsset) {
    setCreated((prev) => {
      const next = [...prev, a];
      saveCreatedAssets(next);
      return next;
    });
    setAdding(false);
  }

  // category roll-up for the strip below KPIs
  const byCat = CATEGORY_META.map((m) => {
    const rows = assets.filter((a) => a.category === m.category);
    return { category: m.category, count: rows.length, net: rows.reduce((s, a) => s + netBookValue(a, TODAY), 0) };
  }).filter((c) => c.count > 0);

  return (
    <>
      <PageHeader
        title="Fixed Assets"
        subtitle="Asset register with depreciation (SLM / WDV) and capital-appraisal — payback period & return on each asset."
        actions={
          <Button onClick={() => setAdding((v) => !v)}>
            {adding ? <X className="size-4" /> : <Plus className="size-4" />} {adding ? "Cancel" : "Add asset"}
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Gross block" value={gross} />
        <Kpi label="Accumulated depreciation" value={accum} />
        <Kpi label="Net block (WDV)" value={net} accent />
        <Kpi label={`Depreciation ${CUR_FY % 100}-${(CUR_FY + 1) % 100}`} value={depThisFy} />
      </div>

      {byCat.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2">
          {byCat.map((c) => (
            <div key={c.category} className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs shadow-sm">
              <span className="font-medium">{c.category}</span>
              <Badge variant="default">{c.count}</Badge>
              <Money value={c.net} compact className="text-muted-foreground" />
            </div>
          ))}
        </div>
      )}

      {adding && <AddAssetForm created={created} onAdd={addAsset} />}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1">
          {(["all", ...CATEGORY_META.map((m) => m.category)] as const).map((k) => (
            <button
              key={k}
              onClick={() => setCat(k)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                cat === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {k === "all" ? "All categories" : k}
            </button>
          ))}
        </div>
        <Input placeholder="Search assets…" value={q} onChange={(e) => setQ(e.target.value)} className="ml-auto h-9 w-56" />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Asset</th>
                <th className="px-4 py-3 font-medium">Location</th>
                <th className="px-4 py-3 font-medium">Acquired</th>
                <th className="px-4 py-3 text-right font-medium">Cost</th>
                <th className="px-4 py-3 text-right font-medium">Accum. dep</th>
                <th className="px-4 py-3 text-right font-medium">Net book value</th>
                <th className="px-4 py-3 font-medium">Method</th>
                <th className="px-4 py-3 text-right font-medium">Payback</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {assets.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">No assets in this view.</td>
                </tr>
              )}
              {assets.map((a) => {
                const ap = appraise(a);
                const nbv = netBookValue(a, TODAY);
                return (
                  <tr key={a.id} className="group border-b align-top transition-colors last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <p className="flex items-center gap-1.5 font-medium">
                        <Building2 className="size-3.5 text-muted-foreground" /> {a.name}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">
                        <span className="font-mono">{a.tag}</span> · {a.category}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {locationById(a.locationId)?.name}
                      <br />
                      {entityById(a.entityId)?.name}
                    </td>
                    <td className="px-4 py-3 text-xs">{formatDate(a.acquisitionDate)}</td>
                    <td className="px-4 py-3 text-right tabular"><Money value={a.cost} /></td>
                    <td className="px-4 py-3 text-right tabular text-muted-foreground"><Money value={accumulatedDepreciation(a, TODAY)} /></td>
                    <td className="px-4 py-3 text-right tabular font-semibold"><Money value={nbv} /></td>
                    <td className="px-4 py-3"><Badge variant={a.method === "WDV" ? "primary" : "default"}>{a.method}</Badge></td>
                    <td className="px-4 py-3 text-right">
                      {ap.simplePaybackYears != null ? (
                        <span className="text-sm font-medium tabular">{ap.simplePaybackYears.toFixed(1)} yrs</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">n/a</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/assets/${a.id}`} className="inline-flex text-muted-foreground hover:text-foreground">
                        <ChevronRight className="size-4" />
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

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

function AddAssetForm({ created, onAdd }: { created: FixedAsset[]; onAdd: (a: FixedAsset) => void }) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<AssetCategory>("Plant & Machinery");
  const [entityId, setEntityId] = React.useState(ENTITIES[0].id);
  const [locationId, setLocationId] = React.useState(locationsForEntity(ENTITIES[0].id)[0].id);
  const [date, setDate] = React.useState(TODAY);
  const [cost, setCost] = React.useState("");
  const [salvagePct, setSalvagePct] = React.useState("5");
  const [benefit, setBenefit] = React.useState("");
  const meta = categoryMeta(category);
  const [method, setMethod] = React.useState<DepMethod>(meta.defaultMethod);
  const [life, setLife] = React.useState(String(meta.defaultLife));

  const locs = locationsForEntity(entityId);
  const num = (s: string) => parseFloat(s) || 0;
  const valid = name && num(cost) > 0;

  return (
    <Card className="mb-4 p-4">
      <h3 className="mb-3 text-sm font-semibold">New asset</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <L label="Asset name"><Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bottling line" /></L>
        <L label="Category">
          <Select value={category} onChange={(e) => { const c = e.target.value as AssetCategory; setCategory(c); const m = categoryMeta(c); setMethod(m.defaultMethod); setLife(String(m.defaultLife)); }}>
            {CATEGORY_META.map((m) => <option key={m.category} value={m.category}>{m.category}</option>)}
          </Select>
        </L>
        <L label="Entity">
          <Select value={entityId} onChange={(e) => { setEntityId(e.target.value); setLocationId(locationsForEntity(e.target.value)[0].id); }}>
            {ENTITIES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </Select>
        </L>
        <L label="Location">
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)}>
            {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </L>
        <L label="Acquisition date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></L>
        <L label="Cost (₹)"><Input value={cost} onChange={(e) => setCost(e.target.value)} inputMode="decimal" placeholder="0" /></L>
        <L label="Salvage %"><Input value={salvagePct} onChange={(e) => setSalvagePct(e.target.value)} inputMode="decimal" /></L>
        <L label="Expected annual benefit (₹)"><Input value={benefit} onChange={(e) => setBenefit(e.target.value)} inputMode="decimal" placeholder="cash inflow / saving" /></L>
        <L label="Method">
          <Select value={method} onChange={(e) => setMethod(e.target.value as DepMethod)}>
            <option value="SLM">Straight line (SLM)</option>
            <option value="WDV">Written-down value (WDV)</option>
          </Select>
        </L>
        <L label="Useful life (years)"><Input value={life} onChange={(e) => setLife(e.target.value)} inputMode="numeric" /></L>
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          disabled={!valid}
          onClick={() => {
            const { id, tag } = nextAssetTag(created);
            const c = num(cost);
            onAdd({
              id, tag, name, category, entityId, locationId,
              acquisitionDate: date, cost: c, salvage: Math.round((c * num(salvagePct)) / 100),
              usefulLifeYears: Math.max(1, num(life)), method, annualBenefit: num(benefit),
            });
          }}
        >
          <Plus className="size-4" /> Add to register
        </Button>
      </div>
    </Card>
  );
}

function L({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
