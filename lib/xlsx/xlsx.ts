// Tiny, dependency-free XLSX (SpreadsheetML) writer. Supports cell values,
// live formulas, number formats, fonts/fills/borders/alignment, column widths,
// merged cells and frozen panes — enough to emit boardroom-grade workbooks that
// recompute when opened in Excel / Google Sheets / LibreOffice.
//
// Strings are written inline (t="inlineStr") so we need no sharedStrings part.

import { zipSync, strBytes, type ZipEntry } from "./zip";

export type CellValue = number | string | boolean | null | undefined;

export interface XlsxStyle {
  bold?: boolean;
  italic?: boolean;
  fontColor?: string; // hex "1F2937" (no #)
  fontSize?: number;
  fill?: string; // hex background fill
  numFmt?: string; // e.g. "#,##0", "0.0%", "₹#,##0"
  align?: "left" | "center" | "right";
  vAlign?: "top" | "center" | "bottom";
  wrap?: boolean;
  border?: "none" | "bottom" | "top" | "all" | "topbottom";
  indent?: number;
}

export interface XlsxCell {
  value?: CellValue;
  formula?: string; // without leading "="
  style?: XlsxStyle;
}

export type CellInput = CellValue | XlsxCell;

export interface XlsxSheet {
  name: string;
  rows: CellInput[][];
  cols?: { width: number }[];
  merges?: string[]; // ["A1:E1"]
  freeze?: { rows?: number; cols?: number };
  /** Default row height for header etc. (points) */
  rowHeights?: Record<number, number>; // 1-based row index -> height
}

export interface Workbook {
  sheets: XlsxSheet[];
  creator?: string;
}

