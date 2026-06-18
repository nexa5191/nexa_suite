// ---------------------------------------------------------------------------
// Party-ledger / Statement of Account — the per-vendor (FBL1N) and per-customer
// (FBL5N) running ledger NEXA was missing. Built from the party-keyed source
// documents (sales invoices + receipts for customers, vendor bills + payments
// for vendors), since the auto-posted GL stream isn't party-tagged.
//
// Each movement is a dated Dr/Cr line; the statement shows opening balance, the
// chronological movements with a running balance, and the closing balance —
// AR is debit-normal (they owe us → "Dr"), AP is credit-normal (we owe → "Cr").
// ---------------------------------------------------------------------------

import {
  allInvoices, loadCreatedInvoices, loadInvoicePayments, loadStatusOverrides,
  effectiveStatus, invoiceTotal,
} from "@/lib/invoicing";
import { PURCHASE_ORDERS, vendorById, loadPoPayments } from "@/lib/vendors";
import { accountById } from "@/lib/crm";
import { AS_ON } from "@/lib/finance/receivables";

export type LedgerKind = "Invoice" | "Receipt" | "Bill" | "Payment";
export type PartyKind = "customer" | "vendor";

export interface LedgerLine {
  date: string; // ISO
  ref: string; // document number
  kind: LedgerKind;
  particulars: string;
  debit: number;
  credit: number;
  balance: number; // running, party-normal magnitude (always ≥ 0 here, side below)
  side: "Dr" | "Cr"; // which side the running balance sits on
  sourceHref: string; // drill to the originating module
}

export interface PartyRef {
  id: string;
  name: string;
  gstin?: string;
}

export interface PartyLedger {
  partyId: string;
  partyName: string;
  partyKind: PartyKind;
  gstin?: string;
  from: string | null;
  to: string | null;
  opening: number; // party-normal signed (+ = outstanding on the normal side)
  lines: LedgerLine[];
  totalDebit: number;
  totalCredit: number;
  closing: number; // party-normal signed
  normalSide: "Dr" | "Cr"; // Dr for customers, Cr for vendors
}

const round = (n: number) => Math.round(n);

// ---- Party lists (only parties that actually have documents) ---------------

