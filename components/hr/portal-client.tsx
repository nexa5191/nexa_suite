"use client";

import * as React from "react";
import {
  UserCircle2, Mail, MapPin, CalendarDays, FileText, Image as ImageIcon, Download,
  Briefcase, Award, ArrowRightLeft, LogOut, Sparkles, Wallet,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Select } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import { EMPLOYEES, employeeById, employeeName, departmentName } from "@/lib/hr/employees";
import { locationById, entityById } from "@/lib/accounting/org";
import { DEFAULT_LEAVE_TYPES, balancesFor, leaveTypeById } from "@/lib/hr/leave";
import { salaryStructure, payslipsForEmployee } from "@/lib/hr/payroll";
import { journeyFor, documentsFor, type JourneyType, type DocCategory } from "@/lib/hr/journey";

const JOURNEY_ICON: Record<JourneyType, React.ComponentType<{ className?: string }>> = {
  joined: Sparkles,
  promotion: Award,
  transfer: ArrowRightLeft,
  award: Award,
  exit: LogOut,
};
const CAT_TONE: Record<DocCategory, "default" | "primary" | "success" | "warning" | "danger"> = {
  Onboarding: "primary",
  Payroll: "success",
  Tax: "warning",
  Personal: "default",
  Exit: "danger",
};

