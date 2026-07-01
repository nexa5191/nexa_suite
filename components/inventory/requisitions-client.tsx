"use client";

import * as React from "react";
import Link from "next/link";
import { ClipboardList, Plus, Trash2, ChevronRight, CheckCircle2, XCircle, ShoppingCart, Zap, AlertTriangle, TrendingDown, TrendingUp, Search, PackageX, Clock, Pencil, TrendingUp as DemandIcon, BarChart2 } from "lucide-react";
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
  PR_STATUS_META, buildAutoRolPRs, loadRolContext, saveRolContext,
  type PurchaseRequisition, type PRLine, type PRStatus, type AutoRolLineContext,
} from "@/lib/inventory/supply-chain";
import { allMovements, buildStockIndex, loadAddedMovements, stockTotal } from "@/lib/inventory/movements";
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

const TODAY = "2026-07-01";

export function RequisitionsClient() {
  const [added, setAdded] = React.useState<PurchaseRequisition[]>([]);
  const [filter, setFilter] = React.useState<PRStatus | "all">("all");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<PurchaseRequisition | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [convertingPR, setConvertingPR] = React.useState<PurchaseRequisition | null>(null);
  const [belowRol, setBelowRol] = React.useState<Array<{ item: (typeof ITEMS)[0]; onHand: number }>>([]);
  const [rolContext, setRolContext] = React.useState<Record<string, AutoRolLineContext>>({});
  const [rolBanner, setRolBanner] = React.useState<{ msg: string; ok: boolean } | null>(null);

  React.useEffect(() => {
    setAdded(loadPRs());
    setRolContext(loadRolContext());
    const mvs = allMovements(loadAddedMovements());
    const idx = buildStockIndex(mvs);
    const flags = ITEMS
      .filter((it) =>
        ["raw", "packing"].includes(it.category) ||
        (it.category === "finished" && it.ownership === "third-party"),
      )
      .map((it) => ({ item: it, onHand: stockTotal(idx, it.id) }))
      .filter(({ item, onHand }) => onHand < item.reorderLevel)
      .sort((a, b) => a.onHand / a.item.reorderLevel - b.onHand / b.item.reorderLevel);
    setBelowRol(flags);
  }, []);

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

  function generateAutoRolPRs() {
    const mvs = allMovements(loadAddedMovements());
    const result = buildAutoRolPRs(mvs, added, "emp-024", TODAY);
    if (!result) {
      setRolBanner({ msg: "All purchasable items are above their reorder level — nothing to order.", ok: true });
      setTimeout(() => setRolBanner(null), 4000);
      return;
    }
    const { pr, context } = result;
    const next = [...prs, pr];
    persist(next);
    saveRolContext({ ...loadRolContext(), ...context });
    setRolContext((prev) => ({ ...prev, ...context }));
    setRolBanner({ msg: `Auto-PR ${pr.ref} created with ${pr.lines.length} line${pr.lines.length !== 1 ? "s" : ""}. Open it to review and confirm quantities.`, ok: true });
    setTimeout(() => setRolBanner(null), 7000);
    setSelected(pr);
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

      {/* ROL alert — compact bar */}
      {belowRol.length > 0 && (() => {
        const activeRolPR = prs.find((p) => p.source === "auto-rol" && ["submitted","approved"].includes(p.status));
        const preview = belowRol.slice(0, 3).map(({ item }) => item.name).join(", ");
        const extra = belowRol.length > 3 ? ` +${belowRol.length - 3} more` : "";
        return (
          <div className="mb-4 flex items-center gap-2 rounded-md border border-warning/40 bg-warning/5 px-3 py-1.5 text-xs">
            <PackageX className="size-3.5 shrink-0 text-warning" />
            <span className="font-semibold text-warning">{belowRol.length} item{belowRol.length !== 1 ? "s" : ""} below ROL</span>
            <span className="text-muted-foreground truncate hidden sm:block">{preview}{extra}</span>
            <span className="ml-auto flex items-center gap-3 shrink-0">
              {activeRolPR && (
                <button onClick={() => setSelected(activeRolPR)} className="text-primary hover:underline font-medium">
                  PR {activeRolPR.ref} in review
                </button>
              )}
              <Link href="/inventory/reorder" className="font-medium text-warning hover:underline">more →</Link>
            </span>
          </div>
        );
      })()}

      {/* ROL generation banner */}
      {rolBanner && (
        <div className={`mb-3 flex items-center gap-2 rounded-lg border px-4 py-2.5 text-sm ${rolBanner.ok ? "border-success/40 bg-success/10 text-success" : "border-danger/40 bg-danger/10 text-danger"}`}>
          <CheckCircle2 className="size-4 shrink-0" />
          <span className="font-medium">{rolBanner.msg}</span>
        </div>
      )}

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
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        {pr.source === "auto-rol" && <Badge variant="warning" className="text-[10px] px-1.5">Auto-ROL</Badge>}
                        {pr.source === "mrp" && <Badge variant="primary" className="text-[10px] px-1.5">MRP</Badge>}
                      </div>
                    </td>
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
          rolContext={rolContext}
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
  pr, onClose, onUpdate, onDelete, onConvertToPO, rolContext,
}: {
  pr: PurchaseRequisition;
  onClose: () => void;
  onUpdate: (patch: Partial<PurchaseRequisition>) => void;
  onDelete: () => void;
  onConvertToPO?: () => void;
  rolContext?: Record<string, AutoRolLineContext>;
}) {
  const meta = PR_STATUS_META[pr.status];
  const isAutoRol = pr.source === "auto-rol";
  const isMrp = pr.source === "mrp";

  // Amendment state
  const [amending, setAmending] = React.useState(false);
  const [amendLines, setAmendLines] = React.useState<PRLine[]>(pr.lines);

  function saveAmendment() {
    onUpdate({ lines: amendLines });
    setAmending(false);
  }

  const canAmend = ["draft", "submitted"].includes(pr.status) && !amending;

  return (
    <Drawer
      open
      onClose={onClose}
      title={<span className="flex items-center gap-1.5"><ClipboardList className="size-4 text-muted-foreground" />{pr.ref}</span>}
      subtitle={pr.date}
      actions={
        <div className="flex items-center gap-2">
          <Badge variant={meta.variant}>{meta.label}</Badge>
          {isAutoRol && <Badge variant="warning" className="text-[10px]">Auto-ROL</Badge>}
          {isMrp && <Badge variant="primary" className="text-[10px]">MRP</Badge>}
        </div>
      }
    >
      <div className="space-y-5">

        {/* Auto-ROL context header */}
        {isAutoRol && (
          <div className="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2.5 space-y-1">
            <div className="flex items-center gap-1.5">
              <PackageX className="size-3.5 text-warning" />
              <span className="text-xs font-semibold text-warning">System-generated — ROL triggered</span>
            </div>
            <p className="text-xs text-muted-foreground">
              Quantities are set to cover stock through lead time + safety buffer. Review the breakdown below, amend if needed, then approve and convert to PO.
            </p>
          </div>
        )}

        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Requested by" value={isAutoRol ? "System (ROL monitor)" : employeeName(pr.requestedBy)} />
          <Field label="Date" value={pr.date} />
          {pr.approvedBy && <Field label="Approved by" value={employeeName(pr.approvedBy)} />}
          {pr.approvedDate && <Field label="Approved on" value={pr.approvedDate} />}
          {pr.poRef && <Field label="PO reference" value={pr.poRef} />}
          {pr.note && <Field label="Note" value={pr.note} className="col-span-2" />}
        </dl>

        {/* Items table */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {isAutoRol ? "Procurement lines — SCM review" : "Items requested"}
            </p>
            {canAmend && (
              <button
                onClick={() => { setAmendLines(pr.lines); setAmending(true); }}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <Pencil className="size-3" /> Amend quantities
              </button>
            )}
            {amending && (
              <div className="flex gap-1.5">
                <Button size="sm" onClick={saveAmendment}>Save</Button>
                <Button size="sm" variant="ghost" onClick={() => { setAmendLines(pr.lines); setAmending(false); }}>Cancel</Button>
              </div>
            )}
          </div>

          {/* Auto-ROL rich context table */}
          {isAutoRol && rolContext ? (
            <div className="overflow-x-auto scrollbar-thin rounded-lg border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/40 text-left">
                    <th className="px-3 py-2 font-medium text-muted-foreground">Item</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">On hand</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">ROL</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      <span className="flex items-center justify-end gap-1"><Clock className="size-3" />Lead time</span>
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">
                      <span className="flex items-center justify-end gap-1"><BarChart2 className="size-3" />Demand req.</span>
                    </th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Suggested</th>
                    <th className="px-3 py-2 text-right font-medium text-muted-foreground">Confirm qty</th>
                  </tr>
                </thead>
                <tbody>
                  {(amending ? amendLines : pr.lines).map((l, i) => {
                    const ctx = rolContext[l.itemId];
                    const item = itemById(l.itemId);
                    const uom = ctx?.uom ?? item?.uom ?? "";
                    const onHandPct = ctx ? Math.min(100, (ctx.onHand / ctx.rol) * 100) : 0;
                    return (
                      <tr key={l.itemId} className="border-b last:border-0 hover:bg-accent/30">
                        <td className="px-3 py-2.5 font-medium">{itemName(l.itemId)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          <span className={ctx && ctx.onHand < ctx.rol ? "text-danger font-semibold" : ""}>
                            {ctx ? fmtQty(ctx.onHand, uom) : "—"}
                          </span>
                          {ctx && (
                            <div className="mt-0.5 h-1 w-full rounded-full bg-muted">
                              <div className="h-full rounded-full bg-danger" style={{ width: `${onHandPct}%` }} />
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {ctx ? fmtQty(ctx.rol, uom) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {ctx ? (
                            <span className="tabular-nums">{ctx.leadTimeDays}d
                              {ctx.avgDailyDemand > 0 && (
                                <span className="ml-1 text-muted-foreground">({fmtQty(ctx.leadTimeDemand, uom)})</span>
                              )}
                            </span>
                          ) : "—"}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums">
                          {ctx && ctx.avgDailyDemand > 0 ? (
                            <span>
                              {fmtQty(ctx.avgDailyDemand, uom)}/d
                              {ctx.safetyBuffer > 0 && (
                                <span className="ml-1 text-muted-foreground">+{fmtQty(ctx.safetyBuffer, uom)} buffer</span>
                              )}
                            </span>
                          ) : <span className="text-muted-foreground">No history</span>}
                        </td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-muted-foreground">
                          {ctx ? fmtQty(ctx.suggestedQty, uom) : fmtQty(l.qty, uom)}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {amending ? (
                            <Input
                              type="number" min={1}
                              value={amendLines[i]?.qty || ""}
                              onChange={(e) => setAmendLines((p) => p.map((line, j) => j === i ? { ...line, qty: Number(e.target.value) } : line))}
                              className="h-7 w-20 text-right text-xs ml-auto"
                            />
                          ) : (
                            <span className={`tabular-nums font-semibold ${ctx && l.qty !== ctx.suggestedQty ? "text-primary" : ""}`}>
                              {fmtQty(l.qty, uom)}
                              {ctx && l.qty !== ctx.suggestedQty && (
                                <span className="ml-1 text-[10px] font-normal text-muted-foreground">(amended)</span>
                              )}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            /* Standard PR lines table */
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground text-left">
                  <th className="py-1.5 font-medium">Item</th>
                  <th className="py-1.5 text-right font-medium">Qty</th>
                  <th className="py-1.5 font-medium pl-3">Note</th>
                </tr>
              </thead>
              <tbody>
                {(amending ? amendLines : pr.lines).map((l, i) => {
                  const item = itemById(l.itemId);
                  return (
                    <tr key={l.itemId} className="border-b last:border-0">
                      <td className="py-2">{itemName(l.itemId)}</td>
                      <td className="py-2 text-right">
                        {amending ? (
                          <Input
                            type="number" min={1}
                            value={amendLines[i]?.qty || ""}
                            onChange={(e) => setAmendLines((p) => p.map((line, j) => j === i ? { ...line, qty: Number(e.target.value) } : line))}
                            className="h-7 w-24 text-right text-xs"
                          />
                        ) : (
                          <span className="tabular-nums font-medium">{fmtQty(l.qty, item?.uom)}</span>
                        )}
                      </td>
                      <td className="py-2 pl-3 text-xs text-muted-foreground">{l.note ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
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
  const [lines, setLines] = React.useState<PRLine[]>([{ itemId: ITEMS[0]?.id ?? "", qty: 0 }]);

  function addLine() { setLines((p) => [...p, { itemId: ITEMS[0]?.id ?? "", qty: 0 }]); }
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
  const fallbackVendorId = activeVendors[0]?.id ?? VENDORS[0]?.id ?? "";

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
        status: "draft",
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
