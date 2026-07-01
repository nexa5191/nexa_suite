"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { PackageCheck, Plus, Trash2, ChevronRight, CheckCircle2, Search, Info, Truck, ShieldCheck, ShieldX, AlertTriangle, RotateCcw } from "lucide-react";
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
import { appendAudit } from "@/lib/audit/audit-log";
import { PURCHASE_ORDERS, VENDORS, allPOs, loadAddedPOs, vendorById, type POLine } from "@/lib/vendors";
import { useJournal } from "@/components/accounting/journal-provider";
import { buildGrnDraft, grnDebitAccount, loadP2P, saveP2P } from "@/lib/p2p";
import { NEW_INTENT_EVENT } from "@/lib/commands/new-intent";
import {
  allGRNs, loadGRNs, saveGRNs, nextGRNRef,
  buildGRNMovements, GRN_STATUS_META,
  type GoodsReceiptNote, type GRNLine, type QCResult, type QCLineResult,
} from "@/lib/inventory/supply-chain";

function fmtQty(n: number, uom?: string) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n) + (uom ? ` ${uom}` : "");
}

const TODAY = "2026-07-01";

export function GRNClient() {
  const searchParams = useSearchParams();
  const { post } = useJournal();
  const [added, setAdded] = React.useState<GoodsReceiptNote[]>([]);
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<GoodsReceiptNote | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => {
    setAdded(loadGRNs());
    if (searchParams.get("new") === "1") setCreating(true);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const onIntent = () => setCreating(true);
    window.addEventListener(NEW_INTENT_EVENT, onIntent);
    return () => window.removeEventListener(NEW_INTENT_EVENT, onIntent);
  }, []);

  const SEED_IDS = ["grn-001", "grn-002"];

  function persist(next: GoodsReceiptNote[]) {
    const extra = next.filter((g) => !SEED_IDS.includes(g.id));
    setAdded(extra);
    saveGRNs(extra);
  }

  const allGrnsList = allGRNs(added);
  const q = search.toLowerCase();
  const grns = q
    ? allGrnsList.filter((g) =>
        g.ref.toLowerCase().includes(q) ||
        g.vendorName.toLowerCase().includes(q) ||
        (g.poRef ?? "").toLowerCase().includes(q) ||
        employeeName(g.receivedBy).toLowerCase().includes(q) ||
        g.lines.some((l) => itemName(l.itemId).toLowerCase().includes(q))
      )
    : allGrnsList;

  function updateGRN(id: string, patch: Partial<GoodsReceiptNote>) {
    const next = allGrnsList.map((g) => g.id === id ? { ...g, ...patch } : g);
    persist(next.filter((g) => !SEED_IDS.includes(g.id)));
    setAdded(next.filter((g) => !SEED_IDS.includes(g.id)));
    setSelected(next.find((g) => g.id === id) ?? null);
  }

  function postGRN(id: string) {
    const grn = allGrnsList.find((g) => g.id === id);
    if (!grn || grn.status === "posted") return;

    // 1. Post stock movements
    const movements = buildGRNMovements(grn);
    appendMovements(movements);

    // 2. If linked to a PO, auto-post the GL journal (Dr Inventory/Cr GRNI)
    if (grn.poRef) {
      const po = allPOs(loadAddedPOs()).find((p) => p.id === grn.poRef);
      if (po) {
        const vendor = vendorById(po.vendorId);
        let taxable = 0;
        for (const line of grn.lines) {
          const qcLine = grn.qcResult?.lines.find((q) => q.itemId === line.itemId);
          const qty = qcLine ? qcLine.acceptedQty : line.qty;
          const price = line.unitPrice ?? itemById(line.itemId)?.rate ?? 0;
          taxable += qty * price;
        }
        if (taxable > 0) {
          const draft = buildGrnDraft(po, vendor, grn.date, taxable);
          const res = post(draft);
          if (res.ok) {
            const p2pStore = loadP2P();
            p2pStore[po.id] = {
              ...p2pStore[po.id],
              grn: {
                date: grn.date,
                voucherNo: res.entry.voucherNo,
                account: grnDebitAccount(vendor),
                taxable,
              },
            };
            saveP2P(p2pStore);
          }
        }
      }
    }

    updateGRN(id, { status: "posted" });
    appendAudit({
      actorId: grn.receivedBy,
      module: "GRN",
      action: "post",
      record: grn.ref,
      after: `${movements.length} movement(s) posted to stock · ${grn.vendorName}${grn.poRef ? " · GL journal posted" : ""}`,
    });
  }

  const posted = allGrnsList.filter((g) => g.status === "posted").length;

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
        <StatCard label="Total GRNs" value={String(allGrnsList.length)} />
        <StatCard label="Draft (unposted)" value={String(allGrnsList.filter((g) => g.status === "draft").length)} highlight={allGrnsList.some((g) => g.status === "draft")} />
        <StatCard label="Posted to stock" value={String(posted)} />
      </div>

      <div className="mb-3 relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search ref, vendor, item, PO…"
          className="h-8 pl-8 text-xs"
        />
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
          onUpdate={(patch) => updateGRN(selected.id, patch)}
        />
      )}

      {creating && (
        <CreateGRNDrawer
          onClose={() => setCreating(false)}
          onCreate={(grn) => {
            const next = [...grns, grn];
            persist(next);
            appendAudit({
              actorId: grn.receivedBy,
              module: "GRN",
              action: "create",
              record: grn.ref,
              after: `${grn.lines.length} line(s) · ${grn.vendorName}${grn.poRef ? ` · ${grn.poRef}` : ""} · pending-qc`,
            });
            setCreating(false);
            setSelected(grn);
          }}
          nextRef={nextGRNRef(added)}
        />
      )}
    </>
  );
}

