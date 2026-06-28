"use client";

import * as React from "react";
import { Check, X, RotateCcw, Building2, Info, Star, ArrowRight, Banknote, FileCheck, Users, Sparkles, ShieldCheck, Plus, Trash2, TrendingUp, TrendingDown, AlertTriangle, PackageCheck, BarChart3, Pencil, XOctagon, History, Search, Copy, Link2, ExternalLink, UserPlus, Clock } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Input, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/modal";
import { VoucherButton } from "@/components/accounting/voucher-button";
import { PayBills } from "./pay-bills";
import { P2PTrail } from "./p2p-trail";
import { vendorPortalUrl } from "@/lib/vendors/vendor-portal";
import { loadOnboardings, updateOnboardingStatus, type VendorOnboarding } from "@/lib/vendors/onboarding";
import { loadP2P, p2pStage, matchPoInvoice, DEFAULT_MATCH_TOLERANCE_PCT, STAGE_META, STAGE_ORDER, type P2PStore, type P2PStage } from "@/lib/p2p";
import { cn, formatDate } from "@/lib/utils";
import { ENTITIES, LOCATIONS, entityById, locationById } from "@/lib/accounting/org";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { ACTIVE_EMPLOYEES, employeeName } from "@/lib/hr/employees";
import { loadDecisions, saveDecisions, type Decision } from "@/lib/hr/approvals";
import { appendAudit } from "@/lib/audit/audit-log";
import { ITEMS, itemById } from "@/lib/inventory/items";
import { buildBudget, loadOverrides, loadAssumptions } from "@/lib/planning/budget";
import {
  allGRNs, loadGRNs,
  type GoodsReceiptNote,
} from "@/lib/inventory/supply-chain";
import {
  VENDORS,
  PURCHASE_ORDERS,
  vendorName,
  vendorById,
  effectiveStatus,
  invoiceApprovalId,
  autoPaymentRef,
  loadPoPayments,
  loadAddedPOs,
  saveAddedPOs,
  allPOs,
  buildNewPO,
  CLASS_META,
  VENDOR_CLASSES,
  CLASS_COA_SUBTYPES,
  loadPOMutations,
  savePOMutations,
  applyPOMutations,
  type PurchaseOrder,
  type POLine,
  type POAmendment,
  type POMutation,
  type POEffectiveStatus,
  type VendorClass,
} from "@/lib/vendors";

const STATUS_META: Record<POEffectiveStatus, { label: string; variant: "default" | "warning" | "success" | "danger" | "primary" }> = {
  issued: { label: "Awaiting invoice", variant: "default" },
  "pending-approval": { label: "Pending SPOC approval", variant: "warning" },
  "approved-paid": { label: "Approved · Auto-paid", variant: "success" },
  rejected: { label: "Invoice rejected", variant: "danger" },
  paid: { label: "Paid", variant: "success" },
};

// ---------------------------------------------------------------------------
// Delivery balance helpers
// ---------------------------------------------------------------------------
interface LineBalance {
  itemId?: string;
  itemDesc: string;
  ordered: number;
  received: number;
  balance: number;
  receivedPct: number;
}

function computeDeliveryBalance(po: PurchaseOrder, grns: GoodsReceiptNote[]): LineBalance[] {
  const poGRNs = grns.filter((g) => g.poRef === po.id && g.status === "posted");
  return po.lines.map((l) => {
    const received = poGRNs.reduce((s, g) => {
      const match = g.lines.find((gl) => gl.itemId === l.itemId);
      return s + (match?.qty ?? 0);
    }, 0);
    const ordered = l.qty;
    const balance = Math.max(0, ordered - received);
    const receivedPct = ordered > 0 ? Math.min(100, (received / ordered) * 100) : 0;
    return { itemId: l.itemId, itemDesc: l.item, ordered, received, balance, receivedPct };
  });
}

// ---------------------------------------------------------------------------
// Vendor scorecard helpers
// ---------------------------------------------------------------------------
interface VendorScorecard {
  vendorId: string;
  otdPct: number | null;       // On-time delivery %
  shortfallPct: number | null; // Average delivery shortfall %
  poCount: number;
  lastRates: Array<{ poId: string; date: string; unitPrice: number; item: string }>;
}

function computeVendorScorecard(vendorId: string, allOrders: PurchaseOrder[], grns: GoodsReceiptNote[]): VendorScorecard {
  const vendorPOs = allOrders.filter((po) => po.vendorId === vendorId);
  const poCount = vendorPOs.length;

  // OTD: GRN date ≤ PO date + 21 days (generic lead time since we don't store expected delivery)
  const receivedPOs = vendorPOs.filter((po) => grns.some((g) => g.poRef === po.id && g.status === "posted"));
  let onTimeCount = 0;
  for (const po of receivedPOs) {
    const expectedDeadline = new Date(po.date);
    expectedDeadline.setDate(expectedDeadline.getDate() + 21);
    const poGRNs = grns.filter((g) => g.poRef === po.id && g.status === "posted");
    const allOnTime = poGRNs.every((g) => new Date(g.date) <= expectedDeadline);
    if (allOnTime) onTimeCount++;
  }
  const otdPct = receivedPOs.length > 0 ? Math.round((onTimeCount / receivedPOs.length) * 100) : null;

  // Shortfall: avg (1 - received/ordered) per PO line
  let totalShortfallPct = 0;
  let shortfallCount = 0;
  for (const po of receivedPOs) {
    const bal = computeDeliveryBalance(po, grns);
    for (const b of bal) {
      if (b.ordered > 0) {
        totalShortfallPct += (1 - b.receivedPct / 100) * 100;
        shortfallCount++;
      }
    }
  }
  const shortfallPct = shortfallCount > 0 ? Math.round(totalShortfallPct / shortfallCount) : null;

  // Last 5 PO rates (most recent first)
  const lastRates = vendorPOs
    .flatMap((po) => po.lines.filter((l) => l.unitPrice > 0).map((l) => ({ poId: po.id, date: po.date, unitPrice: l.unitPrice, item: l.item })))
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  return { vendorId, otdPct, shortfallPct, poCount, lastRates };
}

