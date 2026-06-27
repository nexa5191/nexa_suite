// ---------------------------------------------------------------------------
// NEXA recruitment — CV bank (talent pool) + job openings.
//
// Candidates live in a searchable bank; each may be tagged to an open role or
// kept in the general pool for future openings. Reuses the org department /
// location tree.
// ---------------------------------------------------------------------------

export type OpeningStatus = "open" | "on-hold" | "closed";
export type OpeningType = "full-time" | "contract" | "intern";

export interface Opening {
  id: string;
  title: string;
  departmentId: string;
  locationId: string;
  type: OpeningType;
  status: OpeningStatus;
  positions: number;
  postedOn: string; // ISO
  hiringManagerId: string;
}

export type CandidateSource = "referral" | "linkedin" | "portal" | "agency" | "walk-in";
export type CandidateStage =
  | "new"
  | "screening"
  | "shortlisted"
  | "interview"
  | "offer"
  | "hired"
  | "archived";

export interface Candidate {
  id: string;
  name: string;
  email: string;
  phone: string;
  desiredRole: string;
  currentCompany: string;
  location: string;
  skills: string[];
  experienceYears: number;
  noticePeriodDays: number;
  expectedCtcLakh: number; // ₹ lakh per annum
  source: CandidateSource;
  stage: CandidateStage;
  rating: number; // 1–5
  openingId: string | null; // null → general talent pool
  appliedOn: string; // ISO
  resumeFile: string;
  agencyId?: string | null; // submitting recruitment agency (for commissions)
}

// ---------------------------------------------------------------------------
// Recruitment agencies — third-party staffing partners who submit CVs against
// open roles through the agency portal and earn a commission when their
// candidate is hired (a % of the candidate's annual CTC).
// ---------------------------------------------------------------------------
export interface Agency {
  id: string;
  name: string;
  spoc: string; // single point of contact
  email: string;
  commissionPct: number; // % of annual CTC, paid on successful hire
  gstin?: string;
}

export const AGENCIES: Agency[] = [];

const AGENCY_BY_ID = new Map(AGENCIES.map((a) => [a.id, a]));
export function agencyById(id: string | null | undefined): Agency | undefined {
  return id ? AGENCY_BY_ID.get(id) : undefined;
}
export function agencyName(id: string | null | undefined): string {
  return agencyById(id)?.name ?? "—";
}

/** Commission payable on a candidate (₹), given their CTC and agency rate. */
export function commissionAmount(expectedCtcLakh: number, agency: Agency | undefined): number {
  if (!agency) return 0;
  return Math.round(expectedCtcLakh * 100000 * (agency.commissionPct / 100));
}

export const OPENINGS: Opening[] = [];

interface RawCand {
  name: string; role: string; company: string; loc: string; skills: string[];
  exp: number; notice: number; ctc: number; source: CandidateSource;
  stage: CandidateStage; rating: number; opening: string | null; appliedOn: string;
  agency?: string;
}

const RAW: RawCand[] = [];

const phoneFor = (i: number) => `+91 9${String(8000000000 + i * 137777).slice(0, 9)}`;

export const CANDIDATES: Candidate[] = RAW.map((c, i) => ({
  id: `cand-${String(i + 1).padStart(3, "0")}`,
  name: c.name,
  email: `${c.name.toLowerCase().replace(/[^a-z]+/g, ".")}@gmail.com`,
  phone: phoneFor(i),
  desiredRole: c.role,
  currentCompany: c.company,
  location: c.loc,
  skills: c.skills,
  experienceYears: c.exp,
  noticePeriodDays: c.notice,
  expectedCtcLakh: c.ctc,
  source: c.source,
  stage: c.stage,
  rating: c.rating,
  openingId: c.opening,
  appliedOn: c.appliedOn,
  resumeFile: `${c.name.replace(/\s+/g, "_")}_CV.pdf`,
  agencyId: c.agency ?? null,
}));

export function openingById(id: string | null) {
  return id ? OPENINGS.find((o) => o.id === id) : undefined;
}
export function candidatesForOpening(openingId: string) {
  return CANDIDATES.filter((c) => c.openingId === openingId);
}

export const ALL_SKILLS = Array.from(new Set(CANDIDATES.flatMap((c) => c.skills))).sort();

export const STAGE_ORDER: CandidateStage[] = [
  "new", "screening", "shortlisted", "interview", "offer", "hired", "archived",
];
