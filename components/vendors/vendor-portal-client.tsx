"use client";

import * as React from "react";
import {
  Store,
  Upload,
  CreditCard,
  ChevronDown,
  ChevronRight,
  LogIn,
  FileText,
  CheckCircle2,
  Clock,
  Banknote,
  Package,
  ClipboardList,
  Link2,
  Copy,
  Check,
  AlertTriangle,
  UserPlus,
  Info,
  ExternalLink,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Input, Select } from "@/components/ui/input";
import { GstinField } from "@/components/ui/gstin-field";
import { cn, formatDate } from "@/lib/utils";
import {
  VENDORS,
  effectiveStatus,
  vendorById,
  allPOs,
  loadAddedPOs,
  type PurchaseOrder,
  type POEffectiveStatus,
} from "@/lib/vendors";
import { loadDecisions } from "@/lib/hr/approvals";
import {
  loadPortalVendor,
  savePortalVendor,
  loadVendorInvoices,
  saveVendorInvoices,
  vendorFromToken,
  vendorPortalUrl,
  INVOICE_STATUS_META,
  type VendorInvoice,
} from "@/lib/vendors/vendor-portal";
import { loadP2P, p2pStage, type P2PEntry, type P2PStage } from "@/lib/p2p";
import { loadPoPayments } from "@/lib/vendors";
import {
  submitOnboarding,
  type VendorOnboarding,
} from "@/lib/vendors/onboarding";
import type { GstLookupResponse } from "@/app/api/gst/lookup/route";
import type { VendorCategory } from "@/lib/vendors";

// ---------------------------------------------------------------------------
// constants
// ---------------------------------------------------------------------------

const STATUS_META: Record<
  POEffectiveStatus,
  { label: string; variant: "default" | "warning" | "success" | "danger" | "primary" }
> = {
  issued: { label: "Awaiting invoice", variant: "default" },
  "pending-approval": { label: "Pending approval", variant: "warning" },
  "approved-paid": { label: "Approved · Paid", variant: "success" },
  rejected: { label: "Rejected", variant: "danger" },
  paid: { label: "Paid", variant: "success" },
};

const PORTAL_VENDORS = VENDORS.filter((v) => v.vClass !== "Employee");

const VENDOR_CATEGORIES: VendorCategory[] = [
  "Raw Materials", "Packaging", "Logistics", "IT & Software",
  "Marketing", "Services", "Capital Equipment", "Office Equipment",
];

const P2P_TRAIL: { stage: P2PStage; label: string; icon: React.ElementType }[] = [
  { stage: "ordered",  label: "PO Issued",           icon: ClipboardList },
  { stage: "received", label: "Goods Received (GRN)", icon: Package },
  { stage: "invoiced", label: "Invoice Processed",    icon: FileText },
  { stage: "paid",     label: "Payment Cleared",      icon: Banknote },
];

// ---------------------------------------------------------------------------
// portal session hook
// ---------------------------------------------------------------------------

function usePortalVendor(tokenParam: string | null): readonly [string, (id: string) => void] {
  const [vendorId, setVendorId] = React.useState<string>("");

  React.useEffect(() => {
    // Token in URL takes priority (vendor accessed their unique link).
    if (tokenParam) {
      const id = vendorFromToken(tokenParam);
      if (id) {
        setVendorId(id);
        savePortalVendor(id);
        return;
      }
    }
    setVendorId(loadPortalVendor() || PORTAL_VENDORS[0]?.id || "");
  }, [tokenParam]);

  const update = React.useCallback((id: string) => {
    setVendorId(id);
    savePortalVendor(id);
  }, []);

  return [vendorId, update] as const;
}

// ---------------------------------------------------------------------------
// root
// ---------------------------------------------------------------------------

type Tab = "trail" | "pos" | "upload" | "payments" | "onboard";

