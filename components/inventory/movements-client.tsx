"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ArrowDownRight, ArrowUpRight, ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/modal";
import { cn, formatDate } from "@/lib/utils";
import { LOCATIONS, locationById, ALL } from "@/lib/accounting/org";
import { employeeName } from "@/lib/hr/employees";
import { itemById } from "@/lib/inventory/items";
import {
  loadAddedMovements,
  allMovements,
  MOVEMENT_META,
  daysToExpiry,
} from "@/lib/inventory/movements";
import type { Movement, MovementType } from "@/lib/inventory/types";

function fmtQty(n: number) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2, signDisplay: "always" }).format(n);
}

const TYPES: MovementType[] = ["opening", "receipt", "production", "consumption", "transfer-in", "transfer-out", "sale", "adjustment"];

const todayIso = () => new Date().toISOString().slice(0, 10);

/** Small badge describing a batch's expiry status. */
function ExpiryBadge({ expiry }: { expiry: string }) {
  const d = daysToExpiry(expiry, todayIso());
  const variant = d < 0 ? "danger" : d <= 30 ? "warning" : "default";
  const label = d < 0 ? `Expired ${formatDate(expiry)}` : d <= 30 ? `Expires in ${d}d` : `Exp ${formatDate(expiry)}`;
  return <Badge variant={variant}>{label}</Badge>;
}

