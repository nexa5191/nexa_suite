"use client";

import { useState, useMemo } from "react";
import { Plus, Pencil, Trash2, Zap, TrendingUp, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { KpiStrip } from "@/components/accounting/kpi-strip";
import { ReportControls } from "@/components/reports/report-controls";
import { useReport } from "@/components/reports/use-report";
import { Badge } from "@/components/ui/badge";
import { formatMoney, type Currency } from "@/lib/currency";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { cn } from "@/lib/utils";
import {
  type CustomKpi,
  loadCustomKpis,
  saveCustomKpis,
  evalFormula,
  KPI_TEMPLATES,
} from "@/lib/reports/kpi-formula";
import { useJournal } from "@/components/accounting/journal-provider";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmtValue(value: number, format: CustomKpi["format"], currency: Currency): string {
  if (isNaN(value)) return "—";
  if (format === "money") return formatMoney(value, currency);
  if (format === "percent") return `${(value * 100).toFixed(1)}%`;
  if (format === "ratio") return `${value.toFixed(2)}x`;
  return value.toLocaleString("en-IN", { maximumFractionDigits: 0 });
}

const FORMAT_LABELS: Record<CustomKpi["format"], string> = {
  money: "Money (₹)",
  percent: "Percentage (%)",
  ratio: "Ratio (×)",
  number: "Number",
};

// ---------------------------------------------------------------------------
// Empty state
// ---------------------------------------------------------------------------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-dashed bg-muted/20 py-16 text-center">
      <div className="flex size-14 items-center justify-center rounded-full bg-primary/10">
        <TrendingUp className="size-6 text-primary" />
      </div>
      <div>
        <p className="font-semibold">No custom KPIs yet</p>
        <p className="mt-1 text-sm text-muted-foreground max-w-xs mx-auto">
          Build your own metrics using GL account ranges — revenue, margins, ratios, balances.
        </p>
      </div>
      <Button onClick={onAdd}>
        <Plus className="size-4" /> New KPI
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI row in the list table
// ---------------------------------------------------------------------------

function KpiRow({
  kpi,
  value,
  currency,
  onEdit,
  onDelete,
}: {
  kpi: CustomKpi;
  value: number;
  currency: Currency;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isNeg = kpi.colorize && value < 0;
  return (
    <tr className="border-b border-border/40 last:border-0 group hover:bg-accent/30">
      <td className="px-4 py-3">
        <p className="font-medium">{kpi.name}</p>
        {kpi.description && <p className="text-xs text-muted-foreground">{kpi.description}</p>}
      </td>
      <td className="px-4 py-3 text-xs font-mono text-muted-foreground max-w-56 truncate">{kpi.formula}</td>
      <td className="px-4 py-3">
        <Badge variant="outline">{FORMAT_LABELS[kpi.format]}</Badge>
      </td>
      <td className={cn("px-4 py-3 text-right tabular font-semibold", isNeg && "text-danger")}>
        {fmtValue(value, kpi.format, currency)}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end">
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="sm" onClick={onDelete} className="text-danger hover:text-danger">
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// KPI form modal (add / edit)
// ---------------------------------------------------------------------------

function KpiForm({
  initial,
  onSave,
  onClose,
}: {
  initial?: CustomKpi;
  onSave: (kpi: Omit<CustomKpi, "id">) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [formula, setFormula] = useState(initial?.formula ?? "");
  const [format, setFormat] = useState<CustomKpi["format"]>(initial?.format ?? "money");
  const [colorize, setColorize] = useState(initial?.colorize ?? true);
  const [description, setDescription] = useState(initial?.description ?? "");
  const [showTemplates, setShowTemplates] = useState(!initial);

  const ctl = useReport();
  const { currency } = usePrefs();

  const preview = useMemo(() => {
    if (!formula.trim()) return null;
    const v = evalFormula(formula, ctl.filters);
    return { value: v, display: fmtValue(v, format, currency) };
  }, [formula, format, ctl.filters, currency]);

  const valid = name.trim() && formula.trim() && preview !== null && !isNaN(preview.value);

  return (
    <Modal
      open
      onClose={onClose}
      title={initial ? "Edit KPI" : "New Custom KPI"}
      className="max-w-xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            disabled={!valid}
            onClick={() => valid && onSave({ name: name.trim(), formula: formula.trim(), format, colorize, description: description.trim() || undefined })}
          >
            {initial ? "Save changes" : "Create KPI"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Templates */}
        {showTemplates && (
          <div className="rounded-lg border bg-muted/20 p-3">
            <button
              className="flex w-full items-center justify-between text-sm font-medium"
              onClick={() => setShowTemplates(false)}
            >
              <span className="flex items-center gap-1.5"><Zap className="size-3.5 text-primary" /> Start with a template</span>
              <ChevronDown className="size-4 text-muted-foreground" />
            </button>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {KPI_TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  className="rounded-full border bg-background px-2.5 py-0.5 text-xs hover:bg-accent hover:border-primary/40 transition-colors"
                  onClick={() => {
                    setName(t.name);
                    setFormula(t.formula);
                    setFormat(t.format);
                    setDescription(t.description);
                    setShowTemplates(false);
                  }}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}
        {!showTemplates && (
          <button
            className="text-xs text-primary hover:underline"
            onClick={() => setShowTemplates(true)}
          >
            Use a template →
          </button>
        )}

        {/* Name */}
        <div>
          <label className="mb-1 block text-xs font-medium">Name</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="e.g. Gross Margin %"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Formula */}
        <div>
          <label className="mb-1 block text-xs font-medium">Formula</label>
          <input
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="e.g. (SUM(4010:4040) - SUM(5010:5050)) / SUM(4010:4040)"
            value={formula}
            onChange={(e) => setFormula(e.target.value)}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            <span className="font-mono">SUM(code)</span> or <span className="font-mono">SUM(from:to)</span> — period movement ·{" "}
            <span className="font-mono">BAL(code)</span> — cumulative balance · <span className="font-mono">+ − * /</span> · parentheses
          </p>
          {/* Live preview */}
          {formula && (
            <div className={cn("mt-2 rounded-md px-3 py-2 text-sm", preview && !isNaN(preview.value) ? "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400" : "bg-danger/10 text-danger")}>
              {preview && !isNaN(preview.value)
                ? <><span className="font-medium">{preview.display}</span> <span className="text-xs opacity-70">for current period</span></>
                : "Formula error — check syntax and account codes"}
            </div>
          )}
        </div>

        {/* Format + Colorize */}
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium">Format</label>
            <select
              className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={format}
              onChange={(e) => setFormat(e.target.value as CustomKpi["format"])}
            >
              {(Object.keys(FORMAT_LABELS) as CustomKpi["format"][]).map((f) => (
                <option key={f} value={f}>{FORMAT_LABELS[f]}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end gap-2 pb-1">
            <input
              type="checkbox"
              id="colorize"
              className="size-4 accent-primary"
              checked={colorize}
              onChange={(e) => setColorize(e.target.checked)}
            />
            <label htmlFor="colorize" className="text-sm cursor-pointer">Red if negative</label>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="mb-1 block text-xs font-medium">Description <span className="font-normal text-muted-foreground">(optional)</span></label>
          <input
            className="w-full rounded-md border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
            placeholder="Short note about what this measures"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>
      </div>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

export function KpiBuilderClient() {
  const ctl = useReport();
  const { version } = useJournal();
  const { currency } = usePrefs();
  const [kpis, setKpis] = useState<CustomKpi[]>(() => loadCustomKpis());
  const [editing, setEditing] = useState<CustomKpi | null>(null);
  const [adding, setAdding] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const values = useMemo(
    () => Object.fromEntries(kpis.map((k) => [k.id, evalFormula(k.formula, ctl.filters)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kpis, ctl.filters, version],
  );

  function persist(next: CustomKpi[]) {
    setKpis(next);
    saveCustomKpis(next);
  }

  function addKpi(fields: Omit<CustomKpi, "id">) {
    const id = `kpi-${Date.now()}`;
    persist([...kpis, { id, ...fields }]);
    setAdding(false);
  }

  function updateKpi(id: string, fields: Omit<CustomKpi, "id">) {
    persist(kpis.map((k) => (k.id === id ? { id, ...fields } : k)));
    setEditing(null);
  }

  function deleteKpi(id: string) {
    persist(kpis.filter((k) => k.id !== id));
    setDeleteId(null);
  }

  const kpiStripItems = kpis.map((k) => ({
    label: k.name,
    value: kpis.length > 0 && !isNaN(values[k.id]) ? values[k.id] : 0,
    sub: fmtValue(values[k.id], k.format, currency) !== formatMoney(values[k.id], currency)
      ? fmtValue(values[k.id], k.format, currency)
      : undefined,
    colored: k.colorize,
  }));

  return (
    <>
      <PageHeader
        title="Custom KPI Builder"
        subtitle="Define your own metrics using GL account formulas — they update live with the selected period and filters."
        actions={
          <Button onClick={() => setAdding(true)}>
            <Plus className="size-4" /> New KPI
          </Button>
        }
      />

      {kpis.length > 0 && (
        <KpiStrip items={kpiStripItems} />
      )}

      <ReportControls ctl={ctl} />

      {kpis.length === 0 ? (
        <EmptyState onAdd={() => setAdding(true)} />
      ) : (
        <div className="rounded-lg border bg-card shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Name</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Formula</th>
                <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground">Format</th>
                <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground">Value</th>
                <th className="px-4 py-2.5 w-20" />
              </tr>
            </thead>
            <tbody>
              {kpis.map((k) => (
                <KpiRow
                  key={k.id}
                  kpi={k}
                  value={values[k.id]}
                  currency={currency}
                  onEdit={() => setEditing(k)}
                  onDelete={() => setDeleteId(k.id)}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add modal */}
      {adding && (
        <KpiForm onSave={addKpi} onClose={() => setAdding(false)} />
      )}

      {/* Edit modal */}
      {editing && (
        <KpiForm
          initial={editing}
          onSave={(fields) => updateKpi(editing.id, fields)}
          onClose={() => setEditing(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteId && (
        <Modal
          open
          onClose={() => setDeleteId(null)}
          title="Delete KPI?"
          description={`"${kpis.find((k) => k.id === deleteId)?.name}" will be permanently removed.`}
          footer={
            <>
              <Button variant="outline" onClick={() => setDeleteId(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => deleteKpi(deleteId)}>Delete</Button>
            </>
          }
        />
      )}
    </>
  );
}
