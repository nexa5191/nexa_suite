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

export const ACCOUNTS: CrmAccount[] = [
  {
    id: "acc-001", name: "FreshMart Retail", legalName: "FreshMart Retail Pvt Ltd", industry: "Retail Chain",
    gstin: "29AAFCF1234R1Z6", address: "14 MG Road, Ashok Nagar", city: "Bengaluru", state: "Karnataka", stateCode: "29",
    email: "purchase@freshmart.in", phone: "+91 80 4567 1200", website: "freshmart.in",
    ownerId: "emp-010", entityId: "ent-nexa-in", stage: "won", dealValue: 4800000, since: "2024-08-12",
  },
  {
    id: "acc-002", name: "Spencer's Gourmet", legalName: "Spencer Gourmet Foods LLP", industry: "HoReCa",
    gstin: "27AAGCS5678P1Z2", address: "Plot 7, Andheri East", city: "Mumbai", state: "Maharashtra", stateCode: "27",
    email: "ops@spencersgourmet.in", phone: "+91 22 2834 5566", website: "spencersgourmet.in",
    ownerId: "emp-011", entityId: "ent-nexa-trade", stage: "won", dealValue: 2600000, since: "2025-01-20",
  },
  {
    id: "acc-003", name: "QuickBasket", legalName: "QuickBasket Commerce Pvt Ltd", industry: "Quick Commerce",
    gstin: "29AABCQ9012K1Z8", address: "Tower B, Outer Ring Road, Bellandur", city: "Bengaluru", state: "Karnataka", stateCode: "29",
    email: "vendors@quickbasket.com", phone: "+91 80 6677 8899", website: "quickbasket.com",
    ownerId: "emp-010", entityId: "ent-nexa-in", stage: "negotiation", dealValue: 9200000, since: "2026-03-04",
  },
  {
    id: "acc-004", name: "Delhi Cash & Carry", legalName: "Delhi Cash and Carry Pvt Ltd", industry: "Distribution",
    gstin: "07AAECD3456L1Z0", address: "Khasra 22, Okhla Phase II", city: "New Delhi", state: "Delhi", stateCode: "07",
    email: "buying@delhicc.in", phone: "+91 11 4109 2233", website: "delhicc.in",
    ownerId: "emp-011", entityId: "ent-nexa-trade", stage: "proposal", dealValue: 5400000, since: "2026-04-18",
  },
  {
    id: "acc-005", name: "Pantry Pulse", legalName: "Pantry Pulse Online Pvt Ltd", industry: "E-commerce",
    gstin: "29AAHCP7788M1Z4", address: "WeWork, Embassy Golf Links", city: "Bengaluru", state: "Karnataka", stateCode: "29",
    email: "supply@pantrypulse.in", phone: "+91 80 7788 1010", website: "pantrypulse.in",
    ownerId: "emp-013", entityId: "ent-nexa-in", stage: "qualified", dealValue: 3100000, since: "2026-05-02",
  },
  {
    id: "acc-006", name: "Asia Pacific Foods", legalName: "Asia Pacific Foods Pte Ltd", industry: "Export",
    gstin: "—", address: "8 Marina View, Asia Square", city: "Singapore", state: "Singapore", stateCode: "SG",
    email: "imports@apfoods.sg", phone: "+65 6812 4400", website: "apfoods.sg",
    ownerId: "emp-012", entityId: "ent-nexa-global", stage: "negotiation", dealValue: 12800000, since: "2026-02-28",
  },
  {
    id: "acc-007", name: "Grand Vista Hotels", legalName: "Grand Vista Hospitality Pvt Ltd", industry: "HoReCa",
    gstin: "27AAJCG2211N1Z9", address: "Linking Road, Bandra West", city: "Mumbai", state: "Maharashtra", stateCode: "27",
    email: "procurement@grandvista.in", phone: "+91 22 6655 4400", website: "grandvista.in",
    ownerId: "emp-011", entityId: "ent-nexa-trade", stage: "lead", dealValue: 1800000, since: "2026-05-26",
  },
  {
    id: "acc-008", name: "Annapurna Caterers", legalName: "Annapurna Institutional Catering", industry: "Institutional",
    gstin: "29AAKCA6543Q1Z1", address: "Industrial Area, Peenya", city: "Bengaluru", state: "Karnataka", stateCode: "29",
    email: "accounts@annapurnacaterers.in", phone: "+91 80 2839 7766", website: "annapurnacaterers.in",
    ownerId: "emp-013", entityId: "ent-nexa-in", stage: "lost", dealValue: 2200000, since: "2026-01-10",
  },
];

