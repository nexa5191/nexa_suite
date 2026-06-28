// Standalone builder for the "NEXA vs ERP" comparison workbook.
// Ports the project's dependency-free XLSX + ZIP writer (lib/xlsx) to plain JS
// so it runs under Node with no install. Emits a styled, multi-sheet .xlsx with
// live formulas where useful.

import { writeFileSync } from "node:fs";

// ===========================================================================
// ZIP (store method) — ported from lib/xlsx/zip.ts
// ===========================================================================
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function strBytes(s) { return new TextEncoder().encode(s); }
function concat(parts) {
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
function zipSync(entries) {
  const chunks = [], central = [];
  let offset = 0;
  const u16 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff]);
  const u32 = (n) => new Uint8Array([n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]);
  for (const e of entries) {
    const nameBytes = strBytes(e.name);
    const crc = crc32(e.data);
    const size = e.data.length;
    const local = concat([
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0x21),
      u32(crc), u32(size), u32(size), u16(nameBytes.length), u16(0), nameBytes, e.data,
    ]);
    chunks.push(local);
    central.push(concat([
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0x21),
      u32(crc), u32(size), u32(size), u16(nameBytes.length),
      u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset), nameBytes,
    ]));
    offset += local.length;
  }
  const centralBytes = concat(central);
  const eocd = concat([
    u32(0x06054b50), u16(0), u16(0), u16(entries.length), u16(entries.length),
    u32(centralBytes.length), u32(offset), u16(0),
  ]);
  return concat([...chunks, centralBytes, eocd]);
}