export function PortalClient() {
  const [empId, setEmpId] = React.useState("emp-006");
  const emp = employeeById(empId)!;
  const exited = emp.status === "exited";
  const balances = balancesFor(empId, DEFAULT_LEAVE_TYPES);
  const salary = salaryStructure(empId);
  const payslips = payslipsForEmployee(empId);
  const journey = journeyFor(empId);
  const docs = documentsFor(empId);

  return (
    <>
      <PageHeader
        title="My Portal"
        subtitle="Self-service — your profile, journey, documents and payslips."
        actions={
          <Select value={empId} onChange={(e) => setEmpId(e.target.value)} className="h-9 w-56">
            {EMPLOYEES.map((e) => (
              <option key={e.id} value={e.id}>{e.name}{e.status === "exited" ? " (exited)" : ""}</option>
            ))}
          </Select>
        }
      />

      {exited && (
        <Card className="mb-4 flex items-start gap-3 border-danger/30 bg-danger/5 p-4">
          <LogOut className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="text-sm text-muted-foreground">
            This employee has <span className="font-medium text-foreground">exited</span> (relieved {formatDate(emp.exitDate!)}). Their work account is deactivated and
            the portal now signs in with their <span className="font-medium text-foreground">personal email</span>; alumni still retain access to payslips, Form 16 and exit documents.
          </p>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Identity */}
        <Card className="lg:col-span-1">
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <span className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-lg font-bold text-primary">
                {emp.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </span>
              <div>
                <p className="flex items-center gap-2 font-semibold">{emp.name}
                  {exited && <Badge variant="danger" className="text-[10px]">Exited</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">{emp.designation} · {emp.code}</p>
              </div>
            </div>
            <div className="mt-4 space-y-2 border-t pt-3 text-sm">
              <Row icon={Mail} label="Active login">
                {exited ? (
                  <span><span className="text-success">{emp.personalEmail}</span> <span className="text-[11px] text-muted-foreground">(personal)</span></span>
                ) : (
                  emp.email
                )}
              </Row>
              {exited && (
                <Row icon={Mail} label="Work email (inactive)">
                  <span className="text-muted-foreground line-through">{emp.email}</span>
                </Row>
              )}
              <Row icon={Briefcase} label="Department">{departmentName(emp.departmentId)}</Row>
              <Row icon={MapPin} label="Location">{locationById(emp.locationId)?.name} · {entityById(emp.entityId)?.name}</Row>
              <Row icon={UserCircle2} label="Manager">{employeeName(emp.managerId)}</Row>
              <Row icon={CalendarDays} label="Joined">{formatDate(emp.joinDate)}</Row>
            </div>
          </CardContent>
        </Card>

        {/* Leave + pay snapshot */}
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-4" /> Leave balance</CardTitle></CardHeader>
            <CardContent>
              <div className="grid gap-2 sm:grid-cols-3">
                {balances.filter((b) => leaveTypeById(DEFAULT_LEAVE_TYPES, b.leaveTypeId)!.annualDays > 0).map((b) => {
                  const t = leaveTypeById(DEFAULT_LEAVE_TYPES, b.leaveTypeId)!;
                  return (
                    <div key={b.leaveTypeId} className="rounded-lg border p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">{t.name}</span>
                        <Badge variant={t.tone} className="text-[10px]">{t.code}</Badge>
                      </div>
                      <p className="mt-1 text-xl font-bold tabular">{b.available}<span className="text-xs font-normal text-muted-foreground">/{b.allocated}</span></p>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2"><Wallet className="size-4" /> Latest pay</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex gap-6 text-sm">
                  <div><p className="text-xs text-muted-foreground">Gross / month</p><p className="font-semibold tabular"><Money value={salary.gross} /></p></div>
                  <div><p className="text-xs text-muted-foreground">Deductions</p><p className="font-semibold tabular text-danger"><Money value={salary.deductions} /></p></div>
                  <div><p className="text-xs text-muted-foreground">Net pay</p><p className="font-semibold tabular text-success"><Money value={salary.net} /></p></div>
                </div>
                <p className="text-xs text-muted-foreground">CTC <span className="font-medium text-foreground"><Money value={salary.annualCtc} compact /></span>/yr</p>
              </div>
              {payslips.length > 0 && (
                <div className="mt-3 space-y-1 border-t pt-3">
                  {payslips.slice(0, 4).map((p) => (
                    <div key={p.month} className="flex items-center justify-between rounded-md px-2 py-1.5 text-sm hover:bg-accent/50">
                      <span className="flex items-center gap-2"><FileText className="size-3.5 text-danger" /> Payslip — {p.label}</span>
                      <span className="flex items-center gap-3">
                        <span className="tabular text-muted-foreground"><Money value={p.structure.net} /></span>
                        <Download className="size-3.5 text-muted-foreground" />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {/* Journey */}
        <Card>
          <CardHeader><CardTitle>My Journey</CardTitle></CardHeader>
          <CardContent>
            <ol className="relative space-y-4 border-l pl-5">
              {journey.map((j, i) => {
                const Icon = JOURNEY_ICON[j.type];
                return (
                  <li key={i} className="relative">
                    <span className={cn(
                      "absolute -left-[27px] flex size-5 items-center justify-center rounded-full ring-4 ring-card",
                      j.type === "exit" ? "bg-danger/15 text-danger" : "bg-primary/15 text-primary",
                    )}>
                      <Icon className="size-3" />
                    </span>
                    <p className="text-sm font-medium">{j.title}</p>
                    <p className="text-xs text-muted-foreground">{j.detail}</p>
                    <p className="text-[11px] text-muted-foreground">{formatDate(j.date)}</p>
                  </li>
                );
              })}
            </ol>
          </CardContent>
        </Card>

        {/* Documents */}
        <Card>
          <CardHeader><CardTitle>My Documents</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y rounded-md border">
              {docs.map((d) => (
                <li key={d.name} className="flex items-center gap-3 px-3 py-2 text-sm hover:bg-accent/50">
                  {d.kind === "image" ? <ImageIcon className="size-4 shrink-0 text-warning" /> : <FileText className="size-4 shrink-0 text-danger" />}
                  <span className="flex-1 truncate">{d.name}</span>
                  <Badge variant={CAT_TONE[d.category]} className="text-[10px]">{d.category}</Badge>
                  <span className="hidden w-24 text-right text-xs text-muted-foreground sm:block">{formatDate(d.date)}</span>
                  <Download className="size-3.5 shrink-0 text-muted-foreground" />
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

function Row({ icon: Icon, label, children }: { icon: React.ComponentType<{ className?: string }>; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="truncate">{children}</p>
      </div>
    </div>
  );
}