// ---------------------------------------------------------------------------
// XML helpers
// ---------------------------------------------------------------------------
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function colLetter(i: number): string {
  // 0-based index -> A, B, ... Z, AA, ...
  let s = "";
  let n = i;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function cellRef(r: number, c: number): string {
  return `${colLetter(c)}${r + 1}`;
}

function isCellObj(x: CellInput): x is XlsxCell {
  return x !== null && typeof x === "object";
}

// ---------------------------------------------------------------------------
// Style registry — dedupes styles into the parts of styles.xml
// ---------------------------------------------------------------------------
class StyleRegistry {
  private numFmts = new Map<string, number>();
  private fonts = new Map<string, number>();
  private fills = new Map<string, number>();
  private borders = new Map<string, number>();
  private xfs = new Map<string, number>();
  private xfList: string[] = [];
  private fontList: string[] = [];
  private fillList: string[] = [];
  private borderList: string[] = [];
  private numFmtList: { id: number; code: string }[] = [];
  private nextNumFmtId = 164;

  constructor() {
    // Required base entries.
    this.fontList.push(`<font><sz val="11"/><name val="Calibri"/></font>`);
    this.fillList.push(`<fill><patternFill patternType="none"/></fill>`);
    this.fillList.push(`<fill><patternFill patternType="gray125"/></fill>`);
    this.borderList.push(`<border><left/><right/><top/><bottom/><diagonal/></border>`);
    // xf 0 = default
    this.xfList.push(`<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>`);
    this.xfs.set("__default__", 0);
  }

  private numFmtId(code?: string): number {
    if (!code) return 0;
    if (this.numFmts.has(code)) return this.numFmts.get(code)!;
    const id = this.nextNumFmtId++;
    this.numFmts.set(code, id);
    this.numFmtList.push({ id, code });
    return id;
  }

  private fontId(s: XlsxStyle): number {
    const key = `${s.bold ? 1 : 0}|${s.italic ? 1 : 0}|${s.fontColor ?? ""}|${s.fontSize ?? 11}`;
    if (this.fonts.has(key)) return this.fonts.get(key)!;
    const parts = [`<sz val="${s.fontSize ?? 11}"/>`, `<name val="Calibri"/>`];
    if (s.bold) parts.unshift("<b/>");
    if (s.italic) parts.unshift("<i/>");
    if (s.fontColor) parts.push(`<color rgb="FF${s.fontColor}"/>`);
    const id = this.fontList.length;
    this.fontList.push(`<font>${parts.join("")}</font>`);
    this.fonts.set(key, id);
    return id;
  }

  private fillId(hex?: string): number {
    if (!hex) return 0;
    if (this.fills.has(hex)) return this.fills.get(hex)!;
    const id = this.fillList.length;
    this.fillList.push(
      `<fill><patternFill patternType="solid"><fgColor rgb="FF${hex}"/><bgColor indexed="64"/></patternFill></fill>`,
    );
    this.fills.set(hex, id);
    return id;
  }

  private borderId(kind?: XlsxStyle["border"]): number {
    if (!kind || kind === "none") return 0;
    if (this.borders.has(kind)) return this.borders.get(kind)!;
    const line = `<top style="thin"><color rgb="FFD1D5DB"/></top>`;
    const bottom = `<bottom style="thin"><color rgb="FFD1D5DB"/></bottom>`;
    const top = `<top style="thin"><color rgb="FFD1D5DB"/></top>`;
    let inner = "<left/><right/><top/><bottom/>";
    if (kind === "all")
      inner = `<left style="thin"><color rgb="FFD1D5DB"/></left><right style="thin"><color rgb="FFD1D5DB"/></right>${top}${bottom}`;
    else if (kind === "bottom") inner = `<left/><right/><top/>${bottom}`;
    else if (kind === "top") inner = `<left/><right/>${top}<bottom/>`;
    else if (kind === "topbottom") inner = `<left/><right/>${top}${bottom}`;
    const id = this.borderList.length;
    this.borderList.push(`<border>${inner}<diagonal/></border>`);
    this.borders.set(kind, id);
    return id;
  }

  styleId(s?: XlsxStyle): number {
    if (!s) return 0;
    const numFmtId = this.numFmtId(s.numFmt);
    const fontId = this.fontId(s);
    const fillId = this.fillId(s.fill);
    const borderId = this.borderId(s.border);
    const hasAlign = s.align || s.vAlign || s.wrap || s.indent;
    const alignXml = hasAlign
      ? `<alignment${s.align ? ` horizontal="${s.align}"` : ""}${
          s.vAlign ? ` vertical="${s.vAlign}"` : ""
        }${s.wrap ? ` wrapText="1"` : ""}${s.indent ? ` indent="${s.indent}"` : ""}/>`
      : "";
    const key = `${numFmtId}|${fontId}|${fillId}|${borderId}|${alignXml}`;
    if (this.xfs.has(key)) return this.xfs.get(key)!;
    const id = this.xfList.length;
    this.xfList.push(
      `<xf numFmtId="${numFmtId}" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyNumberFormat="1"${
        hasAlign ? ' applyAlignment="1"' : ""
      }>${alignXml}</xf>`,
    );
    this.xfs.set(key, id);
    return id;
  }

  toXml(): string {
    const numFmts = this.numFmtList.length
      ? `<numFmts count="${this.numFmtList.length}">${this.numFmtList
          .map((n) => `<numFmt numFmtId="${n.id}" formatCode="${esc(n.code)}"/>`)
          .join("")}</numFmts>`
      : "";
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${numFmts}<fonts count="${this.fontList.length}">${this.fontList.join(
      "",
    )}</fonts><fills count="${this.fillList.length}">${this.fillList.join(
      "",
    )}</fills><borders count="${this.borderList.length}">${this.borderList.join(
      "",
    )}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="${this.xfList.length}">${this.xfList.join(
      "",
    )}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  }
}

// ---------------------------------------------------------------------------
// Worksheet serialization
// ---------------------------------------------------------------------------
function cellXml(r: number, c: number, input: CellInput, reg: StyleRegistry): string {
  const ref = cellRef(r, c);
  let value: CellValue;
  let formula: string | undefined;
  let style: XlsxStyle | undefined;
  if (isCellObj(input)) {
    value = input.value;
    formula = input.formula;
    style = input.style;
  } else {
    value = input;
  }
  const s = reg.styleId(style);
  const sAttr = s ? ` s="${s}"` : "";

  if (formula != null) {
    const cached =
      typeof value === "number"
        ? `<v>${value}</v>`
        : typeof value === "string"
          ? `<v>${esc(value)}</v>`
          : "";
    const t = typeof value === "string" ? ` t="str"` : "";
    return `<c r="${ref}"${sAttr}${t}><f>${esc(formula)}</f>${cached}</c>`;
  }
  if (value == null || value === "") return s ? `<c r="${ref}"${sAttr}/>` : "";
  if (typeof value === "number") {
    return `<c r="${ref}"${sAttr}><v>${value}</v></c>`;
  }
  if (typeof value === "boolean") {
    return `<c r="${ref}"${sAttr} t="b"><v>${value ? 1 : 0}</v></c>`;
  }
  return `<c r="${ref}"${sAttr} t="inlineStr"><is><t xml:space="preserve">${esc(
    String(value),
  )}</t></is></c>`;
}

function sheetXml(sheet: XlsxSheet, reg: StyleRegistry): string {
  const fr = sheet.freeze;
  let views = "";
  if (fr && (fr.rows || fr.cols)) {
    const x = fr.cols ?? 0;
    const y = fr.rows ?? 0;
    const topLeft = cellRef(y, x);
    const active = y && x ? "bottomRight" : y ? "bottomLeft" : "topRight";
    views = `<sheetViews><sheetView workbookViewId="0"><pane${x ? ` xSplit="${x}"` : ""}${
      y ? ` ySplit="${y}"` : ""
    } topLeftCell="${topLeft}" activePane="${active}" state="frozen"/></sheetView></sheetViews>`;
  } else {
    views = `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  }

  const cols = sheet.cols?.length
    ? `<cols>${sheet.cols
        .map((c, i) =>
          c?.width
            ? `<col min="${i + 1}" max="${i + 1}" width="${c.width}" customWidth="1"/>`
            : "",
        )
        .join("")}</cols>`
    : "";

  const rowsXml = sheet.rows
    .map((row, r) => {
      const cells = row.map((cell, c) => cellXml(r, c, cell, reg)).join("");
      const h = sheet.rowHeights?.[r + 1];
      const hAttr = h ? ` ht="${h}" customHeight="1"` : "";
      return `<row r="${r + 1}"${hAttr}>${cells}</row>`;
    })
    .join("");

  const merges = sheet.merges?.length
    ? `<mergeCells count="${sheet.merges.length}">${sheet.merges
        .map((m) => `<mergeCell ref="${m}"/>`)
        .join("")}</mergeCells>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${views}<sheetFormatPr defaultRowHeight="15"/>${cols}<sheetData>${rowsXml}</sheetData>${merges}</worksheet>`;
}

// ---------------------------------------------------------------------------
// Workbook assembly
// ---------------------------------------------------------------------------
export function workbookBytes(wb: Workbook): Uint8Array {
  const reg = new StyleRegistry();
  const sheetParts = wb.sheets.map((s) => sheetXml(s, reg));
  const styleXml = reg.toXml();

  const sheetEntries = wb.sheets
    .map(
      (s, i) =>
        `<sheet name="${esc(s.name.slice(0, 31) || `Sheet${i + 1}`)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
    )
    .join("");

  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets>${sheetEntries}</sheets><calcPr calcId="0" fullCalcOnLoad="1"/></workbook>`;

  const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${wb.sheets
    .map(
      (_, i) =>
        `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`,
    )
    .join("")}<Relationship Id="rId${wb.sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;

  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${wb.sheets
    .map(
      (_, i) =>
        `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("")}</Types>`;

  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;

  const entries: ZipEntry[] = [
    { name: "[Content_Types].xml", data: strBytes(contentTypes) },
    { name: "_rels/.rels", data: strBytes(rootRels) },
    { name: "xl/workbook.xml", data: strBytes(workbookXml) },
    { name: "xl/_rels/workbook.xml.rels", data: strBytes(workbookRels) },
    { name: "xl/styles.xml", data: strBytes(styleXml) },
    ...sheetParts.map((xml, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: strBytes(xml),
    })),
  ];

  return zipSync(entries);
}

export function workbookBlob(wb: Workbook): Blob {
  // Copy into a fresh ArrayBuffer-backed view so the Blob is happy across TS libs.
  const bytes = workbookBytes(wb);
  return new Blob([bytes.slice().buffer as ArrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

export function downloadXlsx(filename: string, wb: Workbook): void {
  const blob = workbookBlob(wb);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
