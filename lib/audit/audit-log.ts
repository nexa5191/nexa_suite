// ---------------------------------------------------------------------------
// Tamper-evident audit trail — Companies Act 2013, Rule 11(g) of the Companies
// (Accounts) Rules: an edit log that records every create / modify / delete
// with the user, timestamp and the before/after values, and which cannot be
// disabled or silently altered.
//
// Immutability here is enforced by a hash chain: each entry carries the hash of
// the previous entry, so changing any historical row breaks every hash after
// it. verifyChain() re-derives the chain and reports the first break. There is
// no backend — the seed chain ships with the app and user actions append to a
// localStorage continuation ("nexa-audit-log").
// ---------------------------------------------------------------------------

import { employeeById } from "@/lib/hr/employees";

export type AuditAction = "create" | "update" | "delete" | "approve" | "post" | "generate" | "process";

export interface AuditEntry {
  seq: number;
  timestamp: string; // ISO
  actorId: string | null; // employee id (null = system)
  actorName: string;
  module: string; // e.g. "Invoicing", "Payroll"
  action: AuditAction;
  record: string; // human id of the affected record, e.g. "NXF/26-27/0105"
  field: string | null; // changed field for updates
  before: string | null;
  after: string | null;
  prevHash: string;
  hash: string;
}

// What goes into the hash — everything except the hash itself.
type Hashable = Omit<AuditEntry, "hash">;

const ACTION_LABEL: Record<AuditAction, string> = {
  create: "Created",
  update: "Modified",
  delete: "Deleted",
  approve: "Approved",
  post: "Posted",
  generate: "Generated",
  process: "Processed",
};
export function actionLabel(a: AuditAction) {
  return ACTION_LABEL[a];
}

export const ACTION_TONE: Record<AuditAction, "default" | "primary" | "success" | "warning" | "danger"> = {
  create: "primary",
  update: "warning",
  delete: "danger",
  approve: "success",
  post: "success",
  generate: "primary",
  process: "success",
};

