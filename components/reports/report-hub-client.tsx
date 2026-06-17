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
import { outwardRows, inwardRows } from "@/lib/tax/tax-data";
import { stateName } from "@/lib/tax/gst";
import { ORDERS, byChannel } from "@/lib/orders";
import { PURCHASE_ORDERS, vendorName, loadPoPayments } from "@/lib/vendors";
import { loadP2P, p2pStage, STAGE_META } from "@/lib/p2p";
import { allAssets, loadCreatedAssets } from "@/lib/assets/assets";
import { accumulatedDepreciation, netBookValue } from "@/lib/assets/depreciation";

// Tax datasets (deterministic, derived from the same events as GSTR filings).
const OUTWARD = outwardRows();
const INWARD = inwardRows();

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

const TODAY = new Date().toISOString().slice(0, 10);
const money = (r: Row, key: string) => <Money value={(r[key] as number) || 0} />;

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
type ReportGroup = "Accounting" | "Tax" | "Sales" | "Procurement" | "Assets" | "People";
interface ReportDef {
  key: string;
  label: string;
  group: ReportGroup;
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

  // ---------------- Tax: GST ----------------
  {
    key: "gst-output",
    label: "GST — Output (GSTR-1)",
    group: "Tax",
    columns: [
      { key: "date", label: "Date", cell: (r) => formatDate(r.date as string) },
      { key: "invoiceNo", label: "Invoice", cell: (r) => <span className="font-mono text-xs">{r.invoiceNo as string}</span> },
      { key: "customer", label: "Customer", cell: (r) => r.customerName as string },
      { key: "gstin", label: "GSTIN", cell: (r) => <span className="font-mono text-xs">{(r.customerGstin as string) || "B2C"}</span> },
      { key: "place", label: "Place of supply", cell: (r) => stateName(r.placeOfSupply as string) },
      { key: "nature", label: "Nature", cell: (r) => <Badge variant="outline" className="uppercase">{r.nature as string}</Badge> },
      { key: "hsn", label: "HSN", cell: (r) => <span className="font-mono text-xs">{r.hsn as string}</span> },
      { key: "rate", label: "Rate", align: "right", cell: (r) => `${r.rate as number}%` },
      { key: "taxable", label: "Taxable", align: "right", cell: (r) => money(r, "taxable") },
      { key: "cgst", label: "CGST", align: "right", cell: (r) => money(r, "cgst") },
      { key: "sgst", label: "SGST/UTGST", align: "right", cell: (r) => money(r, "sgstUt") },
      { key: "igst", label: "IGST", align: "right", cell: (r) => money(r, "igst") },
      { key: "total", label: "Invoice total", align: "right", cell: (r) => <Money value={r.gross as number} className="font-semibold" /> },
    ],
    build: (f) =>
      OUTWARD
        .filter((r) => f.entity === ALL || r.entityId === f.entity)
        .filter((r) => inDateRange(r.date, f.from, f.to))
        .filter((r) => match(f.q, r.invoiceNo, r.customerName, r.hsn, r.nature, r.rate, r.customerGstin))
        .map((r) => ({ ...r, sgstUt: r.sgst + r.utgst, _date: r.date, _amount: r.gross, _name: r.customerName })),
  },
  {
    key: "gst-input",
    label: "GST — Input / ITC",
    group: "Tax",
    columns: [
      { key: "date", label: "Date", cell: (r) => formatDate(r.date as string) },
      { key: "invoiceNo", label: "Bill", cell: (r) => <span className="font-mono text-xs">{r.invoiceNo as string}</span> },
      { key: "vendor", label: "Vendor", cell: (r) => r.vendorName as string },
      { key: "gstin", label: "GSTIN", cell: (r) => <span className="font-mono text-xs">{(r.vendorGstin as string) || "—"}</span> },
      { key: "supplier", label: "Supplier state", cell: (r) => stateName(r.supplierState as string) },
      { key: "nature", label: "Nature", cell: (r) => <Badge variant="outline" className="uppercase">{r.nature as string}</Badge> },
      { key: "hsn", label: "HSN", cell: (r) => <span className="font-mono text-xs">{r.hsn as string}</span> },
      { key: "rate", label: "Rate", align: "right", cell: (r) => `${r.rate as number}%` },
      { key: "taxable", label: "Taxable", align: "right", cell: (r) => money(r, "taxable") },
      { key: "cgst", label: "CGST", align: "right", cell: (r) => money(r, "cgst") },
      { key: "sgst", label: "SGST/UTGST", align: "right", cell: (r) => money(r, "sgstUt") },
      { key: "igst", label: "IGST", align: "right", cell: (r) => money(r, "igst") },
      { key: "itc", label: "ITC", cell: (r) => (r.rcm ? <Badge variant="warning">RCM</Badge> : r.itcEligible ? <Badge variant="success">Eligible</Badge> : <Badge variant="danger">Blocked</Badge>) },
    ],
    build: (f) =>
      INWARD
        .filter((r) => f.entity === ALL || r.entityId === f.entity)
        .filter((r) => inDateRange(r.date, f.from, f.to))
        .filter((r) => match(f.q, r.invoiceNo, r.vendorName, r.hsn, r.nature, r.rate, r.vendorGstin))
        .map((r) => ({ ...r, sgstUt: r.sgst + r.utgst, _date: r.date, _amount: r.gross, _name: r.vendorName })),
  },
  {
    key: "gst-hsn",
    label: "GST — HSN summary",
    group: "Tax",
    columns: [
      { key: "hsn", label: "HSN/SAC", cell: (r) => <span className="font-mono text-xs">{r.hsn as string}</span> },
      { key: "rate", label: "Rate", align: "right", cell: (r) => `${r.rate as number}%` },
      { key: "count", label: "Invoices", align: "right", cell: (r) => <span className="tabular">{r.count as number}</span> },
      { key: "taxable", label: "Taxable", align: "right", cell: (r) => money(r, "taxable") },
      { key: "tax", label: "Total GST", align: "right", cell: (r) => money(r, "tax") },
      { key: "total", label: "Value", align: "right", cell: (r) => <Money value={r.total as number} className="font-semibold" /> },
    ],
    build: (f) => {
      const m = new Map<string, { hsn: string; rate: number; count: number; taxable: number; tax: number; total: number }>();
      OUTWARD
        .filter((r) => f.entity === ALL || r.entityId === f.entity)
        .filter((r) => inDateRange(r.date, f.from, f.to))
        .filter((r) => match(f.q, r.hsn, r.rate))
        .forEach((r) => {
          const k = `${r.hsn}|${r.rate}`;
          const e = m.get(k) ?? { hsn: r.hsn, rate: r.rate, count: 0, taxable: 0, tax: 0, total: 0 };
          e.count += 1;
          e.taxable += r.taxable;
          e.tax += r.tax;
          e.total += r.gross;
          m.set(k, e);
        });
      return Array.from(m.values()).map((r) => ({ ...r, _date: "", _amount: r.total, _name: r.hsn }));
    },
  },