function computeFreightAlloc(grn: GoodsReceiptNote): Array<{ itemId: string; allocated: number; landedPer: number }> {
  const freight = grn.freightTotal ?? 0;
  if (!freight) return grn.lines.map((l) => ({ itemId: l.itemId, allocated: 0, landedPer: itemById(l.itemId)?.rate ?? 0 }));
  const basis = grn.freightBasis ?? "value";
  const weights = grn.lines.map((l) => {
    const item = itemById(l.itemId);
    return basis === "value" ? l.qty * (item?.rate ?? 1) : l.qty;
  });
  const totalWeight = weights.reduce((s, w) => s + w, 0) || 1;
  return grn.lines.map((l, i) => {
    const allocated = (weights[i] / totalWeight) * freight;
    const item = itemById(l.itemId);
    const landedPer = (item?.rate ?? 0) + (l.qty > 0 ? allocated / l.qty : 0);
    return { itemId: l.itemId, allocated, landedPer };
  });
}

function GRNDetailDrawer({ grn, onClose, onPost, onUpdate }: {
  grn: GoodsReceiptNote;
  onClose: () => void;
  onPost: () => void;
  onUpdate: (patch: Partial<GoodsReceiptNote>) => void;
}) {
  const meta = GRN_STATUS_META[grn.status];
  const loc = LOCATIONS.find((l) => l.id === grn.locationId);
  const freightAlloc = grn.freightTotal ? computeFreightAlloc(grn) : null;

  // QC inspection form state
  const [showQC, setShowQC] = React.useState(grn.status === "pending-qc" && !grn.qcResult);
  const [qcInspector, setQcInspector] = React.useState(grn.receivedBy);
  const [qcDate, setQcDate] = React.useState(TODAY);
  const [qcRemarks, setQcRemarks] = React.useState("");
  const [qcLines, setQcLines] = React.useState<Array<{ acceptedQty: number; rejectionReason: string }>>(
    () => grn.lines.map((l) => ({ acceptedQty: l.qty, rejectionReason: "" }))
  );

  function submitQC() {
    const lines: QCLineResult[] = grn.lines.map((l, i) => ({
      itemId: l.itemId,
      acceptedQty: qcLines[i].acceptedQty,
      rejectedQty: l.qty - qcLines[i].acceptedQty,
      rejectionReason: qcLines[i].rejectionReason || undefined,
    }));
    const allRejected = lines.every((l) => l.acceptedQty <= 0);
    const anyRejected = lines.some((l) => l.rejectedQty > 0);
    const verdict: QCResult["verdict"] = allRejected ? "rejected" : anyRejected ? "partial" : "passed";
    const qcResult: QCResult = {
      inspectedBy: qcInspector,
      inspectedDate: qcDate,
      verdict,
      remarks: qcRemarks || undefined,
      lines,
    };
    onUpdate({
      qcResult,
      status: allRejected ? "qc-rejected" : "qc-passed",
    });
    appendAudit({
      actorId: qcInspector,
      module: "GRN",
      action: "update",
      record: grn.ref,
      field: "QC Result",
      before: "pending-qc",
      after: `verdict: ${verdict} · accepted: ${lines.reduce((s, l) => s + l.acceptedQty, 0)} / rejected: ${lines.reduce((s, l) => s + l.rejectedQty, 0)} · inspector: ${employeeName(qcInspector)}`,
    });
    setShowQC(false);
  }

  const totalRejected = grn.qcResult?.lines.reduce((s, l) => s + l.rejectedQty, 0) ?? 0;
  const totalAccepted = grn.qcResult?.lines.reduce((s, l) => s + l.acceptedQty, 0) ?? 0;

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

        {/* Items received */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Items received</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground text-left">
                <th className="py-1.5 font-medium">Item</th>
                <th className="py-1.5 text-right font-medium">Qty</th>
                {grn.qcResult && <th className="py-1.5 text-right font-medium">Accepted</th>}
                {grn.qcResult && <th className="py-1.5 text-right font-medium">Rejected</th>}
                {freightAlloc && <th className="py-1.5 text-right font-medium">Landed / unit</th>}
                <th className="py-1.5 pl-3 font-medium">Batch / Expiry</th>
              </tr>
            </thead>
            <tbody>
              {grn.lines.map((l, i) => {
                const item = itemById(l.itemId);
                const alloc = freightAlloc?.[i];
                const qcLine = grn.qcResult?.lines[i];
                return (
                  <tr key={l.itemId} className="border-b last:border-0">
                    <td className="py-2">{itemName(l.itemId)}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{fmtQty(l.qty, item?.uom)}</td>
                    {qcLine && (
                      <>
                        <td className="py-2 text-right tabular-nums text-xs text-success font-medium">
                          {fmtQty(qcLine.acceptedQty, item?.uom)}
                        </td>
                        <td className="py-2 text-right tabular-nums text-xs">
                          {qcLine.rejectedQty > 0 ? (
                            <span className="text-danger font-medium" title={qcLine.rejectionReason}>
                              {fmtQty(qcLine.rejectedQty, item?.uom)}
                              {qcLine.rejectionReason && " ⓘ"}
                            </span>
                          ) : <span className="text-muted-foreground">—</span>}
                        </td>
                      </>
                    )}
                    {alloc && (
                      <td className="py-2 text-right tabular-nums text-xs font-medium text-primary">
                        ₹{alloc.landedPer.toFixed(2)}
                      </td>
                    )}
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
          {freightAlloc && (
            <div className="mt-2 flex items-center gap-1.5 rounded-md border border-primary/20 bg-primary/5 px-3 py-1.5 text-xs text-muted-foreground">
              <Truck className="size-3.5 text-primary shrink-0" />
              Freight ₹{(grn.freightTotal ?? 0).toLocaleString("en-IN")} allocated by {grn.freightBasis === "qty" ? "quantity" : "value"}.
            </div>
          )}
        </div>

        {/* QC result summary */}
        {grn.qcResult && (
          <div className={cn(
            "rounded-lg border px-4 py-3 text-sm space-y-1",
            grn.qcResult.verdict === "rejected" ? "border-danger/30 bg-danger/5" :
            grn.qcResult.verdict === "partial"  ? "border-warning/30 bg-warning/5" :
                                                   "border-success/30 bg-success/5"
          )}>
            <p className="flex items-center gap-1.5 font-medium">
              {grn.qcResult.verdict === "rejected" ? <ShieldX className="size-4 text-danger" /> :
               grn.qcResult.verdict === "partial"  ? <AlertTriangle className="size-4 text-warning" /> :
                                                      <ShieldCheck className="size-4 text-success" />}
              QC {grn.qcResult.verdict === "passed" ? "Passed" : grn.qcResult.verdict === "partial" ? "Partial — some items rejected" : "Rejected"}
            </p>
            <p className="text-xs text-muted-foreground">
              Inspected by {employeeName(grn.qcResult.inspectedBy)} on {grn.qcResult.inspectedDate}
              {grn.qcResult.remarks && ` · ${grn.qcResult.remarks}`}
            </p>
          </div>
        )}

        {/* RTV notice for rejected qty */}
        {totalRejected > 0 && (
          <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3 text-sm">
            <p className="mb-1 flex items-center gap-1.5 font-medium text-danger">
              <RotateCcw className="size-4" /> Return to Vendor required
            </p>
            <p className="text-xs text-muted-foreground mb-2">
              {totalRejected} unit(s) rejected. Raise a Debit Note against {grn.vendorName} for the rejected quantity and arrange physical return.
            </p>
            <div className="space-y-1">
              {grn.qcResult?.lines.filter(l => l.rejectedQty > 0).map(l => (
                <div key={l.itemId} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{itemName(l.itemId)}</span>
                  <span className="font-medium text-danger">
                    {l.rejectedQty} {itemById(l.itemId)?.uom}
                    {l.rejectionReason && ` — ${l.rejectionReason}`}
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">
              RTV Ref: RTV-{grn.ref} · Use "Debit Note" voucher to record the credit.
            </p>
          </div>
        )}

        {/* QC Inspection form (pending-qc state) */}
        {grn.status === "pending-qc" && !grn.qcResult && (
          <div className="border-t pt-4">
            {!showQC ? (
              <Button onClick={() => setShowQC(true)}>
                <ShieldCheck className="size-4" /> Start QC Inspection
              </Button>
            ) : (
              <div className="space-y-4">
                <p className="text-sm font-medium">QC Inspection</p>
                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Inspector *</span>
                    <Select value={qcInspector} onChange={(e) => setQcInspector(e.target.value)} className="h-8 text-xs">
                      {ACTIVE_EMPLOYEES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </Select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs text-muted-foreground">Inspection date</span>
                    <Input type="date" value={qcDate} onChange={(e) => setQcDate(e.target.value)} className="h-8 text-xs" />
                  </label>
                </div>

                <div>
                  <p className="mb-2 text-xs text-muted-foreground">Enter accepted qty per line (default = received qty)</p>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-xs text-muted-foreground text-left">
                        <th className="py-1.5 font-medium">Item</th>
                        <th className="py-1.5 text-right font-medium">Received</th>
                        <th className="py-1.5 text-right font-medium">Accepted *</th>
                        <th className="py-1.5 font-medium pl-2">Rejection reason</th>
                      </tr>
                    </thead>
                    <tbody>
                      {grn.lines.map((l, i) => {
                        const item = itemById(l.itemId);
                        const rejected = l.qty - (qcLines[i]?.acceptedQty ?? l.qty);
                        return (
                          <tr key={l.itemId} className="border-b last:border-0">
                            <td className="py-2 pr-2">{itemName(l.itemId)}</td>
                            <td className="py-2 text-right tabular-nums text-muted-foreground text-xs">
                              {fmtQty(l.qty, item?.uom)}
                            </td>
                            <td className="py-2 pl-2">
                              <Input
                                type="number" min={0} max={l.qty}
                                value={qcLines[i]?.acceptedQty ?? l.qty}
                                onChange={(e) => {
                                  const v = Math.min(l.qty, Math.max(0, Number(e.target.value)));
                                  setQcLines((prev) => prev.map((ql, j) => j === i ? { ...ql, acceptedQty: v } : ql));
                                }}
                                className="h-7 w-20 text-right tabular text-xs ml-auto"
                              />
                            </td>
                            <td className="py-2 pl-2">
                              {rejected > 0 && (
                                <Input
                                  value={qcLines[i]?.rejectionReason ?? ""}
                                  onChange={(e) => setQcLines((prev) => prev.map((ql, j) => j === i ? { ...ql, rejectionReason: e.target.value } : ql))}
                                  placeholder="Reason (damage, spec fail…)"
                                  className="h-7 text-xs"
                                />
                              )}
                              {rejected <= 0 && <span className="text-xs text-success">✓ Full</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <label className="block">
                  <span className="mb-1 block text-xs text-muted-foreground">Overall remarks</span>
                  <Input value={qcRemarks} onChange={(e) => setQcRemarks(e.target.value)} placeholder="General inspection notes…" className="h-8 text-xs" />
                </label>

                <div className="flex gap-2">
                  <Button onClick={submitQC}>
                    <ShieldCheck className="size-4" /> Submit inspection
                  </Button>
                  <Button variant="ghost" onClick={() => setShowQC(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Post to inventory (qc-passed or legacy draft) */}
        {(grn.status === "qc-passed" || grn.status === "draft") && (
          <div className="border-t pt-4">
            {grn.status === "qc-passed" && totalAccepted > 0 && (
              <p className="mb-3 text-xs text-muted-foreground">
                QC passed. Posting will add <strong>{totalAccepted}</strong> accepted unit(s) to stock at {loc?.name}.
                {totalRejected > 0 && ` (${totalRejected} rejected units excluded.)`}
              </p>
            )}
            {grn.status === "draft" && (
              <p className="mb-3 text-xs text-muted-foreground">Post this GRN to add received quantities to inventory stock at {loc?.name}.</p>
            )}
            <Button onClick={onPost}>
              <CheckCircle2 className="size-4" /> Post to inventory
            </Button>
          </div>
        )}

        {grn.status === "qc-rejected" && (
          <div className="flex items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 px-3 py-2 text-xs text-danger">
            <ShieldX className="size-4" />
            All items rejected — no stock posted. Arrange return to vendor and raise a Debit Note.
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
  const [lines, setLines] = React.useState<GRNLine[]>([{ itemId: ITEMS[0]?.id ?? "", qty: 0 }]);
  const [freightTotal, setFreightTotal] = React.useState<number | "">("");
  const [freightBasis, setFreightBasis] = React.useState<"value" | "qty">("value");
  const [prefetchedTitle, setPrefetchedTitle] = React.useState<string | null>(null);
  const [prefetchError, setPrefetchError] = React.useState<string | null>(null);

  function addLine() { setLines((p) => [...p, { itemId: ITEMS[0]?.id ?? "", qty: 0 }]); }
  function removeLine(i: number) { setLines((p) => p.filter((_, j) => j !== i)); }
  function updateLine(i: number, patch: Partial<GRNLine>) {
    setLines((p) => p.map((l, j) => j === i ? { ...l, ...patch } : l));
  }

  function fetchFromPO() {
    const ref = poRef.trim().toUpperCase();
    if (!ref) return;
    const po = PURCHASE_ORDERS.find(
      (p) => p.id.toUpperCase() === ref || p.id.toUpperCase() === ref.replace(/^PO-?/, "PO-"),
    );
    if (!po) {
      setPrefetchedTitle(null);
      setPrefetchError(`No PO found for "${poRef.trim()}". Check the reference and try again.`);
      return;
    }
    const vendor = VENDORS.find((v) => v.id === po.vendorId);
    const invLines: GRNLine[] = po.lines
      .filter((l) => l.itemId && itemById(l.itemId))
      .map((l) => ({ itemId: l.itemId!, qty: l.qty, unitPrice: l.unitPrice > 0 ? l.unitPrice : undefined }));

    setVendorName(vendor?.name ?? "");
    setLocationId(po.locationId);
    setPrefetchedTitle(`${po.id} — ${po.title}`);
    setPrefetchError(null);
    if (invLines.length > 0) setLines(invLines);
  }

  const valid = vendorName.trim().length > 0 && lines.every((l) => l.qty > 0);

  return (
    <Drawer open onClose={onClose} title="New Goods Receipt Note" subtitle={nextRef}>
      <div className="space-y-4">

        {/* PO lookup — the primary entry point */}
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">
            PO / PR reference <span className="text-muted-foreground/60">(enter to prefetch vendor + items)</span>
          </p>
          <div className="flex gap-2">
            <Input
              value={poRef}
              onChange={(e) => { setPoRef(e.target.value); setPrefetchedTitle(null); setPrefetchError(null); }}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); fetchFromPO(); } }}
              placeholder="PO-2007"
              className="h-9 font-mono"
            />
            <Button size="sm" variant="outline" onClick={fetchFromPO} className="shrink-0 h-9">
              <Search className="size-3.5 mr-1" /> Fetch PO
            </Button>
          </div>
          {prefetchedTitle && (
            <div className="mt-1.5 flex items-start gap-1.5 rounded-md border border-success/30 bg-success/5 px-2.5 py-1.5 text-xs text-success">
              <Info className="size-3.5 mt-0.5 shrink-0" />
              <span>Pre-filled from <strong>{prefetchedTitle}</strong>. You can override any quantity below.</span>
            </div>
          )}
          {prefetchError && (
            <p className="mt-1 text-xs text-danger">{prefetchError}</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="block col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Vendor name *</span>
            <Input value={vendorName} onChange={(e) => setVendorName(e.target.value)} placeholder="Supplier name" className="h-9" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Receiving location</span>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-9">
              {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Received by</span>
            <Select value={receivedBy} onChange={(e) => setReceivedBy(e.target.value)} className="h-9">
              {ACTIVE_EMPLOYEES.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
            </Select>
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-muted-foreground">Items received</p>
            {prefetchedTitle && (
              <span className="text-[10px] text-muted-foreground">Qty pre-filled from PO — override as needed</span>
            )}
          </div>
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
                      className={cn("h-8 w-20 text-right tabular", prefetchedTitle && "border-primary/40 bg-primary/5")}
                    />
                    <span className="w-6 shrink-0 text-xs text-muted-foreground">{item?.uom}</span>
                    <Input
                      type="number" min={0} step={0.01}
                      value={l.unitPrice ?? ""}
                      onChange={(e) => updateLine(i, { unitPrice: e.target.value === "" ? undefined : Number(e.target.value) })}
                      placeholder="₹/unit"
                      title="Unit purchase price (for WACOG costing)"
                      className={cn("h-8 w-24 text-right tabular", prefetchedTitle && l.unitPrice ? "border-primary/40 bg-primary/5" : "")}
                    />
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

        {/* Freight allocation */}
        <div>
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Truck className="size-3.5" /> Freight / transport charge
            <span className="text-muted-foreground/60">(optional — allocates to SKUs by value or qty)</span>
          </p>
          <div className="flex gap-2">
            <Input
              type="number" min={0}
              value={freightTotal}
              onChange={(e) => setFreightTotal(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="₹ freight amount"
              className="h-9 flex-1"
            />
            <Select value={freightBasis} onChange={(e) => setFreightBasis(e.target.value as "value" | "qty")} className="h-9 w-36">
              <option value="value">By value</option>
              <option value="qty">By quantity</option>
            </Select>
          </div>
          {freightTotal !== "" && Number(freightTotal) > 0 && lines.some((l) => l.qty > 0) && (
            <p className="mt-1.5 text-[11px] text-muted-foreground">
              Will be split across {lines.filter((l) => l.qty > 0).length} line(s). Landed cost shown in GRN detail.
            </p>
          )}
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
            status: "pending-qc",
            freightTotal: freightTotal !== "" && Number(freightTotal) > 0 ? Number(freightTotal) : undefined,
            freightBasis: freightTotal !== "" && Number(freightTotal) > 0 ? freightBasis : undefined,
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