export function customerParties(): PartyRef[] {
  const invoices = allInvoices(loadCreatedInvoices());
  const overrides = loadStatusOverrides();
  const seen = new Map<string, PartyRef>();
  for (const inv of invoices) {
    if (effectiveStatus(inv, overrides) === "draft") continue;
    if (seen.has(inv.accountId)) continue;
    const acc = accountById(inv.accountId);
    seen.set(inv.accountId, { id: inv.accountId, name: acc?.name ?? inv.accountId, gstin: acc?.gstin });
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function vendorParties(): PartyRef[] {
  const seen = new Map<string, PartyRef>();
  for (const po of PURCHASE_ORDERS) {
    if (!po.invoice) continue;
    if (seen.has(po.vendorId)) continue;
    const v = vendorById(po.vendorId);
    seen.set(po.vendorId, { id: po.vendorId, name: v?.name ?? po.vendorId, gstin: v?.gstin });
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ---- Raw dated movements (before opening/running computation) ---------------

interface Movement {
  date: string;
  ref: string;
  kind: LedgerKind;
  particulars: string;
  debit: number;
  credit: number;
  sourceHref: string;
}

const KIND_ORDER: Record<LedgerKind, number> = { Invoice: 0, Bill: 0, Receipt: 1, Payment: 1 };

function sortMovements(m: Movement[]): Movement[] {
  return m.sort((a, b) => a.date.localeCompare(b.date) || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.ref.localeCompare(b.ref));
}

function customerMovements(accountId: string): Movement[] {
  const invoices = allInvoices(loadCreatedInvoices()).filter((i) => i.accountId === accountId);
  const overrides = loadStatusOverrides();
  const payments = loadInvoicePayments();
  const out: Movement[] = [];
  for (const inv of invoices) {
    const st = effectiveStatus(inv, overrides);
    if (st === "draft") continue;
    const total = invoiceTotal(inv);
    out.push({
      date: inv.date, ref: inv.number, kind: "Invoice",
      particulars: `Sales invoice ${inv.number}`,
      debit: round(total), credit: 0, sourceHref: "/invoicing",
    });
    const recorded = payments[inv.id] ?? 0;
    const paid = st === "paid" ? total : Math.min(total, recorded);
    if (paid > 0) {
      out.push({
        date: st === "paid" ? inv.dueDate : AS_ON, ref: inv.number, kind: "Receipt",
        particulars: `Receipt against ${inv.number}`,
        debit: 0, credit: round(paid), sourceHref: "/receivables",
      });
    }
  }
  return sortMovements(out);
}

function vendorMovements(vendorId: string): Movement[] {
  const pos = PURCHASE_ORDERS.filter((p) => p.vendorId === vendorId && p.invoice);
  const poPayments = loadPoPayments();
  const out: Movement[] = [];
  for (const po of pos) {
    const inv = po.invoice!;
    out.push({
      date: inv.date, ref: inv.number, kind: "Bill",
      particulars: `${po.title} · ${inv.number}`,
      debit: 0, credit: round(inv.amount), sourceHref: "/vendors",
    });
    const recorded = poPayments[po.id] ?? 0;
    const paid = po.status === "paid" ? inv.amount : Math.min(inv.amount, recorded);
    if (paid > 0) {
      out.push({
        date: po.status === "paid" ? (po.paidOn ?? inv.date) : AS_ON, ref: inv.number, kind: "Payment",
        particulars: `Payment for ${inv.number}`,
        debit: round(paid), credit: 0, sourceHref: "/payments",
      });
    }
  }
  return sortMovements(out);
}

// ---- Assemble the ledger with opening / running / closing -------------------

function assemble(
  partyKind: PartyKind,
  party: PartyRef,
  movements: Movement[],
  from: string | null,
  to: string | null,
): PartyLedger {
  const normalSide: "Dr" | "Cr" = partyKind === "customer" ? "Dr" : "Cr";
  // party-normal delta: customer balance rises with debits, vendor with credits.
  const delta = (m: { debit: number; credit: number }) =>
    partyKind === "customer" ? m.debit - m.credit : m.credit - m.debit;

  let opening = 0;
  const lines: LedgerLine[] = [];
  let running = 0;
  let totalDebit = 0;
  let totalCredit = 0;

  for (const m of movements) {
    if (from && m.date < from) { opening += delta(m); continue; }
    if (to && m.date > to) continue;
    running = (lines.length === 0 ? opening : running) + delta(m);
    totalDebit += m.debit;
    totalCredit += m.credit;
    lines.push({
      date: m.date, ref: m.ref, kind: m.kind, particulars: m.particulars,
      debit: m.debit, credit: m.credit,
      balance: Math.abs(running),
      side: running >= 0 ? normalSide : (normalSide === "Dr" ? "Cr" : "Dr"),
      sourceHref: m.sourceHref,
    });
  }
  // If no lines fell in range, running stays at opening.
  const closing = lines.length === 0 ? opening : running;

  return {
    partyId: party.id, partyName: party.name, partyKind, gstin: party.gstin,
    from, to, opening, lines,
    totalDebit: round(totalDebit), totalCredit: round(totalCredit),
    closing, normalSide,
  };
}

export function customerLedger(accountId: string, from: string | null = null, to: string | null = null): PartyLedger {
  const party = customerParties().find((p) => p.id === accountId) ?? { id: accountId, name: accountId };
  return assemble("customer", party, customerMovements(accountId), from, to);
}

export function vendorLedger(vendorId: string, from: string | null = null, to: string | null = null): PartyLedger {
  const party = vendorParties().find((p) => p.id === vendorId) ?? { id: vendorId, name: vendorId };
  return assemble("vendor", party, vendorMovements(vendorId), from, to);
}

/** Format a party-normal signed balance as "₹X Dr/Cr". */
export function balanceLabel(signed: number, normalSide: "Dr" | "Cr"): { amount: number; side: "Dr" | "Cr" } {
  if (signed >= 0) return { amount: signed, side: normalSide };
  return { amount: -signed, side: normalSide === "Dr" ? "Cr" : "Dr" };
}
