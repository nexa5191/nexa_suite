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
export const PERSONAL_EVENTS: CalEvent[] = [];

const SHARED_EVENTS: CalEvent[] = [];

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
