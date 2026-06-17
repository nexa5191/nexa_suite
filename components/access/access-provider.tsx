"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { MODULES, GATEABLE_KEYS, moduleIdForKey, isAlwaysOn } from "@/lib/modules";
import {
  DEFAULT_ROLES,
  DEFAULT_MEMBERS,
  DEFAULT_CURRENT_USER_ID,
  roleById,
  roleAllowsModule,
  adjacentRole,
  type Role,
  type Member,
} from "@/lib/access";

interface AccessState {
  /** Tenant-disabled function keys (provisioning). Empty = everything on. */
  disabled: string[];
  roles: Role[];
  members: Member[];
  /** The user currently being acted as (may be a mimic target). */
  currentUserId: string;
  /** The real user stashed while mimicking, or null when not mimicking. */
  mimicOriginalId: string | null;
}

interface AccessContextValue extends AccessState {
  hydrated: boolean;
  currentUser: Member | undefined;
  currentRole: Role | undefined;
  isMimicking: boolean;
  mimicOriginal: Member | undefined;

  /** Has the org provisioned this function at all (ignores role)? */
  tenantEnabled: (key: string) => boolean;
  /** Effective access for the acting user: provisioned AND role-allowed. */
  can: (key: string) => boolean;
  /** May the acting user edit access / start mimic sessions? */
  canManage: boolean;

  // Provisioning (per-function + per-module)
  setFeature: (key: string, on: boolean) => void;
  setModuleEnabled: (moduleId: string, on: boolean) => void;
  moduleEnabledCount: (moduleId: string) => { on: number; total: number };

  // Roles
  setRoleModule: (roleId: string, moduleId: string, on: boolean) => void;

  // Members (assign / elevate / de-elevate)
  setMemberRole: (memberId: string, roleId: string) => void;
  elevateMember: (memberId: string) => void;
  deElevateMember: (memberId: string) => void;

  // Mimic (view-as)
  startMimic: (memberId: string) => void;
  exitMimic: () => void;

  resetAll: () => void;
}

const DEFAULTS: AccessState = {
  // Professional Services starts OFF — enabling "timesheets" flips Invoicing to
  // the time-based (Touchstone) format, so a product business sees neither until
  // it opts into the sector on the setup page.
  disabled: ["projects", "timesheets"],
  roles: DEFAULT_ROLES,
  members: DEFAULT_MEMBERS,
  currentUserId: DEFAULT_CURRENT_USER_ID,
  mimicOriginalId: null,
};

const KEY = "nexa-access";
// Bump when DEFAULTS.disabled or the seed member roster changes so a one-time
// migration can fold the new default-off keys / new teammates into existing
// stored state.
const ACCESS_SEED_V = 3;
const Ctx = createContext<AccessContextValue | null>(null);

