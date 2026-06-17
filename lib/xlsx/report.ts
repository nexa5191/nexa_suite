// High-level report → workbook bridge. Modules describe a report as columns +
// rows (and optional live formulas / totals); this lays it out and skins it with
// the chosen ExcelTemplate, so every module exports a consistent, branded sheet.

import {
  type XlsxSheet,
  type XlsxStyle,
  type XlsxCell,
  type CellInput,
  type Workbook,
  colLetter,
  downloadXlsx,
} from "./xlsx";
import type { ExcelTemplate } from "./templates";

export type ColType = "text" | "number" | "money" | "integer" | "percent" | "ratio";

export interface ReportColumn {
  header: string;
  key?: string; // property read from each row object
  type?: ColType;
  width?: number;
  align?: "left" | "center" | "right";
  /** Live formula for a body cell. Receives the Excel row and the data range. */
  formula?: (ctx: FormulaCtx) => string;
  /** Totals-row cell: "sum" of the column, a custom formula, literal text, or none. */
  total?: "sum" | "blank" | ((ctx: TotalCtx) => string);
  totalText?: string;
}

export interface FormulaCtx {
  row: number; // 1-based Excel row of this body cell
  firstRow: number; // first body row (Excel)
  lastRow: number; // last body row (Excel)
  col: string; // this column's letter
  colOf: (key: string) => string; // letter of another column by key/header
  data: Record<string, unknown>;
  index: number; // 0-based data index
}

export interface TotalCtx {
  firstRow: number;
  lastRow: number;
  col: string;
  colOf: (key: string) => string;
}

export interface ReportSheet {
  name: string;
  title?: string;
  subtitle?: string;
  meta?: string[]; // small grey lines under the title (scope, period, basis…)
  columns: ReportColumn[];
  rows: Array<Record<string, CellInput>>;
  totals?: boolean; // render a totals row from column.total specs
  notes?: string[]; // footnotes below the table
}

function numFmt(type: ColType | undefined, sym: string, decimals = 0): string | undefined {
  const dec = decimals > 0 ? "." + "0".repeat(decimals) : "";
  switch (type) {
    case "money": {
      const p = sym ? `"${sym}"` : "";
      return `${p}#,##0${dec};[Red]${p}-#,##0${dec}`;
    }
    case "integer":
      return "#,##0";
    case "number":
      return `#,##0.${"0".repeat(Math.max(2, decimals))}`;
    case "percent":
      return "0.0%";
    case "ratio":
      return "0.00";
    default:
      return undefined;
  }
}

function alignFor(type: ColType | undefined, override?: ReportColumn["align"]): XlsxStyle["align"] {
  if (override) return override;
  return type && type !== "text" ? "right" : "left";
}

