"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Factory, ListTree, CornerDownRight, Layers } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Money } from "@/components/ui/money";
import {
  producibleItems,
  itemById,
  bomFor,
  bomUnitCost,
  explodeBom,
  explodedUnitCost,
  hasBom,
  CATEGORY_META,
} from "@/lib/inventory/items";

function fmtQty(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 3 }).format(n);
}

const PRODUCIBLE = producibleItems();

export function BomClient() {
  const [selectedId, setSelectedId] = React.useState(
    PRODUCIBLE.find((i) => i.category === "finished")?.id ?? PRODUCIBLE[0]?.id ?? "",
  );
  const output = itemById(selectedId);

  // ITEMS is empty during SSR (localStorage isn't available on the server),
  // so no producible item may exist yet — avoid crashing until it hydrates.
  if (!output) {
    return (
      <>
        <PageHeader title="Bill of Materials" subtitle="Standard recipes for every semi-finished and finished item, costed to raw + packing." />
        <Card className="p-8 text-center text-sm text-muted-foreground">No producible items yet — load demo data from Settings.</Card>
      </>
    );
  }

  const bom = bomFor(selectedId);
  const exploded = explodeBom(selectedId, 1).sort((a, b) => {
    const ca = CATEGORY_META[itemById(a.itemId)!.category].order;
    const cb = CATEGORY_META[itemById(b.itemId)!.category].order;
    return ca - cb;
  });
  const oneLevel = bomUnitCost(selectedId);
  const fullCost = explodedUnitCost(selectedId);

  return (
    <>
      <PageHeader
        title="Bill of Materials"
        subtitle="Standard recipes for every semi-finished and finished item, costed to raw + packing."
        actions={
          <div className="flex gap-2">
            <Link href="/inventory/production">
              <Button variant="outline">
                <Factory className="size-4" /> Production
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

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_1fr]">
        {/* item list */}
        <div className="space-y-3">
          {(["semi-finished", "finished"] as const).map((cat) => (
            <div key={cat}>
              <p className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {CATEGORY_META[cat].label}
              </p>
              <div className="space-y-1">
                {PRODUCIBLE.filter((i) => i.category === cat).map((i) => (
                  <button
                    key={i.id}
                    onClick={() => setSelectedId(i.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border p-2.5 text-left text-sm transition-colors",
                      i.id === selectedId ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-accent/50",
                    )}
                  >
                    <span className="truncate">{i.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      <Money value={explodedUnitCost(i.id)} compact />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* detail */}
        <div className="space-y-4">
          <Card className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ListTree className="size-5" />
                </span>
                <div>
                  <p className="text-lg font-bold leading-tight">{output.name}</p>
                  <p className="text-sm text-muted-foreground">
                    <span className="font-mono">{output.code}</span> · 1 {output.uom} ·{" "}
                    <Badge variant={CATEGORY_META[output.category].variant} className="text-[10px]">
                      {CATEGORY_META[output.category].short}
                    </Badge>
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground">Std cost / unit</p>
                <p className="text-xl font-bold tabular">
                  <Money value={fullCost} />
                </p>
              </div>
            </div>
          </Card>

          {/* direct BOM (one level) */}
          <Card className="overflow-hidden">
            <div className="border-b bg-muted/40 px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Direct components (per {output.uom})
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Component</th>
                  <th className="px-5 py-2.5 text-right font-medium">Qty / unit</th>
                  <th className="px-5 py-2.5 text-right font-medium">Rate</th>
                  <th className="px-5 py-2.5 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {bom.map((c) => {
                  const comp = itemById(c.itemId)!;
                  const meta = CATEGORY_META[comp.category];
                  const built = hasBom(c.itemId);
                  return (
                    <tr key={c.itemId} className="border-b last:border-0">
                      <td className="px-5 py-2.5">
                        <p className="flex items-center gap-1.5 font-medium">
                          {comp.name}
                          <Badge variant={meta.variant} className="text-[10px]">{meta.short}</Badge>
                          {built && <span className="text-[10px] text-muted-foreground">(sub-assembly)</span>}
                        </p>
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {fmtQty(c.qtyPerUnit)} {comp.uom}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Money value={comp.rate} />
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Money value={comp.rate * c.qtyPerUnit} />
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/20 font-semibold">
                  <td className="px-5 py-2.5" colSpan={3}>Direct cost (this level)</td>
                  <td className="px-5 py-2.5 text-right">
                    <Money value={oneLevel} />
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>

          {/* exploded BOM */}
          <Card className="overflow-hidden">
            <div className="flex items-center gap-1.5 border-b bg-muted/40 px-5 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <Layers className="size-3.5" /> Exploded to raw + packing (per {output.uom})
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-2.5 font-medium">Leaf material</th>
                  <th className="px-5 py-2.5 text-right font-medium">Total qty</th>
                  <th className="px-5 py-2.5 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody>
                {exploded.map((c) => {
                  const comp = itemById(c.itemId)!;
                  const meta = CATEGORY_META[comp.category];
                  return (
                    <tr key={c.itemId} className="border-b last:border-0">
                      <td className="px-5 py-2.5">
                        <p className="flex items-center gap-1.5">
                          <CornerDownRight className="size-3.5 text-muted-foreground" />
                          {comp.name}
                          <Badge variant={meta.variant} className="text-[10px]">{meta.short}</Badge>
                        </p>
                      </td>
                      <td className="px-5 py-2.5 text-right tabular-nums">
                        {fmtQty(c.qty)} {comp.uom}
                      </td>
                      <td className="px-5 py-2.5 text-right">
                        <Money value={c.cost} />
                      </td>
                    </tr>
                  );
                })}
                <tr className="bg-muted/20 font-semibold">
                  <td className="px-5 py-2.5" colSpan={2}>Fully-exploded standard cost</td>
                  <td className="px-5 py-2.5 text-right">
                    <Money value={fullCost} />
                  </td>
                </tr>
              </tbody>
            </table>
          </Card>
        </div>
      </div>
    </>
  );
}
