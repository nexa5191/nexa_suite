// ---------------------------------------------------------------------------
// Tally XML Export — generates a Tally-compatible XML data file from NEXA
// vouchers so they can be imported into Tally Prime / Tally ERP 9.
//
// Tally XML format (TallyPrime 3.x):
//   <ENVELOPE>
//     <HEADER>…</HEADER>
//     <BODY>
//       <IMPORTDATA>
//         <REQUESTDESC>…</REQUESTDESC>
//         <REQUESTDATA>
//           <TALLYMESSAGE xmlns:UDF="TallyUDF">
//             <VOUCHER>…</VOUCHER>  (one per journal entry)
//           </TALLYMESSAGE>
//         </REQUESTDATA>
//       </IMPORTDATA>
//     </BODY>
//   </ENVELOPE>
//
// Ledger names must match exactly what exists in the target Tally company.
// NEXA account codes are mapped to canonical Tally ledger names below.
// ---------------------------------------------------------------------------

import { allPostings } from "@/lib/accounting/ledger";
import { accountSafe } from "@/lib/accounting/chart-of-accounts";

// Map NEXA account codes to Tally canonical ledger names.
export const NEXA_TO_TALLY: Record<string, string> = {
  "1010": "Cash",
  "1015": "Petty Cash",
  "1020": "HDFC Bank Current A/c",
  "1030": "EEFC Account (Forex)",
  "1100": "Sundry Debtors",
  "1200": "Stock-in-Trade",
  "1300": "GST Input Credit",
  "1310": "TDS Receivable",
  "1320": "Inter Company Receivable",
  "1400": "Prepaid Expenses",
  "1500": "Plant & Machinery",
  "1510": "Furniture & Fixtures",
  "1590": "Accumulated Depreciation",
  "2010": "Sundry Creditors",
  "2015": "GRNI Clearing",
  "2020": "Inter Company Payable",
  "2100": "GST Output Payable",
  "2200": "TDS Payable",
  "2300": "Salaries Payable",
  "2310": "Employee Reimbursements",
  "2400": "Advance from Customers",
  "2700": "Term Loan",
  "3010": "Share Capital",
  "3100": "Retained Earnings",
  "3200": "Drawings",
  "4010": "Product Sales",
  "4020": "Service Revenue",
  "4030": "Export Sales",
  "4040": "Sales Returns",
  "4900": "Other Income",
  "5010": "Purchases",
  "5020": "Freight Inward",
  "5030": "Purchase Returns",
  "5040": "Job Work Charges",
  "5050": "Third-party Purchases",
  "6010": "Salaries & Wages",
  "6020": "Rent",
  "6030": "Utilities",
  "6035": "Office & Admin Expenses",
  "6040": "Marketing Expenses",
  "6050": "Professional Fees",
  "6060": "Software Expenses",
  "6070": "Travelling Expenses",
  "6080": "Depreciation",
  "6900": "Bank Charges",
};

export type TallyVoucherType = "Journal" | "Receipt" | "Payment" | "Contra" | "Sales" | "Purchase";

