"use client";

import * as React from "react";
import { Check, X, RotateCcw, Building2, Info, Star, ArrowRight, Banknote, FileCheck, Users, Sparkles, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { VoucherButton } from "@/components/accounting/voucher-button";
import { PayBills } from "./pay-bills";
import { P2PTrail } from "./p2p-trail";
import { loadP2P, p2pStage, matchPoInvoice, DEFAULT_MATCH_TOLERANCE_PCT, STAGE_META, STAGE_ORDER, type P2PStore, type P2PStage } from "@/lib/p2p";
import { cn, formatDate } from "@/lib/utils";
import { entityById, locationById } from "@/lib/accounting/org";
import { employeeName } from "@/lib/hr/employees";
import { loadDecisions, saveDecisions, type Decision } from "@/lib/hr/approvals";
import {
  VENDORS,
  PURCHASE_ORDERS,
  vendorName,
  effectiveStatus,
  invoiceApprovalId,
  autoPaymentRef,
  loadPoPayments,
  CLASS_META,
  VENDOR_CLASSES,
  type PurchaseOrder,
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

export function VendorsClient() {
  const [decisions, setDecisions] = React.useState<Record<string, Decision>>({});
  const [tab, setTab] = React.useState<"orders" | "vendors">("orders");
  const [payOpen, setPayOpen] = React.useState(false);
  const [vClassFilter, setVClassFilter] = React.useState<"all" | VendorClass>("all");
  const [p2p, setP2p] = React.useState<P2PStore>({});
  const [payments, setPayments] = React.useState<Record<string, number>>({});
  const [trailPo, setTrailPo] = React.useState<PurchaseOrder | null>(null);

  const refresh = React.useCallback(() => {
    setDecisions(loadDecisions());
    setP2p(loadP2P());
    setPayments(loadPoPayments());
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  function decide(po: PurchaseOrder, decision: Decision) {
    setDecisions((prev) => {
      const next = { ...prev, [invoiceApprovalId(po.id)]: decision };
      saveDecisions(next);
      return next;
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

  const orders = PURCHASE_ORDERS.map((po) => ({ po, status: effectiveStatus(po, decisions) }));
  const awaiting = orders.filter((o) => o.status === "pending-approval");
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
          </div>
        }
      />

      {/* Metrics */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Active vendors" value={VENDORS.filter((v) => v.active).length} />
        <Metric label="Purchase orders" value={PURCHASE_ORDERS.length} />
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
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-5 py-3 font-medium">PO</th>
                  <th className="px-5 py-3 font-medium">Vendor</th>
                  <th className="px-5 py-3 font-medium">SPOC (approver)</th>
                  <th className="px-5 py-3 text-right font-medium">Amount</th>
                  <th className="px-5 py-3 font-medium">Status</th>
                  <th className="px-5 py-3 font-medium">P2P trail</th>
                  <th className="px-5 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody>
                {orders.map(({ po, status }) => {
                  const meta = STATUS_META[status];
                  return (
                    <tr key={po.id} className="border-b align-top transition-colors last:border-0 hover:bg-accent/50">
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
                      <td className="px-5 py-3">
                        <TrailCell po={po} stage={p2pStage(po, p2p[po.id], payments[po.id] ?? 0)} onClick={() => setTrailPo(po)} />
                      </td>
                      <td className="px-5 py-3">
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
      ) : (
        <>
          {/* class filter */}
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
            const vendors = VENDORS.filter((v) => v.vClass === c);
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
                    <VendorCard key={v.id} v={v} />
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
    </>
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

function VendorCard({ v }: { v: (typeof VENDORS)[number] }) {
  const isEmployee = v.vClass === "Employee";
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
      </div>
    </Card>
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