export function VendorPortalClient({
  tokenParam,
  showOnboard,
}: {
  tokenParam: string | null;
  showOnboard?: boolean;
}) {
  const [vendorId, setVendorId] = usePortalVendor(tokenParam);
  const [tab, setTab] = React.useState<Tab>(showOnboard ? "onboard" : "trail");
  const [invoices, setInvoices] = React.useState<VendorInvoice[]>([]);
  const [allOrders, setAllOrders] = React.useState<PurchaseOrder[]>([]);
  const [decisions, setDecisions] = React.useState<Record<string, import("@/lib/hr/approvals").Decision>>({});
  const [p2pState, setP2pState] = React.useState<Record<string, P2PEntry>>({});
  const [payments, setPayments] = React.useState<Record<string, number>>({});
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    setInvoices(loadVendorInvoices());
    setAllOrders(allPOs(loadAddedPOs()));
    setDecisions(loadDecisions());
    setP2pState(loadP2P());
    setPayments(loadPoPayments());
  }, []);

  const vendor = vendorById(vendorId);
  const myPOs = allOrders.filter((p) => p.vendorId === vendorId);
  const myInvoices = invoices.filter((i) => i.vendorId === vendorId);
  const isAutoLoggedIn = !!tokenParam && !!vendorFromToken(tokenParam);

  function handleInvoiceSubmit(
    inv: Omit<VendorInvoice, "id" | "vendorId" | "submittedAt" | "status">,
  ) {
    const newInv: VendorInvoice = {
      ...inv,
      id: `vi-${Date.now()}`,
      vendorId,
      status: "pending",
      submittedAt: new Date().toISOString(),
    };
    const next = [...invoices, newInv];
    setInvoices(next);
    saveVendorInvoices(next);
  }

  function copyPortalLink() {
    const url = vendorPortalUrl(vendorId);
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  const tabs: { key: Tab; icon: React.ElementType; label: string }[] = [
    { key: "trail",    icon: ClipboardList, label: "P2P Trail" },
    { key: "pos",      icon: Store,         label: "Purchase Orders" },
    { key: "upload",   icon: Upload,        label: "Submit Invoice" },
    { key: "payments", icon: CreditCard,    label: "Payment Status" },
    { key: "onboard",  icon: UserPlus,      label: "New Vendor?" },
  ];

  return (
    <>
      <PageHeader
        title={vendor ? `${vendor.name} — Vendor Portal` : "Vendor Portal"}
        subtitle="Self-service supplier portal: P2P trail, invoice submission, payment tracking."
        actions={
          <div className="flex items-center gap-2">
            {isAutoLoggedIn ? (
              <Badge variant="success" className="text-xs">
                <Link2 className="mr-1 size-3" /> Portal link active
              </Badge>
            ) : (
              <>
                <LogIn className="size-4 text-muted-foreground shrink-0" />
                <Select
                  value={vendorId}
                  onChange={(e) => setVendorId(e.target.value)}
                  className="h-8 text-xs"
                >
                  {PORTAL_VENDORS.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </Select>
              </>
            )}
          </div>
        }
      />

      {/* Vendor info strip */}
      {vendor && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3 p-3 text-xs text-muted-foreground">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-semibold text-foreground">{vendor.name}</span>
            <span>{vendor.category} · {vendor.city}</span>
            {vendor.gstin !== "—" && (
              <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[11px]">{vendor.gstin}</span>
            )}
            {vendor.msme && (
              <Badge variant="primary" className="text-[10px]">MSME {vendor.msmeClass}</Badge>
            )}
            <Badge variant={vendor.active ? "success" : "default"} className="text-[10px]">
              {vendor.active ? "Active" : "Inactive"}
            </Badge>
          </div>
          <button
            onClick={copyPortalLink}
            title="Copy vendor portal link"
            className="flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent"
          >
            {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
            {copied ? "Copied!" : "Copy portal link"}
          </button>
        </Card>
      )}

      {/* Portal link hint when vendor accessed via token */}
      {isAutoLoggedIn && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 text-xs text-primary">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          <span>
            You are logged in via your unique vendor portal link. Bookmark this page to return anytime.
          </span>
        </div>
      )}

      {/* Tab bar */}
      <div className="mb-4 flex flex-wrap gap-1 border-b pb-0">
        {tabs.map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-t-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === key
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "trail" && (
        <TrailTab pos={myPOs} decisions={decisions} p2pState={p2pState} payments={payments} myInvoices={myInvoices} />
      )}
      {tab === "pos" && (
        <POsTab pos={myPOs} decisions={decisions} />
      )}
      {tab === "upload" && (
        <UploadTab
          vendorId={vendorId}
          vendor={vendor ?? null}
          myPOs={myPOs}
          decisions={decisions}
          myInvoices={myInvoices}
          onSubmit={handleInvoiceSubmit}
        />
      )}
      {tab === "payments" && (
        <PaymentsTab myPOs={myPOs} decisions={decisions} myInvoices={myInvoices} />
      )}
      {tab === "onboard" && (
        <OnboardTab />
      )}
    </>
  );
}

