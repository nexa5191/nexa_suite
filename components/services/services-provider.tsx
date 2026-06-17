"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  type Project, type ProjectAssignment,
  loadProjects, saveProjects, loadAssignments, saveAssignments,
  SEED_PROJECTS, SEED_ASSIGNMENTS,
} from "@/lib/services/projects";
import {
  type TimesheetEntry, type TimesheetStatus,
  loadTimesheets, saveTimesheets, wipByProject, SEED_TIMESHEETS,
} from "@/lib/services/timesheets";
import {
  type ConflictCheck, type ConflictClearance, type ConflictItem, type ConflictType,
  loadChecks, saveChecks, loadItems, saveItems, loadClearances, saveClearances,
  deriveCheckStatus, checkForProject, clearancesForCheck, itemsForCheck, screenConflicts,
} from "@/lib/services/conflicts";
import {
  type ServicesInvoice, loadTimeInvoices, saveTimeInvoices, draftFromWip,
} from "@/lib/services/time-invoice";

// Partner-rank reviewers who must clear a conflict check (leadership).
export const REVIEWER_IDS = ["emp-001", "emp-002", "emp-003"];

interface ServicesState {
  projects: Project[];
  assignments: ProjectAssignment[];
  timesheets: TimesheetEntry[];
  checks: ConflictCheck[];
  items: ConflictItem[];
  clearances: ConflictClearance[];
  invoices: ServicesInvoice[];
}

interface ServicesContextValue extends ServicesState {
  hydrated: boolean;
  wip: ReturnType<typeof wipByProject>;

  // Timesheets
  logTime: (e: Omit<TimesheetEntry, "id" | "status">) => void;
  setEntryStatus: (id: string, status: TimesheetStatus, byId?: string) => void;

  // Rate cards
  addAssignment: (a: Omit<ProjectAssignment, "id">) => void;
  updateAssignment: (id: string, patch: Partial<ProjectAssignment>) => void;

  // Conflict checks
  screenFor: (projectId: string) => ReturnType<typeof screenConflicts>;
  createCheck: (projectId: string, byId: string) => void;
  recordClearance: (
    checkId: string,
    reviewerId: string,
    decision: "cleared" | "raised",
    raised?: { type: ConflictType; description: string },
  ) => void;
  resolveItem: (itemId: string, byId: string, notes: string, waive?: boolean) => void;

  // Invoicing
  generateInvoice: (projectId: string, today: string) => string | null;
  finalizeInvoice: (id: string) => void;
  deleteDraftInvoice: (id: string) => void;

  resetServices: () => void;
}

const Ctx = createContext<ServicesContextValue | null>(null);

const today = () => new Date().toISOString().slice(0, 10);
const uid = (prefix: string, n: number) => `${prefix}-${String(n).padStart(3, "0")}-${n}`;

