import { LOCATIONS } from "@/lib/accounting/org";

// ---------------------------------------------------------------------------
// Holiday calendar — 2026. National holidays apply to every location; the rest
// are location/state specific. The /hr/holidays page shows all locations.
// ---------------------------------------------------------------------------

export interface Holiday {
  id: string;
  name: string;
  date: string; // ISO
  national: boolean;
  locationIds: string[]; // locations that observe it (all, for national)
  optional?: boolean;
}

const ALL_LOC = LOCATIONS.map((l) => l.id);
const KA = ["loc-blr", "loc-mys"]; // Karnataka
const MH = ["loc-mum"]; // Maharashtra (Mumbai depot)
const DL = ["loc-del"]; // Delhi
const SG = ["loc-sg"]; // Singapore

function nat(id: string, name: string, date: string, optional = false): Holiday {
  return { id, name, date, national: true, locationIds: ALL_LOC, optional };
}
function loc(id: string, name: string, date: string, locationIds: string[], optional = false): Holiday {
  return { id, name, date, national: false, locationIds, optional };
}

export const HOLIDAYS: Holiday[] = [
  nat("hol-1", "New Year's Day", "2026-01-01"),
  nat("hol-2", "Republic Day", "2026-01-26"),
  nat("hol-3", "Maha Shivaratri", "2026-02-15", true),
  nat("hol-4", "Holi", "2026-03-04"),
  loc("hol-5", "Ugadi / Gudi Padwa", "2026-03-20", [...KA, ...MH]),
  nat("hol-6", "Good Friday", "2026-04-03"),
  nat("hol-7", "Dr. Ambedkar Jayanti", "2026-04-14"),
  loc("hol-8", "Maharashtra Day", "2026-05-01", MH),
  nat("hol-9", "Bakrid (Eid al-Adha)", "2026-06-27"),
  loc("hol-10", "Singapore National Day", "2026-08-09", SG),
  nat("hol-11", "Independence Day", "2026-08-15"),
  loc("hol-12", "Ganesh Chaturthi", "2026-09-14", [...MH, ...KA]),
  nat("hol-13", "Gandhi Jayanti", "2026-10-02"),
  nat("hol-14", "Dussehra", "2026-10-20"),
  loc("hol-15", "Karnataka Rajyotsava", "2026-11-01", KA),
  nat("hol-16", "Diwali", "2026-11-08"),
  loc("hol-17", "Guru Nanak Jayanti", "2026-11-24", DL, true),
  nat("hol-18", "Christmas", "2026-12-25"),
];

const HOLIDAY_DATES_BY_LOC = new Map<string, Set<string>>();
for (const l of LOCATIONS) HOLIDAY_DATES_BY_LOC.set(l.id, new Set());
for (const h of HOLIDAYS) {
  for (const lid of h.locationIds) HOLIDAY_DATES_BY_LOC.get(lid)?.add(h.date);
}

export function isHoliday(locationId: string, date: string) {
  return HOLIDAY_DATES_BY_LOC.get(locationId)?.has(date) ?? false;
}

export function holidaysForLocation(locationId: string) {
  return HOLIDAYS.filter((h) => h.locationIds.includes(locationId));
}

export function upcomingHolidays(fromDate: string, n = 5) {
  return HOLIDAYS.filter((h) => h.date >= fromDate).sort((a, b) => a.date.localeCompare(b.date)).slice(0, n);
}
