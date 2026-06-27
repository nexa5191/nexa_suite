"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Trash2, AlertTriangle, Scale, RefreshCw, FileText, ChevronDown, Search } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { useJournal } from "@/components/accounting/journal-provider";
import { cn } from "@/lib/utils";
import { CHART_OF_ACCOUNTS, accountSafe } from "@/lib/accounting/chart-of-accounts";
import { ENTITIES, ALL, locationsForEntity } from "@/lib/accounting/org";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { partiesByKind } from "@/lib/accounting/parties";
import {
  type EntryBasis,
  type EntryDraft,
  type GuidedInput,
  type ManualEntryLine,
  type VoucherType,
  BOOKS_OPENING,
  VOUCHER_TYPES,
  voucherType,
  buildGuidedLines,
  currencyForEntity,
  defaultGuidedInput,
  entryTotals,
  nextVoucherNo,
} from "@/lib/accounting/manual-entries";
import type { Account } from "@/lib/accounting/types";
import {
  type Invoice,
  allInvoices,
  loadCreatedInvoices,
  gstTreatment,
} from "@/lib/invoicing";
import { accountById } from "@/lib/crm";

interface DraftLine {
  accountCode: string;
  debit: string;
  credit: string;
  text: string;
}
const blankLine = (): DraftLine => ({ accountCode: "", debit: "", credit: "", text: "" });
const todayIso = () => new Date().toISOString().slice(0, 10);

const GST_RATES = [0, 5, 12, 18, 28];
// Common TDS rates by section: 194C 1/2%, 194J 10%, 194I 10%, 194Q 0.1%, 194H 5%.
const TDS_RATES = [0, 0.1, 1, 2, 5, 10];
const cashAccounts = CHART_OF_ACCOUNTS.filter((a) => a.isCash);

/** Searchable invoice combobox — filter by number, customer or date. */
function InvoicePicker({
  invoices,
  value,
  onPick,
}: {
  invoices: Invoice[];
  value: string;
  onPick: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    requestAnimationFrame(() => inputRef.current?.focus());
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const label = (i: Invoice) => `${i.number} · ${accountById(i.accountId)?.name ?? "—"} · ${i.date}`;
  const selected = invoices.find((i) => i.id === value);
  const needle = q.trim().toLowerCase();
  const filtered = needle ? invoices.filter((i) => label(i).toLowerCase().includes(needle)) : invoices;

  return (
    <div ref={ref} className="relative mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border bg-card px-3 text-sm shadow-sm transition-colors",
          open ? "border-primary ring-2 ring-ring" : "hover:bg-accent/40",
        )}
      >
        <span className={cn("min-w-0 flex-1 truncate text-left", !selected && "text-muted-foreground")}>
          {selected ? label(selected) : "Search invoices by number, customer or date…"}
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 w-full overflow-hidden rounded-lg border bg-popover shadow-xl">
          <div className="flex items-center gap-2 border-b px-2.5 py-2">
            <Search className="size-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search invoices…"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
          <div className="max-h-60 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">No invoices match.</p>
            ) : (
              filtered.map((i) => (
                <button
                  key={i.id}
                  onClick={() => {
                    onPick(i.id);
                    setOpen(false);
                    setQ("");
                  }}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 px-3 py-1.5 text-left text-sm hover:bg-accent",
                    i.id === value && "bg-primary/10 text-primary",
                  )}
                >
                  <span className="min-w-0 truncate">
                    <span className="font-mono text-xs">{i.number}</span>{" "}
                    <span className="text-muted-foreground">· {accountById(i.accountId)?.name ?? "—"}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">{i.date}</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function counterOptions(type: VoucherType): Account[] {
  switch (type) {
    case "sales":
      return CHART_OF_ACCOUNTS.filter((a) => a.type === "income");
    case "credit_note":
      return CHART_OF_ACCOUNTS.filter((a) => a.type === "income");
    case "purchase":
      return CHART_OF_ACCOUNTS.filter((a) => a.type === "expense" || a.code === "1200");
    case "debit_note":
      return CHART_OF_ACCOUNTS.filter((a) => a.type === "expense");
    case "asset":
      return CHART_OF_ACCOUNTS.filter((a) => a.subtype === "Fixed Assets" && a.normal === "debit");
    default:
      return CHART_OF_ACCOUNTS; // payment / receipt / bank: any account
  }
}

