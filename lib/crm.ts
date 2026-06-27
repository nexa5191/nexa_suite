// ---------------------------------------------------------------------------
// NEXA CRM — sales accounts, contacts and a tagged customer-journey timeline.
//
// The same accounts double as the customer/bill-to master for Invoicing
// (see lib/invoicing.ts), so a "won" deal and its invoices stay coherent.
//
// Persistence (all client-side, deterministic seed otherwise):
//   nexa-crm-events     → user-added journey events (array)
//   nexa-crm-tags       → tag overrides per event   (Record<eventId, string[]>)
//   nexa-crm-stages     → pipeline stage overrides   (Record<accountId, stage>)
// ---------------------------------------------------------------------------

import { entityById } from "@/lib/accounting/org";
import { employeeName } from "@/lib/hr/employees";

// ---- pipeline ----
export type PipelineStage =
  | "lead"
  | "qualified"
  | "proposal"
  | "negotiation"
  | "won"
  | "lost";

export const PIPELINE_STAGES: { key: PipelineStage; label: string; variant: "default" | "primary" | "warning" | "success" | "danger" }[] = [
  { key: "lead", label: "Lead", variant: "default" },
  { key: "qualified", label: "Qualified", variant: "primary" },
  { key: "proposal", label: "Proposal", variant: "primary" },
  { key: "negotiation", label: "Negotiation", variant: "warning" },
  { key: "won", label: "Won", variant: "success" },
  { key: "lost", label: "Lost", variant: "danger" },
];

export const OPEN_STAGES: PipelineStage[] = ["lead", "qualified", "proposal", "negotiation"];

export function stageMeta(stage: PipelineStage) {
  return PIPELINE_STAGES.find((s) => s.key === stage) ?? PIPELINE_STAGES[0];
}

export type Industry =
  | "Retail Chain"
  | "Distribution"
  | "HoReCa"
  | "E-commerce"
  | "Export"
  | "Institutional"
  | "Quick Commerce";

export interface CrmAccount {
  id: string;
  name: string;
  legalName: string;
  industry: Industry;
  gstin: string;
  address: string;
  city: string;
  state: string;
  stateCode: string;
  email: string;
  phone: string;
  website: string;
  ownerId: string; // employee who owns the relationship
  entityId: string; // which Nexa entity sells to them
  stage: PipelineStage; // seed stage (may be overridden locally)
  dealValue: number; // base INR — annual contract / pipeline value
  since: string; // ISO — first contact
}

// ---- journey events ----
export type EventType = "stage" | "note" | "call" | "meeting" | "email" | "deal" | "invoice";

export const EVENT_TYPES: { key: EventType; label: string; icon: string }[] = [
  { key: "note", label: "Note", icon: "StickyNote" },
  { key: "call", label: "Call", icon: "Phone" },
  { key: "meeting", label: "Meeting", icon: "Users" },
  { key: "email", label: "Email", icon: "Mail" },
  { key: "deal", label: "Deal", icon: "Handshake" },
  { key: "stage", label: "Stage change", icon: "GitBranch" },
  { key: "invoice", label: "Invoice", icon: "Receipt" },
];

export interface JourneyEvent {
  id: string;
  accountId: string;
  date: string; // ISO
  type: EventType;
  title: string;
  detail: string;
  tags: string[];
  authorId: string; // employee who logged it
  seed?: boolean; // distinguishes seed events from user-added ones
}

// ---- tag vocabulary (event tagging) ----
export interface CrmTag {
  id: string;
  label: string;
  variant: "default" | "primary" | "success" | "warning" | "danger";
}

export const CRM_TAGS: CrmTag[] = [
  { id: "hot", label: "Hot lead", variant: "danger" },
  { id: "decision-maker", label: "Decision maker", variant: "primary" },
  { id: "champion", label: "Champion", variant: "success" },
  { id: "pricing", label: "Pricing", variant: "warning" },
  { id: "demo", label: "Demo", variant: "primary" },
  { id: "follow-up", label: "Follow-up", variant: "warning" },
  { id: "at-risk", label: "At risk", variant: "danger" },
  { id: "upsell", label: "Upsell", variant: "success" },
  { id: "renewal", label: "Renewal", variant: "primary" },
  { id: "blocker", label: "Blocker", variant: "danger" },
  { id: "intro", label: "Intro", variant: "default" },
];

export function tagById(id: string): CrmTag {
  return CRM_TAGS.find((t) => t.id === id) ?? { id, label: id, variant: "default" };
}

export interface CrmContact {
  id: string;
  accountId: string;
  name: string;
  title: string;
  email: string;
  phone: string;
  primary: boolean;
}

// ---------------------------------------------------------------------------
// Seed data
// ---------------------------------------------------------------------------

function readLS<T>(key: string, fb: T): T {
  if (typeof window === "undefined") return fb;
  try { const r = localStorage.getItem(key); return r ? (JSON.parse(r) as T) : fb; } catch { return fb; }
}
export const ACCOUNTS: CrmAccount[] = readLS<CrmAccount[]>("nexa-crm-accounts", []);
export const CONTACTS: CrmContact[] = readLS<CrmContact[]>("nexa-crm-contacts", []);

export const SEED_EVENTS: JourneyEvent[] = [];

// ---- lookups ----
export function accountById(id: string | null) {
  return ACCOUNTS.find((a) => a.id === id);
}
export function contactsForAccount(accountId: string) {
  return CONTACTS.filter((c) => c.accountId === accountId);
}
export function primaryContact(accountId: string) {
  const list = contactsForAccount(accountId);
  return list.find((c) => c.primary) ?? list[0];
}
export function ownerName(accountId: string) {
  return employeeName(accountById(accountId)?.ownerId ?? null);
}
export function entityName(accountId: string) {
  return entityById(accountById(accountId)?.entityId ?? "")?.name ?? "—";
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

export const CRM_EVENTS_KEY = "nexa-crm-events";
export const CRM_TAGS_KEY = "nexa-crm-tags";
export const CRM_STAGES_KEY = "nexa-crm-stages";

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

export const loadAddedEvents = () => read<JourneyEvent[]>(CRM_EVENTS_KEY, []);
export const saveAddedEvents = (e: JourneyEvent[]) => write(CRM_EVENTS_KEY, e);

export const loadTagOverrides = () => read<Record<string, string[]>>(CRM_TAGS_KEY, {});
export const saveTagOverrides = (t: Record<string, string[]>) => write(CRM_TAGS_KEY, t);

export const loadStageOverrides = () => read<Record<string, PipelineStage>>(CRM_STAGES_KEY, {});
export const saveStageOverrides = (s: Record<string, PipelineStage>) => write(CRM_STAGES_KEY, s);

/** Effective stage = local override ?? seed. */
export function effectiveStage(acc: CrmAccount, overrides: Record<string, PipelineStage>): PipelineStage {
  return overrides[acc.id] ?? acc.stage;
}

/** Effective tags for an event = override ?? seed tags. */
export function effectiveTags(ev: JourneyEvent, overrides: Record<string, string[]>): string[] {
  return overrides[ev.id] ?? ev.tags;
}

/** Merge seed + user-added events for an account, newest first. */
export function journeyForAccount(
  accountId: string,
  added: JourneyEvent[],
): JourneyEvent[] {
  return [...SEED_EVENTS, ...added]
    .filter((e) => e.accountId === accountId)
    .sort((a, b) => b.date.localeCompare(a.date));
}
