// ---------------------------------------------------------------------------
// NEXA calendar — personal (Google) + shared team / holiday / leave calendars,
// with document attachments on events.
//
// The personal calendar (cal-me) is seeded from a snapshot of the connected
// Google Calendar; see PERSONAL_EVENTS (replace with the real pull). All other
// calendars are internal shared calendars.
// ---------------------------------------------------------------------------

export type CalendarKind = "personal" | "team" | "holiday" | "leave";
export type CalProvider = "google" | "microsoft" | "internal";

export interface Calendar {
  id: string;
  name: string;
  color: string; // hex for the calendar dot / event chip
  kind: CalendarKind;
  provider: CalProvider;
  connected: boolean;
}

export interface CalAttachment {
  name: string;
  kind: "pdf" | "doc" | "sheet" | "slide" | "link";
}

export interface CalEvent {
  id: string;
  calendarId: string;
  title: string;
  start: string; // "YYYY-MM-DDTHH:mm" (timed) or "YYYY-MM-DD" (all-day)
  end: string;
  allDay: boolean;
  location?: string;
  description?: string;
  attendeeIds?: string[]; // employee ids
  attachments?: CalAttachment[];
}

export const TODAY = "2026-06-05";

export const CALENDARS: Calendar[] = [
  { id: "cal-me", name: "My Calendar", color: "#2563eb", kind: "personal", provider: "google", connected: true },
  { id: "cal-finance", name: "Finance Team", color: "#0d9488", kind: "team", provider: "internal", connected: true },
  { id: "cal-sales", name: "Sales Team", color: "#d97706", kind: "team", provider: "internal", connected: true },
  { id: "cal-eng", name: "Engineering", color: "#7c3aed", kind: "team", provider: "internal", connected: true },
  { id: "cal-holidays", name: "Company Holidays", color: "#dc2626", kind: "holiday", provider: "internal", connected: true },
  { id: "cal-leave", name: "Team Leave", color: "#65a30d", kind: "leave", provider: "internal", connected: true },
];

// ---- Personal calendar (Google snapshot) ----------------------------------
// NOTE: replace this array with the real Google Calendar pull once authorised.
// Shape is stable, so the UI does not change.
export const PERSONAL_EVENTS: CalEvent[] = [
  { id: "ev-me-1", calendarId: "cal-me", title: "1:1 with Manager", start: "2026-06-08T09:30", end: "2026-06-08T10:00", allDay: false },
  { id: "ev-me-2", calendarId: "cal-me", title: "Dentist appointment", start: "2026-06-10T17:00", end: "2026-06-10T17:45", allDay: false, location: "Indiranagar" },
  { id: "ev-me-3", calendarId: "cal-me", title: "Focus block — reporting", start: "2026-06-12T14:00", end: "2026-06-12T16:00", allDay: false },
  { id: "ev-me-4", calendarId: "cal-me", title: "Flight to Mumbai", start: "2026-06-22T07:15", end: "2026-06-22T09:30", allDay: false, location: "BLR → BOM" },
];

