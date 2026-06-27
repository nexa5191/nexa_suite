"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft, Search, Package, Factory, Truck, ArrowDown,
  PackageCheck, ScanLine, AlertTriangle, ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CATEGORY_META, itemById } from "@/lib/inventory/items";
import { allMovements, loadAddedMovements, MOVEMENT_META } from "@/lib/inventory/movements";
import {
  traceBatch,
  allBatchNumbers,
  type TraceResult,
  type ProductionRun,
  type TraceMovement,
} from "@/lib/inventory/traceability";

function fmtQty(n: number, uom?: string) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(Math.abs(n)) + (uom ? ` ${uom}` : "");
}

const TYPE_ICON: Partial<Record<string, React.ElementType>> = {
  receipt: PackageCheck,
  opening: Package,
  production: Factory,
  sale: Truck,
  "transfer-out": Truck,
  consumption: ScanLine,
};

export function TraceabilityClient() {
  const [query, setQuery] = React.useState("");
  const [submitted, setSubmitted] = React.useState("");
  const [result, setResult] = React.useState<TraceResult | null>(null);
  const [batches, setBatches] = React.useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = React.useState(false);

  React.useEffect(() => {
    const mvs = allMovements(loadAddedMovements());
    setBatches(allBatchNumbers(mvs));
  }, []);

  function doTrace(q: string) {
    if (!q.trim()) return;
    const mvs = allMovements(loadAddedMovements());
    const r = traceBatch(q.trim(), mvs);
    setResult(r);
    setSubmitted(q.trim());
    setShowSuggestions(false);
  }

  const suggestions = query.length >= 2
    ? batches.filter((b) => b.toLowerCase().includes(query.toLowerCase())).slice(0, 8)
    : [];

  return (
    <>
      <PageHeader
        title="Batch Traceability"
        subtitle="Forward and backward trace — from raw material receipt through production to dispatch."
        actions={
          <Link href="/inventory">
            <Button variant="outline"><ArrowLeft className="size-4" /> Inventory</Button>
          </Link>
        }
      />

      {/* Search */}
      <Card className="mb-6 p-4">
        <p className="mb-2 text-sm font-medium">Enter a batch / lot number</p>
        <div className="relative flex gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => { setQuery(e.target.value); setShowSuggestions(true); }}
              onKeyDown={(e) => { if (e.key === "Enter") doTrace(query); if (e.key === "Escape") setShowSuggestions(false); }}
              placeholder="e.g. WHT-2606, FLR-2605, FL50-2605…"
              className="h-10 pl-10 font-mono"
              autoFocus
            />
            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute top-full left-0 z-20 mt-1 w-full rounded-lg border bg-popover shadow-lg">
                {suggestions.map((b) => (
                  <button
                    key={b}
                    className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
                    onClick={() => { setQuery(b); doTrace(b); }}
                  >
                    <Package className="size-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono">{b}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <Button className="h-10" onClick={() => doTrace(query)}>Trace</Button>
        </div>

        {/* Quick-pick known batches */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          <span className="text-xs text-muted-foreground self-center">Try:</span>
          {["WHT-2606-A", "FLR-2605", "FL50-2605", "AT10-2605", "FL50-2605B"].map((b) => (
            <button
              key={b}
              onClick={() => { setQuery(b); doTrace(b); }}
              className="rounded border px-2 py-0.5 font-mono text-[11px] hover:bg-accent transition-colors"
            >
              {b}
            </button>
          ))}
        </div>
      </Card>

      {/* Not found */}
      {result && !result.found && (
        <Card className="p-8 text-center">
          <AlertTriangle className="mx-auto mb-2 size-8 text-warning" />
          <p className="font-medium">Batch "{submitted}" not found</p>
          <p className="mt-1 text-sm text-muted-foreground">Check the batch number or try a partial search (e.g. "WHT" or "FLR").</p>
        </Card>
      )}

      {/* Trace result */}
      {result?.found && (
        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-primary/10">
              <Package className="size-5 text-primary" />
            </div>
            <div>
              <p className="font-mono text-lg font-bold">{result.batchNo}</p>
              <p className="text-xs text-muted-foreground">
                {result.directMovements.length} direct movement{result.directMovements.length !== 1 ? "s" : ""}
                {result.createdBy.length > 0 && ` · created by ${result.createdBy.length} production run${result.createdBy.length !== 1 ? "s" : ""}`}
                {result.consumedBy.length > 0 && ` · consumed in ${result.consumedBy.length} run${result.consumedBy.length !== 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          {/* Direct movements */}
          <Section title="Batch origin" icon={PackageCheck} iconColor="text-success">
            {result.directMovements.map((m) => (
              <MovementCard key={m.id} m={m} />
            ))}
          </Section>

          {/* Created by production runs */}
          {result.createdBy.length > 0 && (
            <>
              <Connector label="produced by" />
              <Section title="Production runs that created this batch" icon={Factory} iconColor="text-primary">
                {result.createdBy.map((run) => (
                  <ProductionRunCard key={run.ref} run={run} highlightOutputBatch={result.batchNo} />
                ))}
              </Section>
            </>
          )}

          {/* Consumed by downstream runs */}
          {result.consumedBy.length > 0 && (
            <>
              <Connector label="consumed in" />
              <Section title="Downstream production / consumption" icon={Factory} iconColor="text-warning">
                {result.consumedBy.map((run) => (
                  <ProductionRunCard key={run.ref} run={run} />
                ))}
              </Section>
            </>
          )}

          {/* Dispatches */}
          {result.dispatched.length > 0 && (
            <>
              <Connector label="dispatched as" />
              <Section title="Sales dispatches & transfers" icon={Truck} iconColor="text-muted-foreground">
                {result.dispatched.map((m) => (
                  <MovementCard key={m.id} m={m} />
                ))}
              </Section>
            </>
          )}

          {result.consumedBy.length === 0 && result.dispatched.length === 0 && (
            <Card className="border-dashed p-4 text-center text-sm text-muted-foreground">
              No downstream consumption or dispatch found — this batch may still be in stock.
            </Card>
          )}
        </div>
      )}

      {/* Initial state */}
      {!result && (
        <Card className="p-8 text-center text-muted-foreground">
          <Package className="mx-auto mb-3 size-10 opacity-30" />
          <p className="text-sm">Enter a batch or lot number above to trace its journey through the supply chain.</p>
          <p className="mt-1 text-xs">Supports partial search — type "FLR" to find all flour batches.</p>
        </Card>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Section({ title, icon: Icon, iconColor, children }: {
  title: string;
  icon: React.ElementType;
  iconColor: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2">
        <Icon className={cn("size-4 shrink-0", iconColor)} />
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Connector({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground pl-2">
      <ArrowDown className="size-3.5 shrink-0" />
      <span>{label}</span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}

function MovementCard({ m, highlight }: { m: TraceMovement; highlight?: boolean }) {
  const item = itemById(m.itemId);
  const meta = MOVEMENT_META[m.type];
  const Icon = TYPE_ICON[m.type] ?? Package;
  const cat = item ? CATEGORY_META[item.category] : null;
  return (
    <Card className={cn("flex items-start gap-3 px-4 py-3", highlight && "border-primary/40 bg-primary/5")}>
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-muted/30">
        <Icon className="size-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium text-sm">{m.itemName}</span>
          {cat && <Badge variant={cat.variant} className="text-[10px]">{cat.short}</Badge>}
          <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
          {m.batchNo && (
            <span className="rounded border bg-muted/40 px-1.5 py-0 font-mono text-[10px]">{m.batchNo}</span>
          )}
        </div>
        <div className="mt-0.5 flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span>{m.date}</span>
          <span className={cn("font-medium tabular-nums", m.qty > 0 ? "text-success" : "text-warning")}>
            {m.qty > 0 ? "+" : ""}{fmtQty(m.qty, item?.uom)}
          </span>
          {m.ref && <span className="font-mono">{m.ref}</span>}
          {m.note && <span className="truncate max-w-[200px]">{m.note}</span>}
        </div>
      </div>
    </Card>
  );
}

function ProductionRunCard({ run, highlightOutputBatch }: {
  run: ProductionRun;
  highlightOutputBatch?: string;
}) {
  const [expanded, setExpanded] = React.useState(true);
  return (
    <Card className="overflow-hidden">
      <button
        className="flex w-full items-center gap-3 px-4 py-3 hover:bg-accent/40 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 border border-primary/20">
          <Factory className="size-3.5 text-primary" />
        </div>
        <div className="flex-1 text-left">
          <p className="font-mono text-sm font-semibold">{run.ref}</p>
          <p className="text-xs text-muted-foreground">{run.date}{run.note ? ` · ${run.note}` : ""}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>{run.inputs.length} input{run.inputs.length !== 1 ? "s" : ""}</span>
          <span>→</span>
          <span>{run.outputs.length} output{run.outputs.length !== 1 ? "s" : ""}</span>
          <ChevronRight className={cn("size-4 transition-transform", expanded && "rotate-90")} />
        </div>
      </button>

      {expanded && (
        <div className="border-t px-4 py-3">
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Inputs */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Inputs consumed</p>
              {run.inputs.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
              {run.inputs.map((m) => {
                const item = itemById(m.itemId);
                const cat = item ? CATEGORY_META[item.category] : null;
                return (
                  <div key={m.id} className="flex items-center gap-2 py-1 border-b last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{m.itemName}</p>
                      {m.batchNo && <p className="font-mono text-[10px] text-muted-foreground">{m.batchNo}</p>}
                    </div>
                    {cat && <Badge variant={cat.variant} className="text-[10px] shrink-0">{cat.short}</Badge>}
                    <span className="text-xs tabular-nums text-warning shrink-0">
                      {fmtQty(m.qty, item?.uom)}
                    </span>
                  </div>
                );
              })}
            </div>
            {/* Outputs */}
            <div>
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Outputs produced</p>
              {run.outputs.length === 0 && <p className="text-xs text-muted-foreground">—</p>}
              {run.outputs.map((m) => {
                const item = itemById(m.itemId);
                const cat = item ? CATEGORY_META[item.category] : null;
                const isHighlighted = highlightOutputBatch && m.batchNo === highlightOutputBatch;
                return (
                  <div key={m.id} className={cn("flex items-center gap-2 py-1 border-b last:border-0 rounded", isHighlighted && "bg-primary/5")}>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{m.itemName}</p>
                      {m.batchNo && (
                        <p className={cn("font-mono text-[10px]", isHighlighted ? "text-primary font-semibold" : "text-muted-foreground")}>
                          {m.batchNo} {isHighlighted && "← this batch"}
                        </p>
                      )}
                    </div>
                    {cat && <Badge variant={cat.variant} className="text-[10px] shrink-0">{cat.short}</Badge>}
                    <span className="text-xs tabular-nums text-success shrink-0">
                      +{fmtQty(m.qty, item?.uom)}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
