"use client";

import * as React from "react";
import { Download, BookText, ShoppingCart, FileSpreadsheet, ChevronRight, CheckCircle2, Clock, LockOpen, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { cn, formatDate } from "@/lib/utils";
import { entityById } from "@/lib/accounting/org";
import { downloadCsv } from "@/lib/export";
import {
  outwardRows,
  inwardRows,
  inRange,
  scopeRows,
  hsnSummary,
  availableFYs,
  type TaxScope,
} from "@/lib/tax/tax-data";
import { monthLabel, periodRange } from "@/lib/tax/gst";
import { monthsInRange } from "@/lib/tax/returns";
import { loadFilings, loadItc, FILING_META, type FilingStore, type ItcStore } from "@/lib/tax/compliance";
import {
  salesRegister,
  purchaseRegister,
  groupByRate,
  registerTotals,
  outputClaimMap,
  inputClaimMap,
  type RegisterRow,
  type RegisterKind,
} from "@/lib/tax/registers";

type ViewKey = "invoice" | "rate" | "hsn" | "claims";

const VIEW_META: Record<ViewKey, { label: string; blurb: string }> = {
  invoice: { label: "Invoice-wise", blurb: "Every tax invoice with taxable value and CGST / SGST / UTGST / IGST split out." },
  rate: { label: "By tax rate", blurb: "Invoices grouped by GST rate — expand a rate to see the underlying invoices." },
  hsn: { label: "HSN / SAC-wise", blurb: "Supplies grouped by HSN/SAC code & rate (GSTR-1 Table 12 format)." },
  claims: { label: "Input / output filing map", blurb: "How each period maps to the return it is filed/claimed in — accounted vs pending." },
};

type PeriodSel = { kind: "month" | "fy" | "all"; value: string };

function rangeOf(sel: PeriodSel): { from: string; to: string } {
  if (sel.kind === "month") return periodRange("m:" + sel.value);
  if (sel.kind === "fy") return periodRange("fy:" + sel.value);
  return { from: "0000-00-00", to: "9999-99-99" };
}

export function GstRegistersClient() {
  const prefs = usePrefs();
  const scope: TaxScope = { entityId: prefs.entityId };

  const [kind, setKind] = React.useState<RegisterKind>("sales");
  const [view, setView] = React.useState<ViewKey>("invoice");
  const [sel, setSel] = React.useState<PeriodSel>({ kind: "month", value: "2026-05" });
  const [limit, setLimit] = React.useState(80);

  const [filings, setFilings] = React.useState<FilingStore>({});
  const [itc, setItc] = React.useState<ItcStore>({});

  React.useEffect(() => {
    setFilings(loadFilings());
    setItc(loadItc());
  }, []);

  const months = React.useMemo(() => monthsInRange("2025-04-01", "2026-12-31"), []);
  const { from, to } = rangeOf(sel);

  React.useEffect(() => setLimit(80), [view, kind, sel.kind, sel.value, prefs.entityId]);

  const outward = React.useMemo(() => scopeRows(inRange(outwardRows(), from, to), scope), [from, to, scope.entityId]);
  const inward = React.useMemo(() => scopeRows(inRange(inwardRows(), from, to), scope), [from, to, scope.entityId]);

  const rows: RegisterRow[] = React.useMemo(
    () => (kind === "sales" ? salesRegister(outward, filings) : purchaseRegister(inward, filings, itc)),
    [kind, outward, inward, filings, itc],
  );
  const totals = React.useMemo(() => registerTotals(rows), [rows]);

  const scopeName = prefs.entityId === "all" ? "All entities" : entityById(prefs.entityId)?.name ?? "—";
  const periodLabel = sel.kind === "month" ? monthLabel(sel.value) : sel.kind === "fy" ? `FY ${sel.value}` : "All periods";
  const tag = `${kind}-register-${periodLabel}`;
  const isSales = kind === "sales";

  return (
    <>
      <PageHeader
        title="GST Registers"
        subtitle="Statutory Sales & Purchase registers — invoice-wise, rate-wise and HSN-wise GST splits, mapped to input/output filings."
        actions={
          <Badge variant="outline" className="gap-1.5">
            <FileSpreadsheet className="size-3.5" /> {scopeName} · {periodLabel}
          </Badge>
        }
      />

      {/* register + period bar */}
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
        <Field label="Register">
          <div className="flex gap-1">
            {(["sales", "purchase"] as RegisterKind[]).map((k) => (
              <button
                key={k}
                onClick={() => setKind(k)}
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  kind === k ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:bg-accent",
                )}
              >
                {k === "sales" ? <ShoppingCart className="size-3.5" /> : <BookText className="size-3.5" />}
                {k === "sales" ? "Sales (Outward)" : "Purchase (Inward)"}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Period type">
          <Select
            value={sel.kind}
            onChange={(e) => {
              const k = e.target.value as PeriodSel["kind"];
              setSel(k === "month" ? { kind: k, value: months[0] ?? "2026-05" } : k === "fy" ? { kind: k, value: availableFYs()[0] } : { kind: k, value: "all" });
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
                <option key={m} value={m}>{monthLabel(m)}</option>
              ))}
            </Select>
          </Field>
        )}
        {sel.kind === "fy" && (
          <Field label="Financial year">
            <Select value={sel.value} onChange={(e) => setSel({ kind: "fy", value: e.target.value })} className="h-9 w-36">
              {availableFYs().map((f) => (
                <option key={f} value={f}>FY {f}</option>
              ))}
            </Select>
          </Field>
        )}
        <p className="ml-auto self-center text-xs text-muted-foreground">Entity scope follows the top bar.</p>
      </Card>

      {/* KPI strip */}
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-6">
        <Kpi label="Invoices" value={totals.count} plain />
        <Kpi label="Taxable value" value={totals.taxable} />
        <Kpi label="CGST" value={totals.cgst} />
        <Kpi label={isSales ? "SGST" : "SGST"} value={totals.sgst} />
        <Kpi label="UTGST" value={totals.utgst} />
        <Kpi label="Total GST" value={totals.totalGst} accent />
      </div>

      {/* view tabs */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(Object.keys(VIEW_META) as ViewKey[]).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
              view === v ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent",
            )}
          >
            {VIEW_META[v].label}
          </button>
        ))}
      </div>
      <div className="mb-3 flex items-center gap-2">
        <h2 className="text-sm font-semibold">{VIEW_META[view].label}</h2>
        <p className="text-xs text-muted-foreground">{VIEW_META[view].blurb}</p>
      </div>

      {view === "invoice" && (
        <InvoiceView rows={rows} totals={totals} isSales={isSales} limit={limit} onMore={() => setLimit((l) => l + 120)} tag={tag} />
      )}
      {view === "rate" && <RateView rows={rows} isSales={isSales} tag={tag} />}
      {view === "hsn" && <HsnView rows={isSales ? outward : inward} tag={tag} />}
      {view === "claims" && (
        <ClaimsView
          kind={kind}
          map={isSales ? outputClaimMap(outward, filings) : inputClaimMap(inward, filings, itc)}
          tag={tag}
        />
      )}
    </>
  );
}