export function MovementsClient() {
  const [moves, setMoves] = React.useState<Movement[]>(() => allMovements([]));
  const [type, setType] = React.useState<MovementType | "all">("all");
  const [loc, setLoc] = React.useState(ALL);
  const [selected, setSelected] = React.useState<Movement | null>(null);

  React.useEffect(() => {
    setMoves(allMovements(loadAddedMovements()));
  }, []);

  const rows = moves
    .filter((m) => (type === "all" ? true : m.type === type))
    .filter((m) => (loc === ALL ? true : m.locationId === loc))
    .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));

  return (
    <>
      <PageHeader
        title="Stock ledger"
        subtitle="Every inflow and outflow across raw, packing, WIP and finished goods."
        actions={
          <Link href="/inventory">
            <Button variant="outline">
              <ArrowLeft className="size-4" /> Back to inventory
            </Button>
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Select value={type} onChange={(e) => setType(e.target.value as MovementType | "all")} className="h-9 w-48 text-sm">
          <option value="all">All movement types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>{MOVEMENT_META[t].label}</option>
          ))}
        </Select>
        <Select value={loc} onChange={(e) => setLoc(e.target.value)} className="h-9 w-48 text-sm">
          <option value={ALL}>All locations</option>
          {LOCATIONS.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </Select>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length} movements</span>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 font-medium">Item</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium">Type</th>
                <th className="px-5 py-3 text-right font-medium">Qty</th>
                <th className="px-5 py-3 font-medium">Batch / Expiry</th>
                <th className="px-5 py-3 font-medium">Reference</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No movements in this view.
                  </td>
                </tr>
              )}
              {rows.map((m) => {
                const item = itemById(m.itemId);
                const meta = MOVEMENT_META[m.type];
                const inflow = m.qty >= 0;
                return (
                  <tr
                    key={m.id}
                    onClick={() => setSelected(m)}
                    className="cursor-pointer border-b align-top transition-colors last:border-0 hover:bg-accent/50"
                  >
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(m.date)}</td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{item?.name ?? m.itemId}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{item?.code}</p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{locationById(m.locationId)?.name ?? m.locationId}</td>
                    <td className="px-5 py-3">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className={cn("inline-flex items-center gap-1 font-semibold tabular-nums", inflow ? "text-success" : "text-danger")}>
                        {inflow ? <ArrowDownRight className="size-3.5" /> : <ArrowUpRight className="size-3.5" />}
                        {fmtQty(m.qty)} <span className="text-xs font-normal text-muted-foreground">{item?.uom}</span>
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      {m.batchNo ? (
                        <div className="flex flex-col items-start gap-0.5">
                          <span className="font-mono text-[11px]">{m.batchNo}</span>
                          {m.expiry && <ExpiryBadge expiry={m.expiry} />}
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          {m.ref && <p className="font-mono text-xs">{m.ref}</p>}
                          {m.note && <p className="text-xs text-muted-foreground">{m.note}</p>}
                          {m.byId && <p className="text-[11px] text-muted-foreground">{employeeName(m.byId)}</p>}
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

      <MovementDrawer movement={selected} onClose={() => setSelected(null)} />
    </>
  );
}

/** Human label for a reference, inferred from its prefix. */
function refLabel(ref?: string): string {
  if (!ref) return "Reference";
  if (ref.startsWith("PO-")) return "Purchase order";
  if (ref.startsWith("PROD-")) return "Production run";
  if (ref.startsWith("TRF-")) return "Transfer";
  if (ref.startsWith("ADJ-")) return "Adjustment";
  if (ref.startsWith("NXF")) return "Sales invoice";
  return "Reference";
}

function MovementDrawer({ movement: m, onClose }: { movement: Movement | null; onClose: () => void }) {
  if (!m) return null;
  const item = itemById(m.itemId);
  const meta = MOVEMENT_META[m.type];
  const inflow = m.qty >= 0;
  const loc = locationById(m.locationId)?.name ?? m.locationId;
  // transfer-in arrives AT this location; transfer-out departs FROM it.
  const fromLoc = m.type === "transfer-out" ? loc : m.type === "transfer-in" ? "—" : loc;
  const toLoc = m.type === "transfer-in" ? loc : m.type === "transfer-out" ? "—" : loc;
  const isTransfer = m.type === "transfer-in" || m.type === "transfer-out";

  return (
    <Drawer
      open={!!m}
      onClose={onClose}
      title={item?.name ?? m.itemId}
      subtitle={
        <span className="font-mono">
          {item?.code} · {formatDate(m.date)}
        </span>
      }
      actions={<Badge variant={meta.variant}>{meta.label}</Badge>}
    >
      <div className="space-y-5">
        <div className="rounded-lg border bg-muted/20 p-4 text-center">
          <span
            className={cn(
              "inline-flex items-center gap-1.5 text-2xl font-bold tabular-nums",
              inflow ? "text-success" : "text-danger",
            )}
          >
            {inflow ? <ArrowDownRight className="size-5" /> : <ArrowUpRight className="size-5" />}
            {fmtQty(m.qty)}
            <span className="text-sm font-normal text-muted-foreground">{item?.uom}</span>
          </span>
          {m.stdQty !== undefined && (
            <p className="mt-1 text-xs text-muted-foreground">
              Standard {fmtQty(m.stdQty)} {item?.uom}
            </p>
          )}
        </div>

        <dl className="grid grid-cols-2 gap-3">
          <Field label="Movement type" value={meta.label} />
          <Field label="Date" value={formatDate(m.date)} />
          {isTransfer ? (
            <>
              <Field label="From location" value={fromLoc} />
              <Field label="To location" value={toLoc} />
            </>
          ) : (
            <Field label="Location" value={loc} />
          )}
          <Field label={refLabel(m.ref)} value={m.ref ?? "—"} mono />
          {m.byId && <Field label="Posted by" value={employeeName(m.byId)} />}
          {m.batchNo && <Field label="Batch / lot" value={m.batchNo} mono />}
          {m.expiry && (
            <div>
              <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Expiry</dt>
              <dd className="mt-0.5"><ExpiryBadge expiry={m.expiry} /></dd>
            </div>
          )}
        </dl>

        {m.note && (
          <div>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Memo</p>
            <p className="text-sm">{m.note}</p>
          </div>
        )}

        {m.ref?.startsWith("PROD-") && (
          <Link href="/inventory/production" className="block">
            <Button variant="outline" className="w-full justify-between">
              <span>View production runs</span>
              <ChevronRight className="size-4" />
            </Button>
          </Link>
        )}
      </div>
    </Drawer>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={cn("mt-0.5 text-sm", mono && "font-mono")}>{value}</dd>
    </div>
  );
}