// ---- Shared / internal calendars ------------------------------------------
const SHARED_EVENTS: CalEvent[] = [
  // Finance
  { id: "ev-f-1", calendarId: "cal-finance", title: "Month-end close kickoff", start: "2026-06-02T10:00", end: "2026-06-02T11:00", allDay: false, attendeeIds: ["emp-002", "emp-006", "emp-008"], description: "Plan the May close and assign owners.", attachments: [{ name: "Close checklist.xlsx", kind: "sheet" }] },
  { id: "ev-f-2", calendarId: "cal-finance", title: "GST filing review", start: "2026-06-09T15:00", end: "2026-06-09T16:00", allDay: false, attendeeIds: ["emp-009", "emp-002"], attachments: [{ name: "GSTR-3B workings.xlsx", kind: "sheet" }] },
  { id: "ev-f-3", calendarId: "cal-finance", title: "Statutory audit walkthrough", start: "2026-06-16T11:00", end: "2026-06-16T12:30", allDay: false, attendeeIds: ["emp-002", "emp-006"], location: "Bengaluru HQ", attachments: [{ name: "FY25-26 Audit Report.pdf", kind: "pdf" }] },
  { id: "ev-f-4", calendarId: "cal-finance", title: "Payroll run sign-off", start: "2026-06-26T16:00", end: "2026-06-26T16:30", allDay: false, attendeeIds: ["emp-002", "emp-004"] },
  // Sales
  { id: "ev-s-1", calendarId: "cal-sales", title: "West region pipeline review", start: "2026-06-04T11:00", end: "2026-06-04T12:00", allDay: false, attendeeIds: ["emp-003", "emp-010", "emp-011"], attachments: [{ name: "Pipeline deck.pptx", kind: "slide" }] },
  { id: "ev-s-2", calendarId: "cal-sales", title: "Distributor meet — Mumbai", start: "2026-06-11T10:00", end: "2026-06-11T13:00", allDay: false, location: "Mumbai Depot", attendeeIds: ["emp-003", "emp-010"] },
  { id: "ev-s-3", calendarId: "cal-sales", title: "Q3 target planning", start: "2026-06-18T15:00", end: "2026-06-18T16:30", allDay: false, attendeeIds: ["emp-003", "emp-011", "emp-013"] },
  // Engineering
  { id: "ev-e-1", calendarId: "cal-eng", title: "ERP rollout standup", start: "2026-06-03T09:30", end: "2026-06-03T09:45", allDay: false, attendeeIds: ["emp-005", "emp-016", "emp-017"] },
  { id: "ev-e-2", calendarId: "cal-eng", title: "Sprint planning", start: "2026-06-09T10:00", end: "2026-06-09T11:30", allDay: false, attendeeIds: ["emp-005", "emp-016", "emp-017", "emp-019"], attachments: [{ name: "Sprint backlog.sheet", kind: "sheet" }] },
  { id: "ev-e-3", calendarId: "cal-eng", title: "ERP UAT demo", start: "2026-06-17T14:00", end: "2026-06-17T15:00", allDay: false, attendeeIds: ["emp-005", "emp-016"], location: "Online", attachments: [{ name: "UAT scenarios.pdf", kind: "pdf" }] },
  // Holidays (all-day)
  { id: "ev-h-1", calendarId: "cal-holidays", title: "Bakrid (Maharashtra, Delhi)", start: "2026-06-27", end: "2026-06-27", allDay: true, description: "Holiday for loc-mum, loc-del." },
  // Leave (all-day, derived-style)
  { id: "ev-l-1", calendarId: "cal-leave", title: "Isha Kapoor — Earned Leave", start: "2026-06-22", end: "2026-06-26", allDay: true },
  { id: "ev-l-2", calendarId: "cal-leave", title: "Tara Krishnan — WFH", start: "2026-06-19", end: "2026-06-19", allDay: true },
];

export const CAL_EVENTS: CalEvent[] = [...PERSONAL_EVENTS, ...SHARED_EVENTS];

export function calendarById(id: string) {
  return CALENDARS.find((c) => c.id === id);
}

/** "YYYY-MM-DD" date key for an event's start. */
export function eventDateKey(ev: CalEvent) {
  return ev.start.slice(0, 10);
}

/** All event date keys an all-day event spans (inclusive); timed events → [start]. */
export function eventSpan(ev: CalEvent): string[] {
  if (!ev.allDay) return [eventDateKey(ev)];
  const out: string[] = [];
  const a = new Date(`${ev.start.slice(0, 10)}T00:00:00Z`);
  const b = new Date(`${ev.end.slice(0, 10)}T00:00:00Z`);
  for (const d = new Date(a); d <= b; d.setUTCDate(d.getUTCDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

export function formatEventTime(ev: CalEvent) {
  if (ev.allDay) return "All day";
  const t = (s: string) => {
    const [h, m] = s.slice(11).split(":").map(Number);
    const ap = h >= 12 ? "PM" : "AM";
    const hh = h % 12 || 12;
    return `${hh}:${String(m).padStart(2, "0")} ${ap}`;
  };
  return `${t(ev.start)} – ${t(ev.end)}`;
}
