"use client";

import * as React from "react";
import Link from "next/link";
import { PackageCheck, Plus, Trash2, ChevronRight, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { ITEMS, itemById, itemName } from "@/lib/inventory/items";
import { ACTIVE_EMPLOYEES, employeeName } from "@/lib/hr/employees";
import { LOCATIONS } from "@/lib/accounting/org";
import { appendMovements } from "@/lib/inventory/movements";
import {
  allGRNs, loadGRNs, saveGRNs, nextGRNRef,
  buildGRNMovements, GRN_STATUS_META,
  type GoodsReceiptNote, type GRNLine,
} from "@/lib/inventory/supply-chain";

function fmtQty(n: number, uom?: string) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n) + (uom ? ` ${uom}` : "");
}

const TODAY = "2026-06-22";

export function GRNClient() {
  const [added, setAdded] = React.useState<GoodsReceiptNote[]>([]);
  const [selected, setSelected] = React.useState<GoodsReceiptNote | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => { setAdded(loadGRNs()); }, []);

  const SEED_IDS = ["grn-001", "grn-002"];

  function persist(next: GoodsReceiptNote[]) {
    const extra = next.filter((g) => !SEED_IDS.includes(g.id));
    setAdded(extra);
    saveGRNs(extra);
  }

  const grns = allGRNs(added);

  function postGRN(id: string) {
    const grn = grns.find((g) => g.id === id);
    if (!grn || grn.status === "posted") return;
    const movements = buildGRNMovements(grn);
    appendMovements(movements);
    const next = grns.map((g) => g.id === id ? { ...g, status: "posted" as const } : g);
    persist(next);
    setSelected(next.find((g) => g.id === id) ?? null);
  }

  const posted = grns.filter((g) => g.status === "posted").length;

  return (
    <>
      <PageHeader
        title="Goods Receipt Notes"
        subtitle="Record materials received from vendors. Posting a GRN auto-updates inventory stock."
        actions={
          <div className="flex gap-2">
            <Link href="/inventory"><Button variant="outline">Back to Inventory</Button></Link>
            <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New GRN</Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total GRNs" value={String(grns.length)} />
        <StatCard label="Draft (unposted)" value={String(grns.filter((g) => g.status === "draft").length)} highlight={grns.some((g) => g.status === "draft")} />
        <StatCard label="Posted to stock" value={String(posted)} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground text-left">
                <th className="px-5 py-3 font-medium">Ref / Date</th>
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Received by</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {grns.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No GRNs yet.</td></tr>
              )}
              {grns.map((grn) => {
                const meta = GRN_STATUS_META[grn.status];
                const loc = LOCATIONS.find((l) => l.id === grn.locationId);
                return (
                  <tr
                    key={grn.id}
                    onClick={() => setSelected(grn)}
                    className="cursor-pointer border-b last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-mono font-medium text-xs">{grn.ref}</p>
                      <p className="text-xs text-muted-foreground">{grn.date}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{grn.vendorName}</p>
                      {grn.poRef && <p className="text-[11px] text-muted-foreground">{grn.poRef}</p>}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">{loc?.name ?? grn.locationId}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {grn.lines.slice(0, 2).map((l) => (
                          <span key={l.itemId} className="rounded border bg-muted/30 px-1.5 py-0.5 text-[11px]">
                            {itemName(l.itemId)} × {fmtQty(l.qty)}
                          </span>
                        ))}
                        {grn.lines.length > 2 && <span className="text-[11px] text-muted-foreground">+{grn.lines.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs">{employeeName(grn.receivedBy)}</td>
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
        <GRNDetailDrawer
          grn={selected}
          onClose={() => setSelected(null)}
          onPost={() => postGRN(selected.id)}
        />
      )}

      {creating && (
        <CreateGRNDrawer
          onClose={() => setCreating(false)}
          onCreate={(grn) => {
            const next = [...grns, grn];
            persist(next);
            setCreating(false);
            setSelected(grn);
          }}
          nextRef={nextGRNRef(added)}
        />
      )}
    </>
  );
}