  // ---------------- Tax: TDS ----------------
  {
    key: "tds-deducted",
    label: "TDS — Deducted (payable)",
    group: "Tax",
    columns: [
      { key: "date", label: "Date", cell: (r) => formatDate(r.date as string) },
      { key: "vendor", label: "Deductee (vendor)", cell: (r) => r.vendorName as string },
      { key: "pan", label: "PAN", cell: (r) => <span className="font-mono text-xs">{r.vendorPan as string}</span> },
      { key: "section", label: "Section", cell: (r) => <Badge variant="primary">{r.tdsSection as string}</Badge> },
      { key: "baseRate", label: "Std rate", align: "right", cell: (r) => `${r.tdsBaseRate as number}%` },
      { key: "rate", label: "Applied", align: "right", cell: (r) => `${r.tdsRate as number}%` },
      { key: "ldc", label: "197 LDC", cell: (r) => (r.ldc ? <Badge variant="warning">{r.ldcCertNo as string}</Badge> : <span className="text-muted-foreground">—</span>) },
      { key: "taxable", label: "Base amount", align: "right", cell: (r) => money(r, "taxable") },
      { key: "tds", label: "TDS", align: "right", cell: (r) => <Money value={r.tds as number} className="font-semibold" /> },
      { key: "net", label: "Net payable", align: "right", cell: (r) => money(r, "netPayable") },
    ],
    build: (f) =>
      INWARD
        .filter((r) => (r.tds as number) > 0)
        .filter((r) => f.entity === ALL || r.entityId === f.entity)
        .filter((r) => inDateRange(r.date, f.from, f.to))
        .filter((r) => match(f.q, r.vendorName, r.tdsSection, r.vendorPan, r.ldcCertNo))
        .map((r) => ({ ...r, _date: r.date, _amount: r.tds, _name: r.vendorName })),
  },
  {
    key: "tds-receivable",
    label: "TDS — Receivable (on our bills)",
    group: "Tax",
    columns: [
      { key: "date", label: "Date", cell: (r) => formatDate(r.date as string) },
      { key: "invoiceNo", label: "Invoice", cell: (r) => <span className="font-mono text-xs">{r.invoiceNo as string}</span> },
      { key: "customer", label: "Customer (deductor)", cell: (r) => r.customerName as string },
      { key: "gstin", label: "GSTIN", cell: (r) => <span className="font-mono text-xs">{r.customerGstin as string}</span> },
      { key: "taxable", label: "Fee amount", align: "right", cell: (r) => money(r, "taxable") },
      { key: "tds", label: "TDS withheld (194J)", align: "right", cell: (r) => <Money value={r.tdsReceivable as number} className="font-semibold" /> },
    ],
    build: (f) =>
      OUTWARD
        .filter((r) => (r.tdsReceivable as number) > 0)
        .filter((r) => f.entity === ALL || r.entityId === f.entity)
        .filter((r) => inDateRange(r.date, f.from, f.to))
        .filter((r) => match(f.q, r.invoiceNo, r.customerName, r.customerGstin))
        .map((r) => ({ ...r, _date: r.date, _amount: r.tdsReceivable, _name: r.customerName })),
  },

