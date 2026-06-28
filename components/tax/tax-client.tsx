"use client";

import * as React from "react";
import {
  Download,
  Lock,
  LockOpen,
  CheckCircle2,
  Clock,
  Undo2,
  Send,
  ShieldCheck,
  Banknote,
  ScrollText,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { cn, formatDate } from "@/lib/utils";
import { entityById } from "@/lib/accounting/org";
import { periodMovement } from "@/lib/accounting/ledger";
import type { ReportFilters } from "@/lib/accounting/types";
import { EMPLOYEES, employeeName } from "@/lib/hr/employees";
import { downloadCsv } from "@/lib/export";
import {
  outwardRows,
  inwardRows,
  inRange,
  scopeRows,
  sumHeads,
  hsnSummary,
  availableFYs,
  type OutwardRow,
  type InwardRow,
  type TaxScope,
} from "@/lib/tax/tax-data";
import { monthLabel, periodRange, stateName, headTotal, type HeadAmounts } from "@/lib/tax/gst";
import { gstr3bFor, gstr9For, reconFor, creditLedger, monthsInRange } from "@/lib/tax/returns";
import {
  loadFilings,
  saveFilings,
  filingState,
  isLocked,
  submitForReview,
  approveAndFile,
  canApprove,
  returnForRework,
  reopenFiled,
  loadItc,
  saveItc,
  loadTdsPayable,
  saveTdsPayable,
  loadTdsReceivable,
  saveTdsReceivable,
  loadCashDeposits,
  saveCashDeposits,
  allCashDeposits,
  FILING_META,
  RETURN_LABEL,
  type FilingStore,
  type ItcStore,
  type TdsPayableStore,
  type TdsReceivableStore,
  type CashDeposit,
  type ReturnKey,
} from "@/lib/tax/compliance";

// ---- report registry -------------------------------------------------------
type ReportKey =
  | "gstr1"
  | "hsn"
  | "gstr2b"
  | "gstr3b"
  | "gstr9"
  | "gstr9c"
  | "tdsPayable"
  | "tdsReceivable"
  | "msme"
  | "rcm"
  | "recon"
  | "cashLedger"
  | "creditLedger"
  | "review";

const GROUPS: { key: string; label: string; reports: ReportKey[] }[] = [
  { key: "gst", label: "GST returns", reports: ["gstr1", "hsn", "gstr2b", "gstr3b", "gstr9", "gstr9c"] },
  { key: "tds", label: "TDS & MSME", reports: ["tdsPayable", "tdsReceivable", "msme"] },
  { key: "other", label: "RCM & recon", reports: ["rcm", "recon"] },
  { key: "ledger", label: "Ledgers", reports: ["cashLedger", "creditLedger"] },
  { key: "review", label: "Review & lock", reports: ["review"] },
];

const REPORT_META: Record<ReportKey, { label: string; blurb: string }> = {
  gstr1: { label: "GSTR-1", blurb: "Outward supplies — B2B / B2C, invoice-wise." },
  hsn: { label: "HSN / SAC summary", blurb: "GSTR-1 Table 12 — outward supplies grouped by HSN/SAC & rate." },
  gstr2b: { label: "GSTR-2B (ITC)", blurb: "Inward supplies from registered vendors — eligible input tax credit." },
  gstr3b: { label: "GSTR-3B", blurb: "Monthly summary — output tax less ITC, with statutory set-off." },
  gstr9: { label: "GSTR-9 (annual)", blurb: "Annual consolidation of outward supplies, ITC and net liability." },
  gstr9c: { label: "GSTR-9C (reconciliation)", blurb: "Reconcile annual return turnover & ITC with audited P&L and books." },
  tdsPayable: { label: "TDS payable (26Q)", blurb: "TDS deducted on vendor payments — incl. sec.197 lower-deduction certificates." },
  tdsReceivable: { label: "TDS receivable (26AS)", blurb: "TDS withheld by customers on our fees — Form 16A credit." },
  msme: { label: "MSME vendors", blurb: "Micro & Small vendor dues — 45-day payment rule (MSMED sec.15 / 43B(h))." },
  rcm: { label: "Reverse charge (RCM)", blurb: "Inward supplies on which we self-pay GST, then claim as ITC." },
  recon: { label: "Books vs return", blurb: "Reconcile the books against what's been filed — gap = unfiled." },
  cashLedger: { label: "Electronic cash ledger", blurb: "GST cash deposits via challan & GSTR-3B settlements." },
  creditLedger: { label: "Electronic credit ledger", blurb: "ITC accrual and utilisation across filed periods." },
  review: { label: "Review & lock", blurb: "Maker-checker workflow to review, file and lock return periods." },
};

// ---- period selector model -------------------------------------------------
type PeriodSel = { kind: "month" | "fy" | "all"; value: string };

function rangeOf(sel: PeriodSel): { from: string; to: string } {
  if (sel.kind === "month") return periodRange("m:" + sel.value);
  if (sel.kind === "fy") return periodRange("fy:" + sel.value);
  return { from: "0000-00-00", to: "9999-99-99" };
}

const FIN_TEAM = EMPLOYEES.filter((e) => e.departmentId === "dep-fin");

export function TaxClient() {
  const prefs = usePrefs();
  const scope: TaxScope = { entityId: prefs.entityId };

  const [sel, setSel] = React.useState<PeriodSel>({ kind: "month", value: "2026-05" });
  const [group, setGroup] = React.useState("gst");
  const [report, setReport] = React.useState<ReportKey>("gstr1");
  const [limit, setLimit] = React.useState(60);
  const [actor, setActor] = React.useState("emp-009");

  // compliance stores
  const [filings, setFilings] = React.useState<FilingStore>({});
  const [itc, setItc] = React.useState<ItcStore>({});
  const [tdsp, setTdsp] = React.useState<TdsPayableStore>({});
  const [tdsr, setTdsr] = React.useState<TdsReceivableStore>({});
  const [cashUser, setCashUser] = React.useState<CashDeposit[]>([]);

  React.useEffect(() => {
    setFilings(loadFilings());
    setItc(loadItc());
    setTdsp(loadTdsPayable());
    setTdsr(loadTdsReceivable());
    setCashUser(loadCashDeposits());
  }, []);

  const now = () => new Date().toISOString();
  const itcHeld = (id: string) => itc[id]?.held ?? false;

  const months = React.useMemo(() => {
    // last 12 data months for the month picker
    return monthsInRange("2025-04-01", "2026-12-31");
  }, []);

  const { from, to } = rangeOf(sel);
  const month = sel.kind === "month" ? sel.value : null;

  // scoped, period-filtered datasets
  const outward = React.useMemo(() => scopeRows(inRange(outwardRows(), from, to), scope), [from, to, scope.entityId]);
  const inward = React.useMemo(() => scopeRows(inRange(inwardRows(), from, to), scope), [from, to, scope.entityId]);

  React.useEffect(() => setLimit(60), [report, sel.kind, sel.value, prefs.entityId]);

  // ---- KPI strip ----
  const outTax = sumHeads(outward).tax;
  const eligibleItc = sumHeads(inward.filter((r) => !r.rcm && r.itcEligible && !itcHeld(r.id))).tax;
  const netGst = Math.max(0, outTax - eligibleItc);
  const tdsPayablePending = inward.filter((r) => !(tdsp[r.id]?.deposited)).reduce((s, r) => s + r.tds, 0);

  // ---- mutators ----
  const persistFilings = (s: FilingStore) => {
    setFilings(s);
    saveFilings(s);
  };
  const toggleItc = (id: string, key: "claimed" | "held") => {
    setItc((prev) => {
      const cur = prev[id] ?? { claimed: false, held: false };
      const next = { ...prev, [id]: { ...cur, [key]: !cur[key] } };
      saveItc(next);
      return next;
    });
  };
  const setTdsDeposit = (id: string, deposited: boolean, challan?: string) => {
    setTdsp((prev) => {
      const next = { ...prev, [id]: { deposited, challan } };
      saveTdsPayable(next);
      return next;
    });
  };
  const setTdsCert = (id: string, certified: boolean, certNo?: string) => {
    setTdsr((prev) => {
      const next = { ...prev, [id]: { certified, certNo } };
      saveTdsReceivable(next);
      return next;
    });
  };
  const addDeposit = (d: CashDeposit) => {
    setCashUser((prev) => {
      const next = [...prev, d];
      saveCashDeposits(next);
      return next;
    });
  };

  const scopeName = prefs.entityId === "all" ? "All entities" : entityById(prefs.entityId)?.name ?? "—";
  const periodLabel = sel.kind === "month" ? monthLabel(sel.value) : sel.kind === "fy" ? `FY ${sel.value}` : "All periods";

  return (
    <>
      <PageHeader
        title="GST & TDS"
        subtitle="Returns, reconciliation and a maker-checker review & lock workflow — built straight off the books."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <ShieldCheck className="size-3.5" /> {scopeName} · {periodLabel}
          </Badge>
        }
      />

      {/* scope bar */}
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
        <Field label="Period type">
          <Select
            value={sel.kind}
            onChange={(e) => {
              const kind = e.target.value as PeriodSel["kind"];
              setSel(kind === "month" ? { kind, value: months[0] ?? "2026-05" } : kind === "fy" ? { kind, value: availableFYs()[0] } : { kind, value: "all" });
            }}
            className="h-9 w-36"
          >
            <option value="month">Month</option>
            <option value="fy">Financial year</option>
            <option value="all">All periods</option>
          </Select>
        </Field>
        {sel.kind === "month" && (
          <Field label="Return period">
            <Select value={sel.value} onChange={(e) => setSel({ kind: "month", value: e.target.value })} className="h-9 w-40">
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {sel.kind === "fy" && (
          <Field label="Financial year">
            <Select value={sel.value} onChange={(e) => setSel({ kind: "fy", value: e.target.value })} className="h-9 w-36">
              {availableFYs().map((f) => (
                <option key={f} value={f}>
                  FY {f}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <Field label="Acting as (review)">
          <Select value={actor} onChange={(e) => setActor(e.target.value)} className="h-9 w-52">
            {FIN_TEAM.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {e.designation}
              </option>
            ))}
          </Select>
        </Field>
        <p className="ml-auto self-center text-xs text-muted-foreground">
          Entity scope follows the top bar. Switch entity there to file per-GSTIN.
        </p>
      </Card>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label="Output tax" value={outTax} />
        <Kpi label="Eligible ITC" value={eligibleItc} />
        <Kpi label="Net GST (approx.)" value={netGst} accent />
        <Kpi label="TDS payable — pending" value={tdsPayablePending} />
      </div>

      {/* group tabs */}
      <div className="mb-3 flex flex-wrap gap-1">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            onClick={() => {
              setGroup(g.key);
              setReport(g.reports[0]);
            }}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              group === g.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
            )}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* report sub-tabs */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {GROUPS.find((g) => g.key === group)!.reports.map((rk) => (
          <button
            key={rk}
            onClick={() => setReport(rk)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              report === rk ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent",
            )}
          >
            {REPORT_META[rk].label}
          </button>
        ))}
      </div>

      <div className="mb-2 flex items-center gap-2">
        <h2 className="text-sm font-semibold">{REPORT_META[report].label}</h2>
        <p className="text-xs text-muted-foreground">{REPORT_META[report].blurb}</p>
      </div>

      {renderReport()}
    </>
  );

  // ---- report router -------------------------------------------------------
  function renderReport() {
    switch (report) {
      case "gstr1":
        return renderGstr1();
      case "hsn":
        return renderHsn();
      case "gstr2b":
        return renderGstr2b();
      case "gstr3b":
        return renderGstr3b();
      case "gstr9":
        return renderGstr9();
      case "gstr9c":
        return renderGstr9c();
      case "tdsPayable":
        return renderTdsPayable();
      case "tdsReceivable":
        return renderTdsReceivable();
      case "msme":
        return renderMsme();
      case "rcm":
        return renderRcm();
      case "recon":
        return renderRecon();
      case "cashLedger":
        return renderCashLedger();
      case "creditLedger":
        return renderCreditLedger();
      case "review":
        return renderReview();
    }
  }

  function MonthOnly() {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        Select a single <strong>month</strong> in the period type above to view this return.
      </Card>
    );
  }

  // ---- GSTR-1 --------------------------------------------------------------
  function renderGstr1() {
    const rows = outward;
    const shown = rows.slice(0, limit);
    const t = sumHeads(rows);
    return (
      <Card className="overflow-hidden">
        <TableToolbar
          count={rows.length}
          onExport={() =>
            downloadCsv(
              `gstr1-${periodLabel}`,
              ["Date", "Customer", "GSTIN", "Type", "Place of supply", "Nature", "HSN", "Rate", "Taxable", "CGST", "SGST/UTGST", "IGST"],
              rows.map((r) => [formatDate(r.date), r.customerName, r.customerGstin || "—", r.supplyType, stateName(r.placeOfSupply), r.nature, r.hsn, r.rate, r.taxable, r.cgst, r.sgst + r.utgst, r.igst]),
            )
          }
        />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <THead cols={["Date", "Customer", "Type", "POS", "HSN", "Rate", "Taxable", "CGST", "SGST/UTGST", "IGST"]} numFrom={6} />
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(r.date)}</td>
                  <td className="px-4 py-2">
                    <p className="font-medium">{r.customerName}</p>
                    <p className="font-mono text-[10px] text-muted-foreground">{r.customerGstin || "Unregistered"}</p>
                  </td>
                  <td className="px-4 py-2">
                    <Badge variant={r.supplyType === "B2B" ? "primary" : "default"}>{r.supplyType}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs">{stateName(r.placeOfSupply)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.hsn}</td>
                  <td className="px-4 py-2 text-right text-xs">{r.rate}%</td>
                  <Num v={r.taxable} />
                  <Num v={r.cgst} />
                  <Num v={r.sgst + r.utgst} />
                  <Num v={r.igst} />
                </tr>
              ))}
            </tbody>
            <TFoot label="Total" cols={[t.taxable, t.cgst, t.sgst + t.utgst, t.igst]} span={6} />
          </table>
        </div>
        <ShowMore shown={shown.length} total={rows.length} onMore={() => setLimit((l) => l + 100)} />
      </Card>
    );
  }

  // ---- HSN summary ---------------------------------------------------------
  function renderHsn() {
    const groups = hsnSummary(outward);
    const t = groups.reduce((a, g) => ({ taxable: a.taxable + g.taxable, cgst: a.cgst + g.cgst, sgst: a.sgst + g.sgst + g.utgst, igst: a.igst + g.igst }), { taxable: 0, cgst: 0, sgst: 0, igst: 0 });
    return (
      <Card className="overflow-hidden">
        <TableToolbar
          count={groups.length}
          onExport={() => downloadCsv(`hsn-${periodLabel}`, ["Code", "Kind", "Description", "Rate", "Lines", "Taxable", "CGST", "SGST/UTGST", "IGST"], groups.map((g) => [g.code, g.kind, g.desc, g.rate, g.lines, g.taxable, g.cgst, g.sgst + g.utgst, g.igst]))}
        />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <THead cols={["Code", "Description", "Rate", "Lines", "Taxable", "CGST", "SGST/UTGST", "IGST"]} numFrom={3} />
            <tbody>
              {groups.map((g) => (
                <tr key={`${g.code}-${g.rate}`} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2">
                    <span className="font-mono text-xs font-semibold">{g.code}</span>
                    <Badge variant="outline" className="ml-2">{g.kind}</Badge>
                  </td>
                  <td className="px-4 py-2 text-xs">{g.desc}</td>
                  <td className="px-4 py-2 text-right text-xs">{g.rate}%</td>
                  <td className="px-4 py-2 text-right text-xs tabular">{g.lines}</td>
                  <Num v={g.taxable} />
                  <Num v={g.cgst} />
                  <Num v={g.sgst + g.utgst} />
                  <Num v={g.igst} />
                </tr>
              ))}
            </tbody>
            <TFoot label="Total" cols={[t.taxable, t.cgst, t.sgst, t.igst]} span={4} />
          </table>
        </div>
      </Card>
    );
  }

  // ---- GSTR-2B -------------------------------------------------------------
  function renderGstr2b() {
    const rows = inward.filter((r) => !r.rcm);
    const shown = rows.slice(0, limit);
    const t = sumHeads(rows);
    return (
      <Card className="overflow-hidden">
        <TableToolbar
          count={rows.length}
          onExport={() => downloadCsv(`gstr2b-${periodLabel}`, ["Date", "Vendor", "GSTIN", "MSME", "HSN", "Rate", "Taxable", "Tax", "Eligible", "ITC status"], rows.map((r) => [formatDate(r.date), r.vendorName, r.vendorGstin, r.msme ? "Y" : "N", r.hsn, r.rate, r.taxable, r.tax, r.itcEligible ? "Y" : "N", itc[r.id]?.claimed ? "Claimed" : itc[r.id]?.held ? "Held" : "Pending"]))}
        />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <THead cols={["Date", "Vendor", "HSN", "Rate", "Taxable", "Tax", "ITC", "Action"]} numFrom={4} />
            <tbody>
              {shown.map((r) => {
                const f = itc[r.id] ?? { claimed: false, held: false };
                return (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(r.date)}</td>
                    <td className="px-4 py-2">
                      <p className="font-medium">{r.vendorName} {r.msme && <Badge variant="warning" className="ml-1">MSME</Badge>}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">{r.vendorGstin}</p>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{r.hsn}</td>
                    <td className="px-4 py-2 text-right text-xs">{r.rate}%</td>
                    <Num v={r.taxable} />
                    <Num v={r.tax} />
                    <td className="px-4 py-2 text-center">
                      {!r.itcEligible ? (
                        <Badge variant="danger">Blocked</Badge>
                      ) : f.held ? (
                        <Badge variant="warning">Held</Badge>
                      ) : f.claimed ? (
                        <Badge variant="success">Claimed</Badge>
                      ) : (
                        <Badge variant="default">Pending</Badge>
                      )}
                    </td>
                    <td className="px-4 py-2 text-right">
                      {r.itcEligible && (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant={f.claimed ? "secondary" : "outline"} className="h-7 px-2 text-xs" onClick={() => toggleItc(r.id, "claimed")}>
                            {f.claimed ? "Unclaim" : "Claim"}
                          </Button>
                          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => toggleItc(r.id, "held")}>
                            {f.held ? "Release" : "Hold"}
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <TFoot label="Total ITC" cols={[t.taxable, t.tax]} span={4} extra={2} />
          </table>
        </div>
        <ShowMore shown={shown.length} total={rows.length} onMore={() => setLimit((l) => l + 100)} />
      </Card>
    );
  }

  // ---- GSTR-3B -------------------------------------------------------------
  function renderGstr3b() {
    if (!month) return <MonthOnly />;
    const r = gstr3bFor(scope, month, itcHeld);
    const locked = isLocked(filings, "gstr3b", month);
    const HeadRow = ({ label, h, bold }: { label: string; h: HeadAmounts; bold?: boolean }) => (
      <tr className={cn("border-b last:border-0", bold && "font-semibold")}>
        <td className="px-4 py-2 text-sm">{label}</td>
        <Num v={h.igst} />
        <Num v={h.cgst} />
        <Num v={h.sgst} />
        <Num v={headTotal(h)} />
      </tr>
    );
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">3.1 Tax on outward & RCM supplies</h3>
            {locked ? <Badge variant="success"><Lock className="size-3" /> Locked</Badge> : <Badge variant="default">Open</Badge>}
          </div>
          <table className="w-full text-sm">
            <THead cols={["Description", "IGST", "CGST", "SGST", "Total"]} numFrom={1} />
            <tbody>
              <HeadRow label="(a) Outward taxable supplies" h={r.outputTax} />
              <HeadRow label="(d) Inward — reverse charge" h={r.rcmTax} />
              <HeadRow label="Total output liability" h={r.liability} bold />
            </tbody>
          </table>
          <div className="grid grid-cols-2 gap-px bg-border text-sm">
            <Stat label="Taxable turnover" v={r.taxableOutward} />
            <Stat label="Exempt / zero-rated" v={r.exemptOutward} />
          </div>
        </Card>

        <Card className="overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-2.5">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">4 / 6.1 ITC set-off & net payable</h3>
          </div>
          <table className="w-full text-sm">
            <THead cols={["Description", "IGST", "CGST", "SGST", "Total"]} numFrom={1} />
            <tbody>
              <HeadRow label="ITC available" h={r.itcAvailable} />
              <HeadRow label="Credit utilised" h={r.setoff.creditUsed} />
              <HeadRow label="Cash payable" h={r.setoff.cashPayable} bold />
              <HeadRow label="Credit carried forward" h={r.setoff.creditLeft} />
            </tbody>
          </table>
          <div className="flex items-center justify-between border-t px-4 py-3">
            <span className="text-sm font-medium">Net payable in cash (incl. RCM)</span>
            <Money value={r.netCash} className="text-lg font-bold" />
          </div>
        </Card>

        <Card className="lg:col-span-2 flex items-center justify-between p-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="size-4" />
            Filing &amp; locking for <strong className="text-foreground">{monthLabel(month)}</strong> is handled in the
            <Badge variant="outline" className="mx-1">Review &amp; lock</Badge> tab.
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                const { downloadGstr3bPdf } = await import("@/lib/pdf/gstr3b-pdf");
                downloadGstr3bPdf({
                  scopeName,
                  periodLabel,
                  gstin: prefs.entityId === "all" ? undefined : entityById(prefs.entityId)?.gstin,
                  r,
                });
              }}
            >
              <Download className="size-4" /> PDF
            </Button>
            <Button variant="outline" size="sm" onClick={() => { setGroup("review"); setReport("review"); }}>
              <ShieldCheck className="size-4" /> Go to review
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // ---- GSTR-9 (expanded annual return) ------------------------------------
  function renderGstr9() {
    const fy = sel.kind === "fy" ? sel.value : "2025-26";
    const g = gstr9For(scope, fy);
    const { from, to } = periodRange("fy:" + fy);
    const out = scopeRows(inRange(outwardRows(), from, to), scope);
    const inw = scopeRows(inRange(inwardRows(), from, to), scope);

    const b2b = out.filter((r) => r.supplyType === "B2B");
    const b2c = out.filter((r) => r.supplyType === "B2C");
    const exports = out.filter((r) => r.nature === "export");
    const rcmRows = inw.filter((r) => r.rcm);
    const itcRows = inw.filter((r) => r.itcEligible);
    const itcBlocked = inw.filter((r) => !r.itcEligible);
    const hsnOut = hsnSummary(out);

    const t = sumHeads(out);
    const itcT = sumHeads(itcRows);
    const rcmT = sumHeads(rcmRows);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Annual return — FY <strong className="text-foreground">{fy}</strong>.
            {sel.kind !== "fy" && " Select a financial year above to switch."}
          </p>
          <Button variant="outline" size="sm" onClick={async () => { const { downloadGstr3bPdf } = await import("@/lib/pdf/gstr3b-pdf"); downloadGstr3bPdf({ scopeName, periodLabel: `FY ${fy}`, gstin: scope.entityId === "all" ? undefined : entityById(scope.entityId)?.gstin, r: gstr3bFor(scope, monthsInRange(from, to)[0] ?? "2026-01", itcHeld) }); }}>
            <Download className="size-4" /> PDF
          </Button>
        </div>

        {/* Part II — Outward supplies */}
        <Card className="overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Part II — Outward supplies declared in FY {fy}
          </div>
          <table className="w-full text-sm">
            <THead cols={["Supply type", "Invoices", "Taxable value", "IGST", "CGST", "SGST/UTGST"]} numFrom={1} />
            <tbody>
              <tr className="border-b hover:bg-accent/40">
                <td className="px-4 py-2">4A — B2B taxable (excl. zero-rated)</td>
                <td className="px-4 py-2 text-right tabular">{b2b.length}</td>
                <Num v={sumHeads(b2b).taxable} />
                <Num v={sumHeads(b2b).igst} />
                <Num v={sumHeads(b2b).cgst} />
                <Num v={sumHeads(b2b).sgst + sumHeads(b2b).utgst} />
              </tr>
              <tr className="border-b hover:bg-accent/40">
                <td className="px-4 py-2">4B — B2C large (inter-state &gt; ₹2.5L)</td>
                <td className="px-4 py-2 text-right tabular">{b2c.filter(r => r.nature === "inter").length}</td>
                <Num v={sumHeads(b2c.filter(r => r.nature === "inter")).taxable} />
                <Num v={sumHeads(b2c.filter(r => r.nature === "inter")).igst} />
                <Num v={0} />
                <Num v={0} />
              </tr>
              <tr className="border-b hover:bg-accent/40">
                <td className="px-4 py-2">5 — Zero-rated / export supplies</td>
                <td className="px-4 py-2 text-right tabular">{exports.length}</td>
                <Num v={sumHeads(exports).taxable} />
                <Num v={0} />
                <Num v={0} />
                <Num v={0} />
              </tr>
              <tr className="border-b hover:bg-accent/40">
                <td className="px-4 py-2">7D — Reverse charge inward (RCM)</td>
                <td className="px-4 py-2 text-right tabular">{rcmRows.length}</td>
                <Num v={rcmT.taxable} />
                <Num v={rcmT.igst} />
                <Num v={rcmT.cgst} />
                <Num v={rcmT.sgst + rcmT.utgst} />
              </tr>
            </tbody>
            <TFoot label="Total outward (Table 5)" cols={[t.taxable, t.igst, t.cgst, t.sgst + t.utgst]} span={2} />
          </table>
        </Card>

        {/* Part III — ITC */}
        <Card className="overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Part III — Input Tax Credit (ITC) details for FY {fy}
          </div>
          <table className="w-full text-sm">
            <THead cols={["ITC category", "IGST", "CGST", "SGST/UTGST", "Total"]} numFrom={1} />
            <tbody>
              <tr className="border-b hover:bg-accent/40">
                <td className="px-4 py-2">6A — ITC from GSTR-2B (imports + supplier-filed)</td>
                <Num v={itcT.igst} /><Num v={itcT.cgst} /><Num v={itcT.sgst + itcT.utgst} /><Num v={itcT.tax} />
              </tr>
              <tr className="border-b hover:bg-accent/40">
                <td className="px-4 py-2">6B — ITC on reverse charge (self-paid GST)</td>
                <Num v={rcmT.igst} /><Num v={rcmT.cgst} /><Num v={rcmT.sgst + rcmT.utgst} /><Num v={rcmT.tax} />
              </tr>
              <tr className="border-b hover:bg-accent/40">
                <td className="px-4 py-2 text-muted-foreground">7H — ITC reversed / blocked (sec. 17(5))</td>
                <Num v={sumHeads(itcBlocked).igst} /><Num v={sumHeads(itcBlocked).cgst} /><Num v={sumHeads(itcBlocked).sgst + sumHeads(itcBlocked).utgst} /><Num v={sumHeads(itcBlocked).tax} />
              </tr>
            </tbody>
            <TFoot label="Net ITC availed" cols={[itcT.igst + rcmT.igst, itcT.cgst + rcmT.cgst, itcT.sgst + rcmT.sgst + itcT.utgst + rcmT.utgst, itcT.tax + rcmT.tax]} span={1} />
          </table>
        </Card>

        {/* Part IV — Tax paid summary */}
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Output tax (FY)" value={g.outputTax} />
          <Kpi label="ITC availed (FY)" value={g.itc} />
          <Kpi label="Net GST liability" value={g.net} accent />
        </div>

        {/* Table 17 — HSN summary */}
        <Card className="overflow-hidden">
          <TableToolbar
            count={hsnOut.length}
            onExport={() => downloadCsv(`gstr9-hsn-FY${fy}`, ["HSN", "Description", "Rate", "Lines", "Taxable", "IGST", "CGST", "SGST/UTGST"], hsnOut.map((g) => [g.code, g.desc, g.rate, g.lines, g.taxable, g.igst, g.cgst, g.sgst + g.utgst]))}
          />
          <div className="border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">Table 17 — HSN-wise summary of outward supplies</div>
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <THead cols={["HSN / SAC", "Description", "Rate", "Lines", "Taxable", "IGST", "CGST", "SGST/UTGST"]} numFrom={2} />
              <tbody>
                {hsnOut.slice(0, limit).map((g) => (
                  <tr key={`${g.code}-${g.rate}`} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2 font-mono text-xs font-semibold">{g.code}</td>
                    <td className="px-4 py-2 text-xs">{g.desc}</td>
                    <td className="px-4 py-2 text-right text-xs">{g.rate}%</td>
                    <td className="px-4 py-2 text-right tabular text-xs">{g.lines}</td>
                    <Num v={g.taxable} /><Num v={g.igst} /><Num v={g.cgst} /><Num v={g.sgst + g.utgst} />
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ShowMore shown={Math.min(limit, hsnOut.length)} total={hsnOut.length} onMore={() => setLimit(l => l + 50)} />
        </Card>
      </div>
    );
  }

  // ---- GSTR-9C (reconciliation statement) ---------------------------------
  function renderGstr9c() {
    const fy = sel.kind === "fy" ? sel.value : "2025-26";
    const { from, to } = periodRange("fy:" + fy);
    const g9 = gstr9For(scope, fy);

    // Pull GL balances for the same period
    const glF: ReportFilters = {
      entityId: scope.entityId,
      locationId: "all",
      state: "all",
      basis: "accrual",
      from,
      to,
    };
    const mv = periodMovement(glF);

    // Revenue per books (credit-normal accounts, so negate)
    const glRevenue =
      -(mv.get("4010") ?? 0) +
      -(mv.get("4020") ?? 0) +
      -(mv.get("4030") ?? 0) -
      (mv.get("4040") ?? 0); // 4040 = Sales Returns (debit-normal contra)

    // ITC per books (GST Input 1300, debit-normal)
    const glItc = mv.get("1300") ?? 0;

    // GST Output per books (2100, credit-normal)
    const glOutputTax = -(mv.get("2100") ?? 0);

    const g9Turnover = g9.rows.filter(r => r.label !== "Total ITC availed").reduce((s, r) => s + r.taxable, 0);
    const turnoverGap = g9Turnover - glRevenue;
    const itcGap = g9.itc - glItc;
    const outputTaxGap = g9.outputTax - glOutputTax;

    const Row = ({ label, a, b, gap, sub }: { label: string; a: number; b: number; gap: number; sub?: boolean }) => (
      <tr className={cn("border-b last:border-0", sub ? "text-muted-foreground" : "hover:bg-accent/40")}>
        <td className={cn("px-4 py-2.5 text-sm", sub && "pl-8 text-xs")}>{label}</td>
        <Num v={a} />
        <Num v={b} />
        <td className="px-4 py-2.5 text-right">
          <Money value={gap} className={cn("font-semibold tabular text-sm", Math.abs(gap) < 1 ? "text-success" : "text-warning")} />
        </td>
      </tr>
    );

    return (
      <div className="space-y-4">
        <Card className="border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground">
          <strong className="text-foreground">GSTR-9C</strong> — Reconciliation statement (comparable to a CA certificate) for FY {fy}.
          Compares the annual return (GSTR-9) figures with the audited books. Unreconciled gaps flag items needing explanation before filing.
        </Card>

        {/* Pt. II — Turnover reconciliation */}
        <Card className="overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Part II — Reconciliation of turnover declared in GSTR-9 with audited financials
          </div>
          <table className="w-full text-sm">
            <THead cols={["Particulars", "As per GSTR-9", "As per books (GL)", "Difference"]} numFrom={1} />
            <tbody>
              <Row label="5A — Annual turnover (taxable + exempt)" a={g9Turnover} b={glRevenue} gap={turnoverGap} />
              <Row label="Less: Credit notes issued during FY" a={0} b={0} gap={0} sub />
              <Row label="Less: Advances adjusted during FY" a={0} b={0} gap={0} sub />
              <Row label="Net turnover after adjustments" a={g9Turnover} b={glRevenue} gap={turnoverGap} />
            </tbody>
          </table>
          {Math.abs(turnoverGap) < 1 && (
            <div className="border-t bg-success/5 px-4 py-2 text-xs text-success">
              ✓ Turnover reconciles — no gap between annual return and audited P&L.
            </div>
          )}
          {Math.abs(turnoverGap) >= 1 && (
            <div className="border-t bg-warning/5 px-4 py-2 text-xs text-warning">
              Difference of <Money value={Math.abs(turnoverGap)} className="inline font-semibold" /> requires explanation (timing, cancellations, or missing entries in one source).
            </div>
          )}
        </Card>

        {/* Pt. III — ITC reconciliation */}
        <Card className="overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Part III — Reconciliation of ITC declared in annual return with ITC per books
          </div>
          <table className="w-full text-sm">
            <THead cols={["Particulars", "As per GSTR-9", "As per books (1300)", "Difference"]} numFrom={1} />
            <tbody>
              <Row label="12A — ITC availed as per annual return" a={g9.itc} b={glItc} gap={itcGap} />
              <Row label="12B — ITC as per GSTR-2B (filed suppliers)" a={g9.itc} b={g9.itc} gap={0} sub />
              <Row label="12C — Difference (ineligible / timing)" a={0} b={Math.max(0, glItc - g9.itc)} gap={Math.max(0, glItc - g9.itc)} sub />
            </tbody>
          </table>
        </Card>

        {/* Pt. IV — Tax paid reconciliation */}
        <Card className="overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Part IV — Reconciliation of tax amount payable and paid
          </div>
          <table className="w-full text-sm">
            <THead cols={["Particulars", "As per GSTR-9", "As per books (2100)", "Difference"]} numFrom={1} />
            <tbody>
              <Row label="14 — Output tax payable" a={g9.outputTax} b={glOutputTax} gap={outputTaxGap} />
              <Row label="14 — ITC set-off" a={g9.itc} b={glItc} gap={itcGap} />
              <Row label="14 — Net cash payable" a={Math.max(0, g9.net)} b={Math.max(0, glOutputTax - glItc)} gap={Math.max(0, g9.net) - Math.max(0, glOutputTax - glItc)} />
            </tbody>
          </table>
        </Card>

        {/* Summary KPIs */}
        <div className="grid grid-cols-3 gap-3">
          <Kpi label="Turnover gap" value={Math.abs(turnoverGap)} accent={Math.abs(turnoverGap) > 0} />
          <Kpi label="ITC gap" value={Math.abs(itcGap)} accent={Math.abs(itcGap) > 0} />
          <Kpi label="Tax gap" value={Math.abs(outputTaxGap)} accent={Math.abs(outputTaxGap) > 0} />
        </div>
      </div>
    );
  }

  // ---- TDS payable (26Q) ---------------------------------------------------
  function renderTdsPayable() {
    const rows = inward;
    const shown = rows.slice(0, limit);
    const totalTds = rows.reduce((s, r) => s + r.tds, 0);
    const pending = rows.filter((r) => !tdsp[r.id]?.deposited).reduce((s, r) => s + r.tds, 0);
    const ldcRows = rows.filter((r) => r.ldc);
    // Tax saved by the lower-deduction certificates vs the statutory section rate.
    const ldcSaving = ldcRows.reduce((s, r) => s + (r.taxable * (r.tdsBaseRate - r.tdsRate)) / 100, 0);
    return (
      <>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="TDS deducted" value={totalTds} />
          <Kpi label="Deposited" value={totalTds - pending} />
          <Kpi label="Pending challan" value={pending} accent />
          <Kpi label="Saved via 197 LDC" value={ldcSaving} />
        </div>
        <Card className="overflow-hidden">
          <TableToolbar count={rows.length} onExport={() => downloadCsv(`tds-payable-${periodLabel}`, ["Date", "Vendor", "PAN", "Section", "Base", "Section rate", "Applied rate", "LDC cert", "TDS", "Net payable", "Status", "Challan"], rows.map((r) => [formatDate(r.date), r.vendorName, r.vendorPan, r.tdsSection, r.taxable, r.tdsBaseRate, r.tdsRate, r.ldcCertNo ?? "", r.tds, r.netPayable, tdsp[r.id]?.deposited ? "Deposited" : "Pending", tdsp[r.id]?.challan ?? ""]))} />
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <THead cols={["Date", "Vendor", "Section", "Base", "Rate", "TDS", "Net pay", "Status", "Action"]} numFrom={3} />
              <tbody>
                {shown.map((r) => {
                  const dep = tdsp[r.id]?.deposited;
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(r.date)}</td>
                      <td className="px-4 py-2">
                        <p className="font-medium">{r.vendorName}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">PAN {r.vendorPan}</p>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant="outline">{r.tdsSection}</Badge>
                        {r.ldc && <Badge variant="primary" className="ml-1 text-[9px]" title={`Lower-deduction certificate ${r.ldcCertNo}`}>197 LDC</Badge>}
                      </td>
                      <Num v={r.taxable} />
                      <td className="px-4 py-2 text-right text-xs">
                        {r.ldc ? (
                          <span className="flex items-center justify-end gap-1">
                            <span className="text-muted-foreground line-through">{r.tdsBaseRate}%</span>
                            <span className="font-semibold text-primary">{r.tdsRate}%</span>
                          </span>
                        ) : (
                          <>{r.tdsRate}%</>
                        )}
                      </td>
                      <Num v={r.tds} />
                      <Num v={r.netPayable} />
                      <td className="px-4 py-2 text-center">{dep ? <Badge variant="success">Deposited</Badge> : <Badge variant="default">Pending</Badge>}</td>
                      <td className="px-4 py-2 text-right">
                        <Button size="sm" variant={dep ? "ghost" : "outline"} className="h-7 px-2 text-xs" onClick={() => setTdsDeposit(r.id, !dep, dep ? undefined : `CIN${r.id.replace(/\D/g, "")}`)}>
                          {dep ? "Undo" : "Deposit"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ShowMore shown={shown.length} total={rows.length} onMore={() => setLimit((l) => l + 100)} />
        </Card>
      </>
    );
  }

  // ---- MSME vendor dues (45-day rule) --------------------------------------
  function renderMsme() {
    const rows = inward.filter((r) => r.msme);
    const shown = rows.slice(0, limit);
    const nowMs = Date.now();
    const DAY = 86_400_000;
    // 45-day payment limit from the bill date (MSMED sec.15; sec.43B(h) ties the
    // deduction to actual payment within the limit).
    const enrich = (r: (typeof rows)[number]) => {
      const due = new Date(new Date(r.date).getTime() + 45 * DAY);
      const daysLeft = Math.round((due.getTime() - nowMs) / DAY);
      return { due: due.toISOString().slice(0, 10), daysLeft, overdue: daysLeft < 0 };
    };
    const total = rows.reduce((s, r) => s + r.gross, 0);
    const overdueRows = rows.filter((r) => enrich(r).overdue);
    const overdue = overdueRows.reduce((s, r) => s + r.gross, 0);
    const micro = rows.filter((r) => r.msmeClass === "Micro").reduce((s, r) => s + r.gross, 0);
    const small = rows.filter((r) => r.msmeClass === "Small").reduce((s, r) => s + r.gross, 0);
    const csvRows = rows.map((r) => {
      const e = enrich(r);
      return [formatDate(r.date), r.vendorName, r.msmeClass ?? "MSME", r.invoiceNo, r.taxable, r.gross, e.due, e.daysLeft, e.overdue ? "Overdue" : "Within limit"];
    });
    return (
      <>
        <Card className="mb-3 border-warning/30 bg-warning/5 p-3 text-xs text-muted-foreground">
          Micro &amp; Small enterprise dues must be settled within <strong className="text-foreground">45 days</strong> of the bill.
          Amounts unpaid beyond the limit are disallowed under <strong className="text-foreground">sec.43B(h)</strong> until actually paid.
        </Card>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="MSME purchases" value={total} />
          <Kpi label="Micro" value={micro} />
          <Kpi label="Small" value={small} />
          <Kpi label="Beyond 45 days" value={overdue} accent />
        </div>
        <Card className="overflow-hidden">
          <TableToolbar count={rows.length} onExport={() => downloadCsv(`msme-${periodLabel}`, ["Date", "Vendor", "Class", "Bill no", "Taxable", "Invoice value", "Due (45d)", "Days left", "Status"], csvRows)} />
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <THead cols={["Date", "Vendor", "Class", "Bill no", "Taxable", "Invoice value", "Due (45d)", "Status"]} numFrom={4} />
              <tbody>
                {shown.map((r) => {
                  const e = enrich(r);
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(r.date)}</td>
                      <td className="px-4 py-2 font-medium">{r.vendorName}</td>
                      <td className="px-4 py-2"><Badge variant={r.msmeClass === "Micro" ? "primary" : "warning"}>{r.msmeClass ?? "MSME"}</Badge></td>
                      <td className="px-4 py-2 font-mono text-xs">{r.invoiceNo}</td>
                      <Num v={r.taxable} />
                      <Num v={r.gross} />
                      <td className="px-4 py-2 text-right text-xs">{formatDate(e.due)}</td>
                      <td className="px-4 py-2 text-center">
                        {e.overdue ? <Badge variant="danger">Overdue {Math.abs(e.daysLeft)}d</Badge> : <Badge variant="success">{e.daysLeft}d left</Badge>}
                      </td>
                    </tr>
                  );
                })}
                {rows.length === 0 && <EmptyRow span={8} />}
              </tbody>
            </table>
          </div>
          <ShowMore shown={shown.length} total={rows.length} onMore={() => setLimit((l) => l + 100)} />
        </Card>
      </>
    );
  }

  // ---- TDS receivable (26AS) ----------------------------------------------
  function renderTdsReceivable() {
    const rows = outward.filter((r) => r.tdsReceivable > 0);
    const shown = rows.slice(0, limit);
    const total = rows.reduce((s, r) => s + r.tdsReceivable, 0);
    const awaited = rows.filter((r) => !tdsr[r.id]?.certified).reduce((s, r) => s + r.tdsReceivable, 0);
    return (
      <>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Kpi label="TDS withheld on our fees" value={total} />
          <Kpi label="Form 16A received" value={total - awaited} />
          <Kpi label="Awaiting certificate" value={awaited} accent />
        </div>
        <Card className="overflow-hidden">
          <TableToolbar count={rows.length} onExport={() => downloadCsv(`tds-receivable-${periodLabel}`, ["Date", "Customer", "GSTIN", "Base", "Rate", "TDS", "Status", "Cert"], rows.map((r) => [formatDate(r.date), r.customerName, r.customerGstin, r.taxable, "10%", r.tdsReceivable, tdsr[r.id]?.certified ? "Certified" : "Awaited", tdsr[r.id]?.certNo ?? ""]))} />
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <THead cols={["Date", "Customer", "Base", "Rate", "TDS (194J)", "Status", "Action"]} numFrom={2} />
              <tbody>
                {shown.map((r) => {
                  const cert = tdsr[r.id]?.certified;
                  return (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
                      <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(r.date)}</td>
                      <td className="px-4 py-2">
                        <p className="font-medium">{r.customerName}</p>
                        <p className="font-mono text-[10px] text-muted-foreground">{r.customerGstin}</p>
                      </td>
                      <Num v={r.taxable} />
                      <td className="px-4 py-2 text-right text-xs">10%</td>
                      <Num v={r.tdsReceivable} />
                      <td className="px-4 py-2 text-center">{cert ? <Badge variant="success">Certified</Badge> : <Badge variant="default">Awaited</Badge>}</td>
                      <td className="px-4 py-2 text-right">
                        <Button size="sm" variant={cert ? "ghost" : "outline"} className="h-7 px-2 text-xs" onClick={() => setTdsCert(r.id, !cert, cert ? undefined : `16A/${r.id.slice(-4)}`)}>
                          {cert ? "Undo" : "Record 16A"}
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <ShowMore shown={shown.length} total={rows.length} onMore={() => setLimit((l) => l + 100)} />
        </Card>
      </>
    );
  }

  // ---- RCM -----------------------------------------------------------------
  function renderRcm() {
    const rows = inward.filter((r) => r.rcm);
    const t = sumHeads(rows);
    return (
      <Card className="overflow-hidden">
        <TableToolbar count={rows.length} onExport={() => downloadCsv(`rcm-${periodLabel}`, ["Date", "Vendor", "HSN", "Rate", "Taxable", "CGST", "SGST/UTGST", "IGST"], rows.map((r) => [formatDate(r.date), r.vendorName, r.hsn, r.rate, r.taxable, r.cgst, r.sgst + r.utgst, r.igst]))} />
        <div className="border-b bg-warning/10 px-4 py-2 text-xs text-muted-foreground">
          Self-pay GST in cash on these inward supplies (sec. 9(3)/9(4)), then claim the same as ITC — net cash impact nil but reportable.
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <THead cols={["Date", "Vendor", "Supply", "HSN", "Rate", "Taxable", "CGST", "SGST/UTGST", "IGST"]} numFrom={5} />
            <tbody>
              {rows.slice(0, limit).map((r) => (
                <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(r.date)}</td>
                  <td className="px-4 py-2 font-medium">{r.vendorName}</td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{r.desc}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.hsn}</td>
                  <td className="px-4 py-2 text-right text-xs">{r.rate}%</td>
                  <Num v={r.taxable} />
                  <Num v={r.cgst} />
                  <Num v={r.sgst + r.utgst} />
                  <Num v={r.igst} />
                </tr>
              ))}
              {rows.length === 0 && <EmptyRow span={9} />}
            </tbody>
            <TFoot label="Total RCM" cols={[t.taxable, t.cgst, t.sgst + t.utgst, t.igst]} span={5} />
          </table>
        </div>
      </Card>
    );
  }

  // ---- Books vs return -----------------------------------------------------
  function renderRecon() {
    const lines = reconFor(scope, from, to, filings);
    return (
      <Card className="overflow-hidden">
        <div className="border-b bg-muted/40 px-4 py-2.5 text-xs text-muted-foreground">
          Books = everything recognised in the period. Return = the portion sitting in a <strong>filed &amp; locked</strong> period. The gap is what's still to be filed.
        </div>
        <table className="w-full text-sm">
          <THead cols={["Particulars", "As per books", "Reported in return", "Gap"]} numFrom={1} />
          <tbody>
            {lines.map((l) => (
              <tr key={l.label} className="border-b last:border-0 hover:bg-accent/40">
                <td className="px-4 py-2.5">{l.label}</td>
                <Num v={l.books} />
                <Num v={l.ret} />
                <td className="px-4 py-2.5 text-right">
                  <Money value={l.gap} className={cn("font-semibold tabular", l.gap > 0 && "text-warning", l.gap === 0 && "text-success")} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    );
  }

  // ---- Electronic cash ledger ----------------------------------------------
  function renderCashLedger() {
    const deposits = allCashDeposits(cashUser);
    // settlements from filed 3B months in range
    const settleMonths = monthsInRange(from === "0000-00-00" ? "2025-04-01" : from, to === "9999-99-99" ? "2026-12-31" : to)
      .filter((m) => isLocked(filings, "gstr3b", m));
    type LedgerRow = { date: string; kind: "deposit" | "settlement"; ref: string; igst: number; cgst: number; sgst: number };
    const entries: LedgerRow[] = [
      ...deposits.map((d) => ({ date: d.date, kind: "deposit" as const, ref: d.ref, igst: d.igst, cgst: d.cgst, sgst: d.sgst })),
      ...settleMonths.map((m) => {
        const r = gstr3bFor(scope, m, itcHeld);
        const c = r.setoff.cashPayable;
        return { date: `${m}-20`, kind: "settlement" as const, ref: `GSTR-3B ${monthLabel(m)}`, igst: -c.igst, cgst: -c.cgst, sgst: -c.sgst };
      }),
    ].sort((a, b) => a.date.localeCompare(b.date));
    const bal = entries.reduce((a, e) => ({ igst: a.igst + e.igst, cgst: a.cgst + e.cgst, sgst: a.sgst + e.sgst }), { igst: 0, cgst: 0, sgst: 0 });

    return (
      <>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="IGST balance" value={bal.igst} />
          <Kpi label="CGST balance" value={bal.cgst} />
          <Kpi label="SGST balance" value={bal.sgst} />
          <Kpi label="Total cash" value={bal.igst + bal.cgst + bal.sgst} accent />
        </div>
        <DepositForm onAdd={addDeposit} />
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <THead cols={["Date", "Type", "Reference", "IGST", "CGST", "SGST"]} numFrom={3} />
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(e.date)}</td>
                  <td className="px-4 py-2">{e.kind === "deposit" ? <Badge variant="success">Deposit</Badge> : <Badge variant="warning">3B settlement</Badge>}</td>
                  <td className="px-4 py-2 font-mono text-xs">{e.ref}</td>
                  <Num v={e.igst} signed />
                  <Num v={e.cgst} signed />
                  <Num v={e.sgst} signed />
                </tr>
              ))}
              {entries.length === 0 && <EmptyRow span={6} />}
            </tbody>
          </table>
        </Card>
      </>
    );
  }

  // ---- Electronic credit ledger --------------------------------------------
  function renderCreditLedger() {
    const { entries, balance } = creditLedger(scope, filings, itcHeld);
    return (
      <>
        <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Kpi label="IGST credit" value={balance.igst} />
          <Kpi label="CGST credit" value={balance.cgst} />
          <Kpi label="SGST credit" value={balance.sgst} />
          <Kpi label="Total ITC balance" value={headTotal(balance)} accent />
        </div>
        <Card className="overflow-hidden">
          <div className="border-b bg-muted/40 px-4 py-2 text-xs text-muted-foreground">Derived from filed GSTR-3B periods — accruals on eligible ITC, utilisation on set-off.</div>
          <table className="w-full text-sm">
            <THead cols={["Date", "Type", "Reference", "IGST", "CGST", "SGST"]} numFrom={3} />
            <tbody>
              {entries.map((e, i) => (
                <tr key={i} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(e.date)}</td>
                  <td className="px-4 py-2">{e.kind === "accrual" ? <Badge variant="success">ITC accrued</Badge> : <Badge variant="warning">Utilised</Badge>}</td>
                  <td className="px-4 py-2 font-mono text-xs">{e.ref}</td>
                  <Num v={e.igst} signed />
                  <Num v={e.cgst} signed />
                  <Num v={e.sgst} signed />
                </tr>
              ))}
              {entries.length === 0 && <EmptyRow span={6} />}
            </tbody>
          </table>
        </Card>
      </>
    );
  }

  // ---- Review & lock (maker-checker) ---------------------------------------
  function renderReview() {
    if (!month) return <MonthOnly />;
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        {(["gstr1", "gstr3b"] as ReturnKey[]).map((rk) => (
          <ReviewCard key={rk} rk={rk} month={month} />
        ))}
      </div>
    );
  }

  function ReviewCard({ rk, month }: { rk: ReturnKey; month: string }) {
    const st = filingState(filings, rk, month);
    const meta = FILING_META[st.status];
    const [arn, setArn] = React.useState("");
    const [note, setNote] = React.useState("");

    // figure preview
    const r3b = gstr3bFor(scope, month, itcHeld);
    const out = sumHeads(outward.filter((r) => r.period === month));

    return (
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b bg-muted/40 px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold">{RETURN_LABEL[rk]} — {monthLabel(month)}</h3>
            <p className="text-xs text-muted-foreground">{scopeName}</p>
          </div>
          <Badge variant={meta.variant} className="gap-1">
            {st.status === "filed" ? <Lock className="size-3" /> : st.status === "in_review" ? <Clock className="size-3" /> : <LockOpen className="size-3" />}
            {meta.label}
          </Badge>
        </div>

        {/* figure preview */}
        <div className="grid grid-cols-3 gap-px bg-border text-sm">
          {rk === "gstr1" ? (
            <>
              <Stat label="Invoices" v={null} text={String(outward.filter((r) => r.period === month).length)} />
              <Stat label="Taxable" v={out.taxable} />
              <Stat label="Output tax" v={out.tax} />
            </>
          ) : (
            <>
              <Stat label="Liability" v={headTotal(r3b.liability)} />
              <Stat label="ITC used" v={headTotal(r3b.setoff.creditUsed)} />
              <Stat label="Net cash" v={r3b.netCash} accent />
            </>
          )}
        </div>

        {/* actions by state */}
        <div className="space-y-3 p-4">
          {st.status === "open" && (
            <div className="space-y-2">
              <Input placeholder="Preparer note (optional)" value={note} onChange={(e) => setNote(e.target.value)} className="h-9 text-sm" />
              <Button className="w-full" onClick={() => { persistFilings(submitForReview(filings, rk, month, actor, now(), note || undefined)); setNote(""); }}>
                <Send className="size-4" /> Submit for review (as {employeeName(actor)})
              </Button>
            </div>
          )}

          {st.status === "in_review" && (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                Prepared by <strong>{employeeName(st.preparedBy ?? null)}</strong>. A different reviewer signs off to file &amp; lock.
              </p>
              {!canApprove(st, actor) && (
                <p className="flex items-center gap-1.5 rounded-md bg-warning/10 px-2.5 py-1.5 text-xs text-warning">
                  <ShieldCheck className="size-3.5 shrink-0" />
                  Segregation of duties: the preparer can’t approve their own return. Switch the acting user to file.
                </p>
              )}
              <div className="flex gap-2">
                <Input placeholder="ARN (auto if blank)" value={arn} onChange={(e) => setArn(e.target.value)} className="h-9 text-sm" />
                <Button
                  disabled={!canApprove(st, actor)}
                  onClick={() => { persistFilings(approveAndFile(filings, rk, month, actor, now(), arn || `AA${month.replace("-", "")}${rk === "gstr1" ? "R1" : "3B"}`)); setArn(""); }}
                >
                  <CheckCircle2 className="size-4" /> Approve &amp; file
                </Button>
              </div>
              <div className="flex gap-2">
                <Input placeholder="Reason to return" value={note} onChange={(e) => setNote(e.target.value)} className="h-9 text-sm" />
                <Button variant="outline" onClick={() => { if (note) { persistFilings(returnForRework(filings, rk, month, actor, now(), note)); setNote(""); } }}>
                  <Undo2 className="size-4" /> Return
                </Button>
              </div>
            </div>
          )}

          {st.status === "filed" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between rounded-md bg-success/10 px-3 py-2 text-sm">
                <span className="flex items-center gap-1.5 text-success"><Lock className="size-4" /> Filed &amp; locked</span>
                <span className="font-mono text-xs">{st.arn}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                Filed {st.filedOn && formatDate(st.filedOn)} by {employeeName(st.reviewedBy ?? null)}.
              </p>
              <Button variant="outline" className="w-full" onClick={() => persistFilings(reopenFiled(filings, rk, month, actor, now(), "Reopened to revise"))}>
                <LockOpen className="size-4" /> Reopen to revise
              </Button>
            </div>
          )}

          {/* review trail */}
          {st.trail.length > 0 && (
            <div className="border-t pt-3">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Review trail</p>
              <ul className="space-y-1.5">
                {st.trail.map((ev, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs">
                    <ScrollText className="mt-0.5 size-3 shrink-0 text-muted-foreground" />
                    <span>
                      <strong className="capitalize">{ev.action}</strong> by {employeeName(ev.by)} · {formatDate(ev.ts)}
                      {ev.ref && <span className="font-mono text-muted-foreground"> · {ev.ref}</span>}
                      {ev.note && <span className="text-muted-foreground"> — "{ev.note}"</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Card>
    );
  }

  // ---- shared table bits ---------------------------------------------------
  function TableToolbar({ count, onExport }: { count: number; onExport: () => void }) {
    return (
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs text-muted-foreground">{count.toLocaleString("en-IN")} rows</span>
        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onExport}>
          <Download className="size-3.5" /> Export CSV
        </Button>
      </div>
    );
  }

  function ShowMore({ shown, total, onMore }: { shown: number; total: number; onMore: () => void }) {
    if (shown >= total) return null;
    return (
      <div className="border-t p-3 text-center">
        <Button variant="ghost" size="sm" onClick={onMore}>
          Show more — {shown.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")}
        </Button>
      </div>
    );
  }
}

// ---- small presentational helpers (module scope) ---------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className={cn("p-4", accent && "border-primary/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular", accent && "text-primary")}>
        <Money value={value} compact />
      </p>
    </Card>
  );
}

function THead({ cols, numFrom }: { cols: string[]; numFrom: number }) {
  return (
    <thead>
      <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
        {cols.map((c, i) => (
          <th key={c} className={cn("px-4 py-2.5 font-medium", i >= numFrom && "text-right")}>
            {c}
          </th>
        ))}
      </tr>
    </thead>
  );
}

function TFoot({ label, cols, span, extra }: { label: string; cols: number[]; span: number; extra?: number }) {
  return (
    <tfoot>
      <tr className="border-t-2 bg-muted/30 font-semibold">
        <td className="px-4 py-2.5" colSpan={span}>
          {label}
        </td>
        {cols.map((c, i) => (
          <td key={i} className="px-4 py-2.5 text-right tabular">
            <Money value={c} />
          </td>
        ))}
        {extra ? Array.from({ length: extra }).map((_, i) => <td key={`e${i}`} />) : null}
      </tr>
    </tfoot>
  );
}

function Num({ v, signed }: { v: number; signed?: boolean }) {
  return (
    <td className="px-4 py-2 text-right tabular">
      <Money value={v} colored={signed} bracketNegatives={signed} />
    </td>
  );
}

function Stat({ label, v, accent, text }: { label: string; v: number | null; accent?: boolean; text?: string }) {
  return (
    <div className="bg-card px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-base font-bold tabular", accent && "text-primary")}>
        {text ?? (v !== null ? <Money value={v} /> : "—")}
      </p>
    </div>
  );
}

function EmptyRow({ span }: { span: number }) {
  return (
    <tr>
      <td colSpan={span} className="px-4 py-10 text-center text-sm text-muted-foreground">
        Nothing to show for this scope &amp; period.
      </td>
    </tr>
  );
}

function DepositForm({ onAdd }: { onAdd: (d: CashDeposit) => void }) {
  const [igst, setIgst] = React.useState("");
  const [cgst, setCgst] = React.useState("");
  const [sgst, setSgst] = React.useState("");
  const [ref, setRef] = React.useState("");
  const n = (s: string) => parseFloat(s) || 0;
  return (
    <Card className="mb-3 flex flex-wrap items-end gap-2 p-3">
      <Field label="IGST"><Input value={igst} onChange={(e) => setIgst(e.target.value)} placeholder="0" className="h-9 w-24" inputMode="decimal" /></Field>
      <Field label="CGST"><Input value={cgst} onChange={(e) => setCgst(e.target.value)} placeholder="0" className="h-9 w-24" inputMode="decimal" /></Field>
      <Field label="SGST"><Input value={sgst} onChange={(e) => setSgst(e.target.value)} placeholder="0" className="h-9 w-24" inputMode="decimal" /></Field>
      <Field label="Challan CIN"><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="CIN…" className="h-9 w-40" /></Field>
      <Button
        size="sm"
        disabled={!(n(igst) || n(cgst) || n(sgst))}
        onClick={() => {
          onAdd({ id: `cash-${ref || Math.round(n(igst) + n(cgst) + n(sgst))}-${ref}`, date: new Date().toISOString().slice(0, 10), ref: ref || "CIN-MANUAL", igst: n(igst), cgst: n(cgst), sgst: n(sgst) });
          setIgst(""); setCgst(""); setSgst(""); setRef("");
        }}
      >
        <Banknote className="size-4" /> Add deposit
      </Button>
    </Card>
  );
}
