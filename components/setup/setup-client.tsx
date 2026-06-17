"use client";

import { useState } from "react";
import {
  Boxes, ShieldCheck, Users, Eye, ChevronUp, ChevronDown, Check, Lock, Info,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MODULES } from "@/lib/modules";
import { useAccess } from "@/components/access/access-provider";

type Tab = "modules" | "roles" | "users";

export function SetupClient() {
  const access = useAccess();
  const { canManage } = access;
  const [tab, setTab] = useState<Tab>("modules");

  const TABS: { id: Tab; label: string; icon: typeof Boxes }[] = [
    { id: "modules", label: "Modules & Functions", icon: Boxes },
    { id: "roles", label: "Roles", icon: ShieldCheck },
    { id: "users", label: "Users & Mimic", icon: Users },
  ];

  return (
    <>
      <PageHeader
        title="Access & Setup"
        subtitle="Provision the functions your team needs, control them by role, and view the app as any user."
        actions={
          <Badge variant={canManage ? "primary" : "default"}>
            Acting as {access.currentUser?.name} · {access.currentRole?.label}
          </Badge>
        }
      />

      {!canManage && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-amber-600" />
          <p className="text-muted-foreground">
            You’re viewing as a role that can’t manage access. Controls are read-only. Exit mimic mode
            (or switch back to an Owner/Admin) to make changes.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="mb-4 flex gap-1 border-b">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "flex items-center gap-2 border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            <t.icon className="size-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "modules" && <ModulesTab />}
      {tab === "roles" && <RolesTab />}
      {tab === "users" && <UsersTab />}
    </>
  );
}

/** A small accessible on/off switch. */
function Toggle({
  checked, onChange, disabled, label,
}: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors",
        checked ? "bg-primary" : "bg-input",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
      )}
    >
      <span
        className={cn(
          "inline-block size-4 transform rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-[18px]" : "translate-x-0.5",
        )}
      />
    </button>
  );
}

// --------------------------------------------------------------------------
// 1. Provisioning — which functions the org has switched on (per-function)
// --------------------------------------------------------------------------
function ModulesTab() {
  const { tenantEnabled, setFeature, setModuleEnabled, moduleEnabledCount, canManage } = useAccess();

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {MODULES.map((m) => {
        const { on, total } = moduleEnabledCount(m.id);
        const allOn = on === total;
        return (
          <Card key={m.id}>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <div>
                <CardTitle>{m.label}</CardTitle>
                <CardDescription>{on}/{total} functions enabled</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{allOn ? "All on" : "Enable all"}</span>
                <Toggle
                  checked={allOn}
                  disabled={!canManage}
                  onChange={(v) => setModuleEnabled(m.id, v)}
                  label={`Enable all ${m.label}`}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-1 border-t pt-3">
              {m.items.map((i) => {
                const enabled = tenantEnabled(i.key);
                return (
                  <div key={i.key} className="flex items-center justify-between rounded-md px-1 py-1.5">
                    <span className="flex items-center gap-2 text-sm">
                      <i.icon className="size-4 text-muted-foreground" />
                      {i.label}
                    </span>
                    <Toggle
                      checked={enabled}
                      disabled={!canManage}
                      onChange={(v) => setFeature(i.key, v)}
                      label={i.label}
                    />
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// --------------------------------------------------------------------------
// 2. Roles — which modules each role grants (per-module)
// --------------------------------------------------------------------------
function RolesTab() {
  const { roles, setRoleModule, canManage } = useAccess();

  return (
    <Card>
      <CardHeader>
        <CardTitle>Role access</CardTitle>
        <CardDescription>
          A function is usable only when it’s enabled above <em>and</em> the user’s role grants its module.
          Owner &amp; Admin always have every module.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="py-2 pr-4 font-medium">Module</th>
              {roles.map((r) => (
                <th key={r.id} className="px-3 py-2 text-center font-medium">
                  <span className="flex items-center justify-center gap-1">
                    {r.label}
                    {r.canManageAccess && <ShieldCheck className="size-3 text-primary" />}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {MODULES.map((m) => (
              <tr key={m.id} className="border-b last:border-0">
                <td className="py-2 pr-4">{m.label}</td>
                {roles.map((r) => {
                  const all = r.modules === "*";
                  const granted = all || r.modules.includes(m.id);
                  return (
                    <td key={r.id} className="px-3 py-2 text-center">
                      <div className="flex justify-center">
                        {all ? (
                          <span title="Always granted" className="text-primary"><Check className="size-4" /></span>
                        ) : (
                          <Toggle
                            checked={granted}
                            disabled={!canManage}
                            onChange={(v) => setRoleModule(r.id, m.id, v)}
                            label={`${r.label} · ${m.label}`}
                          />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// --------------------------------------------------------------------------
// 3. Users & Mimic — assign roles, elevate/de-elevate, view-as
// --------------------------------------------------------------------------
function UsersTab() {
  const {
    members, roles, currentUserId, mimicOriginal,
    setMemberRole, elevateMember, deElevateMember, startMimic, canManage,
  } = useAccess();

  const sortedRoles = [...roles].sort((a, b) => b.rank - a.rank);
  const maxRank = Math.max(...roles.map((r) => r.rank));
  const minRank = Math.min(...roles.map((r) => r.rank));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Users className="size-4" /> Team members</CardTitle>
        <CardDescription>
          Assign roles, elevate or de-elevate, and use “View as” to see the app exactly as another user.
        </CardDescription>
      </CardHeader>
      <CardContent className="divide-y">
        {members.map((m) => {
          const role = roles.find((r) => r.id === m.roleId);
          const isActing = m.id === currentUserId;
          const isOriginal = mimicOriginal?.id === m.id;
          return (
            <div key={m.id} className="flex flex-wrap items-center gap-3 py-3">
              <div className="grid size-9 shrink-0 place-items-center rounded-full bg-muted text-xs font-semibold uppercase">
                {m.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-sm font-medium">
                  {m.name}
                  {isActing && <Badge variant="primary">Acting</Badge>}
                  {isOriginal && <Badge variant="outline">You</Badge>}
                </p>
                <p className="truncate text-xs text-muted-foreground">{m.email}</p>
              </div>

              {/* Elevate / de-elevate */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost" size="icon"
                  className="size-7"
                  title="De-elevate"
                  disabled={!canManage || (role?.rank ?? 0) <= minRank}
                  onClick={() => deElevateMember(m.id)}
                >
                  <ChevronDown className="size-4" />
                </Button>
                <select
                  value={m.roleId}
                  disabled={!canManage}
                  onChange={(e) => setMemberRole(m.id, e.target.value)}
                  className="h-8 rounded-md border border-input bg-card px-2 text-sm disabled:opacity-50"
                >
                  {sortedRoles.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
                <Button
                  variant="ghost" size="icon"
                  className="size-7"
                  title="Elevate"
                  disabled={!canManage || (role?.rank ?? 0) >= maxRank}
                  onClick={() => elevateMember(m.id)}
                >
                  <ChevronUp className="size-4" />
                </Button>
              </div>

              {/* Mimic / view-as */}
              <Button
                variant="outline" size="sm"
                disabled={!canManage || isActing}
                onClick={() => startMimic(m.id)}
                title={isActing ? "You are this user" : `View the app as ${m.name}`}
              >
                {canManage ? <Eye className="size-3.5" /> : <Lock className="size-3.5" />}
                View as
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