// ---------------------------------------------------------------------------
// Last rate for item (for PO creation prefill)
// ---------------------------------------------------------------------------
function lastRateForItem(itemId: string, orders: PurchaseOrder[]) {
  const matches = orders
    .flatMap((po) => po.lines.filter((l) => l.itemId === itemId && l.unitPrice > 0).map((l) => ({ vendorId: po.vendorId, unitPrice: l.unitPrice, poId: po.id, date: po.date })))
    .sort((a, b) => b.date.localeCompare(a.date));
  if (!matches.length) return null;
  const m = matches[0];
  const daysAgo = Math.round((new Date("2026-06-26").getTime() - new Date(m.date).getTime()) / 86400000);
  return { ...m, daysAgo };
}

export function VendorsClient() {
  const [decisions, setDecisions] = React.useState<Record<string, Decision>>({});
  const [tab, setTab] = React.useState<"orders" | "vendors">("orders");
  const [payOpen, setPayOpen] = React.useState(false);
  const [vClassFilter, setVClassFilter] = React.useState<"all" | VendorClass>("all");
  const [p2p, setP2p] = React.useState<P2PStore>({});
  const [payments, setPayments] = React.useState<Record<string, number>>({});
  const [trailPo, setTrailPo] = React.useState<PurchaseOrder | null>(null);
  const [addedPOs, setAddedPOs] = React.useState<PurchaseOrder[]>([]);
  const [creatingPO, setCreatingPO] = React.useState(false);
  const [grns, setGrns] = React.useState<GoodsReceiptNote[]>([]);
  const [selectedPO, setSelectedPO] = React.useState<PurchaseOrder | null>(null);
  const [mutations, setMutations] = React.useState<Record<string, POMutation>>({});
  const [poSearch, setPoSearch] = React.useState("");
  const [vendorSearch, setVendorSearch] = React.useState("");

  const refresh = React.useCallback(() => {
    setDecisions(loadDecisions());
    setP2p(loadP2P());
    setPayments(loadPoPayments());
    setAddedPOs(loadAddedPOs());
    setGrns(allGRNs(loadGRNs()));
    setMutations(loadPOMutations());
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const allOrders = React.useMemo(
    () => applyPOMutations(allPOs(addedPOs), mutations),
    [addedPOs, mutations],
  );

  function decide(po: PurchaseOrder, decision: Decision) {
    const next = { ...decisions, [invoiceApprovalId(po.id)]: decision };
    saveDecisions(next);
    setDecisions(next);
    appendAudit({
      actorId: null,
      module: "Vendors",
      action: decision === "approved" ? "approve" : "update",
      record: po.id,
      field: decision === "rejected" ? "Invoice decision" : undefined,
      before: decision === "rejected" ? "pending-approval" : undefined,
      after: decision === "approved"
        ? `Invoice ₹${(po.invoice?.amount ?? 0).toLocaleString("en-IN")} approved · ${po.title}`
        : `Invoice rejected · ${po.title}`,
    });
  }
  function undo(po: PurchaseOrder) {
    setDecisions((prev) => {
      const next = { ...prev };
      delete next[invoiceApprovalId(po.id)];
      saveDecisions(next);
      return next;
    });
  }

  const allOrderRows = allOrders.map((po) => ({ po, status: effectiveStatus(po, decisions) }));
  const orders = poSearch
    ? allOrderRows.filter(({ po }) => {
        const q = poSearch.toLowerCase();
        return po.id.toLowerCase().includes(q) || po.title.toLowerCase().includes(q) || vendorName(po.vendorId).toLowerCase().includes(q);
      })
    : allOrderRows;
  const awaiting = allOrderRows.filter((o) => o.status === "pending-approval");
  const payables = awaiting.reduce((s, o) => s + (o.po.invoice?.amount ?? 0), 0);

  // 3-way match: which awaiting invoices reconcile to their PO within tolerance.
  const matchOf = (po: PurchaseOrder) => matchPoInvoice(po, p2p[po.id]);
  const autoApprovable = awaiting.filter((o) => matchOf(o.po).matched);

  function autoApproveMatched() {
    setDecisions((prev) => {
      const next = { ...prev };
      for (const o of autoApprovable) next[invoiceApprovalId(o.po.id)] = "approved";
      saveDecisions(next);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="Vendors"
        subtitle="Vendor master and purchase orders with SPOC-approved invoicing."
        actions={
          <div className="flex flex-wrap gap-2">
            <VoucherButton type="debit_note" label="Debit note" variant="outline" />
            <Button variant="outline" onClick={() => setPayOpen(true)}>
              <Banknote className="size-4" /> Pay bills
            </Button>
            <VoucherButton type="purchase" label="Purchase voucher" />
            <Button onClick={() => setCreatingPO(true)}>
              <Plus className="size-4" /> New PO
            </Button>
          </div>
        }
      />

      {/* Metrics */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Active vendors" value={VENDORS.filter((v) => v.active).length} />
        <Metric label="Purchase orders" value={allOrders.length} />
        <Metric label="Invoices awaiting approval" value={awaiting.length} highlight={awaiting.length > 0} />
        <MetricMoney label="Payables due" value={payables} />
      </div>

      {/* Workflow explainer */}
      <Card className="mb-4 flex items-start gap-3 border-primary/30 bg-primary/5 p-4">
        <Info className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          When a vendor invoice is received, it is routed to the <span className="font-medium text-foreground">SPOC who raised the PO</span> for
          approval. Once approved, the bill <span className="font-medium text-foreground">automatically moves to payment</span> — no separate
          payment step. Approvals here stay in sync with the central{" "}
          <span className="font-medium text-foreground">Approvals</span> queue.
        </p>
      </Card>

      {/* 3-way match auto-approval */}
      {tab === "orders" && autoApprovable.length > 0 && (
        <Card className="mb-4 flex flex-wrap items-center gap-3 border-success/40 bg-success/10 p-4">
          <ShieldCheck className="size-4 shrink-0 text-success" />
          <p className="text-sm">
            <strong>{autoApprovable.length}</strong> of {awaiting.length} pending invoice{awaiting.length === 1 ? "" : "s"} match their PO within{" "}
            {DEFAULT_MATCH_TOLERANCE_PCT}% tolerance — eligible for auto-approval. Mismatches stay for manual review.
          </p>
          <Button size="sm" className="ml-auto" onClick={autoApproveMatched}>
            <Sparkles className="size-4" /> Auto-approve {autoApprovable.length}
          </Button>
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1">
        {(["orders", "vendors"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {t === "orders" ? "Purchase Orders" : "Vendor Master"}
          </button>
        ))}
      </div>

      {tab === "orders" ? (
        <>
          <div className="mb-3 relative max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={poSearch} onChange={(e) => setPoSearch(e.target.value)} placeholder="Search PO, vendor…" className="h-8 pl-8 text-xs" />
          </div>
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">PO</th>
                  <th className="px-5 py-3 font-medium">Vendor</th>
                  <th className="px-5 py-3 font-medium">SPOC (approver)</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Delivery balance</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">P2P trail</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(({ po, status }) => {
                  const meta = STATUS_META[status];
                  const bal = computeDeliveryBalance(po, grns);
                  const totalOrdered = bal.reduce((s, b) => s + b.ordered, 0);
                  const totalReceived = bal.reduce((s, b) => s + b.received, 0);
                  const totalBalance = Math.max(0, totalOrdered - totalReceived);
                  return (
                    <tr key={po.id} onClick={() => setSelectedPO(po)} className="cursor-pointer border-b align-top transition-colors last:border-0 hover:bg-accent/50">
                      <td className="px-5 py-3">
                        <p className="font-mono text-xs font-semibold">{po.id}</p>
                        <p className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">{po.title}</p>
                        {po.invoice && (
                          <p className="mt-0.5 text-[11px] text-muted-foreground">
                            Inv {po.invoice.number} · {formatDate(po.invoice.date)}
                          </p>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <p className="font-medium">{vendorName(po.vendorId)}</p>
                        <p className="text-xs text-muted-foreground">
                          {entityById(po.entityId)?.name} — {locationById(po.locationId)?.name}
                        </p>
                      </td>
                      <td className="px-5 py-3 text-muted-foreground">{employeeName(po.spocId)}</td>
                      <td className="px-5 py-3 text-right">
                        <Money value={po.total} className="font-semibold" />
                      </td>
                      <td className="px-5 py-3">
                        {totalOrdered > 0 ? (
                          <div className="text-xs">
                            <div className="flex gap-3 tabular-nums">
                              <span className="text-muted-foreground">Ord: <span className="text-foreground font-medium">{totalOrdered}</span></span>
                              <span className="text-success">Rcvd: <span className="font-medium">{totalReceived}</span></span>
                              {totalBalance > 0
                                ? <span className="text-warning font-medium">Bal: {totalBalance}</span>
                                : <span className="text-success font-medium">✓ Full</span>}
                            </div>
                            <div className="mt-1 h-1 w-full rounded-full bg-muted">
                              <div className="h-full rounded-full bg-success" style={{ width: `${totalOrdered > 0 ? Math.min(100, (totalReceived / totalOrdered) * 100) : 0}%` }} />
                            </div>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        {status === "pending-approval" && (() => {
                          const m = matchOf(po);
                          return (
                            <p className={cn("mt-1 flex items-center gap-1 text-[11px]", m.matched ? "text-success" : "text-warning")} title={m.reason}>
                              {m.matched ? <ShieldCheck className="size-3" /> : <Info className="size-3" />}
                              {m.matched ? (m.way === 3 ? "3-way match" : "Matches PO") : `Variance ${m.variancePct}%`}
                            </p>
                          );
                        })()}
                        {status === "approved-paid" && (
                          <p className="mt-1 text-[11px] text-muted-foreground">{autoPaymentRef(po)}</p>
                        )}
                        {status === "paid" && po.paidOn && (
                          <p className="mt-1 text-[11px] text-muted-foreground">on {formatDate(po.paidOn)}</p>
                        )}
                      </td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <TrailCell po={po} stage={p2pStage(po, p2p[po.id], payments[po.id] ?? 0)} onClick={() => setTrailPo(po)} />
                      </td>
                      <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-2">
                          {status === "pending-approval" ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => decide(po, "rejected")}>
                                <X className="size-3.5" /> Reject
                              </Button>
                              <Button size="sm" onClick={() => decide(po, "approved")}>
                                <Check className="size-3.5" /> Approve & pay
                              </Button>
                            </>
                          ) : status === "approved-paid" || status === "rejected" ? (
                            <button onClick={() => undo(po)} className="text-muted-foreground hover:text-foreground" title="Undo decision">
                              <RotateCcw className="size-4" />
                            </button>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        </>
      ) : (
        <>
          {/* Pending onboarding registrations */}
          <OnboardingInbox />

          {/* vendor search + class filter */}
          <div className="mb-3 relative max-w-xs">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={vendorSearch} onChange={(e) => setVendorSearch(e.target.value)} placeholder="Search vendor, city, GSTIN…" className="h-8 pl-8 text-xs" />
          </div>
          <div className="mb-4 flex flex-wrap gap-1.5">
            <ClassChip label="All" active={vClassFilter === "all"} count={VENDORS.length} onClick={() => setVClassFilter("all")} />
            {VENDOR_CLASSES.map((c) => (
              <ClassChip
                key={c}
                label={CLASS_META[c].label}
                active={vClassFilter === c}
                count={VENDORS.filter((v) => v.vClass === c).length}
                onClick={() => setVClassFilter(c)}
              />
            ))}
          </div>

          {VENDOR_CLASSES.filter((c) => vClassFilter === "all" || vClassFilter === c).map((c) => {
            const vendors = VENDORS.filter((v) => {
              if (v.vClass !== c) return false;
              if (!vendorSearch) return true;
              const q = vendorSearch.toLowerCase();
              return v.name.toLowerCase().includes(q) || (v.city ?? "").toLowerCase().includes(q) || (v.gstin ?? "").toLowerCase().includes(q) || v.vClass.toLowerCase().includes(q);
            });
            if (vendors.length === 0) return null;
            return (
              <div key={c} className="mb-6">
                <div className="mb-2 flex items-baseline gap-2">
                  <h3 className="text-sm font-semibold">{CLASS_META[c].label}</h3>
                  <span className="text-xs text-muted-foreground">{CLASS_META[c].blurb}</span>
                  <Badge variant="outline" className="ml-auto text-[10px]">{CLASS_META[c].accountHint}</Badge>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {vendors.map((v) => (
                    <VendorCard key={v.id} v={v} allOrders={allOrders} grns={grns} />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      {tab === "orders" && awaiting.length > 0 && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted-foreground">
          <ArrowRight className="size-3.5" />
          {awaiting.length} invoice{awaiting.length === 1 ? "" : "s"} also appear in the central Approvals queue for the respective SPOC.
        </p>
      )}

      <PayBills open={payOpen} onClose={() => setPayOpen(false)} onPosted={refresh} />
      <P2PTrail po={trailPo} onClose={() => setTrailPo(null)} onChanged={refresh} />

      {/* PO detail with delivery balance, amendment, short-close */}
      {selectedPO && (() => {
        // Always show the mutated version of the PO
        const livePO = allOrders.find((p) => p.id === selectedPO.id) ?? selectedPO;
        return (
          <PODetailDrawer
            po={livePO}
            grns={grns}
            allOrders={allOrders}
            onClose={() => setSelectedPO(null)}
            onMutate={(patch) => {
              const next = {
                ...mutations,
                [livePO.id]: {
                  amendments: patch.amendments ?? mutations[livePO.id]?.amendments ?? [],
                  shortClosed: patch.shortClosed ?? mutations[livePO.id]?.shortClosed,
                  committedAmount: patch.committedAmount ?? mutations[livePO.id]?.committedAmount,
                },
              };
              savePOMutations(next);
              setMutations(next);
            }}
          />
        );
      })()}

      {creatingPO && (
        <CreatePODrawer
          addedPOs={addedPOs}
          onClose={() => setCreatingPO(false)}
          onCreate={(po) => {
            const next = [...addedPOs, po];
            setAddedPOs(next);
            saveAddedPOs(next);
            appendAudit({
              actorId: null,
              module: "Vendors",
              action: "create",
              record: po.id,
              after: `${vendorName(po.vendorId)} · ${po.lines.length} line(s) · ${po.title}`,
            });
            setCreatingPO(false);
          }}
        />
      )}
    </>
  );
}

// ============================================================
// PO DETAIL DRAWER — delivery balance + last rates
// ============================================================

function PODetailDrawer({
  po, grns, allOrders, onClose, onMutate,
}: {
  po: PurchaseOrder;
  grns: GoodsReceiptNote[];
  allOrders: PurchaseOrder[];
  onClose: () => void;
  onMutate: (patch: Partial<POMutation>) => void;
}) {
  const [view, setView] = React.useState<"detail" | "amend">("detail");
  const bal = computeDeliveryBalance(po, grns);
  const totalOrdered = bal.reduce((s, b) => s + b.ordered, 0);
  const totalReceived = bal.reduce((s, b) => s + b.received, 0);
  const totalBalance = Math.max(0, totalOrdered - totalReceived);
  const poGRNs = grns.filter((g) => g.poRef === po.id);

  // Short-close: committed value = value of goods actually received
  const receivedValue = poGRNs
    .filter((g) => g.status === "posted")
    .flatMap((g) => g.lines)
    .reduce((s, gl) => {
      const poLine = po.lines.find((l) => l.itemId === gl.itemId);
      return s + (poLine ? gl.qty * poLine.unitPrice : 0);
    }, 0);

  function shortClose() {
    onMutate({
      shortClosed: true,
      committedAmount: receivedValue,
      amendments: po.amendments ?? [],
    });
  }

  const canAmend = !po.shortClosed && po.status === "issued";
  const canShortClose = !po.shortClosed && po.status === "issued" && totalBalance > 0;

  return (
    <Drawer open onClose={onClose} title={po.id} subtitle={po.title}>
      {view === "amend" ? (
        <AmendPOView
          po={po}
          onCancel={() => setView("detail")}
          onSave={(newLines, reason) => {
            const newTotal = newLines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
            const amend: POAmendment = {
              id: `amend-${Date.now()}`,
              date: "2026-06-26",
              reason,
              amendedBy: "emp-023",
              prevLines: po.lines,
              prevTotal: po.total,
              newLines,
              newTotal,
            };
            onMutate({
              amendments: [...(po.amendments ?? []), amend],
              shortClosed: po.shortClosed,
              committedAmount: po.committedAmount,
            });
            setView("detail");
          }}
        />
      ) : (
        <div className="space-y-5">
          {/* Short-closed banner */}
          {po.shortClosed && (
            <div className="flex items-center gap-2 rounded-lg border border-muted bg-muted/30 px-3 py-2.5 text-xs">
              <XOctagon className="size-4 text-muted-foreground shrink-0" />
              <div>
                <p className="font-semibold">Short-closed</p>
                <p className="text-muted-foreground">
                  Committed: <Money value={po.committedAmount ?? 0} compact /> of <Money value={po.total} compact /> original.
                  {" "}Balance of <Money value={Math.max(0, po.total - (po.committedAmount ?? 0))} compact /> released back to budget.
                </p>
              </div>
            </div>
          )}

          {/* Amendment badge */}
          {(po.amendments?.length ?? 0) > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-xs">
              <History className="size-3.5 text-primary shrink-0" />
              <span className="text-primary font-medium">{po.amendments!.length} amendment{po.amendments!.length > 1 ? "s" : ""} on record</span>
              <span className="text-muted-foreground">— latest total: <Money value={po.total} compact /></span>
            </div>
          )}

          {/* Delivery summary cards */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Ordered</p>
              <p className="text-lg font-bold tabular-nums mt-1">{totalOrdered}</p>
            </div>
            <div className="rounded-lg border border-success/30 bg-success/5 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Received</p>
              <p className="text-lg font-bold tabular-nums mt-1 text-success">{totalReceived}</p>
            </div>
            <div className={cn("rounded-lg border p-3", totalBalance > 0 ? "border-warning/30 bg-warning/5" : "border-success/30 bg-success/5")}>
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Pending</p>
              <p className={cn("text-lg font-bold tabular-nums mt-1", totalBalance > 0 ? "text-warning" : "text-success")}>
                {totalBalance > 0 ? totalBalance : "—"}
              </p>
            </div>
          </div>

          {/* Line-by-line delivery balance */}
          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Delivery balance per line</p>
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="py-1.5 font-medium">Item</th>
                  <th className="py-1.5 text-right font-medium">Ordered</th>
                  <th className="py-1.5 text-right font-medium">Received</th>
                  <th className="py-1.5 text-right font-medium">Balance</th>
                </tr>
              </thead>
              <tbody>
                {bal.map((b, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2">
                      <p className="font-medium">{b.itemDesc}</p>
                      {b.itemId && <p className="text-[10px] text-muted-foreground font-mono">{b.itemId}</p>}
                      <div className="mt-1 h-1 w-24 rounded-full bg-muted">
                        <div className="h-full rounded-full bg-success" style={{ width: `${b.receivedPct}%` }} />
                      </div>
                    </td>
                    <td className="py-2 text-right tabular-nums">{b.ordered}</td>
                    <td className="py-2 text-right tabular-nums text-success">{b.received}</td>
                    <td className={cn("py-2 text-right tabular-nums font-semibold", b.balance > 0 ? "text-warning" : "text-success")}>
                      {b.balance > 0 ? b.balance : "✓"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* GRNs */}
          {poGRNs.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">GRNs against this PO</p>
              <div className="space-y-1.5">
                {poGRNs.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-xs">
                    <PackageCheck className="size-3.5 text-success shrink-0" />
                    <span className="font-mono font-medium">{g.ref}</span>
                    <span className="text-muted-foreground">{g.date}</span>
                    <Badge variant={g.status === "posted" ? "success" : "default"} className="text-[10px]">{g.status}</Badge>
                    <span className="ml-auto text-muted-foreground">{g.lines.length} line{g.lines.length > 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Amendment history */}
          {(po.amendments?.length ?? 0) > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Amendment history</p>
              <div className="space-y-2">
                {po.amendments!.map((a, i) => (
                  <div key={a.id} className="rounded-lg border bg-muted/20 p-3 text-xs space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="primary" className="text-[9px]">AMD {i + 1}</Badge>
                      <span className="text-muted-foreground">{a.date}</span>
                      <span className="ml-auto font-medium">{a.reason}</span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <span>Before: <Money value={a.prevTotal} compact /></span>
                      <span>→</span>
                      <span className={cn("font-semibold", a.newTotal > a.prevTotal ? "text-danger" : "text-success")}>
                        <Money value={a.newTotal} compact />
                      </span>
                      <span className={cn("text-[10px]", a.newTotal > a.prevTotal ? "text-danger" : "text-success")}>
                        {a.newTotal > a.prevTotal ? "+" : ""}<Money value={a.newTotal - a.prevTotal} compact />
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Historical rates */}
          {po.lines.some((l) => l.itemId) && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Historical rates</p>
              <div className="space-y-1.5">
                {po.lines.filter((l) => l.itemId).map((l) => {
                  const last = lastRateForItem(l.itemId!, allOrders);
                  if (!last) return null;
                  return (
                    <div key={l.itemId} className="flex items-center gap-3 text-xs">
                      <span className="font-medium w-40 truncate">{l.item}</span>
                      <span className="tabular-nums font-semibold">₹{l.unitPrice.toLocaleString("en-IN")}</span>
                      <span className="text-muted-foreground text-[10px]">this PO</span>
                      {last.unitPrice !== l.unitPrice && (
                        <span className={cn("ml-auto flex items-center gap-0.5 text-[10px] font-medium", l.unitPrice > last.unitPrice ? "text-danger" : "text-success")}>
                          {l.unitPrice > last.unitPrice ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
                          ₹{last.unitPrice.toLocaleString("en-IN")} on {last.poId}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          {(canAmend || canShortClose) && (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {canAmend && (
                <Button variant="outline" size="sm" onClick={() => setView("amend")}>
                  <Pencil className="size-3.5" /> Amend PO
                </Button>
              )}
              {canShortClose && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-warning border-warning/40 hover:bg-warning/5"
                  onClick={shortClose}
                >
                  <XOctagon className="size-3.5" /> Short-close
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

// ---------------------------------------------------------------------------
// AmendPOView — inline sub-view inside PODetailDrawer
// ---------------------------------------------------------------------------
function AmendPOView({
  po,
  onCancel,
  onSave,
}: {
  po: PurchaseOrder;
  onCancel: () => void;
  onSave: (newLines: POLine[], reason: string) => void;
}) {
  const [lines, setLines] = React.useState<POLine[]>(() =>
    po.lines.map((l) => ({ ...l }))
  );
  const [reason, setReason] = React.useState("");

  function updateLine(i: number, patch: Partial<POLine>) {
    setLines((p) => p.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  }

  const newTotal = lines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const delta = newTotal - po.total;
  const valid = reason.trim().length > 0 && lines.every((l) => l.qty > 0 && l.unitPrice >= 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2.5 text-xs">
        <Pencil className="size-3.5 text-primary shrink-0" />
        <span className="text-primary font-medium">Amending {po.id}</span>
        <span className="text-muted-foreground ml-1">— original total: <Money value={po.total} compact /></span>
      </div>

      <div>
        <p className="mb-2 text-xs font-medium text-muted-foreground uppercase tracking-wide">Edit lines</p>
        <div className="space-y-2">
          {lines.map((l, i) => (
            <div key={i} className="rounded-lg border p-2.5 space-y-1.5">
              <p className="text-xs font-medium">{l.item}</p>
              <div className="flex gap-2">
                <label className="block flex-1">
                  <span className="text-[10px] text-muted-foreground">Qty</span>
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
                  <p className="mt-0.5 text-xs font-semibold tabular-nums"><Money value={l.qty * l.unitPrice} /></p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* New total + delta */}
      <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm">
        <div className="flex items-center justify-between">
          <span className="font-medium">Amended total</span>
          <span className="font-bold tabular-nums"><Money value={newTotal} /></span>
        </div>
        {delta !== 0 && (
          <div className={cn("mt-1 flex items-center gap-1.5 text-xs font-medium", delta > 0 ? "text-danger" : "text-success")}>
            {delta > 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
            {delta > 0 ? "Budget commitment increases by " : "Budget commitment reduces by "}
            <Money value={Math.abs(delta)} compact />
            {delta > 0
              ? " — check headroom before saving."
              : " — headroom released automatically."}
          </div>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-xs font-medium text-muted-foreground">Reason for amendment *</span>
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g. Vendor revised price, additional qty required…"
          className="h-9"
        />
      </label>

      <div className="flex gap-2 border-t pt-4">
        <Button onClick={() => onSave(lines, reason.trim())} disabled={!valid}>
          <Pencil className="size-4" /> Save amendment
        </Button>
        <Button variant="ghost" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
}

// ============================================================
// CREATE PO DRAWER — with budget balance
// ============================================================

interface FormLine { item: string; qty: number; unitPrice: number; itemId?: string }

function CreatePODrawer({
  addedPOs,
  onClose,
  onCreate,
}: {
  addedPOs: PurchaseOrder[];
  onClose: () => void;
  onCreate: (po: PurchaseOrder) => void;
}) {
  const allOrders = allPOs(addedPOs);
  const [vid, setVid] = React.useState(VENDORS.find((v) => v.active)?.id ?? VENDORS[0]?.id ?? "");
  const [title, setTitle] = React.useState("");
  const [entityId, setEntityId] = React.useState("ent-nexa-in");
  const [locationId, setLocationId] = React.useState("loc-mys");
  const [spocId, setSpocId] = React.useState(ACTIVE_EMPLOYEES[0]?.id ?? "");
  const [formLines, setFormLines] = React.useState<FormLine[]>([{ item: "", qty: 1, unitPrice: 0 }]);

  const filteredLocations = LOCATIONS.filter((l) => {
    const ent = ENTITIES.find((e) => e.id === entityId);
    return !ent || l.id.startsWith("loc-");
  });

  // Budget balance — recomputed when vendor or entity changes
  const budgetBalance = React.useMemo(() => {
    const vendor = vendorById(vid);
    if (!vendor) return null;
    const assumptions = loadAssumptions();
    const overrides = loadOverrides(entityId, 2026);
    const model = buildBudget(entityId, "accrual", 2026, "2026-06", assumptions, overrides);
    const subtypes = CLASS_COA_SUBTYPES[vendor.vClass];
    const relevantLines = model.lines.filter(
      (l) => l.type === "expense" && subtypes.some((s) => l.subtype === s),
    );
    const annualBudget = relevantLines.reduce((s, l) => s + l.budget.reduce((a, b) => a + b, 0), 0);
    const ytdActual = relevantLines.reduce((s, l) => s + l.actual.reduce((a, b) => a + b, 0), 0);
    const openCommitment = allPOs(addedPOs)
      .filter((po) => vendorById(po.vendorId)?.vClass === vendor.vClass && po.status === "issued")
      .reduce((s, po) => s + (po.shortClosed ? (po.committedAmount ?? 0) : po.total), 0);
    const available = annualBudget - ytdActual - openCommitment;
    return { annualBudget, ytdActual, openCommitment, available, vClass: vendor.vClass };
  }, [vid, entityId, addedPOs]);

  const poTotal = formLines.reduce((s, l) => s + l.qty * l.unitPrice, 0);
  const afterThisPO = (budgetBalance?.available ?? 0) - poTotal;
  const overBudget = budgetBalance && budgetBalance.annualBudget > 0 && afterThisPO < 0;

  function addLine() { setFormLines((p) => [...p, { item: "", qty: 1, unitPrice: 0 }]); }
  function removeLine(i: number) { setFormLines((p) => p.filter((_, j) => j !== i)); }
  function updateLine(i: number, patch: Partial<FormLine>) {
    setFormLines((p) => p.map((l, j) => j === i ? { ...l, ...patch } : l));
  }

  const valid = title.trim().length > 0 && vid && formLines.length > 0 &&
    formLines.every((l) => l.item.trim().length > 0 && l.qty > 0 && l.unitPrice >= 0);

  function submit() {
    const po = buildNewPO(addedPOs, {
      vendorId: vid,
      title: title.trim(),
      date: "2026-06-26",
      lines: formLines.map((l) => ({ item: l.item, qty: l.qty, unitPrice: l.unitPrice, itemId: l.itemId })),
      spocId,
      entityId,
      locationId,
      status: "issued",
    });
    onCreate(po);
  }

  return (
    <Drawer open onClose={onClose} title="New Purchase Order" subtitle="Draft a PO with budget check">
      <div className="space-y-4">

        {/* Vendor */}
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Vendor *</span>
          <Select value={vid} onChange={(e) => setVid(e.target.value)} className="h-9">
            {VENDORS.filter((v) => v.active).map((v) => (
              <option key={v.id} value={v.id}>{v.name} — {v.category}</option>
            ))}
          </Select>
        </label>

        {/* Budget balance widget */}
        {budgetBalance && budgetBalance.annualBudget > 0 && (
          <div className={cn(
            "rounded-lg border p-3 text-xs",
            overBudget ? "border-danger/40 bg-danger/5" : "border-success/30 bg-success/5",
          )}>
            <div className="flex items-center gap-1.5 mb-2 font-medium">
              {overBudget
                ? <AlertTriangle className="size-3.5 text-danger" />
                : <TrendingUp className="size-3.5 text-success" />}
              <span>{CLASS_META[budgetBalance.vClass].label} — FY 2026-27 Budget Position</span>
            </div>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-muted-foreground">
              <span>Annual budget</span>
              <span className="tabular-nums text-right font-medium text-foreground">
                <Money value={budgetBalance.annualBudget} compact />
              </span>
              <span>YTD actual spend</span>
              <span className="tabular-nums text-right text-warning font-medium">
                <Money value={budgetBalance.ytdActual} compact />
              </span>
              <span>Open PO commitments</span>
              <span className="tabular-nums text-right text-muted-foreground font-medium">
                <Money value={budgetBalance.openCommitment} compact />
              </span>
              <span className="font-medium text-foreground border-t pt-1">Available headroom</span>
              <span className={cn("tabular-nums text-right font-semibold border-t pt-1", budgetBalance.available < 0 ? "text-danger" : "text-success")}>
                <Money value={budgetBalance.available} compact />
              </span>
            </div>
            {poTotal > 0 && (
              <div className={cn("mt-2 flex items-center gap-1.5 rounded-md px-2 py-1.5 font-medium",
                overBudget ? "bg-danger/10 text-danger" : "bg-success/10 text-success")}>
                {overBudget
                  ? <TrendingDown className="size-3.5" />
                  : <TrendingUp className="size-3.5" />}
                <span>After this PO (<Money value={poTotal} compact />): </span>
                <span className="tabular-nums"><Money value={afterThisPO} compact /></span>
                {overBudget && <Badge variant="danger" className="ml-auto text-[9px]">Over budget</Badge>}
              </div>
            )}
          </div>
        )}

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">PO title / purpose *</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Wheat grain — July restock" className="h-9" />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Entity</span>
            <EntityCombobox value={entityId} onChange={setEntityId} className="h-9" />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Location</span>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-9">
              {filteredLocations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </label>
          <label className="block col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">SPOC (PO owner / approver)</span>
            <Select value={spocId} onChange={(e) => setSpocId(e.target.value)} className="h-9">
              {ACTIVE_EMPLOYEES.map((e) => <option key={e.id} value={e.id}>{e.name} — {e.designation}</option>)}
            </Select>
          </label>
        </div>

        {/* Line items */}
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Line items</p>
          <div className="space-y-2">
            {formLines.map((l, i) => (
              <div key={i} className="rounded-lg border p-2.5 space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    value={l.item}
                    onChange={(e) => updateLine(i, { item: e.target.value })}
                    placeholder="Item description *"
                    className="h-8 flex-1 text-xs"
                  />
                  <button onClick={() => removeLine(i)} className="shrink-0 text-muted-foreground hover:text-danger">
                    <Trash2 className="size-4" />
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <label className="block flex-1">
                    <span className="text-[10px] text-muted-foreground">Qty</span>
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
                  <label className="block flex-1">
                    <span className="text-[10px] text-muted-foreground">Item (optional)</span>
                    <Select
                      value={l.itemId ?? ""}
                      onChange={(e) => {
                        const itemId = e.target.value || undefined;
                        const last = itemId ? lastRateForItem(itemId, allOrders) : null;
                        updateLine(i, { itemId, ...(last ? { unitPrice: last.unitPrice } : {}) });
                      }}
                      className="mt-0.5 h-7 text-xs"
                    >
                      <option value="">— none —</option>
                      {ITEMS.filter((it) => it.category === "raw" || it.category === "packing").map((it) => (
                        <option key={it.id} value={it.id}>{it.name}</option>
                      ))}
                    </Select>
                  </label>
                </div>
                {l.itemId && (() => {
                  const last = lastRateForItem(l.itemId!, allOrders);
                  return last ? (
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Last: <span className="font-medium text-foreground">₹{last.unitPrice.toLocaleString("en-IN")}</span> from{" "}
                      <span className="font-medium">{VENDORS.find((v) => v.id === last.vendorId)?.name ?? last.vendorId}</span> on {last.poId} ({last.daysAgo}d ago) — prefilled
                    </p>
                  ) : null;
                })()}
              </div>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={addLine} className="mt-1.5">
            <Plus className="size-3.5" /> Add line
          </Button>
        </div>

        {/* Total */}
        <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
          <span className="text-sm font-medium">PO Total</span>
          <span className="text-lg font-bold tabular-nums"><Money value={poTotal} /></span>
        </div>

        <div className="flex gap-2 border-t pt-4">
          <Button onClick={submit} disabled={!valid}>Raise PO</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          {overBudget && (
            <span className="ml-auto flex items-center gap-1 text-xs text-danger">
              <AlertTriangle className="size-3.5" /> Over budget — proceed with caution
            </span>
          )}
        </div>
      </div>
    </Drawer>
  );
}

const STAGE_TONE: Record<P2PStage, "default" | "primary" | "warning" | "success"> = {
  ordered: "default",
  received: "primary",
  invoiced: "warning",
  paid: "success",
};

function TrailCell({ po, stage, onClick }: { po: PurchaseOrder; stage: P2PStage; onClick: () => void }) {
  const idx = STAGE_ORDER.indexOf(stage);
  return (
    <button onClick={onClick} className="group flex flex-col gap-1 text-left" title="Open the procure-to-pay trail">
      <span className="flex items-center gap-1">
        {STAGE_ORDER.map((s, i) => (
          <span
            key={s}
            className={cn(
              "h-1.5 w-5 rounded-full transition-colors",
              i <= idx ? (stage === "paid" ? "bg-success" : "bg-primary") : "bg-muted",
            )}
          />
        ))}
      </span>
      <span className="flex items-center gap-1 text-xs">
        <Badge variant={STAGE_TONE[stage]} className="text-[10px]">{STAGE_META[stage].label}</Badge>
        <ArrowRight className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
      </span>
    </button>
  );
}

function ClassChip({ label, active, count, onClick }: { label: string; active: boolean; count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent",
      )}
    >
      {label}
      <span className={cn("rounded-full px-1.5 text-[10px]", active ? "bg-primary/20" : "bg-muted")}>{count}</span>
    </button>
  );
}

function VendorCard({ v, allOrders, grns }: { v: (typeof VENDORS)[number]; allOrders: PurchaseOrder[]; grns: GoodsReceiptNote[] }) {
  const isEmployee = v.vClass === "Employee";
  const scorecard = React.useMemo(() => computeVendorScorecard(v.id, allOrders, grns), [v.id, allOrders, grns]);

  return (
    <Card className={cn("p-4", !v.active && "opacity-60")}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            {isEmployee ? <Users className="size-4" /> : <Building2 className="size-4" />}
          </span>
          <div>
            <p className="font-semibold leading-tight">{v.name}</p>
            <p className="text-xs text-muted-foreground">{v.category}</p>
          </div>
        </div>
        {!isEmployee && (
          <span className="flex items-center gap-0.5 text-xs text-warning">
            <Star className="size-3.5 fill-current" /> {v.rating}
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1 border-t pt-3 text-xs text-muted-foreground">
        <p>{v.contact} · {v.city}</p>
        {v.gstin !== "—" && <p className="font-mono">{v.gstin}</p>}
        {v.udyam && <p className="font-mono text-[11px]">Udyam {v.udyam}</p>}
        <div className="flex flex-wrap gap-1 pt-1">
          {v.msme && <Badge variant="primary" className="text-[10px]">MSME{v.msmeClass ? ` · ${v.msmeClass}` : ""}</Badge>}
          {v.ldc && (
            <Badge variant="warning" className="gap-1 text-[10px]" title={`${v.ldc.certNo} · valid ${v.ldc.validTo}`}>
              <FileCheck className="size-3" /> 197 LDC {v.ldc.section} @{v.ldc.rate}%
            </Badge>
          )}
          <Badge variant={v.active ? "success" : "default"} className="text-[10px]">
            {v.active ? "Active" : "Inactive"}
          </Badge>
        </div>
        {isEmployee && (
          <Link href="/reimbursements" className="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline">
            Manage staff claims <ArrowRight className="size-3" />
          </Link>
        )}

        {/* Portal link actions */}
        {!isEmployee && v.active && (
          <PortalLinkRow vendorId={v.id} />
        )}

        {/* Vendor scorecard */}
        {!isEmployee && scorecard.poCount > 0 && (
          <div className="mt-3 border-t pt-3 space-y-2">
            <p className="flex items-center gap-1 font-medium text-[10px] uppercase tracking-wide text-muted-foreground">
              <BarChart3 className="size-3" /> Scorecard · {scorecard.poCount} PO{scorecard.poCount > 1 ? "s" : ""}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              <div>
                <p className="text-[10px] text-muted-foreground">On-time delivery</p>
                <p className={cn("text-sm font-bold tabular-nums", scorecard.otdPct === null ? "text-muted-foreground" : scorecard.otdPct >= 80 ? "text-success" : scorecard.otdPct >= 60 ? "text-warning" : "text-danger")}>
                  {scorecard.otdPct !== null ? `${scorecard.otdPct}%` : "—"}
                </p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Delivery shortfall</p>
                <p className={cn("text-sm font-bold tabular-nums", scorecard.shortfallPct === null ? "text-muted-foreground" : scorecard.shortfallPct <= 5 ? "text-success" : scorecard.shortfallPct <= 20 ? "text-warning" : "text-danger")}>
                  {scorecard.shortfallPct !== null ? `${scorecard.shortfallPct}%` : "—"}
                </p>
              </div>
            </div>
            {scorecard.lastRates.length > 0 && (
              <div>
                <p className="text-[10px] text-muted-foreground mb-1">Recent prices</p>
                <div className="space-y-0.5">
                  {scorecard.lastRates.slice(0, 3).map((r, i) => (
                    <div key={i} className="flex items-center gap-2 text-[10px]">
                      <span className="truncate text-muted-foreground flex-1">{r.item}</span>
                      <span className="tabular-nums font-medium text-foreground">₹{r.unitPrice.toLocaleString("en-IN")}</span>
                      <span className="text-muted-foreground font-mono">{r.poId}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Portal link row — copy link + open portal buttons
// ---------------------------------------------------------------------------
function PortalLinkRow({ vendorId }: { vendorId: string }) {
  const [copied, setCopied] = React.useState(false);

  function copyLink() {
    const url = vendorPortalUrl(vendorId);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div className="mt-3 border-t pt-3 flex items-center gap-2">
      <button
        onClick={copyLink}
        className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3" />}
        {copied ? "Copied!" : "Copy portal link"}
      </button>
      <Link
        href={`/vendor-portal?v=${typeof window !== "undefined" ? btoa(encodeURIComponent(vendorId)) : ""}`}
        target="_blank"
        className="flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
      >
        <ExternalLink className="size-3" /> Preview portal
      </Link>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Pending onboarding registrations (AP review)
// ---------------------------------------------------------------------------
function OnboardingInbox() {
  const [regs, setRegs] = React.useState<VendorOnboarding[]>([]);
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    setRegs(loadOnboardings());
  }, []);

  const pending = regs.filter((r) => r.status === "pending");
  if (pending.length === 0) return null;

  function approve(id: string) {
    updateOnboardingStatus(id, "approved", "Approved by AP team");
    setRegs(loadOnboardings());
  }
  function reject(id: string) {
    updateOnboardingStatus(id, "rejected", "Rejected by AP team");
    setRegs(loadOnboardings());
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-300/50 bg-amber-50/60 dark:bg-amber-900/10 p-3">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between"
      >
        <span className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400">
          <Clock className="size-4" />
          {pending.length} pending vendor registration{pending.length > 1 ? "s" : ""} awaiting AP review
        </span>
        <span className="text-xs text-amber-600 dark:text-amber-400">{open ? "Hide" : "Review"}</span>
      </button>
      {open && (
        <div className="mt-3 space-y-3">
          {pending.map((r) => (
            <div key={r.id} className="rounded-lg border bg-card p-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-sm">{r.name}</p>
                  <p className="font-mono text-muted-foreground">{r.gstin}</p>
                  {r.gstinLegalName && r.gstinLegalName !== r.name && (
                    <p className="text-muted-foreground">Legal: {r.gstinLegalName}</p>
                  )}
                  <p className="mt-0.5 text-muted-foreground">
                    {r.category} · {r.city}, {r.state}
                  </p>
                  <p className="text-muted-foreground">{r.contact} · {r.email}</p>
                  <div className="mt-1 flex gap-2">
                    <Badge variant={r.gstinVerified ? "success" : "warning"} className="text-[10px]">
                      GSTIN {r.gstinVerified ? "verified" : "format-only"}
                    </Badge>
                    {r.msme && <Badge variant="primary" className="text-[10px]">MSME {r.msmeClass}</Badge>}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => approve(r.id)} className="h-7 text-success border-success/30 hover:bg-success/10">
                    <Check className="size-3" /> Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => reject(r.id)} className="h-7 text-destructive border-destructive/30 hover:bg-destructive/10">
                    <X className="size-3" /> Reject
                  </Button>
                </div>
              </div>
              {r.bankName && (
                <p className="mt-1.5 text-muted-foreground">
                  Bank: {r.bankName} · A/c {r.bankAccount} · IFSC {r.ifsc}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", highlight && "border-warning/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular", highlight && "text-warning")}>{value}</p>
    </Card>
  );
}

function MetricMoney({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular">
        <Money value={value} compact />
      </p>
    </Card>
  );
}
