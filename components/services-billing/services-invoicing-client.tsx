"use client";

import * as React from "react";
import { Receipt, FileCheck2, Trash2, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/modal";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { useAccess } from "@/components/access/access-provider";
import { useServices } from "@/components/services/services-provider";
import { employeeName } from "@/lib/hr/employees";
import { accountName } from "@/lib/services/projects";
import { accountById } from "@/lib/crm";
import { entityById } from "@/lib/accounting/org";
import { computeTotals, gstTreatment, entityLetterhead } from "@/lib/invoicing";
import {
  servicesInvoiceTotal, asInvoiceLines, SERVICES_INVOICE_STATUS_META, type ServicesInvoice,
} from "@/lib/services/time-invoice";

export function ServicesInvoicingClient() {
  const { wip, invoices, projects, generateInvoice, finalizeInvoice, deleteDraftInvoice } = useServices();
  const { canManage } = useAccess();
  const [openId, setOpenId] = React.useState<string | null>(null);

  const wipTotal = wip.reduce((s, g) => s + g.amount, 0);
  const drafts = invoices.filter((i) => i.status === "draft");
  const finalizedTotal = invoices.filter((i) => i.status !== "draft").reduce((s, i) => s + servicesInvoiceTotal(i), 0);

  const open = openId ? invoices.find((i) => i.id === openId) ?? null : null;

  return (
    <>
      <PageHeader
        title="Invoicing"
        subtitle="Time & billing — fees invoiced from approved timesheet WIP."
        actions={<Badge variant="primary"><Sparkles className="size-3" /> Services mode</Badge>}
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Billable WIP" money={wipTotal} />
        <Metric label="Draft invoices" value={String(drafts.length)} />
        <Metric label="Invoiced" money={finalizedTotal} />
        <Metric label="Engagements ready" value={String(wip.length)} />
      </div>

      {/* WIP → generate */}
      <Card className="mb-4 p-4">
        <p className="mb-3 text-sm font-semibold">Work-in-progress, ready to bill</p>
        {wip.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No billable WIP. Approve billable timesheets on cleared engagements to bill them here.
          </p>
        ) : (
          <div className="space-y-2">
            {wip.map((g) => {
              const project = projects.find((p) => p.id === g.projectId);
              return (
                <div key={g.projectId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3">
                  <div className="min-w-0">
                    <p className="font-medium">{project?.code} · {accountName(g.accountId)}</p>
                    <p className="text-xs text-muted-foreground">
                      {project?.name} · {g.hours.toFixed(1)} hrs · {g.lines.length} {g.lines.length === 1 ? "person" : "people"}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Money value={g.amount} className="font-semibold" />
                    <Button size="sm" disabled={!canManage} onClick={() => { const id = generateInvoice(g.projectId, new Date().toISOString().slice(0, 10)); if (id) setOpenId(id); }}>
                      Generate invoice
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Invoice list */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Invoice</th>
                <th className="px-5 py-3 font-medium">Client</th>
                <th className="px-5 py-3 font-medium">Entity</th>
                <th className="px-5 py-3 text-right font-medium">Amount</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {invoices.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-muted-foreground">No time invoices yet — generate one from WIP above.</td></tr>
              )}
              {invoices.slice().sort((a, b) => b.date.localeCompare(a.date)).map((inv) => {
                const meta = SERVICES_INVOICE_STATUS_META[inv.status];
                return (
                  <tr key={inv.id} onClick={() => setOpenId(inv.id)} className="cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50">
                    <td className="px-5 py-3">
                      <p className="flex items-center gap-1.5 font-mono text-xs font-semibold"><Receipt className="size-3.5 text-muted-foreground" /> {inv.number}</p>
                      <p className="mt-0.5 text-[11px] text-muted-foreground">{formatDate(inv.date)}</p>
                    </td>
                    <td className="px-5 py-3 font-medium">{accountName(inv.accountId)}</td>
                    <td className="px-5 py-3 text-muted-foreground">{entityById(inv.entityId)?.name}</td>
                    <td className="px-5 py-3 text-right"><Money value={servicesInvoiceTotal(inv)} className="font-semibold" /></td>
                    <td className="px-5 py-3"><Badge variant={meta.variant}>{meta.label}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <InvoiceDrawer
        inv={open}
        canManage={canManage}
        onClose={() => setOpenId(null)}
        onFinalize={() => open && finalizeInvoice(open.id)}
        onDelete={() => { if (open) { deleteDraftInvoice(open.id); setOpenId(null); } }}
      />
    </>
  );
}

function InvoiceDrawer({
  inv, canManage, onClose, onFinalize, onDelete,
}: {
  inv: ServicesInvoice | null;
  canManage: boolean;
  onClose: () => void;
  onFinalize: () => void;
  onDelete: () => void;
}) {
  const acc = inv ? accountById(inv.accountId) : undefined;
  const lh = inv ? entityLetterhead(inv.entityId) : null;
  const treatment = inv ? gstTreatment(inv.entityId, acc?.stateCode ?? "29") : "intra";
  const totals = inv ? computeTotals(asInvoiceLines(inv.lines), "none", 0, treatment) : null;
  const meta = inv ? SERVICES_INVOICE_STATUS_META[inv.status] : null;

  return (
    <Drawer
      open={!!inv}
      onClose={onClose}
      title={inv?.number}
      subtitle={inv ? `${lh?.name} · ${formatDate(inv.date)}` : undefined}
      width="max-w-xl"
      actions={meta ? <Badge variant={meta.variant}>{meta.label}</Badge> : undefined}
    >
      {inv && totals && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Bill to</p>
              <p className="mt-1 font-medium">{acc?.legalName ?? acc?.name}</p>
              {acc?.address && <p className="text-xs text-muted-foreground">{acc.address}</p>}
              <p className="mt-0.5 font-mono text-xs text-muted-foreground">GSTIN {acc?.gstin ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Dates</p>
              <p className="mt-1 text-sm">Issued {formatDate(inv.date)}</p>
              <p className="text-sm">Due {formatDate(inv.dueDate)}</p>
              <Badge variant="default" className="mt-1 capitalize">
                {treatment === "export" ? "Export (zero-rated)" : treatment === "intra" ? "Intra-state" : "Inter-state"}
              </Badge>
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Professional</th>
                  <th className="px-3 py-2 text-right font-medium">Hours</th>
                  <th className="px-3 py-2 text-right font-medium">Rate</th>
                  <th className="px-3 py-2 text-right font-medium">GST</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {inv.lines.map((l, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2">{employeeName(l.employeeId)}</td>
                    <td className="px-3 py-2 text-right tabular">{l.hours.toFixed(1)}</td>
                    <td className="px-3 py-2 text-right tabular"><Money value={l.rate} /></td>
                    <td className="px-3 py-2 text-right tabular">{l.gstRate}%</td>
                    <td className="px-3 py-2 text-right tabular"><Money value={l.hours * l.rate} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ml-auto max-w-xs space-y-1 text-sm">
            <Row label="Subtotal" value={totals.subtotal} />
            {totals.cgst > 0 && <Row label="CGST" value={totals.cgst} muted />}
            {totals.sgst > 0 && <Row label="SGST" value={totals.sgst} muted />}
            {totals.igst > 0 && <Row label="IGST" value={totals.igst} muted />}
            {totals.treatment === "export" && <div className="flex justify-between text-muted-foreground"><span>GST</span><span>Zero-rated</span></div>}
            <div className="flex justify-between border-t pt-1.5 text-base font-bold"><span>Total</span><Money value={totals.total} /></div>
          </div>

          {inv.status === "draft" && canManage && (
            <div className="flex justify-end gap-2 border-t pt-4">
              <Button variant="ghost" onClick={onDelete}><Trash2 className="size-4" /> Discard draft</Button>
              <Button onClick={onFinalize}><FileCheck2 className="size-4" /> Finalize</Button>
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

function Metric({ label, value, money }: { label: string; value?: string; money?: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular">{money !== undefined ? <Money value={money} compact /> : value}</p>
    </Card>
  );
}
