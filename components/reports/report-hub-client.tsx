"use client";

import * as React from "react";
import { ChevronDown, ChevronUp, Plus, X, SlidersHorizontal, GripVertical, FileDown } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { ENTITIES, ALL, entityById, locationById } from "@/lib/accounting/org";
import { filteredPostings } from "@/lib/accounting/ledger";
import { CHART_OF_ACCOUNTS } from "@/lib/accounting/chart-of-accounts";
import { EMPLOYEES, departmentName, employeeName, employeeById } from "@/lib/hr/employees";
import { DEFAULT_LEAVE_TYPES, LEAVE_REQUESTS, leaveTypeById, balancesFor } from "@/lib/hr/leave";

// ---------------------------------------------------------------------------
// A single flexible report builder over BOTH accounting and HR data.
// Pick a report, tune filters (they persist across report switches), toggle &
// reorder columns, then export the rendered table to PDF.
// ---------------------------------------------------------------------------

const accountName = (code: string) => CHART_OF_ACCOUNTS.find((a) => a.code === code)?.name ?? code;
const accountType = (code: string) => CHART_OF_ACCOUNTS.find((a) => a.code === code)?.type ?? "—";

// All accrual postings — the flat transaction ledger the reports read from.
const POSTINGS = filteredPostings({
  entityId: ALL, locationId: ALL, state: ALL, basis: "accrual", from: "", to: "",
});

interface Filters {
  from: string;
  to: string;
  entity: string;
  status: string;
  q: string;
  sortBy: "date" | "amount" | "name";
  sortOrder: "asc" | "desc";
}

const DEFAULT_FILTERS: Filters = {
  from: "", to: "", entity: ALL, status: "all", q: "", sortBy: "date", sortOrder: "desc",
};

type Row = Record<string, unknown>;
interface Column {
  key: string;
  label: string;
  align?: "right";
  cell: (r: Row) => React.ReactNode;
}
interface ReportDef {
  key: string;
  label: string;
  group: "Accounting" | "People";
  columns: Column[];
  build: (f: Filters) => Row[];
}

function inDateRange(iso: string, from: string, to: string) {
  const d = iso.slice(0, 10);
  if (from && d < from) return false;
  if (to && d > to) return false;
  return true;
}
function match(q: string, ...fields: (string | number | undefined)[]) {
  if (!q) return true;
  const t = q.toLowerCase();
  return fields.some((f) => String(f ?? "").toLowerCase().includes(t));
}

const STATUS_TONE: Record<string, "warning" | "success" | "danger" | "default"> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  active: "success",
  "on-leave": "warning",
};
function statusBadge(s: string) {
  return <Badge variant={STATUS_TONE[s] ?? "default"} className="capitalize">{s.replace("-", " ")}</Badge>;
}

