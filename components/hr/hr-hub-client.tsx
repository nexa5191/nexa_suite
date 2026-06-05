"use client";

import * as React from "react";
import Link from "next/link";
import { Users, Clock, CalendarDays, Banknote, Palmtree, ClipboardCheck, ArrowRight, UserRound } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { ACTIVE_EMPLOYEES, EMPLOYEES } from "@/lib/hr/employees";
import { todayBoard } from "@/lib/hr/attendance";
import { pendingLeaveRequests } from "@/lib/hr/leave";
import { runTotals } from "@/lib/hr/payroll";
import { upcomingHolidays } from "@/lib/hr/holidays";
import { TODAY } from "@/lib/calendar";
import { formatDate } from "@/lib/utils";

const TILES = [
  { href: "/people", label: "Directory", desc: "All employees", icon: Users },
  { href: "/hr/attendance", label: "Attendance", desc: "Daily monitoring", icon: Clock },
  { href: "/leave", label: "Leave", desc: "Balances & requests", icon: CalendarDays },
  { href: "/hr/payroll", label: "Payroll", desc: "Runs & payslips", icon: Banknote },
  { href: "/hr/holidays", label: "Holidays", desc: "All locations", icon: Palmtree },
  { href: "/approvals", label: "Approvals", desc: "Sign-off queue", icon: ClipboardCheck },
  { href: "/portal", label: "Employee Portal", desc: "Self-service", icon: UserRound },
];

export function HrHubClient() {
  const board = React.useMemo(() => todayBoard(), []);
  const totals = React.useMemo(() => runTotals("2026-06"), []);
  const pendingLeaves = pendingLeaveRequests().length;
  const next = upcomingHolidays(TODAY, 1)[0];

  return (
    <>
      <PageHeader title="Human Resources" subtitle="People operations — attendance, leave, payroll and more." />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Headcount" value={String(ACTIVE_EMPLOYEES.length)} sub={`${EMPLOYEES.length - ACTIVE_EMPLOYEES.length} exited`} />
        <Stat label="Present today" value={String(board.counts.present + board.counts.wfh)} sub={`${board.counts.leave} on leave`} />
        <Stat label="Pending leave" value={String(pendingLeaves)} sub="awaiting approval" />
        <Stat label="June net payroll" valueNode={<Money value={totals.net} compact />} sub={`${totals.headcount} employees`} />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {TILES.map((t) => (
          <Link key={t.href} href={t.href}>
            <Card className="group flex items-center gap-3 p-4 transition-colors hover:border-primary/40 hover:bg-accent/40">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <t.icon className="size-5" />
              </span>
              <div className="flex-1">
                <p className="font-semibold">{t.label}</p>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </div>
              <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Card>
          </Link>
        ))}
      </div>

      {next && (
        <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <Palmtree className="size-4" /> Next holiday: <span className="font-medium text-foreground">{next.name}</span> on {formatDate(next.date)}
        </p>
      )}
    </>
  );
}

function Stat({ label, value, valueNode, sub }: { label: string; value?: string; valueNode?: React.ReactNode; sub?: string }) {
  return (
    <Card>
      <CardContent className={cn("pt-5")}>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular">{valueNode ?? value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}
