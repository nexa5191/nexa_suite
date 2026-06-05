"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, FileDown, Save, Info, Boxes, Warehouse } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { cn, formatDate } from "@/lib/utils";
import { formatMoney } from "@/lib/currency";
import { ACTIVE_EMPLOYEES, employeeName } from "@/lib/hr/employees";
import { locationsForEntity } from "@/lib/accounting/org";
import {
  ACCOUNTS,
  accountById,
  primaryContact,
} from "@/lib/crm";
import { FINISHED_ITEMS, finishedItemByName, itemById } from "@/lib/inventory/items";
import {
  loadAddedMovements,
  allMovements,
  buildStockIndex,
  stockAt,
  buildSaleMovements,
  appendMovements,
  type StockIndex,
} from "@/lib/inventory/movements";
import {
  billingEntities,
  accountsForEntity,
  entityLetterhead,
  gstTreatment,
  computeTotals,
  amountInWords,
  nextInvoiceNumber,
  loadCreatedInvoices,
  saveCreatedInvoices,
  type Invoice,
  type InvoiceLine,
  type DiscountType,
  type InvoiceStatus,
  type GstTreatment,
} from "@/lib/invoicing";

const GST_RATES = [0, 5, 12, 18, 28];
const TREATMENT_LABEL: Record<GstTreatment, string> = {
  intra: "Intra-state · CGST + SGST",
  inter: "Inter-state · IGST",
  export: "Export · zero-rated (LUT)",
};

type DraftLine = InvoiceLine;