// ===========================================================================
// XLSX writer — ported from lib/xlsx/xlsx.ts
// ===========================================================================
function esc(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function colLetter(i) {
  let s = "", n = i;
  do { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; } while (n >= 0);
  return s;
}
function cellRef(r, c) { return `${colLetter(c)}${r + 1}`; }
function isCellObj(x) { return x !== null && typeof x === "object"; }

class StyleRegistry {
  constructor() {
    this.numFmts = new Map(); this.fonts = new Map(); this.fills = new Map();
    this.borders = new Map(); this.xfs = new Map();
    this.xfList = []; this.fontList = []; this.fillList = []; this.borderList = [];
    this.numFmtList = []; this.nextNumFmtId = 164;
    this.fontList.push(`<font><sz val="11"/><name val="Calibri"/></font>`);
    this.fillList.push(`<fill><patternFill patternType="none"/></fill>`);
    this.fillList.push(`<fill><patternFill patternType="gray125"/></fill>`);
    this.borderList.push(`<border><left/><right/><top/><bottom/><diagonal/></border>`);
    this.xfList.push(`<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`);
    this.xfs.set("__default__", 0);
  }
  numFmtId(code) {
    if (!code) return 0;
    if (this.numFmts.has(code)) return this.numFmts.get(code);
    const id = this.nextNumFmtId++;
    this.numFmts.set(code, id); this.numFmtList.push({ id, code });
    return id;
  }
  fontId(s) {
    const name = s.fontName || "Calibri";
    const key = `${s.bold ? 1 : 0}|${s.italic ? 1 : 0}|${s.fontColor ?? ""}|${s.fontSize ?? 11}|${name}`;
    if (this.fonts.has(key)) return this.fonts.get(key);
    const parts = [`<sz val="${s.fontSize ?? 11}"/>`, `<name val="${esc(name)}"/>`];
    if (s.bold) parts.unshift("<b/>");
    if (s.italic) parts.unshift("<i/>");
    if (s.fontColor) parts.push(`<color rgb="FF${s.fontColor}"/>`);
    const id = this.fontList.length;
    this.fontList.push(`<font>${parts.join("")}</font>`);
    this.fonts.set(key, id);
    return id;
  }
  fillId(hex) {
    if (!hex) return 0;
    if (this.fills.has(hex)) return this.fills.get(hex);
    const id = this.fillList.length;
    this.fillList.push(`<fill><patternFill patternType="solid"><fgColor rgb="FF${hex}"/><bgColor indexed="64"/></patternFill></fill>`);
    this.fills.set(hex, id);
    return id;
  }
  borderId(kind) {
    if (!kind || kind === "none") return 0;
    if (this.borders.has(kind)) return this.borders.get(kind);
    const bottom = `<bottom style="thin"><color rgb="FFD1D5DB"/></bottom>`;
    const top = `<top style="thin"><color rgb="FFD1D5DB"/></top>`;
    let inner = "<left/><right/><top/><bottom/>";
    if (kind === "all") inner = `<left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right>${top}${bottom}`;
    else if (kind === "bottom") inner = `<left/><right/><top/>${bottom}`;
    else if (kind === "top") inner = `<left/><right/>${top}<bottom/>`;
    else if (kind === "topbottom") inner = `<left/><right/>${top}${bottom}`;
    const id = this.borderList.length;
    this.borderList.push(`<border>${inner}<diagonal/></border>`);
    this.borders.set(kind, id);
    return id;
  }
  styleId(s) {
    if (!s) return 0;
    const numFmtId = this.numFmtId(s.numFmt);
    const fontId = this.fontId(s);
    const fillId = this.fillId(s.fill);
    const borderId = this.borderId(s.border);
    const hasAlign = s.align || s.vAlign || s.wrap || s.indent;
    const alignXml = hasAlign
      ? `<alignment${s.align ? ` horizontal="${s.align}"` : ""}${s.vAlign ? ` vertical="${s.vAlign}"` : ""}${s.wrap ? ` wrapText="1"` : ""}${s.indent ? ` indent="${s.indent}"` : ""}/>`
      : "";
    const key = `${numFmtId}|${fontId}|${fillId}|${borderId}|${alignXml}`;
    if (this.xfs.has(key)) return this.xfs.get(key);
    const id = this.xfList.length;
    this.xfList.push(`<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"${hasAlign ? ' applyAlignment="1"' : ""}>${alignXml}</xf>`);
    this.xfs.set(key, id);
    return id;
  }
  toXml() {
    const numFmts = this.numFmtList.length
      ? `<numFmts count="${this.numFmtList.length}">${this.numFmtList.map((n) => `<numFmt numFmtId="${n.id}" formatCode="${esc(n.code)}"/>`).join("")}</numFmts>`
      : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${numFmts}<fonts count="${this.fontList.length}">${this.fontList.join("")}</fonts><fills count="${this.fillList.length}">${this.fillList.join("")}</fills><borders count="${this.borderList.length}">${this.borderList.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${this.xfList.length}">${this.xfList.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}
function cellXml(r, c, input, reg) {
  const ref = cellRef(r, c);
  let value, formula, style;
  if (isCellObj(input)) { value = input.value; formula = input.formula; style = input.style; }
  else { value = input; }
  const s = reg.styleId(style);
  const sAttr = s ? ` s="${s}"` : "";
  if (formula != null) {
    const cached = typeof value === "number" ? `<v>${value}</v>` : typeof value === "string" ? `<v>${esc(value)}</v>` : "";
    const t = typeof value === "string" ? ` t="str"` : "";
    return `<c r="${ref}"${sAttr}${t}><f>${esc(formula)}</f>${cached}</c>`;
  }
  if (value == null || value === "") return s ? `<c r="${ref}"${sAttr}/>` : "";
  if (typeof value === "number") return `<c r="${ref}"${sAttr}><v>${value}</v></c>`;
  if (typeof value === "boolean") return `<c r="${ref}"${sAttr} t="b"><v>${value ? 1 : 0}</v></c>`;
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(String(value))}</t></is></c>`;
}
function sheetXml(sheet, reg) {
  const fr = sheet.freeze;
  let views;
  if (fr && (fr.rows || fr.cols)) {
    const x = fr.cols ?? 0, y = fr.rows ?? 0;
    const topLeft = cellRef(y, x);
    const active = y && x ? "bottomRight" : y ? "bottomLeft" : "topRight";
    views = `<sheetViews><sheetView workbookViewId="0"><pane${x ? ` xSplit="${x}"` : ""}${y ? ` ySplit="${y}"` : ""} topLeftCell="${topLeft}" activePane="${active}" state="frozen"/></sheetView></sheetViews>`;
  } else {
    views = `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  }
  const cols = sheet.cols?.length
    ? `<cols>${sheet.cols.map((c, i) => (c?.width ? `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>` : "")).join("")}</cols>`
    : "";
  const rowsXml = sheet.rows.map((row, r) => {
    const cells = row.map((cell, c) => cellXml(r, c, cell, reg)).join("");
    const h = sheet.rowHeights?.[r + 1];
    const hAttr = h ? ` ht="${h}" customHeight="1"` : "";
    return `<row r="${r + 1}"${hAttr}>${cells}</row>`;
  }).join("");
  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>`
    : "";
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${views}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rowsXml}</sheetData>${merges}</worksheet>`;
}
function workbookBytes(wb) {
  const reg = new StyleRegistry();
  const sheetParts = wb.sheets.map((s) => sheetXml(s, reg));
  const styleXml = reg.toXml();
  const sheetEntries = wb.sheets.map((s, i) => `<sheet name="${esc(s.name.slice(0, 31) || `Sheet${i + 1}`)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>`;
  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wb.sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join("")}<Relationship Id="rId${wb.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${wb.sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")}</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const entries = [
    { name: "[Content_Types].xml", data: strBytes(contentTypes) },
    { name: "_rels/.rels", data: strBytes(rootRels) },
    { name: "xl/workbook.xml", data: strBytes(workbookXml) },
    { name: "xl/_rels/workbook.xml.rels", data: strBytes(workbookRels) },
    { name: "xl/styles.xml", data: strBytes(styleXml) },
    ...sheetParts.map((xml, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: strBytes(xml) })),
  ];
  return zipSync(entries);
}

// ===========================================================================
// Palette & style helpers
// ===========================================================================
const NAVY = "0F2C4D", BLUE = "1D4ED8", INK = "1F2937", SLATE = "475569", MUTE = "64748B";
const HEAD = "1E3A8A", BAND = "EEF2FF", NEXACOL = "DBEAFE";
const GREEN = "DCFCE7", GREENF = "166534";
const AMBER = "FEF3C7", AMBERF = "92400E";
const RED = "FEE2E2", REDF = "991B1B";

const title = (t) => ({ value: t, style: { bold: true, fontSize: 22, fontColor: "FFFFFF", fill: NAVY, vAlign: "center" } });
const sub = (t) => ({ value: t, style: { fontSize: 11, fontColor: "DBEAFE", fill: NAVY, vAlign: "center" } });
const h = (t, fill = HEAD) => ({ value: t, style: { bold: true, fontColor: "FFFFFF", fill, vAlign: "center", wrap: true, border: "all" } });
const sectionBar = (t) => ({ value: t, style: { bold: true, fontSize: 13, fontColor: NAVY, fill: BAND, vAlign: "center" } });
const tc = (t, extra = {}) => ({ value: t, style: { fontColor: INK, vAlign: "top", wrap: true, border: "all", ...extra } });
const tcMute = (t) => ({ value: t, style: { fontColor: SLATE, vAlign: "top", wrap: true, border: "all", italic: true } });
const nexaCell = (t) => ({ value: t, style: { fontColor: INK, vAlign: "top", wrap: true, border: "all", fill: NEXACOL, bold: true } });

