"use client";

import * as React from "react";
import { Banknote, FileDown, X, Check, Layers, Wallet } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { Input, Label, Select } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { ENTITIES } from "@/lib/accounting/org";
import { entityBank } from "@/lib/invoicing";
import { loadPoPayments } from "@/lib/vendors";
import {
  payableBillsForEntity,
  buildRun,
  buildBankFile,
  bankFileName,
  processRun,
  loadPaymentRuns,
  type PayableBill,
  type PaymentRun,
  type PayMode,
} from "@/lib/finance/payments";

const TODAY = "2026-06-18";
const REMITTERS = ENTITIES.filter((e) => e.country === "India");

const MODE_TONE: Record<PayMode, "primary" | "warning" | "default"> = {
  RTGS: "primary",
  NEFT: "default",
  IMPS: "warning",
};

export function PaymentsClient() {
  const [entityId, setEntityId] = React.useState(REMITTERS[0]?.id ?? "");
  const [selected, setSelected] = React.useState<Set<string>>(new Set());
  const [valueDate, setValueDate] = React.useState(TODAY);
  const [paymentsTick, setPaymentsTick] = React.useState(0); // bumps after a run settles
  const [runs, setRuns] = React.useState<PaymentRun[]>([]);
  const [preview, setPreview] = React.useState<{ run: PaymentRun; file: string } | null>(null);
  const [processedId, setProcessedId] = React.useState<string | null>(null);

  React.useEffect(() => {
    setRuns(loadPaymentRuns());
  }, []);

  // Recompute payable bills whenever the entity changes or a run settles.
  const bills = React.useMemo<PayableBill[]>(
    () => payableBillsForEntity(entityId, loadPoPayments()),
    [entityId, paymentsTick],
  );

  // Drop any selection that's no longer payable (e.g. after switching entity).
  React.useEffect(() => {
    setSelected((prev) => {
      const live = new Set(bills.map((b) => b.poId));
      const next = new Set([...prev].filter((id) => live.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [bills]);

  const selectedBills = bills.filter((b) => selected.has(b.poId));
  const selectedTotal = selectedBills.reduce((s, b) => s + b.amount, 0);
  const payableTotal = bills.reduce((s, b) => s + b.amount, 0);
  const allSelected = bills.length > 0 && selected.size === bills.length;

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(bills.map((b) => b.poId)));
  }

  const draftRun = selectedBills.length > 0 ? buildRun(entityId, valueDate, selectedBills) : null;

  function generateFile() {
    if (!draftRun) return;
    const file = buildBankFile(draftRun);
    // Trigger a client-side download (Blob + anchor).
    try {
      const blob = new Blob([file], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = bankFileName(draftRun);
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* ignore — preview still shown */
    }
    setPreview({ run: draftRun, file });
  }

  function process(run: PaymentRun) {
    const saved = processRun(run);
    setRuns(saved);
    setProcessedId(run.id);
    setSelected(new Set());
    setPreview(null);
    setPaymentsTick((t) => t + 1);
  }

  const bank = entityBank(entityId);

  return (
    <>
      <PageHeader
        title="Payment Runs"
        subtitle="Batch approved vendor bills into a single NEFT/RTGS bulk disbursement and generate the bank-upload file."
      />

      {/* Remitter */}
      <Card className="mb-4 p-4">
        <div className="grid gap-3 sm:grid-cols-[260px_1fr] sm:items-end">
          <div>
            <Label>Remitting entity (debit account)</Label>
            <Select
              value={entityId}
              onChange={(e) => setEntityId(e.target.value)}
              className="mt-1"
            >
              {REMITTERS.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            <Wallet className="size-4 shrink-0" />
            <span className="font-medium text-foreground">Remit from:</span> {bank || "—"}
          </div>
        </div>
      </Card>

      {/* Summary cards */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Summary label="Bills payable" plain={String(bills.length)} />
        <Summary label="Total payable" value={payableTotal} />
        <Summary label="Selected" plain={String(selectedBills.length)} />
        <Summary label="Selected total" value={selectedTotal} highlight />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        {/* Payable bills table */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-3">
                    <input
                      type="checkbox"
                      aria-label="Select all"
                      checked={allSelected}
                      onChange={toggleAll}
                      disabled={bills.length === 0}
                    />
                  </th>
                  <th className="px-4 py-3 font-medium">Vendor</th>
                  <th className="px-4 py-3 font-medium">Bill no</th>
                  <th className="px-4 py-3 font-medium">Bill date</th>
                  <th className="px-4 py-3 text-right font-medium">Amount</th>
                  <th className="px-4 py-3 font-medium">Mode</th>
                  <th className="px-4 py-3 font-medium">Beneficiary</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((b) => {
                  const on = selected.has(b.poId);
                  return (
                    <tr
                      key={b.poId}
                      onClick={() => toggle(b.poId)}
                      className={cn(
                        "cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50",
                        on && "bg-primary/5",
                      )}
                    >
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input type="checkbox" checked={on} onChange={() => toggle(b.poId)} aria-label={`Select ${b.billNo}`} />
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium">{b.vendor}</div>
                        <div className="text-xs text-muted-foreground">{b.vendorGstin}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{b.billNo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{formatDate(b.billDate)}</td>
                      <td className="px-4 py-3 text-right font-semibold tabular"><Money value={b.amount} /></td>
                      <td className="px-4 py-3"><Badge variant={MODE_TONE[b.mode]}>{b.mode}</Badge></td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                        {b.beneficiaryAccount} · {b.beneficiaryIfsc}
                      </td>
                    </tr>
                  );
                })}
                {bills.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-sm text-muted-foreground">
                      No outstanding bills for this entity. All vendor bills are settled.
                    </td>
                  </tr>
                )}
              </tbody>
              {bills.length > 0 && (
                <tfoot>
                  <tr className="border-t bg-muted/30 text-xs">
                    <td />
                    <td className="px-4 py-2.5 font-medium text-muted-foreground" colSpan={3}>
                      {selectedBills.length} of {bills.length} selected
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular"><Money value={selectedTotal} /></td>
                    <td colSpan={2} />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </Card>

        {/* Build run panel */}
        <div className="space-y-4">
          <Card className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Layers className="size-4 text-primary" /> Build payment run
            </div>

            <Label htmlFor="value-date">Value date</Label>
            <Input
              id="value-date"
              type="date"
              value={valueDate}
              onChange={(e) => setValueDate(e.target.value)}
              className="mt-1 mb-3"
            />

            <div className="space-y-1.5 border-t pt-3 text-sm">
              <Row label="Bills in run" value={String(selectedBills.length)} />
              <Row label="Total to remit" money={selectedTotal} bold />
            </div>

            {draftRun && (
              <div className="mt-3 border-t pt-3">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Mode breakdown</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(draftRun.modeMix) as PayMode[])
                    .filter((m) => draftRun.modeMix[m] > 0)
                    .map((m) => (
                      <Badge key={m} variant={MODE_TONE[m]}>{m} × {draftRun.modeMix[m]}</Badge>
                    ))}
                </div>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">Ref: {draftRun.id}</p>
              </div>
            )}

            <Button
              className="mt-4 w-full"
              disabled={!draftRun}
              onClick={generateFile}
            >
              <FileDown className="size-4" /> Generate bank file
            </Button>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Downloads a NEFT/RTGS bulk CSV and shows a preview.
            </p>
          </Card>

          {processedId && (
            <Card className="border-success/30 bg-success/5 p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-success">
                <Check className="size-4" /> Run {processedId} processed
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Selected bills marked paid. The bank file has been disbursed.
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* Past runs */}
      <Card className="mt-4 overflow-hidden">
        <div className="border-b bg-muted/40 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Past payment runs
        </div>
        {runs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted-foreground">No payment runs processed yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Run</th>
                <th className="px-5 py-3 font-medium">Value date</th>
                <th className="px-5 py-3 text-right font-medium">Bills</th>
                <th className="px-5 py-3 text-right font-medium">Total</th>
                <th className="px-5 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                  <td className="px-5 py-3 font-mono text-xs">{r.id}</td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(r.valueDate)}</td>
                  <td className="px-5 py-3 text-right tabular">{r.count}</td>
                  <td className="px-5 py-3 text-right font-semibold tabular"><Money value={r.total} /></td>
                  <td className="px-5 py-3">
                    <Badge variant="success"><Check className="size-3" /> Processed</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {preview && (
        <FilePreviewModal
          run={preview.run}
          file={preview.file}
          onClose={() => setPreview(null)}
          onProcess={() => process(preview.run)}
        />
      )}
    </>
  );
}

function FilePreviewModal({
  run,
  file,
  onClose,
  onProcess,
}: {
  run: PaymentRun;
  file: string;
  onClose: () => void;
  onProcess: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="flex max-h-[85vh] w-full max-w-2xl flex-col p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between border-b pb-3">
          <div>
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-primary">
              <Banknote className="size-3.5" /> Bank-upload file
            </p>
            <h3 className="mt-0.5 font-semibold">{bankFileName(run)}</h3>
            <p className="text-xs text-muted-foreground">
              {run.count} beneficiar{run.count === 1 ? "y" : "ies"} · <Money value={run.total} /> · value {formatDate(run.valueDate)}
            </p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <pre className="mt-3 flex-1 overflow-auto rounded-md border bg-muted/40 p-3 font-mono text-xs leading-relaxed scrollbar-thin">
          {file}
        </pre>

        <div className="mt-4 flex items-center justify-end gap-2 border-t pt-3">
          <Button variant="outline" onClick={onClose}>Close</Button>
          <Button onClick={onProcess}><Check className="size-4" /> Process run</Button>
        </div>
      </Card>
    </div>
  );
}

function Summary({ label, value, plain, highlight }: { label: string; value?: number; plain?: string; highlight?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-3", highlight && "border-primary/30 bg-primary/5")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular">{plain ?? <Money value={value ?? 0} />}</p>
    </div>
  );
}

function Row({ label, value, money, bold }: { label: string; value?: string; money?: number; bold?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between", bold && "font-semibold")}>
      <span className={bold ? "" : "text-muted-foreground"}>{label}</span>
      <span className="tabular">{money !== undefined ? <Money value={money} /> : value}</span>
    </div>
  );
}
