// ---------------------------------------------------------------------------
// Roles & members — the RBAC layer that sits on top of provisioning.
//
// Effective access is TWO checks stacked:
//   1. Tenant-enabled  — has the org switched this function on at all? (setup
//      page · provisioning · per-function)
//   2. Role-allowed    — does the acting user's role grant the module the
//      function lives in? (per-module, editable)
//
// A function is usable only when BOTH pass. Elevate / de-elevate moves a member
// up or down the role rank ladder. "Mimic" (view-as, ported from Touchstone)
// swaps the acting user so an admin can see exactly what another user sees.
// All state is client-side (localStorage) — there is no auth backend here.
// ---------------------------------------------------------------------------

export interface Role {
  id: string;
  label: string;
  /** Higher = more powerful. Drives the elevate / de-elevate ladder. */
  rank: number;
  /** Module ids this role grants, or "*" for every module. */
  modules: "*" | string[];
  /** Can edit provisioning, roles, members and start mimic sessions. */
  canManageAccess: boolean;
  /** System roles cannot be deleted (not exposed yet, kept for clarity). */
  system?: boolean;
}

export interface Member {
  id: string;
  name: string;
  email: string;
  roleId: string;
}

export const DEFAULT_ROLES: Role[] = [
  { id: "owner", label: "Owner", rank: 100, modules: "*", canManageAccess: true, system: true },
  { id: "admin", label: "Admin", rank: 80, modules: "*", canManageAccess: true },
  {
    id: "manager",
    label: "Manager",
    rank: 60,
    modules: [
      "overview", "accounting", "tax-compliance", "group-treasury",
      "sales-revenue", "planning-analysis", "reports", "people-hr", "workspace",
    ],
    canManageAccess: false,
  },
  {
    id: "member",
    label: "Member",
    rank: 40,
    modules: ["overview", "sales-revenue", "workspace", "reports"],
    canManageAccess: false,
  },
  {
    id: "viewer",
    label: "Viewer",
    rank: 20,
    modules: ["overview", "reports"],
    canManageAccess: false,
  },
];

// The signed-in account (matches the session user) is the Owner. The rest are
// sample teammates so the roles / mimic flows are concrete out of the box.
export const DEFAULT_MEMBERS: Member[] = [
  { id: "u-owner", name: "You", email: "500xlabs@gmail.com", roleId: "owner" },
  { id: "u-asha", name: "Asha Menon", email: "asha@nexa.app", roleId: "admin" },
  { id: "u-ravi", name: "Ravi Kapoor", email: "ravi@nexa.app", roleId: "manager" },
  { id: "u-neha", name: "Neha Shah", email: "neha@nexa.app", roleId: "member" },
  { id: "u-dev", name: "Dev Patel", email: "dev@nexa.app", roleId: "viewer" },
  { id: "u-sara", name: "Sara Khan", email: "sara@nexa.app", roleId: "admin" },
  { id: "u-meera", name: "Meera Pillai", email: "meera@nexa.app", roleId: "manager" },
  { id: "u-tom", name: "Thomas George", email: "thomas@nexa.app", roleId: "manager" },
  { id: "u-arjun", name: "Arjun Rao", email: "arjun@nexa.app", roleId: "member" },
  { id: "u-vikram", name: "Vikram Shah", email: "vikram@nexa.app", roleId: "member" },
  { id: "u-leela", name: "Leela Nair", email: "leela@nexa.app", roleId: "viewer" },
  { id: "u-imran", name: "Imran Sheikh", email: "imran@nexa.app", roleId: "viewer" },
];

export const DEFAULT_CURRENT_USER_ID = "u-owner";

export function roleById(roles: Role[], id: string): Role | undefined {
  return roles.find((r) => r.id === id);
}

export function roleAllowsModule(role: Role | undefined, moduleId: string | null): boolean {
  if (!role) return false;
  if (role.modules === "*") return true;
  if (!moduleId) return true; // pages outside any module aren't role-gated
  return role.modules.includes(moduleId);
}

/** The next role up (elevate) or down (de-elevate) the rank ladder, or null. */
export function adjacentRole(roles: Role[], current: Role, dir: "up" | "down"): Role | null {
  const sorted = [...roles].sort((a, b) => a.rank - b.rank);
  const idx = sorted.findIndex((r) => r.id === current.id);
  if (idx === -1) return null;
  const next = dir === "up" ? sorted[idx + 1] : sorted[idx - 1];
  return next ?? null;
}
