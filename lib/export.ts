// Tiny client-side export helpers shared across report modules. CSV download +
// a print-to-PDF window. No deps; safe to import from "use client" components.

export function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers, ...rows].map((r) => r.map(esc).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/** Open a styled print window for the given table HTML and trigger the print dialog. */
export function printDocument(title: string, bodyHtml: string) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${title}</title>
  <style>
    *{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;box-sizing:border-box}
    body{margin:28px;color:#0f172a}
    h1{font-size:18px;margin:0 0 2px}
    .sub{color:#64748b;font-size:12px;margin-bottom:16px}
    table{width:100%;border-collapse:collapse;font-size:11px}
    th,td{border:1px solid #e2e8f0;padding:5px 7px;text-align:left}
    th{background:#f1f5f9;text-transform:uppercase;font-size:9px;letter-spacing:.04em;color:#475569}
    td.n,th.n{text-align:right;font-variant-numeric:tabular-nums}
    tfoot td{font-weight:700;background:#f8fafc}
    @media print{body{margin:12mm}}
  </style></head><body>${bodyHtml}
  <script>window.onload=function(){window.print()}</script></body></html>`);
  w.document.close();
}
