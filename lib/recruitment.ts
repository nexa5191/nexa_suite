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
}

export const OPENINGS: Opening[] = [
  { id: "op-1", title: "Senior Accountant", departmentId: "dep-fin", locationId: "loc-blr", type: "full-time", status: "open", positions: 1, postedOn: "2026-05-12", hiringManagerId: "emp-002" },
  { id: "op-2", title: "Sales Manager — West", departmentId: "dep-sal", locationId: "loc-mum", type: "full-time", status: "open", positions: 2, postedOn: "2026-05-20", hiringManagerId: "emp-003" },
  { id: "op-3", title: "Backend Engineer", departmentId: "dep-eng", locationId: "loc-blr", type: "full-time", status: "on-hold", positions: 1, postedOn: "2026-04-28", hiringManagerId: "emp-005" },
  { id: "op-4", title: "Procurement Executive", departmentId: "dep-proc", locationId: "loc-mum", type: "full-time", status: "open", positions: 1, postedOn: "2026-06-01", hiringManagerId: "emp-023" },
  { id: "op-5", title: "Product Design Intern", departmentId: "dep-eng", locationId: "loc-sg", type: "intern", status: "open", positions: 1, postedOn: "2026-05-30", hiringManagerId: "emp-005" },
  { id: "op-6", title: "HR Generalist", departmentId: "dep-hr", locationId: "loc-blr", type: "full-time", status: "closed", positions: 1, postedOn: "2026-03-15", hiringManagerId: "emp-004" },
];

interface RawCand {
  name: string; role: string; company: string; loc: string; skills: string[];
  exp: number; notice: number; ctc: number; source: CandidateSource;
  stage: CandidateStage; rating: number; opening: string | null; appliedOn: string;
}

const RAW: RawCand[] = [
  { name: "Nikhil Bansal", role: "Senior Accountant", company: "Tally Solutions", loc: "Bengaluru", skills: ["Tally", "GST", "IND-AS", "Reconciliation"], exp: 7, notice: 60, ctc: 14, source: "linkedin", stage: "interview", rating: 5, opening: "op-1", appliedOn: "2026-05-18" },
  { name: "Shruti Deshpande", role: "Accountant", company: "Infosys BPM", loc: "Bengaluru", skills: ["GST", "TDS", "SAP FICO"], exp: 5, notice: 30, ctc: 11, source: "referral", stage: "shortlisted", rating: 4, opening: "op-1", appliedOn: "2026-05-22" },
  { name: "Imran Sheikh", role: "Finance Analyst", company: "Wipro", loc: "Pune", skills: ["Excel", "FP&A", "Power BI"], exp: 4, notice: 45, ctc: 10, source: "portal", stage: "screening", rating: 3, opening: "op-1", appliedOn: "2026-05-29" },
  { name: "Aishwarya Menon", role: "Regional Sales Manager", company: "Marico", loc: "Mumbai", skills: ["FMCG", "Distributor Mgmt", "Negotiation"], exp: 9, notice: 90, ctc: 22, source: "agency", stage: "offer", rating: 5, opening: "op-2", appliedOn: "2026-05-25" },
  { name: "Rohit Khanna", role: "Area Sales Manager", company: "Britannia", loc: "Mumbai", skills: ["Retail", "Channel Sales", "Forecasting"], exp: 6, notice: 30, ctc: 16, source: "linkedin", stage: "interview", rating: 4, opening: "op-2", appliedOn: "2026-05-27" },
  { name: "Pradeep Kumar", role: "Sales Executive", company: "Dabur", loc: "Nagpur", skills: ["Field Sales", "Primary/Secondary"], exp: 3, notice: 15, ctc: 8, source: "referral", stage: "new", rating: 3, opening: "op-2", appliedOn: "2026-06-02" },
  { name: "Vivek Subramanian", role: "Backend Engineer", company: "Razorpay", loc: "Bengaluru", skills: ["Node.js", "PostgreSQL", "AWS", "Microservices"], exp: 5, notice: 60, ctc: 28, source: "linkedin", stage: "shortlisted", rating: 5, opening: "op-3", appliedOn: "2026-05-08" },
  { name: "Megha Agarwal", role: "Software Engineer", company: "Swiggy", loc: "Bengaluru", skills: ["Go", "Kafka", "Redis"], exp: 4, notice: 30, ctc: 24, source: "portal", stage: "screening", rating: 4, opening: "op-3", appliedOn: "2026-05-11" },
  { name: "Sandeep Rao", role: "Procurement Officer", company: "ITC", loc: "Mumbai", skills: ["Vendor Mgmt", "RFQ", "SAP MM"], exp: 6, notice: 45, ctc: 13, source: "agency", stage: "shortlisted", rating: 4, opening: "op-4", appliedOn: "2026-06-03" },
  { name: "Farah Khan", role: "Buyer", company: "Reliance Retail", loc: "Mumbai", skills: ["Sourcing", "Negotiation", "Inventory"], exp: 4, notice: 30, ctc: 10, source: "referral", stage: "new", rating: 3, opening: "op-4", appliedOn: "2026-06-04" },
  { name: "Ananya Krishnan", role: "Product Design Intern", company: "NID Graduate", loc: "Singapore", skills: ["Figma", "UX Research", "Prototyping"], exp: 0, notice: 0, ctc: 4, source: "portal", stage: "interview", rating: 4, opening: "op-5", appliedOn: "2026-06-01" },
  // ---- general talent pool (no current opening) ----
  { name: "Karthik Iyer", role: "Full-stack Engineer", company: "Freshworks", loc: "Chennai", skills: ["React", "Node.js", "TypeScript", "GraphQL"], exp: 6, notice: 60, ctc: 30, source: "linkedin", stage: "new", rating: 5, opening: null, appliedOn: "2026-04-30" },
  { name: "Divya Pillai", role: "HR Business Partner", company: "Accenture", loc: "Bengaluru", skills: ["Talent Mgmt", "POSH", "HRBP"], exp: 8, notice: 60, ctc: 18, source: "referral", stage: "new", rating: 4, opening: null, appliedOn: "2026-05-02" },
  { name: "Mohit Saxena", role: "Data Analyst", company: "Flipkart", loc: "Bengaluru", skills: ["SQL", "Python", "Tableau"], exp: 3, notice: 30, ctc: 12, source: "portal", stage: "screening", rating: 3, opening: null, appliedOn: "2026-05-14" },
  { name: "Sneha Joshi", role: "Marketing Lead", company: "Zomato", loc: "Mumbai", skills: ["Brand", "Performance Mktg", "SEO"], exp: 7, notice: 45, ctc: 19, source: "agency", stage: "new", rating: 4, opening: null, appliedOn: "2026-05-19" },
  { name: "Arjun Nair", role: "DevOps Engineer", company: "PhonePe", loc: "Bengaluru", skills: ["Kubernetes", "Terraform", "CI/CD"], exp: 5, notice: 90, ctc: 26, source: "linkedin", stage: "archived", rating: 3, opening: null, appliedOn: "2026-04-22" },
];

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