const REPORTS: ReportDef[] = [
  // ---------------- Accounting ----------------
  {
    key: "transactions",
    label: "Transactions",
    group: "Accounting",
    columns: [
      { key: "date", label: "Date", cell: (r) => formatDate(r.date as string) },
      { key: "account", label: "Account", cell: (r) => <span>{accountName(r.accountCode as string)}</span> },
      { key: "memo", label: "Memo", cell: (r) => r.memo as string },
      { key: "category", label: "Category", cell: (r) => <Badge variant="outline">{r.category as string}</Badge> },
      { key: "entity", label: "Entity", cell: (r) => entityById(r.entityId as string)?.name ?? "—" },
      { key: "location", label: "Location", cell: (r) => locationById(r.locationId as string)?.name ?? "—" },
      { key: "debit", label: "Debit", align: "right", cell: (r) => ((r.debit as number) ? <Money value={r.debit as number} /> : <span className="text-muted-foreground">—</span>) },
      { key: "credit", label: "Credit", align: "right", cell: (r) => ((r.credit as number) ? <Money value={r.credit as number} /> : <span className="text-muted-foreground">—</span>) },
    ],
    build: (f) =>
      POSTINGS
        .filter((p) => f.entity === ALL || p.entityId === f.entity)
        .filter((p) => inDateRange(p.date, f.from, f.to))
        .filter((p) => match(f.q, p.memo, accountName(p.accountCode), p.category))
        .map((p) => ({ ...p, _date: p.date, _amount: p.debit || p.credit, _name: accountName(p.accountCode) })),
  },
  {
    key: "account-balances",
    label: "Account Balances",
    group: "Accounting",
    columns: [
      { key: "code", label: "Code", cell: (r) => <span className="font-mono text-xs">{r.code as string}</span> },
      { key: "name", label: "Account", cell: (r) => r.name as string },
      { key: "type", label: "Type", cell: (r) => <span className="capitalize">{r.type as string}</span> },
      { key: "debit", label: "Debit", align: "right", cell: (r) => <Money value={r.debit as number} /> },
      { key: "credit", label: "Credit", align: "right", cell: (r) => <Money value={r.credit as number} /> },
      { key: "net", label: "Net (Dr − Cr)", align: "right", cell: (r) => <Money value={r.net as number} colored bracketNegatives /> },
    ],
    build: (f) => {
      const acc = new Map<string, { debit: number; credit: number }>();
      POSTINGS
        .filter((p) => f.entity === ALL || p.entityId === f.entity)
        .filter((p) => inDateRange(p.date, f.from, f.to))
        .forEach((p) => {
          const cur = acc.get(p.accountCode) ?? { debit: 0, credit: 0 };
          cur.debit += p.debit;
          cur.credit += p.credit;
          acc.set(p.accountCode, cur);
        });
      return Array.from(acc.entries())
        .map(([code, v]) => ({
          code,
          name: accountName(code),
          type: accountType(code),
          debit: v.debit,
          credit: v.credit,
          net: v.debit - v.credit,
          _date: "",
          _amount: Math.abs(v.debit - v.credit),
          _name: accountName(code),
        }))
        .filter((r) => match(f.q, r.name, r.code, r.type as string));
    },
  },
  // ---------------- People ----------------
  {
    key: "roster",
    label: "Employee Roster",
    group: "People",
    columns: [
      { key: "code", label: "Code", cell: (r) => <span className="font-mono text-xs">{r.code as string}</span> },
      { key: "name", label: "Name", cell: (r) => r.name as string },
      { key: "designation", label: "Designation", cell: (r) => r.designation as string },
      { key: "department", label: "Department", cell: (r) => departmentName(r.departmentId as string) },
      { key: "entity", label: "Entity", cell: (r) => entityById(r.entityId as string)?.name ?? "—" },
      { key: "location", label: "Location", cell: (r) => locationById(r.locationId as string)?.name ?? "—" },
      { key: "manager", label: "Manager", cell: (r) => employeeName(r.managerId as string | null) },
      { key: "joinDate", label: "Joined", cell: (r) => formatDate(r.joinDate as string) },
      { key: "status", label: "Status", cell: (r) => statusBadge(r.status as string) },
    ],
    build: (f) =>
      EMPLOYEES
        .filter((e) => f.entity === ALL || e.entityId === f.entity)
        .filter((e) => f.status === "all" || e.status === f.status)
        .filter((e) => match(f.q, e.name, e.code, e.designation, e.email))
        .map((e) => ({ ...e, _date: e.joinDate, _amount: 0, _name: e.name })),
  },
  {
    key: "leave-register",
    label: "Leave Register",
    group: "People",
    columns: [
      { key: "employee", label: "Employee", cell: (r) => employeeName(r.employeeId as string) },
      { key: "type", label: "Type", cell: (r) => { const t = leaveTypeById(DEFAULT_LEAVE_TYPES, r.leaveTypeId as string); return t ? <Badge variant={t.tone}>{t.code}</Badge> : "—"; } },
      { key: "from", label: "From", cell: (r) => formatDate(r.from as string) },
      { key: "to", label: "To", cell: (r) => formatDate(r.to as string) },
      { key: "days", label: "Days", align: "right", cell: (r) => <span className="tabular font-semibold">{r.days as number}</span> },
      { key: "reason", label: "Reason", cell: (r) => r.reason as string },
      { key: "approver", label: "Approver", cell: (r) => employeeName(r.approverId as string | null) },
      { key: "status", label: "Status", cell: (r) => statusBadge(r.status as string) },
    ],
    build: (f) =>
      LEAVE_REQUESTS
        .filter((r) => f.status === "all" || r.status === f.status)
        .filter((r) => f.entity === ALL || employeeById(r.employeeId)?.entityId === f.entity)
        .filter((r) => inDateRange(r.from, f.from, f.to))
        .filter((r) => match(f.q, employeeName(r.employeeId), r.reason))
        .map((r) => ({ ...r, _date: r.from, _amount: r.days, _name: employeeName(r.employeeId) })),
  },
  {
    key: "leave-balances",
    label: "Leave Balances",
    group: "People",
    columns: [
      { key: "employee", label: "Employee", cell: (r) => r._name as string },
      { key: "leaveType", label: "Leave Type", cell: (r) => r.typeName as string },
      { key: "allocated", label: "Allocated", align: "right", cell: (r) => (r.allocated as number) || "∞" },
      { key: "used", label: "Used", align: "right", cell: (r) => <span className="tabular">{r.used as number}</span> },
      { key: "pending", label: "Pending", align: "right", cell: (r) => <span className="tabular">{r.pending as number}</span> },
      { key: "available", label: "Available", align: "right", cell: (r) => <span className="tabular font-semibold">{r.available as number}</span> },
    ],
    build: (f) =>
      EMPLOYEES
        .filter((e) => f.entity === ALL || e.entityId === f.entity)
        .filter((e) => match(f.q, e.name, e.code))
        .flatMap((e) =>
          balancesFor(e.id, DEFAULT_LEAVE_TYPES).map((b) => {
            const t = leaveTypeById(DEFAULT_LEAVE_TYPES, b.leaveTypeId)!;
            return {
              ...b,
              typeName: t.name,
              _date: "",
              _amount: b.available,
              _name: e.name,
            };
          }),
        ),
  },
];

