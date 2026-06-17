// ---------------------------------------------------------------------------
// Professional Services — Conflict checks (adapted from Touchstone).
//
// Touchstone runs a partner-clearance workflow: a pre-matter check captures the
// client + opposing party, every partner either stays silent (clears) or RAISES
// a conflict, and each raised item must be resolved or waived before the matter
// opens. There are no email tokens here — clearance is an in-app attestation by
// reviewers (partner-rank members), surfaced in Approvals.
//
// On top of the human workflow we add a deterministic first-pass SCREEN: the
// opposing parties + client are matched against the existing client book and
// live engagements, so obvious adverse-party collisions surface immediately.
//
// Persistence (client-side):
//   nexa-conflict-checks, nexa-conflict-items, nexa-conflict-clearances
// ---------------------------------------------------------------------------

import { ACCOUNTS } from "@/lib/crm";
import type { Project, ConflictStatus } from "./projects";
import { read, write } from "./store";

export type ConflictItemStatus = "pending" | "resolved" | "waived";

export type ConflictType =
  | "adverse-party" // opposing party is / relates to an existing client
  | "same-client" // competing or duplicate engagement for the same client
  | "personal" // reviewer has a personal or financial interest
  | "positional" // legal / positional conflict
  | "confidential-info" // holds confidential information on a party
  | "other";

export const CONFLICT_TYPES: { key: ConflictType; label: string }[] = [
  { key: "adverse-party", label: "Adverse party" },
  { key: "same-client", label: "Same / competing client" },
  { key: "positional", label: "Positional" },
  { key: "confidential-info", label: "Confidential information" },
  { key: "personal", label: "Personal interest" },
  { key: "other", label: "Other" },
];

/** Parent record — a pre-engagement clearance. Mirrors Touchstone `conflict_check`. */
export interface ConflictCheck {
  id: string;
  projectId: string; // the engagement this clears
  accountId?: string; // CrmAccount being onboarded …
  clientAlias?: string; // … or a free-text name if no account yet
  matterTitle: string;
  opposingParties: string[]; // names screened against the book
  description?: string;
  status: ConflictStatus; // open → cleared | blocked | waived
  raisedById: string; // employee who initiated
  createdAt: string; // ISO
  clearedAt?: string;
}

/** Automated screen hit — a potential collision found in the existing book. */
export interface ConflictMatch {
  against: "account" | "project";
  matchedId: string;
  matchedName: string;
  reason: string;
  score: number; // 0–1 confidence
}

/** Per-reviewer attestation — the in-app replacement for email tokens. */
export interface ConflictClearance {
  id: string;
  checkId: string;
  reviewerId: string; // employee (partner-rank role)
  decision: "pending" | "cleared" | "raised";
  decidedAt?: string;
}

/** A raised conflict against a check. Mirrors Touchstone `conflicts`/`matter_conflicts`. */
export interface ConflictItem {
  id: string;
  checkId: string;
  raisedById: string;
  type: ConflictType;
  description: string;
  status: ConflictItemStatus;
  resolvedById?: string;
  resolutionNotes?: string;
  raisedAt: string; // ISO
  resolvedAt?: string;
}

// ---------------------------------------------------------------------------
// Deterministic name screen
// ---------------------------------------------------------------------------
function norm(s: string): string[] {
  const STOP = new Set(["pvt", "ltd", "llp", "pte", "inc", "co", "company", "the", "and", "foods", "retail", "group"]);
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1 && !STOP.has(t));
}

/** 0–1 similarity between two names by significant-token overlap + containment. */
function similarity(a: string, b: string): number {
  const ta = norm(a), tb = norm(b);
  if (!ta.length || !tb.length) return 0;
  const setB = new Set(tb);
  const shared = ta.filter((t) => setB.has(t)).length;
  const overlap = shared / Math.min(ta.length, tb.length);
  const contained = a.toLowerCase().includes(b.toLowerCase()) || b.toLowerCase().includes(a.toLowerCase());
  return Math.max(overlap, contained ? 0.85 : 0);
}

/**
 * Screen an engagement's opposing parties + client against the existing client
 * book and other live engagements. Returns potential collisions, strongest
 * first. Pure & deterministic.
 */
export function screenConflicts(project: Project, otherProjects: Project[]): ConflictMatch[] {
  const matches: ConflictMatch[] = [];
  const THRESHOLD = 0.5;
  const probes = [...project.opposingParties];

  for (const probe of probes) {
    // Adverse party vs existing clients.
    for (const acc of ACCOUNTS) {
      const score = Math.max(similarity(probe, acc.name), similarity(probe, acc.legalName));
      if (score >= THRESHOLD) {
        matches.push({
          against: "account",
          matchedId: acc.id,
          matchedName: acc.name,
          reason: `Opposing party “${probe}” matches existing client “${acc.name}”`,
          score,
        });
      }
    }
    // Adverse party already a client on another live engagement.
    for (const p of otherProjects) {
      if (p.id === project.id) continue;
      const clientName = ACCOUNTS.find((a) => a.id === p.accountId)?.name ?? "";
      const score = similarity(probe, clientName);
      if (score >= THRESHOLD) {
        matches.push({
          against: "project",
          matchedId: p.id,
          matchedName: `${p.code} · ${clientName}`,
          reason: `Opposing party “${probe}” is the client on ${p.code}`,
          score,
        });
      }
    }
  }

  // Same client engaged on a competing live engagement.
  for (const p of otherProjects) {
    if (p.id === project.id || p.accountId !== project.accountId) continue;
    matches.push({
      against: "project",
      matchedId: p.id,
      matchedName: p.code,
      reason: `Same client already engaged on ${p.code} (${p.name})`,
      score: 0.6,
    });
  }

  return matches.sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// Status derivation
// ---------------------------------------------------------------------------
/** Roll up clearances + raised items into the engagement's gate status. */
export function deriveCheckStatus(
  clearances: ConflictClearance[],
  items: ConflictItem[],
): ConflictStatus {
  const unresolved = items.filter((i) => i.status === "pending");
  if (unresolved.length) return "blocked";
  const waivedOnly = items.length > 0 && items.every((i) => i.status === "waived");
  const anyPending = clearances.some((c) => c.decision === "pending");
  if (anyPending) return "open";
  if (waivedOnly) return "waived";
  return "cleared";
}

export function checkForProject(checks: ConflictCheck[], projectId: string) {
  return checks.find((c) => c.projectId === projectId);
}
export function clearancesForCheck(all: ConflictClearance[], checkId: string) {
  return all.filter((c) => c.checkId === checkId);
}
export function itemsForCheck(all: ConflictItem[], checkId: string) {
  return all.filter((c) => c.checkId === checkId);
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------
export const CHECKS_KEY = "nexa-conflict-checks";
export const ITEMS_KEY = "nexa-conflict-items";
export const CLEARANCES_KEY = "nexa-conflict-clearances";

export const loadChecks = () => read<ConflictCheck[]>(CHECKS_KEY, []);
export const saveChecks = (c: ConflictCheck[]) => write(CHECKS_KEY, c);
export const loadItems = () => read<ConflictItem[]>(ITEMS_KEY, []);
export const saveItems = (i: ConflictItem[]) => write(ITEMS_KEY, i);
export const loadClearances = () => read<ConflictClearance[]>(CLEARANCES_KEY, []);
export const saveClearances = (c: ConflictClearance[]) => write(CLEARANCES_KEY, c);
