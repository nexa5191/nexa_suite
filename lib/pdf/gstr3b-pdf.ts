// GSTR-3B monthly return PDF (jsPDF) — the statutory summary of output tax,
// RCM, ITC set-off and net cash payable, laid out for filing/record.

import { jsPDF } from "jspdf";
import { inr, num } from "./format";
import { headTotal, type HeadAmounts } from "@/lib/tax/gst";
import type { Gstr3b } from "@/lib/tax/returns";

export interface Gstr3bPdfData {
  scopeName: string;
  periodLabel: string;
  gstin?: string;
  r: Gstr3b;
}

const M = 40;
const RIGHT = 555;
const INK = [31, 41, 55] as const;
const MUTE = [107, 114, 128] as const;
const RULE = [209, 213, 219] as const;
const BAND = [243, 244, 246] as const;

// Description + IGST / CGST / SGST / Total
const NUMW = 75;
const NCOLS = [RIGHT - NUMW * 3, RIGHT - NUMW * 2, RIGHT - NUMW, RIGHT];

export function downloadGstr3bPdf(d: Gstr3bPdfData): void {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const { r } = d;
  const ink = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2]);
  let y = M;

  // ---- Title ----
  doc.setFont("helvetica", "bold").setFontSize(16);
  ink(INK);
  doc.text("GSTR-3B", M, y + 4);
  doc.setFont("helvetica", "normal").setFontSize(9);
  ink(MUTE);
  doc.text("Monthly return — output tax less ITC, with statutory set-off", M, y + 20);
  doc.setFont("helvetica", "bold").setFontSize(10);
  ink(INK);
  doc.text(d.periodLabel, RIGHT, y + 4, { align: "right" });
  doc.setFont("helvetica", "normal").setFontSize(9);
  ink(MUTE);
  doc.text(d.scopeName, RIGHT, y + 20, { align: "right" });
  if (d.gstin) doc.text(`GSTIN: ${d.gstin}`, RIGHT, y + 33, { align: "right" });
  y += 48;
  doc.setDrawColor(RULE[0], RULE[1], RULE[2]).line(M, y, RIGHT, y);
  y += 22;

  const headerRow = (title: string) => {
    doc.setFont("helvetica", "bold").setFontSize(9.5);
    ink(INK);
    doc.text(title, M, y);
    y += 8;
    doc.setFillColor(BAND[0], BAND[1], BAND[2]).rect(M, y, RIGHT - M, 18, "F");
    doc.setFont("helvetica", "bold").setFontSize(8);
    ink(MUTE);
    doc.text("Description", M + 4, y + 12);
    ["IGST", "CGST", "SGST", "Total"].forEach((h, i) => doc.text(h, NCOLS[i], y + 12, { align: "right" }));
    y += 18;
  };

  const amtRow = (label: string, h: HeadAmounts, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal").setFontSize(9);
    ink(INK);
    doc.text(label, M + 4, y + 12);
    const vals = [h.igst, h.cgst, h.sgst, headTotal(h)];
    vals.forEach((v, i) => doc.text(num(v), NCOLS[i], y + 12, { align: "right" }));
    y += 18;
    doc.setDrawColor(RULE[0], RULE[1], RULE[2]).line(M, y, RIGHT, y);
  };

  // ---- 3.1 Tax on outward & RCM supplies ----
  headerRow("3.1  Tax on outward & RCM supplies");
  amtRow("(a) Outward taxable supplies", r.outputTax);
  amtRow("(d) Inward — reverse charge", r.rcmTax);
  amtRow("Total output liability", r.liability, true);
  y += 8;
  doc.setFont("helvetica", "normal").setFontSize(9);
  ink(MUTE);
  doc.text(`Taxable turnover: ${inr(r.taxableOutward)}`, M, y);
  doc.text(`Exempt / zero-rated: ${inr(r.exemptOutward)}`, RIGHT, y, { align: "right" });
  y += 24;

  // ---- 4 / 6.1 ITC set-off & net payable ----
  headerRow("4 / 6.1  ITC set-off & net payable");
  amtRow("ITC available", r.itcAvailable);
  amtRow("Credit utilised", r.setoff.creditUsed);
  amtRow("Cash payable", r.setoff.cashPayable, true);
  amtRow("Credit carried forward", r.setoff.creditLeft);
  y += 18;

  // ---- Net cash highlight ----
  doc.setFillColor(BAND[0], BAND[1], BAND[2]).rect(M, y, RIGHT - M, 30, "F");
  doc.setFont("helvetica", "bold").setFontSize(10);
  ink(INK);
  doc.text("Net payable in cash (incl. RCM)", M + 10, y + 19);
  doc.setFontSize(12);
  doc.text(inr(r.netCash), RIGHT - 10, y + 20, { align: "right" });

  // ---- Footer ----
  ink(MUTE);
  doc.setFont("helvetica", "normal").setFontSize(7.5);
  doc.text("Computer-generated summary from NEXA. Verify against the GST portal before filing.", M, 800);

  doc.save(`GSTR-3B_${r.period}.pdf`);
}
