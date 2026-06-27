"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, Plus, Trash2, ChevronRight, CheckCircle2, XCircle, ShoppingCart, Zap, AlertTriangle, TrendingDown, TrendingUp, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/modal";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { ITEMS, itemById, itemName } from "@/lib/inventory/items";
import { ACTIVE_EMPLOYEES, employeeName } from "@/lib/hr/employees";
import { ENTITIES, LOCATIONS } from "@/lib/accounting/org";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { buildBudget, loadOverrides, loadAssumptions } from "@/lib/planning/budget";
import {
  allPRs, loadPRs, savePRs, nextPRRef,
  PR_STATUS_META,
  type PurchaseRequisition, type PRLine, type PRStatus,
} from "@/lib/inventory/supply-chain";
import {
  VENDORS,
  PURCHASE_ORDERS,
  vendorById,
  loadAddedPOs,
  saveAddedPOs,
  allPOs,
  buildNewPO,
  CLASS_META,
  CLASS_COA_SUBTYPES,
  type PurchaseOrder,
  type POLine,
  type VendorClass,
} from "@/lib/vendors";

function fmtQty(n: number, uom?: string) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n) + (uom ? ` ${uom}` : "");
}

const TODAY = "2026-06-22";

export function RequisitionsClient() {
  const [added, setAdded] = React.useState<PurchaseRequisition[]>([]);
  const [filter, setFilter] = React.useState<PRStatus | "all">("all");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<PurchaseRequisition | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [convertingPR, setConvertingPR] = React.useState<PurchaseRequisition | null>(null);

  React.useEffect(() => { setAdded(loadPRs()); }, []);

  function persist(next: PurchaseRequisition[]) {
    setAdded(next.filter((p) => !["pr-001","pr-002","pr-003"].includes(p.id)));
    savePRs(next.filter((p) => !["pr-001","pr-002","pr-003"].includes(p.id)));
  }

  const prs = allPRs(added);

  function updateStatus(id: string, patch: Partial<PurchaseRequisition>) {
    const next = prs.map((p) => p.id === id ? { ...p, ...patch } : p);
    persist(next);
    setSelected(next.find((p) => p.id === id) ?? null);
  }

  const q = search.toLowerCase();
  const shown = prs.filter((p) => {
    if (filter !== "all" && p.status !== filter) return false;
    if (!q) return true;
    return (
      p.ref.toLowerCase().includes(q) ||
      (p.note ?? "").toLowerCase().includes(q) ||
      employeeName(p.requestedBy).toLowerCase().includes(q) ||
      p.lines.some((l) => itemName(l.itemId).toLowerCase().includes(q))
    );
  });
  const pending = prs.filter((p) => p.status === "submitted").length;

  return (
    <>
      <PageHeader
        title="Purchase Requisitions"
        subtitle="Raise internal requests to purchase materials. Submitted PRs route to the Procurement Lead for approval."
        actions={
          <div className="flex gap-2">
            <Link href="/inventory"><Button variant="outline">Back to Inventory</Button></Link>
            <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New Requisition</Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total PRs" value={String(prs.length)} />
        <StatCard label="Awaiting approval" value={String(pending)} highlight={pending > 0} />
        <StatCard label="Approved / ordered" value={String(prs.filter((p) => ["approved","ordered"].includes(p.status)).length)} />
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ref, item, requester…"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <div className="flex flex-wrap gap-1">
          {(["all","draft","submitted","approved","rejected","ordered"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors capitalize",
                filter === s ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
              )}
            >
              {s === "all" ? "All" : PR_STATUS_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground text-left">
                <th className="px-5 py-3 font-medium">Ref / Date</th>
                <th className="px-5 py-3 font-medium">Requested by</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium">Note</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium w-8" />
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">No requisitions found.</td></tr>
              )}
              {shown.map((pr) => {
                const meta = PR_STATUS_META[pr.status];
                return (
                  <tr
                    key={pr.id}
                    onClick={() => setSelected(pr)}
                    className="cursor-pointer border-b last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-mono font-medium text-xs">{pr.ref}</p>
                      <p className="text-xs text-muted-foreground">{pr.date}</p>
                    </td>
                    <td className="px-5 py-3 text-sm">{employeeName(pr.requestedBy)}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {pr.lines.slice(0, 3).map((l) => (
                          <span key={l.itemId} className="rounded border bg-muted/30 px-1.5 py-0.5 text-[11px]">
                            {itemName(l.itemId)} × {fmtQty(l.qty)}
                          </span>
                        ))}
                        {pr.lines.length > 3 && (
                          <span className="text-[11px] text-muted-foreground">+{pr.lines.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground max-w-48 truncate">{pr.note ?? "—"}</td>
                    <td className="px-5 py-3"><Badge variant={meta.variant}>{meta.label}</Badge></td>
                    <td className="px-5 py-3"><ChevronRight className="size-4 text-muted-foreground/50" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Detail drawer */}
      {selected && (
        <PRDetailDrawer
          pr={selected}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => updateStatus(selected.id, patch)}
          onDelete={() => {
            const next = prs.filter((p) => p.id !== selected.id);
            persist(next);
            setSelected(null);
          }}
          onConvertToPO={() => { setConvertingPR(selected); setSelected(null); }}
        />
      )}

      {/* Create drawer */}
      {creating && (
        <CreatePRDrawer
          onClose={() => setCreating(false)}
          onCreate={(pr) => {
            const next = [...prs, pr];
            persist(next);
            setCreating(false);
            setSelected(pr);
          }}
          nextRef={nextPRRef(added)}
        />
      )}

      {/* Convert PR → PO */}
      {convertingPR && (
        <ConvertToPODrawer
          pr={convertingPR}
          onClose={() => setConvertingPR(null)}
          onConverted={(poIds) => {
            const next = prs.map((p) => p.id === convertingPR.id
              ? { ...p, status: "ordered" as PRStatus, poRef: poIds.join(", ") }
              : p);
            persist(next);
            setConvertingPR(null);
          }}
        />
      )}
    </>
  );
}

function PRDetailDrawer({
  pr, onClose, onUpdate, onDelete, onConvertToPO,
}: {
  pr: PurchaseRequisition;
  onClose: () => void;
  onUpdate: (patch: Partial<PurchaseRequisition>) => void;
  onDelete: () => void;
  onConvertToPO?: () => void;
}) {
  const meta = PR_STATUS_META[pr.status];
  return (
    <Drawer
      open
      onClose={onClose}
      title={<span className="flex items-center gap-1.5"><ClipboardList className="size-4 text-muted-foreground" />{pr.ref}</span>}
      subtitle={pr.date}
      actions={<Badge variant={meta.variant}>{meta.label}</Badge>}
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Requested by" value={employeeName(pr.requestedBy)} />
          <Field label="Date" value={pr.date} />
          {pr.approvedBy && <Field label="Approved by" value={employeeName(pr.approvedBy)} />}
          {pr.approvedDate && <Field label="Approved on" value={pr.approvedDate} />}
          {pr.poRef && <Field label="PO reference" value={pr.poRef} />}
          {pr.note && <Field label="Note" value={pr.note} className="col-span-2" />}
        </dl>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Items requested</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground text-left">
                <th className="py-1.5 font-medium">Item</th>
                <th className="py-1.5 text-right font-medium">Qty</th>
                <th className="py-1.5 font-medium pl-3">Note</th>
              </tr>
            </thead>
            <tbody>
              {pr.lines.map((l) => {
                const item = itemById(l.itemId);
                return (
                  <tr key={l.itemId} className="border-b last:border-0">
                    <td className="py-2">{itemName(l.itemId)}</td>
                    <td className="py-2 text-right tabular-nums font-medium">{fmtQty(l.qty, item?.uom)}</td>
                    <td className="py-2 pl-3 text-xs text-muted-foreground">{l.note ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {pr.status === "draft" && (
            <Button onClick={() => onUpdate({ status: "submitted" })}>Submit for approval</Button>
          )}
          {pr.status === "submitted" && (
            <>
              <Button onClick={() => onUpdate({ status: "approved", approvedBy: "emp-023", approvedDate: TODAY })}>
                <CheckCircle2 className="size-4" /> Approve
              </Button>
              <Button variant="outline" className="text-danger border-danger/30" onClick={() => onUpdate({ status: "rejected", approvedBy: "emp-023", approvedDate: TODAY })}>
                <XCircle className="size-4" /> Reject
              </Button>
            </>
          )}
          {pr.status === "approved" && (
            <Button onClick={onConvertToPO}>
              <Zap className="size-4" /> Convert to PO
            </Button>
          )}
          {["draft","rejected"].includes(pr.status) && (
            <Button variant="ghost" className="ml-auto text-danger" onClick={onDelete}>
              <Trash2 className="size-4" /> Delete
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function CreatePRDrawer({
  onClose, onCreate, nextRef,
}: {
  onClose: () => void;
  onCreate: (pr: PurchaseRequisition) => void;
  nextRef: string;
}) {
  const [requestedBy, setRequestedBy] = React.useState("emp-024");
  const [note, setNote] = React.useState("");
  const [lines, setLines] = React.useState<PRLine[]>([{ itemId: ITEMS[0].id, qty: 0 }]);

  function addLine() { setLines((p) => [...p, { itemId: ITEMS[0].id, qty: 0 }]); }
  function removeLine(i: number) { setLines((p) => p.filter((_, j) => j !== i)); }
  function updateLine(i: number, patch: Partial<PRLine>) {
    setLines((p) => p.map((l, j) => j === i ? { ...l, ...patch } : l));
  }

  const valid = lines.length > 0 && lines.every((l) => l.qty > 0);

  function submit() {
    onCreate({
      id: `pr-${Date.now()}`,
      ref: nextRef,
      date: TODAY,
      requestedBy,
      lines,
      note: note.trim() || undefined,
      status: "draft",
    });
  }

  return (
    <Drawer open onClose={onClose} title="New Purchase Requisition" subtitle={nextRef}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Requested by</span>
          <Select value={requestedBy} onChange={(e) => setRequestedBy(e.target.value)} className="h-9">
            {ACTIVE_EMPLOYEES.map((e) => (
              <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>
            ))}
          </Select>
        </label>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Items to request</p>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const item = itemById(l.itemId);
              return (
                <div key={i} className="flex items-center gap-2">
                  <Select
                    value={l.itemId}
                    onChange={(e) => updateLine(i, { itemId: e.target.value })}
                    className="h-8 flex-1 text-xs"
                  >
                    {ITEMS.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.uom})</option>)}
                  </Select>
                  <Input
                    type="number" min={1}
                    value={l.qty || ""}
                    onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                    placeholder="Qty"
                    className="h-8 w-24 text-right tabular"
                  />
                  <span className="w-6 shrink-0 text-xs text-muted-foreground">{item?.uom}</span>
                  <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-danger">
                    <Trash2 className="size-4" />
                  </button>
                </div>
              );
            })}
          </div>
          <Button size="sm" variant="ghost" onClick={addLine} className="mt-2">
            <Plus className="size-3.5" /> Add item
          </Button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Note (optional)</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Reason / urgency…" className="h-9" />
        </label>

        <div className="flex gap-2 border-t pt-4">
          <Button onClick={submit} disabled={!valid}>Save as draft</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// Last rate lookup — last PO for a given itemId across all POs
// ---------------------------------------------------------------------------
function lastRateForItem(itemId: string, orders: PurchaseOrder[]): { vendorId: string; vendorName: string; unitPrice: number; poId: string; daysAgo: number } | null {
  const matches = orders
    .flatMap((po) => po.lines
      .filter((l) => l.itemId === itemId && l.unitPrice > 0)
      .map((l) => ({ vendorId: po.vendorId, vendorName: VENDORS.find((v) => v.id === po.vendorId)?.name ?? "—", unitPrice: l.unitPrice, poId: po.id, date: po.date }))
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!matches.length) return null;
  const m = matches[0];
  const msPerDay = 86400000;
  const daysAgo = Math.round((new Date("2026-06-26").getTime() - new Date(m.date).getTime()) / msPerDay);
  return { ...m, daysAgo };
}

// ---------------------------------------------------------------------------
// ConvertToPODrawer — per-line vendor assignment, splits into one PO per vendor
// ---------------------------------------------------------------------------
interface ConvertLine {
  itemId: string;
  item: string;
  qty: number;
  unitPrice: number;
  vendorId: string;
}

function ConvertToPODrawer({
  pr,
  onClose,
  onConverted,
}: {
  pr: PurchaseRequisition;
  onClose: () => void;
  onConverted: (poIds: string[]) => void;
}) {
  const allOrders = allPOs(loadAddedPOs());
  const activeVendors = VENDORS.filter((v) => v.active);
  const fallbackVendorId = activeVendors[0]?.id ?? VENDORS[0].id;

  const [entityId, setEntityId] = React.useState("ent-nexa-in");
  const [locationId, setLocationId] = React.useState("loc-mys");
  const [spocId, setSpocId] = React.useState(ACTIVE_EMPLOYEES[0]?.id ?? "");

  const [lines, setLines] = React.useState<ConvertLine[]>(() =>
    pr.lines.map((l) => {
      const item = itemById(l.itemId);
      const last = lastRateForItem(l.itemId, allOrders);
      return {
        itemId: l.itemId,
        item: item?.name ?? l.itemId,
        qty: l.qty,
        unitPrice: last?.unitPrice ?? item?.rate ?? 0,
        vendorId: last?.vendorId ?? fallbackVendorId,
      };
    })
  );

  function updateLine(i: number, patch: Partial<ConvertLine>) {
    setLines((p) => p.map((l, j) => j === i ? { ...l, ...patch } : l));
  }

  // Group lines by vendorId — live PO preview
  const groups = React.useMemo(() => {
    const map = new Map<string, ConvertLine[]>();
    for (const l of lines) {
      const existing = map.get(l.vendorId) ?? [];
      map.set(l.vendorId, [...existing, l]);
    }
    return Array.from(map.entries()).map(([vendorId, groupLines]) => ({
      vendorId,
      vendorName: VENDORS.find((v) => v.id === vendorId)?.name ?? vendorId,
      lines: groupLines,
      total: groupLines.reduce((s, l) => s + l.qty * l.unitPrice, 0),
    }));
  }, [lines]);

  const grandTotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const valid = lines.every((l) => l.qty > 0 && l.vendorId);

  function submit() {
    let pool = loadAddedPOs();
    const created: string[] = [];
    for (const g of groups) {
      const po = buildNewPO(pool, {
        vendorId: g.vendorId,
        title: `From ${pr.ref}${groups.length > 1 ? ` · ${g.vendorName}` : ""}`,
        date: "2026-06-26",
        lines: g.lines.map((l) => ({ item: l.item, qty: l.qty, unitPrice: l.unitPrice, itemId: l.itemId })),
        spocId,
        entityId,
        locationId,
        status: "issued",
      });
      pool = [...pool, po];
      created.push(po.id);
    }
    saveAddedPOs(pool);
    onConverted(created);
  }

  return (
    <Drawer
      open
      onClose={onClose}
      title="Convert PR to PO"
      subtitle={`${pr.ref} · assign a vendor per line`}
    >
      <div className="space-y-5">

        {/* Shared PO settings */}
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Entity</span>
            <EntityCombobox value={entityId} onChange={setEntityId} className="h-9" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Delivery location</span>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-9">
              {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </label>
          <label className="block col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">SPOC (approves invoices)</span>
            <Select value={spocId} onChange={(e) => setSpocId(e.target.value)} className="h-9">
              {ACTIVE_EMPLOYEES.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
            </Select>
          </label>
        </div>

        {/* Per-line vendor + qty + price */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Line items — assign vendor per line
          </p>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const last = lastRateForItem(l.itemId, allOrders);
              const item = itemById(l.itemId);
              return (
                <div key={i} className="rounded-lg border p-3 space-y-2">
                  {/* Item name + last rate hint */}
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold">{l.item}</p>
                    {last && (
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        Last: <span className="font-medium text-foreground">₹{last.unitPrice.toLocaleString("en-IN")}/{item?.uom}</span> · {last.daysAgo}d ago
                      </span>
                    )}
                  </div>

                  {/* Vendor selector */}
                  <label className="block">
                    <span className="text-[10px] text-muted-foreground">Vendor</span>
                    <Select
                      value={l.vendorId}
                      onChange={(e) => {
                        const newVid = e.target.value;
                        // Prefill price from last rate for this vendor+item combo
                        const vendorLast = allOrders
                          .filter((po) => po.vendorId === newVid)
                          .flatMap((po) => po.lines.filter((pl) => pl.itemId === l.itemId && pl.unitPrice > 0).map((pl) => pl.unitPrice))
                          .sort((a, b) => b - a)[0];
                        updateLine(i, { vendorId: newVid, ...(vendorLast ? { unitPrice: vendorLast } : {}) });
                      }}
                      className="mt-0.5 h-8 text-xs"
                    >
                      {activeVendors.map((v) => (
                        <option key={v.id} value={v.id}>{v.name} — {v.category}</option>
                      ))}
                    </Select>
                  </label>

                  {/* Qty + price */}
                  <div className="flex gap-2">
                    <label className="block flex-1">
                      <span className="text-[10px] text-muted-foreground">Qty ({item?.uom})</span>
                      <Input
                        type="number" min={1}
                        value={l.qty || ""}
                        onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                        className="mt-0.5 h-7 text-right text-xs"
                      />
                    </label>
                    <label className="block flex-1">
                      <span className="text-[10px] text-muted-foreground">Unit price (₹)</span>
                      <Input
                        type="number" min={0}
                        value={l.unitPrice || ""}
                        onChange={(e) => updateLine(i, { unitPrice: Number(e.target.value) })}
                        className="mt-0.5 h-7 text-right text-xs"
                      />
                    </label>
                    <div className="block flex-1 text-right">
                      <span className="text-[10px] text-muted-foreground">Line total</span>
                      <p className="mt-0.5 text-xs font-semibold tabular-nums">
                        <Money value={l.qty * l.unitPrice} />
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* PO split preview */}
        <div className="rounded-lg border bg-muted/20 p-3 space-y-2">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Zap className="size-3.5 text-primary" />
            Will create {groups.length} PO{groups.length > 1 ? "s" : ""}
          </p>
          {groups.map((g) => (
            <div key={g.vendorId} className="flex items-start gap-3 rounded-md border bg-card px-3 py-2 text-xs">
              <div className="flex-1 min-w-0">
                <p className="font-semibold">{g.vendorName}</p>
                <p className="text-muted-foreground mt-0.5">
                  {g.lines.map((l) => `${l.item} × ${l.qty}`).join(" · ")}
                </p>
              </div>
              <span className="font-bold tabular-nums shrink-0">
                <Money value={g.total} compact />
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between border-t pt-2 mt-1">
            <span className="text-xs font-medium">Grand total</span>
            <span className="text-sm font-bold tabular-nums"><Money value={grandTotal} /></span>
          </div>
        </div>

        <div className="flex gap-2 border-t pt-4">
          <Button onClick={submit} disabled={!valid}>
            <Zap className="size-4" /> Raise {groups.length} PO{groups.length > 1 ? "s" : ""}
          </Button>
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
