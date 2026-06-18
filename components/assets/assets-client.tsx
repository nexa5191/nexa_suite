"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Building2, ChevronRight, X, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { VoucherButton } from "@/components/accounting/voucher-button";
import { useJournal } from "@/components/accounting/journal-provider";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { cn, formatDate, monthLabel } from "@/lib/utils";
import { entityById, locationById, ENTITIES, locationsForEntity } from "@/lib/accounting/org";
import { planDepreciation, recentMonths } from "@/lib/assets/dep-posting";
import { useNewIntent } from "@/lib/commands/new-intent";
import { CalendarClock, CheckCircle2, Wand2 } from "lucide-react";
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
import type { EntryDraft } from "@/lib/accounting/manual-entries";
import {
  accumulatedDepreciation,
  netBookValue,
  depreciationInFy,
  appraise,
  scheduleForBasis,
  basisMeta,
  type DepBasis,
  type CustomDep,
} from "@/lib/assets/depreciation";

const TODAY = new Date().toISOString().slice(0, 10);
const CUR_FY = (() => {
  const y = Number(TODAY.slice(0, 4));
  const m = Number(TODAY.slice(5, 7));
  return m >= 4 ? y : y - 1;
})();

// Where the credit (funding) lands when a new asset is capitalised.
export const FUNDING_OPTIONS: { code: string; label: string }[] = [
  { code: "1020", label: "Bank — Current Account" },
  { code: "1010", label: "Cash on Hand" },
  { code: "2010", label: "On credit (Accounts Payable)" },
];

