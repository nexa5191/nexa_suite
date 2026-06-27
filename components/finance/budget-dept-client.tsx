"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Send, ShieldCheck, Plus, X, Download } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  MONTHS, FY, FY_PREV, CLOSED_MONTHS,
  DEPT_STATUS_META, SEED_STORE,
  loadBudgetStore, saveBudgetStore,
  deptLines, deptMonthTotal, deptAnnualTotal, sumLine,
  updateLineCell, updateAssumptions, updateDeptStatus,
  addSubLine, removeSubLine, updateSubLineLabel, updateSubLineCell,
  type BudgetStore, type Department, type DeptAssumptions,
} from "@/lib/finance/budget-builder";
import { downloadXlsx, colLetter, type CellInput } from "@/lib/xlsx/xlsx";

// ─── display helpers ──────────────────────────────────────────────────────────
function fmtL(n: number) { return (n / 100000).toFixed(2); }
function fmtLDisp(n: number) { return n === 0 ? "—" : "₹" + (n / 100000).toFixed(2) + "L"; }
function fmtCr(n: number) { return n === 0 ? "—" : "₹" + (n / 10000000).toFixed(2) + "Cr"; }
function parseL(s: string): number {
  const v = parseFloat(s);
  return isNaN(v) ? 0 : Math.round(v * 100000);
}

// plain number in ₹ Lakhs, or formula like =250*15/100000 or =3.75+1.25
function evalCell(raw: string): number {
  const s = raw.trim();
  if (!s || s === "—") return 0;
  if (s.startsWith("=")) {
    const expr = s.slice(1).replace(/[^0-9+\-*/().\s]/g, "").trim();
    if (!expr) return 0;
    try {
      // eslint-disable-next-line no-new-func
      const r = Function(`"use strict"; return (${expr})`)() as unknown;
      if (typeof r === "number" && isFinite(r)) return Math.round(r * 100000);
    } catch { /* bad formula */ }
    return 0;
  }
  return parseL(s);
}

const COL_W = "w-[80px] min-w-[80px]";
const CELL_CLS = "h-7 w-full border-0 bg-transparent text-right tabular-nums text-xs focus:bg-background focus:ring-1 focus:ring-primary/40 focus:outline-none rounded px-1";