export interface TallyVoucher {
  date: string;
  memo: string;
  voucherType: TallyVoucherType;
  ledgerEntries: { ledger: string; drCr: "Dr" | "Cr"; amount: number }[];
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function tallyDate(isoDate: string): string {
  // Tally date format: YYYYMMDD
  return isoDate.replace(/-/g, "");
}

function voucherXml(v: TallyVoucher): string {
  const ledgerLines = v.ledgerEntries
    .map(
      (e) => `        <ALLLEDGERENTRIES.LIST>
          <LEDGERNAME>${escapeXml(e.ledger)}</LEDGERNAME>
          <ISDEEMEDPOSITIVE>${e.drCr === "Dr" ? "Yes" : "No"}</ISDEEMEDPOSITIVE>
          <AMOUNT>${e.drCr === "Dr" ? e.amount.toFixed(2) : (-e.amount).toFixed(2)}</AMOUNT>
        </ALLLEDGERENTRIES.LIST>`
    )
    .join("\n");

  return `      <VOUCHER VCHTYPE="${v.voucherType}" ACTION="Create">
        <DATE>${tallyDate(v.date)}</DATE>
        <VOUCHERTYPENAME>${v.voucherType}</VOUCHERTYPENAME>
        <NARRATION>${escapeXml(v.memo)}</NARRATION>
${ledgerLines}
      </VOUCHER>`;
}

export interface TallyExportFilters {
  entityId?: string;
  basis?: string;
  from?: string;
  to?: string;
}

export function buildTallyXml(filters: TallyExportFilters = {}): string {
  // Group postings by a composite key: date + memo to reconstruct vouchers.
  const posts = allPostings().filter((p) => {
    if (filters.basis && p.basis !== filters.basis) return false;
    if (filters.entityId && filters.entityId !== "all" && p.entityId !== filters.entityId) return false;
    if (filters.from && p.date < filters.from) return false;
    if (filters.to && p.date > filters.to) return false;
    return true;
  });

  // NEXA posting model: each posting has (date, memo, accountCode, debit, credit).
  // Group by memo + date to form Tally vouchers.
  const groups = new Map<string, typeof posts>();
  for (const p of posts) {
    const key = `${p.date}|${p.memo ?? ""}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }

  const vouchers: TallyVoucher[] = [];
  for (const [, entries] of groups) {
    if (entries.length === 0) continue;
    const first = entries[0];

    // Map NEXA postings to Tally ledger entries.
    const ledgerEntries: TallyVoucher["ledgerEntries"] = [];
    for (const e of entries) {
      const tallyName = NEXA_TO_TALLY[e.accountCode] ?? accountSafe(e.accountCode)?.name ?? `Account ${e.accountCode}`;
      if (e.debit > 0) ledgerEntries.push({ ledger: tallyName, drCr: "Dr", amount: e.debit });
      if (e.credit > 0) ledgerEntries.push({ ledger: tallyName, drCr: "Cr", amount: e.credit });
    }

    // Infer voucher type from memo prefix patterns.
    const narr = (first.memo ?? "").toLowerCase();
    let vType: TallyVoucherType = "Journal";
    if (narr.startsWith("payment") || narr.includes("payment to") || narr.includes("paid to")) vType = "Payment";
    else if (narr.startsWith("receipt") || narr.includes("receipt from") || narr.includes("received from")) vType = "Receipt";
    else if (narr.startsWith("contra") || narr.includes("bank transfer") || narr.includes("petty cash")) vType = "Contra";
    else if (narr.includes("sale") || narr.includes("invoice")) vType = "Sales";
    else if (narr.includes("purchase") || narr.includes("grn") || narr.includes("vendor bill")) vType = "Purchase";

    vouchers.push({ date: first.date, memo: first.memo ?? "", voucherType: vType, ledgerEntries });
  }

  vouchers.sort((a, b) => a.date.localeCompare(b.date));

  const voucherXmls = vouchers.map(voucherXml).join("\n");
  const count = vouchers.length;
  const fromLabel = filters.from ?? "opening";
  const toLabel = filters.to ?? "closing";

  return `<?xml version="1.0" encoding="UTF-8"?>
<!-- NEXA ERP → Tally Prime XML Export | ${count} vouchers | ${fromLabel} to ${toLabel} -->
<ENVELOPE>
  <HEADER>
    <TALLYREQUEST>Import Data</TALLYREQUEST>
  </HEADER>
  <BODY>
    <IMPORTDATA>
      <REQUESTDESC>
        <REPORTNAME>All Masters</REPORTNAME>
        <STATICVARIABLES>
          <SVCURRENTCOMPANY></SVCURRENTCOMPANY>
        </STATICVARIABLES>
      </REQUESTDESC>
      <REQUESTDATA>
        <TALLYMESSAGE xmlns:UDF="TallyUDF">
${voucherXmls}
        </TALLYMESSAGE>
      </REQUESTDATA>
    </IMPORTDATA>
  </BODY>
</ENVELOPE>`;
}

export function downloadTallyXml(xml: string, filename = "nexa-export.xml") {
  const blob = new Blob([xml], { type: "application/xml;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
