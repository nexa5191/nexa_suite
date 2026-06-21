"use client";

import * as React from "react";
import Link from "next/link";
import { Factory, ArrowLeftRight, AlertTriangle, PackageX, Boxes, ListTree, ChevronRight, Pencil, Check, X, TrendingUp, ClipboardList, PackageCheck, ScanLine, PackageOpen } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { Drawer } from "@/components/ui/modal";
import { VoucherButton } from "@/components/accounting/voucher-button";
import { KpiStrip, type Kpi } from "@/components/accounting/kpi-strip";
import { cn } from "@/lib/utils";
import { LOCATIONS, locationById, ALL } from "@/lib/accounting/org";
import {
  ITEMS,
  CATEGORY_META,
  CATEGORY_ORDER,
  OWNERSHIP_META,
  itemsByCategory,
  hasBom,
  bomUnitCost,
  altUomOf,
  packLabel,
  loadUomOverrides,
  saveUomOverrides,
  type AltUom,
} from "@/lib/inventory/items";
import { Input } from "@/components/ui/input";
import {
  loadAddedMovements,
  buildStockIndex,
  allMovements,
  stockAt,
  stockTotal,
  stockLocations,
  totalStockValue,
  lowStockItems,
  type StockIndex,
} from "@/lib/inventory/movements";
import type { Item, ItemCategory } from "@/lib/inventory/types";

const LOC_SHORT: Record<string, string> = {
  "loc-blr": "BLR", "loc-mys": "MYS", "loc-mum": "MUM", "loc-del": "DEL", "loc-sg": "SG",
};

function fmtQty(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}