// rating cell: Y / P / N -> colored mark
function rate(code) {
  const map = {
    Y: { value: "●  Native", fill: GREEN, fontColor: GREENF },
    P: { value: "◐  Partial", fill: AMBER, fontColor: AMBERF },
    N: { value: "○  None", fill: RED, fontColor: REDF },
  };
  const m = map[code] || map.N;
  return { value: m.value, style: { fontColor: m.fontColor, fill: m.fill, align: "center", vAlign: "center", border: "all", bold: code === "Y" } };
}

// ===========================================================================
// CONTENT
// ===========================================================================
const GENERATED = "2026-06-28";
// Column order: NEXA, then each of these (8 products)
const PRODUCTS = ["SAP S/4HANA", "Tally", "Tally Prime", "Zoho Books", "Odoo", "QuickBooks", "Oracle NetSuite", "Dynamics 365"];

// ---- Sheet 1: Cover ----
function coverSheet() {
  const rows = [];
  rows.push([title("NEXA — Feature & Best-Practice Benchmark")]);
  rows.push([sub("India-first integrated finance & ERP suite  ·  competitive comparison")]);
  rows.push([{ value: `Generated ${GENERATED}`, style: { fontColor: "BFDBFE", fill: NAVY } }]);
  rows.push([""]);
  rows.push([sectionBar("What this workbook contains")]);
  const toc = [
    ["1 · Feature Inventory", "Every NEXA module & capability, with the accounting/engineering best practice it demonstrates"],
    ["2 · Competitive Matrix", "54 capabilities scored for NEXA vs SAP S/4HANA, Tally, Tally Prime, Zoho Books, Odoo, QuickBooks, NetSuite, and Microsoft Dynamics 365"],
    ["3 · Where NEXA Wins", "The specific places NEXA leads or matches tier-1 ERP, and why"],
    ["4 · Best Practices", "The design & accounting disciplines baked into NEXA"],
    ["5 · Scorecard", "Native-feature tally per product (live formulas)"],
  ];
  for (const [a, b] of toc) {
    rows.push([{ value: a, style: { bold: true, fontColor: BLUE, border: "bottom", vAlign: "top" } },
               { value: b, style: { fontColor: SLATE, wrap: true, border: "bottom", vAlign: "top" } }]);
  }
  rows.push([""]);
  rows.push([sectionBar("Legend")]);
  rows.push([rate("Y"), { value: "Native / strong, out-of-the-box", style: { fontColor: INK } }]);
  rows.push([rate("P"), { value: "Partial — add-on, extra licence, separate app, or localisation module", style: { fontColor: INK } }]);
  rows.push([rate("N"), { value: "None / very limited", style: { fontColor: INK } }]);
  rows.push([""]);
  rows.push([{ value: "Positioning note", style: { bold: true, fontColor: NAVY } }]);
  rows.push([{ value: "NEXA is an integrated, India-statutory-first finance suite (a client-side SPA). The comparison below is about functional design, compliance depth and UX — areas where NEXA matches or beats far heavier products — not about backend scale or infrastructure, where tier-1 ERPs (SAP, NetSuite, Dynamics 365) remain the enterprise systems of record.", style: { fontColor: SLATE, wrap: true, vAlign: "top" } }]);
  return {
    name: "Cover",
    cols: [{ width: 34 }, { width: 86 }],
    merges: ["A1:B1", "A2:B2", "A3:B3", "A5:B5", "A14:B14", "A19:B19", "A20:B20"],
    rowHeights: { 1: 40, 2: 20, 20: 70 },
    rows,
  };
}