// ---------------------------------------------------------------------------
// Deterministic hash — FNV-1a 32-bit expanded to 16 hex chars with three salts.
// Not cryptographic; it only needs to be collision-resistant enough to make a
// tampered row visible in a demo, and fully deterministic across SSR/CSR.
// ---------------------------------------------------------------------------
function fnv1a(str: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
function hex8(n: number): string {
  return (n >>> 0).toString(16).padStart(8, "0");
}
export function chainHash(e: Hashable): string {
  const payload = [e.seq, e.timestamp, e.actorId, e.module, e.action, e.record, e.field, e.before, e.after, e.prevHash].join("|");
  // Two 8-char halves from differently-salted hashes → a 16-char digest.
  return hex8(fnv1a(payload)) + hex8(fnv1a("nexa::" + payload));
}

export const GENESIS_HASH = "0000000000000000";

/** Re-derive the chain over `entries` and seal each entry's hash. */
function seal(entries: Hashable[]): AuditEntry[] {
  let prev = GENESIS_HASH;
  const out: AuditEntry[] = [];
  for (const e of entries) {
    const withPrev = { ...e, prevHash: prev };
    const hash = chainHash(withPrev);
    out.push({ ...withPrev, hash });
    prev = hash;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Seed chain — a representative spread of actions across the platform's
// modules, in chronological order. Timestamps are fixed (no Date.now) so the
// chain hashes are stable.
// ---------------------------------------------------------------------------
interface RawAudit {
  timestamp: string;
  actorId: string | null;
  module: string;
  action: AuditAction;
  record: string;
  field?: string;
  before?: string;
  after?: string;
}

const RAW_SEED: RawAudit[] = [
  { timestamp: "2026-05-31T18:30:00", actorId: "emp-002", module: "Payroll", action: "process", record: "Run May 2026", after: "24 employees · net ₹46.2L" },
  { timestamp: "2026-05-31T18:34:12", actorId: "emp-002", module: "General Ledger", action: "post", record: "JV-2026-0518", after: "Dr Salaries 61.4L / Cr Payable + TDS" },
  { timestamp: "2026-06-01T09:12:45", actorId: "emp-002", module: "Invoicing", action: "create", record: "NXF/26-27/0105", after: "FreshMart · ₹6.34L" },
  { timestamp: "2026-06-01T09:15:03", actorId: "emp-009", module: "e-Invoicing", action: "generate", record: "NXF/26-27/0105", after: "IRN ack 112620000128…" },
  { timestamp: "2026-06-02T11:48:20", actorId: "emp-023", module: "Vendors", action: "create", record: "PO-2011", after: "GreenLeaf Agro · ₹1.76L" },
  { timestamp: "2026-06-03T14:22:10", actorId: "emp-007", module: "Invoicing", action: "update", record: "NXF/26-27/0102", field: "dueDate", before: "2026-06-17", after: "2026-06-24" },
  { timestamp: "2026-06-04T10:05:33", actorId: "emp-005", module: "Vendors", action: "approve", record: "PO-2009 invoice", after: "ERP renewal ₹4.80L approved" },
  { timestamp: "2026-06-04T10:06:01", actorId: null, module: "Payments", action: "process", record: "AUTO-PAY/PO-2009", after: "NEFT ₹4.80L scheduled" },
  { timestamp: "2026-06-05T16:40:55", actorId: "emp-006", module: "Petty Cash", action: "create", record: "PC-2026-077", after: "Courier ₹1,250" },
  { timestamp: "2026-06-08T12:18:09", actorId: "emp-009", module: "GSTR-2B", action: "approve", record: "STF/26-27/0192", after: "ITC ₹37,000 accepted" },
  { timestamp: "2026-06-09T15:33:41", actorId: "emp-004", module: "Payroll", action: "update", record: "EMP-018 CTC", field: "annualCtc", before: "₹20.0L", after: "₹22.0L" },
  { timestamp: "2026-06-10T09:05:00", actorId: "emp-024", module: "Purchase Requisition", action: "create", record: "PR-0001", after: "RM Durum 15,000 kg · Tin-15 2,000 units — reorder triggered" },
  { timestamp: "2026-06-10T09:50:27", actorId: "emp-016", module: "Tax Declaration", action: "create", record: "EMP-016 FY25-26", after: "Regime: New · 80C ₹1.5L" },
  { timestamp: "2026-06-11T10:20:00", actorId: "emp-023", module: "Purchase Requisition", action: "approve", record: "PR-0001", after: "Approved — PO-2010 to be raised with Jain Packaging" },
  { timestamp: "2026-06-12T08:30:00", actorId: "emp-021", module: "GRN", action: "create", record: "GRN-0001", after: "WHT-2606-A · 50,000 kg rm-wheat · Sterling Foods · PO-2007" },
  { timestamp: "2026-06-12T14:45:00", actorId: "emp-021", module: "GRN", action: "post", record: "GRN-0001", after: "1 movement posted · +50,000 kg rm-wheat at Mysuru Plant" },
  { timestamp: "2026-06-12T17:05:14", actorId: "emp-002", module: "Banking", action: "update", record: "HDFC ****4455", field: "reconStatus", before: "unmatched", after: "matched · 142 lines" },
  { timestamp: "2026-06-14T11:10:00", actorId: "emp-024", module: "Purchase Requisition", action: "create", record: "PR-0002", after: "Wheat 60,000 kg · Bag-50 2,000 · Bag-25 3,000 — monthly restock" },
  { timestamp: "2026-06-15T11:27:38", actorId: "emp-002", module: "Fixed Assets", action: "post", record: "FA-2026-014", after: "Capitalised plant ₹12.4L" },
  { timestamp: "2026-06-15T19:02:50", actorId: "emp-004", module: "Onboarding", action: "update", record: "EMP-015 exit", field: "F&F", before: "pending", after: "settled ₹3.1L" },
  { timestamp: "2026-06-16T10:44:02", actorId: "emp-001", module: "Approvals", action: "approve", record: "Budget FY26-27", after: "Opex plan signed off" },
  { timestamp: "2026-06-17T13:19:48", actorId: "emp-009", module: "Tax & Compliance", action: "generate", record: "GSTR-3B May 2026", after: "Net GST payable ₹2.18L" },
  { timestamp: "2026-06-18T08:55:30", actorId: "emp-006", module: "Reimbursements", action: "approve", record: "RM-2026-061", after: "Travel claim ₹18,400" },
  { timestamp: "2026-06-20T09:15:00", actorId: "emp-021", module: "GRN", action: "create", record: "GRN-0002", after: "1,800 units pm-tin15 · Jain Packaging Co. · PR-0001 · short delivery · pending-qc" },
];

export const SEED_AUDIT: AuditEntry[] = seal(
  RAW_SEED.map((r, i) => ({
    seq: i + 1,
    timestamp: r.timestamp,
    actorId: r.actorId,
    actorName: r.actorId ? employeeById(r.actorId)?.name ?? r.actorId : "System",
    module: r.module,
    action: r.action,
    record: r.record,
    field: r.field ?? null,
    before: r.before ?? null,
    after: r.after ?? null,
    prevHash: GENESIS_HASH, // overwritten by seal()
  })),
);

// ---------------------------------------------------------------------------
// Persistence — appended user actions continue the chain after the seed.
// ---------------------------------------------------------------------------
const AUDIT_KEY = "nexa-audit-log";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    if (raw) return JSON.parse(raw) as T;
  } catch {
    /* ignore */
  }
  return fallback;
}
function write<T>(key: string, value: T) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore */
  }
}

