import { EMPLOYEES, employeeById, DEPARTMENTS } from "./employees";
import type { Employee } from "./types";

// ---------------------------------------------------------------------------
// Performance management — appraisal cycles, per-employee appraisals (self /
// manager / final ratings + competencies), OKRs (objectives → key results),
// a 9-box talent grid and rating-distribution rollups.
//
// All seeds are deterministic (derived from the employee index) so the same
// distribution renders every load. Mutations (manager/final rating, OKR
// current values) persist to localStorage under "nexa-performance".
// ---------------------------------------------------------------------------

export const PERFORMANCE_KEY = "nexa-performance";

export type CyclePhase = "self-review" | "manager-review" | "calibration" | "done";
export type AppraisalStatus = "pending" | "self-submitted" | "reviewed" | "finalised";

export interface ReviewCycle {
  id: string;
  label: string; // "H1 FY25-26"
  period: string; // human period
  phase: CyclePhase;
  active: boolean;
  startsOn: string; // ISO
  closesOn: string; // ISO
}

export interface Competency {
  name: string;
  score: number; // 1–5
}

export interface Appraisal {
  empId: string;
  cycle: string; // ReviewCycle.id
  selfRating: number; // 1–5
  managerRating: number; // 1–5
  finalRating: number; // 1–5 (set at calibration)
  competencies: Competency[];
  status: AppraisalStatus;
  reviewerId: string | null; // the manager
  promotionRecommended: boolean;
}

export interface KeyResult {
  title: string;
  target: number;
  current: number;
  unit: string;
}

export interface Objective {
  id: string;
  empId: string;
  title: string;
  keyResults: KeyResult[];
}

export interface NineBoxCell {
  row: number; // 0 (top / high potential) … 2 (bottom)
  col: number; // 0 (left / low perf) … 2 (right / high perf)
  label: string;
}

// ---- Review cycles --------------------------------------------------------

export const REVIEW_CYCLES: ReviewCycle[] = [];

export const ACTIVE_CYCLE = REVIEW_CYCLES.find((c) => c.active) ?? REVIEW_CYCLES[REVIEW_CYCLES.length - 1];

export function cycleById(id: string): ReviewCycle | undefined {
  return REVIEW_CYCLES.find((c) => c.id === id);
}

const PHASE_ORDER: CyclePhase[] = ["self-review", "manager-review", "calibration", "done"];

/** 0–1 progress through the cycle's phases. */
export function cycleProgress(cycle: ReviewCycle): number {
  const idx = PHASE_ORDER.indexOf(cycle.phase);
  return (idx + 1) / PHASE_ORDER.length;
}

export const PHASE_LABEL: Record<CyclePhase, string> = {
  "self-review": "Self review",
  "manager-review": "Manager review",
  "calibration": "Calibration",
  "done": "Closed",
};

// ---- Ratings --------------------------------------------------------------

export function ratingLabel(n: number): string {
  switch (Math.round(n)) {
    case 5: return "Outstanding";
    case 4: return "Exceeds";
    case 3: return "Meets";
    case 2: return "Below";
    default: return "Poor";
  }
}

export function ratingTone(n: number): "success" | "primary" | "warning" | "danger" | "default" {
  switch (Math.round(n)) {
    case 5: return "success";
    case 4: return "primary";
    case 3: return "default";
    case 2: return "warning";
    default: return "danger";
  }
}

// Stable index per employee → drives deterministic seeds.
function empIndex(empId: string): number {
  const i = EMPLOYEES.findIndex((e) => e.id === empId);
  return i < 0 ? 0 : i;
}

// A spread of self ratings (employees tend to rate themselves a touch high).
function seedSelfRating(idx: number): number {
  return [4, 5, 3, 4, 5, 3, 4, 3, 4, 5, 4, 3, 2, 4, 3, 4, 5, 4, 3, 5, 3, 2, 4, 3][idx % 24];
}

// Manager ratings — the "true" distribution we calibrate around.
function seedManagerRating(idx: number): number {
  return [4, 5, 3, 3, 5, 3, 3, 4, 4, 5, 3, 3, 2, 3, 2, 4, 4, 5, 3, 4, 3, 2, 4, 3][idx % 24];
}

