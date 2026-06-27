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

export const PARTIES: Party[] = [...CUSTOMER_PARTIES];

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
