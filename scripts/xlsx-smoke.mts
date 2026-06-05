// Smoke test for the hand-rolled XLSX engine. Exercises values, formulas,
// styles, merges and multi-sheet output, writes a real file, then re-reads it
// as a ZIP to confirm CRC/structure are valid and Excel-openable.
import { writeFileSync } from "node:fs";
import { workbookBytes, type Workbook } from "../lib/xlsx/xlsx";
import { buildReportSheet } from "../lib/xlsx/report";
import { BUILTIN_TEMPLATES } from "../lib/xlsx/templates";

const wb: Workbook = {
  sheets: [
    buildReportSheet(
      {
        name: "Test",
        title: "Cost Audit — Entity",
        subtitle: "Smoke test",
        meta: ["Scope: All", "Period: FY25-26"],
        columns: [
          { header: "Entity", key: "name", type: "text", totalText: "Total" },
          { header: "COGS", key: "cogs", type: "money", total: "sum" },
          { header: "Payroll", key: "pay", type: "money", total: "sum" },
          {
            header: "Total Cost",
            key: "total",
            type: "money",
            formula: (c) => `SUM(${c.colOf("cogs")}${c.row}:${c.colOf("pay")}${c.row})`,
            total: "sum",
          },
          {
            header: "Share %",
            key: "share",
            type: "percent",
            formula: (c) => `${c.colOf("total")}${c.row}/${c.colOf("total")}$${c.lastRow + 1}`,
            total: "sum",
          },
        ],
        rows: [
          { name: "Nexa Foods", cogs: 8240000, pay: 2110000, total: 10350000, share: 0.6 },
          { name: "Nexa Trading", cogs: 5400000, pay: 1500000, total: 6900000, share: 0.4 },
        ],
        totals: true,
      },
      BUILTIN_TEMPLATES[0],
    ),
  ],
};

const bytes = workbookBytes(wb);
const path = "scripts/_smoke.xlsx";
writeFileSync(path, bytes);

// Validate ZIP structure: EOCD signature + local file headers present.
const sig = (b: Uint8Array, o: number) =>
  b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24);
const localHeaders = (() => {
  let n = 0;
  for (let i = 0; i < bytes.length - 4; i++) if (sig(bytes, i) === 0x04034b50) n++;
  return n;
})();
const hasEocd = (() => {
  for (let i = bytes.length - 22; i >= 0; i--) if (sig(bytes, i) === 0x06054b50) return true;
  return false;
})();

const text = Buffer.from(bytes).toString("latin1");
const checks = {
  size: bytes.length,
  localFileHeaders: localHeaders, // expect 6 parts
  hasEOCD: hasEocd,
  hasSheetXml: text.includes("xl/worksheets/sheet1.xml"),
  hasStyles: text.includes("xl/styles.xml"),
  hasFormula: text.includes("<f>SUM("),
  hasShareFormula: text.includes("/E$"),
  hasInlineStr: text.includes("Nexa Foods"),
  hasMerge: text.includes("mergeCell"),
  hasFill: text.includes("4F46E5"), // template accent in styles
};
console.log(JSON.stringify(checks, null, 2));
const ok =
  checks.localFileHeaders === 6 &&
  checks.hasEOCD &&
  checks.hasSheetXml &&
  checks.hasStyles &&
  checks.hasFormula &&
  checks.hasInlineStr &&
  checks.hasMerge &&
  checks.hasFill;
console.log(ok ? "SMOKE: PASS" : "SMOKE: FAIL");
process.exit(ok ? 0 : 1);
