"use client";

import * as React from "react";
import { Scale, AlertTriangle, Wallet } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { useJournal } from "@/components/accounting/journal-provider";
import { ACCOUNTS, accountById } from "@/lib/crm";
import { loadChartOfAccounts } from "@/lib/accounting/chart-of-accounts";
import { locationsForEntity } from "@/lib/accounting/org";
import { cn, formatDate } from "@/lib/utils";
import {
  allInvoices,
  effectiveStatus,
  outstandingOf,
  loadCreatedInvoices,
  loadStatusOverrides,
  saveStatusOverrides,
  loadInvoicePayments,
  saveInvoicePayments,
  invoiceTotal,
  type Invoice,
  type InvoiceStatus,
} from "@/lib/invoicing";
import type { EntryDraft, ManualEntryLine } from "@/lib/accounting/manual-entries";

const AR = "1100";
const TDS_RECEIVABLE = "1310";
const cashAccounts = loadChartOfAccounts().filter((a) => a.isCash);
const todayIso = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

interface OpenRow {
  inv: Invoice;
  status: InvoiceStatus;
  total: number;
  outstanding: number;
}

/**
 * Touchstone-style Receive Payment: pick a customer, see every outstanding
 * invoice, allocate the receipt across them (full or part), optionally record
 * the TDS the customer withheld, then post one receipt that settles AR and
 * flips each invoice to Paid / Part-paid.
 */
