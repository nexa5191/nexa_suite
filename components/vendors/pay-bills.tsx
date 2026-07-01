"use client";

import * as React from "react";
import { Scale, AlertTriangle, Banknote } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { useJournal } from "@/components/accounting/journal-provider";
import { loadChartOfAccounts } from "@/lib/accounting/chart-of-accounts";
import { entityById } from "@/lib/accounting/org";
import { loadDecisions, saveDecisions, type Decision } from "@/lib/hr/approvals";
import { cn, formatDate } from "@/lib/utils";
import {
  VENDORS,
  PURCHASE_ORDERS,
  vendorById,
  effectiveStatus,
  invoiceApprovalId,
  loadPoPayments,
  savePoPayments,
  poOutstanding,
  type PurchaseOrder,
} from "@/lib/vendors";
import type { EntryDraft, ManualEntryLine } from "@/lib/accounting/manual-entries";

const AP = "2010";
const TDS_PAYABLE = "2200";
const cashAccounts = loadChartOfAccounts().filter((a) => a.isCash);
const todayIso = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

interface BillRow {
  po: PurchaseOrder;
  outstanding: number;
}

/**
 * Pay Bills — the payables twin of Receive Payment. Pick a vendor, see every
 * outstanding bill, allocate the payment (full or part), optionally deduct TDS
 * at source, then post one payment that settles AP and clears each bill. Fully
 * paid bills are marked approved so the SPOC queue and vendor list stay in sync.
 */
