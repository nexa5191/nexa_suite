"use client";

import * as React from "react";
import {
  FileCheck2,
  Truck,
  X,
  Check,
  QrCode,
  Zap,
  ShieldCheck,
  ReceiptText,
  Ban,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Label, Select } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import {
  loadEInvoiceStates,
  saveEInvoiceStates,
  recordsForEntity,
  summarise,
  markGenerated,
  markCancelled,
  generateAllPending,
  type EInvoiceStateMap,
  type EInvoiceRecord,
  type GstTreatment,
} from "@/lib/tax/einvoice";

const ENTITY_OPTIONS: { value: string; label: string }[] = [
  { value: "all", label: "All entities" },
  { value: "ent-nexa-in", label: "Nexa Foods" },
  { value: "ent-nexa-trade", label: "Nexa Trading" },
  { value: "ent-nexa-global", label: "Nexa Global" },
];

const TREATMENT_META: Record<GstTreatment, { label: string; variant: "primary" | "warning" | "success" }> = {
  intra: { label: "Intra-state", variant: "primary" },
  inter: { label: "Inter-state", variant: "warning" },
  export: { label: "Export / zero-rated", variant: "success" },
};

const STATUS_META: Record<
  EInvoiceRecord["status"],
  { label: string; variant: "default" | "success" | "danger" }
> = {
  pending: { label: "Pending", variant: "default" },
  generated: { label: "IRN generated", variant: "success" },
  cancelled: { label: "Cancelled", variant: "danger" },
};