export function AccessProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<AccessState>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const { _v, ...parsed } = JSON.parse(raw);
        let next: AccessState = { ...DEFAULTS, ...parsed };
        // One-time migration: when the seed defaults change (e.g. a new sector
        // is added default-off), union the newly-defaulted-off keys into the
        // stored disabled set so existing tenants don't suddenly see them.
        if (_v !== ACCESS_SEED_V) {
          // Fold newly-defaulted-off keys into the stored disabled set, and add
          // any seed teammates introduced since this tenant was first stored
          // (matched by id) so the demo roster stays current.
          const storedMembers: Member[] = parsed.members ?? DEFAULT_MEMBERS;
          const haveIds = new Set(storedMembers.map((m) => m.id));
          const mergedMembers = [
            ...storedMembers,
            ...DEFAULT_MEMBERS.filter((m) => !haveIds.has(m.id)),
          ];
          next = {
            ...next,
            disabled: [...new Set([...(parsed.disabled ?? []), ...DEFAULTS.disabled])],
            members: mergedMembers,
          };
        }
        setS(next);
      }
    } catch {}
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(KEY, JSON.stringify({ ...s, _v: ACCESS_SEED_V }));
  }, [s, hydrated]);

  const value = useMemo<AccessContextValue>(() => {
    const disabledSet = new Set(s.disabled);
    const currentUser = s.members.find((m) => m.id === s.currentUserId);
    const currentRole = currentUser ? roleById(s.roles, currentUser.roleId) : undefined;
    const mimicOriginal = s.mimicOriginalId
      ? s.members.find((m) => m.id === s.mimicOriginalId)
      : undefined;

    const tenantEnabled = (key: string) => isAlwaysOn(key) || !disabledSet.has(key);

    const can = (key: string) => {
      if (isAlwaysOn(key)) return true;
      if (!tenantEnabled(key)) return false;
      return roleAllowsModule(currentRole, moduleIdForKey(key));
    };

    return {
      ...s,
      hydrated,
      currentUser,
      currentRole,
      isMimicking: s.mimicOriginalId !== null,
      mimicOriginal,
      tenantEnabled,
      can,
      canManage: !!currentRole?.canManageAccess,

      setFeature: (key, on) =>
        setS((p) => ({
          ...p,
          disabled: on ? p.disabled.filter((k) => k !== key) : [...new Set([...p.disabled, key])],
        })),

      setModuleEnabled: (moduleId, on) =>
        setS((p) => {
          const keys = MODULES.find((m) => m.id === moduleId)?.items.map((i) => i.key) ?? [];
          const set = new Set(p.disabled);
          for (const k of keys) on ? set.delete(k) : set.add(k);
          return { ...p, disabled: [...set] };
        }),

      moduleEnabledCount: (moduleId) => {
        const keys = MODULES.find((m) => m.id === moduleId)?.items.map((i) => i.key) ?? [];
        return { on: keys.filter((k) => !disabledSet.has(k)).length, total: keys.length };
      },

      setRoleModule: (roleId, moduleId, on) =>
        setS((p) => ({
          ...p,
          roles: p.roles.map((r) => {
            if (r.id !== roleId || r.modules === "*") return r;
            const set = new Set(r.modules);
            on ? set.add(moduleId) : set.delete(moduleId);
            return { ...r, modules: [...set] };
          }),
        })),

      setMemberRole: (memberId, roleId) =>
        setS((p) => ({
          ...p,
          members: p.members.map((m) => (m.id === memberId ? { ...m, roleId } : m)),
        })),

      elevateMember: (memberId) =>
        setS((p) => {
          const m = p.members.find((x) => x.id === memberId);
          const role = m && roleById(p.roles, m.roleId);
          const next = role && adjacentRole(p.roles, role, "up");
          if (!next) return p;
          return { ...p, members: p.members.map((x) => (x.id === memberId ? { ...x, roleId: next.id } : x)) };
        }),

      deElevateMember: (memberId) =>
        setS((p) => {
          const m = p.members.find((x) => x.id === memberId);
          const role = m && roleById(p.roles, m.roleId);
          const next = role && adjacentRole(p.roles, role, "down");
          if (!next) return p;
          return { ...p, members: p.members.map((x) => (x.id === memberId ? { ...x, roleId: next.id } : x)) };
        }),

      startMimic: (memberId) =>
        setS((p) => {
          if (memberId === p.currentUserId) return p;
          // Keep the ORIGINAL real user across chained mimics (don't overwrite).
          return { ...p, currentUserId: memberId, mimicOriginalId: p.mimicOriginalId ?? p.currentUserId };
        }),

      exitMimic: () =>
        setS((p) =>
          p.mimicOriginalId
            ? { ...p, currentUserId: p.mimicOriginalId, mimicOriginalId: null }
            : p,
        ),

      resetAll: () => setS(DEFAULTS),
    };
  }, [s, hydrated]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAccess() {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAccess must be used within AccessProvider");
  return c;
}

/** Convenience for nav surfaces: the gateable function keys the acting user sees. */
export function useVisibleKeys(): Set<string> {
  const { can } = useAccess();
  return useMemo(() => new Set(GATEABLE_KEYS.filter((k) => can(k))), [can]);
}