// ─── formula cell ─────────────────────────────────────────────────────────────
// Displays the computed value when idle; shows the raw formula string when
// the user clicks in so they can edit it — exactly like Excel.
function FormulaCell({
  value, formula: savedFormula, onCommit, locked, className, dimmed,
}: {
  value: number;
  formula?: string | null;        // persisted formula string from the store
  onCommit: (val: number, formula: string | null) => void;
  locked?: boolean;
  className?: string;
  dimmed?: boolean;
}) {
  // initialise from the persisted formula if available, else the display value
  const [formula, setFormula] = React.useState<string>(() =>
    savedFormula ?? (value === 0 ? "" : fmtL(value)),
  );
  const [focused, setFocused] = React.useState(false);
  const ownCommit = React.useRef(false);

  // keep in sync when external value changes (e.g. a row was deleted)
  React.useEffect(() => {
    if (!ownCommit.current) {
      setFormula(savedFormula ?? (value === 0 ? "" : fmtL(value)));
    }
    ownCommit.current = false;
  }, [value, savedFormula]);

  const displayText = value === 0 ? "" : fmtL(value);

  if (locked) {
    return (
      <span className={cn("block w-full text-right px-1.5 py-1 text-[11px] tabular-nums", dimmed && "text-muted-foreground")}>
        {displayText || "—"}
      </span>
    );
  }

  return (
    <input
      type="text"
      value={focused ? formula : displayText}
      placeholder="—"
      onChange={(e) => setFormula(e.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => {
        setFocused(false);
        const raw = formula.trim();
        const computed = evalCell(raw);
        ownCommit.current = true;
        onCommit(computed, raw.startsWith("=") ? raw : null);
      }}
      className={cn(className ?? CELL_CLS, dimmed && !focused && "text-muted-foreground")}
      title={formula.startsWith("=") ? `Formula: ${formula}` : undefined}
    />
  );
}

// ─── excel export ─────────────────────────────────────────────────────────────
// Col layout: A=Cost Head, B=FY25 Actual, C..N=Apr..Mar, O=FY26 Total
const MONTH_COL_START = 2;   // C (0-indexed)
const TOTAL_COL      = 14;   // O

function buildBudgetSheet(store: BudgetStore, dept: Department) {
  const lines       = deptLines(store, dept);
  const firstMonLtr = colLetter(MONTH_COL_START);       // C
  const lastMonLtr  = colLetter(MONTH_COL_START + 11);  // N
  const totalColLtr = colLetter(TOTAL_COL);             // O

  const HDR: CellInput[] = [
    { value: "Cost Head",          style: { bold: true, fill: "E2E8F0", border: "all", align: "left"  } },
    { value: `FY${FY_PREV} (₹L)`, style: { bold: true, fill: "E2E8F0", border: "all", align: "right" } },
    ...MONTHS.map((m) => ({ value: m, style: { bold: true, fill: "E2E8F0", border: "all" as const, align: "right" as const } })),
    { value: `FY${FY} Total (₹L)`, style: { bold: true, fill: "E2E8F0", border: "all" as const, align: "right" as const } },
  ];

  const dataRows: CellInput[][] = [];
  const glHeadExcelRows: number[] = [];
  let excelRow = 2; // header is row 1

  for (const line of lines) {
    const hasSubLines = line.subLines.length > 0;
    const glRow = excelRow;
    glHeadExcelRows.push(glRow);

    const monthCells: CellInput[] = MONTHS.map((_, mi) => {
      const col = colLetter(MONTH_COL_START + mi);
      if (hasSubLines) {
        const subStart = excelRow + 1;
        const subEnd   = excelRow + line.subLines.length;
        return { formula: `SUM(${col}${subStart}:${col}${subEnd})`, value: line.budgeted[mi] / 100000,
          style: { bold: true, fill: "F1F5F9", numFmt: "#,##0.00", align: "right", border: "bottom" } };
      }
      const f = line.cellFormulas[mi];
      const base = { numFmt: "#,##0.00", align: "right" as const };
      if (f?.startsWith("=")) {
        return { formula: f.slice(1), value: line.budgeted[mi] / 100000, style: base };
      }
      return { value: line.budgeted[mi] === 0 ? null : line.budgeted[mi] / 100000, style: base };
    });

    dataRows.push([
      { value: line.glHead, style: { bold: hasSubLines, border: hasSubLines ? "bottom" : undefined } },
      { value: line.fy25Actual / 100000, style: { numFmt: "#,##0.00", align: "right", fill: "FAFAFA" } },
      ...monthCells,
      { formula: `SUM(${firstMonLtr}${glRow}:${lastMonLtr}${glRow})`,
        value: sumLine(line.budgeted) / 100000,
        style: { bold: true, numFmt: "#,##0.00", align: "right", fill: "F1F5F9" } },
    ]);
    excelRow++;

    for (const sl of line.subLines) {
      const slRow = excelRow;
      const slMonthCells: CellInput[] = sl.cells.map((val, mi) => {
        const f = sl.formulas[mi];
        const base = { numFmt: "#,##0.00", align: "right" as const, fontColor: "64748B" };
        if (f?.startsWith("=")) {
          return { formula: f.slice(1), value: val / 100000, style: base };
        }
        return { value: val === 0 ? null : val / 100000, style: base };
      });
      dataRows.push([
        { value: `   └ ${sl.label}`, style: { fontColor: "64748B", indent: 1 } },
        null,
        ...slMonthCells,
        { formula: `SUM(${firstMonLtr}${slRow}:${lastMonLtr}${slRow})`,
          value: sumLine(sl.cells) / 100000,
          style: { numFmt: "#,##0.00", align: "right", fontColor: "64748B" } },
      ]);
      excelRow++;
    }
  }

  // Department total row
  const totRow = excelRow;
  const totMonthCells: CellInput[] = MONTHS.map((_, mi) => {
    const col  = colLetter(MONTH_COL_START + mi);
    const refs = glHeadExcelRows.map((r) => `${col}${r}`).join("+");
    return { formula: refs, value: deptMonthTotal(store, dept, mi, "budgeted") / 100000,
      style: { bold: true, numFmt: "#,##0.00", align: "right", fill: "E2E8F0", border: "topbottom" } };
  });
  dataRows.push([
    { value: "TOTAL", style: { bold: true, fill: "E2E8F0", border: "topbottom" } },
    { value: deptAnnualTotal(store, dept, "fy25Actual") / 100000,
      style: { bold: true, numFmt: "#,##0.00", align: "right", fill: "E2E8F0" } },
    ...totMonthCells,
    { formula: `SUM(${firstMonLtr}${totRow}:${lastMonLtr}${totRow})`,
      value: deptAnnualTotal(store, dept, "budgeted") / 100000,
      style: { bold: true, numFmt: "#,##0.00", align: "right", fill: "E2E8F0", border: "topbottom" } },
  ]);

  return {
    name: dept,
    freeze: { rows: 1, cols: 1 },
    cols: [
      { width: 32 }, { width: 14 },
      ...Array(12).fill(null).map(() => ({ width: 10 })),
      { width: 15 },
    ],
    rows: [HDR, ...dataRows],
  };
}

// ─── main component ───────────────────────────────────────────────────────────
export function BudgetDeptClient({ dept }: { dept: Department }) {
  const [store, setStore] = React.useState<BudgetStore>(SEED_STORE);
  const [tab, setTab]     = React.useState<"budget" | "actuals">("budget");

  React.useEffect(() => { setStore(loadBudgetStore()); }, []);

  function mutate(next: BudgetStore) { setStore(next); saveBudgetStore(next); }

  const status      = store.deptStatus[dept];
  const sm          = DEPT_STATUS_META[status];
  const assumptions = store.assumptions[dept];
  const lines       = deptLines(store, dept);
  const fy26Total   = deptAnnualTotal(store, dept, "budgeted");
  const fy25Total   = deptAnnualTotal(store, dept, "fy25Actual");
  const ytdActual   = CLOSED_MONTHS.reduce((s, mi) => s + deptMonthTotal(store, dept, mi, "actuals"), 0);
  const ytdBudget   = CLOSED_MONTHS.reduce((s, mi) => s + deptMonthTotal(store, dept, mi, "budgeted"), 0);
  const locked      = status === "approved";

  return (
    <>
      <PageHeader
        title={`${dept} — Budget FY ${FY}`}
        subtitle={`FY${FY_PREV} actuals shown for reference · ${lines.length} cost heads`}
        actions={
          <div className="flex items-center gap-2">
            <Link href="/finance/budgetbuilder">
              <Button variant="outline" size="sm"><ArrowLeft className="size-4" /> All Departments</Button>
            </Link>
            <Button variant="outline" size="sm"
              onClick={() => downloadXlsx(`${dept} Budget FY${FY}`, { sheets: [buildBudgetSheet(store, dept)] })}>
              <Download className="size-3.5" /> Excel
            </Button>
            <Badge variant={sm.variant} className="h-8 px-3">{sm.label}</Badge>
            {status === "draft" && (
              <Button size="sm" onClick={() => mutate(updateDeptStatus(store, dept, "submitted"))}>
                <Send className="size-3.5" /> Submit
              </Button>
            )}
            {status === "submitted" && (
              <Button size="sm" onClick={() => mutate(updateDeptStatus(store, dept, "approved"))}>
                <ShieldCheck className="size-3.5" /> Approve
              </Button>
            )}
            {status === "approved" && (
              <Button size="sm" variant="outline" onClick={() => mutate(updateDeptStatus(store, dept, "draft"))}>
                Revise
              </Button>
            )}
          </div>
        }
      />

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={`FY${FY_PREV} Actual`} value={fmtCr(fy25Total)} />
        <Kpi label="FY26 Budget" value={fmtCr(fy26Total)}
          sub={`${fy25Total > 0 ? ((fy26Total/fy25Total - 1)*100).toFixed(1) : 0}% vs prior year`}
          subColor={fy26Total >= fy25Total ? "text-success" : "text-danger"} />
        <Kpi label="YTD Actual (Apr–May)" value={fmtLDisp(ytdActual)}
          sub={`vs ₹${(ytdBudget/100000).toFixed(1)}L budget`}
          subColor={ytdActual <= ytdBudget ? "text-success" : "text-danger"} />
        <Kpi label="YTD Utilisation"
          value={fy26Total > 0 ? (ytdActual / fy26Total * 100).toFixed(1) + "%" : "—"}
          sub="of full-year budget used" />
      </div>

      {/* Assumptions reference (collapsed by default) */}
      <AssumptionsPanel
        assumptions={assumptions}
        locked={locked}
        onChange={(patch) => mutate(updateAssumptions(store, dept, patch))}
      />

      {/* View toggle */}
      <div className="mb-3 flex gap-1 rounded-lg border p-0.5 bg-muted/30 w-fit">
        {(["budget", "actuals"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={cn("rounded px-4 py-1.5 text-xs font-medium transition-colors",
              tab === t ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
            {t === "budget" ? "Budget Entry" : "vs Actuals"}
          </button>
        ))}
      </div>

      {tab === "budget" ? (
        <BudgetTable
          store={store} dept={dept} lines={lines} locked={locked}
          onCell={(glHead, mi, val, f) => mutate(updateLineCell(store, dept, glHead, "budgeted", mi, val, f))}
          onAddSubLine={(glHead) => mutate(addSubLine(store, dept, glHead))}
          onRemoveSubLine={(glHead, subId) => mutate(removeSubLine(store, dept, glHead, subId))}
          onSubLineLabel={(glHead, subId, label) => mutate(updateSubLineLabel(store, dept, glHead, subId, label))}
          onSubLineCell={(glHead, subId, mi, val, f) => mutate(updateSubLineCell(store, dept, glHead, subId, mi, val, f))}
        />
      ) : (
        <ActualsTable store={store} dept={dept} lines={lines} />
      )}
    </>
  );
}

// ─── assumptions reference panel (collapsible) ────────────────────────────────
function AssumptionsPanel({
  assumptions, locked, onChange,
}: {
  assumptions: DeptAssumptions;
  locked: boolean;
  onChange: (patch: Partial<DeptAssumptions>) => void;
}) {
  const [open, setOpen] = React.useState(false);
  const hcChange = assumptions.headcountFY25 > 0
    ? ((assumptions.headcountFY26 - assumptions.headcountFY25) / assumptions.headcountFY25 * 100) : 0;

  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <span className="text-[10px]">{open ? "▼" : "▶"}</span>
        Key assumptions — Headcount {assumptions.headcountFY25}→{assumptions.headcountFY26}
        {hcChange !== 0 && <span className={cn("font-medium", hcChange > 0 ? "text-success" : "text-danger")}>
          ({hcChange > 0 ? "+" : ""}{hcChange.toFixed(1)}%)
        </span>}
        &nbsp;· Revenue growth {assumptions.revenueGrowthPct}%
        &nbsp;· Area {(assumptions.areaSqftFY25/1000).toFixed(0)}k→{(assumptions.areaSqftFY26/1000).toFixed(0)}k sqft
      </button>

      {open && (
        <Card className="mt-2 mb-3 p-4">
          <div className="grid gap-4 sm:grid-cols-3 text-xs">
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Headcount</p>
              <div className="grid grid-cols-3 gap-2">
                {[["FY25", "headcountFY25"] as const, ["FY26", "headcountFY26"] as const].map(([label, key]) => (
                  <div key={key}>
                    <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                    {locked ? <p className="font-semibold">{assumptions[key]}</p> : (
                      <input type="number" className="h-6 w-full border rounded px-1 text-xs bg-background"
                        defaultValue={assumptions[key]}
                        onBlur={(e) => onChange({ [key]: Math.max(1, Number(e.target.value)) })} />
                    )}
                  </div>
                ))}
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">Change</p>
                  <p className={cn("font-bold", hcChange > 0 ? "text-success" : hcChange < 0 ? "text-danger" : "text-muted-foreground")}>
                    {hcChange > 0 ? "+" : ""}{hcChange.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Revenue growth</p>
              {locked ? <p className="font-semibold text-success">+{assumptions.revenueGrowthPct}%</p> : (
                <div className="flex items-center gap-1">
                  <input type="number" step={0.5} className="h-6 w-16 border rounded px-1 text-xs bg-background"
                    defaultValue={assumptions.revenueGrowthPct}
                    onBlur={(e) => onChange({ revenueGrowthPct: Number(e.target.value) })} />
                  <span className="text-muted-foreground">%</span>
                </div>
              )}
            </div>
            <div>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Area (sqft)</p>
              <div className="grid grid-cols-2 gap-2">
                {[["FY25", "areaSqftFY25"] as const, ["FY26", "areaSqftFY26"] as const].map(([label, key]) => (
                  <div key={key}>
                    <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
                    {locked ? <p className="font-semibold">{assumptions[key].toLocaleString()}</p> : (
                      <input type="number" className="h-6 w-full border rounded px-1 text-xs bg-background"
                        defaultValue={assumptions[key]}
                        onBlur={(e) => onChange({ [key]: Math.max(0, Number(e.target.value)) })} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// ─── budget entry table ───────────────────────────────────────────────────────
function BudgetTable({
  store, dept, lines, locked,
  onCell, onAddSubLine, onRemoveSubLine, onSubLineLabel, onSubLineCell,
}: {
  store: BudgetStore; dept: Department;
  lines: ReturnType<typeof deptLines>;
  locked: boolean;
  onCell: (glHead: string, mi: number, val: number, formula: string | null) => void;
  onAddSubLine: (glHead: string) => void;
  onRemoveSubLine: (glHead: string, subId: string) => void;
  onSubLineLabel: (glHead: string, subId: string, label: string) => void;
  onSubLineCell: (glHead: string, subId: string, mi: number, val: number, formula: string | null) => void;
}) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  function toggleExpand(glHead: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(glHead)) next.delete(glHead); else next.add(glHead);
      return next;
    });
  }

  function expandRow(glHead: string) {
    setExpanded((prev) => new Set([...prev, glHead]));
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b bg-muted/50 text-left text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted/50 px-3 py-2.5 font-medium w-52 min-w-52 border-r">Cost head</th>
              <th className="px-2 py-2.5 text-right font-medium w-20 min-w-20 bg-muted/30 border-r">
                FY25 Actual
              </th>
              {MONTHS.map((m, i) => (
                <th key={m} className={cn(COL_W, "px-1.5 py-2.5 text-right font-medium",
                  CLOSED_MONTHS.includes(i) && "bg-primary/5 text-primary/80")}>
                  {m}
                </th>
              ))}
              <th className="px-2 py-2.5 text-right font-medium w-20 min-w-20 bg-muted/30 border-l">FY26 Total</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, ri) => {
              const hasSubLines = line.subLines.length > 0;
              const lineTotal   = sumLine(line.budgeted);

              const isExpanded = expanded.has(line.glHead);

              return (
                <React.Fragment key={line.glHead}>
                  {/* ── GL Head row — the line that flows to actuals ── */}
                  <tr
                    onDoubleClick={() => { if (hasSubLines) toggleExpand(line.glHead); }}
                    className={cn(
                      "border-b hover:bg-accent/20",
                      hasSubLines ? "bg-muted/40" : ri % 2 === 0 ? "bg-background" : "bg-muted/10",
                      hasSubLines && "cursor-pointer select-none",
                    )}
                  >
                    {/* Name + add-row button */}
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-2 border-r text-[11px]">
                      <div className="flex items-center gap-1.5">
                        {hasSubLines && (
                          <span className="text-[9px] text-muted-foreground shrink-0 w-2.5">
                            {isExpanded ? "▼" : "▶"}
                          </span>
                        )}
                        <span className={cn("flex-1 truncate", hasSubLines ? "font-semibold" : "font-medium")}>
                          {line.glHead}
                        </span>
                        {!locked && (
                          <button
                            onClick={(e) => { e.stopPropagation(); onAddSubLine(line.glHead); expandRow(line.glHead); }}
                            title="Add calculation row (double-click row to expand/collapse)"
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-primary/20 hover:text-primary transition-colors"
                          >
                            <Plus className="size-2.5" />
                          </button>
                        )}
                      </div>
                      {hasSubLines && !isExpanded && (
                        <p className="text-[9px] text-muted-foreground font-normal mt-0.5 leading-none pl-3.5">
                          {line.subLines.length} calculation row{line.subLines.length > 1 ? "s" : ""} · double-click to expand
                        </p>
                      )}
                    </td>

                    {/* FY25 actual (reference) */}
                    <td className="px-2 py-2 text-right tabular-nums text-muted-foreground bg-muted/20 border-r text-[11px]">
                      {line.fy25Actual > 0 ? "₹" + fmtL(line.fy25Actual) + "L" : "—"}
                    </td>

                    {/* 12 month cells */}
                    {line.budgeted.map((val, mi) => (
                      <td key={mi} className={cn("px-0.5 py-0.5", CLOSED_MONTHS.includes(mi) && "bg-primary/3")}>
                        {hasSubLines ? (
                          <span className="block w-full text-right px-1.5 py-1 text-[11px] tabular-nums text-muted-foreground font-semibold">
                            {val === 0 ? "—" : fmtL(val)}
                          </span>
                        ) : (
                          <FormulaCell
                            key={`${line.glHead}-${mi}`}
                            value={val}
                            formula={line.cellFormulas[mi]}
                            locked={locked}
                            onCommit={(v, f) => onCell(line.glHead, mi, v, f)}
                          />
                        )}
                      </td>
                    ))}

                    {/* Row total */}
                    <td className={cn("px-2 py-2 text-right tabular-nums bg-muted/20 border-l text-[11px]",
                      hasSubLines ? "font-bold" : "font-semibold")}>
                      {lineTotal === 0 ? "—" : fmtL(lineTotal) + "L"}
                    </td>
                  </tr>

                  {/* ── Calculation / detail rows — only when expanded ── */}
                  {isExpanded && line.subLines.map((sl) => {
                    const slTotal = sumLine(sl.cells);
                    return (
                      <tr key={sl.id} className="border-b bg-background hover:bg-accent/10">
                        {/* Indented label (free text) */}
                        <td className="sticky left-0 z-10 bg-inherit border-r">
                          <div className="flex items-center gap-1 pl-7 pr-2 py-1">
                            <span className="text-muted-foreground/40 shrink-0 text-[10px] leading-none">└</span>
                            {locked ? (
                              <span className="text-[11px] flex-1 truncate text-muted-foreground">{sl.label}</span>
                            ) : (
                              <input
                                type="text"
                                className="h-6 flex-1 min-w-0 border-0 bg-transparent text-[11px] text-muted-foreground focus:text-foreground focus:outline-none focus:bg-muted/20 focus:ring-1 focus:ring-primary/30 rounded px-1"
                                defaultValue={sl.label}
                                placeholder="Label…"
                                onBlur={(e) => onSubLineLabel(line.glHead, sl.id, e.target.value.trim() || "Detail")}
                              />
                            )}
                            {!locked && (
                              <button
                                onClick={() => onRemoveSubLine(line.glHead, sl.id)}
                                title="Remove row"
                                className="ml-auto flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground/50 hover:bg-danger/20 hover:text-danger transition-colors"
                              >
                                <X className="size-2.5" />
                              </button>
                            )}
                          </div>
                        </td>

                        {/* FY25 spacer */}
                        <td className="border-r bg-muted/5" />

                        {/* 12 formula-capable month cells */}
                        {sl.cells.map((val, mi) => (
                          <td key={mi} className={cn("px-0.5 py-0.5", CLOSED_MONTHS.includes(mi) && "bg-primary/3")}>
                            <FormulaCell
                              key={`${sl.id}-${mi}`}
                              value={val}
                              formula={sl.formulas[mi]}
                              locked={locked}
                              dimmed
                              onCommit={(v, f) => onSubLineCell(line.glHead, sl.id, mi, v, f)}
                            />
                          </td>
                        ))}

                        {/* Row subtotal */}
                        <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground bg-muted/5 border-l text-[11px]">
                          {slTotal === 0 ? "—" : fmtL(slTotal) + "L"}
                        </td>
                      </tr>
                    );
                  })}
                </React.Fragment>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 bg-muted/60 font-bold text-[11px]">
              <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2.5 border-r">Total</td>
              <td className="px-2 py-2.5 text-right tabular-nums text-muted-foreground bg-muted/40 border-r">
                {fmtCr(deptAnnualTotal(store, dept, "fy25Actual"))}
              </td>
              {MONTHS.map((_, mi) => {
                const t = deptMonthTotal(store, dept, mi, "budgeted");
                return (
                  <td key={mi} className={cn("px-1.5 py-2.5 text-right tabular-nums", CLOSED_MONTHS.includes(mi) && "bg-primary/5")}>
                    {t === 0 ? "—" : fmtL(t)}
                  </td>
                );
              })}
              <td className="px-2 py-2.5 text-right tabular-nums bg-muted/40 border-l">
                {fmtCr(deptAnnualTotal(store, dept, "budgeted"))}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="border-t px-4 py-2 text-[10px] text-muted-foreground">
        Values in ₹ Lakhs. Click <strong>+</strong> on any cost head to add free calculation rows below it — they roll up to the total line automatically.
        Type <code>=</code> in any cell for arithmetic (e.g. <code>=250*0.015</code> for 250 sqft × ₹1,500/sqft = ₹3.75L).
        {locked && "  Budget approved — click Revise to edit."}
      </p>
    </Card>
  );
}

// ─── vs actuals table ────────────────────────────────────────────────────────
function ActualsTable({ store, dept, lines }: {
  store: BudgetStore; dept: Department;
  lines: ReturnType<typeof deptLines>;
}) {
  const actualMonths = CLOSED_MONTHS;
  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/60 text-[10px] uppercase tracking-wide text-muted-foreground">
              <th className="sticky left-0 z-10 bg-muted/60 px-3 py-2 font-medium w-44 min-w-44 border-b border-r" rowSpan={2}>Cost head</th>
              {actualMonths.map((mi) => (
                <th key={mi} colSpan={2} className="px-2 py-1.5 text-center font-semibold border-b border-r border-border/50">{MONTHS[mi]}</th>
              ))}
              <th colSpan={3} className="px-2 py-1.5 text-center font-semibold border-b border-r bg-primary/5 text-primary/70">
                YTD ({MONTHS[actualMonths[0]]}–{MONTHS[actualMonths[actualMonths.length - 1]]})
              </th>
              <th colSpan={2} className="px-2 py-1.5 text-center font-semibold border-b bg-muted/60">Full Year</th>
            </tr>
            <tr className="bg-muted/40 border-b text-[10px] uppercase tracking-wide text-muted-foreground">
              {actualMonths.flatMap((mi) => [
                <th key={`${mi}-b`} className="px-2 py-1.5 text-right font-medium w-20 min-w-20">Bud</th>,
                <th key={`${mi}-a`} className="px-2 py-1.5 text-right font-medium w-20 min-w-20 border-r border-border/30">Act</th>,
              ])}
              <th className="px-2 py-1.5 text-right font-medium w-20 min-w-20 bg-primary/5">Budget</th>
              <th className="px-2 py-1.5 text-right font-medium w-20 min-w-20 bg-primary/5">Actual</th>
              <th className="px-2 py-1.5 text-right font-medium w-20 min-w-20 border-r bg-primary/5">Var</th>
              <th className="px-2 py-1.5 text-right font-medium w-20 min-w-20 bg-muted/60">FY26 Bud</th>
              <th className="px-2 py-1.5 font-medium w-32 min-w-32 bg-muted/60 pl-3">% Used</th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line, ri) => {
              const ytdBud = actualMonths.reduce((s, mi) => s + (line.budgeted[mi] ?? 0), 0);
              const ytdAct = actualMonths.reduce((s, mi) => s + (line.actuals[mi] ?? 0), 0);
              const ytdVar = ytdBud - ytdAct;
              const fyBud  = sumLine(line.budgeted);
              const pct    = fyBud > 0 ? (ytdAct / fyBud) * 100 : 0;
              return (
                <tr key={line.glHead} className={cn("border-b hover:bg-accent/20", ri % 2 === 0 ? "bg-background" : "bg-muted/10")}>
                  <td className="sticky left-0 z-10 bg-inherit px-3 py-2 font-medium border-r text-[11px]">{line.glHead}</td>
                  {actualMonths.flatMap((mi) => {
                    const mb = line.budgeted[mi] ?? 0;
                    const ma = line.actuals[mi] ?? 0;
                    const over = ma > mb && mb > 0;
                    return [
                      <td key={`${mi}-b`} className="px-2 py-2 text-right tabular-nums text-muted-foreground text-[11px]">{mb === 0 ? "—" : "₹" + fmtL(mb) + "L"}</td>,
                      <td key={`${mi}-a`} className={cn("px-2 py-2 text-right tabular-nums font-medium border-r border-border/20 text-[11px]", over ? "text-danger bg-danger/5" : ma > 0 ? "text-success" : "")}>
                        {ma === 0 ? "—" : "₹" + fmtL(ma) + "L"}
                      </td>,
                    ];
                  })}
                  <td className="px-2 py-2 text-right tabular-nums bg-primary/3 text-[11px]">{ytdBud === 0 ? "—" : "₹" + fmtL(ytdBud) + "L"}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums font-semibold bg-primary/3 text-[11px]", ytdVar < 0 && "text-danger")}>{ytdAct === 0 ? "—" : "₹" + fmtL(ytdAct) + "L"}</td>
                  <td className={cn("px-2 py-2 text-right tabular-nums font-semibold bg-primary/3 border-r text-[11px]", ytdVar >= 0 ? "text-success" : "text-danger")}>
                    {ytdAct === 0 ? "—" : (ytdVar >= 0 ? "+" : "") + fmtL(Math.abs(ytdVar)) + "L"}
                  </td>
                  <td className="px-2 py-2 text-right tabular-nums bg-muted/20 text-[11px]">{fyBud === 0 ? "—" : "₹" + fmtL(fyBud) + "L"}</td>
                  <td className="px-3 py-2 bg-muted/20"><UtilBar pct={pct} /></td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            {(() => {
              const ytdBud = actualMonths.reduce((s, mi) => s + deptMonthTotal(store, dept, mi, "budgeted"), 0);
              const ytdAct = actualMonths.reduce((s, mi) => s + deptMonthTotal(store, dept, mi, "actuals"), 0);
              const ytdVar = ytdBud - ytdAct;
              const fyBud  = deptAnnualTotal(store, dept, "budgeted");
              const pct    = fyBud > 0 ? (ytdAct / fyBud) * 100 : 0;
              return (
                <tr className="border-t-2 bg-muted/60 font-bold text-[11px]">
                  <td className="sticky left-0 z-10 bg-muted/60 px-3 py-2.5 border-r">Total</td>
                  {actualMonths.flatMap((mi) => {
                    const mb = deptMonthTotal(store, dept, mi, "budgeted");
                    const ma = deptMonthTotal(store, dept, mi, "actuals");
                    return [
                      <td key={`${mi}-b`} className="px-2 py-2.5 text-right tabular-nums text-muted-foreground">{fmtLDisp(mb)}</td>,
                      <td key={`${mi}-a`} className={cn("px-2 py-2.5 text-right tabular-nums font-bold border-r", ma > mb ? "text-danger" : "text-success")}>{fmtLDisp(ma)}</td>,
                    ];
                  })}
                  <td className="px-2 py-2.5 text-right tabular-nums bg-primary/5">{fmtLDisp(ytdBud)}</td>
                  <td className={cn("px-2 py-2.5 text-right tabular-nums font-bold bg-primary/5", ytdVar < 0 && "text-danger")}>{fmtLDisp(ytdAct)}</td>
                  <td className={cn("px-2 py-2.5 text-right tabular-nums font-bold bg-primary/5 border-r", ytdVar >= 0 ? "text-success" : "text-danger")}>
                    {(ytdVar >= 0 ? "+" : "") + fmtLDisp(Math.abs(ytdVar))}
                  </td>
                  <td className="px-2 py-2.5 text-right tabular-nums bg-muted/80">{fmtCr(fyBud)}</td>
                  <td className="px-3 py-2.5 bg-muted/80"><UtilBar pct={pct} /></td>
                </tr>
              );
            })()}
          </tfoot>
        </table>
      </div>
    </Card>
  );
}

function UtilBar({ pct }: { pct: number }) {
  const cap   = Math.min(pct, 100);
  const color = pct > 100 ? "bg-danger" : pct >= 90 ? "bg-warning" : pct >= 70 ? "bg-primary" : "bg-success";
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 rounded-full bg-muted overflow-hidden shrink-0">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${cap}%` }} />
      </div>
      <span className={cn("text-[11px] font-medium tabular-nums shrink-0", pct > 100 ? "text-danger" : pct >= 90 ? "text-warning" : "text-muted-foreground")}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

function Kpi({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="rounded-xl border bg-card p-3.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-xl font-bold tabular-nums">{value}</p>
      {sub && <p className={cn("mt-0.5 text-[11px]", subColor ?? "text-muted-foreground")}>{sub}</p>}
    </div>
  );
}