export function buildReportSheet(spec: ReportSheet, t: ExcelTemplate): XlsxSheet {
  const rows: CellInput[][] = [];
  const ncol = spec.columns.length;
  const lastColLetter = colLetter(ncol - 1);
  const merges: string[] = [];

  const font = t.fontName || "Calibri";
  const dec = t.moneyDecimals ?? 0;

  // ---- Title block -------------------------------------------------------
  let cursor = 0;
  if (t.showTitleBlock) {
    if (spec.title) {
      rows.push([
        { value: spec.title, style: { bold: true, fontName: font, fontSize: t.fontSize + 6, fontColor: t.titleColor } },
      ]);
      merges.push(`A${rows.length}:${lastColLetter}${rows.length}`);
    }
    if (spec.subtitle) {
      rows.push([{ value: spec.subtitle, style: { fontName: font, fontColor: "6B7280", fontSize: t.fontSize } }]);
      merges.push(`A${rows.length}:${lastColLetter}${rows.length}`);
    }
    for (const m of spec.meta ?? []) {
      rows.push([{ value: m, style: { fontName: font, fontColor: "9CA3AF", fontSize: t.fontSize - 1 } }]);
      merges.push(`A${rows.length}:${lastColLetter}${rows.length}`);
    }
    rows.push([]); // spacer
  }

  // ---- Header row --------------------------------------------------------
  const headerStyle: XlsxStyle = {
    bold: t.headerBold ?? true,
    italic: t.headerItalic ?? false,
    fill: t.accent,
    fontColor: t.headerText,
    fontName: font,
    fontSize: t.fontSize,
    border: t.borders ? "all" : "none",
  };
  const headerRowExcel = rows.length + 1;
  rows.push(
    spec.columns.map((c) => ({
      value: c.header,
      style: { ...headerStyle, align: alignFor(c.type, c.align) === "right" ? "right" : "left", wrap: true },
    })),
  );

  const firstDataRow = rows.length + 1;
  const colLetterByIndex = (i: number) => colLetter(i);
  const keyToLetter = new Map<string, string>();
  spec.columns.forEach((c, i) => {
    keyToLetter.set(c.header, colLetterByIndex(i));
    if (c.key) keyToLetter.set(c.key, colLetterByIndex(i));
  });
  const colOf = (k: string) => keyToLetter.get(k) ?? "A";

  // ---- Body rows ---------------------------------------------------------
  const lastDataRow = firstDataRow + spec.rows.length - 1;
  spec.rows.forEach((dataRow, ri) => {
    const excelRow = firstDataRow + ri;
    const band = t.bandColor && ri % 2 === 1 ? t.bandColor : undefined;
    const cells: CellInput[] = spec.columns.map((col, ci) => {
      const base: XlsxStyle = {
        fontName: font,
        fontSize: t.fontSize,
        fontColor: t.bodyText,
        bold: t.bodyBold,
        italic: t.bodyItalic,
        numFmt: numFmt(col.type, t.currencySymbol, dec),
        align: alignFor(col.type, col.align),
        fill: band,
        border: t.borders ? "all" : "none",
      };
      if (col.formula) {
        const f = col.formula({
          row: excelRow,
          firstRow: firstDataRow,
          lastRow: lastDataRow,
          col: colLetterByIndex(ci),
          colOf,
          data: dataRow,
          index: ri,
        });
        // An empty formula means "no formula here" — fall through to the literal.
        if (f) {
          return {
            formula: f,
            value:
              typeof dataRow[col.key ?? col.header] === "number"
                ? (dataRow[col.key ?? col.header] as number)
                : undefined,
            style: base,
          };
        }
      }
      const raw = dataRow[col.key ?? col.header];
      // raw can already be an XlsxCell (e.g. caller-supplied formula); merge style.
      if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
        const cell = raw as XlsxCell;
        return { ...cell, style: { ...base, ...cell.style } };
      }
      return { value: raw as Exclude<CellInput, XlsxCell>, style: base };
    });
    rows.push(cells);
  });

  // ---- Totals row --------------------------------------------------------
  if (spec.totals) {
    const totalStyle: XlsxStyle = {
      bold: t.totalBold ?? true,
      italic: t.totalItalic ?? false,
      fill: t.totalFill,
      fontColor: t.totalText,
      fontName: font,
      fontSize: t.fontSize,
      border: t.borders ? "all" : "topbottom",
    };
    const cells: CellInput[] = spec.columns.map((col, ci) => {
      const style: XlsxStyle = {
        ...totalStyle,
        numFmt: numFmt(col.type, t.currencySymbol, dec),
        align: alignFor(col.type, col.align),
      };
      const letter = colLetterByIndex(ci);
      if (col.totalText !== undefined) return { value: col.totalText, style };
      if (col.total === "sum") {
        return { formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`, style };
      }
      if (typeof col.total === "function") {
        return {
          formula: col.total({ firstRow: firstDataRow, lastRow: lastDataRow, col: letter, colOf }),
          style,
        };
      }
      return { value: "", style };
    });
    rows.push(cells);
  }

  // ---- Notes -------------------------------------------------------------
  if (spec.notes?.length) {
    rows.push([]);
    for (const n of spec.notes) {
      rows.push([{ value: n, style: { italic: true, fontName: font, fontColor: "9CA3AF", fontSize: t.fontSize - 1 } }]);
      merges.push(`A${rows.length}:${lastColLetter}${rows.length}`);
    }
  }

  return {
    name: spec.name,
    rows,
    cols: spec.columns.map((c) => ({ width: c.width ?? (c.type && c.type !== "text" ? 15 : 22) })),
    merges,
    freeze: { rows: headerRowExcel },
    rowHeights: { [headerRowExcel]: 22 },
  };
}

export function downloadReport(filename: string, sheets: ReportSheet[], t: ExcelTemplate) {
  const wb: Workbook = { sheets: sheets.map((s) => buildReportSheet(s, t)), creator: "NEXA" };
  downloadXlsx(filename, wb);
}