interface RawContact { acc: string; name: string; title: string; primary?: boolean }
const RAW_CONTACTS: RawContact[] = [
  { acc: "acc-001", name: "Ramesh Gowda", title: "Head of Procurement", primary: true },
  { acc: "acc-001", name: "Latha Suresh", title: "Category Manager" },
  { acc: "acc-002", name: "Farhan Qureshi", title: "Purchase Director", primary: true },
  { acc: "acc-003", name: "Ankita Bose", title: "VP Supply Chain", primary: true },
  { acc: "acc-003", name: "Sameer Khanna", title: "Sourcing Lead" },
  { acc: "acc-004", name: "Harpreet Singh", title: "Buying Head", primary: true },
  { acc: "acc-005", name: "Tanvi Shah", title: "Founder", primary: true },
  { acc: "acc-006", name: "Lim Wei Jie", title: "Import Manager", primary: true },
  { acc: "acc-007", name: "Deepa Menon", title: "F&B Purchase Manager", primary: true },
  { acc: "acc-008", name: "Govind Rao", title: "Operations Head", primary: true },
];

const slugEmail = (name: string, domain: string) => `${name.toLowerCase().replace(/[^a-z]+/g, ".")}@${domain}`;
const phoneFor = (i: number) => `+91 9${String(7000000000 + i * 211733).slice(0, 9)}`;

export const CONTACTS: CrmContact[] = RAW_CONTACTS.map((c, i) => {
  const acc = ACCOUNTS.find((a) => a.id === c.acc)!;
  return {
    id: `con-${String(i + 1).padStart(3, "0")}`,
    accountId: c.acc,
    name: c.name,
    title: c.title,
    email: slugEmail(c.name, acc.website),
    phone: phoneFor(i),
    primary: !!c.primary,
  };
});

