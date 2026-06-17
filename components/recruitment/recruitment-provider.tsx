"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { CANDIDATES, type Candidate, type CandidateStage } from "@/lib/recruitment";

export interface SubmitPayload {
  name: string;
  email: string;
  phone: string;
  desiredRole: string;
  currentCompany: string;
  location: string;
  skills: string[];
  experienceYears: number;
  noticePeriodDays: number;
  expectedCtcLakh: number;
  openingId: string | null;
  agencyId: string;
}

interface RecruitmentContext {
  candidates: Candidate[]; // seed + agency submissions, with stage overrides applied
  version: number;
  submit: (p: SubmitPayload) => Candidate;
  setStage: (id: string, stage: CandidateStage) => void;
}

const SUB_KEY = "nexa-agency-submissions";
const STAGE_KEY = "nexa-candidate-stages";
const Ctx = createContext<RecruitmentContext | null>(null);

function load<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function save(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

export function RecruitmentProvider({ children }: { children: React.ReactNode }) {
  const [submissions, setSubmissions] = useState<Candidate[]>([]);
  const [stages, setStages] = useState<Record<string, CandidateStage>>({});
  const [version, setVersion] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setSubmissions(load<Candidate[]>(SUB_KEY, []));
    setStages(load<Record<string, CandidateStage>>(STAGE_KEY, {}));
    setHydrated(true);
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    save(SUB_KEY, submissions);
    save(STAGE_KEY, stages);
    setVersion((v) => v + 1);
  }, [submissions, stages, hydrated]);

  const submit = useCallback<RecruitmentContext["submit"]>((p) => {
    const now = new Date();
    const cand: Candidate = {
      id: `sub-${now.getTime()}`,
      name: p.name,
      email: p.email,
      phone: p.phone,
      desiredRole: p.desiredRole,
      currentCompany: p.currentCompany,
      location: p.location,
      skills: p.skills,
      experienceYears: p.experienceYears,
      noticePeriodDays: p.noticePeriodDays,
      expectedCtcLakh: p.expectedCtcLakh,
      source: "agency",
      stage: "new",
      rating: 3,
      openingId: p.openingId,
      appliedOn: now.toISOString().slice(0, 10),
      resumeFile: `${p.name.replace(/\s+/g, "_")}_CV.pdf`,
      agencyId: p.agencyId,
    };
    setSubmissions((prev) => [cand, ...prev]);
    return cand;
  }, []);

  const setStage = useCallback((id: string, stage: CandidateStage) => {
    setStages((prev) => ({ ...prev, [id]: stage }));
  }, []);

  const candidates = useMemo(() => {
    const merged = [...submissions, ...CANDIDATES];
    return merged.map((c) => (stages[c.id] ? { ...c, stage: stages[c.id] } : c));
  }, [submissions, stages]);

  const value = useMemo<RecruitmentContext>(
    () => ({ candidates, version, submit, setStage }),
    [candidates, version, submit, setStage],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useRecruitment(): RecruitmentContext {
  const c = useContext(Ctx);
  if (!c) throw new Error("useRecruitment must be used within RecruitmentProvider");
  return c;
}