// ---- Sheet 2: Feature Inventory ----
const INVENTORY = [
  ["Accounting & General Ledger", [
    ["Real double-entry GL", "Every action posts a balanced voucher through one JournalProvider — subledgers always tie to the GL", "Single posting path = guaranteed integrity"],
    ["Voucher types", "Payment, Receipt, Contra, Journal, Sales, Purchase and Asset (capitalisation) vouchers", "Mirrors classic Tally voucher model"],
    ["Chart of Accounts", "Structured COA incl. GRNI (2015), Inter-co Rec/Pay (1320/2020), Petty Cash (1015), Reimb. Payable (2310), GST Input (1300)", "Purpose-built control accounts"],
    ["Journal Entries", "Manual multi-line journal entry UI that posts live to the ledger", "Free-form adjustments with validation"],
    ["General Ledger register", "Account-wise ledger with drill-down and running balances", "Audit-ready trail"],
    ["Accounting periods", "Period model used across reports and postings", "Period-aware reporting"],
    ["Petty Cash Book", "Real vouchers — petty expense = payment (Cr 1015), top-up = contra (Dr 1015 / Cr bank)", "Not a side-ledger — true GL"],
    ["Reimbursements", "Approve posts an accrual (Cr 2310); pay posts a payment (Dr 2310 / Cr bank)", "Accrual-correct employee claims"],
    ["Bank Reconciliation", "Match bank lines to book entries", "Treasury control"],
  ]],
  ["Tax & Compliance (India)", [
    ["GST split engine", "CGST / SGST / IGST split by place-of-supply, plus UTGST with Union-Territory detection", "UTGST is rare even in big ERPs"],
    ["GST returns", "GSTR-1, GSTR-3B and GSTR-9 that reconcile (UTGST folded into the SGST head)", "Filing-grade reconciliation"],
    ["GST Registers", "Sales/Purchase registers: invoice-wise, by-rate, HSN-wise, and a filing-claim (ITC) map", "ITC matching built in"],
    ["HSN / RCM", "HSN summary and reverse-charge (RCM) handling", "Statutory schedules"],
    ["TDS", "TDS by section incl. lower-deduction certificate (sec.197) and TDS receivable", "Sec.197 LDC seldom automated"],
    ["MSME 45-day aging", "Sec.43B(h) aging view driven by Udyam / MSME class on vendors", "Newest India compliance, built in"],
  ]],
  ["Procure-to-Pay & Vendors", [
    ["3-way match P2P", "PO → GRN → Invoice → Payment, each posting a real voucher", "Enterprise-grade control"],
    ["GRNI clearing", "Goods-Received-Not-Invoiced clearing account between GRN and invoice", "Accrual-accurate procurement"],
    ["Capex GRN auto-capitalises", "A capex GRN automatically creates the fixed asset and capitalisation voucher", "Removes manual capitalisation gap"],
    ["GST-inclusive PO", "PO total treated GST-inclusive so AP reconciles with Pay Bills", "Reconciliation by design"],
    ["Vendor master & classes", "Vendors bucketed Inventory / Opex / Capex / Employee with nested categories", "Drives posting & analytics"],
    ["Pay Bills / AP aging", "Bill payment workflow with payables aging", "Cash-flow visibility"],
  ]],
  ["Sales, Inventory & Revenue", [
    ["CRM pipeline", "Lead / opportunity pipeline feeding revenue", "Front-of-funnel in the same app"],
    ["Sales Orders", "Order-to-cash with sales-by-channel analysis", "OTC trail"],
    ["Invoicing & AR", "Customer invoicing with receive-payment and receivables", "Revenue recognition bridge"],
    ["Inventory", "Items and stock movements with valuation", "Linked to P2P & GL"],
  ]],
  ["Fixed Assets", [
    ["Asset register", "Fixed-asset register tied to the GL gross block via capitalisation vouchers", "Register ↔ GL always tie"],
    ["Dual-book depreciation", "Companies Act Schedule II (posts to GL) + Income-Tax block WDV with half-year rule + custom basis", "Books vs tax in one place"],
    ["Asset detail / disposal", "Per-asset schedule, WDV and disposal handling", "Lifecycle tracking"],
  ]],
  ["Group, Treasury & Multi-entity", [
    ["Inter-company auto-mirror", "One IC txn posts BOTH sides — provider (Dr 1320) and receiver (Cr 2020) — automatically", "Tier-1 ERP automation"],
    ["Consolidation & eliminations", "Group reporting with inter-company eliminations", "Consolidated view"],
    ["Multi-entity", "Multiple companies under one group", "Holding-company ready"],
  ]],
  ["Professional Services", [
    ["Engagements", "Project / engagement accounting", "Services P&L"],
    ["Timesheets", "Time capture against engagements", "Billable utilisation"],
  ]],
  ["Planning & Analysis", [
    ["Budget & Forecast", "Budgeting and forecasting against actuals", "Plan vs actual"],
    ["Capital Decisions", "Capital-investment appraisal (capex decisioning)", "Rare in accounting tools"],
    ["Business Plan", "Structured business-plan model", "Strategy in-suite"],
    ["Cost Audit", "Cost analysis / audit views", "Statutory cost audit lens"],
    ["Report Explorer", "Ad-hoc report heads (GST, TDS, Sales, Procurement w/ live P2P stage, Assets) on shared entity/date/search filters", "Self-serve analytics"],
  ]],
  ["People & HR", [
    ["HR & Directory", "HR overview and employee directory", "People system of record"],
    ["Attendance / Leave / Holidays", "Attendance, leave and holiday calendars", "Workforce admin"],
    ["Payroll", "Payroll processing", "Pay run in-suite"],
    ["CV Bank (ATS)", "Applicant / CV bank for recruitment", "Hiring funnel"],
    ["Agency Portal", "External recruiter / agency portal", "Vendor-side collaboration — rare"],
    ["Approvals", "Approvals workflow with a global approvals bell", "Controls & SoD"],
  ]],
  ["Automation & Controls", [
    ["Command palette", "Ctrl/⌘+K RBAC-filtered navigation with per-user configurable shortcuts", "Keyboard-first power use"],
    ["Bank auto-match", "UTR-first, confidence-tiered reconciliation suggestions (propose / auto-match)", "Cuts manual ticking"],
    ["Bulk CSV import", "Import journals from CSV via a postMany bulk-posting path", "Fast data onboarding / migration"],
    ["PDF export", "Reports via browser print; invoices & GSTR-3B via jsPDF (dynamically imported)", "Share-ready documents"],
    ["Auto-post recurring GL", "Depreciation and payroll post to the GL idempotently (deterministic narration)", "No double-posting, less manual JV"],
    ["3-way match auto-approval", "PO↔Invoice (and GRN) auto-approved within a 2% tolerance, writing to the approvals store", "Touchless AP for clean matches"],
    ["Maker-checker tax filing", "Open → in-review → filed trail with segregation-of-duties (preparer ≠ approver)", "Audit-grade filing control"],
  ]],
  ["Platform & Experience", [
    ["Modular provisioning", "Turn each function on/off per tenant from a setup page", "Pay-for-what-you-use shape"],
    ["RBAC + Mimic", "Roles on a rank ladder, per-module grants, elevate/de-elevate, and 'mimic' view-as", "See exactly what a user sees"],
    ["Native XLSX export", "Zero-dependency Excel writer with LIVE FORMULAS, styling, frozen panes & merges", "Boardroom workbooks that recompute"],
    ["Office-like shell", "Ribbon + sidebar + mobile nav, theming, calendar, tasks, documents, connections", "Familiar, fast UX"],
    ["Company setup wizard", "Guided org/setup configuration", "Fast onboarding"],
  ]],
];
function inventorySheet() {
  const rows = [];
  rows.push([title("1 · NEXA Feature Inventory")]);
  rows.push([sub("Every module and capability, with the best practice it demonstrates")]);
  rows.push([""]);
  rows.push([h("Module"), h("Capability"), h("What it does"), h("Best practice / why it matters")]);
  for (const [group, feats] of INVENTORY) {
    rows.push([sectionBar(group), { value: "", style: { fill: BAND } }, { value: "", style: { fill: BAND } }, { value: "", style: { fill: BAND } }]);
    for (const [cap, does, bp] of feats) {
      rows.push([tcMute(group), tc(cap, { bold: true }), tc(does), tc(bp, { fontColor: GREENF })]);
    }
  }
  return {
    name: "1 · Feature Inventory",
    cols: [{ width: 26 }, { width: 26 }, { width: 64 }, { width: 40 }],
    freeze: { rows: 4 },
    merges: ["A1:D1", "A2:D2"],
    rowHeights: { 1: 34, 2: 18 },
    rows,
  };
}

