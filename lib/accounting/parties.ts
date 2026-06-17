// ---------------------------------------------------------------------------
// Third parties — the customers, vendors and other counterparties that sit
// behind sub-ledger movements (AR / AP). A voucher can be tagged with a party
// so the General Ledger and registers show *who* a transaction was with, and so
// party-wise balances can be derived from the AR/AP postings.
// ---------------------------------------------------------------------------

import { ACCOUNTS } from "@/lib/crm";

export type PartyKind = "customer" | "vendor" | "other";

export interface Party {
  id: string;
  name: string;
  kind: PartyKind;
  gstin?: string;
}

// Customers come straight from the CRM/invoicing account master, keyed by the
// same id — so a credit note raised against an invoice maps to its party with
// no translation, and AR sub-ledger balances tie to the customers you bill.
const CUSTOMER_PARTIES: Party[] = ACCOUNTS.map((a) => ({
  id: a.id,
  name: a.name,
  kind: "customer" as const,
  gstin: a.gstin && a.gstin !== "—" ? a.gstin : undefined,
}));

export const PARTIES: Party[] = [
  ...CUSTOMER_PARTIES,

  // Vendors (drive Accounts Payable)
  { id: "vend-grainco", name: "GrainCo Commodities", kind: "vendor", gstin: "29AAAGV5555E1Z5" },
  { id: "vend-packwell", name: "PackWell Industries", kind: "vendor", gstin: "27AAAPW6666F1Z6" },
  { id: "vend-swiftlog", name: "SwiftLog Logistics", kind: "vendor", gstin: "29AAASL7777G1Z7" },
  { id: "vend-power", name: "State Power Utility", kind: "vendor" },
  { id: "vend-techsoft", name: "TechSoft Solutions", kind: "vendor", gstin: "27AAATS8888H1Z8" },

  // Other counterparties (loans, statutory, employees, etc.)
  { id: "other-bank", name: "HDFC Bank Ltd", kind: "other" },
  { id: "other-gst", name: "GST Department", kind: "other" },
  { id: "other-employee", name: "Employee Reimbursements", kind: "other" },
];

const BY_ID = new Map(PARTIES.map((p) => [p.id, p]));

export function partyById(id: string | undefined): Party | undefined {
  return id ? BY_ID.get(id) : undefined;
}

export function partyName(id: string | undefined): string {
  return partyById(id)?.name ?? "—";
}

export function partiesByKind(kind: PartyKind | "any"): Party[] {
  return kind === "any" ? PARTIES : PARTIES.filter((p) => p.kind === kind);
}