interface RawEvent { acc: string; date: string; type: EventType; title: string; detail: string; tags: string[]; by: string }
const RAW_EVENTS: RawEvent[] = [
  // acc-001 FreshMart — won customer
  { acc: "acc-001", date: "2024-08-12", type: "note", title: "Inbound enquiry via website", detail: "FreshMart looking for a staples + edible oil supplier across 12 Bengaluru stores.", tags: ["intro"], by: "emp-010" },
  { acc: "acc-001", date: "2024-09-03", type: "meeting", title: "Discovery meeting at MG Road", detail: "Met Ramesh Gowda; mapped weekly volumes and delivery windows.", tags: ["decision-maker"], by: "emp-010" },
  { acc: "acc-001", date: "2024-10-15", type: "deal", title: "Annual supply contract signed", detail: "₹48L annual rate contract; fortnightly billing cycle.", tags: ["champion"], by: "emp-010" },
  { acc: "acc-001", date: "2026-05-20", type: "call", title: "Q2 review — expansion", detail: "Adding 4 new stores; opportunity to grow the contract.", tags: ["upsell", "follow-up"], by: "emp-010" },

  // acc-002 Spencer's — won
  { acc: "acc-002", date: "2025-01-20", type: "note", title: "Referral from Grand Vista", detail: "Premium HoReCa account; needs specialty flours and oils.", tags: ["intro"], by: "emp-011" },
  { acc: "acc-002", date: "2025-02-11", type: "deal", title: "Pilot order converted", detail: "Pilot went well; moved to a monthly standing order.", tags: ["champion"], by: "emp-011" },
  { acc: "acc-002", date: "2026-06-01", type: "email", title: "Renewal proposal sent", detail: "FY26-27 renewal at a 4% volume discount.", tags: ["renewal", "pricing"], by: "emp-011" },

  // acc-003 QuickBasket — negotiation, big
  { acc: "acc-003", date: "2026-03-04", type: "note", title: "RFP received", detail: "Quick-commerce player; aggressive SLAs, 2-hour replenishment.", tags: ["hot"], by: "emp-010" },
  { acc: "acc-003", date: "2026-03-22", type: "meeting", title: "Demo of dark-store fulfilment", detail: "Walked Ankita through our Bellandur depot capacity.", tags: ["demo", "decision-maker"], by: "emp-010" },
  { acc: "acc-003", date: "2026-05-18", type: "call", title: "Pricing negotiation", detail: "Pushing for 6% lower landed cost; margin under pressure.", tags: ["pricing", "at-risk"], by: "emp-010" },
  { acc: "acc-003", date: "2026-06-02", type: "note", title: "Legal reviewing MSA", detail: "Procurement aligned; contract with their legal for sign-off.", tags: ["blocker", "follow-up"], by: "emp-003" },

  // acc-004 Delhi C&C — proposal
  { acc: "acc-004", date: "2026-04-18", type: "meeting", title: "Intro at Okhla warehouse", detail: "Bulk distribution; interested in private-label packaging.", tags: ["intro", "decision-maker"], by: "emp-011" },
  { acc: "acc-004", date: "2026-05-30", type: "email", title: "Commercial proposal shared", detail: "Slab pricing for 3 SKUs + Delhi-branch logistics.", tags: ["pricing"], by: "emp-011" },

  // acc-005 Pantry Pulse — qualified
  { acc: "acc-005", date: "2026-05-02", type: "note", title: "Founder reached out on LinkedIn", detail: "Early-stage D2C; small but fast-growing volumes.", tags: ["intro"], by: "emp-013" },
  { acc: "acc-005", date: "2026-05-21", type: "call", title: "Qualification call", detail: "Budget and timeline confirmed; needs GST-compliant invoicing.", tags: ["follow-up"], by: "emp-013" },

  // acc-006 Asia Pacific — export, negotiation
  { acc: "acc-006", date: "2026-02-28", type: "note", title: "Export enquiry — Singapore", detail: "Wants FOB pricing for organic rice & spices, monthly container.", tags: ["hot"], by: "emp-012" },
  { acc: "acc-006", date: "2026-04-09", type: "meeting", title: "Video call on compliance", detail: "Discussed SG import norms, labelling and Incoterms.", tags: ["decision-maker"], by: "emp-012" },
  { acc: "acc-006", date: "2026-05-27", type: "deal", title: "Trial container quoted", detail: "Sent quote for a 1x20ft trial; awaiting PO.", tags: ["pricing", "follow-up"], by: "emp-012" },

  // acc-007 Grand Vista — lead
  { acc: "acc-007", date: "2026-05-26", type: "note", title: "Cold outreach", detail: "Hotel group; F&B purchase manager open to a meeting.", tags: ["intro", "follow-up"], by: "emp-011" },

  // acc-008 Annapurna — lost
  { acc: "acc-008", date: "2026-01-10", type: "note", title: "Tender invitation", detail: "Institutional catering tender for staples.", tags: ["intro"], by: "emp-013" },
  { acc: "acc-008", date: "2026-02-14", type: "stage", title: "Lost to incumbent", detail: "Incumbent matched price on a 2-year lock-in. Revisit at renewal.", tags: ["at-risk"], by: "emp-013" },
];

export const SEED_EVENTS: JourneyEvent[] = RAW_EVENTS.map((e, i) => ({
  id: `evt-${String(i + 1).padStart(3, "0")}`,
  accountId: e.acc,
  date: e.date,
  type: e.type,
  title: e.title,
  detail: e.detail,
  tags: e.tags,
  authorId: e.by,
  seed: true,
}));

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
