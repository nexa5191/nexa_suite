"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, Plus, Trash2, ChevronRight, CheckCircle2, XCircle, ShoppingCart } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { ITEMS, itemById, itemName } from "@/lib/inventory/items";
import { ACTIVE_EMPLOYEES, employeeName } from "@/lib/hr/employees";
import {
  allPRs, loadPRs, savePRs, nextPRRef,
  PR_STATUS_META,
  type PurchaseRequisition, type PRLine, type PRStatus,
} from "@/lib/inventory/supply-chain";

function fmtQty(n: number, uom?: string) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n) + (uom ? ` ${uom}` : "");
}

const TODAY = "2026-06-22";

export function RequisitionsClient() {
  const [added, setAdded] = React.useState<PurchaseRequisition[]>([]);
  const [filter, setFilter] = React.useState<PRStatus | "all">("all");
  const [selected, setSelected] = React.useState<PurchaseRequisition | null>(null);
  const [creating, setCreating] = React.useState(false);

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

  const shown = filter === "all" ? prs : prs.filter((p) => p.status === filter);
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

      <div className="mb-3 flex flex-wrap gap-1">
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
    </>
  );
}

function PRDetailDrawer({
  pr, onClose, onUpdate, onDelete,
}: {
  pr: PurchaseRequisition;
  onClose: () => void;
  onUpdate: (patch: Partial<PurchaseRequisition>) => void;
  onDelete: () => void;
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
            <Link href="/vendors">
              <Button variant="outline">
                <ShoppingCart className="size-4" /> Create PO in Vendors
              </Button>
            </Link>
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