const COMPETENCY_NAMES = ["Ownership", "Collaboration", "Execution", "Communication"];

function seedCompetencies(idx: number, managerRating: number): Competency[] {
  return COMPETENCY_NAMES.map((name, j) => {
    // jitter around the manager rating, clamped to 1–5, deterministic.
    const delta = ((idx + j * 7) % 3) - 1; // -1, 0, +1
    const score = Math.max(1, Math.min(5, managerRating + delta));
    return { name, score };
  });
}

function baseAppraisal(emp: Employee): Appraisal {
  const idx = empIndex(emp.id);
  const selfRating = seedSelfRating(idx);
  const managerRating = seedManagerRating(idx);
  // Calibration nudges manager → final; here final == manager for the demo seed.
  const finalRating = managerRating;
  return {
    empId: emp.id,
    cycle: ACTIVE_CYCLE.id,
    selfRating,
    managerRating,
    finalRating,
    competencies: seedCompetencies(idx, managerRating),
    status: emp.status === "exited" ? "reviewed" : "finalised",
    reviewerId: emp.managerId,
    promotionRecommended: finalRating >= 5 && emp.status !== "exited",
  };
}

// Build the seed map once.
const SEED_APPRAISALS: Record<string, Appraisal> = {};

// ---- OKRs -----------------------------------------------------------------

// Department-flavoured objectives. Seeded for several employees; the rest
// inherit a generic objective so the grid never looks empty.
function seedObjectives(emp: Employee): Objective[] {
  const idx = empIndex(emp.id);
  const dep = emp.departmentId;
  const objs: Objective[] = [];

  if (dep === "dep-sal") {
    objs.push({
      id: `okr-${emp.id}-1`, empId: emp.id, title: "Grow new-logo revenue",
      keyResults: [
        { title: "Closed-won ARR", target: 12, current: 7 + (idx % 4), unit: "₹L" },
        { title: "Qualified pipeline", target: 40, current: 22 + (idx % 9), unit: "₹L" },
      ],
    });
  } else if (dep === "dep-eng") {
    objs.push({
      id: `okr-${emp.id}-1`, empId: emp.id, title: "Ship roadmap reliably",
      keyResults: [
        { title: "Sprint commitments hit", target: 100, current: 78 + (idx % 15), unit: "%" },
        { title: "P1 incidents", target: 0, current: (idx % 3), unit: "open" },
      ],
    });
  } else if (dep === "dep-fin") {
    objs.push({
      id: `okr-${emp.id}-1`, empId: emp.id, title: "Faster, cleaner close",
      keyResults: [
        { title: "Books close (days)", target: 5, current: 8 - (idx % 3), unit: "days" },
        { title: "Reconciliations automated", target: 90, current: 60 + (idx % 20), unit: "%" },
      ],
    });
  } else if (dep === "dep-hr") {
    objs.push({
      id: `okr-${emp.id}-1`, empId: emp.id, title: "Hire & retain top talent",
      keyResults: [
        { title: "Roles closed", target: 8, current: 4 + (idx % 4), unit: "hires" },
        { title: "Regretted attrition", target: 5, current: 7 + (idx % 3), unit: "%" },
      ],
    });
  } else if (dep === "dep-proc") {
    objs.push({
      id: `okr-${emp.id}-1`, empId: emp.id, title: "Drive procurement savings",
      keyResults: [
        { title: "Cost savings", target: 15, current: 8 + (idx % 6), unit: "₹L" },
        { title: "On-time POs", target: 95, current: 80 + (idx % 12), unit: "%" },
      ],
    });
  } else {
    // Operations & leadership — operational excellence.
    objs.push({
      id: `okr-${emp.id}-1`, empId: emp.id, title: "Operational excellence",
      keyResults: [
        { title: "SLA adherence", target: 98, current: 85 + (idx % 12), unit: "%" },
        { title: "Process defects", target: 0, current: (idx % 4), unit: "open" },
      ],
    });
  }

  // Everyone gets a personal-growth objective as a second OKR for a subset.
  if (idx % 2 === 0) {
    objs.push({
      id: `okr-${emp.id}-2`, empId: emp.id, title: "Personal development",
      keyResults: [
        { title: "Certifications", target: 2, current: (idx % 3), unit: "done" },
        { title: "Mentoring sessions", target: 6, current: 2 + (idx % 5), unit: "sessions" },
      ],
    });
  }

  return objs;
}