export function ReceivePayment({
  open,
  onClose,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  onPosted?: () => void;
}) {
  const { post } = useJournal();

  const [created, setCreated] = React.useState<Invoice[]>([]);
  const [overrides, setOverrides] = React.useState<Record<string, InvoiceStatus>>({});
  const [payments, setPayments] = React.useState<Record<string, number>>({});

  const [customerId, setCustomerId] = React.useState("");
  const [date, setDate] = React.useState(todayIso());
  const [bankAccount, setBankAccount] = React.useState("1020");
  const [tdsRate, setTdsRate] = React.useState(0);
  const [alloc, setAlloc] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<string[]>([]);

  // (Re)load persisted state whenever the dialog opens.
  React.useEffect(() => {
    if (!open) return;
    setCreated(loadCreatedInvoices());
    setOverrides(loadStatusOverrides());
    setPayments(loadInvoicePayments());
    setCustomerId("");
    setAlloc({});
    setTdsRate(0);
    setDate(todayIso());
    setErrors([]);
  }, [open]);

  // Open invoices grouped by customer, computed from current persisted state.
  const openByCustomer = React.useMemo(() => {
    const map = new Map<string, OpenRow[]>();
    for (const inv of allInvoices(created)) {
      const status = effectiveStatus(inv, overrides);
      if (status === "draft" || status === "paid") continue;
      const outstanding = outstandingOf(inv, payments);
      if (outstanding <= 0) continue;
      const row: OpenRow = { inv, status, total: invoiceTotal(inv), outstanding };
      const arr = map.get(inv.accountId) ?? [];
      arr.push(row);
      map.set(inv.accountId, arr);
    }
    return map;
  }, [created, overrides, payments]);

  const customers = ACCOUNTS.filter((a) => (openByCustomer.get(a.id)?.length ?? 0) > 0).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const rows = customerId ? openByCustomer.get(customerId) ?? [] : [];

  const allocFor = (id: string) => Math.max(0, Number(alloc[id]) || 0);
  const totalAllocated = round2(rows.reduce((s, r) => s + allocFor(r.inv.id), 0));
  const tdsAmount = round2((totalAllocated * tdsRate) / 100);
  const netToBank = round2(totalAllocated - tdsAmount);
  const overAllocated = rows.some((r) => allocFor(r.inv.id) > r.outstanding + 0.5);

  function selectCustomer(id: string) {
    setCustomerId(id);
    setAlloc({});
    setErrors([]);
  }
  function setLine(id: string, value: string) {
    setAlloc((prev) => ({ ...prev, [id]: value }));
  }
  function fillFull(r: OpenRow) {
    setLine(r.inv.id, String(r.outstanding));
  }
  function allocateAll() {
    setAlloc(Object.fromEntries(rows.map((r) => [r.inv.id, String(r.outstanding)])));
  }
  function clearAll() {
    setAlloc({});
  }

  function handlePost() {
    const errs: string[] = [];
    if (!customerId) errs.push("Select a customer.");
    if (totalAllocated <= 0) errs.push("Allocate the receipt to at least one invoice.");
    if (overAllocated) errs.push("An allocation exceeds the invoice's outstanding amount.");
    if (errs.length) {
      setErrors(errs);
      return;
    }

    const acc = accountById(customerId)!;
    const entityId = acc.entityId;
    const locationId = locationsForEntity(entityId)[0]?.id ?? "";
    const paidRows = rows.filter((r) => allocFor(r.inv.id) > 0);
    const refs = paidRows.map((r) => r.inv.number).join(", ");

    const lines: ManualEntryLine[] = [
      { accountCode: bankAccount, debit: netToBank, credit: 0 },
    ];
    if (tdsAmount > 0) lines.push({ accountCode: TDS_RECEIVABLE, debit: tdsAmount, credit: 0 });
    lines.push({ accountCode: AR, debit: 0, credit: totalAllocated });

    const draft: EntryDraft = {
      type: "receipt",
      date,
      narration: `Receipt from ${acc.name} — settles ${refs}`,
      entityId,
      locationId,
      currency: "INR",
      basis: "accrual",
      lines,
    };
    const result = post(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    // Persist per-invoice receipts and flip statuses.
    const nextPayments = { ...payments };
    const nextOverrides = { ...overrides };
    for (const r of paidRows) {
      const received = (nextPayments[r.inv.id] ?? 0) + allocFor(r.inv.id);
      nextPayments[r.inv.id] = received;
      nextOverrides[r.inv.id] = received >= r.total - 0.5 ? "paid" : "partial";
    }
    saveInvoicePayments(nextPayments);
    saveStatusOverrides(nextOverrides);
    setPayments(nextPayments);
    setOverrides(nextOverrides);

    onPosted?.();
    onClose();
  }

  const acc = customerId ? accountById(customerId) : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-3xl"
      title={
        <span className="flex items-center gap-2">
          <Wallet className="size-4" /> Receive Payment
        </span>
      }
      description="Select a customer, then allocate the amount received across their outstanding invoices."
      footer={
        <>
          <div className="mr-auto flex items-center gap-2 text-sm">
            {totalAllocated > 0 && !overAllocated ? (
              <Badge variant="success" className="gap-1">
                <Scale className="size-3" /> Allocated <Money value={totalAllocated} />
              </Badge>
            ) : (
              <span className="text-muted-foreground">Nothing allocated yet</span>
            )}
          </div>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handlePost} disabled={totalAllocated <= 0 || overAllocated}>
            Post receipt
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2">
            <Label htmlFor="rp-cust">Customer</Label>
            <Select id="rp-cust" value={customerId} onChange={(e) => selectCustomer(e.target.value)} className="mt-1">
              <option value="">Select customer…</option>
              {customers.map((c) => {
                const due = (openByCustomer.get(c.id) ?? []).reduce((s, r) => s + r.outstanding, 0);
                return (
                  <option key={c.id} value={c.id}>
                    {c.name} — ₹{due.toLocaleString("en-IN")} due
                  </option>
                );
              })}
            </Select>
          </div>
          <div>
            <Label htmlFor="rp-date">Date</Label>
            <Input id="rp-date" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="rp-bank">Into</Label>
            <Select id="rp-bank" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="mt-1">
              {cashAccounts.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {customerId && rows.length === 0 && (
          <p className="rounded-lg border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No outstanding invoices for {acc?.name}.
          </p>
        )}

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-xs">
              <span className="font-medium uppercase tracking-wide text-muted-foreground">
                {rows.length} outstanding invoice{rows.length === 1 ? "" : "s"}
              </span>
              <span className="flex gap-3">
                <button onClick={allocateAll} className="font-medium text-primary hover:underline">Allocate all</button>
                <button onClick={clearAll} className="text-muted-foreground hover:underline">Clear</button>
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Invoice</th>
                  <th className="px-4 py-2 font-medium">Due</th>
                  <th className="px-4 py-2 text-right font-medium">Outstanding</th>
                  <th className="px-4 py-2 text-right font-medium">Settle (cash + TDS)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = allocFor(r.inv.id);
                  const over = a > r.outstanding + 0.5;
                  const rowTds = round2((a * tdsRate) / 100);
                  return (
                    <tr key={r.inv.id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-2">
                        <p className="font-mono text-xs font-semibold">{r.inv.number}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(r.inv.date)}</p>
                      </td>
                      <td className="px-4 py-2">
                        <span className={cn("text-xs", r.status === "overdue" && "font-medium text-danger")}>
                          {formatDate(r.inv.dueDate)}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right tabular">
                        <Money value={r.outstanding} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            value={alloc[r.inv.id] ?? ""}
                            onChange={(e) => setLine(r.inv.id, e.target.value)}
                            placeholder="0.00"
                            className={cn("h-8 w-32 text-right tabular", over && "border-danger")}
                          />
                          <button onClick={() => fillFull(r)} className="text-[11px] font-medium text-primary hover:underline">
                            Full
                          </button>
                        </div>
                        {rowTds > 0 && a > 0 && (
                          <p className="mt-0.5 text-right text-[11px] text-muted-foreground">
                            cash ₹{round2(a - rowTds).toLocaleString("en-IN")} + TDS ₹{rowTds.toLocaleString("en-IN")}
                          </p>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {rows.length > 0 && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label htmlFor="rp-tds">TDS withheld by customer</Label>
              <Select id="rp-tds" value={tdsRate} onChange={(e) => setTdsRate(Number(e.target.value))} className="mt-1">
                {[0, 0.1, 1, 2, 5, 10].map((r) => (
                  <option key={r} value={r}>
                    {r === 0 ? "No TDS" : `${r}%`}
                  </option>
                ))}
              </Select>
            </div>
            <div className="sm:col-span-2 self-end rounded-lg border bg-muted/20 p-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Allocated</span><Money value={totalAllocated} /></div>
              {tdsAmount > 0 && (
                <div className="flex justify-between text-muted-foreground"><span>Less TDS receivable</span><Money value={-tdsAmount} /></div>
              )}
              <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Net into bank</span><Money value={netToBank} /></div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Cash + TDS settles each invoice in full. The TDS is booked to TDS Receivable — claim it later via a certificate in GST &amp; TDS.
              </p>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded-lg border border-danger/40 bg-danger/8 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-danger">
              <AlertTriangle className="size-4" /> Receipt not posted
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-danger/90">
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