export function InventoryClient() {
  const [idx, setIdx] = React.useState<StockIndex>(() => buildStockIndex(allMovements([])));
  const [tab, setTab] = React.useState<ItemCategory | "all">("all");
  const [loc, setLoc] = React.useState<string>(ALL);
  const [selected, setSelected] = React.useState<Item | null>(null);
  const [uomOverrides, setUomOverrides] = React.useState<Record<string, AltUom | null>>({});

  React.useEffect(() => {
    setIdx(buildStockIndex(allMovements(loadAddedMovements())));
    setUomOverrides(loadUomOverrides());
  }, []);

  function saveOverride(itemId: string, alt: AltUom | null) {
    const next = { ...uomOverrides, [itemId]: alt };
    setUomOverrides(next);
    saveUomOverrides(next);
  }

  const totalValue = totalStockValue(idx);
  const low = lowStockItems(idx);

  const stageKpis: Kpi[] = CATEGORY_ORDER.map((c) => {
    const meta = CATEGORY_META[c];
    const items = itemsByCategory(c);
    const value = items.reduce((s, it) => s + stockTotal(idx, it.id) * it.rate, 0);
    const detail = items
      .map((it) => ({ label: it.name, value: stockTotal(idx, it.id) * it.rate }))
      .sort((a, b) => b.value - a.value);
    return {
      label: `${meta.label} (${items.length} SKUs)`,
      value,
      sub: meta.short,
      detail,
      detailTitle: `${meta.short} — top SKUs by value`,
    };
  });

  const shownItems = (tab === "all" ? ITEMS : itemsByCategory(tab)).filter((it) => {
    if (loc === ALL) return true;
    return stockAt(idx, it.id, loc) !== 0;
  });

  return (
    <>
      <PageHeader
        title="Inventory"
        subtitle="Manufacturing stock — raw, packing, semi-finished and finished goods."
        actions={
          <div className="flex gap-2">
            <Link href="/inventory/planning">
              <Button variant="outline">
                <TrendingUp className="size-4" /> Demand Plan
              </Button>
            </Link>
            <Link href="/inventory/bom">
              <Button variant="outline">
                <ListTree className="size-4" /> BOM
              </Button>
            </Link>
            <Link href="/inventory/movements">
              <Button variant="outline">
                <ArrowLeftRight className="size-4" /> Stock ledger
              </Button>
            </Link>
            <Link href="/inventory/production">
              <Button variant="outline">
                <Factory className="size-4" /> Production
              </Button>
            </Link>
            <VoucherButton type="stock" label="Stock journal" />
          </div>
        }
      />

      {/* Supply-chain quick actions */}
      <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/inventory/requisitions", icon: ClipboardList, label: "Purchase Requisitions", sub: "Raise a buy request" },
          { href: "/inventory/grn", icon: PackageCheck, label: "Goods Receipts", sub: "Record inbound stock" },
          { href: "/inventory/stock-count", icon: ScanLine, label: "Stock Count", sub: "Physical vs system qty" },
          { href: "/inventory/issues", icon: PackageOpen, label: "Material Issues", sub: "Issue to production" },
        ].map(({ href, icon: Icon, label, sub }) => (
          <Link key={href} href={href}>
            <div className="flex items-center gap-3 rounded-lg border bg-card p-3 hover:bg-accent/50 transition-colors cursor-pointer">
              <Icon className="size-5 shrink-0 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">{label}</p>
                <p className="text-xs text-muted-foreground">{sub}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Top metrics */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <MetricMoney label="Total stock value" value={totalValue} />
        <Metric label="SKUs tracked" value={String(ITEMS.length)} />
        <Metric label="Low-stock items" value={String(low.length)} highlight={low.length > 0} />
        <Metric label="Stock locations" value={String(LOCATIONS.length)} />
      </div>

      {/* Value by stage — flip each card for its per-SKU breakdown */}
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Stock value by stage <span className="normal-case text-muted-foreground/70">· tap a card for the SKU breakdown</span>
      </p>
      <KpiStrip items={stageKpis} />

      {/* Low-stock alerts */}
      {low.length > 0 && (
        <Card className="mb-4 border-warning/40 p-4">
          <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold text-warning">
            <AlertTriangle className="size-4" /> Reorder alerts
          </p>
          <div className="flex flex-wrap gap-2">
            {low.map(({ item, onHand }) => (
              <span key={item.id} className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/5 px-2.5 py-1 text-xs">
                <PackageX className="size-3.5 text-warning" />
                <span className="font-medium">{item.name}</span>
                <span className="text-muted-foreground">
                  {fmtQty(onHand)} / {fmtQty(item.reorderLevel)} {item.uom}
                </span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1">
          {(["all", ...CATEGORY_ORDER] as const).map((c) => (
            <button
              key={c}
              onClick={() => setTab(c)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                tab === c ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {c === "all" ? "All" : CATEGORY_META[c].label}
            </button>
          ))}
        </div>
        <Select value={loc} onChange={(e) => setLoc(e.target.value)} className="h-8 w-44 text-xs">
          <option value={ALL}>All locations</option>
          {LOCATIONS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>

      {/* Item master */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Category</th>
                <th className="px-5 py-3 text-right font-medium">{loc === ALL ? "On hand" : "At location"}</th>
                <th className="px-5 py-3 font-medium">By location</th>
                <th className="px-5 py-3 text-right font-medium">Rate</th>
                <th className="px-5 py-3 text-right font-medium">Value</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shownItems.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No items in this view.
                  </td>
                </tr>
              )}
              {shownItems.map((it) => {
                const meta = CATEGORY_META[it.category];
                const onHand = loc === ALL ? stockTotal(idx, it.id) : stockAt(idx, it.id, loc);
                const groupOnHand = stockTotal(idx, it.id);
                const value = onHand * it.rate;
                const isLow = groupOnHand < it.reorderLevel;
                const locs = stockLocations(idx, it.id);
                return (
                  <tr
                    key={it.id}
                    onClick={() => setSelected(it)}
                    className="cursor-pointer border-b align-top transition-colors last:border-0 hover:bg-accent/50"
                  >
                    <td className="px-5 py-3">
                      <p className="flex items-center gap-1.5 font-medium">
                        <Boxes className="size-3.5 text-muted-foreground" /> {it.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{it.code} · HSN {it.hsn}</p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-col items-start gap-1">
                        <Badge variant={meta.variant} className="text-[10px]">{meta.short}</Badge>
                        {it.ownership && (it.category === "finished" || it.category === "semi-finished") && (
                          <Badge variant={OWNERSHIP_META[it.ownership].variant} className="text-[10px]">
                            {OWNERSHIP_META[it.ownership].short}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums">
                      <span className={cn("font-semibold", isLow && "text-warning")}>{fmtQty(onHand)}</span>
                      <span className="ml-1 text-xs text-muted-foreground">{it.uom}</span>
                      {(() => {
                        const alt = altUomOf(it, uomOverrides);
                        return alt ? (
                          <div className="text-[11px] text-muted-foreground">
                            1 {alt.unit} = {fmtQty(alt.pack)} {it.uom}
                          </div>
                        ) : null;
                      })()}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {locs.length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                        {locs.map((l) => (
                          <span key={l.locationId} className="rounded border bg-muted/30 px-1.5 py-0.5 text-[11px] text-muted-foreground">
                            {LOC_SHORT[l.locationId] ?? locationById(l.locationId)?.name} {fmtQty(l.qty)}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Money value={it.rate} />
                      {hasBom(it.id) && (
                        <p className="text-[11px] text-muted-foreground">
                          BOM <Money value={bomUnitCost(it.id)} />
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Money value={value} className="font-medium" />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          {isLow ? (
                            <Badge variant="warning">Reorder</Badge>
                          ) : (
                            <Badge variant="success">In stock</Badge>
                          )}
                          <p className="mt-0.5 text-[11px] text-muted-foreground">ROL {fmtQty(it.reorderLevel)}</p>
                        </div>
                        <ChevronRight className="size-4 shrink-0 text-muted-foreground/50" />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <ItemDrawer
        item={selected}
        idx={idx}
        alt={selected ? altUomOf(selected, uomOverrides) : null}
        onSaveAlt={saveOverride}
        onClose={() => setSelected(null)}
      />
    </>
  );
}

function ItemDrawer({
  item,
  idx,
  alt,
  onSaveAlt,
  onClose,
}: {
  item: Item | null;
  idx: StockIndex;
  alt: AltUom | null;
  onSaveAlt: (itemId: string, alt: AltUom | null) => void;
  onClose: () => void;
}) {
  if (!item) return null;
  const meta = CATEGORY_META[item.category];
  const onHand = stockTotal(idx, item.id);
  const value = onHand * item.rate;
  const isLow = onHand < item.reorderLevel;
  const locs = stockLocations(idx, item.id).sort((a, b) => b.qty - a.qty);
  const bom = hasBom(item.id);

  return (
    <Drawer
      open={!!item}
      onClose={onClose}
      title={
        <span className="flex items-center gap-1.5">
          <Boxes className="size-4 text-muted-foreground" /> {item.name}
        </span>
      }
      subtitle={
        <span className="font-mono">
          {item.code} · HSN {item.hsn}
        </span>
      }
      actions={<Badge variant={meta.variant}>{meta.short}</Badge>}
    >
      <div className="space-y-5">
        {isLow && (
          <div className="flex items-center gap-1.5 rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
            <PackageX className="size-3.5" />
            <span className="font-medium">Below reorder level</span>
            <span className="ml-auto tabular-nums">
              {fmtQty(onHand)} / {fmtQty(item.reorderLevel)} {item.uom}
            </span>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3">
          <Field label="Category / stage" value={meta.label} />
          <Field label="Base UoM (BUoM)" value={item.uom} />
          <Field label="Unit cost (rate)">
            <Money value={item.rate} className="font-semibold" />
          </Field>
          <Field label="Stock valuation">
            <Money value={value} className="font-semibold" />
          </Field>
          <Field label="On hand" value={`${fmtQty(onHand)} ${item.uom}`} highlight={isLow} />
          <Field label="Reorder level" value={`${fmtQty(item.reorderLevel)} ${item.uom}`} />
          {item.shelfLifeDays !== undefined && (
            <Field label="Shelf life" value={`${item.shelfLifeDays} days`} />
          )}
          {item.ownership && (
            <Field label="Sourcing model">
              <Badge variant={OWNERSHIP_META[item.ownership].variant}>{OWNERSHIP_META[item.ownership].label}</Badge>
            </Field>
          )}
          {item.manufacturer && <Field label="Manufacturer" value={item.manufacturer} />}
          {item.ownership === "loan-license" && item.conversionRate !== undefined && (
            <Field label="Job-work charge">
              <Money value={item.conversionRate} className="font-semibold" /> <span className="text-xs text-muted-foreground">/{item.uom}</span>
            </Field>
          )}
          {item.ownership === "third-party" && item.buyRate !== undefined && (
            <Field label="Purchase rate">
              <Money value={item.buyRate} className="font-semibold" /> <span className="text-xs text-muted-foreground">/{item.uom}</span>
            </Field>
          )}
          {bom && (
            <Field label="Standard BOM cost">
              <Money value={bomUnitCost(item.id)} className="font-semibold" />
            </Field>
          )}
        </dl>

        <UomEditor item={item} alt={alt} onSave={onSaveAlt} />

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">On-hand by location</p>
          <div className="space-y-1.5">
            {locs.length === 0 && <p className="text-sm text-muted-foreground">No stock on hand.</p>}
            {locs.map((l) => (
              <div key={l.locationId} className="flex items-center justify-between rounded-md border bg-muted/20 px-3 py-2 text-sm">
                <span className="font-medium">{locationById(l.locationId)?.name ?? l.locationId}</span>
                <span className="tabular-nums">
                  {fmtQty(l.qty)} <span className="text-xs text-muted-foreground">{item.uom}</span>
                </span>
              </div>
            ))}
          </div>
        </div>

        {bom && (
          <Link href="/inventory/bom" className="block">
            <Button variant="outline" className="w-full justify-between">
              <span className="flex items-center gap-1.5">
                <ListTree className="size-4" /> View bill of materials
              </span>
              <ChevronRight className="size-4" />
            </Button>
          </Link>
        )}
      </div>
    </Drawer>
  );
}

// Add / edit / clear an item's alternative (case) unit of measure. The base UoM
// is fixed; the case is optional and can be defined here at any time.
function UomEditor({
  item,
  alt,
  onSave,
}: {
  item: Item;
  alt: AltUom | null;
  onSave: (itemId: string, alt: AltUom | null) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const [unit, setUnit] = React.useState(alt?.unit ?? "case");
  const [pack, setPack] = React.useState(String(alt?.pack ?? ""));

  React.useEffect(() => {
    setEditing(false);
    setUnit(alt?.unit ?? "case");
    setPack(String(alt?.pack ?? ""));
  }, [item.id, alt]);

  const packNum = Number(pack);
  const valid = unit.trim().length > 0 && packNum > 0;

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Alternative unit (case)</p>
        {!editing && (
          <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs font-medium text-primary hover:underline">
            <Pencil className="size-3" /> {alt ? "Edit" : "Add"}
          </button>
        )}
      </div>

      {!editing ? (
        alt ? (
          <p className="mt-1 text-sm">
            <span className="font-semibold">1 {alt.unit}</span> = {fmtQty(alt.pack)} {item.uom}
            <span className="ml-1 text-xs text-muted-foreground">({packLabel(item, alt)})</span>
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">No case defined — add one to receive / sell in cases.</p>
        )
      ) : (
        <div className="mt-2 space-y-2">
          <div className="flex items-end gap-2">
            <label className="block flex-1">
              <span className="mb-1 block text-[11px] font-medium text-muted-foreground">Unit name</span>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="case / bag / carton" className="h-8" />
            </label>
            <span className="pb-2 text-xs text-muted-foreground">=</span>
            <label className="block w-24">
              <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{item.uom} / unit</span>
              <Input type="number" min={1} value={pack} onChange={(e) => setPack(e.target.value)} placeholder="12" className="h-8 text-right tabular" />
            </label>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              disabled={!valid}
              onClick={() => {
                onSave(item.id, { unit: unit.trim(), pack: packNum });
                setEditing(false);
              }}
            >
              <Check className="size-3.5" /> Save
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            {alt && (
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto text-danger"
                onClick={() => {
                  onSave(item.id, null);
                  setEditing(false);
                }}
              >
                <X className="size-3.5" /> Remove
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  children,
  highlight,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-sm", highlight && "font-semibold text-warning")}>{children ?? value}</dd>
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", highlight && "border-warning/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular", highlight && "text-warning")}>{value}</p>
    </Card>
  );
}

function MetricMoney({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular">
        <Money value={value} compact />
      </p>
    </Card>
  );
}