export function EInvoiceClient() {
  const [states, setStates] = React.useState<EInvoiceStateMap>({});
  const [entity, setEntity] = React.useState<string>("all");
  const [detail, setDetail] = React.useState<EInvoiceRecord | null>(null);

  React.useEffect(() => {
    setStates(loadEInvoiceStates());
  }, []);

  function persist(next: EInvoiceStateMap) {
    setStates(next);
    saveEInvoiceStates(next);
  }

  const records = React.useMemo(
    () => recordsForEntity([], states, entity),
    [states, entity],
  );
  const summary = React.useMemo(() => summarise(records), [records]);

  // Keep the open detail modal in sync with the latest state.
  const openDetail = detail
    ? records.find((r) => r.invoiceId === detail.invoiceId) ?? detail
    : null;

  function generate(id: string) {
    persist(markGenerated(states, id));
  }
  function cancel(id: string) {
    persist(markCancelled(states, id));
  }
  function generateAll() {
    persist(generateAllPending(states, records));
  }

  const pendingCount = summary.pending;

  return (
    <>
      <PageHeader
        title="e-Invoicing & e-Way Bills"
        subtitle="IRP (NIC) compliance for FY 2025-26 — generate IRNs, signed QR codes and e-Way bills for B2B & export invoices."
        actions={
          <Button onClick={generateAll} disabled={pendingCount === 0}>
            <Zap className="size-4" /> Generate all pending{pendingCount > 0 ? ` (${pendingCount})` : ""}
          </Button>
        }
      />

      {/* Summary cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <SummaryCard
          icon={<ReceiptText className="size-4" />}
          label="Eligible invoices"
          plain={String(summary.eligible)}
          sub={`${summary.pending} pending`}
        />
        <SummaryCard
          icon={<FileCheck2 className="size-4" />}
          label="IRN generated"
          plain={String(summary.generated)}
          sub={summary.cancelled ? `${summary.cancelled} cancelled` : "reported to IRP"}
          highlight
        />
        <SummaryCard
          icon={<Truck className="size-4" />}
          label="e-Way bills active"
          plain={`${summary.ewayActive} / ${summary.ewayRequired}`}
          sub="active / required"
        />
        <SummaryCard
          icon={<ShieldCheck className="size-4" />}
          label="Total invoice value"
          money={summary.totalValue}
          sub="across eligible invoices"
        />
      </div>

      {/* Entity filter */}
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div className="w-56">
          <Label htmlFor="entity">Entity</Label>
          <Select id="entity" value={entity} onChange={(e) => setEntity(e.target.value)} className="mt-1">
            {ENTITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <p className="pb-2 text-xs text-muted-foreground">
          Showing {records.length} eligible invoice{records.length === 1 ? "" : "s"}. IRNs can be cancelled within 24h of generation.
        </p>
      </div>

      {/* Records table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Customer</th>
                <th className="px-5 py-3 font-medium">Date</th>
                <th className="px-5 py-3 text-right font-medium">Value</th>
                <th className="px-5 py-3 font-medium">GST</th>
                <th className="px-5 py-3 font-medium">IRN status</th>
                <th className="px-5 py-3 font-medium">e-Way</th>
                <th className="px-5 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => {
                const treat = TREATMENT_META[r.treatment];
                const st = STATUS_META[r.status];
                return (
                  <tr key={r.invoiceId} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setDetail(r)}
                        className="font-medium text-primary hover:underline"
                      >
                        {r.invoiceNumber}
                      </button>
                      {r.status === "generated" && (
                        <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">
                          IRN {r.irn.slice(0, 16)}… · Ack {r.ackNo}
                        </p>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <span className="font-medium">{r.customerName}</span>
                      <p className="text-[11px] text-muted-foreground">{r.customerGstin}</p>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">{formatDate(r.date)}</td>
                    <td className="px-5 py-3 text-right tabular font-medium">
                      <Money value={r.value} />
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={treat.variant}>{treat.label}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={st.variant}>
                        {r.status === "generated" && <Check className="size-3" />}
                        {r.status === "cancelled" && <Ban className="size-3" />}
                        {st.label}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      {r.ewayRequired ? (
                        r.status === "generated" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-success">
                            <Truck className="size-3.5" /> {r.eway?.ewbNo}
                          </span>
                        ) : (
                          <Badge variant="warning">Required</Badge>
                        )
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {r.status === "pending" && (
                          <Button size="sm" variant="outline" onClick={() => generate(r.invoiceId)}>
                            <FileCheck2 className="size-3.5" /> Generate IRN
                          </Button>
                        )}
                        {r.status === "generated" && (
                          <>
                            <Button size="sm" variant="ghost" onClick={() => setDetail(r)}>
                              <QrCode className="size-3.5" /> View
                            </Button>
                            <Button size="sm" variant="ghost" className="text-danger" onClick={() => cancel(r.invoiceId)}>
                              <X className="size-3.5" /> Cancel IRN
                            </Button>
                          </>
                        )}
                        {r.status === "cancelled" && (
                          <Button size="sm" variant="ghost" onClick={() => generate(r.invoiceId)}>
                            Re-generate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {records.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-sm text-muted-foreground">
                    No e-invoice-eligible invoices for this entity.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {openDetail && (
        <EInvoiceModal
          record={openDetail}
          onClose={() => setDetail(null)}
          onGenerate={() => generate(openDetail.invoiceId)}
          onCancel={() => cancel(openDetail.invoiceId)}
        />
      )}
    </>
  );
}

function SummaryCard({
  icon,
  label,
  plain,
  money,
  sub,
  highlight,
}: {
  icon: React.ReactNode;
  label: string;
  plain?: string;
  money?: number;
  sub?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={cn("p-4", highlight && "border-primary/30 bg-primary/5")}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <p className="text-xs font-medium uppercase tracking-wide">{label}</p>
      </div>
      <p className="mt-1.5 text-2xl font-bold tabular">
        {money !== undefined ? <Money value={money} compact /> : plain}
      </p>
      {sub && <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>}
    </Card>
  );
}

function EInvoiceModal({
  record,
  onClose,
  onGenerate,
  onCancel,
}: {
  record: EInvoiceRecord;
  onClose: () => void;
  onGenerate: () => void;
  onCancel: () => void;
}) {
  const t = record.totals;
  const treat = TREATMENT_META[record.treatment];
  const st = STATUS_META[record.status];
  const generated = record.status === "generated";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto scrollbar-thin p-5"
        onClick={(ev) => ev.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              e-Invoice · {record.entityName}
            </p>
            <h3 className="mt-0.5 font-semibold">{record.invoiceNumber}</h3>
            <p className="text-xs text-muted-foreground">
              {record.customerName} · {formatDate(record.date)}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        </div>

        {/* Status + treatment */}
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={st.variant}>
            {generated && <Check className="size-3" />}
            {st.label}
          </Badge>
          <Badge variant={treat.variant}>{treat.label}</Badge>
          {record.ewayRequired && <Badge variant="warning">e-Way bill required</Badge>}
          <span className="ml-auto text-sm font-semibold tabular">
            <Money value={record.value} />
          </span>
        </div>

        {/* IRP block */}
        <div className="mt-4">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            IRP acknowledgement
          </p>
          <Field label="IRN" mono value={record.irn} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Ack No." mono value={record.ackNo} />
            <Field label="Ack Date" value={formatDate(record.ackDate)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Supplier GSTIN" mono value={record.supplierGstin} />
            <Field label="Buyer GSTIN" mono value={record.customerGstin} />
          </div>
        </div>

        {/* Signed QR placeholder */}
        <div className="mt-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <QrCode className="size-3.5" /> Signed QR (NIC)
          </div>
          <div className="mt-1 rounded-md border border-dashed bg-muted/30 p-3 font-mono text-[10px] leading-relaxed break-all text-muted-foreground">
            {record.signedQr}
          </div>
        </div>

        {/* GST split */}
        <div className="mt-3">
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            GST split
          </p>
          <Line label="Taxable value" value={t.taxable} />
          {record.treatment === "intra" ? (
            <>
              <Line label="CGST" value={t.cgst} />
              <Line label="SGST" value={t.sgst} />
            </>
          ) : record.treatment === "inter" ? (
            <Line label="IGST" value={t.igst} />
          ) : (
            <div className="flex items-center justify-between py-1 text-sm">
              <span className="text-muted-foreground">Tax</span>
              <span className="text-muted-foreground">Zero-rated (export under LUT)</span>
            </div>
          )}
          <Line label="Invoice value" value={t.total} bold />
        </div>

        {/* e-Way bill */}
        {record.ewayRequired && record.eway && (
          <div className="mt-3 rounded-lg border p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              <Truck className="size-3.5" /> e-Way bill
            </div>
            <div className="mt-2 grid grid-cols-2 gap-3">
              <Field label="EWB No." mono value={generated ? record.eway.ewbNo : "— generate IRN —"} />
              <Field label="Distance" value={`${record.eway.distanceKm} km`} />
              <Field label="Valid from" value={formatDate(record.eway.validFrom)} />
              <Field label="Valid until" value={formatDate(record.eway.validUntil)} />
              <Field label="Transporter" value={record.eway.transporter} />
              <Field label="Transporter ID" mono value={record.eway.transporterId} />
              <Field label="Vehicle" mono value={record.eway.vehicleNo} />
              <Field label="Mode" value={record.eway.mode} />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-2 border-t pt-3">
          {generated ? (
            <>
              <p className="text-xs text-muted-foreground">
                Cancellable until {formatDate(record.cancelDeadline)} (within 24h of generation).
              </p>
              <Button size="sm" variant="danger" className="ml-auto" onClick={onCancel}>
                <X className="size-4" /> Cancel IRN
              </Button>
            </>
          ) : (
            <Button size="sm" className="ml-auto" onClick={onGenerate}>
              <FileCheck2 className="size-4" /> Generate IRN
              {record.ewayRequired ? " + e-Way bill" : ""}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="py-1">
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn("text-sm break-all", mono && "font-mono text-xs")}>{value}</p>
    </div>
  );
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between py-1 text-sm", bold && "border-t mt-1 pt-1.5 font-semibold")}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular">
        <Money value={value} />
      </span>
    </div>
  );
}