// ---- view 1: invoice-wise --------------------------------------------------
function InvoiceView({
  rows,
  totals,
  isSales,
  limit,
  onMore,
  tag,
}: {
  rows: RegisterRow[];
  totals: ReturnType<typeof registerTotals>;
  isSales: boolean;
  limit: number;
  onMore: () => void;
  tag: string;
}) {
  const shown = rows.slice(0, limit);
  const partyHead = isSales ? "Customer" : "Vendor";
  const placeHead = isSales ? "Place of supply" : "Supplier state";
  return (
    <Card className="overflow-hidden">
      <Toolbar
        count={rows.length}
        onExport={() =>
          downloadCsv(
            tag,
            ["Date", "Invoice no", partyHead, "GSTIN", placeHead, "HSN", "Rate", "Taxable", "CGST", "SGST", "UTGST", "IGST", "Total GST", "Invoice value", isSales ? "GSTR-1 filed" : "ITC claimed"],
            rows.map((r) => [
              formatDate(r.date), r.invoiceNo, r.partyName, r.gstin || "Unregistered", r.placeLabel, r.hsn, r.rate,
              r.taxable, r.cgst, r.sgst, r.utgst, r.igst, r.totalGst, r.total,
              isSales ? (r.filed ? "Y" : "N") : r.itcClaimed ? "Y" : r.itcEligible ? "N" : "Ineligible",
            ]),
          )
        }
      />
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <THead cols={["Date", "Invoice", partyHead, placeHead, "HSN", "Rate", "Taxable", "CGST", "SGST", "UTGST", "IGST", "Total GST", "Inv value", isSales ? "Filed" : "ITC"]} numFrom={6} lastCenter />
          <tbody>
            {shown.map((r) => (
              <tr key={r.id} className="border-b last:border-0 hover:bg-accent/40">
                <td className="px-3 py-2 text-xs text-muted-foreground">{formatDate(r.date)}</td>
                <td className="px-3 py-2 font-mono text-xs">{r.invoiceNo}</td>
                <td className="px-3 py-2">
                  <p className="font-medium leading-tight">{r.partyName}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{r.gstin || "Unregistered"}</p>
                </td>
                <td className="px-3 py-2 text-xs">
                  {r.placeLabel}
                  {r.ut && <Badge variant="outline" className="ml-1 text-[9px]">UT</Badge>}
                </td>
                <td className="px-3 py-2 font-mono text-xs">{r.hsn}</td>
                <td className="px-3 py-2 text-right text-xs">{r.rate}%</td>
                <Num v={r.taxable} />
                <Num v={r.cgst} />
                <Num v={r.sgst} />
                <Num v={r.utgst} />
                <Num v={r.igst} />
                <Num v={r.totalGst} bold />
                <Num v={r.total} />
                <td className="px-3 py-2 text-center">
                  {isSales ? (
                    r.filed ? <Badge variant="success">Filed</Badge> : <Badge variant="default">Open</Badge>
                  ) : !r.itcEligible ? (
                    <Badge variant="danger">Blocked</Badge>
                  ) : r.itcClaimed ? (
                    <Badge variant="success">Claimed</Badge>
                  ) : (
                    <Badge variant="warning">Pending</Badge>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 && <Empty span={14} />}
          </tbody>
          <TFoot
            label={`Total — ${totals.count} invoices`}
            span={6}
            cols={[totals.taxable, totals.cgst, totals.sgst, totals.utgst, totals.igst, totals.totalGst, totals.total]}
            extra={1}
          />
        </table>
      </div>
      {shown.length < rows.length && (
        <div className="border-t p-3 text-center">
          <Button variant="ghost" size="sm" onClick={onMore}>
            Show more — {shown.length} of {rows.length}
          </Button>
        </div>
      )}
    </Card>
  );
}

// ---- view 2: by tax rate (collapsible) -------------------------------------
function RateView({ rows, isSales, tag }: { rows: RegisterRow[]; isSales: boolean; tag: string }) {
  const groups = groupByRate(rows);
  const grand = registerTotals(rows);
  const [open, setOpen] = React.useState<Set<number>>(new Set());
  const allOpen = groups.length > 0 && open.size === groups.length;
  const toggle = (rate: number) =>
    setOpen((prev) => {
      const next = new Set(prev);
      next.has(rate) ? next.delete(rate) : next.add(rate);
      return next;
    });
  const expandAll = () => setOpen(new Set(groups.map((g) => g.rate)));
  const collapseAll = () => setOpen(new Set());
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-2">
        <span className="text-xs text-muted-foreground">{groups.length.toLocaleString("en-IN")} rate slabs</span>
        <div className="flex items-center gap-2">
          {groups.length > 0 && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={allOpen ? collapseAll : expandAll}>
              {allOpen ? <ChevronsDownUp className="size-3.5" /> : <ChevronsUpDown className="size-3.5" />}
              {allOpen ? "Collapse all" : "Expand all"}
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() =>
              downloadCsv(
                `${tag}-by-rate`,
                ["Rate", "Invoices", "Taxable", "CGST", "SGST", "UTGST", "IGST", "Total GST"],
                groups.map((g) => [`${g.rate}%`, g.totals.count, g.totals.taxable, g.totals.cgst, g.totals.sgst, g.totals.utgst, g.totals.igst, g.totals.totalGst]),
              )
            }
          >
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
      </div>
      <div className="divide-y">
        {groups.map((g) => (
          <RateGroupRow key={g.rate} rate={g.rate} totals={g.totals} rows={g.rows} isSales={isSales} open={open.has(g.rate)} onToggle={() => toggle(g.rate)} />
        ))}
        {groups.length === 0 && <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nothing to show for this scope &amp; period.</p>}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t-2 bg-muted/30 px-4 py-3 text-sm font-semibold">
        <span>Grand total — {grand.count} invoices</span>
        <div className="flex flex-wrap gap-x-5 gap-y-1 tabular">
          <Leg label="Taxable" v={grand.taxable} />
          <Leg label="CGST" v={grand.cgst} />
          <Leg label="SGST" v={grand.sgst} />
          <Leg label="UTGST" v={grand.utgst} />
          <Leg label="IGST" v={grand.igst} />
          <Leg label="Total GST" v={grand.totalGst} accent />
        </div>
      </div>
    </Card>
  );
}

function RateGroupRow({ rate, totals, rows, isSales, open, onToggle }: { rate: number; totals: ReturnType<typeof registerTotals>; rows: RegisterRow[]; isSales: boolean; open: boolean; onToggle: () => void }) {
  return (
    <div>
      <button onClick={onToggle} className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/40">
        <ChevronRight className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-90")} />
        <Badge variant="primary" className="shrink-0">{rate}% GST</Badge>
        <span className="text-xs text-muted-foreground">{totals.count} invoices</span>
        <div className="ml-auto flex flex-wrap justify-end gap-x-5 gap-y-1 text-sm tabular">
          <Leg label="Taxable" v={totals.taxable} />
          <Leg label="CGST" v={totals.cgst} />
          <Leg label="SGST" v={totals.sgst} />
          <Leg label="UTGST" v={totals.utgst} />
          <Leg label="IGST" v={totals.igst} />
          <Leg label="Total GST" v={totals.totalGst} accent />
        </div>
      </button>
      {open && (
        <div className="overflow-x-auto border-t bg-muted/20 scrollbar-thin">
          <table className="w-full text-sm">
            <THead cols={["Date", "Invoice", isSales ? "Customer" : "Vendor", "HSN", "Taxable", "CGST", "SGST", "UTGST", "IGST", "Total GST"]} numFrom={4} />
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-3 py-1.5 text-xs text-muted-foreground">{formatDate(r.date)}</td>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.invoiceNo}</td>
                  <td className="px-3 py-1.5">
                    <span className="text-xs">{r.partyName}</span>
                    <span className="ml-1 font-mono text-[10px] text-muted-foreground">{r.gstin || "—"}</span>
                  </td>
                  <td className="px-3 py-1.5 font-mono text-xs">{r.hsn}</td>
                  <Num v={r.taxable} small />
                  <Num v={r.cgst} small />
                  <Num v={r.sgst} small />
                  <Num v={r.utgst} small />
                  <Num v={r.igst} small />
                  <Num v={r.totalGst} small bold />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ---- view 3: HSN / SAC-wise ------------------------------------------------
function HsnView({ rows, tag }: { rows: Parameters<typeof hsnSummary>[0]; tag: string }) {
  const groups = hsnSummary(rows);
  const t = groups.reduce(
    (a, g) => ({ taxable: a.taxable + g.taxable, cgst: a.cgst + g.cgst, sgst: a.sgst + g.sgst, utgst: a.utgst + g.utgst, igst: a.igst + g.igst, tax: a.tax + g.tax }),
    { taxable: 0, cgst: 0, sgst: 0, utgst: 0, igst: 0, tax: 0 },
  );
  return (
    <Card className="overflow-hidden">
      <Toolbar
        count={groups.length}
        label="HSN/SAC groups"
        onExport={() =>
          downloadCsv(
            `${tag}-by-hsn`,
            ["Code", "Kind", "Description", "Rate", "Lines", "Taxable", "CGST", "SGST", "UTGST", "IGST", "Total GST"],
            groups.map((g) => [g.code, g.kind, g.desc, g.rate, g.lines, g.taxable, g.cgst, g.sgst, g.utgst, g.igst, g.tax]),
          )
        }
      />
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <THead cols={["Code", "Description", "Rate", "Lines", "Taxable", "CGST", "SGST", "UTGST", "IGST", "Total GST"]} numFrom={2} />
          <tbody>
            {groups.map((g) => (
              <tr key={`${g.code}-${g.rate}`} className="border-b last:border-0 hover:bg-accent/40">
                <td className="px-3 py-2">
                  <span className="font-mono text-xs font-semibold">{g.code}</span>
                  <Badge variant="outline" className="ml-2">{g.kind}</Badge>
                </td>
                <td className="px-3 py-2 text-xs">{g.desc}</td>
                <td className="px-3 py-2 text-right text-xs">{g.rate}%</td>
                <td className="px-3 py-2 text-right text-xs tabular">{g.lines}</td>
                <Num v={g.taxable} />
                <Num v={g.cgst} />
                <Num v={g.sgst} />
                <Num v={g.utgst} />
                <Num v={g.igst} />
                <Num v={g.tax} bold />
              </tr>
            ))}
            {groups.length === 0 && <Empty span={10} />}
          </tbody>
          <TFoot label="Total" span={4} cols={[t.taxable, t.cgst, t.sgst, t.utgst, t.igst, t.tax]} />
        </table>
      </div>
    </Card>
  );
}

// ---- view 4: input / output filing-claim map -------------------------------
function ClaimsView({ kind, map, tag }: { kind: RegisterKind; map: ReturnType<typeof outputClaimMap>; tag: string }) {
  const isSales = kind === "sales";
  const accounted = map.reduce((s, m) => s + m.accounted, 0);
  const pending = map.reduce((s, m) => s + m.pending, 0);
  const accountedLabel = isSales ? "Output tax filed (GSTR-1)" : "Input credit claimed (GSTR-3B)";
  const pendingLabel = isSales ? "Output tax not yet filed" : "Eligible ITC not yet claimed";
  return (
    <>
      <Card className="mb-3 border-primary/30 bg-primary/5 p-3 text-xs text-muted-foreground">
        {isSales
          ? "Maps each period's outward tax (OUTPUT liability) to its GSTR-1 filing — what's filed & locked vs still open to file."
          : "Maps each period's eligible inward tax (INPUT credit) to GSTR-3B — what's been claimed as ITC vs eligible but unclaimed."}
      </Card>
      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Kpi label={accountedLabel} value={accounted} />
        <Kpi label={pendingLabel} value={pending} accent />
        <Kpi label="Total GST" value={accounted + pending} />
      </div>
      <Card className="overflow-hidden">
        <Toolbar
          count={map.length}
          label="periods"
          onExport={() =>
            downloadCsv(
              `${tag}-filing-map`,
              ["Period", "Invoices", "Taxable", "CGST", "SGST", "UTGST", "IGST", "Total GST", isSales ? "GSTR-1 status" : "GSTR-3B status", isSales ? "Filed" : "Claimed", "Pending"],
              map.map((m) => [monthLabel(m.period), m.count, m.taxable, m.cgst, m.sgst, m.utgst, m.igst, m.totalGst, FILING_META[m.status].label, m.accounted, m.pending]),
            )
          }
        />
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <THead cols={["Period", "Inv", "Taxable", "CGST", "SGST", "UTGST", "IGST", "Total GST", isSales ? "Output filed" : "ITC claimed", "Pending", "Return"]} numFrom={2} lastCenter />
            <tbody>
              {map.map((m) => (
                <tr key={m.period} className="border-b last:border-0 hover:bg-accent/40">
                  <td className="px-3 py-2 font-medium">{monthLabel(m.period)}</td>
                  <td className="px-3 py-2 text-right text-xs tabular">{m.count}</td>
                  <Num v={m.taxable} />
                  <Num v={m.cgst} />
                  <Num v={m.sgst} />
                  <Num v={m.utgst} />
                  <Num v={m.igst} />
                  <Num v={m.totalGst} bold />
                  <Num v={m.accounted} />
                  <Num v={m.pending} />
                  <td className="px-3 py-2 text-center">
                    <StatusBadge status={m.status} />
                  </td>
                </tr>
              ))}
              {map.length === 0 && <Empty span={11} />}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function StatusBadge({ status }: { status: keyof typeof FILING_META }) {
  const m = FILING_META[status];
  const Icon = status === "filed" ? CheckCircle2 : status === "in_review" ? Clock : LockOpen;
  return (
    <Badge variant={m.variant === "default" ? "default" : m.variant}>
      <Icon className="size-3" /> {m.label}
    </Badge>
  );
}

// ---- shared bits -----------------------------------------------------------
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Kpi({ label, value, accent, plain }: { label: string; value: number; accent?: boolean; plain?: boolean }) {
  return (
    <Card className={cn("p-3", accent && "border-primary/40")}>
      <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular", accent && "text-primary")}>
        {plain ? value.toLocaleString("en-IN") : <Money value={value} compact />}
      </p>
    </Card>
  );
}

function Leg({ label, v, accent }: { label: string; v: number; accent?: boolean }) {
  return (
    <span className="flex items-baseline gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>
      <Money value={v} compact className={cn("font-semibold", accent && "text-primary")} />
    </span>
  );
}

function Toolbar({ count, onExport, label = "invoices" }: { count: number; onExport: () => void; label?: string }) {
  return (
    <div className="flex items-center justify-between border-b px-4 py-2">
      <span className="text-xs text-muted-foreground">{count.toLocaleString("en-IN")} {label}</span>
      <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={onExport}>
        <Download className="size-3.5" /> Export CSV
      </Button>
    </div>
  );
}

function THead({ cols, numFrom, lastCenter }: { cols: string[]; numFrom: number; lastCenter?: boolean }) {
  return (
    <thead>
      <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
        {cols.map((c, i) => (
          <th key={c} className={cn("px-3 py-2.5 font-medium", i >= numFrom && "text-right", lastCenter && i === cols.length - 1 && "text-center")}>
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
        <td className="px-3 py-2.5" colSpan={span}>{label}</td>
        {cols.map((c, i) => (
          <td key={i} className="px-3 py-2.5 text-right tabular">
            <Money value={c} />
          </td>
        ))}
        {extra ? Array.from({ length: extra }).map((_, i) => <td key={`e${i}`} />) : null}
      </tr>
    </tfoot>
  );
}

function Num({ v, bold, small }: { v: number; bold?: boolean; small?: boolean }) {
  return (
    <td className={cn("px-3 text-right tabular", small ? "py-1.5" : "py-2", bold && "font-semibold")}>
      <Money value={v} />
    </td>
  );
}

function Empty({ span }: { span: number }) {
  return (
    <tr>
      <td colSpan={span} className="px-4 py-10 text-center text-sm text-muted-foreground">
        Nothing to show for this scope &amp; period.
      </td>
    </tr>
  );
}