  // ---------------- Sales ----------------
  {
    key: "sales-orders",
    label: "Sales Orders",
    group: "Sales",
    columns: [
      { key: "date", label: "Date", cell: (r) => formatDate(r.date as string) },
      { key: "orderNo", label: "Order", cell: (r) => <span className="font-mono text-xs">{r.orderNo as string}</span> },
      { key: "channel", label: "Channel", cell: (r) => r.channel as string },
      { key: "customer", label: "Customer", cell: (r) => r.customer as string },
      { key: "state", label: "State", cell: (r) => r.state as string },
      { key: "qty", label: "Qty", align: "right", cell: (r) => <span className="tabular">{r.qty as number}</span> },
      { key: "amount", label: "Amount", align: "right", cell: (r) => <Money value={r.amount as number} className="font-semibold" /> },
      { key: "status", label: "Status", cell: (r) => <Badge variant="outline" className="capitalize">{r.status as string}</Badge> },
      { key: "payment", label: "Payment", cell: (r) => <Badge variant={r.payment === "Prepaid" ? "success" : "warning"}>{r.payment as string}</Badge> },
    ],
    build: (f) =>
      ORDERS
        .filter((o) => f.entity === ALL || o.entityId === f.entity)
        .filter((o) => inDateRange(o.date, f.from, f.to))
        .filter((o) => match(f.q, o.orderNo, o.customer, o.channel, o.state, o.status))
        .map((o) => ({ ...o, _date: o.date, _amount: o.amount, _name: o.customer })),
  },
  {
    key: "sales-by-channel",
    label: "Sales by Channel",
    group: "Sales",
    columns: [
      { key: "channel", label: "Channel", cell: (r) => <span className="font-medium">{r.channel as string}</span> },
      { key: "orders", label: "Orders", align: "right", cell: (r) => <span className="tabular">{r.orders as number}</span> },
      { key: "gmv", label: "GMV", align: "right", cell: (r) => <Money value={r.gmv as number} className="font-semibold" /> },
    ],
    build: (f) => {
      const rows = ORDERS
        .filter((o) => f.entity === ALL || o.entityId === f.entity)
        .filter((o) => inDateRange(o.date, f.from, f.to));
      return byChannel(rows)
        .filter((c) => match(f.q, c.channel))
        .map((c) => ({ ...c, _date: "", _amount: c.gmv, _name: c.channel }));
    },
  },

