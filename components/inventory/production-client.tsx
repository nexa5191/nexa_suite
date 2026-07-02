"use client";

import * as React from "react";
import Link from "next/link";
import { Factory, ArrowLeft, Check, AlertTriangle, ArrowRight, Scale, ListTree } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { LOCATIONS, locationById } from "@/lib/accounting/org";
import { ACTIVE_EMPLOYEES, employeeName } from "@/lib/hr/employees";
import {
  producibleItems,
  itemById,
  itemName,
  bomFor,
  bomUnitCost,
  CATEGORY_META,
} from "@/lib/inventory/items";
import {
  loadAddedMovements,
  saveAddedMovements,
  allMovements,
  buildStockIndex,
  stockAt,
  buildProductionMovements,
  nextProductionRef,
  allRunVariances,
  type StockIndex,
} from "@/lib/inventory/movements";
import type { Movement } from "@/lib/inventory/types";

function fmtQty(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n);
}
function fmtSigned(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, signDisplay: "always" }).format(n);
}

const PRODUCIBLE = producibleItems();

export function ProductionClient() {
  const [added, setAdded] = React.useState<Movement[]>([]);
  const [idx, setIdx] = React.useState<StockIndex>(() => buildStockIndex(allMovements([])));

  const [outputId, setOutputId] = React.useState(PRODUCIBLE[0]?.id ?? "");
  const [planned, setPlanned] = React.useState("100");
  const [actualOutput, setActualOutput] = React.useState("100");
  const [actuals, setActuals] = React.useState<Record<string, string>>({});
  const [locationId, setLocationId] = React.useState("loc-mys");
  const [byId, setById] = React.useState("emp-020");
  const [flash, setFlash] = React.useState<string | null>(null);

  React.useEffect(() => {
    const a = loadAddedMovements();
    setAdded(a);
    setIdx(buildStockIndex(allMovements(a)));
  }, []);

  const output = itemById(outputId);
  const plannedQty = parseFloat(planned) || 0;
  const bom = bomFor(outputId);

  // Reset actual consumption + output to the standard whenever the plan changes.
  React.useEffect(() => {
    const next: Record<string, string> = {};
    for (const c of bomFor(outputId)) next[c.itemId] = String(c.qtyPerUnit * (parseFloat(planned) || 0));
    setActuals(next);
    setActualOutput(planned);
  }, [outputId, planned]);

  const lines = bom.map((c) => {
    const std = c.qtyPerUnit * plannedQty;
    const actual = actuals[c.itemId] === undefined ? std : parseFloat(actuals[c.itemId]) || 0;
    const available = stockAt(idx, c.itemId, locationId);
    const rate = itemById(c.itemId)?.rate ?? 0;
    return { itemId: c.itemId, std, actual, available, short: available < actual, rate, qtyVar: actual - std, costVar: (actual - std) * rate };
  });

  const anyShort = lines.some((l) => l.short);
  const stdCost = lines.reduce((s, l) => s + l.std * l.rate, 0);
  const actualCost = lines.reduce((s, l) => s + l.actual * l.rate, 0);
  const costVar = actualCost - stdCost;
  const actualOut = parseFloat(actualOutput) || 0;
  const yieldVar = actualOut - plannedQty;

  function run() {
    if (!output || plannedQty <= 0 || actualOut <= 0 || anyShort) return;
    const ref = nextProductionRef(added);
    const moves = buildProductionMovements({
      outputId,
      plannedQty,
      actualQty: actualOut,
      components: lines.map((l) => ({ itemId: l.itemId, actualQty: l.actual })),
      locationId,
      ref,
      byId,
    });
    const next = [...added, ...moves];
    setAdded(next);
    saveAddedMovements(next);
    setIdx(buildStockIndex(allMovements(next)));
    setFlash(`${ref}: produced ${fmtQty(actualOut)} ${output.uom} of ${output.name} · cost variance ${fmtSigned(costVar)}`);
  }

  const runs = React.useMemo(() => allRunVariances(allMovements(added)), [added]);

  // ITEMS is empty during SSR (localStorage isn't available on the server),
  // so no producible item may exist yet — avoid crashing until it hydrates.
  if (!output) {
    return (
      <>
        <PageHeader title="Production" subtitle="Run a production order against its BOM and capture standard-vs-actual variance." />
        <Card className="p-8 text-center text-sm text-muted-foreground">No producible items yet — load demo data from Settings.</Card>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Production"
        subtitle="Run a production order against its BOM and capture standard-vs-actual variance."
        actions={
          <div className="flex gap-2">
            <Link href="/inventory/bom">
              <Button variant="outline">
                <ListTree className="size-4" /> Bill of Materials
              </Button>
            </Link>
            <Link href="/inventory">
              <Button variant="outline">
                <ArrowLeft className="size-4" /> Inventory
              </Button>
            </Link>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Run a production order */}
        <Card className="space-y-4 p-5">
          <p className="text-sm font-semibold">New production order</p>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Produce">
              <Select value={outputId} onChange={(e) => setOutputId(e.target.value)} className="w-full">
                <optgroup label="Semi-finished (WIP)">
                  {PRODUCIBLE.filter((i) => i.category === "semi-finished").map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </optgroup>
                <optgroup label="Finished goods">
                  {PRODUCIBLE.filter((i) => i.category === "finished").map((i) => (
                    <option key={i.id} value={i.id}>{i.name}</option>
                  ))}
                </optgroup>
              </Select>
            </Field>
            <Field label="At location">
              <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="w-full">
                {LOCATIONS.map((l) => (
                  <option key={l.id} value={l.id}>{l.name}</option>
                ))}
              </Select>
            </Field>
            <Field label={`Planned qty (${output.uom})`}>
              <Input type="number" min="0" value={planned} onChange={(e) => setPlanned(e.target.value)} />
            </Field>
            <Field label={`Actual output (${output.uom})`}>
              <Input
                type="number"
                min="0"
                value={actualOutput}
                onChange={(e) => setActualOutput(e.target.value)}
                className={cn(yieldVar < 0 && "border-danger/50")}
              />
            </Field>
            <Field label="Supervised by">
              <Select value={byId} onChange={(e) => setById(e.target.value)} className="w-full">
                {ACTIVE_EMPLOYEES.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </Select>
            </Field>
          </div>

          {/* BOM consumption — standard vs actual, editable */}
          <div className="rounded-lg border">
            <div className="grid grid-cols-12 gap-2 border-b bg-muted/40 px-3 py-2 text-[10px] uppercase tracking-wide text-muted-foreground">
              <span className="col-span-5">Component</span>
              <span className="col-span-2 text-right">Standard</span>
              <span className="col-span-3 text-right">Actual</span>
              <span className="col-span-2 text-right">Var</span>
            </div>
            <div className="divide-y">
              {lines.map((l) => {
                const comp = itemById(l.itemId)!;
                return (
                  <div key={l.itemId} className="grid grid-cols-12 items-center gap-2 px-3 py-2 text-sm">
                    <div className="col-span-5">
                      <p className="flex items-center gap-1.5 font-medium leading-tight">
                        {comp.name}
                        <Badge variant={CATEGORY_META[comp.category].variant} className="text-[10px]">
                          {CATEGORY_META[comp.category].short}
                        </Badge>
                      </p>
                      <p className="text-[11px] text-muted-foreground">avail {fmtQty(l.available)} {comp.uom}</p>
                    </div>
                    <div className="col-span-2 text-right tabular-nums text-muted-foreground">{fmtQty(l.std)}</div>
                    <div className="col-span-3">
                      <Input
                        type="number"
                        min="0"
                        value={actuals[l.itemId] ?? ""}
                        onChange={(e) => setActuals((p) => ({ ...p, [l.itemId]: e.target.value }))}
                        className={cn("h-8 text-right text-sm", l.short && "border-danger text-danger")}
                      />
                    </div>
                    <div className={cn("col-span-2 text-right text-xs tabular-nums", l.qtyVar > 0 ? "text-danger" : l.qtyVar < 0 ? "text-success" : "text-muted-foreground")}>
                      {l.qtyVar === 0 ? "—" : fmtSigned(l.qtyVar)}
                    </div>
                    {l.short && (
                      <p className="col-span-12 flex items-center gap-1 text-[11px] text-danger">
                        <AlertTriangle className="size-3" /> short {fmtQty(l.actual - l.available)} {comp.uom} at {locationById(locationId)?.name}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center justify-between border-t bg-muted/20 px-3 py-2 text-sm">
              <span className="flex items-center gap-1.5 font-medium">
                <ArrowRight className="size-3.5 text-success" /> Yields {fmtQty(actualOut)} {output.uom}
                {yieldVar !== 0 && (
                  <span className={cn("text-xs", yieldVar < 0 ? "text-danger" : "text-success")}>
                    ({fmtSigned(yieldVar)} vs plan)
                  </span>
                )}
              </span>
              <span className="text-xs text-muted-foreground">unit std <Money value={bomUnitCost(outputId)} /></span>
            </div>
          </div>

          {/* Variance summary */}
          <div className="grid grid-cols-3 gap-2">
            <VarBox label="Std cost" value={<Money value={stdCost} />} />
            <VarBox label="Actual cost" value={<Money value={actualCost} />} />
            <VarBox
              label="Variance"
              value={<Money value={costVar} />}
              tone={costVar > 0 ? "bad" : costVar < 0 ? "good" : undefined}
              hint={costVar > 0 ? "unfavourable" : costVar < 0 ? "favourable" : "on standard"}
            />
          </div>

          <Button className="w-full" onClick={run} disabled={plannedQty <= 0 || actualOut <= 0 || anyShort}>
            <Factory className="size-4" />
            {anyShort ? "Insufficient stock" : "Run production"}
          </Button>
          {flash && (
            <p className="flex items-center gap-1.5 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-sm text-success">
              <Check className="size-4" /> {flash}
            </p>
          )}
        </Card>

        {/* Recent runs with variance */}
        <Card className="p-5">
          <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold">
            <Scale className="size-4" /> Production runs · std vs actual
          </p>
          <div className="space-y-2">
            {runs.length === 0 && <p className="text-sm text-muted-foreground">No production runs yet.</p>}
            {runs.map((r) => {
              const unfav = r.costVar > 0.5;
              const fav = r.costVar < -0.5;
              return (
                <div key={r.ref} className="rounded-lg border p-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-medium">{itemName(r.outputId)}</p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">{r.ref}</span> · {formatDate(r.date)} · {locationById(r.locationId)?.name}
                        {r.byId && ` · ${employeeName(r.byId)}`}
                      </p>
                    </div>
                    <Badge variant={unfav ? "danger" : fav ? "success" : "default"}>
                      {unfav ? "Unfavourable" : fav ? "Favourable" : "On std"}
                    </Badge>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                    <Mini label="Output" value={`${fmtQty(r.actualQty)}${r.yieldVar !== 0 ? ` (${fmtSigned(r.yieldVar)})` : ""}`} tone={r.yieldVar < 0 ? "bad" : undefined} />
                    <Mini label="Std cost" value={<Money value={r.stdCost} compact />} />
                    <Mini label="Cost var" value={<Money value={r.costVar} compact />} tone={unfav ? "bad" : fav ? "good" : undefined} />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

function VarBox({ label, value, tone, hint }: { label: string; value: React.ReactNode; tone?: "good" | "bad"; hint?: string }) {
  return (
    <div className={cn("rounded-lg border p-3", tone === "bad" && "border-danger/40 bg-danger/5", tone === "good" && "border-success/40 bg-success/5")}>
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 font-bold tabular", tone === "bad" && "text-danger", tone === "good" && "text-success")}>{value}</p>
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-md bg-muted/30 px-2 py-1.5">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("font-medium tabular", tone === "bad" && "text-danger", tone === "good" && "text-success")}>{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
