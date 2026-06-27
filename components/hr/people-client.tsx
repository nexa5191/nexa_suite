"use client";

import * as React from "react";
import Link from "next/link";
import { Search, Users, Mail, Briefcase, MapPin, CalendarDays, UserCircle2, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/modal";
import { cn, formatDate } from "@/lib/utils";
import {
  EMPLOYEES,
  DEPARTMENTS,
  departmentName,
  employeeName,
  employeeEntityName,
  employeeLocationName,
} from "@/lib/hr/employees";
import type { Employee } from "@/lib/hr/types";
import { ENTITIES, LOCATIONS, ALL } from "@/lib/accounting/org";
import { EntityCombobox } from "@/components/ui/entity-combobox";

const TYPE_LABEL: Record<string, string> = {
  "full-time": "Full-time",
  "part-time": "Part-time",
  contract: "Contract",
};

export function PeopleClient() {
  const [q, setQ] = React.useState("");
  const [dept, setDept] = React.useState(ALL);
  const [entity, setEntity] = React.useState(ALL);
  const [location, setLocation] = React.useState(ALL);
  const [selected, setSelected] = React.useState<Employee | null>(null);

  const term = q.trim().toLowerCase();
  const rows = EMPLOYEES.filter((e) => {
    if (dept !== ALL && e.departmentId !== dept) return false;
    if (entity !== ALL && e.entityId !== entity) return false;
    if (location !== ALL && e.locationId !== location) return false;
    if (
      term &&
      !`${e.name} ${e.code} ${e.email} ${e.designation}`.toLowerCase().includes(term)
    )
      return false;
    return true;
  });

  const locs = entity === ALL ? LOCATIONS : LOCATIONS.filter((l) => l.entityId === entity);

  return (
    <>
      <PageHeader
        title="People"
        subtitle="Employee directory across all entities and locations."
        actions={
          <Badge variant="primary" className="h-7 px-3">
            <Users className="size-3.5" /> {EMPLOYEES.length} employees
          </Badge>
        }
      />

      <Card className="mb-4 p-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Search name, code, role…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Select value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value={ALL}>All departments</option>
            {DEPARTMENTS.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </Select>
          <EntityCombobox
            value={entity}
            onChange={(id) => { setEntity(id); setLocation(ALL); }}
            showAll
          />
          <Select value={location} onChange={(e) => setLocation(e.target.value)}>
            <option value={ALL}>All locations</option>
            {locs.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <p className="text-sm font-medium">Directory</p>
          <span className="text-xs text-muted-foreground">{rows.length} shown</span>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-5 py-3 font-medium">Employee</th>
                <th className="px-5 py-3 font-medium">Designation</th>
                <th className="px-5 py-3 font-medium">Department</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium">Manager</th>
                <th className="px-5 py-3 font-medium">Joined</th>
                <th className="px-5 py-3 font-medium">Type</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No employees match these filters
                  </td>
                </tr>
              )}
              {rows.map((e) => (
                <tr
                  key={e.id}
                  onClick={() => setSelected(e)}
                  className="cursor-pointer border-b transition-colors last:border-0 hover:bg-accent/50"
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={e.name} />
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 font-medium">
                          {e.name}
                          {e.status === "on-leave" && (
                            <Badge variant="warning" className="px-1.5 py-0 text-[10px]">On leave</Badge>
                          )}
                          {e.status === "exited" && (
                            <Badge variant="danger" className="px-1.5 py-0 text-[10px]">Exited</Badge>
                          )}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">{e.code} · {e.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3">{e.designation}</td>
                  <td className="px-5 py-3">{departmentName(e.departmentId)}</td>
                  <td className="px-5 py-3">
                    <span>{employeeLocationName(e)}</span>
                    <span className="block text-xs text-muted-foreground">{employeeEntityName(e)}</span>
                  </td>
                  <td className="px-5 py-3 text-muted-foreground">{employeeName(e.managerId)}</td>
                  <td className="px-5 py-3 text-muted-foreground">{formatDate(e.joinDate)}</td>
                  <td className="px-5 py-3">
                    <Badge variant={e.employmentType === "full-time" ? "default" : "outline"}>
                      {TYPE_LABEL[e.employmentType]}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Drawer
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected?.name}
        subtitle={selected ? `${selected.code} · ${selected.designation}` : undefined}
      >
        {selected && (
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                {selected.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </span>
              <div>
                <p className="font-semibold">{selected.name}</p>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  <Badge variant="primary">{departmentName(selected.departmentId)}</Badge>
                  <Badge variant={selected.status === "active" ? "success" : selected.status === "on-leave" ? "warning" : "danger"}>
                    {selected.status}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <Field icon={Briefcase} label="Designation">{selected.designation}</Field>
              <Field icon={Mail} label="Work email">{selected.email}</Field>
              <Field icon={MapPin} label="Location">
                {employeeLocationName(selected)} · {employeeEntityName(selected)}
              </Field>
              <Field icon={UserCircle2} label="Reports to">{employeeName(selected.managerId) || "—"}</Field>
              <Field icon={CalendarDays} label="Joined">{formatDate(selected.joinDate)}</Field>
              <Field icon={Briefcase} label="Employment">{TYPE_LABEL[selected.employmentType]}</Field>
              {selected.exitDate && (
                <Field icon={CalendarDays} label="Exited">{formatDate(selected.exitDate)}</Field>
              )}
            </div>

            <div className="flex flex-wrap gap-2 border-t pt-4">
              <Link href="/leave" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent">
                Leave <ArrowUpRight className="size-3.5" />
              </Link>
              <Link href="/hr/attendance" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent">
                Attendance <ArrowUpRight className="size-3.5" />
              </Link>
              <Link href="/hr/payroll" className="inline-flex items-center gap-1.5 rounded-md border bg-card px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent">
                Payroll <ArrowUpRight className="size-3.5" />
              </Link>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

function Field({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium">{children}</p>
      </div>
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("");
  return (
    <span
      className={cn(
        "flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary",
      )}
    >
      {initials}
    </span>
  );
}
