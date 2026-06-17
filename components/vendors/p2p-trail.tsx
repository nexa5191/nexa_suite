"use client";

import * as React from "react";
import { Package, FileText, Banknote, Check, ClipboardList, ArrowRight, Building2, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { useJournal } from "@/components/accounting/journal-provider";
import { CHART_OF_ACCOUNTS } from "@/lib/accounting/chart-of-accounts";
import { entityById, locationById } from "@/lib/accounting/org";
import { loadDecisions, saveDecisions, type Decision } from "@/lib/hr/approvals";
import { cn, formatDate } from "@/lib/utils";
import {
  vendorById,
  invoiceApprovalId,
  loadPoPayments,
  savePoPayments,
  type PurchaseOrder,
} from "@/lib/vendors";
import { loadCreatedAssets, saveCreatedAssets } from "@/lib/assets/assets";
import {
  itemById,
  altUomOf,
  toBaseQty,
  loadUomOverrides,
  type AltUom,
} from "@/lib/inventory/items";
import { appendMovements } from "@/lib/inventory/movements";
import type { Movement } from "@/lib/inventory/types";
import {
  loadP2P,
  saveP2P,
  buildGrnDraft,
  buildInvoiceDraft,
  buildAssetFromPo,
  splitInclusive,
  grnDebitAccount,
  isCapex,
  p2pStage,
  isSeedBill,
  STAGE_ORDER,
  STAGE_META,
  type P2PEntry,
  type P2PStage,
} from "@/lib/p2p";
import type { EntryDraft } from "@/lib/accounting/manual-entries";

const accountName = (code: string) => CHART_OF_ACCOUNTS.find((a) => a.code === code)?.name ?? code;
const cashAccounts = CHART_OF_ACCOUNTS.filter((a) => a.isCash);
const todayIso = () => new Date().toISOString().slice(0, 10);
const GST_RATES = [0, 5, 12, 18, 28];

const STEP_ICON: Record<P2PStage, React.ComponentType<{ className?: string }>> = {
  ordered: ClipboardList,
  received: Package,
  invoiced: FileText,
  paid: Banknote,
};

/**
 * Procure-to-Pay trail for a single PO. Walks the 3-way match (GRN → invoice →
 * payment), posting a real voucher at each step and persisting the trail state.
 */
export function P2PTrail({
  po,
  onClose,
  onChanged,
}: {
  po: PurchaseOrder | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { post } = useJournal();
  const [state, setState] = React.useState<P2PEntry>({});
  const [paid, setPaid] = React.useState(0);
  const [errors, setErrors] = React.useState<string[]>([]);

  // step inputs
  const [grnDate, setGrnDate] = React.useState(todayIso());
  const [invDate, setInvDate] = React.useState(todayIso());
  const [billNo, setBillNo] = React.useState("");
  const [gstRate, setGstRate] = React.useState(18);
  const [payDate, setPayDate] = React.useState(todayIso());
  const [bank, setBank] = React.useState("1020");
  // GRN receipt: per PO line, the receive basis (base vs case) + quantity.
  const [receipt, setReceipt] = React.useState<{ basis: "base" | "alt"; qty: number }[]>([]);
  const [uomOv, setUomOv] = React.useState<Record<string, AltUom | null>>({});

  React.useEffect(() => {
    if (!po) return;
    const st = loadP2P()[po.id] ?? {};
    setState(st);
    setPaid(loadPoPayments()[po.id] ?? 0);
    setGrnDate(todayIso());
    setInvDate(todayIso());
    setBillNo(po.invoice?.number ?? `BILL/${po.id}`);
    setGstRate(18);
    setPayDate(todayIso());
    setBank("1020");
    setReceipt(po.lines.map((l) => ({ basis: "base" as const, qty: l.qty })));
    setUomOv(loadUomOverrides());
    setErrors([]);
  }, [po]);

  if (!po) return null;
  const vendor = vendorById(po.vendorId);
  const capex = isCapex(vendor);
  const seedBill = isSeedBill(po, state);
  const stage = p2pStage(po, state, paid);
  const stageIdx = STAGE_ORDER.indexOf(stage);

  const billAmount = state.invoice?.gross ?? po.invoice?.amount ?? po.total;
  const outstanding = Math.max(0, Math.round(billAmount - paid));

  function persist(next: P2PEntry) {
    const store = loadP2P();
    store[po!.id] = next;
    saveP2P(store);
    setState(next);
  }

  function tryPost(draft: EntryDraft): string | null {
    const res = post(draft);
    if (!res.ok) {
      setErrors(res.errors);
      return null;
    }
    return res.entry.voucherNo;
  }

  // The base-unit quantity a PO line will receive into stock (after conversion).
  function lineBaseQty(i: number): number {
    const l = po!.lines[i];
    if (!l?.itemId) return 0;
    const item = itemById(l.itemId);
    if (!item) return 0;
    const alt = altUomOf(item, uomOv);
    const r = receipt[i] ?? { basis: "base", qty: l.qty };
    return toBaseQty(r.qty, r.basis, alt);
  }

  const setReceiptBasis = (i: number, basis: "base" | "alt") =>
    setReceipt((prev) => prev.map((r, idx) => (idx === i ? { ...r, basis } : r)));
  const setReceiptQty = (i: number, qty: number) =>
    setReceipt((prev) => prev.map((r, idx) => (idx === i ? { ...r, qty: Math.max(0, qty) } : r)));

  // --- step 2: GRN ---------------------------------------------------------
  function postGrn() {
    setErrors([]);
    const { taxable } = splitInclusive(po!.total, gstRate);
    const voucherNo = tryPost(buildGrnDraft(po!, vendor, grnDate, taxable));
    if (!voucherNo) return;
    // Receive stock for any PO line linked to an item — always in base units.
    const moves: Movement[] = [];
    po!.lines.forEach((l, i) => {
      if (!l.itemId) return;
      const item = itemById(l.itemId);
      const baseQty = lineBaseQty(i);
      if (!item || baseQty <= 0) return;
      const r = receipt[i];
      const alt = altUomOf(item, uomOv);
      moves.push({
        id: `${po!.id}-grn-${i}`,
        date: grnDate,
        itemId: l.itemId,
        locationId: po!.locationId,
        type: "receipt",
        qty: baseQty,
        ref: po!.id,
        note: `GRN ${po!.id} — ${vendor?.name ?? "vendor"}${r?.basis === "alt" && alt ? ` · ${r.qty} ${alt.unit} × ${alt.pack}` : ""}`,
      });
    });
    if (moves.length) appendMovements(moves);
    const grn: NonNullable<P2PEntry["grn"]> = {
      date: grnDate,
      voucherNo,
      account: grnDebitAccount(vendor),
      taxable,
    };
    // Capex receipt capitalises a fixed asset (an addition to the register).
    if (capex) {
      const created = loadCreatedAssets();
      const asset = buildAssetFromPo(po!, vendor, grnDate, taxable, created);
      saveCreatedAssets([...created, asset]);
      grn.assetId = asset.id;
      grn.assetTag = asset.tag;
    }
    persist({ ...state, grn });
    onChanged();
  }

  // --- step 3: invoice booking --------------------------------------------
  function bookInvoice() {
    setErrors([]);
    if (!billNo.trim()) {
      setErrors(["Enter the vendor bill number."]);
      return;
    }
    const { taxable, gst, gross } = splitInclusive(po!.total, gstRate);
    const voucherNo = tryPost(buildInvoiceDraft(po!, vendor, invDate, billNo.trim(), taxable, gst));
    if (!voucherNo) return;
    persist({
      ...state,
      invoice: { date: invDate, voucherNo, number: billNo.trim(), rate: gstRate, taxable, gst, gross },
    });
    onChanged();
  }

  // --- step 4: payment -----------------------------------------------------
  function payNow() {
    setErrors([]);
    const draft: EntryDraft = {
      type: "payment",
      date: payDate,
      narration: `Payment to ${vendor?.name ?? "vendor"} — settles ${state.invoice?.number ?? po!.invoice?.number ?? po!.id}`,
      entityId: po!.entityId,
      locationId: po!.locationId,
      currency: "INR",
      basis: "accrual",
      lines: [
        { accountCode: "2010", debit: outstanding, credit: 0 },
        { accountCode: bank, debit: 0, credit: outstanding },
      ],
    };
    if (!tryPost(draft)) return;
    const payments = loadPoPayments();
    payments[po!.id] = (payments[po!.id] ?? 0) + outstanding;
    savePoPayments(payments);
    const decisions: Record<string, Decision> = loadDecisions();
    decisions[invoiceApprovalId(po!.id)] = "approved";
    saveDecisions(decisions);
    setPaid(payments[po!.id]);
    onChanged();
  }

  const preview = splitInclusive(po.total, gstRate);

  return (
    <Modal
      open={!!po}
      onClose={onClose}
      className="max-w-2xl"
      title={
        <span className="flex items-center gap-2">
          <ArrowRight className="size-4" /> Procure-to-Pay · {po.id}
        </span>
      }
      description={`${vendor?.name ?? "Vendor"} — ${po.title}`}
      footer={
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
      }
    >
      <div className="space-y-4">
        {/* context strip */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border bg-muted/30 px-4 py-2.5 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Building2 className="size-3.5" /> {entityById(po.entityId)?.name} · {locationById(po.locationId)?.name}
          </span>
          <span>PO value <Money value={po.total} className="font-semibold text-foreground" /></span>
          {capex && <Badge variant="primary" className="text-[10px]">Capex — capitalises an asset</Badge>}
          {seedBill && <Badge variant="default" className="text-[10px]">Pre-GL seed bill</Badge>}
        </div>

        {/* stepper */}
        <ol className="space-y-3">
          {STAGE_ORDER.map((s, i) => {
            const Icon = STEP_ICON[s];
            // `stage` is the last milestone reached; the next step is the action
            // to take (a freshly-ordered PO → "Goods received" is actionable).
            const done = stage === "paid" || i <= stageIdx;
            const active = stage !== "paid" && i === stageIdx + 1;
            return (
              <li key={s} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "flex size-8 shrink-0 items-center justify-center rounded-full border",
                      done ? "border-success bg-success/15 text-success" : active ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground",
                    )}
                  >
                    {done ? <Check className="size-4" /> : <Icon className="size-4" />}
                  </span>
                  {i < STAGE_ORDER.length - 1 && <span className={cn("mt-1 w-px flex-1", done ? "bg-success/40" : "bg-border")} />}
                </div>
                <div className="flex-1 pb-1">
                  <div className="flex items-center gap-2">
                    <p className={cn("text-sm font-semibold", active && "text-primary")}>{STAGE_META[s].label}</p>
                    {done && <Badge variant="success" className="text-[10px]">Done</Badge>}
                    {active && <Badge variant="warning" className="text-[10px]">Next</Badge>}
                  </div>
                  <StepBody
                    s={s}
                    po={po}
                    state={state}
                    seedBill={seedBill}
                    capex={capex}
                    active={active}
                    done={done}
                    outstanding={outstanding}
                    grnDate={grnDate} setGrnDate={setGrnDate}
                    invDate={invDate} setInvDate={setInvDate}
                    billNo={billNo} setBillNo={setBillNo}
                    gstRate={gstRate} setGstRate={setGstRate}
                    preview={preview}
                    payDate={payDate} setPayDate={setPayDate}
                    bank={bank} setBank={setBank}
                    receipt={receipt} uomOv={uomOv}
                    onReceiptBasis={setReceiptBasis} onReceiptQty={setReceiptQty}
                    onGrn={postGrn} onInvoice={bookInvoice} onPay={payNow}
                  />
                </div>
              </li>
            );
          })}
        </ol>

        {errors.length > 0 && (
          <div className="rounded-lg border border-danger/40 bg-danger/8 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-danger">
              <AlertTriangle className="size-4" /> Could not post
            </p>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-sm text-danger/90">
              {errors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}

function StepBody(props: {
  s: P2PStage;
  po: PurchaseOrder;
  state: P2PEntry;
  seedBill: boolean;
  capex: boolean;
  active: boolean;
  done: boolean;
  outstanding: number;
  grnDate: string; setGrnDate: (v: string) => void;
  invDate: string; setInvDate: (v: string) => void;
  billNo: string; setBillNo: (v: string) => void;
  gstRate: number; setGstRate: (v: number) => void;
  preview: { taxable: number; gst: number; gross: number };
  payDate: string; setPayDate: (v: string) => void;
  bank: string; setBank: (v: string) => void;
  receipt: { basis: "base" | "alt"; qty: number }[];
  uomOv: Record<string, AltUom | null>;
  onReceiptBasis: (i: number, basis: "base" | "alt") => void;
  onReceiptQty: (i: number, qty: number) => void;
  onGrn: () => void; onInvoice: () => void; onPay: () => void;
}) {
  const { s, po, state, active, preview } = props;

  // ---- completed-step summaries ----
  if (s === "ordered") {
    return <p className="mt-0.5 text-xs text-muted-foreground">Raised {formatDate(po.date)} · {po.lines.length} line item{po.lines.length === 1 ? "" : "s"}</p>;
  }
  if (s === "received" && state.grn) {
    return (
      <p className="mt-0.5 text-xs text-muted-foreground">
        Receipted {formatDate(state.grn.date)} · {state.grn.voucherNo} · Dr {accountName(state.grn.account)} <Money value={state.grn.taxable} />
        {state.grn.assetTag && <> · asset <span className="font-mono">{state.grn.assetTag}</span></>}
      </p>
    );
  }
  if (s === "received" && props.seedBill) {
    return <p className="mt-0.5 text-xs text-muted-foreground">Goods receipted before the GL trail (seed).</p>;
  }
  if (s === "invoiced" && state.invoice) {
    const iv = state.invoice;
    return (
      <p className="mt-0.5 text-xs text-muted-foreground">
        Bill {iv.number} · {iv.voucherNo} · taxable <Money value={iv.taxable} /> + GST{iv.rate}% <Money value={iv.gst} /> = <Money value={iv.gross} className="font-medium text-foreground" />
      </p>
    );
  }
  if (s === "invoiced" && props.seedBill && po.invoice) {
    return <p className="mt-0.5 text-xs text-muted-foreground">Seed bill {po.invoice.number} · <Money value={po.invoice.amount} /> (not booked to GL)</p>;
  }
  if (s === "paid" && props.done) {
    return <p className="mt-0.5 text-xs text-muted-foreground">Settled in full.</p>;
  }

  if (!active) return null;

  // ---- active-step action panels ----
  if (s === "received") {
    const stockable = po.lines.some((l) => l.itemId);
    return (
      <div className="mt-2 rounded-lg border bg-card p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Receipt date">
            <Input type="date" value={props.grnDate} max={todayIso()} onChange={(e) => props.setGrnDate(e.target.value)} className="h-8" />
          </Field>
          <Field label="GST rate (for ex-GST value)">
            <Select value={props.gstRate} onChange={(e) => props.setGstRate(Number(e.target.value))} className="h-8">
              {GST_RATES.map((r) => <option key={r} value={r}>{r === 0 ? "Nil / exempt" : `${r}%`}</option>)}
            </Select>
          </Field>
        </div>

        {/* Goods receipt — receive each stock line in its base unit or by case. */}
        {stockable && (
          <div className="mt-3 overflow-hidden rounded-md border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                  <th className="px-2.5 py-1.5 font-medium">Line</th>
                  <th className="px-2 py-1.5 font-medium">Receive in</th>
                  <th className="w-20 px-2 py-1.5 text-right font-medium">Qty</th>
                  <th className="px-2.5 py-1.5 text-right font-medium">Into stock</th>
                </tr>
              </thead>
              <tbody>
                {po.lines.map((l, i) => {
                  const item = l.itemId ? itemById(l.itemId) : undefined;
                  const alt = item ? altUomOf(item, props.uomOv) : null;
                  const r = props.receipt[i] ?? { basis: "base" as const, qty: l.qty };
                  const baseQty = item ? toBaseQty(r.qty, r.basis, alt) : 0;
                  return (
                    <tr key={i} className="border-b border-border/40 last:border-0">
                      <td className="px-2.5 py-1.5">
                        {l.item}
                        {!item && <span className="ml-1 text-[10px] text-muted-foreground">· non-stock</span>}
                      </td>
                      <td className="px-2 py-1.5">
                        {!item ? (
                          <span className="text-muted-foreground">—</span>
                        ) : alt ? (
                          <div className="inline-flex overflow-hidden rounded-md border">
                            {(["base", "alt"] as const).map((b) => (
                              <button
                                key={b}
                                onClick={() => props.onReceiptBasis(i, b)}
                                className={cn(
                                  "px-2 py-0.5 text-[11px] transition-colors",
                                  r.basis === b ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                                )}
                              >
                                {b === "base" ? item.uom : alt.unit}
                              </button>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">{item.uom}</span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {item ? (
                          <Input
                            type="number"
                            min={0}
                            value={r.qty}
                            onChange={(e) => props.onReceiptQty(i, Number(e.target.value))}
                            className="h-7 px-1.5 text-right text-xs tabular"
                          />
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-2.5 py-1.5 text-right tabular">
                        {item ? (
                          <>
                            <span className="font-medium">{Math.round(baseQty).toLocaleString("en-IN")}</span>{" "}
                            <span className="text-muted-foreground">{item.uom}</span>
                            {alt && r.basis === "alt" && (
                              <span className="ml-1 text-[10px] text-muted-foreground">({r.qty}×{alt.pack})</span>
                            )}
                          </>
                        ) : (
                          <span className="text-muted-foreground">no stock</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-2 text-[11px] text-muted-foreground">
          Posts <span className="font-medium text-foreground">Dr {accountName(grnDebitAccountLabel(po))} {money(preview.taxable)}</span> / Cr GRNI clearing
          {stockable && <> · receives stock in base units</>}.
          {props.capex && " A fixed asset is added to the register."}
        </p>
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={props.onGrn}><Package className="size-3.5" /> Post GRN</Button>
        </div>
      </div>
    );
  }
  if (s === "invoiced") {
    return (
      <div className="mt-2 rounded-lg border bg-card p-3">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="Bill number">
            <Input value={props.billNo} onChange={(e) => props.setBillNo(e.target.value)} className="h-8" />
          </Field>
          <Field label="Bill date">
            <Input type="date" value={props.invDate} max={todayIso()} onChange={(e) => props.setInvDate(e.target.value)} className="h-8" />
          </Field>
          <Field label="GST rate">
            <Select value={props.gstRate} onChange={(e) => props.setGstRate(Number(e.target.value))} className="h-8">
              {GST_RATES.map((r) => <option key={r} value={r}>{r === 0 ? "Nil / exempt" : `${r}%`}</option>)}
            </Select>
          </Field>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Dr GRNI {money(preview.taxable)} + Dr GST Input {money(preview.gst)} / Cr Accounts Payable <span className="font-medium text-foreground">{money(preview.gross)}</span>.
        </p>
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={props.onInvoice}><FileText className="size-3.5" /> Book invoice</Button>
        </div>
      </div>
    );
  }
  if (s === "paid") {
    return (
      <div className="mt-2 rounded-lg border bg-card p-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Payment date">
            <Input type="date" value={props.payDate} max={todayIso()} onChange={(e) => props.setPayDate(e.target.value)} className="h-8" />
          </Field>
          <Field label="From account">
            <Select value={props.bank} onChange={(e) => props.setBank(e.target.value)} className="h-8">
              {cashAccounts.map((a) => <option key={a.code} value={a.code}>{a.name}</option>)}
            </Select>
          </Field>
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Outstanding <span className="font-medium text-foreground">{money(props.outstanding)}</span> — Dr Accounts Payable / Cr bank. For part-pay or TDS, use Pay Bills.
        </p>
        <div className="mt-2 flex justify-end">
          <Button size="sm" onClick={props.onPay}><Banknote className="size-3.5" /> Pay in full</Button>
        </div>
      </div>
    );
  }
  return null;
}

// small local helpers (kept out of the lib to avoid JSX deps)
function grnDebitAccountLabel(po: PurchaseOrder): string {
  return grnDebitAccount(vendorById(po.vendorId));
}
function money(n: number) {
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