export function ServicesProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<ServicesState>({
    projects: [], assignments: [], timesheets: [], checks: [], items: [], clearances: [], invoices: [],
  });
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setS({
      projects: loadProjects(),
      assignments: loadAssignments(),
      timesheets: loadTimesheets(),
      checks: loadChecks(),
      items: loadItems(),
      clearances: loadClearances(),
      invoices: loadTimeInvoices(),
    });
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveProjects(s.projects);
    saveAssignments(s.assignments);
    saveTimesheets(s.timesheets);
    saveChecks(s.checks);
    saveItems(s.items);
    saveClearances(s.clearances);
    saveTimeInvoices(s.invoices);
  }, [s, hydrated]);

  const value = useMemo<ServicesContextValue>(() => {
    const wip = wipByProject(s.timesheets, s.projects, s.assignments);

    // Recompute an engagement's gate from its check's clearances + items.
    const recompute = (st: ServicesState, projectId: string): ServicesState => {
      const check = checkForProject(st.checks, projectId);
      if (!check) return st;
      const cl = clearancesForCheck(st.clearances, check.id);
      const it = itemsForCheck(st.items, check.id);
      const status = deriveCheckStatus(cl, it);
      return {
        ...st,
        checks: st.checks.map((c) => (c.id === check.id ? { ...c, status, clearedAt: status === "cleared" ? today() : c.clearedAt } : c)),
        projects: st.projects.map((p) => (p.id === projectId ? { ...p, conflictStatus: status } : p)),
      };
    };

    return {
      ...s,
      hydrated,
      wip,

      logTime: (e) =>
        setS((p) => ({
          ...p,
          timesheets: [...p.timesheets, { ...e, id: uid("ts", p.timesheets.length + 1), status: "submitted" }],
        })),

      setEntryStatus: (id, status, byId) =>
        setS((p) => ({
          ...p,
          timesheets: p.timesheets.map((t) =>
            t.id === id
              ? { ...t, status, ...(status === "approved" ? { approvedById: byId, approvedOn: today() } : {}) }
              : t,
          ),
        })),

      addAssignment: (a) =>
        setS((p) => ({ ...p, assignments: [...p.assignments, { ...a, id: uid("asg", p.assignments.length + 1) }] })),

      updateAssignment: (id, patch) =>
        setS((p) => ({ ...p, assignments: p.assignments.map((a) => (a.id === id ? { ...a, ...patch } : a)) })),

      screenFor: (projectId) => {
        const project = s.projects.find((p) => p.id === projectId);
        return project ? screenConflicts(project, s.projects) : [];
      },

      createCheck: (projectId, byId) =>
        setS((p) => {
          const project = p.projects.find((x) => x.id === projectId);
          if (!project || checkForProject(p.checks, projectId)) return p;
          const checkId = uid("cck", p.checks.length + 1);
          const check: ConflictCheck = {
            id: checkId, projectId, accountId: project.accountId, matterTitle: project.name,
            opposingParties: project.opposingParties, status: "open", raisedById: byId, createdAt: today(),
          };
          const clearances: ConflictClearance[] = REVIEWER_IDS.map((r, i) => ({
            id: `${checkId}-cl-${i}`, checkId, reviewerId: r, decision: "pending",
          }));
          const next = { ...p, checks: [...p.checks, check], clearances: [...p.clearances, ...clearances] };
          return recompute(next, projectId);
        }),

      recordClearance: (checkId, reviewerId, decision, raised) =>
        setS((p) => {
          const check = p.checks.find((c) => c.id === checkId);
          if (!check) return p;
          let next: ServicesState = {
            ...p,
            clearances: p.clearances.map((c) =>
              c.checkId === checkId && c.reviewerId === reviewerId
                ? { ...c, decision, decidedAt: today() }
                : c,
            ),
          };
          if (decision === "raised" && raised) {
            const item: ConflictItem = {
              id: uid("cfi", p.items.length + 1), checkId, raisedById: reviewerId,
              type: raised.type, description: raised.description, status: "pending", raisedAt: today(),
            };
            next = { ...next, items: [...next.items, item] };
          }
          return recompute(next, check.projectId);
        }),

      resolveItem: (itemId, byId, notes, waive) =>
        setS((p) => {
          const item = p.items.find((i) => i.id === itemId);
          if (!item) return p;
          const check = p.checks.find((c) => c.id === item.checkId);
          const next: ServicesState = {
            ...p,
            items: p.items.map((i) =>
              i.id === itemId
                ? { ...i, status: waive ? "waived" : "resolved", resolvedById: byId, resolutionNotes: notes, resolvedAt: today() }
                : i,
            ),
          };
          return check ? recompute(next, check.projectId) : next;
        }),

      generateInvoice: (projectId, day) => {
        const group = wip.find((g) => g.projectId === projectId);
        if (!group) return null;
        const inv = draftFromWip(group, s.invoices, day);
        const billedIds = new Set(group.lines.flatMap((l) => l.entryIds));
        setS((p) => ({
          ...p,
          invoices: [...p.invoices, inv],
          timesheets: p.timesheets.map((t) => (billedIds.has(t.id) ? { ...t, invoiceId: inv.id } : t)),
        }));
        return inv.id;
      },

      finalizeInvoice: (id) =>
        setS((p) => ({
          ...p,
          invoices: p.invoices.map((i) => (i.id === id ? { ...i, status: "finalized" } : i)),
          timesheets: p.timesheets.map((t) => (t.invoiceId === id ? { ...t, status: "billed" } : t)),
        })),

      deleteDraftInvoice: (id) =>
        setS((p) => ({
          ...p,
          invoices: p.invoices.filter((i) => i.id !== id),
          timesheets: p.timesheets.map((t) => (t.invoiceId === id ? { ...t, invoiceId: undefined, status: "approved" } : t)),
        })),

      resetServices: () =>
        setS({
          projects: SEED_PROJECTS, assignments: SEED_ASSIGNMENTS, timesheets: SEED_TIMESHEETS,
          checks: [], items: [], clearances: [], invoices: [],
        }),
    };
  }, [s, hydrated]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useServices() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useServices must be used within ServicesProvider");
  return c;
}
