"use client";

import * as React from "react";
import Link from "next/link";
import { Plus, Receipt, AlertTriangle, RotateCcw, Wallet, FileDown } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Drawer } from "@/components/ui/modal";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { VoucherButton } from "@/components/accounting/voucher-button";
import { ReceivePayment } from "./receive-payment";
import { cn, formatDate } from "@/lib/utils";
import { accountById } from "@/lib/crm";
import { entityById } from "@/lib/accounting/org";
import { useAccess } from "@/components/access/access-provider";
import { ServicesInvoicingClient } from "@/components/services-billing/services-invoicing-client";
import {
  allInvoices,
  invoiceTotal,
  effectiveStatus,
  statusMeta,
  computeTotals,
  gstTreatment,
  entityLetterhead,
  loadCreatedInvoices,
  loadStatusOverrides,
  saveStatusOverrides,
  loadInvoicePayments,
  outstandingOf,
  amountInWords,
  INVOICE_STATUSES,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/invoicing";

// When the Professional Services sector is enabled (the "timesheets" function
// is provisioned & role-granted), Invoicing flips to the time-based format.
// Otherwise it stays the product/GST invoice below. One switch, no shared state.
export function InvoicingClient() {
  const { can } = useAccess();
  if (can("timesheets")) return <ServicesInvoicingClient />;
  return <ProductInvoicingClient />;
}

function ProductInvoicingClient() {
  const [created, setCreated] = React.useState<Invoice[]>([]);
  const [overrides, setOverrides] = React.useState<Record<string, InvoiceStatus>>({});
  const [payments, setPayments] = React.useState<Record<string, number>>({});
  const [filter, setFilter] = React.useState<"all" | InvoiceStatus>("all");
  const [openId, setOpenId] = React.useState<string | null>(null);
  const [receiveOpen, setReceiveOpen] = React.useState(false);

  const refresh = React.useCallback(() => {
    setCreated(loadCreatedInvoices());
    setOverrides(loadStatusOverrides());
    setPayments(loadInvoicePayments());
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  function setStatus(inv: Invoice, status: InvoiceStatus) {
    setOverrides((prev) => {
      const next = { ...prev, [inv.id]: status };
      saveStatusOverrides(next);
      return next;
    });
  }
  function resetStatus(inv: Invoice) {
    setOverrides((prev) => {
      const next = { ...prev };
      delete next[inv.id];
      saveStatusOverrides(next);
      return next;
    });
  }

  const invoices = allInvoices(created).map((inv) => ({
    inv,
    status: effectiveStatus(inv, overrides),
    total: invoiceTotal(inv),
  }));

  const shown = filter === "all" ? invoices : invoices.filter((r) => r.status === filter);

  const outstanding = invoices
    .filter((r) => r.status === "sent" || r.status === "overdue" || r.status === "partial")
    .reduce((s, r) => s + outstandingOf(r.inv, payments), 0);
  const overdueAmt = invoices
    .filter((r) => r.status === "overdue")
    .reduce((s, r) => s + outstandingOf(r.inv, payments), 0);
  const paidAmt = invoices.filter((r) => r.status === "paid").reduce((s, r) => s + r.total, 0);

  // Outstanding broken down by ageing status — drives the flip card.
  const outstandingBreakdown = (["sent", "partial", "overdue"] as InvoiceStatus[]).map((k) => ({
    label: statusMeta(k).label,
    value: invoices.filter((r) => r.status === k).reduce((s, r) => s + outstandingOf(r.inv, payments), 0),
  }));

  const open = openId ? invoices.find((r) => r.inv.id === openId) ?? null : null;

  return (
    <>
      <PageHeader
        title="Invoicing"
        subtitle="GST-compliant accounts-receivable invoices billed to CRM accounts."
        actions={
          <div className="flex flex-wrap gap-2">
            <VoucherButton type="credit_note" label="Credit note" variant="outline" />
            <Button variant="outline" onClick={() => setReceiveOpen(true)}>
              <Wallet className="size-4" /> Receive payment
            </Button>
            <VoucherButton type="sales" label="Sales voucher" variant="outline" />
            <Link href="/invoicing/new">
              <Button>
                <Plus className="size-4" /> New invoice
              </Button>
            </Link>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Invoices" value={String(invoices.length)} />
        <MetricMoney label="Outstanding" value={outstanding} detail={outstandingBreakdown} detailTitle="By status" />
        <MetricMoney label="Overdue" value={overdueAmt} highlight={overdueAmt > 0} />
        <MetricMoney label="Collected (paid)" value={paidAmt} />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-1">
        {(["all", ...INVOICE_STATUSES.map((s) => s.key)] as const).map((k) => (
          <button
            key={k}
            onClick={() => setFilter(k)}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors",
              filter === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {k === "all" ? "All" : statusMeta(k as InvoiceStatus).label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Entity</th>
                <th className="px-5 py-3 font-medium">Due</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 text-right font-medium">Set status</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No invoices in this view.
                  </td>
                </tr>
              )}
              {shown.map(({ inv, status, total }) => {
                const acc = accountById(inv.accountId);
                const meta = statusMeta(status);
                const overridden = inv.id in overrides;
                return (
                  <tr
                    key={inv.id}
                    onClick={() => setOpenId(inv.id)}
                    className="cursor-pointer border-b align-top transition-colors last:border-0 hover:bg-accent/50"
                  >
                    <td className="px-5 py-3">
                      <p className="flex items-center gap-1.5 font-mono text-xs font-semibold">
                        <Receipt className="size-3.5 text-muted-foreground" /> {inv.number}
                      </p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(inv.date)}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{acc?.name ?? "—"}</p>
                      <p className="text-xs text-muted-foreground">{inv.billTo?.name ?? acc?.legalName}</p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{entityById(inv.entityId)?.name}</td>
                    <td className="px-5 py-3">
                      <span className={cn("text-sm", status === "overdue" && "font-medium text-danger")}>{formatDate(inv.dueDate)}</span>
                      {status === "overdue" && (
                        <p className="flex items-center gap-1 text-[11px] text-danger">
                          <AlertTriangle className="size-3" /> Past due
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Money value={total} className="font-semibold" />
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </td>
                    <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1.5">
                        <Select
                          value={status}
                          onChange={(e) => setStatus(inv, e.target.value as InvoiceStatus)}
                          className="h-8 w-32 text-xs"
                        >
                          {INVOICE_STATUSES.map((s) => (
                            <option key={s.key} value={s.key}>
                              {s.label}
                            </option>
                          ))}
                        </Select>
                        {overridden && (
                          <button onClick={() => resetStatus(inv)} className="text-muted-foreground hover:text-foreground" title="Reset to original">
                            <RotateCcw className="size-3.5" />
                          </button>
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

      <InvoiceDrawer open={open} overridden={open ? open.inv.id in overrides : false} onClose={() => setOpenId(null)} />
      <ReceivePayment open={receiveOpen} onClose={() => setReceiveOpen(false)} onPosted={refresh} />
    </>
  );
}

function InvoiceDrawer({
  open,
  overridden,
  onClose,
}: {
  open: { inv: Invoice; status: InvoiceStatus; total: number } | null;
  overridden: boolean;
  onClose: () => void;
}) {
  const inv = open?.inv;
  const acc = inv ? accountById(inv.accountId) : undefined;
  const billTo = {
    name: inv?.billTo?.name ?? acc?.legalName ?? acc?.name ?? "—",
    address: inv?.billTo?.address ?? acc?.address ?? "",
    gstin: inv?.billTo?.gstin ?? acc?.gstin ?? "—",
  };
  const lh = inv ? entityLetterhead(inv.entityId) : null;
  const treatment = inv ? gstTreatment(inv.entityId, acc?.stateCode ?? "29") : "intra";
  const totals = inv ? computeTotals(inv.lines, inv.discountType, inv.discountValue, treatment) : null;
  const meta = open ? statusMeta(open.status) : null;

  async function downloadPdf() {
    if (!inv || !totals || !lh) return;
    const { downloadInvoicePdf } = await import("@/lib/pdf/invoice-pdf");
    downloadInvoicePdf({
      letterhead: lh,
      number: inv.number,
      date: formatDate(inv.date),
      dueDate: formatDate(inv.dueDate),
      billTo,
      treatment,
      lines: inv.lines,
      totals,
      notes: inv.notes,
      amountWords: amountInWords(totals.total, "INR", "Rupee"),
    });
  }

  return (
    <Drawer
      open={!!inv}
      onClose={onClose}
      title={inv?.number}
      subtitle={inv ? `${lh?.name} · ${formatDate(inv.date)}` : undefined}
      width="max-w-xl"
      actions={
        <div className="flex items-center gap-1.5">
          {inv && (
            <Button size="sm" variant="outline" onClick={downloadPdf}>
              <FileDown className="size-4" /> PDF
            </Button>
          )}
          {meta && <Badge variant={meta.variant}>{meta.label}{overridden ? " (edited)" : ""}</Badge>}
        </div>
      }
    >
      {inv && totals && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bill to</p>
              <p className="mt-1 font-medium">{billTo.name}</p>
              {billTo.address && <p className="text-xs text-muted-foreground">{billTo.address}</p>}
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">GSTIN {billTo.gstin}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dates</p>
              <p className="mt-1 text-sm">Issued {formatDate(inv.date)}</p>
              <p className={cn("text-sm", open!.status === "overdue" && "font-medium text-danger")}>Due {formatDate(inv.dueDate)}</p>
              <Badge variant="default" className="mt-1 capitalize">{treatment === "export" ? "Export (zero-rated)" : treatment === "intra" ? "Intra-state" : "Inter-state"}</Badge>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Description</th>
                  <th className="px-3 py-2 font-medium">HSN</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 text-right font-medium">Rate</th>
                  <th className="px-3 py-2 text-right font-medium">GST</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2">{l.desc}</td>
                    <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{l.hsn}</td>
                    <td className="px-3 py-2 text-right tabular">{l.qty}</td>
                    <td className="px-3 py-2 text-right tabular"><Money value={l.rate} /></td>
                    <td className="px-3 py-2 text-right tabular">{l.gstRate}%</td>
                    <td className="px-3 py-2 text-right tabular"><Money value={l.qty * l.rate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <Row label="Subtotal" value={totals.subtotal} />
            {totals.discountAmt > 0 && <Row label="Discount" value={-totals.discountAmt} />}
            {totals.cgst > 0 && <Row label="CGST" value={totals.cgst} muted />}
            {totals.sgst > 0 && <Row label="SGST" value={totals.sgst} muted />}
            {totals.igst > 0 && <Row label="IGST" value={totals.igst} muted />}
            {totals.treatment === "export" && (
              <div className="flex justify-between text-muted-foreground"><span>GST</span><span>Zero-rated</span></div>
            )}
            <div className="flex justify-between border-t pt-1.5 text-base font-bold">
              <span>Total</span>
              <Money value={totals.total} />
            </div>
          </div>

          {inv.notes && (
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Notes</p>
              <p className="mt-1 text-sm text-muted-foreground">{inv.notes}</p>
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

function Row({ label, value, muted }: { label: string; value: number; muted?: boolean }) {
  return (
    <div className={cn("flex justify-between", muted && "text-muted-foreground")}>
      <span>{label}</span>
      <span className="tabular"><Money value={value} /></span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular">{value}</p>
    </Card>
  );
}

function MetricMoney({
  label,
  value,
  highlight,
  detail,
  detailTitle,
}: {
  label: string;
  value: number;
  highlight?: boolean;
  detail?: { label: string; value: number }[];
  detailTitle?: string;
}) {
  const [flipped, setFlipped] = React.useState(false);
  if (detail && detail.length > 0) {
    return (
      <Card
        className={cn("cursor-pointer select-none p-4 transition-colors hover:border-primary/40", highlight && "border-danger/40")}
        onClick={() => setFlipped((f) => !f)}
      >
        {flipped ? (
          <>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{detailTitle ?? "Breakdown"}</p>
            <div className="space-y-0.5">
              {detail.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{d.label}</span>
                  <span className="tabular font-medium"><Money value={d.value} compact /></span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="flex items-center gap-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {label} <RotateCcw className="size-3 opacity-50" />
            </p>
            <p className={cn("mt-1 text-3xl font-bold tabular", highlight && "text-danger")}>
              <Money value={value} compact />
            </p>
          </>
        )}
      </Card>
    );
  }
  return (
    <Card className={cn("p-4", highlight && "border-danger/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular", highlight && "text-danger")}>
        <Money value={value} compact />
      </p>
    </Card>
  );
}