const SEED_OBJECTIVES: Objective[] = [];

/** Progress % (0–100) for one key result. Targets that go *down* (target &lt; a
 *  baseline) are treated as "lower is better" relative to the current value. */
export function keyResultProgress(kr: KeyResult): number {
  if (kr.target === 0) {
    // Goal is zero (e.g. zero incidents) — full credit only when current is 0.
    return kr.current <= 0 ? 100 : Math.max(0, 100 - kr.current * 25);
  }
  // "lower is better" metrics (e.g. days-to-close): at/under target → 100,
  // otherwise scale down as the value overshoots the target.
  if (kr.unit === "days") {
    if (kr.current <= kr.target) return 100;
    return Math.max(0, Math.min(100, Math.round((kr.target / kr.current) * 100)));
  }
  return Math.max(0, Math.min(100, Math.round((kr.current / kr.target) * 100)));
}

/** Aggregate progress across an objective's key results. */
export function objectiveProgress(obj: Objective): number {
  if (obj.keyResults.length === 0) return 0;
  const sum = obj.keyResults.reduce((a, kr) => a + keyResultProgress(kr), 0);
  return Math.round(sum / obj.keyResults.length);
}

// ---- 9-box grid -----------------------------------------------------------

// Deterministic "potential" signal (1–5) seeded per employee, blended with the
// final rating to position the chip.
function seedPotential(idx: number): number {
  return [3, 5, 3, 4, 5, 4, 3, 4, 3, 5, 4, 3, 2, 4, 2, 5, 4, 4, 3, 4, 3, 2, 4, 3][idx % 24];
}

export function potentialFor(empId: string): number {
  return seedPotential(empIndex(empId));
}

// Map a 1–5 score into 3 bands: 0 (low 1–2), 1 (med 3), 2 (high 4–5).
function band(score: number): number {
  if (score <= 2) return 0;
  if (score === 3) return 1;
  return 2;
}

const NINE_BOX_LABELS: string[][] = [
  // row 0 = high potential (top)
  ["Rough Diamond", "High Potential", "Star"],
  // row 1 = medium potential
  ["Inconsistent Player", "Core Player", "High Performer"],
  // row 2 = low potential (bottom)
  ["Risk", "Effective", "Trusted Professional"],
];

/** Classify an employee into a 9-box cell (potential × performance). */
export function ninebox(emp: Employee): NineBoxCell {
  const app = appraisalFor(emp.id);
  const perfCol = band(app.finalRating); // x-axis 0..2
  const potBand = band(potentialFor(emp.id)); // 0 low .. 2 high
  const row = 2 - potBand; // invert so high potential is the top row (0)
  return { row, col: perfCol, label: NINE_BOX_LABELS[row][perfCol] };
}

// ---- localStorage overlay -------------------------------------------------

interface PerfOverrides {
  appraisals?: Record<string, Partial<Pick<Appraisal, "managerRating" | "finalRating" | "competencies" | "promotionRecommended" | "status">>>;
  okrs?: Record<string, number>; // `${objId}:${krIndex}` → current
}

function readOverrides(): PerfOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PERFORMANCE_KEY);
    return raw ? (JSON.parse(raw) as PerfOverrides) : {};
  } catch {
    return {};
  }
}

function writeOverrides(o: PerfOverrides): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PERFORMANCE_KEY, JSON.stringify(o));
  } catch {
    /* ignore */
  }
}

/** Effective appraisal = seed merged with any persisted override. */
export function appraisalFor(empId: string): Appraisal {
  const base = SEED_APPRAISALS[empId];
  if (!base) {
    const e = employeeById(empId);
    return e ? baseAppraisal(e) : {
      empId, cycle: ACTIVE_CYCLE.id, selfRating: 3, managerRating: 3, finalRating: 3,
      competencies: [], status: "pending", reviewerId: null, promotionRecommended: false,
    };
  }
  const ov = readOverrides().appraisals?.[empId];
  if (!ov) return base;
  return {
    ...base,
    ...ov,
    competencies: ov.competencies ?? base.competencies,
  };
}