export function InvoiceBuilder() {
  const router = useRouter();
  const { currency } = usePrefs();

  const entities = billingEntities();
  const [entityId, setEntityId] = React.useState(entities[0].id);

  const accounts = accountsForEntity(entityId);
  const [accountId, setAccountId] = React.useState(accounts[0]?.id ?? ACCOUNTS[0].id);

  // overrides
  const [nameOverride, setNameOverride] = React.useState("");
  const [addressOverride, setAddressOverride] = React.useState("");
  const [gstinOverride, setGstinOverride] = React.useState("");

  const [number, setNumber] = React.useState("—");
  const [date, setDate] = React.useState("2026-06-05");
  const [dueDate, setDueDate] = React.useState("2026-06-20");
  const [status, setStatus] = React.useState<InvoiceStatus>("draft");
  const [signatoryId, setSignatoryId] = React.useState("emp-002");
  const [notes, setNotes] = React.useState("");

  const [lines, setLines] = React.useState<DraftLine[]>([
    { desc: "Wheat flour (50kg bag)", hsn: "1101", qty: 100, rate: 1850, gstRate: 5, itemId: "fg-flour50" },
  ]);
  const [discountType, setDiscountType] = React.useState<DiscountType>("none");
  const [discountValue, setDiscountValue] = React.useState("");
  const [saving, setSaving] = React.useState(false);

  // dispatch warehouse + current stock (for auto-posting sale movements on save)
  const [dispatchLoc, setDispatchLoc] = React.useState("loc-mys");
  const [stockIdx, setStockIdx] = React.useState<StockIndex>(() => buildStockIndex(allMovements([])));
  React.useEffect(() => {
    setStockIdx(buildStockIndex(allMovements(loadAddedMovements())));
  }, []);
  const entityLocations = locationsForEntity(entityId);
  React.useEffect(() => {
    const locs = locationsForEntity(entityId);
    if (locs.length && !locs.some((l) => l.id === dispatchLoc)) setDispatchLoc(locs[0].id);
  }, [entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // keep account valid for the chosen entity, and refresh the auto number
  React.useEffect(() => {
    const list = accountsForEntity(entityId);
    if (list.length && !list.some((a) => a.id === accountId)) {
      setAccountId(list[0].id);
    }
  }, [entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    setNumber(nextInvoiceNumber(entityId, loadCreatedInvoices()));
  }, [entityId]);

  const account = accountById(accountId);
  const lh = entityLetterhead(entityId);
  const treatment: GstTreatment = gstTreatment(entityId, account?.stateCode ?? "29");

  const billName = nameOverride || account?.legalName || "—";
  const billAddress =
    addressOverride || (account ? `${account.address}, ${account.city}, ${account.state}` : "");
  const billGstin = gstinOverride || account?.gstin || "";

  const totals = computeTotals(lines, discountType, parseFloat(discountValue) || 0, treatment);
  const wordsValue = Math.round(totals.total * currency.rate);
  const words = amountInWords(wordsValue, currency.code, currency.name);

  function updateLine(i: number, patch: Partial<DraftLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  // Editing the description auto-links to a finished-good SKU (by exact name)
  // and pulls its HSN/rate when newly linked.
  function onDesc(i: number, value: string) {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        const match = finishedItemByName(value);
        if (match && match.id !== l.itemId) {
          return { ...l, desc: value, itemId: match.id, hsn: match.hsn, rate: match.rate };
        }
        return { ...l, desc: value, itemId: match?.id };
      }),
    );
  }
  const validLines = lines.filter((l) => l.desc.trim() && l.qty > 0 && l.rate > 0);
  const dispatchLines = validLines.filter((l) => l.itemId);

  function buildInvoice(): Invoice {
    const billTo =
      nameOverride || addressOverride || gstinOverride
        ? { name: nameOverride || undefined, address: addressOverride || undefined, gstin: gstinOverride || undefined }
        : undefined;
    return {
      id: `inv-custom-${number.replace(/[^A-Za-z0-9]/g, "")}`,
      number,
      accountId,
      entityId,
      date,
      dueDate,
      status,
      lines: validLines,
      discountType,
      discountValue: parseFloat(discountValue) || 0,
      notes,
      signatoryId,
      billTo,
    };
  }

  function save() {
    setSaving(true);
    const inv = buildInvoice();
    saveCreatedInvoices([...loadCreatedInvoices(), inv]);
    // Auto-post FG dispatch (sale) movements for catalogue-linked lines.
    const saleMoves = buildSaleMovements(
      dispatchLines.map((l) => ({ itemId: l.itemId as string, qty: l.qty })),
      dispatchLoc,
      inv.number,
      signatoryId,
      account?.name ?? "Customer",
    );
    if (saleMoves.length) appendMovements(saleMoves);
    router.push("/invoicing");
    router.refresh();
  }

  function exportPdf() {
    const win = window.open("", "_blank", "width=900,height=1000");
    if (!win) return;
    const m = (base: number) => formatMoney(base, currency);
    const fmt = formatDate;

    const showGst = treatment !== "export";
    const rows = validLines
      .map((l) => {
        const amt = l.qty * l.rate;
        return `<tr><td>${esc(l.desc)}</td><td align="center">${esc(l.hsn)}</td><td align="right">${l.qty}</td><td align="right">${m(l.rate)}</td>${
          showGst ? `<td align="right">${l.gstRate}%</td>` : ""
        }<td align="right">${m(amt)}</td></tr>`;
      })
      .join("");

    const taxRows = showGst
      ? treatment === "intra"
        ? `<div class="t"><span>CGST</span><span>${m(totals.cgst)}</span></div><div class="t"><span>SGST</span><span>${m(totals.sgst)}</span></div>`
        : `<div class="t"><span>IGST</span><span>${m(totals.igst)}</span></div>`
      : "";

    win.document.write(`<!doctype html><html><head><title>${esc(number)}</title><style>
      *{box-sizing:border-box} body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#1a1a1a;margin:0;padding:40px}
      .head{display:flex;justify-content:space-between;border-bottom:3px solid #4f46e5;padding-bottom:16px}
      .brand{font-size:22px;font-weight:800;color:#4f46e5}
      .addr{font-size:11px;color:#555;max-width:300px;text-align:right;line-height:1.5}
      .tax-title{text-align:center;font-size:11px;letter-spacing:.12em;text-transform:uppercase;color:#888;margin-top:10px}
      .row{display:flex;justify-content:space-between;margin-top:20px;gap:24px}
      .box{font-size:12px;line-height:1.6}
      .box .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.05em;color:#888}
      table.lines{width:100%;border-collapse:collapse;font-size:12px;margin-top:8px}
      table.lines th{text-align:left;background:#f4f4f5;border:1px solid #e4e4e7;padding:8px;font-size:10px;text-transform:uppercase;color:#666}
      table.lines td{border:1px solid #e9e9ec;padding:8px}
      table.lines td[align=right],table.lines th[align=right]{text-align:right}
      table.lines td[align=center],table.lines th[align=center]{text-align:center}
      .totals{margin-top:12px;margin-left:auto;width:300px;font-size:13px}
      .totals .t{display:flex;justify-content:space-between;padding:4px 0}
      .totals .grand{border-top:2px solid #4f46e5;margin-top:6px;padding-top:8px;font-weight:800;font-size:15px;color:#4f46e5}
      .words{font-size:12px;font-style:italic;color:#444;margin-top:8px}
      .pay{font-size:11px;color:#555;margin-top:20px;line-height:1.6}
      .sign{margin-top:48px;text-align:right;font-size:12px}
      .ft{margin-top:40px;text-align:center;font-size:10px;color:#aaa;border-top:1px solid #eee;padding-top:12px}
      @media print{body{padding:14mm}}
    </style></head><body>
      <div class="head">
        <div><div class="brand">${esc(lh.name)}</div><div style="font-size:11px;color:#777;margin-top:4px">${esc(lh.legalName)}${lh.gstin ? ` · GSTIN ${esc(lh.gstin)}` : ""}</div></div>
        <div class="addr">${esc(lh.address)}</div>
      </div>
      <div class="tax-title">${treatment === "export" ? "Export Invoice" : "Tax Invoice"}</div>
      <div class="row">
        <div class="box"><div class="lbl">Bill To</div><b>${esc(billName)}</b><br>${esc(billAddress) || "&nbsp;"}${billGstin ? `<br>GSTIN ${esc(billGstin)}` : ""}</div>
        <div class="box" style="text-align:right"><div class="lbl">Invoice</div><b>${esc(number)}</b><br><span class="lbl">Date</span> ${fmt(date)}<br><span class="lbl">Due</span> ${fmt(dueDate)}<br><span class="lbl">Status</span> ${status.toUpperCase()}</div>
      </div>
      <table class="lines"><thead><tr><th>Description</th><th align="center">HSN/SAC</th><th align="right">Qty</th><th align="right">Rate</th>${showGst ? `<th align="right">GST</th>` : ""}<th align="right">Amount</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="totals">
        <div class="t"><span>Subtotal</span><span>${m(totals.subtotal)}</span></div>
        ${totals.discountAmt > 0 ? `<div class="t"><span>Discount</span><span>- ${m(totals.discountAmt)}</span></div>` : ""}
        ${totals.discountAmt > 0 ? `<div class="t"><span>Taxable value</span><span>${m(totals.taxable)}</span></div>` : ""}
        ${taxRows}
        <div class="t grand"><span>Total</span><span>${m(totals.total)}</span></div>
      </div>
      <div class="words">Amount in words: ${esc(words)}</div>
      <div class="pay"><b>Payment details</b><br>${esc(lh.bank)}${notes ? `<br><br><b>Notes:</b> ${esc(notes)}` : ""}</div>
      <div class="sign">_______________________<br><b>${esc(employeeName(signatoryId))}</b><br>For ${esc(lh.legalName)}</div>
      <div class="ft">${treatment === "export" ? "Zero-rated supply under LUT — no IGST payable. " : ""}Computer-generated invoice — NEXA</div>
    </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {/* LEFT — live preview */}
      <div className="order-2 lg:order-1">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Live preview</span>
          <span className="text-xs text-muted-foreground">{currency.code} · {TREATMENT_LABEL[treatment]}</span>
        </div>
        <Card className="overflow-hidden p-0">
          <div className="space-y-5 bg-white p-6 text-[13px] text-zinc-800">
            {/* letterhead */}
            <div className="flex justify-between border-b-2 border-indigo-600 pb-3">
              <div>
                <p className="text-lg font-extrabold text-indigo-600">{lh.name}</p>
                <p className="mt-0.5 text-[10px] text-zinc-500">
                  {lh.legalName}
                  {lh.gstin && ` · GSTIN ${lh.gstin}`}
                </p>
              </div>
              <p className="max-w-[210px] text-right text-[10px] leading-relaxed text-zinc-500">{lh.address}</p>
            </div>

            <p className="text-center text-[10px] uppercase tracking-[0.18em] text-zinc-400">
              {treatment === "export" ? "Export Invoice" : "Tax Invoice"}
            </p>

            <div className="flex justify-between gap-4">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-zinc-400">Bill To</p>
                <p className="font-semibold">{billName}</p>
                {billAddress && <p className="text-xs text-zinc-600">{billAddress}</p>}
                {billGstin && <p className="text-xs text-zinc-600">GSTIN {billGstin}</p>}
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-zinc-400">Invoice</p>
                <p className="font-semibold">{number}</p>
                <p className="text-xs text-zinc-600">{formatDate(date)}</p>
                <p className="text-xs text-zinc-600">Due {formatDate(dueDate)}</p>
              </div>
            </div>

            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-zinc-100 text-left text-[10px] uppercase text-zinc-500">
                  <th className="border border-zinc-200 px-2 py-1.5 font-medium">Description</th>
                  <th className="border border-zinc-200 px-2 py-1.5 text-center font-medium">HSN</th>
                  <th className="border border-zinc-200 px-2 py-1.5 text-right font-medium">Qty</th>
                  <th className="border border-zinc-200 px-2 py-1.5 text-right font-medium">Rate</th>
                  {treatment !== "export" && <th className="border border-zinc-200 px-2 py-1.5 text-right font-medium">GST</th>}
                  <th className="border border-zinc-200 px-2 py-1.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {validLines.length === 0 && (
                  <tr>
                    <td className="border border-zinc-200 px-2 py-1.5 text-zinc-400" colSpan={treatment !== "export" ? 6 : 5}>
                      No line items yet
                    </td>
                  </tr>
                )}
                {validLines.map((l, idx) => (
                  <tr key={idx}>
                    <td className="border border-zinc-200 px-2 py-1.5">{l.desc}</td>
                    <td className="border border-zinc-200 px-2 py-1.5 text-center text-zinc-500">{l.hsn || "—"}</td>
                    <td className="border border-zinc-200 px-2 py-1.5 text-right tabular-nums">{l.qty}</td>
                    <td className="border border-zinc-200 px-2 py-1.5 text-right tabular-nums">
                      <Money value={l.rate} />
                    </td>
                    {treatment !== "export" && (
                      <td className="border border-zinc-200 px-2 py-1.5 text-right tabular-nums">{l.gstRate}%</td>
                    )}
                    <td className="border border-zinc-200 px-2 py-1.5 text-right tabular-nums">
                      <Money value={l.qty * l.rate} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="ml-auto w-60 text-xs">
              <Row label="Subtotal" value={totals.subtotal} />
              {totals.discountAmt > 0 && (
                <>
                  <Row label="Discount" value={-totals.discountAmt} />
                  <Row label="Taxable value" value={totals.taxable} />
                </>
              )}
              {treatment === "intra" && (
                <>
                  <Row label="CGST" value={totals.cgst} />
                  <Row label="SGST" value={totals.sgst} />
                </>
              )}
              {treatment === "inter" && <Row label="IGST" value={totals.igst} />}
              <div className="mt-1 flex justify-between border-t-2 border-indigo-600 pt-1.5 text-sm font-extrabold text-indigo-600">
                <span>Total</span>
                <span className="tabular-nums">
                  <Money value={totals.total} />
                </span>
              </div>
            </div>
            <p className="text-[11px] italic text-zinc-500">Amount in words: {words}</p>

            <div className="text-[10px] leading-relaxed text-zinc-500">
              <p className="font-semibold text-zinc-700">Payment details</p>
              <p>{lh.bank}</p>
              {notes && <p className="mt-2 text-zinc-600">Notes: {notes}</p>}
            </div>

            <div className="pt-6 text-right text-xs">
              <p className="text-zinc-400">_______________________</p>
              <p className="font-semibold">{employeeName(signatoryId)}</p>
              <p className="text-zinc-500">For {lh.legalName}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* RIGHT — editor */}
      <div className="order-1 space-y-4 lg:order-2">
        <div className="flex gap-2">
          <Button className="flex-1" onClick={save} disabled={saving || validLines.length === 0}>
            <Save className="size-4" /> {saving ? "Saving…" : "Save invoice"}
          </Button>
          <Button variant="outline" className="flex-1" onClick={exportPdf} disabled={validLines.length === 0}>
            <FileDown className="size-4" /> Export PDF
          </Button>
        </div>

        <Card className="space-y-4 p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Field label="Issuing entity">
              <Select value={entityId} onChange={(e) => setEntityId(e.target.value)} className="w-full">
                {entities.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Customer (account)">
              <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="w-full">
                {accounts.length === 0 && <option value="">No accounts for this entity</option>}
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Invoice no.">
              <Input value={number} onChange={(e) => setNumber(e.target.value)} />
            </Field>
            <Field label="Signatory">
              <Select value={signatoryId} onChange={(e) => setSignatoryId(e.target.value)} className="w-full">
                {ACTIVE_EMPLOYEES.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name} — {e.designation}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Invoice date">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </Field>
            <Field label="Due date">
              <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </Field>
            <Field label="Dispatch from (warehouse)">
              <Select value={dispatchLoc} onChange={(e) => setDispatchLoc(e.target.value)} className="w-full">
                {entityLocations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          {account && (
            <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Info className="size-3.5 shrink-0" />
              {TREATMENT_LABEL[treatment]} · contact {primaryContact(account.id)?.name ?? "—"} · owner {employeeName(account.ownerId)}
            </p>
          )}

          {dispatchLines.length > 0 && (
            <p className="flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2 text-[11px] text-muted-foreground">
              <Warehouse className="size-3.5 shrink-0 text-primary" />
              On save, {dispatchLines.length} catalogue line{dispatchLines.length === 1 ? "" : "s"} will post a finished-goods{" "}
              <span className="font-medium text-foreground">dispatch (sale) movement</span> from{" "}
              {entityLocations.find((x) => x.id === dispatchLoc)?.name ?? dispatchLoc} to the stock ledger.
            </p>
          )}

          <div className="rounded-lg border border-amber-300 bg-amber-50/60 p-3 dark:bg-amber-950/20">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
              Bill-to override (optional)
            </p>
            <p className="mb-2 text-[11px] text-muted-foreground">
              Leave blank to use the account&apos;s registered details. Anything you enter here overrides the invoice
              bill-to without changing the CRM record.
            </p>
            <div className="space-y-2">
              <Input placeholder={`Name (default: ${account?.legalName ?? ""})`} value={nameOverride} onChange={(e) => setNameOverride(e.target.value)} />
              <Input placeholder={`Address (default: ${account?.city ?? ""})`} value={addressOverride} onChange={(e) => setAddressOverride(e.target.value)} />
              <Input placeholder={`GSTIN (default: ${account?.gstin ?? ""})`} value={gstinOverride} onChange={(e) => setGstinOverride(e.target.value)} />
            </div>
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Line items</p>
            <button
              onClick={() => setLines((p) => [...p, { desc: "", hsn: "", qty: 1, rate: 0, gstRate: treatment === "export" ? 0 : 5 }])}
              className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              <Plus className="size-3.5" /> Add line
            </button>
          </div>
          <datalist id="fg-skus">
            {FINISHED_ITEMS.map((it) => (
              <option key={it.id} value={it.name} />
            ))}
          </datalist>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const linked = l.itemId ? itemById(l.itemId) : undefined;
              const avail = l.itemId ? stockAt(stockIdx, l.itemId, dispatchLoc) : 0;
              const insufficient = !!linked && l.qty > avail;
              return (
                <div key={i} className="space-y-1">
                  <div className="grid grid-cols-12 items-center gap-2">
                    <Input
                      list="fg-skus"
                      placeholder="Description"
                      value={l.desc}
                      onChange={(e) => onDesc(i, e.target.value)}
                      className="col-span-12 sm:col-span-4"
                    />
                    <Input
                      placeholder="HSN"
                      value={l.hsn}
                      onChange={(e) => updateLine(i, { hsn: e.target.value })}
                      className="col-span-3 sm:col-span-2"
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Qty"
                      value={l.qty || ""}
                      onChange={(e) => updateLine(i, { qty: parseFloat(e.target.value) || 0 })}
                      className="col-span-3 sm:col-span-2"
                    />
                    <Input
                      type="number"
                      min="0"
                      placeholder="Rate"
                      value={l.rate || ""}
                      onChange={(e) => updateLine(i, { rate: parseFloat(e.target.value) || 0 })}
                      className="col-span-3 sm:col-span-2"
                    />
                    <div className="col-span-2 sm:col-span-1">
                      <Select value={String(l.gstRate)} onChange={(e) => updateLine(i, { gstRate: parseFloat(e.target.value) })} className="px-2 pr-6">
                        {GST_RATES.map((r) => (
                          <option key={r} value={r}>
                            {r}%
                          </option>
                        ))}
                      </Select>
                    </div>
                    <div className="col-span-1 flex justify-end">
                      {lines.length > 1 && (
                        <button onClick={() => setLines((p) => p.filter((_, idx) => idx !== i))} className="rounded-md p-1.5 text-muted-foreground hover:text-danger">
                          <Trash2 className="size-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  {linked && (
                    <p className={cn("flex items-center gap-1 pl-0.5 text-[11px]", insufficient ? "text-warning" : "text-muted-foreground")}>
                      <Boxes className="size-3" />
                      Stock item · {avail} {linked.uom} on hand at {entityLocations.find((x) => x.id === dispatchLoc)?.name ?? dispatchLoc}
                      {insufficient && " — will go negative"}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-3 border-t pt-3 sm:grid-cols-3">
            <Field label="Discount type">
              <Select value={discountType} onChange={(e) => setDiscountType(e.target.value as DiscountType)} className="w-full">
                <option value="none">None</option>
                <option value="amount">Flat amount</option>
                <option value="percent">Percent</option>
              </Select>
            </Field>
            <Field label="Discount value">
              <Input
                type="number"
                min="0"
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                disabled={discountType === "none"}
                placeholder={discountType === "percent" ? "%" : "amount"}
              />
            </Field>
            <div className="flex items-end">
              <div className="w-full rounded-lg border bg-muted/30 px-3 py-2 text-right">
                <span className="text-[10px] uppercase text-muted-foreground">Total </span>
                <span className="font-bold tabular-nums">
                  <Money value={totals.total} />
                </span>
              </div>
            </div>
          </div>
        </Card>

        <Card className="space-y-3 p-5">
          <Field label="Status">
            <Select value={status} onChange={(e) => setStatus(e.target.value as InvoiceStatus)} className="w-full">
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="partial">Part-paid</option>
              <option value="paid">Paid</option>
              <option value="overdue">Overdue</option>
            </Select>
          </Field>
          <Field label="Notes (optional)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Payment terms, PO reference, remarks…" />
          </Field>
        </Card>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-0.5">
      <span className="text-zinc-500">{label}</span>
      <span className="tabular-nums">
        {value < 0 ? "- " : ""}
        <Money value={Math.abs(value)} />
      </span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function esc(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}