// ---- Sheet 3: Competitive Matrix ----
// Row format: [capability, NEXA, SAP, Tally, TallyPrime, Zoho, Odoo, QuickBooks, NetSuite, Dynamics365, note]
// codes = indices 1..9 (9 entries: NEXA + 8 products), note = index 10
const MATRIX = [
  ["Accounting core", [
    ["Double-entry general ledger",                        "Y","Y","Y","Y","Y","Y","Y","Y","Y", "Baseline — NEXA matches all"],
    ["Real-voucher posting behind every subledger action", "Y","Y","Y","Y","P","P","P","Y","Y", "Petty cash, reimb., P2P, IC, assets ALL post real vouchers"],
    ["Bank reconciliation",                                "Y","Y","Y","Y","Y","Y","Y","Y","Y", "Standard everywhere"],
    ["Petty cash book",                                    "Y","P","Y","Y","P","P","P","P","P", "Real contra/payment vouchers, not a memo ledger"],
    ["Employee reimbursements (accrual)",                  "Y","Y","P","P","Y","Y","P","Y","Y", "Accrual on approve, payment on pay"],
    ["Multi-entity / group ledgers",                       "Y","Y","Y","Y","P","Y","P","Y","Y", "Group + inter-company native"],
  ]],
  ["India statutory tax", [
    ["GST CGST/SGST/IGST",                                "Y","Y","Y","Y","Y","P","N","P","P", "Built-in vs localisation add-ons"],
    ["UTGST (Union Territory GST)",                        "Y","P","Y","Y","Y","P","N","P","P", "Explicit UT detection + return folding"],
    ["GSTR-1 / 3B / 9 returns",                           "Y","P","Y","Y","Y","P","N","P","P", "Reconciling returns out-of-box"],
    ["GST registers + ITC / filing-claim map",             "Y","P","Y","Y","Y","P","N","P","P", "Invoice/rate/HSN-wise registers"],
    ["TDS incl. sec.197 lower-deduction cert",             "Y","P","Y","Y","Y","P","N","P","P", "LDC rate auto-applied"],
    ["MSME 45-day aging (sec.43B(h))",                     "Y","N","P","Y","P","N","N","N","N", "Newest rule — most rivals lack it"],
    ["RCM / reverse charge + HSN summary",                 "Y","P","Y","Y","Y","P","N","P","P", "Statutory schedules native"],
  ]],
  ["Fixed assets", [
    ["Fixed-asset register",                               "Y","Y","P","Y","P","Y","P","Y","Y", "Tied to GL gross block"],
    ["Companies Act Schedule II depreciation",             "Y","P","P","P","P","P","N","P","P", "Posts the book charge to GL"],
    ["Income-Tax block WDV + half-year rule",              "Y","P","P","P","N","N","N","P","P", "Tax book alongside the book book"],
    ["Capex GRN auto-capitalises asset",                   "Y","Y","N","N","N","P","N","P","Y", "Procurement → asset with no rekey"],
  ]],
  ["Procure-to-Pay", [
    ["Purchase orders",                                    "Y","Y","Y","Y","Y","Y","P","Y","Y", "—"],
    ["3-way match (PO/GRN/invoice)",                       "Y","Y","P","P","P","Y","N","Y","Y", "Enterprise control in a light app"],
    ["GRNI (goods received not invoiced) clearing",        "Y","Y","N","P","N","Y","N","Y","Y", "Accrual-accurate, tier-1 pattern"],
    ["Vendor classes drive posting",                       "Y","Y","P","P","P","P","P","P","Y", "Inventory/Opex/Capex/Employee buckets"],
    ["AP aging / pay bills",                               "Y","Y","Y","Y","Y","Y","Y","Y","Y", "—"],
  ]],
  ["Order-to-cash & inventory", [
    ["CRM / sales pipeline",                               "Y","Y","N","N","P","Y","P","Y","Y", "In-suite, not a separate purchase"],
    ["Sales orders & sales-by-channel",                    "Y","Y","Y","Y","Y","Y","P","Y","Y", "—"],
    ["Customer invoicing & AR",                            "Y","Y","Y","Y","Y","Y","Y","Y","Y", "—"],
    ["Inventory items & movements",                        "Y","Y","Y","Y","Y","Y","P","Y","Y", "Linked to P2P + GL"],
  ]],
  ["Group & consolidation", [
    ["Inter-company transactions",                         "Y","Y","P","P","P","P","N","Y","Y", "—"],
    ["Inter-company auto-mirror (both sides post)",        "Y","Y","N","N","N","P","N","Y","Y", "Sale in A = purchase in B automatically"],
    ["Consolidation + eliminations",                       "Y","Y","P","P","P","P","N","Y","Y", "Group reporting native"],
  ]],
  ["Services, planning & analysis", [
    ["Project / engagement accounting",                    "Y","Y","N","N","P","Y","P","Y","Y", "Services P&L"],
    ["Timesheets",                                         "Y","Y","N","N","P","Y","P","Y","Y", "Billable time"],
    ["Budget & forecast",                                  "Y","Y","P","P","P","P","P","Y","Y", "Plan vs actual"],
    ["Capital-investment appraisal / decisions",           "Y","P","N","N","N","N","N","P","P", "Almost unique at this tier"],
    ["Business plan model",                                "Y","P","N","N","N","N","N","P","N", "Strategy in-suite"],
    ["Cost audit",                                         "Y","Y","P","P","N","P","N","Y","P", "Statutory cost lens"],
    ["Ad-hoc report explorer",                             "Y","Y","P","Y","P","P","P","Y","Y", "Shared filters across heads"],
  ]],
  ["People & HR", [
    ["Payroll",                                            "Y","Y","P","P","P","Y","P","P","P", "In-suite pay run"],
    ["Leave / attendance / holidays",                      "Y","Y","P","P","P","Y","N","P","P", "Workforce admin"],
    ["Recruitment / CV bank (ATS)",                        "Y","Y","N","N","P","Y","N","P","P", "Hiring in the same suite"],
    ["External agency / recruiter portal",                 "Y","P","N","N","N","P","N","P","N", "Rare even in big ERP"],
    ["Approvals workflow",                                 "Y","Y","P","P","Y","Y","P","Y","Y", "With global approvals bell"],
  ]],
  ["Automation & controls", [
    ["Command palette (⌘K) with RBAC filtering",           "Y","Y","N","N","P","P","N","Y","N", "Keyboard-first nav, per-user shortcuts"],
    ["Bank auto-match (UTR / confidence-tiered)",           "Y","Y","N","P","Y","Y","Y","Y","Y", "Auto-suggests reconciliation matches"],
    ["Bulk CSV import to journals",                         "Y","Y","P","Y","Y","Y","Y","Y","Y", "postMany bulk posting path"],
    ["PDF export (invoices, GSTR-3B)",                      "Y","Y","Y","Y","Y","Y","Y","Y","Y", "jsPDF, dynamically imported"],
    ["Auto-post recurring GL (depreciation, payroll)",      "Y","Y","P","P","P","P","P","Y","Y", "Idempotent, deterministic narration"],
    ["3-way match auto-approval (tolerance-based)",         "Y","Y","N","N","N","P","N","Y","Y", "Touchless AP within 2% tolerance"],
    ["Maker-checker w/ segregation-of-duties",              "Y","Y","P","P","P","P","P","Y","Y", "Preparer ≠ approver enforced"],
  ]],
  ["Platform & experience", [
    ["RBAC roles + 'mimic' view-as",                       "Y","Y","P","P","Y","Y","P","Y","Y", "Admin sees exactly what a user sees"],
    ["Modular per-function provisioning",                   "Y","Y","P","P","P","Y","P","Y","Y", "Turn functions on/off per tenant"],
    ["Native Excel export w/ LIVE formulas",               "Y","P","P","P","P","P","P","P","P", "Workbooks recompute on open"],
    ["Web / zero-install",                                  "Y","P","N","P","Y","Y","Y","Y","Y", "Browser-native"],
    ["Modern Office-like UX (ribbon, mobile)",              "Y","P","P","Y","P","P","Y","P","Y", "Familiar & fast"],
    ["Low cost / no implementation project",               "Y","N","P","P","Y","P","Y","N","N", "Instant vs months of rollout"],
  ]],
];
function matrixSheet() {
  const rows = [];
  rows.push([title("2 · Competitive Matrix")]);
  rows.push([sub("● Native   ◐ Partial / add-on   ○ None — see Cover for legend")]);
  rows.push([""]);
  const header = [h("Capability"), h("NEXA", BLUE), ...PRODUCTS.map((p) => h(p)), h("NEXA edge", "065F46")];
  rows.push(header);
  for (const [group, feats] of MATRIX) {
    const bandRow = [sectionBar(group)];
    for (let i = 0; i < PRODUCTS.length + 2; i++) bandRow.push({ value: "", style: { fill: BAND } });
    rows.push(bandRow);
    for (const f of feats) {
      const cap = f[0];
      const codes = f.slice(1, 10); // 9 codes: NEXA + 8 products
      const note = f[10];
      const r = [tc(cap, { bold: true })];
      // NEXA col highlighted
      r.push({ ...rate(codes[0]), style: { ...rate(codes[0]).style, fill: codes[0] === "Y" ? "BBF7D0" : rate(codes[0]).style.fill } });
      for (let i = 1; i < codes.length; i++) r.push(rate(codes[i]));
      r.push(tc(note, { fontColor: GREENF, italic: true }));
      rows.push(r);
    }
  }
  const totalCols = 2 + PRODUCTS.length + 1; // Cap + NEXA + products + note
  const lastCol = colLetter(totalCols - 1);
  const cols = [{ width: 40 }, { width: 13 }, ...PRODUCTS.map(() => ({ width: 12 })), { width: 46 }];
  return {
    name: "2 · Competitive Matrix",
    cols,
    freeze: { rows: 4, cols: 1 },
    merges: [`A1:${lastCol}1`, `A2:${lastCol}2`],
    rowHeights: { 1: 34, 2: 18, 4: 30 },
    rows,
  };
}