export function PayBills({
  open,
  onClose,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  onPosted?: () => void;
}) {
  const { post } = useJournal();

  const [decisions, setDecisions] = React.useState<Record<string, Decision>>({});
  const [payments, setPayments] = React.useState<Record<string, number>>({});

  const [vendorId, setVendorId] = React.useState("");
  const [date, setDate] = React.useState(todayIso());
  const [bankAccount, setBankAccount] = React.useState("1020");
  const [tdsRate, setTdsRate] = React.useState(0);
  const [alloc, setAlloc] = React.useState<Record<string, string>>({});
  const [errors, setErrors] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (!open) return;
    setDecisions(loadDecisions());
    setPayments(loadPoPayments());
    setVendorId("");
    setAlloc({});
    setTdsRate(0);
    setDate(todayIso());
    setErrors([]);
  }, [open]);

  // Outstanding bills grouped by vendor: billed POs not historically paid, not
  // rejected, with a remaining balance.
  const billsByVendor = React.useMemo(() => {
    const map = new Map<string, BillRow[]>();
    for (const po of PURCHASE_ORDERS) {
      if (!po.invoice || po.status === "paid") continue;
      if (decisions[invoiceApprovalId(po.id)] === "rejected") continue;
      const outstanding = poOutstanding(po, payments);
      if (outstanding <= 0) continue;
      const arr = map.get(po.vendorId) ?? [];
      arr.push({ po, outstanding });
      map.set(po.vendorId, arr);
    }
    return map;
  }, [decisions, payments]);

  const vendors = VENDORS.filter((v) => (billsByVendor.get(v.id)?.length ?? 0) > 0).sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const rows = vendorId ? billsByVendor.get(vendorId) ?? [] : [];

  const allocFor = (id: string) => Math.max(0, Number(alloc[id]) || 0);
  const totalAllocated = round2(rows.reduce((s, r) => s + allocFor(r.po.id), 0));
  const tdsAmount = round2((totalAllocated * tdsRate) / 100);
  const netFromBank = round2(totalAllocated - tdsAmount);
  const overAllocated = rows.some((r) => allocFor(r.po.id) > r.outstanding + 0.5);

  function selectVendor(id: string) {
    setVendorId(id);
    setAlloc({});
    setErrors([]);
  }
  const setLine = (id: string, value: string) => setAlloc((prev) => ({ ...prev, [id]: value }));
  const fillFull = (r: BillRow) => setLine(r.po.id, String(r.outstanding));
  const allocateAll = () => setAlloc(Object.fromEntries(rows.map((r) => [r.po.id, String(r.outstanding)])));
  const clearAll = () => setAlloc({});

  function handlePost() {
    const errs: string[] = [];
    if (!vendorId) errs.push("Select a vendor.");
    if (totalAllocated <= 0) errs.push("Allocate the payment to at least one bill.");
    if (overAllocated) errs.push("An allocation exceeds the bill's outstanding amount.");
    if (errs.length) {
      setErrors(errs);
      return;
    }

    const paidRows = rows.filter((r) => allocFor(r.po.id) > 0);
    const first = paidRows[0].po;
    const refs = paidRows.map((r) => r.po.invoice!.number).join(", ");

    const lines: ManualEntryLine[] = [{ accountCode: AP, debit: totalAllocated, credit: 0 }];
    if (tdsAmount > 0) lines.push({ accountCode: TDS_PAYABLE, debit: 0, credit: tdsAmount });
    lines.push({ accountCode: bankAccount, debit: 0, credit: netFromBank });

    const draft: EntryDraft = {
      type: "payment",
      date,
      narration: `Payment to ${vendorById(vendorId)?.name ?? "vendor"} — settles ${refs}`,
      entityId: first.entityId,
      locationId: first.locationId,
      currency: "INR",
      basis: "accrual",
      lines,
    };
    const result = post(draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }

    // Record per-bill payments; mark fully-paid bills approved so the SPOC queue
    // and the vendor list reflect the settlement.
    const nextPayments = { ...payments };
    const nextDecisions = { ...decisions };
    for (const r of paidRows) {
      const paid = (nextPayments[r.po.id] ?? 0) + allocFor(r.po.id);
      nextPayments[r.po.id] = paid;
      if (paid >= (r.po.invoice?.amount ?? 0) - 0.5) {
        nextDecisions[invoiceApprovalId(r.po.id)] = "approved";
      }
    }
    savePoPayments(nextPayments);
    saveDecisions(nextDecisions);
    setPayments(nextPayments);
    setDecisions(nextDecisions);

    onPosted?.();
    onClose();
  }

  const vendor = vendorId ? vendorById(vendorId) : undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      className="max-w-3xl"
      title={
        <span className="flex items-center gap-2">
          <Banknote className="size-4" /> Pay Bills
        </span>
      }
      description="Select a vendor, then allocate the payment across their outstanding bills."
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
            Post payment
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="col-span-2">
            <Label htmlFor="pb-vendor">Vendor</Label>
            <Select id="pb-vendor" value={vendorId} onChange={(e) => selectVendor(e.target.value)} className="mt-1">
              <option value="">Select vendor…</option>
              {vendors.map((v) => {
                const due = (billsByVendor.get(v.id) ?? []).reduce((s, r) => s + r.outstanding, 0);
                return (
                  <option key={v.id} value={v.id}>
                    {v.name} — ₹{due.toLocaleString("en-IN")} due
                  </option>
                );
              })}
            </Select>
          </div>
          <div>
            <Label htmlFor="pb-date">Date</Label>
            <Input id="pb-date" type="date" value={date} max={todayIso()} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="pb-bank">From</Label>
            <Select id="pb-bank" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} className="mt-1">
              {cashAccounts.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {vendorId && rows.length === 0 && (
          <p className="rounded-lg border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
            No outstanding bills for {vendor?.name}.
          </p>
        )}

        {rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border">
            <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2 text-xs">
              <span className="font-medium uppercase tracking-wide text-muted-foreground">
                {rows.length} outstanding bill{rows.length === 1 ? "" : "s"}
              </span>
              <span className="flex gap-3">
                <button onClick={allocateAll} className="font-medium text-primary hover:underline">Allocate all</button>
                <button onClick={clearAll} className="text-muted-foreground hover:underline">Clear</button>
              </span>
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20 text-left text-xs text-muted-foreground">
                  <th className="px-4 py-2 font-medium">Bill</th>
                  <th className="px-4 py-2 font-medium">PO</th>
                  <th className="px-4 py-2 text-right font-medium">Outstanding</th>
                  <th className="px-4 py-2 text-right font-medium">Settle (cash + TDS)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const a = allocFor(r.po.id);
                  const over = a > r.outstanding + 0.5;
                  const rowTds = round2((a * tdsRate) / 100);
                  return (
                    <tr key={r.po.id} className="border-b border-border/40 last:border-0">
                      <td className="px-4 py-2">
                        <p className="font-mono text-xs font-semibold">{r.po.invoice!.number}</p>
                        <p className="text-[11px] text-muted-foreground">{formatDate(r.po.invoice!.date)}</p>
                      </td>
                      <td className="px-4 py-2">
                        <p className="text-xs">{r.po.id}</p>
                        <p className="text-[11px] text-muted-foreground">{entityById(r.po.entityId)?.name}</p>
                      </td>
                      <td className="px-4 py-2 text-right tabular">
                        <Money value={r.outstanding} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex items-center justify-end gap-1.5">
                          <Input
                            type="number"
                            min={0}
                            value={alloc[r.po.id] ?? ""}
                            onChange={(e) => setLine(r.po.id, e.target.value)}
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
              <Label htmlFor="pb-tds">TDS deducted at source</Label>
              <Select id="pb-tds" value={tdsRate} onChange={(e) => setTdsRate(Number(e.target.value))} className="mt-1">
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
                <div className="flex justify-between text-muted-foreground"><span>Less TDS payable</span><Money value={-tdsAmount} /></div>
              )}
              <div className="mt-1 flex justify-between border-t pt-1 font-semibold"><span>Net from bank</span><Money value={netFromBank} /></div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                Cash + TDS settles each bill in full. The TDS is booked to TDS Payable — deposit it via challan in GST &amp; TDS.
              </p>
            </div>
          </div>
        )}

        {errors.length > 0 && (
          <div className="rounded-lg border border-danger/40 bg-danger/8 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-danger">
              <AlertTriangle className="size-4" /> Payment not posted
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