export function AssetsClient() {
  const prefs = usePrefs();
  const { post } = useJournal();
  const [created, setCreated] = React.useState<FixedAsset[]>([]);
  const [postError, setPostError] = React.useState<string[]>([]);
  const [cat, setCat] = React.useState<"all" | AssetCategory>("all");
  const [q, setQ] = React.useState("");
  const [adding, setAdding] = React.useState(false);
  useNewIntent(() => setAdding(true));
  const [section, setSection] = React.useState<"register" | "depreciation">("register");

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

  function addAsset(a: FixedAsset, funding: string) {
    // Capitalisation voucher: Dr the fixed-asset account / Cr the funding source,
    // so the register's gross block reconciles to the GL.
    const draft: EntryDraft = {
      type: "asset",
      date: a.acquisitionDate,
      narration: `Capitalise ${a.name} (${a.tag})${a.supplier ? ` — ${a.supplier}` : ""}`,
      entityId: a.entityId,
      locationId: a.locationId,
      currency: "INR",
      basis: "accrual",
      lines: [
        { accountCode: categoryMeta(a.category).accountCode, debit: a.cost, credit: 0 },
        { accountCode: funding, debit: 0, credit: a.cost },
      ],
    };
    const res = post(draft);
    if (!res.ok) {
      setPostError(res.errors);
      return;
    }
    setPostError([]);
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
          <div className="flex flex-wrap gap-2">
            <VoucherButton type="asset" label="Asset voucher" variant="outline" />
            <Button onClick={() => setAdding((v) => !v)}>
              {adding ? <X className="size-4" /> : <Plus className="size-4" />} {adding ? "Cancel" : "Add asset"}
            </Button>
          </div>
        }
      />

      {/* page sections */}
      <div className="mb-4 flex gap-1 border-b">
        {(["register", "depreciation"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={cn(
              "-mb-px border-b-2 px-4 py-2 text-sm font-medium capitalize transition-colors",
              section === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {s === "register" ? "Asset Register" : "Depreciation"}
          </button>
        ))}
      </div>

      {section === "depreciation" && <DepreciationSection assets={assets} />}

      {section === "register" && (
        <>
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

      {adding && <AddAssetForm created={created} onAdd={addAsset} postError={postError} />}

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
                  <tr
                    key={a.id}
                    data-split-href={`/assets/${a.id}`}
                    title="Ctrl/⌘-click to open in split screen"
                    className="group border-b align-top transition-colors last:border-0 hover:bg-accent/40"
                  >
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
      )}
    </>
  );
}

// ---- Depreciation section: 3 statutory bases as sub-tabs -------------------
function DepreciationSection({ assets }: { assets: FixedAsset[] }) {
  const [basis, setBasis] = React.useState<DepBasis>("companies");
  const [custom, setCustom] = React.useState<CustomDep>({ method: "WDV", rate: 15, life: 10, residualPct: 5 });
  const [closedCats, setClosedCats] = React.useState<Set<string>>(new Set()); // categories start expanded
  const [openAssets, setOpenAssets] = React.useState<Set<string>>(new Set()); // schedules start collapsed

  const toggleCat = (c: string) =>
    setClosedCats((prev) => {
      const next = new Set(prev);
      next.has(c) ? next.delete(c) : next.add(c);
      return next;
    });
  const toggleAsset = (id: string) =>
    setOpenAssets((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const BASES: { key: DepBasis; label: string; sub: string }[] = [
    { key: "companies", label: "Companies Act 2013", sub: "Schedule II — useful life (book)" },
    { key: "incometax", label: "Income-tax Act 1961", sub: "Block of assets — WDV + ½-year rule" },
    { key: "custom", label: "User-defined", sub: "Custom method / rate / life" },
  ];

  const fyDepFromSched = (a: FixedAsset, b: DepBasis) => {
    const row = scheduleForBasis(a, b, custom).find((s) => s.fyStartYear === CUR_FY);
    return row?.depreciation ?? 0;
  };

  const rows = assets.map((a) => {
    const sched = scheduleForBasis(a, basis, custom);
    const cur = sched.find((s) => s.fyStartYear === CUR_FY);
    const opening = cur?.opening ?? (sched.length ? sched[sched.length - 1].closing : a.cost);
    const dep = cur?.depreciation ?? 0;
    const closing = cur?.closing ?? opening - dep;
    return { a, sched, opening, dep, closing };
  });

  const totalDep = rows.reduce((s, r) => s + r.dep, 0);
  const totalBook = assets.reduce((s, a) => s + fyDepFromSched(a, "companies"), 0);
  const totalTax = assets.reduce((s, a) => s + fyDepFromSched(a, "incometax"), 0);
  const fyTag = `FY ${CUR_FY % 100}-${(CUR_FY + 1) % 100}`;

  // group the per-asset rows by category, in the canonical category order
  type Row = (typeof rows)[number];
  const groups = CATEGORY_META.map((m) => m.category)
    .map((category) => {
      const items = rows.filter((r) => r.a.category === category);
      const totals = items.reduce(
        (t, r) => ({ cost: t.cost + r.a.cost, opening: t.opening + r.opening, dep: t.dep + r.dep, closing: t.closing + r.closing }),
        { cost: 0, opening: 0, dep: 0, closing: 0 },
      );
      return { category, items: items as Row[], totals };
    })
    .filter((g) => g.items.length > 0);

  const allOpen = closedCats.size === 0 && rows.length > 0 && openAssets.size === rows.length;
  const expandAll = () => {
    setClosedCats(new Set());
    setOpenAssets(new Set(rows.map((r) => r.a.id)));
  };
  const collapseAll = () => {
    setClosedCats(new Set(groups.map((g) => g.category)));
    setOpenAssets(new Set());
  };

  return (
    <>
      <DepPostingCard assets={assets} />

      {/* basis sub-tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {BASES.map((b) => (
          <button
            key={b.key}
            onClick={() => setBasis(b.key)}
            className={cn(
              "flex flex-col items-start rounded-lg border px-3.5 py-2 text-left transition-colors",
              basis === b.key ? "border-primary bg-primary/10" : "border-input hover:bg-accent",
            )}
          >
            <span className={cn("text-sm font-semibold", basis === b.key ? "text-primary" : "text-foreground")}>{b.label}</span>
            <span className="text-[11px] text-muted-foreground">{b.sub}</span>
          </button>
        ))}
      </div>

      {basis === "custom" && (
        <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
          <L label="Method">
            <Select value={custom.method} onChange={(e) => setCustom((c) => ({ ...c, method: e.target.value as CustomDep["method"] }))} className="h-9 w-32">
              <option value="WDV">WDV</option>
              <option value="SLM">SLM</option>
            </Select>
          </L>
          {custom.method === "WDV" ? (
            <L label="Rate % p.a."><Input value={String(custom.rate)} onChange={(e) => setCustom((c) => ({ ...c, rate: parseFloat(e.target.value) || 0 }))} inputMode="decimal" className="h-9 w-24" /></L>
          ) : (
            <L label="Life (years)"><Input value={String(custom.life)} onChange={(e) => setCustom((c) => ({ ...c, life: parseFloat(e.target.value) || 0 }))} inputMode="decimal" className="h-9 w-24" /></L>
          )}
          <L label="Residual %"><Input value={String(custom.residualPct)} onChange={(e) => setCustom((c) => ({ ...c, residualPct: parseFloat(e.target.value) || 0 }))} inputMode="decimal" className="h-9 w-24" /></L>
          <p className="self-center text-xs text-muted-foreground">Applied uniformly across the assets in view.</p>
        </Card>
      )}

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`Depreciation ${fyTag}`} value={totalDep} accent />
        <Kpi label={`Book (Cos. Act) ${fyTag}`} value={totalBook} />
        <Kpi label={`Income-tax ${fyTag}`} value={totalTax} />
        <Kpi label="Book − tax timing diff." value={totalBook - totalTax} />
      </div>

      <div className="mb-2 flex items-center gap-3">
        <p className="text-xs text-muted-foreground">
          {BASES.find((b) => b.key === basis)!.label} — depreciation for {fyTag}, grouped by category. Expand a category, then an asset to see its full schedule.
        </p>
        {groups.length > 0 && (
          <Button size="sm" variant="outline" className="ml-auto h-7 shrink-0 px-2 text-xs" onClick={allOpen ? collapseAll : expandAll}>
            {allOpen ? <ChevronsDownUp className="size-3.5" /> : <ChevronsUpDown className="size-3.5" />}
            {allOpen ? "Collapse all" : "Expand all"}
          </Button>
        )}
      </div>

      {groups.length === 0 && (
        <Card className="p-10 text-center text-sm text-muted-foreground">No assets in this view.</Card>
      )}

      <div className="space-y-3">
        {groups.map(({ category, items, totals }) => {
          const open = !closedCats.has(category);
          return (
            <Card key={category} className="overflow-hidden">
              {/* category header (collapsible) */}
              <button onClick={() => toggleCat(category)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40">
                <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
                <span className="font-semibold">{category}</span>
                <Badge variant="default">{items.length}</Badge>
                <div className="ml-auto flex flex-wrap justify-end gap-x-6 gap-y-1 text-sm tabular">
                  <Leg label="Cost" v={totals.cost} />
                  <Leg label="Opening" v={totals.opening} />
                  <Leg label={`Dep ${fyTag}`} v={totals.dep} accent />
                  <Leg label="Closing" v={totals.closing} />
                </div>
              </button>

              {open && (
                <div className="overflow-x-auto border-t scrollbar-thin">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                        <th className="px-4 py-2.5 font-medium">Asset</th>
                        <th className="px-4 py-2.5 font-medium">Basis</th>
                        <th className="px-4 py-2.5 text-right font-medium">Cost</th>
                        <th className="px-4 py-2.5 text-right font-medium">Opening WDV</th>
                        <th className="px-4 py-2.5 text-right font-medium">Dep {fyTag}</th>
                        <th className="px-4 py-2.5 text-right font-medium">Closing WDV</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map(({ a, sched, opening, dep, closing }) => {
                        const expanded = openAssets.has(a.id);
                        return (
                          <React.Fragment key={a.id}>
                            <tr className="cursor-pointer border-b align-top last:border-0 hover:bg-accent/40" onClick={() => toggleAsset(a.id)}>
                              <td className="px-4 py-2.5">
                                <span className="flex items-center gap-1.5">
                                  <ChevronRight className={cn("size-3.5 shrink-0 text-muted-foreground transition-transform", expanded && "rotate-90")} />
                                  <Link href={`/assets/${a.id}`} onClick={(e) => e.stopPropagation()} className="font-medium hover:underline">{a.name}</Link>
                                </span>
                                <p className="ml-5 text-[11px] text-muted-foreground"><span className="font-mono">{a.tag}</span></p>
                              </td>
                              <td className="px-4 py-2.5 text-xs text-muted-foreground">{basisMeta(a, basis, custom).detail}</td>
                              <td className="px-4 py-2.5 text-right tabular"><Money value={a.cost} /></td>
                              <td className="px-4 py-2.5 text-right tabular text-muted-foreground"><Money value={opening} /></td>
                              <td className="px-4 py-2.5 text-right tabular font-semibold"><Money value={dep} /></td>
                              <td className="px-4 py-2.5 text-right tabular"><Money value={closing} /></td>
                            </tr>
                            {expanded && (
                              <tr className="bg-muted/20">
                                <td colSpan={6} className="px-4 py-3">
                                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Full schedule — {basisMeta(a, basis, custom).label}</p>
                                  <table className="w-full max-w-2xl text-xs">
                                    <thead>
                                      <tr className="border-b text-left text-[10px] uppercase tracking-wide text-muted-foreground">
                                        <th className="py-1.5 pr-4 font-medium">FY</th>
                                        <th className="py-1.5 pr-4 text-right font-medium">Opening</th>
                                        <th className="py-1.5 pr-4 text-right font-medium">Depreciation</th>
                                        <th className="py-1.5 pr-4 text-right font-medium">Closing</th>
                                        <th className="py-1.5 text-right font-medium">Accumulated</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {sched.map((s) => (
                                        <tr key={s.fyStartYear} className={cn("border-b last:border-0", s.fyStartYear === CUR_FY && "bg-primary/5")}>
                                          <td className="py-1.5 pr-4">
                                            {s.label}
                                            {s.fyStartYear === CUR_FY && <Badge variant="primary" className="ml-1.5 text-[9px]">current</Badge>}
                                          </td>
                                          <td className="py-1.5 pr-4 text-right tabular text-muted-foreground"><Money value={s.opening} /></td>
                                          <td className="py-1.5 pr-4 text-right tabular font-medium"><Money value={s.depreciation} /></td>
                                          <td className="py-1.5 pr-4 text-right tabular"><Money value={s.closing} /></td>
                                          <td className="py-1.5 text-right tabular text-muted-foreground"><Money value={s.accumulated} /></td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* grand total */}
      {groups.length > 0 && (
        <Card className="mt-3 flex flex-wrap items-center justify-between gap-2 bg-muted/30 px-4 py-3 text-sm font-semibold">
          <span>Grand total — {rows.length} assets</span>
          <div className="flex flex-wrap justify-end gap-x-6 gap-y-1 tabular">
            <Leg label="Cost" v={groups.reduce((s, g) => s + g.totals.cost, 0)} />
            <Leg label="Opening" v={groups.reduce((s, g) => s + g.totals.opening, 0)} />
            <Leg label={`Dep ${fyTag}`} v={totalDep} accent />
            <Leg label="Closing" v={groups.reduce((s, g) => s + g.totals.closing, 0)} />
          </div>
        </Card>
      )}
    </>
  );
}

// ---- Monthly depreciation posting ----------------------------------------
function DepPostingCard({ assets }: { assets: FixedAsset[] }) {
  const { entries, postMany } = useJournal();
  const months = React.useMemo(() => recentMonths(TODAY), []);
  const [month, setMonth] = React.useState(months[0]);
  const [justPosted, setJustPosted] = React.useState<number | null>(null);

  const plan = React.useMemo(() => planDepreciation(assets, month, entries), [assets, month, entries]);
  React.useEffect(() => setJustPosted(null), [month]);

  const nothing = plan.groups.length === 0;
  const allPosted = !nothing && plan.drafts.length === 0;

  function post() {
    const { posted } = postMany(plan.drafts);
    setJustPosted(posted);
  }

  return (
    <Card className="mb-4 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Monthly depreciation posting</h3>
        </div>
        <Select value={month} onChange={(e) => setMonth(e.target.value)} className="h-8 w-36 text-xs">
          {months.map((m) => (
            <option key={m} value={m}>{monthLabel(`${m}-01`)}</option>
          ))}
        </Select>

        <div className="ml-auto flex items-center gap-3">
          {nothing ? (
            <span className="text-xs text-muted-foreground">No depreciable assets in service this month.</span>
          ) : allPosted ? (
            <Badge variant="success"><CheckCircle2 className="size-3" /> Posted</Badge>
          ) : (
            <>
              <span className="text-sm">
                Charge to post: <Money value={plan.total} className="font-semibold" />
              </span>
              <Button size="sm" onClick={post}>
                <Wand2 className="size-4" /> Post depreciation
              </Button>
            </>
          )}
        </div>
      </div>

      {!nothing && (
        <div className="mt-3 flex flex-wrap gap-2 border-t pt-3">
          {plan.groups.map((g) => (
            <div key={`${g.entityId}|${g.locationId}`} className="flex items-center gap-2 rounded-md border bg-card px-2.5 py-1.5 text-xs">
              <span className="text-muted-foreground">{entityById(g.entityId)?.name} · {locationById(g.locationId)?.name}</span>
              <Money value={g.amount} compact className="font-medium" />
              {g.posted && <Badge variant="success" className="text-[9px]">posted</Badge>}
            </div>
          ))}
        </div>
      )}

      {justPosted !== null && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-success">
          <CheckCircle2 className="size-3.5" /> Posted {justPosted} depreciation voucher{justPosted === 1 ? "" : "s"} — Dr Depreciation (6080) / Cr Accumulated depreciation (1590).
        </p>
      )}
      <p className="mt-2 text-[11px] text-muted-foreground">
        Books the Companies Act (Schedule II) charge for the month. Already-posted months are detected, so re-running never double-charges.
      </p>
    </Card>
  );
}

function Leg({ label, v, accent }: { label: string; v: number; accent?: boolean }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <Money value={v} compact className={cn("font-semibold", accent && "text-primary")} />
    </span>
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

function AddAssetForm({ created, onAdd, postError }: { created: FixedAsset[]; onAdd: (a: FixedAsset, funding: string) => void; postError: string[] }) {
  const [name, setName] = React.useState("");
  const [category, setCategory] = React.useState<AssetCategory>("Plant & Machinery");
  const [entityId, setEntityId] = React.useState(ENTITIES[0].id);
  const [locationId, setLocationId] = React.useState(locationsForEntity(ENTITIES[0].id)[0].id);
  const [date, setDate] = React.useState(TODAY);
  const [cost, setCost] = React.useState("");
  const [salvagePct, setSalvagePct] = React.useState("5");
  const [benefit, setBenefit] = React.useState("");
  const [supplier, setSupplier] = React.useState("");
  const [funding, setFunding] = React.useState("1020");
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
        <L label="Supplier (optional)"><Input value={supplier} onChange={(e) => setSupplier(e.target.value)} placeholder="vendor name" /></L>
        <L label="Funded by (credit leg)">
          <Select value={funding} onChange={(e) => setFunding(e.target.value)}>
            {FUNDING_OPTIONS.map((f) => <option key={f.code} value={f.code}>{f.label}</option>)}
          </Select>
        </L>
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Adding posts a capitalisation voucher — Dr <span className="font-medium text-foreground">{categoryMeta(category).category}</span> / Cr the funding account — so the gross block ties to the GL.
      </p>
      {postError.length > 0 && (
        <ul className="mt-2 list-inside list-disc rounded-lg border border-danger/40 bg-danger/8 p-2.5 text-xs text-danger">
          {postError.map((e, i) => <li key={i}>{e}</li>)}
        </ul>
      )}
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
              supplier: supplier.trim() || undefined,
            }, funding);
          }}
        >
          <Plus className="size-4" /> Capitalise & add
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