// ---- Sheet 4: Where NEXA Wins ----
const WINS = [
  ["India compliance depth, out-of-the-box",
   "UTGST with Union-Territory detection, GSTR-1/3B/9 that reconcile, invoice/rate/HSN registers + ITC map, TDS sec.197 LDC, and MSME sec.43B(h) 45-day aging.",
   "Matches Tally/Zoho on Indian statutory and goes further (MSME 43B(h), sec.197 LDC) — while bundling full ERP breadth those tools don't have. SAP/NetSuite/Dynamics 365 need paid localisation; QuickBooks dropped India entirely."],
  ["Everything posts real double-entry",
   "Petty cash, reimbursements, P2P (PO/GRN/invoice/pay), inter-company, and asset capitalisation each post balanced vouchers through one engine.",
   "No orphan subledgers — books always tie to the GL. Many SMB tools keep petty cash / expenses / assets as side-records that drift from the ledger."],
  ["Tier-1 automation in a light package",
   "3-way match with GRNI clearing, capex-GRN that auto-capitalises a fixed asset, and inter-company auto-mirror (one txn posts both entities).",
   "These are the controls you normally only get after a six-figure SAP/NetSuite/Dynamics implementation — here with zero setup."],
  ["Dual-book fixed assets",
   "Companies Act Schedule II charge posts to the GL while Income-Tax block WDV (with the half-year rule) runs in parallel, plus a custom basis.",
   "Book vs tax depreciation in one place; most SMB tools offer a single basis and no IT block logic."],
  ["Planning & decisioning in the same suite",
   "Budget & forecast, capital-investment appraisal, a business-plan model and cost audit sit beside the ledgers.",
   "Capex appraisal and business planning are essentially absent from Tally/Zoho/QuickBooks and are add-ons even in SAP/NetSuite/Dynamics 365."],
  ["Automation that removes the grunt work",
   "Command palette (⌘K), UTR-first bank auto-match, bulk CSV import, auto-posted depreciation & payroll (idempotent), and 3-way-match auto-approval within tolerance.",
   "Touchless AP, hands-off recurring postings and keyboard-first navigation are usually NetSuite/SAP-tier — here with no implementation project. Tally/QuickBooks have none of the auto-posting or auto-approval logic."],
  ["Audit-grade controls",
   "Maker-checker tax filing with an open→in-review→filed trail and enforced segregation-of-duties (preparer ≠ approver), plus PDF export of invoices and GSTR-3B.",
   "Segregation-of-duties on statutory filing is a genuine governance control most SMB tools simply don't offer."],
  ["Boardroom Excel, natively",
   "A zero-dependency XLSX engine emits styled workbooks with LIVE formulas, frozen panes and merges (this file was built with it).",
   "Rivals export static values; NEXA exports models that recompute in Excel/Sheets/LibreOffice."],
  ["Governance built in",
   "RBAC on a role-rank ladder with per-module grants, two-layer access (tenant provisioning + role), and 'mimic' to view-as any user.",
   "Mimic/view-as and per-function provisioning are enterprise-grade controls rarely found in SMB accounting tools."],
  ["One suite, not a bundle of apps",
   "Finance, tax, P2P, group, CRM, orders, inventory, projects, HR, recruitment and an agency portal in a single application.",
   "Zoho needs Books+CRM+People+Recruit+Expense+Projects as separate apps; Dynamics 365 spreads across Finance, BC, Sales, HR and Project Operations modules; QuickBooks needs add-ons. NEXA is unified."],
  ["Instant & low cost",
   "Web-native, no install, no multi-month rollout, no licence stack.",
   "SAP/NetSuite/Dynamics 365 are large implementation projects costing months and significant professional-services fees; Tally is desktop-bound. NEXA runs in a browser immediately."],
];
function winsSheet() {
  const rows = [];
  rows.push([title("3 · Where NEXA Wins")]);
  rows.push([sub("The specific places NEXA leads or matches tier-1 ERP — and why")]);
  rows.push([""]);
  rows.push([h("Advantage"), h("What NEXA does"), h("Why it beats / matches the rest")]);
  for (const [a, b, c] of WINS) {
    rows.push([tc(a, { bold: true, fontColor: NAVY }), tc(b), tc(c, { fontColor: GREENF })]);
  }
  rows.push([""]);
  rows.push([{ value: "Honest caveat", style: { bold: true, fontColor: AMBERF, fill: AMBER, border: "all" } },
             { value: "NEXA is a client-side SPA (browser localStorage), so it is not yet a multi-user, server-backed system of record at SAP/NetSuite/Dynamics scale. Its edge is functional design, India-compliance depth and UX — not infrastructure or enterprise data volume.", style: { fontColor: AMBERF, fill: AMBER, wrap: true, border: "all", vAlign: "top" } },
             { value: "", style: { fill: AMBER, border: "all" } }]);
  return {
    name: "3 · Where NEXA Wins",
    cols: [{ width: 32 }, { width: 60 }, { width: 60 }],
    freeze: { rows: 4 },
    merges: ["A1:C1", "A2:C2"],
    rowHeights: { 1: 34, 2: 18 },
    rows,
  };
}

