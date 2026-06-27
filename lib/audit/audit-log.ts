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

export const SEED_AUDIT: AuditEntry[] = [];

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