  // ---------------- Procurement ----------------
  {
    key: "p2p-status",
    label: "Purchase Orders (P2P)",
    group: "Procurement",
    columns: [
      { key: "date", label: "Raised", cell: (r) => formatDate(r.date as string) },
      { key: "po", label: "PO", cell: (r) => <span className="font-mono text-xs">{r.id as string}</span> },
      { key: "vendor", label: "Vendor", cell: (r) => vendorName(r.vendorId as string) },
      { key: "title", label: "Description", cell: (r) => r.title as string },
      { key: "entity", label: "Entity", cell: (r) => entityById(r.entityId as string)?.name ?? "—" },
      { key: "total", label: "PO value", align: "right", cell: (r) => <Money value={r.total as number} className="font-semibold" /> },
      { key: "stage", label: "P2P stage", cell: (r) => <Badge variant={r.stage === "paid" ? "success" : r.stage === "ordered" ? "default" : "primary"}>{STAGE_META[r.stage as keyof typeof STAGE_META]?.label ?? (r.stage as string)}</Badge> },
    ],
    build: (f) => {
      const p2p = loadP2P();
      const pays = loadPoPayments();
      return PURCHASE_ORDERS
        .filter((po) => f.entity === ALL || po.entityId === f.entity)
        .filter((po) => inDateRange(po.date, f.from, f.to))
        .filter((po) => match(f.q, po.id, vendorName(po.vendorId), po.title))
        .map((po) => ({ ...po, stage: p2pStage(po, p2p[po.id], pays[po.id] ?? 0), _date: po.date, _amount: po.total, _name: vendorName(po.vendorId) }));
    },
  },

  // ---------------- Assets ----------------
  {
    key: "asset-register",
    label: "Fixed Asset Register",
    group: "Assets",
    columns: [
      { key: "tag", label: "Tag", cell: (r) => <span className="font-mono text-xs">{r.tag as string}</span> },
      { key: "name", label: "Asset", cell: (r) => r.name as string },
      { key: "category", label: "Category", cell: (r) => <Badge variant="outline">{r.category as string}</Badge> },
      { key: "entity", label: "Entity", cell: (r) => entityById(r.entityId as string)?.name ?? "—" },
      { key: "location", label: "Location", cell: (r) => locationById(r.locationId as string)?.name ?? "—" },
      { key: "acquired", label: "Acquired", cell: (r) => formatDate(r.acquisitionDate as string) },
      { key: "cost", label: "Cost", align: "right", cell: (r) => money(r, "cost") },
      { key: "accum", label: "Accum. dep", align: "right", cell: (r) => <Money value={r.accum as number} /> },
      { key: "nbv", label: "Net book value", align: "right", cell: (r) => <Money value={r.nbv as number} className="font-semibold" /> },
      { key: "method", label: "Method", cell: (r) => <Badge variant={r.method === "WDV" ? "primary" : "default"}>{r.method as string}</Badge> },
    ],
    build: (f) =>
      allAssets(loadCreatedAssets())
        .filter((a) => f.entity === ALL || a.entityId === f.entity)
        .filter((a) => inDateRange(a.acquisitionDate, f.from, f.to))
        .filter((a) => match(f.q, a.name, a.tag, a.category, a.supplier))
        .map((a) => ({ ...a, accum: accumulatedDepreciation(a, TODAY), nbv: netBookValue(a, TODAY), _date: a.acquisitionDate, _amount: a.cost, _name: a.name })),
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

  const groups = ["Accounting", "Tax", "Sales", "Procurement", "Assets", "People"] as const;

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