export function NewJournalEntry({
  open,
  onClose,
  defaultType = "journal",
  lockType = false,
  title,
}: {
  open: boolean;
  onClose: () => void;
  defaultType?: VoucherType;
  lockType?: boolean;
  title?: string;
}) {
  const prefs = usePrefs();
  const { entries, post } = useJournal();

  const [type, setType] = useState<VoucherType>(defaultType);
  const def = voucherType(type);

  const defaultEntity = prefs.entityId !== ALL ? prefs.entityId : (ENTITIES[0]?.id ?? "");
  const [entityId, setEntityId] = useState(defaultEntity);
  const [locationId, setLocationId] = useState(locationsForEntity(defaultEntity)[0]?.id ?? "");
  const [date, setDate] = useState(todayIso());
  const [basis, setBasis] = useState<EntryBasis>(def.defaultBasis);
  const [narration, setNarration] = useState("");
  const [partyId, setPartyId] = useState("");
  const [g, setG] = useState<GuidedInput>(defaultGuidedInput(defaultType));
  const [lines, setLines] = useState<DraftLine[]>([blankLine(), blankLine()]);
  const [autoReverse, setAutoReverse] = useState(false);
  const [reverseDate, setReverseDate] = useState("");
  const [submitErrors, setSubmitErrors] = useState<string[]>([]);
  // Credit note → pull the original invoice in.
  const [invoiceId, setInvoiceId] = useState("");
  // Per-line selection for partial credit: { on, qty } aligned to invoice.lines.
  const [creditLines, setCreditLines] = useState<{ on: boolean; qty: number }[]>([]);
  const [createdInvoices, setCreatedInvoices] = useState<Invoice[]>([]);
  useEffect(() => setCreatedInvoices(loadCreatedInvoices()), []);
  const invoices = useMemo(
    () => allInvoices(createdInvoices).filter((i) => i.lines.length > 0),
    [createdInvoices],
  );

  const locations = locationsForEntity(entityId);
  const currency = currencyForEntity(entityId);
  const parties = def.partyKind === "none" ? [] : partiesByKind(def.partyKind);
  const voucherNo = useMemo(() => nextVoucherNo(entries, type), [entries, type]);

  // The resolved Dr/Cr lines — built from the quick-fill for guided types, or
  // taken from the line editor for free types (journal / stock).
  const resolvedLines: ManualEntryLine[] = def.guided
    ? buildGuidedLines(type, g)
    : lines.map((l) => ({ accountCode: l.accountCode, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, memo: l.text.trim() || undefined }));
  const totals = entryTotals(resolvedLines);
  const selectedInvoice = invoices.find((i) => i.id === invoiceId);

  function changeType(t: VoucherType) {
    setType(t);
    const d = voucherType(t);
    setBasis(d.defaultBasis);
    setG(defaultGuidedInput(t));
    setLines([blankLine(), blankLine()]);
    setPartyId("");
    setInvoiceId("");
    setCreditLines([]);
    setAutoReverse(false);
    setReverseDate("");
    setSubmitErrors([]);
  }

  function changeEntity(id: string) {
    setEntityId(id);
    setLocationId(locationsForEntity(id)[0]?.id ?? "");
  }

  // Taxable + blended GST rate from the *selected* invoice lines, so a partial
  // credit (some lines, reduced qty, or mixed GST rates) still posts exactly.
  function creditTotalsFor(inv: Invoice, cl: { on: boolean; qty: number }[]) {
    const exportSale =
      gstTreatment(inv.entityId, accountById(inv.accountId)?.stateCode ?? "29") === "export";
    let taxable = 0;
    let gst = 0;
    inv.lines.forEach((l, i) => {
      if (!cl[i]?.on) return;
      const qty = Math.max(0, Math.min(cl[i].qty, l.qty));
      taxable += qty * l.rate;
      if (!exportSale) gst += (qty * l.rate * l.gstRate) / 100;
    });
    const blended = taxable > 0 ? Math.round((gst / taxable) * 10000) / 100 : 0;
    return { taxable: Math.round(taxable), blended };
  }

  // Push the line selection into the guided amount + (blended) GST rate.
  function applyCreditLines(inv: Invoice, cl: { on: boolean; qty: number }[]) {
    setCreditLines(cl);
    const { taxable, blended } = creditTotalsFor(inv, cl);
    setGuided({ amount: taxable, gstRate: blended });
  }

  // Auto-fill a credit note from its source invoice. Every field stays editable —
  // seeds the customer, entity, narration (referencing the invoice number) and
  // selects all lines for a full credit (deselect / reduce qty for a partial).
  function pickFromInvoice(id: string) {
    setInvoiceId(id);
    const inv = invoices.find((i) => i.id === id);
    if (!inv) {
      setCreditLines([]);
      return;
    }
    const acc = accountById(inv.accountId);
    changeEntity(inv.entityId);
    setDate(todayIso());
    setPartyId(inv.accountId); // customer party shares the CRM account id
    setNarration(`Credit note against invoice ${inv.number}${acc ? ` — ${acc.name}` : ""}`);
    applyCreditLines(inv, inv.lines.map((l) => ({ on: true, qty: l.qty })));
  }

  function toggleCreditLine(i: number) {
    if (!selectedInvoice) return;
    applyCreditLines(selectedInvoice, creditLines.map((c, idx) => (idx === i ? { ...c, on: !c.on } : c)));
  }
  function setCreditQty(i: number, qty: number) {
    if (!selectedInvoice) return;
    const max = selectedInvoice.lines[i]?.qty ?? 0;
    const v = Math.max(0, Math.min(Number.isFinite(qty) ? qty : 0, max));
    applyCreditLines(selectedInvoice, creditLines.map((c, idx) => (idx === i ? { qty: v, on: v > 0 } : c)));
  }

  function setLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function setAmount(i: number, side: "debit" | "credit", value: string) {
    setLine(i, side === "debit" ? { debit: value, credit: "" } : { credit: value, debit: "" });
  }
  const addLine = () => setLines((prev) => [...prev, blankLine()]);
  const removeLine = (i: number) => setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  const setGuided = (patch: Partial<GuidedInput>) => setG((prev) => ({ ...prev, ...patch }));
  const setCostLine = (i: number, patch: Partial<{ accountCode: string; amount: number }>) =>
    setG((prev) => ({ ...prev, costLines: prev.costLines.map((l, idx) => (idx === i ? { ...l, ...patch } : l)) }));
  const addCostLine = () => setG((prev) => ({ ...prev, costLines: [...prev.costLines, { accountCode: "", amount: 0 }] }));
  const removeCostLine = (i: number) =>
    setG((prev) => ({ ...prev, costLines: prev.costLines.length <= 1 ? prev.costLines : prev.costLines.filter((_, idx) => idx !== i) }));

  function reset() {
    setType(defaultType);
    setDate(todayIso());
    setBasis(voucherType(defaultType).defaultBasis);
    setNarration("");
    setPartyId("");
    setInvoiceId("");
    setCreditLines([]);
    setG(defaultGuidedInput(defaultType));
    setLines([blankLine(), blankLine()]);
    setAutoReverse(false);
    setReverseDate("");
    setSubmitErrors([]);
  }

  function handlePost() {
    const draft: EntryDraft = {
      type,
      date,
      narration,
      entityId,
      locationId,
      currency,
      basis,
      partyId: def.partyKind === "none" ? undefined : partyId || undefined,
      lines: resolvedLines,
      autoReverse: autoReverse || undefined,
      reverseDate: autoReverse ? reverseDate : undefined,
    };
    const result = post(draft);
    if (!result.ok) {
      setSubmitErrors(result.errors);
      return;
    }
    reset();
    onClose();
  }

  function handleClose() {
    reset();
    onClose();
  }

  const showGst = ["sales", "purchase", "debit_note", "credit_note"].includes(type);
  const showSettle = ["sales", "purchase", "asset"].includes(type);
  const showTds = type === "payment" || type === "receipt";
  const canItemise = type === "sales" || type === "purchase";
  const itemised = canItemise && g.costLines.length > 0;

  return (
    <Modal
      open={open}
      onClose={handleClose}
      className="max-w-3xl"
      title={
        <span className="flex items-center gap-2">
          {title ?? "New Voucher"} <Badge variant="primary" className="font-mono">{voucherNo}</Badge>
        </span>
      }
      description={def.hint}
      footer={
        <>
          <div className="mr-auto flex items-center gap-2 text-sm">
            {totals.balanced && totals.debit > 0 ? (
              <Badge variant="success" className="gap-1">
                <Scale className="size-3" /> Balanced
              </Badge>
            ) : (
              <Badge variant="warning" className="gap-1">
                <AlertTriangle className="size-3" /> Out of balance
              </Badge>
            )}
          </div>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button onClick={handlePost} disabled={!totals.balanced || totals.debit === 0}>
            Post {def.label.toLowerCase().includes("journal") ? "entry" : "voucher"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Voucher type + header */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div>
            <Label htmlFor="je-type">Voucher type</Label>
            <Select id="je-type" value={type} onChange={(e) => changeType(e.target.value as VoucherType)} disabled={lockType} className="mt-1">
              {VOUCHER_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="je-date">Date</Label>
            <Input id="je-date" type="date" value={date} min={BOOKS_OPENING} max={todayIso()} onChange={(e) => setDate(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="je-entity">Entity</Label>
            <EntityCombobox id="je-entity" value={entityId} onChange={changeEntity} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="je-loc">Location</Label>
            <Select id="je-loc" value={locationId} onChange={(e) => setLocationId(e.target.value)} className="mt-1">
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {def.partyKind !== "none" && (
            <div className="col-span-2">
              <Label htmlFor="je-party">{def.partyKind === "vendor" ? "Vendor" : def.partyKind === "customer" ? "Customer" : "Party"}</Label>
              <Select id="je-party" value={partyId} onChange={(e) => setPartyId(e.target.value)} className="mt-1">
                <option value="">Select…</option>
                {parties.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <div>
            <Label htmlFor="je-basis">Basis</Label>
            <Select id="je-basis" value={basis} onChange={(e) => setBasis(e.target.value as EntryBasis)} className="mt-1">
              <option value="accrual">Accrual</option>
              <option value="cash">Cash</option>
              <option value="both">Both ledgers</option>
            </Select>
          </div>
        </div>

        {type === "credit_note" && (
          <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
            <Label className="flex items-center gap-1.5">
              <FileText className="size-3.5 text-primary" /> Against invoice
            </Label>
            <InvoicePicker invoices={invoices} value={invoiceId} onPick={pickFromInvoice} />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Tick the lines to credit and adjust the return quantity for a partial credit — the amount and GST
              update automatically. Every field stays editable.
            </p>
            {selectedInvoice && (
              <div className="mt-3 overflow-hidden rounded-md border bg-card">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                      <th className="w-8 px-2 py-1.5" />
                      <th className="px-2.5 py-1.5 font-medium">Item</th>
                      <th className="w-20 px-2 py-1.5 text-right font-medium">Return qty</th>
                      <th className="w-12 px-2 py-1.5 text-right font-medium">of</th>
                      <th className="w-24 px-2.5 py-1.5 text-right font-medium">Rate</th>
                      <th className="w-12 px-2 py-1.5 text-right font-medium">GST</th>
                      <th className="w-28 px-2.5 py-1.5 text-right font-medium">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedInvoice.lines.map((l, i) => {
                      const sel = creditLines[i] ?? { on: false, qty: 0 };
                      const qty = sel.on ? Math.min(sel.qty, l.qty) : 0;
                      return (
                        <tr key={i} className={cn("border-b border-border/40 last:border-0", !sel.on && "opacity-50")}>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={sel.on}
                              onChange={() => toggleCreditLine(i)}
                              className="size-4 rounded border-input align-middle"
                              aria-label={`Credit ${l.desc}`}
                            />
                          </td>
                          <td className="px-2.5 py-1.5">{l.desc}</td>
                          <td className="px-2 py-1.5">
                            <Input
                              type="number"
                              min={0}
                              max={l.qty}
                              value={sel.on ? sel.qty : 0}
                              disabled={!sel.on}
                              onChange={(e) => setCreditQty(i, Number(e.target.value))}
                              className="h-7 px-1.5 text-right text-xs tabular"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right tabular text-muted-foreground">{l.qty}</td>
                          <td className="px-2.5 py-1.5 text-right tabular"><Money value={l.rate} /></td>
                          <td className="px-2 py-1.5 text-right tabular text-muted-foreground">{l.gstRate}%</td>
                          <td className="px-2.5 py-1.5 text-right tabular"><Money value={qty * l.rate} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30 font-semibold">
                      <td className="px-2.5 py-1.5" colSpan={6}>Taxable to credit</td>
                      <td className="px-2.5 py-1.5 text-right tabular">
                        <Money value={creditTotalsFor(selectedInvoice, creditLines).taxable} />
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        )}

        <div>
          <Label htmlFor="je-narration">Narration</Label>
          <Input id="je-narration" value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="What is this voucher for?" className="mt-1" />
        </div>

        {/* Quick-fill for guided voucher types */}
        {def.guided && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Quick fill</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {!itemised && (
                <div>
                  <Label>Amount {showGst ? "(taxable)" : ""}</Label>
                  <Input type="number" min={0} value={g.amount || ""} onChange={(e) => setGuided({ amount: Number(e.target.value) })} placeholder="0.00" className="mt-1 text-right tabular" />
                </div>
              )}
              {showGst && (
                <div>
                  <Label>GST rate{type === "credit_note" && invoiceId ? " (blended)" : ""}</Label>
                  <Select value={g.gstRate} onChange={(e) => setGuided({ gstRate: Number(e.target.value) })} className="mt-1">
                    {/* include the live (possibly blended) rate so it always displays */}
                    {Array.from(new Set([...GST_RATES, g.gstRate]))
                      .sort((a, b) => a - b)
                      .map((r) => (
                        <option key={r} value={r}>
                          {r}%
                        </option>
                      ))}
                  </Select>
                </div>
              )}
              {type === "bank" && (
                <div>
                  <Label>Direction</Label>
                  <Select value={g.direction} onChange={(e) => setGuided({ direction: e.target.value as "in" | "out" })} className="mt-1">
                    <option value="in">Deposit (in)</option>
                    <option value="out">Withdrawal (out)</option>
                  </Select>
                </div>
              )}
              {type === "contra" ? (
                <>
                  <div>
                    <Label>From (credit)</Label>
                    <Select value={g.fromAccount} onChange={(e) => setGuided({ fromAccount: e.target.value })} className="mt-1">
                      {cashAccounts.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label>To (debit)</Label>
                    <Select value={g.toAccount} onChange={(e) => setGuided({ toAccount: e.target.value })} className="mt-1">
                      {cashAccounts.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <Label>
                      {type === "payment" || type === "receipt" || type === "bank" ? "Bank / Cash" : "Bank / Cash (if settled)"}
                    </Label>
                    <Select value={g.bankAccount} onChange={(e) => setGuided({ bankAccount: e.target.value })} className="mt-1">
                      {cashAccounts.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  {!itemised && (
                    <div>
                      <Label>
                        {type === "sales"
                          ? "Income account"
                          : type === "purchase"
                            ? "Expense account"
                            : type === "asset"
                              ? "Asset account"
                              : type === "credit_note"
                                ? "Return income"
                                : type === "debit_note"
                                  ? "Return expense"
                                  : "Against account"}
                      </Label>
                      <Select value={g.counterAccount} onChange={(e) => setGuided({ counterAccount: e.target.value })} className="mt-1">
                        {counterOptions(type).map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code} · {a.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  )}
                </>
              )}
              {showTds && (
                <div>
                  <Label>TDS deducted</Label>
                  <Select value={g.tdsRate} onChange={(e) => setGuided({ tdsRate: Number(e.target.value) })} className="mt-1">
                    {TDS_RATES.map((r) => (
                      <option key={r} value={r}>
                        {r === 0 ? "No TDS" : `${r}%`}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
              {showSettle && (
                <label className="flex items-center gap-2 self-end pb-2 text-sm">
                  <input type="checkbox" checked={g.settleNow} onChange={(e) => setGuided({ settleNow: e.target.checked })} className="size-4 rounded border-input" />
                  Settled now (cash/bank)
                </label>
              )}
            </div>
            {canItemise && (
              <div className="mt-3">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input
                    type="checkbox"
                    checked={itemised}
                    onChange={(e) =>
                      setGuided({
                        costLines: e.target.checked
                          ? [{ accountCode: g.counterAccount || counterOptions(type)[0]?.code || "", amount: g.amount || 0 }]
                          : [],
                      })
                    }
                    className="size-4 rounded border-input"
                  />
                  Itemise into multiple {type === "sales" ? "revenue" : "cost"} lines
                </label>
                {itemised && (
                  <div className="mt-2 overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                          <th className="px-3 py-2 font-medium">{type === "sales" ? "Income" : "Cost"} account</th>
                          <th className="w-36 px-3 py-2 text-right font-medium">Amount</th>
                          <th className="w-10 px-2 py-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {g.costLines.map((l, i) => (
                          <tr key={i} className="border-b border-border/40 last:border-0">
                            <td className="px-3 py-2">
                              <Select value={l.accountCode} onChange={(e) => setCostLine(i, { accountCode: e.target.value })}>
                                <option value="">Select account…</option>
                                {counterOptions(type).map((a) => (
                                  <option key={a.code} value={a.code}>
                                    {a.code} · {a.name}
                                  </option>
                                ))}
                              </Select>
                            </td>
                            <td className="px-3 py-2">
                              <Input type="number" min={0} value={l.amount || ""} onChange={(e) => setCostLine(i, { amount: Number(e.target.value) })} placeholder="0.00" className="text-right tabular" />
                            </td>
                            <td className="px-2 py-2 text-center">
                              <button onClick={() => removeCostLine(i)} disabled={g.costLines.length <= 1} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-danger disabled:opacity-30" aria-label="Remove line">
                                <Trash2 className="size-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/30">
                          <td className="px-3 py-2">
                            <button onClick={addCostLine} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                              <Plus className="size-3.5" /> Add line
                            </button>
                          </td>
                          <td />
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Line editor for free voucher types (journal / stock) */}
        {!def.guided && (
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 font-medium">Line text</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Debit</th>
                  <th className="w-32 px-3 py-2 text-right font-medium">Credit</th>
                  <th className="w-10 px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => (
                  <tr key={i} className="border-b border-border/40 last:border-0">
                    <td className="px-3 py-2">
                      <Select value={l.accountCode} onChange={(e) => setLine(i, { accountCode: e.target.value })}>
                        <option value="">Select account…</option>
                        {CHART_OF_ACCOUNTS.map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code} · {a.name}
                          </option>
                        ))}
                      </Select>
                    </td>
                    <td className="px-3 py-2">
                      <Input value={l.text} onChange={(e) => setLine(i, { text: e.target.value })} placeholder="Item narration (optional)" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={0} value={l.debit} onChange={(e) => setAmount(i, "debit", e.target.value)} placeholder="0.00" className="text-right tabular" />
                    </td>
                    <td className="px-3 py-2">
                      <Input type="number" min={0} value={l.credit} onChange={(e) => setAmount(i, "credit", e.target.value)} placeholder="0.00" className="text-right tabular" />
                    </td>
                    <td className="px-2 py-2 text-center">
                      <button onClick={() => removeLine(i)} disabled={lines.length <= 2} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-danger disabled:opacity-30" aria-label="Remove line">
                        <Trash2 className="size-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30">
                  <td className="px-3 py-2">
                    <button onClick={addLine} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                      <Plus className="size-3.5" /> Add line
                    </button>
                  </td>
                  <td />
                  <td />
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        )}

        {/* Auto-reverse (accruals / provisions) */}
        {!def.guided && (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input type="checkbox" checked={autoReverse} onChange={(e) => setAutoReverse(e.target.checked)} className="size-4 rounded border-input" />
              <RefreshCw className="size-4 text-muted-foreground" /> Auto-reverse
            </label>
            {autoReverse && (
              <div className="flex items-center gap-2">
                <Label htmlFor="je-revdate">on</Label>
                <Input id="je-revdate" type="date" value={reverseDate} min={date} onChange={(e) => setReverseDate(e.target.value)} className="h-8 w-[150px]" />
                <span className="text-xs text-muted-foreground">posts an offsetting entry on this date</span>
              </div>
            )}
          </div>
        )}

        {/* Posting preview */}
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Posting preview</p>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Account</th>
                  <th className="px-3 py-2 text-right font-medium">Debit</th>
                  <th className="px-3 py-2 text-right font-medium">Credit</th>
                </tr>
              </thead>
              <tbody>
                {resolvedLines.filter((l) => l.debit || l.credit).length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-3 py-4 text-center text-xs text-muted-foreground">
                      Fill in the details above to see the double entry.
                    </td>
                  </tr>
                ) : (
                  resolvedLines
                    .filter((l) => l.debit || l.credit)
                    .map((l, i) => {
                      const acc = accountSafe(l.accountCode);
                      return (
                        <tr key={i} className="border-b border-border/40 last:border-0">
                          <td className="px-3 py-2">
                            <span className="font-mono text-xs text-muted-foreground">{l.accountCode}</span>{" "}
                            <span className="font-medium">{acc?.name ?? "—"}</span>
                            {l.memo && <span className="block text-xs text-muted-foreground">{l.memo}</span>}
                          </td>
                          <td className="px-3 py-2 text-right tabular">{l.debit ? <Money value={l.debit} /> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2 text-right tabular">{l.credit ? <Money value={l.credit} /> : <span className="text-muted-foreground">—</span>}</td>
                        </tr>
                      );
                    })
                )}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/30 font-semibold">
                  <td className="px-3 py-2 text-right">Total</td>
                  <td className="px-3 py-2 text-right tabular"><Money value={totals.debit} /></td>
                  <td className="px-3 py-2 text-right tabular"><Money value={totals.credit} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {submitErrors.length > 0 && (
          <div className="rounded-lg border border-danger/40 bg-danger/8 p-3">
            <p className="flex items-center gap-1.5 text-sm font-medium text-danger">
              <AlertTriangle className="size-4" /> Voucher not posted
            </p>
            <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-sm text-danger/90">
              {submitErrors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Modal>
  );
}
