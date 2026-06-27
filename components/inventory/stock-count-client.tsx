"use client";

import * as React from "react";
import Link from "next/link";
import { ScanLine, Plus, ChevronRight, CheckCircle2, TrendingUp, TrendingDown, Minus, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { itemById, itemName } from "@/lib/inventory/items";
import { ACTIVE_EMPLOYEES, employeeName } from "@/lib/hr/employees";
import { LOCATIONS } from "@/lib/accounting/org";
import { allMovements, loadAddedMovements, appendMovements } from "@/lib/inventory/movements";
import {
  allCounts, loadCounts, saveCounts, nextCountRef,
  buildCountAdjustments, COUNT_STATUS_META, stockSnapshot,
  type StockCount, type CountLine, type CountStatus,
} from "@/lib/inventory/supply-chain";

function fmtQty(n: number, uom?: string) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n) + (uom ? ` ${uom}` : "");
}

const TODAY = "2026-06-22";

export function StockCountClient() {
  const [added, setAdded] = React.useState<StockCount[]>([]);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<StockCount | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => { setAdded(loadCounts()); }, []);

  const SEED_IDS = ["sc-001"];

  function persist(next: StockCount[]) {
    const extra = next.filter((c) => !SEED_IDS.includes(c.id));
    setAdded(extra);
    saveCounts(extra);
  }

  const allCountsList = allCounts(added);
  const q = search.toLowerCase();
  const counts = q
    ? allCountsList.filter((c) =>
        c.ref.toLowerCase().includes(q) ||
        employeeName(c.countedBy).toLowerCase().includes(q) ||
        (LOCATIONS.find((l) => l.id === c.locationId)?.name ?? c.locationId).toLowerCase().includes(q) ||
        c.lines.some((l) => itemName(l.itemId).toLowerCase().includes(q))
      )
    : allCountsList;

  function updateStatus(id: string, patch: Partial<StockCount>) {
    const next = counts.map((c) => c.id === id ? { ...c, ...patch } : c);
    persist(next);
    setSelected(next.find((c) => c.id === id) ?? null);
  }

  function postCount(id: string) {
    const count = counts.find((c) => c.id === id);
    if (!count || count.status === "posted") return;
    const adjustments = buildCountAdjustments(count);
    if (adjustments.length > 0) appendMovements(adjustments);
    updateStatus(id, { status: "posted" });
  }

  const open = allCountsList.filter((c) => c.status === "open" || c.status === "submitted").length;

  return (
    <>
      <PageHeader
        title="Stock Count"
        subtitle="Record physical inventory counts. System computes variance and posts adjustment movements on approval."
        actions={
          <div className="flex gap-2">
            <Link href="/inventory"><Button variant="outline">Back to Inventory</Button></Link>
            <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New Count</Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total counts" value={String(allCountsList.length)} />
        <StatCard label="Open / pending" value={String(open)} highlight={open > 0} />
        <StatCard label="Posted" value={String(allCountsList.filter((c) => c.status === "posted").length)} />
      </div>

      <div className="mb-3 relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ref, location, item…"
          className="h-8 pl-8 text-xs"
        />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground text-left">
                <th className="px-5 py-3 font-medium">Ref / Date</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium">Counted by</th>
                <th className="px-5 py-3 text-right font-medium">Lines</th>
                <th className="px-5 py-3 text-right font-medium">Variances</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {counts.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No stock counts yet.</td></tr>
              )}
              {counts.map((sc) => {
                const meta = COUNT_STATUS_META[sc.status];
                const loc = LOCATIONS.find((l) => l.id === sc.locationId);
                const varLines = sc.lines.filter((l) => l.countedQty !== l.systemQty);
                return (
                  <tr
                    key={sc.id}
                    onClick={() => setSelected(sc)}
                    className="cursor-pointer border-b last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-mono font-medium text-xs">{sc.ref}</p>
                      <p className="text-xs text-muted-foreground">{sc.date}</p>
                    </td>
                    <td className="px-5 py-3 text-sm">{loc?.name ?? sc.locationId}</td>
                    <td className="px-5 py-3 text-xs">{employeeName(sc.countedBy)}</td>
                    <td className="px-5 py-3 text-right tabular-nums">{sc.lines.length}</td>
                    <td className="px-5 py-3 text-right">
                      {varLines.length > 0
                        ? <span className="font-medium text-warning">{varLines.length} variance{varLines.length > 1 ? "s" : ""}</span>
                        : <span className="text-success text-xs">All match</span>}
                    </td>
                    <td className="px-5 py-3"><Badge variant={meta.variant}>{meta.label}</Badge></td>
                    <td className="px-5 py-3"><ChevronRight className="size-4 text-muted-foreground/50" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <CountDetailDrawer
          count={selected}
          onClose={() => setSelected(null)}
          onUpdateStatus={(patch) => updateStatus(selected.id, patch)}
          onPost={() => postCount(selected.id)}
        />
      )}

      {creating && (
        <CreateCountDrawer
          onClose={() => setCreating(false)}
          onCreate={(sc) => {
            const next = [...counts, sc];
            persist(next);
            setCreating(false);
            setSelected(sc);
          }}
          nextRef={nextCountRef(added)}
        />
      )}
    </>
  );
}

function CountDetailDrawer({ count, onClose, onUpdateStatus, onPost }: {
  count: StockCount;
  onClose: () => void;
  onUpdateStatus: (patch: Partial<StockCount>) => void;
  onPost: () => void;
}) {
  const meta = COUNT_STATUS_META[count.status];
  const loc = LOCATIONS.find((l) => l.id === count.locationId);
  const varLines = count.lines.filter((l) => l.countedQty !== l.systemQty);

  return (
    <Drawer
      open
      onClose={onClose}
      title={<span className="flex items-center gap-1.5"><ScanLine className="size-4 text-muted-foreground" />{count.ref}</span>}
      subtitle={count.date}
      actions={<Badge variant={meta.variant}>{meta.label}</Badge>}
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Location" value={loc?.name ?? count.locationId} />
          <Field label="Counted by" value={employeeName(count.countedBy)} />
          {count.note && <Field label="Note" value={count.note} className="col-span-2" />}
        </dl>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Count lines</p>
            {varLines.length > 0 && (
              <span className="text-xs text-warning font-medium">{varLines.length} variance{varLines.length > 1 ? "s" : ""}</span>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground text-left">
                  <th className="py-1.5 font-medium">Item</th>
                  <th className="py-1.5 text-right font-medium">System</th>
                  <th className="py-1.5 text-right font-medium">Counted</th>
                  <th className="py-1.5 text-right font-medium">Variance</th>
                </tr>
              </thead>
              <tbody>
                {count.lines.map((l) => {
                  const item = itemById(l.itemId);
                  const variance = l.countedQty - l.systemQty;
                  return (
                    <tr key={l.itemId} className={cn("border-b last:border-0", variance !== 0 && "bg-warning/5")}>
                      <td className="py-2">{itemName(l.itemId)}</td>
                      <td className="py-2 text-right tabular-nums text-muted-foreground">{fmtQty(l.systemQty, item?.uom)}</td>
                      <td className="py-2 text-right tabular-nums font-medium">{fmtQty(l.countedQty, item?.uom)}</td>
                      <td className="py-2 text-right tabular-nums">
                        {variance === 0
                          ? <span className="text-muted-foreground flex items-center justify-end gap-0.5"><Minus className="size-3" /> 0</span>
                          : variance > 0
                            ? <span className="text-success flex items-center justify-end gap-0.5"><TrendingUp className="size-3" /> +{fmtQty(variance)}</span>
                            : <span className="text-danger flex items-center justify-end gap-0.5"><TrendingDown className="size-3" /> {fmtQty(variance)}</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t pt-4">
          {count.status === "open" && (
            <Button onClick={() => onUpdateStatus({ status: "submitted" })}>Submit for review</Button>
          )}
          {count.status === "submitted" && (
            <Button onClick={() => onUpdateStatus({ status: "approved" })}>
              <CheckCircle2 className="size-4" /> Approve count
            </Button>
          )}
          {count.status === "approved" && (
            <div className="w-full space-y-2">
              {varLines.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Posting will create {varLines.length} adjustment movement{varLines.length > 1 ? "s" : ""} to reconcile the variances.
                </p>
              )}
              {varLines.length === 0 && (
                <p className="text-xs text-muted-foreground">No variances found — posting will mark this count as complete with no stock adjustments.</p>
              )}
              <Button onClick={onPost}>Post adjustments</Button>
            </div>
          )}
          {count.status === "posted" && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
              <CheckCircle2 className="size-4" />
              Adjustments posted — stock ledger updated.
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function CreateCountDrawer({ onClose, onCreate, nextRef }: {
  onClose: () => void;
  onCreate: (sc: StockCount) => void;
  nextRef: string;
}) {
  const [locationId, setLocationId] = React.useState("loc-mys");
  const [countedBy, setCountedBy] = React.useState("emp-021");
  const [note, setNote] = React.useState("");
  const [lines, setLines] = React.useState<CountLine[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  function loadSnapshot() {
    const movements = allMovements(loadAddedMovements());
    const snapshot = stockSnapshot(locationId, movements);
    setLines(snapshot.map((s) => ({ itemId: s.item.id, systemQty: s.systemQty, countedQty: s.systemQty })));
    setLoaded(true);
  }

  function updateCounted(i: number, val: number) {
    setLines((p) => p.map((l, j) => j === i ? { ...l, countedQty: val } : l));
  }

  const valid = loaded && lines.length > 0;

  return (
    <Drawer open onClose={onClose} title="New Stock Count" subtitle={nextRef}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Location</span>
            <Select value={locationId} onChange={(e) => { setLocationId(e.target.value); setLoaded(false); setLines([]); }} className="h-9">
              {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Counted by</span>
            <Select value={countedBy} onChange={(e) => setCountedBy(e.target.value)} className="h-9">
              {ACTIVE_EMPLOYEES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </label>
        </div>

        {!loaded ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">Load current system quantities for {LOCATIONS.find((l) => l.id === locationId)?.name} to begin counting.</p>
            <Button variant="outline" onClick={loadSnapshot}>Load items from stock</Button>
          </div>
        ) : (
          <div>
            <p className="mb-2 text-xs font-medium text-muted-foreground">Enter counted quantities — system qty pre-filled</p>
            <div className="max-h-80 overflow-y-auto space-y-1">
              {lines.map((l, i) => {
                const item = itemById(l.itemId);
                const variance = l.countedQty - l.systemQty;
                return (
                  <div key={l.itemId} className={cn("flex items-center gap-3 rounded-md px-3 py-2 border", variance !== 0 && "border-warning/40 bg-warning/5")}>
                    <span className="flex-1 text-sm truncate">{itemName(l.itemId)}</span>
                    <span className="text-xs text-muted-foreground w-24 text-right tabular-nums">sys {fmtQty(l.systemQty)}</span>
                    <Input
                      type="number" min={0}
                      value={l.countedQty}
                      onChange={(e) => updateCounted(i, Number(e.target.value))}
                      className="h-7 w-24 text-right tabular text-sm"
                    />
                    <span className="w-6 text-xs text-muted-foreground">{item?.uom}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Note</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Monthly cycle count, spot check…" className="h-9" />
        </label>

        <div className="flex gap-2 border-t pt-4">
          <Button onClick={() => onCreate({
            id: `sc-${Date.now()}`,
            ref: nextRef,
            date: TODAY,
            locationId,
            countedBy,
            lines,
            note: note.trim() || undefined,
            status: "open",
          })} disabled={!valid}>Save count</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Drawer>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", highlight && "border-warning/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular", highlight && "text-warning")}>{value}</p>
    </Card>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}