function GRNDetailDrawer({ grn, onClose, onPost }: {
  grn: GoodsReceiptNote;
  onClose: () => void;
  onPost: () => void;
}) {
  const meta = GRN_STATUS_META[grn.status];
  const loc = LOCATIONS.find((l) => l.id === grn.locationId);
  return (
    <Drawer
      open
      onClose={onClose}
      title={<span className="flex items-center gap-1.5"><PackageCheck className="size-4 text-muted-foreground" />{grn.ref}</span>}
      subtitle={grn.date}
      actions={<Badge variant={meta.variant}>{meta.label}</Badge>}
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Vendor" value={grn.vendorName} />
          <Field label="Location" value={loc?.name ?? grn.locationId} />
          {grn.poRef && <Field label="PO / PR reference" value={grn.poRef} />}
          <Field label="Received by" value={employeeName(grn.receivedBy)} />
          {grn.note && <Field label="Note" value={grn.note} className="col-span-2" />}
        </dl>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Items received</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground text-left">
                <th className="py-1.5 font-medium">Item</th>
                <th className="py-1.5 text-right font-medium">Qty received</th>
                <th className="py-1.5 pl-3 font-medium">Batch / Expiry</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines.map((l) => {
                const item = itemById(l.itemId);
                return (
                  <tr key={l.itemId} className="border-b last:border-0">
                    <td className="py-2">{itemName(l.itemId)}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{fmtQty(l.qty, item?.uom)}</td>
                    <td className="py-2 pl-3 text-xs text-muted-foreground">
                      {l.batchNo && <span>{l.batchNo}</span>}
                      {l.expiry && <span className="ml-1">· exp {l.expiry}</span>}
                      {!l.batchNo && !l.expiry && "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {grn.status === "draft" && (
          <div className="border-t pt-4">
            <p className="mb-3 text-xs text-muted-foreground">Posting this GRN will add all received quantities to inventory stock at {loc?.name}.</p>
            <Button onClick={onPost}>
              <CheckCircle2 className="size-4" /> Post to inventory
            </Button>
          </div>
        )}
        {grn.status === "posted" && (
          <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
            <CheckCircle2 className="size-4" />
            Posted — stock movements have been recorded.
          </div>
        )}
      </div>
    </Drawer>
  );
}

function CreateGRNDrawer({ onClose, onCreate, nextRef }: {
  onClose: () => void;
  onCreate: (grn: GoodsReceiptNote) => void;
  nextRef: string;
}) {
  const [vendorName, setVendorName] = React.useState("");
  const [poRef, setPoRef] = React.useState("");
  const [locationId, setLocationId] = React.useState("loc-mys");
  const [receivedBy, setReceivedBy] = React.useState("emp-021");
  const [note, setNote] = React.useState("");
  const [lines, setLines] = React.useState<GRNLine[]>([{ itemId: ITEMS[0].id, qty: 0 }]);

  function addLine() { setLines((p) => [...p, { itemId: ITEMS[0].id, qty: 0 }]); }
  function removeLine(i: number) { setLines((p) => p.filter((_, j) => j !== i)); }
  function updateLine(i: number, patch: Partial<GRNLine>) {
    setLines((p) => p.map((l, j) => j === i ? { ...l, ...patch } : l));
  }

  const valid = vendorName.trim().length > 0 && lines.every((l) => l.qty > 0);

  return (
    <Drawer open onClose={onClose} title="New Goods Receipt Note" subtitle={nextRef}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Vendor name *</span>
            <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Supplier name" className="h-9" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">PO / PR reference</span>
            <Input value={poRef} onChange={(e) => setPoRef(e.target.value)} placeholder="PO-2010" className="h-9" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Receiving location</span>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-9">
              {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </label>
          <label className="block col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Received by</span>
            <Select value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className="h-9">
              {ACTIVE_EMPLOYEES.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
            </Select>
          </label>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Items received</p>
          <div className="space-y-3">
            {lines.map((l, i) => {
              const item = itemById(l.itemId);
              return (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <Select
                      value={l.itemId}
                      onChange={(e) => updateLine(i, { itemId: e.target.value })}
                      className="h-8 flex-1 text-xs"
                    >
                      {ITEMS.map((it) => <option key={it.id} value={it.id}>{it.name}</option>)}
                    </Select>
                    <Input
                      type="number" min={1}
                      value={l.qty || ""}
                      onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                      placeholder="Qty"
                      className="h-8 w-24 text-right tabular"
                    />
                    <span className="w-6 text-xs text-muted-foreground">{item?.uom}</span>
                    <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-danger">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      value={l.batchNo ?? ""}
                      onChange={(e) => updateLine(i, { batchNo: e.target.value || undefined })}
                      placeholder="Batch no. (optional)"
                      className="h-7 text-xs"
                    />
                    <Input
                      type="date"
                      value={l.expiry ?? ""}
                      onChange={(e) => updateLine(i, { expiry: e.target.value || undefined })}
                      className="h-7 text-xs"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <Button size="sm" variant="ghost" onClick={addLine} className="mt-2">
            <Plus className="size-3.5" /> Add item
          </Button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Note</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Condition, shortages, remarks…" className="h-9" />
        </label>

        <div className="flex gap-2 border-t pt-4">
          <Button onClick={() => onCreate({
            id: `grn-${Date.now()}`,
            ref: nextRef,
            date: TODAY,
            vendorName: vendorName.trim(),
            poRef: poRef.trim() || undefined,
            locationId,
            receivedBy,
            lines,
            note: note.trim() || undefined,
            status: "draft",
          })} disabled={!valid}>Save GRN</Button>
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