function sortRows(rows: Row[], f: Filters): Row[] {
  const key = f.sortBy === "amount" ? "_amount" : f.sortBy === "name" ? "_name" : "_date";
  const out = [...rows].sort((a, b) => {
    const av = a[key] as string | number | undefined;
    const bv = b[key] as string | number | undefined;
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    return av < bv ? -1 : av > bv ? 1 : 0;
  });
  return f.sortOrder === "desc" ? out.reverse() : out;
}

export function ReportHubClient() {
  const [reportKey, setReportKey] = React.useState(REPORTS[0].key);
  const [draft, setDraft] = React.useState<Filters>(DEFAULT_FILTERS);
  const [applied, setApplied] = React.useState<Filters>(DEFAULT_FILTERS);
  const [showFilters, setShowFilters] = React.useState(true);
  const [cols, setCols] = React.useState<Record<string, string[]>>(() =>
    Object.fromEntries(REPORTS.map((r) => [r.key, r.columns.map((c) => c.key)])),
  );
  const [addOpen, setAddOpen] = React.useState(false);
  const [dragKey, setDragKey] = React.useState<string | null>(null);
  const tableRef = React.useRef<HTMLTableElement>(null);

  const report = REPORTS.find((r) => r.key === reportKey)!;
  const visibleKeys = cols[reportKey];
  const visibleCols = visibleKeys
    .map((k) => report.columns.find((c) => c.key === k))
    .filter(Boolean) as Column[];
  const hiddenCols = report.columns.filter((c) => !visibleKeys.includes(c.key));
  const rows = sortRows(report.build(applied), applied);

  const set = (patch: Partial<Filters>) => setDraft((p) => ({ ...p, ...patch }));

  function removeCol(key: string) {
    setCols((p) => ({ ...p, [reportKey]: p[reportKey].filter((k) => k !== key) }));
  }
  function addCol(key: string) {
    setCols((p) => ({ ...p, [reportKey]: [...p[reportKey], key] }));
    setAddOpen(false);
  }
  function moveCol(from: string, to: string) {
    if (from === to) return;
    setCols((p) => {
      const arr = [...p[reportKey]];
      const fi = arr.indexOf(from);
      const ti = arr.indexOf(to);
      if (fi < 0 || ti < 0) return p;
      arr.splice(fi, 1);
      arr.splice(ti, 0, from);
      return { ...p, [reportKey]: arr };
    });
  }

  function exportPdf() {
    const win = window.open("", "_blank", "width=980,height=720");
    if (!win || !tableRef.current) return;
    const parts: string[] = [];
    if (applied.from || applied.to) parts.push(`Date: ${applied.from || "…"} – ${applied.to || "…"}`);
    if (applied.entity !== ALL) parts.push(`Entity: ${entityById(applied.entity)?.name ?? ""}`);
    if (applied.status !== "all") parts.push(`Status: ${applied.status}`);
    if (applied.q) parts.push(`Search: ${applied.q}`);
    parts.push(`Sort: ${applied.sortBy} ${applied.sortOrder}`);
    win.document.write(`<!doctype html><html><head><title>NEXA — ${report.label}</title>
      <style>
        *{box-sizing:border-box} body{font-family:ui-sans-serif,system-ui,Arial,sans-serif;color:#111;margin:32px}
        .brand{font-size:20px;font-weight:700;color:#2563eb}
        h2{margin:2px 0 4px;font-size:16px}
        .meta{color:#666;font-size:12px;margin-bottom:16px}
        .filters{font-size:12px;color:#444;background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:8px 12px;margin-bottom:16px}
        table{width:100%;border-collapse:collapse;font-size:12px}
        th{text-align:left;text-transform:uppercase;font-size:10px;letter-spacing:.04em;color:#666;border-bottom:2px solid #ddd;padding:8px}
        td{padding:7px 8px;border-bottom:1px solid #eee}
        td[align=right],th[align=right]{text-align:right}
        footer{margin-top:24px;font-size:11px;color:#999;text-align:center}
        @media print{body{margin:12mm}}
      </style></head><body>
      <div class="brand">◆ NEXA</div>
      <h2>${report.label}</h2>
      <div class="meta">${rows.length} rows · ${report.group}</div>
      <div class="filters">${parts.join("&nbsp;&nbsp;·&nbsp;&nbsp;")}</div>
      ${tableRef.current.outerHTML}
      <footer>NEXA — confidential</footer>
      </body></html>`);
    win.document.close();
    win.focus();
    win.print();
  }

  const groups = ["Accounting", "People"] as const;

  return (
    <>
      <PageHeader
        title="Report Explorer"
        subtitle="Build a report from any data — tune filters, choose columns, export."
      />

      {/* Report type tabs, grouped */}
      <Card className="mb-4 p-2">
        <div className="flex flex-wrap items-center gap-3">
          {groups.map((g) => (
            <div key={g} className="flex flex-wrap items-center gap-1">
              <span className="px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{g}</span>
              {REPORTS.filter((r) => r.group === g).map((r) => (
                <button
                  key={r.key}
                  onClick={() => setReportKey(r.key)}
                  className={cn(
                    "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                    r.key === reportKey ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
                  )}
                >
                  {r.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      </Card>

      {/* Filters */}
      <Card className="mb-4 overflow-hidden">
        <button
          onClick={() => setShowFilters((s) => !s)}
          className="flex w-full items-center gap-2 border-b px-5 py-3 text-sm font-medium hover:bg-accent/40"
        >
          <SlidersHorizontal className="size-4" /> Filters
          {showFilters ? <ChevronUp className="ml-auto size-4" /> : <ChevronDown className="ml-auto size-4" />}
        </button>
        {showFilters && (
          <div className="p-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Search">
                <Input value={draft.q} onChange={(e) => set({ q: e.target.value })} placeholder="Free text…" />
              </Field>
              <Field label="Entity">
                <Select value={draft.entity} onChange={(e) => set({ entity: e.target.value })}>
                  <option value={ALL}>All entities</option>
                  {ENTITIES.map((en) => (
                    <option key={en.id} value={en.id}>{en.name}</option>
                  ))}
                </Select>
              </Field>
              <Field label="Status">
                <Select value={draft.status} onChange={(e) => set({ status: e.target.value })}>
                  <option value="all">All statuses</option>
                  <optgroup label="Leave / Employee">
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="active">Active</option>
                    <option value="on-leave">On leave</option>
                  </optgroup>
                </Select>
              </Field>
              <Field label="Date From">
                <Input type="date" value={draft.from} onChange={(e) => set({ from: e.target.value })} />
              </Field>
              <Field label="Date To">
                <Input type="date" value={draft.to} onChange={(e) => set({ to: e.target.value })} />
              </Field>
              <Field label="Sort By">
                <Select value={draft.sortBy} onChange={(e) => set({ sortBy: e.target.value as Filters["sortBy"] })}>
                  <option value="date">Date</option>
                  <option value="amount">Amount / Days</option>
                  <option value="name">Name</option>
                </Select>
              </Field>
              <Field label="Sort Order">
                <Select value={draft.sortOrder} onChange={(e) => set({ sortOrder: e.target.value as Filters["sortOrder"] })}>
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </Select>
              </Field>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button variant="outline" onClick={() => { setDraft(DEFAULT_FILTERS); setApplied(DEFAULT_FILTERS); }}>
                Clear all
              </Button>
              <Button onClick={() => setApplied(draft)}>Apply Filters</Button>
            </div>
          </div>
        )}
      </Card>

      {/* Column chips */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Columns:</span>
        {visibleCols.map((c) => (
          <span
            key={c.key}
            draggable
            onDragStart={() => setDragKey(c.key)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => { if (dragKey) moveCol(dragKey, c.key); setDragKey(null); }}
            onDragEnd={() => setDragKey(null)}
            className={cn(
              "inline-flex cursor-grab items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary active:cursor-grabbing",
              dragKey === c.key && "opacity-40",
            )}
          >
            <GripVertical className="size-3 opacity-50" />
            {c.label}
            <button onClick={() => removeCol(c.key)} className="hover:text-danger" aria-label={`Remove ${c.label}`}>
              <X className="size-3" />
            </button>
          </span>
        ))}
        {hiddenCols.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setAddOpen((o) => !o)}
              className="inline-flex items-center gap-1 rounded-full border border-dashed px-2.5 py-1 text-xs font-medium text-muted-foreground hover:bg-accent"
            >
              <Plus className="size-3" /> Add
            </button>
            {addOpen && (
              <div className="absolute z-10 mt-1 w-44 rounded-lg border bg-card p-1 shadow-lg">
                {hiddenCols.map((c) => (
                  <button
                    key={c.key}
                    onClick={() => addCol(c.key)}
                    className="block w-full rounded-md px-3 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Results */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-5 py-3">
          <div className="flex items-baseline gap-2">
            <p className="text-sm font-medium">{report.label}</p>
            <span className="text-xs text-muted-foreground">{rows.length} rows</span>
          </div>
          <Button size="sm" variant="outline" onClick={exportPdf}>
            <FileDown className="size-3.5" /> Export PDF
          </Button>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table ref={tableRef} className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                {visibleCols.map((c) => (
                  <th key={c.key} align={c.align === "right" ? "right" : undefined} className={cn("px-5 py-3 font-medium", c.align === "right" && "text-right")}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={visibleCols.length || 1} className="px-5 py-12 text-center text-sm text-muted-foreground">
                    No rows match these filters
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={(r.id as string) ?? i} className="border-b transition-colors last:border-0 hover:bg-accent/50">
                  {visibleCols.map((c) => (
                    <td key={c.key} align={c.align === "right" ? "right" : undefined} className={cn("px-5 py-3", c.align === "right" && "text-right tabular")}>
                      {c.cell(r)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