// ---- Sheet 5: Best Practices ----
const PRACTICES = [
  ["Single posting path", "All modules post through one JournalProvider", "Subledgers can never drift from the GL"],
  ["GRNI clearing", "Goods-received-not-invoiced account between GRN and invoice", "Accruals are accurate before the bill arrives"],
  ["GST-inclusive PO", "PO totals treated inclusive so taxable = total / (1+rate)", "AP reconciles cleanly with Pay Bills"],
  ["Dual-book depreciation", "Only the Companies Act charge posts to GL; IT block WDV runs in parallel", "Books and tax stay correct and separate"],
  ["UTGST folding", "UTGST folded into the SGST head in returns", "GSTR-3B/9 still reconcile while the UT column is exercised"],
  ["Half-year rule", "Income-tax depreciation applies the half-year convention on additions", "Tax depreciation is statutorily correct"],
  ["Access keyed on stable keys", "RBAC/provisioning keyed on item keys, never URLs", "Permissions survive route renames"],
  ["Two-layer access", "Tenant provisioning AND role grant must both pass", "Clean separation of 'switched on' vs 'allowed'"],
  ["Mimic / view-as", "Admins act as another user to verify their exact view", "Safe permission debugging"],
  ["Deterministic seed data", "Seed datasets are deterministic (e.g. ~9% intra-UT recast)", "Demos and tests are reproducible"],
  ["Live-formula exports", "Excel exports carry formulas, not just values", "Recipients can audit and flex the numbers"],
  ["Capex GRN → asset", "Capex receipt auto-creates the asset + capitalisation voucher", "Gross block always ties to procurement & GL"],
  ["Idempotent auto-posting", "Recurring depreciation/payroll postings detect an existing voucher by deterministic narration", "Re-running a period never double-posts"],
  ["Tolerance-based auto-approval", "3-way match auto-approves only within a 2% tolerance; the rest route to a human", "Automation without losing control"],
  ["Segregation of duties", "Tax filing enforces preparer ≠ approver across the open→review→filed trail", "Audit-grade governance on statutory filings"],
  ["Lean PDF bundles", "jsPDF is dynamically imported on click", "Heavy export libs never bloat the base route"],
];
function practicesSheet() {
  const rows = [];
  rows.push([title("4 · Best Practices Baked In")]);
  rows.push([sub("The accounting & engineering disciplines NEXA demonstrates")]);
  rows.push([""]);
  rows.push([h("Practice"), h("How NEXA implements it"), h("Payoff")]);
  for (const [a, b, c] of PRACTICES) {
    rows.push([tc(a, { bold: true, fontColor: NAVY }), tc(b), tc(c, { fontColor: GREENF })]);
  }
  return {
    name: "4 · Best Practices",
    cols: [{ width: 30 }, { width: 58 }, { width: 50 }],
    freeze: { rows: 4 },
    merges: ["A1:C1", "A2:C2"],
    rowHeights: { 1: 34, 2: 18 },
    rows,
  };
}

