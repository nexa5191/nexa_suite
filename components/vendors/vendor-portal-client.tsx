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
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Input, Select } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import {
  VENDORS,
  PURCHASE_ORDERS,
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
  INVOICE_STATUS_META,
  type VendorInvoice,
} from "@/lib/vendors/vendor-portal";

// ---- constants -------------------------------------------------------------

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

// Vendors that a supplier can "log in" as (excludes internal employee records).
const PORTAL_VENDORS = VENDORS.filter((v) => v.vClass !== "Employee");

// ---- helpers ---------------------------------------------------------------

function usePortalVendor(): readonly [string, (id: string) => void] {
  const [vendorId, setVendorId] = React.useState<string>(PORTAL_VENDORS[0]?.id ?? "");

  React.useEffect(() => {
    setVendorId(loadPortalVendor());
  }, []);

  const update = React.useCallback((id: string) => {
    setVendorId(id);
    savePortalVendor(id);
  }, []);

  return [vendorId, update] as const;
}

// ---- root component --------------------------------------------------------

export function VendorPortalClient() {
  const [vendorId, setVendorId] = usePortalVendor();
  const [tab, setTab] = React.useState<"pos" | "upload" | "payments">("pos");
  const [invoices, setInvoices] = React.useState<VendorInvoice[]>([]);
  const [allOrders, setAllOrders] = React.useState<PurchaseOrder[]>([]);
  const [decisions, setDecisions] = React.useState<Record<string, import("@/lib/hr/approvals").Decision>>({});

  React.useEffect(() => {
    setInvoices(loadVendorInvoices());
    setAllOrders(allPOs(loadAddedPOs()));
    setDecisions(loadDecisions());
  }, []);

  const vendor = vendorById(vendorId);
  const myPOs = allOrders.filter((p) => p.vendorId === vendorId);
  const myInvoices = invoices.filter((i) => i.vendorId === vendorId);

  function handleInvoiceSubmit(inv: Omit<VendorInvoice, "id" | "vendorId" | "submittedAt" | "status">) {
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

  return (
    <>
      <PageHeader
        title={vendor ? `${vendor.name} — Vendor Portal` : "Vendor Portal"}
        subtitle="Self-service supplier portal: view POs, upload invoices, track payments."
        actions={
          <div className="flex items-center gap-2">
            <LogIn className="size-4 text-muted-foreground shrink-0" />
            <Select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              className="h-8 text-xs"
            >
              {PORTAL_VENDORS.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
            </Select>
          </div>
        }
      />

      {/* Vendor info strip */}
      {vendor && (
        <Card className="mb-4 flex flex-wrap items-center gap-4 p-3 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{vendor.name}</span>
          <span>{vendor.category}</span>
          <span>{vendor.city}</span>
          {vendor.gstin !== "—" && <span className="font-mono">{vendor.gstin}</span>}
          {vendor.msme && (
            <Badge variant="primary" className="text-[10px]">
              MSME {vendor.msmeClass}
            </Badge>
          )}
          <Badge variant={vendor.active ? "success" : "default"} className="text-[10px]">
            {vendor.active ? "Active" : "Inactive"}
          </Badge>
        </Card>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1">
        {(
          [
            { key: "pos", icon: Store, label: "My Purchase Orders" },
            { key: "upload", icon: Upload, label: "Upload Invoice" },
            { key: "payments", icon: CreditCard, label: "Payment Status" },
          ] as const
        ).map(({ key, icon: Icon, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              tab === key
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-accent",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {tab === "pos" && (
        <POsTab pos={myPOs} decisions={decisions} />
      )}
      {tab === "upload" && (
        <UploadTab
          vendorId={vendorId}
          myPOs={myPOs}
          decisions={decisions}
          myInvoices={myInvoices}
          onSubmit={handleInvoiceSubmit}
        />
      )}
      {tab === "payments" && (
        <PaymentsTab myPOs={myPOs} decisions={decisions} myInvoices={myInvoices} />
      )}
    </>
  );
}

// ============================================================
// Tab 1 — My Purchase Orders
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
                      {expanded ? (
                        <ChevronDown className="size-3.5" />
                      ) : (
                        <ChevronRight className="size-3.5" />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-mono text-xs font-semibold">{po.id}</p>
                      <p className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">
                        {po.title}
                      </p>
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
                        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Line items
                        </p>
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
                        {po.invoice && (
                          <div className="mt-3 flex items-center gap-2 rounded-md border bg-card px-3 py-2 text-xs">
                            <FileText className="size-3.5 text-muted-foreground shrink-0" />
                            <span>Invoice {po.invoice.number} · {formatDate(po.invoice.date)}</span>
                            <Money value={po.invoice.amount} className="ml-auto font-semibold" />
                          </div>
                        )}
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
// Tab 2 — Upload Invoice
// ============================================================

function UploadTab({
  vendorId,
  myPOs,
  decisions,
  myInvoices,
  onSubmit,
}: {
  vendorId: string;
  myPOs: PurchaseOrder[];
  decisions: Record<string, import("@/lib/hr/approvals").Decision>;
  myInvoices: VendorInvoice[];
  onSubmit: (inv: Omit<VendorInvoice, "id" | "vendorId" | "submittedAt" | "status">) => void;
}) {
  // Only POs with status "issued" can receive an uploaded invoice.
  const eligiblePOs = myPOs.filter((p) => effectiveStatus(p, decisions) === "issued");

  const [poId, setPoId] = React.useState(eligiblePOs[0]?.id ?? "");
  const [invoiceNo, setInvoiceNo] = React.useState("");
  const [date, setDate] = React.useState("2026-06-27");
  const [amount, setAmount] = React.useState("");
  const [fileName, setFileName] = React.useState("");
  const [submitted, setSubmitted] = React.useState(false);

  React.useEffect(() => {
    // Reset poId when vendor changes (parent might not re-mount).
    setPoId(eligiblePOs[0]?.id ?? "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vendorId]);

  const valid =
    poId.trim() !== "" &&
    invoiceNo.trim() !== "" &&
    date !== "" &&
    Number(amount) > 0 &&
    fileName.trim() !== "";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    onSubmit({ poId, invoiceNo: invoiceNo.trim(), date, amount: Number(amount), fileName: fileName.trim() });
    setInvoiceNo("");
    setAmount("");
    setFileName("");
    setSubmitted(true);
    setTimeout(() => setSubmitted(false), 3000);
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Upload form */}
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold">Submit an invoice</h3>
        {eligiblePOs.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No open purchase orders are awaiting an invoice right now. Your POs are either already invoiced, approved, or paid.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Purchase Order *
              </span>
              <Select value={poId} onChange={(e) => setPoId(e.target.value)} className="h-9">
                {eligiblePOs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.id} — {p.title}
                  </option>
                ))}
              </Select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Invoice No *
                </span>
                <Input
                  value={invoiceNo}
                  onChange={(e) => setInvoiceNo(e.target.value)}
                  placeholder="e.g. INV/2026/0042"
                  className="h-9"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">
                  Invoice Date *
                </span>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="h-9"
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Invoice Amount (₹) *
              </span>
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
              <span className="mb-1 block text-xs font-medium text-muted-foreground">
                Attachment filename *
              </span>
              <Input
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="e.g. invoice_june2026.pdf"
                className="h-9"
              />
              <p className="mt-1 text-[11px] text-muted-foreground">
                Enter the file name you would upload (simulated — no actual file is sent).
              </p>
            </label>

            <div className="flex items-center gap-3 border-t pt-4">
              <Button type="submit" disabled={!valid}>
                <Upload className="size-4" /> Submit invoice
              </Button>
              {submitted && (
                <span className="flex items-center gap-1 text-xs text-success">
                  <CheckCircle2 className="size-3.5" /> Submitted successfully
                </span>
              )}
            </div>
          </form>
        )}
      </Card>

      {/* Submitted invoices list */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Submitted invoices</h3>
        {myInvoices.length === 0 ? (
          <Card className="py-8 text-center text-sm text-muted-foreground">
            No invoices submitted yet.
          </Card>
        ) : (
          <div className="space-y-2">
            {[...myInvoices].reverse().map((inv) => {
              const meta = INVOICE_STATUS_META[inv.status];
              return (
                <Card key={inv.id} className="flex items-center gap-3 p-3 text-xs">
                  <FileText className="size-4 shrink-0 text-muted-foreground" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{inv.invoiceNo}</p>
                    <p className="text-muted-foreground">
                      PO {inv.poId} · {formatDate(inv.date)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{inv.fileName}</p>
                  </div>
                  <div className="text-right">
                    <Money value={inv.amount} className="font-semibold" />
                    <div className="mt-1">
                      <Badge variant={meta.variant} className="text-[10px]">
                        {meta.label}
                      </Badge>
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
// Tab 3 — Payment Status
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
              // Match any vendor-uploaded invoice for this PO.
              const uploaded = myInvoices.find((i) => i.poId === po.id);
              // Also check the PO's own invoice (from the main workflow).
              const invoiceNo = po.invoice?.number ?? uploaded?.invoiceNo ?? "—";

              const payStatus =
                status === "paid" || status === "approved-paid"
                  ? "paid"
                  : uploaded || po.invoice
                  ? "invoiced"
                  : "issued";

              const payMeta: Record<
                "issued" | "invoiced" | "paid",
                { label: string; variant: "default" | "warning" | "success"; icon: React.ElementType }
              > = {
                issued: { label: "Awaiting invoice", variant: "default", icon: Clock },
                invoiced: { label: "Invoice under review", variant: "warning", icon: FileText },
                paid: { label: "Paid", variant: "success", icon: Banknote },
              };
              const m = payMeta[payStatus];

              return (
                <tr key={po.id} className="border-b align-top last:border-0">
                  <td className="px-5 py-3">
                    <p className="font-mono text-xs font-semibold">{po.id}</p>
                    <p className="mt-0.5 max-w-[200px] truncate text-xs text-muted-foreground">
                      {po.title}
                    </p>
                  </td>
                  <td className="px-5 py-3 font-mono text-xs">{invoiceNo}</td>
                  <td className="px-5 py-3 text-right">
                    <Money value={po.total} className="font-semibold" />
                  </td>
                  <td className="px-5 py-3">
                    <Badge variant={m.variant} className="flex w-fit items-center gap-1">
                      <m.icon className="size-3" />
                      {m.label}
                    </Badge>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">
                    {po.paidOn ? formatDate(po.paidOn) : "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
