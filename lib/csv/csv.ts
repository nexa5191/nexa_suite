// Tiny dependency-free CSV reader/writer. Handles quoted fields, embedded
// commas / newlines, doubled-quote escaping ("") and CRLF — enough for the
// spreadsheets accountants actually paste in.

/** Parse CSV text into a grid of string cells. Blank trailing lines are dropped. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  // Strip a UTF-8 BOM so the first header doesn't carry an invisible prefix.
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inQuotes) {
      if (ch === '"') {
        if (s[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++; // CRLF
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  // Flush the final field/row if the file didn't end in a newline.
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Drop entirely-empty rows (e.g. a blank line between blocks).
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const needsQuote = (s: string) => /[",\n\r]/.test(s);

/** Serialise a grid to CSV text (quoting only where required). */
export function toCsv(rows: (string | number)[][]): string {
  return rows
    .map((r) =>
      r
        .map((c) => {
          const s = String(c ?? "");
          return needsQuote(s) ? `"${s.replace(/"/g, '""')}"` : s;
        })
        .join(","),
    )
    .join("\r\n");
}

/** Trigger a browser download of CSV text. */
export function downloadCsv(filename: string, text: string): void {
  const blob = new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