export function allAppraisals(cycle = ACTIVE_CYCLE.id): Appraisal[] {
  return EMPLOYEES.map((e) => appraisalFor(e.id)).filter((a) => a.cycle === cycle);
}

/** Persist a manager/final rating + competency + promotion edit. */
export function saveAppraisal(
  empId: string,
  patch: Partial<Pick<Appraisal, "managerRating" | "finalRating" | "competencies" | "promotionRecommended" | "status">>,
): void {
  const o = readOverrides();
  o.appraisals = { ...(o.appraisals ?? {}), [empId]: { ...(o.appraisals?.[empId] ?? {}), ...patch } };
  writeOverrides(o);
}

/** Effective objectives for an employee (with persisted "current" values). */
export function objectivesFor(empId: string): Objective[] {
  const ov = readOverrides().okrs ?? {};
  return SEED_OBJECTIVES.filter((o) => o.empId === empId).map((o) => ({
    ...o,
    keyResults: o.keyResults.map((kr, i) => {
      const key = `${o.id}:${i}`;
      return key in ov ? { ...kr, current: ov[key] } : { ...kr };
    }),
  }));
}

export function allObjectives(): Objective[] {
  return EMPLOYEES.flatMap((e) => objectivesFor(e.id));
}

/** Persist an updated "current" value for one key result. */
export function saveKeyResultCurrent(objId: string, krIndex: number, current: number): void {
  const o = readOverrides();
  o.okrs = { ...(o.okrs ?? {}), [`${objId}:${krIndex}`]: current };
  writeOverrides(o);
}

// ---- Rollups --------------------------------------------------------------

export interface RatingDistribution {
  rating: number; // 1–5
  label: string;
  count: number;
}

/** Count of finalRatings 1..5 across the (optionally filtered) population. */
export function ratingDistribution(empIds?: string[]): RatingDistribution[] {
  const ids = empIds ?? EMPLOYEES.map((e) => e.id);
  const counts = [1, 2, 3, 4, 5].map((rating) => ({
    rating,
    label: ratingLabel(rating),
    count: ids.filter((id) => Math.round(appraisalFor(id).finalRating) === rating).length,
  }));
  return counts;
}

export interface PerfSummary {
  headcount: number;
  avgRating: number;
  pctExceeding: number; // % with final >= 4
  promotions: number;
}

export function perfSummary(empIds?: string[]): PerfSummary {
  const ids = empIds ?? EMPLOYEES.map((e) => e.id);
  if (ids.length === 0) return { headcount: 0, avgRating: 0, pctExceeding: 0, promotions: 0 };
  const apps = ids.map((id) => appraisalFor(id));
  const avg = apps.reduce((a, x) => a + x.finalRating, 0) / apps.length;
  const exceeding = apps.filter((a) => a.finalRating >= 4).length;
  const promotions = apps.filter((a) => a.promotionRecommended).length;
  return {
    headcount: ids.length,
    avgRating: Math.round(avg * 100) / 100,
    pctExceeding: Math.round((exceeding / apps.length) * 100),
    promotions,
  };
}

export interface TeamRollup {
  id: string;
  name: string;
  headcount: number;
  avgRating: number;
  promotions: number;
}

/** Rollup keyed by department. */
export function departmentRollups(): TeamRollup[] {
  return DEPARTMENTS.map((d) => {
    const ids = EMPLOYEES.filter((e) => e.departmentId === d.id).map((e) => e.id);
    const s = perfSummary(ids);
    return { id: d.id, name: d.name, headcount: s.headcount, avgRating: s.avgRating, promotions: s.promotions };
  }).filter((r) => r.headcount > 0);
}

/** Rollup keyed by manager (people who have direct reports). */
export function managerRollups(): TeamRollup[] {
  const managerIds = [...new Set(EMPLOYEES.map((e) => e.managerId).filter((m): m is string => !!m))];
  return managerIds.map((mid) => {
    const ids = EMPLOYEES.filter((e) => e.managerId === mid).map((e) => e.id);
    const s = perfSummary(ids);
    const mgr = employeeById(mid);
    return { id: mid, name: mgr?.name ?? "—", headcount: s.headcount, avgRating: s.avgRating, promotions: s.promotions };
  });
}
