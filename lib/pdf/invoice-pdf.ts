// Pixel-locked GST tax-invoice PDF (jsPDF). Independent of the browser's print
// engine so it renders identically wherever it's opened or emailed.

import { jsPDF } from "jspdf";
import { inr, num } from "./format";
import type { InvoiceLine, InvoiceTotals, Letterhead, GstTreatment } from "@/lib/invoicing";

export interface InvoicePdfData {
  letterhead: Letterhead;
  number: string;
  date: string;
  dueDate: string;
  billTo: { name: string; address: string; gstin: string };
  treatment: GstTreatment;
  lines: InvoiceLine[];
  totals: InvoiceTotals;
  notes: string;
  amountWords: string;
}

const M = 40; // page margin
const RIGHT = 555; // page width (595) − margin
const INK = [31, 41, 55] as const; // slate-800
const MUTE = [107, 114, 128] as const; // slate-500
const RULE = [209, 213, 219] as const; // slate-300
const BAND = [243, 244, 246] as const; // slate-100

const treatmentLabel = (t: GstTreatment) =>
  t === "export" ? "Export (zero-rated under LUT)" : t === "intra" ? "Intra-state supply" : "Inter-state supply";

export function downloadInvoicePdf(d: InvoicePdfData): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const lh = d.letterhead;
  let y = M;

  const setInk = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);

  // ---- Header: seller (left) + TAX INVOICE (right) ----
  doc.setFont("helvetica", "bold").setFontSize(16);
  setInk(INK);
  doc.text(lh.name, M, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  setInk(MUTE);
  let hy = y + 20;
  doc.text(lh.legalName, M, hy);
  const addr = doc.splitTextToSize(lh.address, 300);
  doc.text(addr, M, hy + 12);
  hy += 12 + addr.length * 11;
  if (lh.gstin) doc.text(`GSTIN: ${lh.gstin}`, M, hy);

  doc.setFont("helvetica", "bold").setFontSize(15);
  setInk(INK);
  doc.text("TAX INVOICE", RIGHT, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9);
  setInk(MUTE);
  doc.text(`Invoice  ${d.number}`, RIGHT, y + 22, { align: "right" });
  doc.text(`Date  ${d.date}`, RIGHT, y + 35, { align: "right" });
  doc.text(`Due  ${d.dueDate}`, RIGHT, y + 48, { align: "right" });

  y = Math.max(hy, y + 48) + 18;
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]).line(M, y, RIGHT, y);
  y += 18;

  // ---- Bill-to + treatment ----
  doc.setFont("helvetica", "bold").setFontSize(8);
  setInk(MUTE);
  doc.text("BILL TO", M, y);
  doc.text("SUPPLY", RIGHT, y, { align: "right" });
  doc.setFont("helvetica", "bold").setFontSize(10.5);
  setInk(INK);
  doc.text(d.billTo.name, M, y + 15);
  doc.setFont("helvetica", "normal").setFontSize(8.5);
  setInk(MUTE);
  let by = y + 28;
  if (d.billTo.address) {
    const ba = doc.splitTextToSize(d.billTo.address, 300);
    doc.text(ba, M, by);
    by += ba.length * 11;
  }
  doc.text(`GSTIN: ${d.billTo.gstin}`, M, by);
  doc.text(treatmentLabel(d.treatment), RIGHT, y + 15, { align: "right" });
  y = Math.max(by, y + 28) + 20;

  // ---- Line-item table ----
  // columns: Description | HSN | Qty | Rate | GST% | Amount
  const cols = [
    { x: M, w: 232, align: "left" as const, label: "Description" },
    { x: M + 232, w: 55, align: "left" as const, label: "HSN" },
    { x: M + 287, w: 50, align: "right" as const, label: "Qty" },
    { x: M + 337, w: 75, align: "right" as const, label: "Rate" },
    { x: M + 412, w: 40, align: "right" as const, label: "GST" },
    { x: RIGHT, w: 0, align: "right" as const, label: "Amount" },
  ];
  const colText = (i: number, s: string, ty: number) => {
    const c = cols[i];
    const x = c.align === "right" ? c.x + c.w : c.x;
    doc.text(s, x, ty, { align: c.align });
  };

  doc.setFillColor(BAND[0], BAND[1], BAND[2]).rect(M, y, RIGHT - M, 20, "F");
  doc.setFont("helvetica", "bold").setFontSize(8.5);
  setInk(INK);
  cols.forEach((_, i) => colText(i, cols[i].label, y + 13));
  y += 20;

  doc.setFont("helvetica", "normal").setFontSize(9);
  for (const l of d.lines) {
    const descLines = doc.splitTextToSize(l.desc, cols[0].w - 6);
    const rowH = Math.max(18, descLines.length * 11 + 7);
    setInk(INK);
    doc.text(descLines, cols[0].x, y + 12);
    colText(1, l.hsn, y + 12);
    colText(2, String(l.qty), y + 12);
    colText(3, num(l.rate), y + 12);
    colText(4, `${l.gstRate}%`, y + 12);
    colText(5, num(l.qty * l.rate), y + 12);
    y += rowH;
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]).line(M, y, RIGHT, y);
  }
  y += 14;

  // ---- Totals (right column) ----
  const t = d.totals;
  const lx = 360;
  const totalRow = (label: string, value: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(bold ? 11 : 9.5);
    setInk(bold ? INK : MUTE);
    doc.text(label, lx, y);
    setInk(INK);
    doc.text(value, RIGHT, y, { align: "right" });
    y += bold ? 18 : 15;
  };
  totalRow("Subtotal", inr(t.subtotal));
  if (t.discountAmt > 0) totalRow("Discount", "- " + inr(t.discountAmt));
  if (t.cgst > 0) totalRow("CGST", inr(t.cgst));
  if (t.sgst > 0) totalRow("SGST", inr(t.sgst));
  if (t.igst > 0) totalRow("IGST", inr(t.igst));
  if (t.treatment === "export") totalRow("GST", "Zero-rated");
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]).line(lx, y - 2, RIGHT, y - 2);
  y += 8;
  totalRow("Total", inr(t.total), true);

  // ---- Amount in words ----
  y += 6;
  doc.setFont("helvetica", "italic").setFontSize(9);
  setInk(MUTE);
  const words = doc.splitTextToSize(`Amount in words: ${d.amountWords}`, RIGHT - M);
  doc.text(words, M, y);
  y += words.length * 11 + 14;

  // ---- Bank + notes ----
  if (lh.bank) {
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text("PAYMENT", M, y);
    doc.setFont("helvetica", "normal").setFontSize(8.5);
    const bank = doc.splitTextToSize(lh.bank, RIGHT - M);
    doc.text(bank, M, y + 12);
    y += 12 + bank.length * 11 + 8;
  }
  if (d.notes) {
    doc.setFont("helvetica", "bold").setFontSize(8);
    doc.text("NOTES", M, y);
    doc.setFont("helvetica", "normal").setFontSize(8.5);
    const notes = doc.splitTextToSize(d.notes, RIGHT - M);
    doc.text(notes, M, y + 12);
    y += 12 + notes.length * 11;
  }

  // ---- Signatory + footer ----
  doc.setFont("helvetica", "normal").setFontSize(9);
  setInk(INK);
  doc.text(`For ${lh.legalName}`, RIGHT, 720, { align: "right" });
  doc.setFontSize(8.5);
  setInk(MUTE);
  doc.text("Authorised Signatory", RIGHT, 760, { align: "right" });
  doc.setFontSize(7.5);
  doc.text("This is a computer-generated invoice.", M, 800);

  doc.save(`${d.number.replace(/[\\/]/g, "-")}.pdf`);
}