export const loadAppended = () => read<AuditEntry[]>(AUDIT_KEY, []);

/** Seed + appended entries as one sealed, ordered chain. */
export function fullChain(): AuditEntry[] {
  return [...SEED_AUDIT, ...loadAppended()];
}

export interface AppendInput {
  actorId: string | null;
  module: string;
  action: AuditAction;
  record: string;
  field?: string | null;
  before?: string | null;
  after?: string | null;
  timestamp?: string; // pass-through for determinism; defaults to now
}

/**
 * Append one entry, linking it to the current tip of the chain. Returns the new
 * sealed entry. Any NEXA module can call this when it mutates a record.
 */
export function appendAudit(input: AppendInput): AuditEntry {
  const chain = fullChain();
  const tip = chain[chain.length - 1];
  const entry: Hashable = {
    seq: tip.seq + 1,
    timestamp: input.timestamp ?? new Date().toISOString(),
    actorId: input.actorId,
    actorName: input.actorId ? employeeById(input.actorId)?.name ?? input.actorId : "System",
    module: input.module,
    action: input.action,
    record: input.record,
    field: input.field ?? null,
    before: input.before ?? null,
    after: input.after ?? null,
    prevHash: tip.hash,
  };
  const sealed: AuditEntry = { ...entry, hash: chainHash(entry) };
  write(AUDIT_KEY, [...loadAppended(), sealed]);
  return sealed;
}

// ---------------------------------------------------------------------------
// Integrity verification
// ---------------------------------------------------------------------------
export interface ChainVerification {
  valid: boolean;
  length: number;
  brokenAtSeq: number | null; // first entry whose hash/link fails
  reason: string | null;
}

export function verifyChain(entries: AuditEntry[]): ChainVerification {
  let prev = GENESIS_HASH;
  for (const e of entries) {
    if (e.prevHash !== prev) {
      return { valid: false, length: entries.length, brokenAtSeq: e.seq, reason: `Broken link at #${e.seq} — prevHash does not match the preceding entry.` };
    }
    const expected = chainHash({ ...e, hash: undefined } as unknown as Hashable);
    if (expected !== e.hash) {
      return { valid: false, length: entries.length, brokenAtSeq: e.seq, reason: `Tampered content at #${e.seq} — recomputed hash differs.` };
    }
    prev = e.hash;
  }
  return { valid: true, length: entries.length, brokenAtSeq: null, reason: null };
}

// ---------------------------------------------------------------------------
// Read helpers for the viewer
// ---------------------------------------------------------------------------
export function auditModules(entries: AuditEntry[]): string[] {
  return Array.from(new Set(entries.map((e) => e.module))).sort();
}
export function auditActors(entries: AuditEntry[]): { id: string | null; name: string }[] {
  const seen = new Map<string, { id: string | null; name: string }>();
  for (const e of entries) seen.set(e.actorName, { id: e.actorId, name: e.actorName });
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export interface AuditSummary {
  total: number;
  today: number;
  actors: number;
  modules: number;
}
export function auditSummary(entries: AuditEntry[], today: string): AuditSummary {
  return {
    total: entries.length,
    today: entries.filter((e) => e.timestamp.slice(0, 10) === today).length,
    actors: new Set(entries.map((e) => e.actorName)).size,
    modules: new Set(entries.map((e) => e.module)).size,
  };
}