// ============================================================
// Tab: P2P Trail (vendor view of procurement pipeline)
// ============================================================

function TrailTab({
  pos,
  decisions,
  p2pState,
  payments,
  myInvoices,
}: {
  pos: PurchaseOrder[];
  decisions: Record<string, import("@/lib/hr/approvals").Decision>;
  p2pState: Record<string, P2PEntry>;
  payments: Record<string, number>;
  myInvoices: VendorInvoice[];
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (pos.length === 0) {
    return (
      <Card className="py-12 text-center text-sm text-muted-foreground">
        No purchase orders found. Contact your NEXA account manager to check your vendor ID.
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {pos.map((po) => {
        const entry = p2pState[po.id];
        const paid = payments[po.id] ?? 0;
        const stage = p2pStage(po, entry, paid);
        const stageIdx = ["ordered", "received", "invoiced", "paid"].indexOf(stage);
        const expanded = expandedId === po.id;
        const effStatus = effectiveStatus(po, decisions);
        const meta = STATUS_META[effStatus];
        // Find invoice (portal-submitted or internal)
        const portalInv = myInvoices.find((i) => i.poId === po.id);
        const invoiceNo =
          entry?.invoice?.number ?? portalInv?.invoiceNo ?? po.invoice?.number;
        const invoiceDate =
          entry?.invoice?.date ?? portalInv?.date ?? po.invoice?.date;
        const billAmount =
          entry?.invoice?.gross ?? portalInv?.amount ?? po.invoice?.amount ?? po.total;

        return (
          <Card key={po.id} className="overflow-hidden">
            {/* PO header row */}
            <button
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-accent/40 transition-colors"
              onClick={() => setExpandedId(expanded ? null : po.id)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-bold">{po.id}</span>
                  <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                </div>
                <p className="mt-0.5 truncate text-sm font-medium">{po.title}</p>
                <p className="text-xs text-muted-foreground">{formatDate(po.date)} · {po.lines.length} items</p>
              </div>
              <div className="shrink-0 text-right">
                <Money value={po.total} className="font-semibold" />
                {expanded ? <ChevronDown className="ml-auto mt-1 size-4 text-muted-foreground" /> : <ChevronRight className="ml-auto mt-1 size-4 text-muted-foreground" />}
              </div>
            </button>

            {/* Expanded: P2P timeline */}
            {expanded && (
              <div className="border-t bg-muted/20 px-5 py-4">
                <p className="mb-3 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  Procurement Timeline
                </p>
                <ol className="space-y-3">
                  {P2P_TRAIL.map(({ stage: s, label, icon: Icon }, i) => {
                    const done = i <= stageIdx;
                    const active = i === stageIdx + 1;
                    let detail = "";
                    if (s === "ordered") detail = `Raised ${formatDate(po.date)}`;
                    if (s === "received") {
                      detail = entry?.grn ? `Received ${formatDate(entry.grn.date)}` : po.status !== "issued" ? "Goods receipted" : "";
                    }
                    if (s === "invoiced") {
                      detail = invoiceNo
                        ? `${invoiceNo}${invoiceDate ? ` · ${formatDate(invoiceDate)}` : ""} · ₹${Math.round(billAmount).toLocaleString("en-IN")}`
                        : "";
                    }
                    if (s === "paid") {
                      detail = done ? `Settled ₹${Math.round(paid).toLocaleString("en-IN")}` : paid > 0 ? `Partial ₹${Math.round(paid).toLocaleString("en-IN")} of ₹${Math.round(billAmount).toLocaleString("en-IN")}` : "";
                    }

                    return (
                      <li key={s} className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <span
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs",
                              done ? "border-success bg-success/15 text-success"
                                : active ? "border-primary bg-primary/10 text-primary"
                                : "border-input text-muted-foreground",
                            )}
                          >
                            {done ? <Check className="size-3.5" /> : <Icon className="size-3.5" />}
                          </span>
                          {i < P2P_TRAIL.length - 1 && (
                            <span className={cn("mt-1 w-px flex-1", done ? "bg-success/40" : "bg-border")} style={{ minHeight: 16 }} />
                          )}
                        </div>
                        <div className="pb-1">
                          <p className={cn("text-sm font-medium", active && "text-primary", done && "text-foreground")}>
                            {label}
                          </p>
                          {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                          {!done && !active && <p className="text-xs text-muted-foreground">Pending</p>}
                          {active && <p className="text-xs text-primary">In progress</p>}
                        </div>
                      </li>
                    );
                  })}
                </ol>

                {/* Line items */}
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Line Items
                  </p>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-1 font-medium">Item</th>
                        <th className="pb-1 text-right font-medium">Qty</th>
                        <th className="pb-1 text-right font-medium">Unit price</th>
                        <th className="pb-1 text-right font-medium">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {po.lines.map((l, i) => (
                        <tr key={i} className="border-b last:border-0">
                          <td className="py-1.5">{l.item}</td>
                          <td className="py-1.5 text-right tabular-nums">{l.qty}</td>
                          <td className="py-1.5 text-right tabular-nums">
                            <Money value={l.unitPrice} />
                          </td>
                          <td className="py-1.5 text-right tabular-nums font-semibold">
                            <Money value={l.qty * l.unitPrice} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="pt-2 text-right font-medium text-muted-foreground">
                          PO Total
                        </td>
                        <td className="pt-2 text-right font-bold">
                          <Money value={po.total} />
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

// ============================================================
// Tab: Purchase Orders (compact list)
// ============================================================

function POsTab({
  pos,
  decisions,
}: {
  pos: PurchaseOrder[];
  decisions: Record<string, import("@/lib/hr/approvals").Decision>;
}) {
  const [expandedId, setExpandedId] = React.useState<string | null>(null);

  if (pos.length === 0) {
    return (
      <Card className="py-12 text-center text-sm text-muted-foreground">
        No purchase orders found for this vendor.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-6 px-3 py-3" />
              <th className="px-5 py-3 font-medium">PO Ref</th>
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Items</th>
              <th className="px-5 py-3 text-right font-medium">Value</th>
              <th className="px-5 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {pos.map((po) => {
              const status = effectiveStatus(po, decisions);
              const meta = STATUS_META[status];
              const expanded = expandedId === po.id;
              return (
                <React.Fragment key={po.id}>
                  <tr
                    onClick={() => setExpandedId(expanded ? null : po.id)}
                    className="cursor-pointer border-b align-top transition-colors last:border-0 hover:bg-accent/50"
                  >
                    <td className="px-3 py-3 text-muted-foreground">
                      {expanded ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs font-semibold">{po.id}</p>
                      <p className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">{po.title}</p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(po.date)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{po.lines.length}</td>
                    <td className="px-5 py-3 text-right">
                      <Money value={po.total} className="font-semibold" />
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </td>
                  </tr>
                  {expanded && (
                    <tr className="border-b bg-muted/20 last:border-0">
                      <td colSpan={6} className="px-8 py-4">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b text-left text-muted-foreground">
                              <th className="pb-1.5 font-medium">Item</th>
                              <th className="pb-1.5 text-right font-medium">Qty</th>
                              <th className="pb-1.5 text-right font-medium">Unit price</th>
                              <th className="pb-1.5 text-right font-medium">Total</th>
                            </tr>
                          </thead>
                          <tbody>
                            {po.lines.map((l, i) => (
                              <tr key={i} className="border-b last:border-0">
                                <td className="py-1.5">{l.item}</td>
                                <td className="py-1.5 text-right tabular-nums">{l.qty}</td>
                                <td className="py-1.5 text-right tabular-nums"><Money value={l.unitPrice} /></td>
                                <td className="py-1.5 text-right tabular-nums font-semibold"><Money value={l.qty * l.unitPrice} /></td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td colSpan={3} className="pt-2 text-right font-medium text-muted-foreground">PO Total</td>
                              <td className="pt-2 text-right font-bold"><Money value={po.total} /></td>
                            </tr>
                          </tfoot>
                        </table>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Tab: Upload Invoice (with GSTIN validation)
// ============================================================

function UploadTab({
  vendorId,
  vendor,
  myPOs,
  decisions,
  myInvoices,
  onSubmit,
}: {
  vendorId: string;
  vendor: ReturnType<typeof vendorById> | null;
  myPOs: PurchaseOrder[];
  decisions: Record<string, import("@/lib/hr/approvals").Decision>;
  myInvoices: VendorInvoice[];
  onSubmit: (inv: Omit<VendorInvoice, "id" | "vendorId" | "submittedAt" | "status">) => void;
}) {
  const eligiblePOs = myPOs.filter((p) => effectiveStatus(p, decisions) === "issued");

  const [poId, setPoId] = React.useState(eligiblePOs[0]?.id ?? "");
  const [invoiceNo, setInvoiceNo] = React.useState("");
  const [date, setDate] = React.useState("2026-06-28");
  const [amount, setAmount] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [invoiceGstin, setInvoiceGstin] = React.useState(vendor?.gstin ?? "");
  const [gstinResult, setGstinResult] = React.useState<GstLookupResponse | null>(null);
  const [submitted, setSubmitted] = React.useState(false);
  const [gstinMismatch, setGstinMismatch] = React.useState(false);

  React.useEffect(() => {
    setPoId(eligiblePOs[0]?.id ?? "");
    setInvoiceGstin(vendor?.gstin ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  // Check if invoice GSTIN matches the vendor master GSTIN.
  React.useEffect(() => {
    if (!invoiceGstin || !vendor?.gstin || vendor.gstin === "—") {
      setGstinMismatch(false);
      return;
    }
    setGstinMismatch(
      invoiceGstin.trim().toUpperCase() !== vendor.gstin.trim().toUpperCase(),
    );
  }, [invoiceGstin, vendor]);

  const gstinValid = gstinResult?.valid ?? false;
  const valid =
    poId.trim() !== "" &&
    invoiceNo.trim() !== "" &&
    date !== "" &&
    Number(amount) > 0 &&
    fileName.trim() !== "" &&
    gstinValid &&
    !gstinMismatch;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({
      poId,
      invoiceNo: invoiceNo.trim(),
      date,
      amount: Number(amount),
      fileName: fileName.trim(),
    });
    setInvoiceNo("");
    setAmount("");
    setFileName("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3500);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Submit an invoice</h3>
        {eligiblePOs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open POs are awaiting an invoice. Your POs are either already invoiced, approved, or paid.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* GSTIN on Invoice */}
            <GstinField
              label="Your GSTIN (as on invoice)"
              value={invoiceGstin}
              onChange={setInvoiceGstin}
              onResult={setGstinResult}
            />
            {gstinMismatch && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300/40 bg-amber-50/60 dark:bg-amber-900/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
                <span>
                  This GSTIN differs from the one in our vendor master ({vendor?.gstin}). Please confirm this is correct — your AP team will verify.
                </span>
              </div>
            )}

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Purchase Order *</span>
              <Select value={poId} onChange={(e) => setPoId(e.target.value)} className="h-9">
                {eligiblePOs.map((p) => (
                  <option key={p.id} value={p.id}>{p.id} — {p.title}</option>
                ))}
              </Select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Invoice No *</span>
                <Input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="e.g. INV/2026/0042"
                  className="h-9"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Invoice Date *</span>
                <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9" />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Invoice Amount (₹, incl. GST) *</span>
              <Input
                type="number"
                min={1}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="h-9 text-right"
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">Attachment filename *</span>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="e.g. invoice_june2026.pdf"
                className="h-9"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">Simulated — no file is actually sent in this demo.</p>
            </label>

            <div className="flex items-center gap-3 border-t pt-4">
              <Button type="submit" disabled={!valid}>
                <Upload className="size-4" /> Submit invoice
              </Button>
              {submitted && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="size-3.5" /> Submitted — AP team will review.
                </span>
              )}
            </div>
          </form>
        )}
      </Card>

      <div>
        <h3 className="mb-3 text-sm font-semibold">Submitted invoices</h3>
        {myInvoices.length === 0 ? (
          <Card className="py-8 text-center text-sm text-muted-foreground">No invoices submitted yet.</Card>
        ) : (
          <div className="space-y-2">
            {[...myInvoices].reverse().map((inv) => {
              const meta = INVOICE_STATUS_META[inv.status];
              return (
                <Card key={inv.id} className="flex items-center gap-3 p-3 text-xs">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{inv.invoiceNo}</p>
                    <p className="text-muted-foreground">PO {inv.poId} · {formatDate(inv.date)}</p>
                    <p className="text-[10px] text-muted-foreground">{inv.fileName}</p>
                  </div>
                  <div className="text-right">
                    <Money value={inv.amount} className="font-semibold" />
                    <div className="mt-1">
                      <Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Tab: Payment Status
// ============================================================

function PaymentsTab({
  myPOs,
  decisions,
  myInvoices,
}: {
  myPOs: PurchaseOrder[];
  decisions: Record<string, import("@/lib/hr/approvals").Decision>;
  myInvoices: VendorInvoice[];
}) {
  if (myPOs.length === 0) {
    return (
      <Card className="py-12 text-center text-sm text-muted-foreground">
        No purchase orders found for this vendor.
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-5 py-3 font-medium">PO Ref</th>
              <th className="px-5 py-3 font-medium">Your Invoice</th>
              <th className="px-5 py-3 text-right font-medium">PO Value</th>
              <th className="px-5 py-3 font-medium">Payment status</th>
              <th className="px-5 py-3 font-medium">Payment date</th>
            </tr>
          </thead>
          <tbody>
            {myPOs.map((po) => {
              const status = effectiveStatus(po, decisions);
              const uploaded = myInvoices.find((i) => i.poId === po.id);
              const invoiceNo = po.invoice?.number ?? uploaded?.invoiceNo ?? "—";
              const payStatus =
                status === "paid" || status === "approved-paid"
                  ? "paid"
                  : uploaded || po.invoice
                  ? "invoiced"
                  : "issued";
              const payMeta = {
                issued:   { label: "Awaiting invoice",    variant: "default"  as const, icon: Clock },
                invoiced: { label: "Invoice under review", variant: "warning" as const, icon: FileText },
                paid:     { label: "Paid",                 variant: "success" as const, icon: Banknote },
              };
              const m = payMeta[payStatus];
              return (
                <tr key={po.id} className="border-b align-top last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-mono text-xs font-semibold">{po.id}</p>
                    <p className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">{po.title}</p>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{invoiceNo}</td>
                  <td className="px-5 py-3 text-right"><Money value={po.total} className="font-semibold" /></td>
                  <td className="px-5 py-3">
                    <Badge variant={m.variant} className="flex w-fit items-center gap-1">
                      <m.icon className="size-3" /> {m.label}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{po.paidOn ? formatDate(po.paidOn) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ============================================================
// Tab: New Vendor Onboarding (self-registration)
// ============================================================

function OnboardTab() {
  const [name, setName] = React.useState("");
  const [gstin, setGstin] = React.useState("");
  const [gstinResult, setGstinResult] = React.useState<GstLookupResponse | null>(null);
  const [pan, setPan] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [city, setCity] = React.useState("");
  const [state, setState] = React.useState("");
  const [category, setCategory] = React.useState<VendorCategory>("Services");
  const [msme, setMsme] = React.useState(false);
  const [msmeClass, setMsmeClass] = React.useState<"Micro" | "Small" | "Medium">("Small");
  const [udyam, setUdyam] = React.useState("");
  const [bankName, setBankName] = React.useState("");
  const [bankAccount, setBankAccount] = React.useState("");
  const [ifsc, setIfsc] = React.useState("");
  const [swift, setSwift] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);
  const [submittedId, setSubmittedId] = React.useState("");

  // Auto-fill from GSTIN lookup
  React.useEffect(() => {
    if (gstinResult?.valid) {
      if (gstinResult.legalName && !name) setName(gstinResult.legalName);
      if (gstinResult.pan && !pan) setPan(gstinResult.pan);
      if (gstinResult.stateName && !state) setState(gstinResult.stateName);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gstinResult]);

  const gstinValid = gstinResult?.valid ?? false;
  const canSubmit =
    name.trim() &&
    gstinValid &&
    gstin.trim().length === 15 &&
    contact.trim() &&
    email.trim() &&
    phone.trim() &&
    city.trim();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    const entry = submitOnboarding(
      {
        name: name.trim(),
        gstin: gstin.trim().toUpperCase(),
        gstinLegalName: gstinResult?.legalName,
        gstinStatus: gstinResult?.status,
        pan: (gstinResult?.pan ?? pan).trim().toUpperCase(),
        contact: contact.trim(),
        email: email.trim(),
        phone: phone.trim(),
        city: city.trim(),
        state: gstinResult?.stateName ?? state.trim(),
        category,
        msme,
        msmeClass: msme ? msmeClass : undefined,
        udyam: msme && udyam.trim() ? udyam.trim().toUpperCase() : undefined,
        bankName: bankName.trim() || undefined,
        bankAccount: bankAccount.trim() || undefined,
        ifsc: ifsc.trim() || undefined,
        swift: swift.trim() || undefined,
      },
      gstinValid,
    );
    setSubmittedId(entry.id);
    setSubmitted(true);
  }

  if (submitted) {
    return (
      <Card className="mx-auto max-w-lg p-8 text-center">
        <CheckCircle2 className="mx-auto mb-3 size-10 text-success" />
        <h3 className="text-lg font-semibold">Registration submitted</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Your registration ({submittedId}) is pending review by the NEXA procurement team. You will receive your portal access link by email once approved.
        </p>
        <p className="mt-3 text-xs text-muted-foreground">Typical review time: 1–2 business days.</p>
      </Card>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      <Card className="p-5 space-y-5">
        <div>
          <h3 className="text-sm font-semibold">New Vendor Registration</h3>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Fill in your company details. Your GSTIN will be verified against the GST portal.
            Once approved, you'll receive a unique portal link to track your orders and payments.
          </p>
        </div>

        {/* GSTIN — primary field, auto-fills others */}
        <GstinField
          label="GSTIN"
          value={gstin}
          onChange={setGstin}
          onResult={setGstinResult}
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <Fld label="Legal / Company name *">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="As on GST registration" className="h-9" />
          </Fld>
          <Fld label="PAN">
            <Input value={pan} onChange={(e) => setPan(e.target.value.toUpperCase())} placeholder="AACN1001P" maxLength={10} className="h-9 font-mono uppercase" />
          </Fld>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Fld label="Contact person *">
            <Input value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Name" className="h-9" />
          </Fld>
          <Fld label="Email *">
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ap@company.in" className="h-9" />
          </Fld>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Fld label="Phone *">
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98765 43210" className="h-9" />
          </Fld>
          <Fld label="City *">
            <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" className="h-9" />
          </Fld>
          <Fld label="State">
            <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="Maharashtra" className="h-9" />
          </Fld>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Fld label="Supply category *">
            <Select value={category} onChange={(e) => setCategory(e.target.value as VendorCategory)} className="h-9">
              {VENDOR_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
            </Select>
          </Fld>
          <Fld label="MSME registered?">
            <div className="flex items-center gap-3 h-9">
              <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={msme} onChange={(e) => setMsme(e.target.checked)} className="rounded" />
                Yes — Udyam registered
              </label>
              {msme && (
                <Select value={msmeClass} onChange={(e) => setMsmeClass(e.target.value as "Micro" | "Small" | "Medium")} className="h-7 text-xs">
                  <option value="Micro">Micro</option>
                  <option value="Small">Small</option>
                  <option value="Medium">Medium</option>
                </Select>
              )}
            </div>
            {msme && (
              <Input
                value={udyam}
                onChange={(e) => setUdyam(e.target.value.toUpperCase())}
                placeholder="UDYAM-XX-00-0000000"
                maxLength={19}
                className="mt-2 h-9 font-mono uppercase"
              />
            )}
          </Fld>
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold">Bank Details (for payment setup)</h3>
        <div className="grid gap-4 sm:grid-cols-3">
          <Fld label="Bank name">
            <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="HDFC Bank" className="h-9" />
          </Fld>
          <Fld label="Account number">
            <Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} placeholder="XXXXXXXXXXXXXXXX" className="h-9 font-mono" />
          </Fld>
          <Fld label="IFSC code">
            <Input value={ifsc} onChange={(e) => setIfsc(e.target.value.toUpperCase())} placeholder="HDFC0001234" maxLength={11} className="h-9 font-mono uppercase" />
          </Fld>
        </div>
        <Fld label="SWIFT / BIC (international vendors)">
          <Input
            value={swift}
            onChange={(e) => setSwift(e.target.value.toUpperCase())}
            placeholder="HDFCINBBXXX"
            maxLength={11}
            className="h-9 font-mono uppercase sm:max-w-[16rem]"
          />
          <p className="mt-1 text-[11px] text-muted-foreground">
            8 or 11 characters — required only for international wire transfers.
          </p>
        </Fld>
      </Card>

      <div className="flex items-center justify-between rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          By submitting, you confirm that the information is accurate and your GSTIN is valid and active.
        </p>
        <Button type="submit" disabled={!canSubmit} className="shrink-0">
          <UserPlus className="size-4" /> Submit registration
        </Button>
      </div>
    </form>
  );
}

function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