// ---- Sheet 6: Scorecard (live formulas) ----
function scorecardSheet() {
  // Count native (Y) per product directly from MATRIX data.
  const allRows = MATRIX.flatMap(([, feats]) => feats);
  const products = ["NEXA", ...PRODUCTS];
  const rows = [];
  rows.push([title("5 · Scorecard")]);
  rows.push([sub("Native-feature counts across the matrix (cells drive the totals — edit ratings and they recompute)")]);
  rows.push([""]);
  // header
  rows.push([h("Capability"), ...products.map((p, i) => h(p, i === 0 ? BLUE : HEAD))]);
  const firstDataRow = 5; // 1-based
  allRows.forEach((f) => {
    const cap = f[0];
    const codes = f.slice(1, 10); // 9 codes: NEXA + 8 products
    const r = [tc(cap)];
    codes.forEach((c, i) => {
      // store numeric weight 1/0.5/0 so totals are live & meaningful
      const w = c === "Y" ? 1 : c === "P" ? 0.5 : 0;
      const fill = c === "Y" ? GREEN : c === "P" ? AMBER : RED;
      const fc = c === "Y" ? GREENF : c === "P" ? AMBERF : REDF;
      r.push({ value: w, style: { align: "center", border: "all", fill, fontColor: fc, numFmt: "0.0;;\"\"" } });
    });
    rows.push(r);
  });
  const lastDataRow = firstDataRow + allRows.length - 1;
  // totals row with live SUM formulas
  const totalRow = [{ value: "WEIGHTED SCORE (Native=1, Partial=0.5)", style: { bold: true, fill: NAVY, fontColor: "FFFFFF", border: "all" } }];
  products.forEach((_, i) => {
    const col = colLetter(i + 1); // B..
    totalRow.push({ formula: `SUM(${col}${firstDataRow}:${col}${lastDataRow})`, value: 0, style: { bold: true, fill: NAVY, fontColor: "FFFFFF", align: "center", border: "all", numFmt: "0.0" } });
  });
  rows.push(totalRow);
  // percentage row
  const pctRow = [{ value: "% of max", style: { bold: true, fill: BAND, fontColor: NAVY, border: "all" } }];
  const totalsRowIdx = lastDataRow + 1;
  products.forEach((_, i) => {
    const col = colLetter(i + 1);
    pctRow.push({ formula: `${col}${totalsRowIdx}/${allRows.length}`, value: 0, style: { bold: true, fill: BAND, fontColor: NAVY, align: "center", border: "all", numFmt: "0%" } });
  });
  rows.push(pctRow);
  const lastScoreCol = colLetter(products.length); // K with 10 products
  const cols = [{ width: 42 }, ...products.map(() => ({ width: 13 }))];
  return {
    name: "5 · Scorecard",
    cols,
    freeze: { rows: 4, cols: 1 },
    merges: [`A1:${lastScoreCol}1`, `A2:${lastScoreCol}2`],
    rowHeights: { 1: 34, 2: 30, 4: 28 },
    rows,
  };
}

// ===========================================================================
// Build
// ===========================================================================
const wb = {
  creator: "NEXA",
  sheets: [coverSheet(), inventorySheet(), matrixSheet(), winsSheet(), practicesSheet(), scorecardSheet()],
};
const bytes = workbookBytes(wb);
const out = process.argv[2] || "NEXA-vs-ERP-Comparison.xlsx";
writeFileSync(out, Buffer.from(bytes));
console.log(`Wrote ${out} — ${bytes.length} bytes, ${wb.sheets.length} sheets`);
