"use client";

import * as React from "react";
import {
  FileSpreadsheet,
  ChevronDown,
  Settings2,
  Plus,
  Copy,
  Trash2,
  Check,
  Save,
  Bold,
  Italic,
  Baseline,
  PaintBucket,
  Heading,
  Grid2x2,
  Minus,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import {
  type ExcelTemplate,
  allTemplates,
  templateById,
  upsertTemplate,
  deleteTemplate,
  newTemplateId,
  getActiveTemplateId,
  setActiveTemplateId,
  normalizeTemplate,
  BUILTIN_TEMPLATES,
} from "@/lib/xlsx/templates";
import { downloadReport, type ReportSheet } from "@/lib/xlsx/report";

const hx = (h: string) => (h ? `#${h}` : "#ffffff");
const unhx = (h: string) => h.replace(/^#/, "").toUpperCase();
const clamp = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

// Fonts offered in the editor. These are common workbook faces; the chosen name
// is written into the .xlsx so Excel renders it (falls back if not installed).
const FONTS = ["Calibri", "Aptos Narrow", "Arial", "Cambria", "Georgia", "Times New Roman", "Verdana", "Courier New"];

/** Format a sample amount the way the export will (symbol + decimals). */
function fmtMoney(n: number, t: ExcelTemplate) {
  return `${t.currencySymbol}${n.toLocaleString("en-IN", {
    minimumFractionDigits: t.moneyDecimals,
    maximumFractionDigits: t.moneyDecimals,
  })}`;
}

// Selectable sheet regions — click one in the preview to format just that part,
// exactly like selecting cells in Excel.
type Region = "title" | "header" | "data" | "total";

type Fill = { kind: "color"; key: keyof ExcelTemplate } | { kind: "band" } | { kind: "none" };
interface RegionStyle {
  label: string;
  hint: string;
  boldKey?: keyof ExcelTemplate;
  italicKey?: keyof ExcelTemplate;
  textKey: keyof ExcelTemplate;
  fill: Fill;
}
const REGION_STYLE: Record<Region, RegionStyle> = {
  title: { label: "Title", hint: "report heading above the table", textKey: "titleColor", fill: { kind: "none" } },
  header: {
    label: "Header",
    hint: "the column-heading row",
    boldKey: "headerBold",
    italicKey: "headerItalic",
    textKey: "headerText",
    fill: { kind: "color", key: "accent" },
  },
  data: {
    label: "Data rows",
    hint: "the body rows (zebra optional)",
    boldKey: "bodyBold",
    italicKey: "bodyItalic",
    textKey: "bodyText",
    fill: { kind: "band" },
  },
  total: {
    label: "Total",
    hint: "the grand-total / subtotal row",
    boldKey: "totalBold",
    italicKey: "totalItalic",
    textKey: "totalText",
    fill: { kind: "color", key: "totalFill" },
  },
};

/**
 * Reusable "Export to Excel" control. The parent supplies a builder that returns
 * the logical report sheets; the control owns template selection, the ribbon
 * format editor (save / edit / load), and the actual .xlsx download.
 */
export function ExcelExport({
  filename,
  build,
  label = "Export Excel",
  size = "sm",
}: {
  filename: string;
  build: () => ReportSheet[];
  label?: string;
  size?: "sm" | "md";
}) {
  const [open, setOpen] = React.useState(false);
  const [editorOpen, setEditorOpen] = React.useState(false);
  const [templates, setTemplates] = React.useState<ExcelTemplate[]>(BUILTIN_TEMPLATES);
  const [activeId, setActiveId] = React.useState(BUILTIN_TEMPLATES[0].id);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    setTemplates(allTemplates());
    setActiveId(getActiveTemplateId());
  }, []);

  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const active = templates.find((t) => t.id === activeId) ?? templateById(activeId);

  const doExport = (tpl: ExcelTemplate) => downloadReport(filename, build(), tpl);

  const pick = (id: string) => {
    setActiveId(id);
    setActiveTemplateId(id);
  };

  return (
    <div ref={ref} className="relative inline-flex">
      <Button size={size} variant="primary" className="rounded-r-none" onClick={() => doExport(active)}>
        <FileSpreadsheet className="size-4" />
        {label}
      </Button>
      <Button
        size={size}
        variant="primary"
        className="rounded-l-none border-l border-white/20 px-1.5"
        onClick={() => setOpen((o) => !o)}
        aria-label="Export options"
      >
        <ChevronDown className="size-4" />
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-80 rounded-lg border bg-card p-2 shadow-lg">
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">Excel template</div>
          <div className="max-h-64 space-y-0.5 overflow-auto">
            {templates.map((t) => (
              <button
                key={t.id}
                onClick={() => pick(t.id)}
                className={cn(
                  "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                  t.id === activeId && "bg-accent",
                )}
              >
                <Swatch t={t} />
                <span className="flex-1 truncate">{t.name}</span>
                {t.builtin && <span className="text-[10px] text-muted-foreground">built-in</span>}
                {t.id === activeId && <Check className="size-4 text-primary" />}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2 border-t pt-2">
            <Button size="sm" variant="primary" className="flex-1" onClick={() => doExport(active)}>
              <FileSpreadsheet className="size-4" />
              Download .xlsx
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setOpen(false);
                setEditorOpen(true);
              }}
              aria-label="Format editor"
              title="Format editor"
            >
              <Settings2 className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <RibbonEditor
        open={editorOpen}
        templates={templates}
        activeId={activeId}
        filename={filename}
        onDownload={doExport}
        onChange={(list, selectId) => {
          setTemplates(list);
          if (selectId) pick(selectId);
        }}
        onClose={() => setEditorOpen(false)}
      />
    </div>
  );
}

function Swatch({ t }: { t: ExcelTemplate }) {
  return (
    <span className="flex h-5 w-7 shrink-0 overflow-hidden rounded border">
      <span className="w-1/2" style={{ background: hx(t.accent) }} />
      <span className="w-1/2" style={{ background: t.bandColor ? hx(t.bandColor) : "#fff" }} />
    </span>
  );
}

// ---------------------------------------------------------------------------
// Ribbon format editor — Excel "Home"-style ribbon, live preview, saved presets.
// ---------------------------------------------------------------------------
function RibbonEditor({
  open,
  templates,
  activeId,
  filename,
  onChange,
  onDownload,
  onClose,
}: {
  open: boolean;
  templates: ExcelTemplate[];
  activeId: string;
  filename: string;
  onChange: (list: ExcelTemplate[], selectId?: string) => void;
  onDownload: (t: ExcelTemplate) => void;
  onClose: () => void;
}) {
  const start = templates.find((t) => t.id === activeId) ?? templates[0];
  const [draft, setDraft] = React.useState<ExcelTemplate>(() => normalizeTemplate(start));
  const [region, setRegion] = React.useState<Region>("header");

  // Re-seed the draft from the active template each time the editor is opened.
  React.useEffect(() => {
    if (open) {
      setDraft(normalizeTemplate(templates.find((t) => t.id === activeId) ?? templates[0]));
      setRegion("header");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const set = <K extends keyof ExcelTemplate>(k: K, v: ExcelTemplate[K]) => setDraft((d) => ({ ...d, [k]: v }));
  // Untyped setter for region-driven edits (the key is only known at runtime).
  const put = (k: keyof ExcelTemplate, v: unknown) => setDraft((d) => ({ ...d, [k]: v }));
  const rs = REGION_STYLE[region];
  const fillColorKey = rs.fill.kind === "color" ? rs.fill.key : null;

  const isBuiltin = BUILTIN_TEMPLATES.some((t) => t.id === draft.id);
  const isStored = templates.some((t) => t.id === draft.id) && !isBuiltin;

  const loadInto = (id: string) => setDraft(normalizeTemplate(templates.find((t) => t.id === id) ?? templates[0]));

  const create = () =>
    setDraft(normalizeTemplate({ ...BUILTIN_TEMPLATES[0], id: newTemplateId(), name: "My template", builtin: false }));

  const persist = () => {
    if (isBuiltin) {
      const id = newTemplateId();
      const name = BUILTIN_TEMPLATES.some((b) => b.name === draft.name) ? `${draft.name} custom` : draft.name;
      const copy = { ...draft, id, name, builtin: false };
      onChange(upsertTemplate(copy), id);
    } else {
      onChange(upsertTemplate({ ...draft, builtin: false }), draft.id);
    }
    onClose();
  };

  const duplicate = () => {
    const id = newTemplateId();
    const copy = { ...draft, id, name: `${draft.name} copy`, builtin: false };
    onChange(upsertTemplate(copy), id);
    setDraft(normalizeTemplate(copy));
  };

  const remove = () => {
    const list = deleteTemplate(draft.id);
    onChange(list, list[0]?.id);
    onClose();
  };

  if (!open) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Excel format editor"
      description="Style the export like a spreadsheet — preview updates live, then save it as a reusable preset."
      className="max-w-4xl"
      footer={
        <div className="flex w-full items-center gap-2">
          {isStored && (
            <Button size="sm" variant="danger" onClick={remove}>
              <Trash2 className="size-4" />
              Delete
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={duplicate}>
            <Copy className="size-4" />
            Duplicate
          </Button>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onDownload(draft)} title={`${filename}.xlsx`}>
              <FileSpreadsheet className="size-4" />
              Download now
            </Button>
            <Button size="sm" variant="primary" onClick={persist}>
              <Save className="size-4" />
              {isBuiltin ? "Save as new" : "Save preset"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-3">
        {/* Preset bar */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-muted-foreground">Preset</span>
          <select
            value={templates.some((t) => t.id === draft.id) ? draft.id : ""}
            onChange={(e) => loadInto(e.target.value)}
            className="h-8 w-52 rounded-md border bg-card px-2 text-sm"
          >
            {!templates.some((t) => t.id === draft.id) && <option value="">{draft.name} (unsaved)</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
                {t.builtin ? " · built-in" : ""}
              </option>
            ))}
          </select>
          <Button size="sm" variant="outline" onClick={create}>
            <Plus className="size-4" />
            New
          </Button>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">Name</span>
            <Input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              className="h-8 w-48 text-sm"
            />
          </div>
        </div>

        {/* Ribbon */}
        <div className="flex items-stretch gap-0 overflow-x-auto rounded-lg border bg-muted/30 p-1.5">
          {/* Contextual — edits whichever region is selected in the preview. */}
          <RibbonGroup label={`Format · ${rs.label}`}>
            <RibbonBtn
              active={rs.boldKey ? !!draft[rs.boldKey] : true}
              onClick={() => rs.boldKey && put(rs.boldKey, !draft[rs.boldKey])}
              title={rs.boldKey ? "Bold" : "Title is always bold"}
              className={!rs.boldKey ? "opacity-50" : undefined}
            >
              <Bold className="size-3.5" />
            </RibbonBtn>
            <RibbonBtn
              active={rs.italicKey ? !!draft[rs.italicKey] : false}
              onClick={() => rs.italicKey && put(rs.italicKey, !draft[rs.italicKey])}
              title="Italic"
              className={!rs.italicKey ? "opacity-50" : undefined}
            >
              <Italic className="size-3.5" />
            </RibbonBtn>
            <RibbonColor
              title={`${rs.label} text colour`}
              value={draft[rs.textKey] as string}
              onChange={(v) => put(rs.textKey, v)}
              icon={<Baseline className="size-3.5" />}
            />
            {fillColorKey && (
              <RibbonColor
                title={`${rs.label} fill`}
                value={draft[fillColorKey] as string}
                onChange={(v) => put(fillColorKey, v)}
                icon={<PaintBucket className="size-3.5" />}
              />
            )}
            {rs.fill.kind === "band" && (
              <>
                <RibbonBtn
                  active={draft.bandColor !== null}
                  onClick={() => set("bandColor", draft.bandColor === null ? "F5F3FF" : null)}
                  title="Zebra fill"
                  className="px-2 text-xs"
                >
                  Zebra
                </RibbonBtn>
                {draft.bandColor !== null && (
                  <RibbonColor title="Stripe colour" value={draft.bandColor} onChange={(v) => set("bandColor", v)} icon={<PaintBucket className="size-3.5" />} />
                )}
              </>
            )}
            {rs.fill.kind === "none" && <span className="px-1 text-[10px] text-muted-foreground">no fill</span>}
          </RibbonGroup>

          <Divider />

          <RibbonGroup label="Font">
            <select
              value={draft.fontName}
              onChange={(e) => set("fontName", e.target.value)}
              className="h-7 w-32 rounded border bg-card px-1.5 text-xs"
              title="Font family (whole sheet)"
            >
              {FONTS.map((f) => (
                <option key={f} value={f} style={{ fontFamily: f }}>
                  {f}
                </option>
              ))}
            </select>
            <span className="ml-1 flex items-center rounded border bg-card">
              <Type className="ml-1 size-3 text-muted-foreground" />
              <input
                type="number"
                min={8}
                max={20}
                value={draft.fontSize}
                onChange={(e) => set("fontSize", clamp(Number(e.target.value) || 11, 6, 28))}
                className="h-7 w-10 bg-transparent px-1 text-center text-xs outline-none"
                title="Font size (pt)"
              />
            </span>
          </RibbonGroup>

          <Divider />

          <RibbonGroup label="Number">
            <span className="flex items-center rounded border bg-card" title="Currency symbol">
              <input
                value={draft.currencySymbol}
                onChange={(e) => set("currencySymbol", e.target.value.slice(0, 3))}
                placeholder="₹"
                className="h-7 w-10 bg-transparent px-1 text-center text-xs outline-none"
              />
            </span>
            <RibbonBtn onClick={() => set("moneyDecimals", clamp(draft.moneyDecimals - 1, 0, 2))} title="Fewer decimals">
              <Minus className="size-3.5" />
            </RibbonBtn>
            <span className="w-9 text-center text-xs tabular text-muted-foreground">
              {draft.moneyDecimals === 0 ? "0" : draft.moneyDecimals === 1 ? "0.0" : "0.00"}
            </span>
            <RibbonBtn onClick={() => set("moneyDecimals", clamp(draft.moneyDecimals + 1, 0, 2))} title="More decimals">
              <Plus className="size-3.5" />
            </RibbonBtn>
          </RibbonGroup>

          <Divider />

          <RibbonGroup label="Sheet">
            <RibbonBtn active={draft.borders} onClick={() => set("borders", !draft.borders)} title="Cell borders">
              <Grid2x2 className="size-3.5" />
            </RibbonBtn>
            <RibbonBtn active={draft.showTitleBlock} onClick={() => set("showTitleBlock", !draft.showTitleBlock)} title="Title block">
              <Heading className="size-3.5" />
            </RibbonBtn>
          </RibbonGroup>
        </div>

        {/* Preview */}
        <div>
          <div className="mb-1 flex items-center gap-2 text-xs text-muted-foreground">
            <span className="font-medium">Live preview</span>
            <span>· click a region to select &amp; format it — now editing</span>
            <span className="rounded bg-primary/15 px-1.5 py-0.5 font-medium text-primary">{rs.label}</span>
            <span className="hidden sm:inline">({rs.hint})</span>
          </div>
          <Preview t={draft} region={region} onSelect={setRegion} />
        </div>
        {isBuiltin && (
          <p className="text-[11px] text-muted-foreground">
            <span className="font-medium">{draft.name}</span> is a built-in preset — your edits will be saved as a new
            preset you can reuse on every export.
          </p>
        )}
      </div>
    </Modal>
  );
}

function RibbonGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex shrink-0 flex-col">
      <div className="flex flex-1 items-center gap-1 px-2 py-1">{children}</div>
      <div className="mt-1 border-t pt-0.5 text-center text-[10px] uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function Divider() {
  return <div className="mx-1 my-1 w-px self-stretch bg-border" />;
}

function RibbonBtn({
  active,
  onClick,
  title,
  children,
  className,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        "flex h-7 min-w-7 items-center justify-center rounded border text-sm transition-colors",
        active
          ? "border-primary bg-primary/15 text-primary"
          : "border-transparent hover:border-border hover:bg-accent",
        className,
      )}
    >
      {children}
    </button>
  );
}

// Excel-style colour button — icon with a colour bar underneath; the whole tile
// is a hidden <input type=color>.
function RibbonColor({
  title,
  value,
  onChange,
  icon,
}: {
  title: string;
  value: string;
  onChange: (hexNoHash: string) => void;
  icon: React.ReactNode;
}) {
  return (
    <label
      title={title}
      className="relative flex h-7 w-7 cursor-pointer flex-col items-center justify-center rounded border border-transparent hover:border-border hover:bg-accent"
    >
      <span className="leading-none">{icon}</span>
      <span className="mt-0.5 h-1 w-4 rounded-sm border border-black/10" style={{ background: hx(value) }} />
      <input
        type="color"
        value={hx(value)}
        onChange={(e) => onChange(unhx(e.target.value))}
        className="absolute inset-0 cursor-pointer opacity-0"
      />
    </label>
  );
}

function Preview({
  t,
  region,
  onSelect,
}: {
  t: ExcelTemplate;
  region: Region;
  onSelect: (r: Region) => void;
}) {
  const cellBorder = t.borders ? "border border-border/70" : "";
  const cell = cn("px-2.5 py-1", cellBorder);
  const headFont = cn(t.headerBold && "font-semibold", t.headerItalic && "italic");
  const bodyFont = cn(t.bodyBold && "font-semibold", t.bodyItalic && "italic");
  const totalFont = cn(t.totalBold && "font-bold", t.totalItalic && "italic");
  const body: [string, number, string][] = [
    ["Cost of Goods Sold", 8240000, "61.2%"],
    ["Payroll & Benefits", 2110000, "15.7%"],
    ["Freight & Logistics", 1180000, "8.8%"],
  ];
  // Row-header gutter cell that labels & selects a region (like an Excel header).
  const Gut = ({ r, label, rowSpan }: { r: Region; label?: string; rowSpan?: number }) => (
    <td
      rowSpan={rowSpan}
      onClick={() => onSelect(r)}
      title={`Select ${REGION_STYLE[r].label}`}
      className={cn(
        "w-16 cursor-pointer select-none border-r px-1 py-0.5 text-center align-middle text-[8px] font-semibold uppercase tracking-wide",
        region === r ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground hover:bg-accent",
      )}
    >
      {label}
    </td>
  );
  const ring = (r: Region) => region === r && "outline outline-2 -outline-offset-2 outline-[hsl(var(--primary))]";

  return (
    <div
      className="overflow-hidden rounded-md border bg-white text-[#1F2937]"
      style={{ fontFamily: t.fontName, fontSize: Math.max(10, t.fontSize) }}
    >
      {t.showTitleBlock && (
        <div
          onClick={() => onSelect("title")}
          className={cn("flex cursor-pointer items-start gap-1.5 px-1.5 py-1", ring("title"))}
        >
          <span
            className={cn(
              "mt-0.5 rounded px-1 py-0.5 text-[8px] font-semibold uppercase tracking-wide",
              region === "title" ? "bg-primary text-primary-foreground" : "bg-muted/60 text-muted-foreground",
            )}
          >
            Title
          </span>
          <div>
            <div className="font-bold" style={{ color: hx(t.titleColor), fontSize: t.fontSize + 4 }}>
              Cost Audit — Cost Heads
            </div>
            <div className="text-[11px] text-[#6B7280]">All entities · FY 25-26 · Accrual basis</div>
          </div>
        </div>
      )}
      <table className="w-full border-collapse text-[11px]">
        <thead>
          <tr onClick={() => onSelect("header")} className="cursor-pointer">
            <Gut r="header" label="Header" />
            <th className={cn(cell, headFont, "text-left", ring("header"))} style={{ background: hx(t.accent), color: hx(t.headerText) }}>
              Cost Head
            </th>
            <th className={cn(cell, headFont, "text-right", ring("header"))} style={{ background: hx(t.accent), color: hx(t.headerText) }}>
              Amount
            </th>
            <th className={cn(cell, headFont, "text-right", ring("header"))} style={{ background: hx(t.accent), color: hx(t.headerText) }}>
              % of Cost
            </th>
          </tr>
        </thead>
        <tbody>
          {body.map((r, i) => (
            <tr
              key={i}
              onClick={() => onSelect("data")}
              className="cursor-pointer"
              style={{ background: t.bandColor && i % 2 === 1 ? hx(t.bandColor) : "#fff", color: hx(t.bodyText) }}
            >
              {i === 0 && <Gut r="data" label="Data" rowSpan={body.length} />}
              <td className={cn(cell, bodyFont, "text-left", ring("data"))}>{r[0]}</td>
              <td className={cn(cell, bodyFont, "text-right tabular", ring("data"))}>{fmtMoney(r[1], t)}</td>
              <td className={cn(cell, bodyFont, "text-right tabular", ring("data"))}>{r[2]}</td>
            </tr>
          ))}
          <tr
            onClick={() => onSelect("total")}
            className={cn("cursor-pointer", totalFont)}
            style={{ background: hx(t.totalFill), color: hx(t.totalText) }}
          >
            <Gut r="total" label="Total" />
            <td className={cn(cell, "text-left", ring("total"))}>Total Cost</td>
            <td className={cn(cell, "text-right tabular", ring("total"))}>{fmtMoney(13460000, t)}</td>
            <td className={cn(cell, "text-right tabular", ring("total"))}>100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
