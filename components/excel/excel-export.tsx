"use client";

import * as React from "react";
import { FileSpreadsheet, ChevronDown, Settings2, Plus, Copy, Trash2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
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
  BUILTIN_TEMPLATES,
} from "@/lib/xlsx/templates";
import { downloadReport, type ReportSheet } from "@/lib/xlsx/report";

const hx = (h: string) => (h ? `#${h}` : "#ffffff");
const unhx = (h: string) => h.replace(/^#/, "").toUpperCase();

/**
 * Reusable "Export to Excel" control. The parent supplies a builder that returns
 * the logical report sheets; the control owns template selection, the editor
 * (save / edit / load), and the actual .xlsx download.
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
  const [editing, setEditing] = React.useState(false);
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
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setEditing(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const active = templates.find((t) => t.id === activeId) ?? templateById(activeId);

  const doExport = (tpl: ExcelTemplate) => {
    downloadReport(filename, build(), tpl);
  };

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
          {!editing ? (
            <>
              <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
                Excel template
              </div>
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
                <Button size="sm" variant="outline" onClick={() => setEditing(true)} aria-label="Manage templates">
                  <Settings2 className="size-4" />
                </Button>
              </div>
            </>
          ) : (
            <TemplateEditor
              templates={templates}
              activeId={activeId}
              onChange={(list, selectId) => {
                setTemplates(list);
                if (selectId) pick(selectId);
              }}
              onClose={() => setEditing(false)}
            />
          )}
        </div>
      )}
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
// Template editor — create / edit / duplicate / delete, with a live preview.
// ---------------------------------------------------------------------------
function TemplateEditor({
  templates,
  activeId,
  onChange,
  onClose,
}: {
  templates: ExcelTemplate[];
  activeId: string;
  onChange: (list: ExcelTemplate[], selectId?: string) => void;
  onClose: () => void;
}) {
  const start = templates.find((t) => t.id === activeId) ?? templates[0];
  const [draft, setDraft] = React.useState<ExcelTemplate>(() => normalizeForEdit(start));
  const isBuiltin = !!BUILTIN_TEMPLATES.find((t) => t.id === draft.id);

  const set = <K extends keyof ExcelTemplate>(k: K, v: ExcelTemplate[K]) =>
    setDraft((d) => ({ ...d, [k]: v }));

  const loadInto = (id: string) => setDraft(normalizeForEdit(templates.find((t) => t.id === id) ?? templates[0]));

  const save = () => {
    const list = upsertTemplate({ ...draft, builtin: false });
    onChange(list, draft.id);
    onClose();
  };
  const saveAsNew = () => {
    const id = newTemplateId();
    const copy = { ...draft, id, name: `${draft.name} copy`, builtin: false };
    const list = upsertTemplate(copy);
    onChange(list, id);
    setDraft(normalizeForEdit(copy));
  };
  const create = () => {
    const id = newTemplateId();
    const blank: ExcelTemplate = {
      ...BUILTIN_TEMPLATES[0],
      id,
      name: "My template",
      builtin: false,
    };
    setDraft(normalizeForEdit(blank));
  };
  const remove = () => {
    const list = deleteTemplate(draft.id);
    onChange(list, list[0]?.id);
    onClose();
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className="text-xs font-semibold text-muted-foreground">Template editor</div>
        <div className="flex gap-1">
          <button onClick={create} className="rounded p-1 hover:bg-accent" title="New template">
            <Plus className="size-4" />
          </button>
          <button onClick={onClose} className="rounded p-1 hover:bg-accent" title="Close">
            <X className="size-4" />
          </button>
        </div>
      </div>

      <select
        value={templates.some((t) => t.id === draft.id) ? draft.id : ""}
        onChange={(e) => loadInto(e.target.value)}
        className="h-8 w-full rounded-md border bg-card px-2 text-xs"
      >
        {!templates.some((t) => t.id === draft.id) && <option value="">{draft.name} (new)</option>}
        {templates.map((t) => (
          <option key={t.id} value={t.id}>
            {t.name}
            {t.builtin ? " · built-in" : ""}
          </option>
        ))}
      </select>

      <Preview t={draft} />

      <div>
        <Label>Name</Label>
        <Input
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          className="mt-0.5 h-8 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <ColorField label="Header fill" value={draft.accent} onChange={(v) => set("accent", v)} />
        <ColorField label="Header text" value={draft.headerText} onChange={(v) => set("headerText", v)} />
        <ColorField label="Title text" value={draft.titleColor} onChange={(v) => set("titleColor", v)} />
        <ColorField label="Totals fill" value={draft.totalFill} onChange={(v) => set("totalFill", v)} />
        <BandField draft={draft} set={set} />
        <div>
          <Label>Currency symbol</Label>
          <Input
            value={draft.currencySymbol}
            onChange={(e) => set("currencySymbol", e.target.value.slice(0, 3))}
            placeholder="₹ / $ / blank"
            className="mt-0.5 h-8 text-sm"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 px-1 text-xs">
        <label className="flex items-center gap-1.5">
          <input type="checkbox" checked={draft.borders} onChange={(e) => set("borders", e.target.checked)} />
          Borders
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={draft.showTitleBlock}
            onChange={(e) => set("showTitleBlock", e.target.checked)}
          />
          Title block
        </label>
        <label className="ml-auto flex items-center gap-1.5">
          Size
          <input
            type="number"
            min={8}
            max={16}
            value={draft.fontSize}
            onChange={(e) => set("fontSize", Number(e.target.value) || 11)}
            className="h-7 w-12 rounded border bg-card px-1.5 text-center"
          />
        </label>
      </div>

      <div className="flex items-center gap-2 border-t pt-2">
        {isBuiltin ? (
          <Button size="sm" variant="primary" className="flex-1" onClick={saveAsNew}>
            <Copy className="size-4" />
            Save as new
          </Button>
        ) : (
          <>
            <Button size="sm" variant="primary" className="flex-1" onClick={save}>
              <Check className="size-4" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={saveAsNew} title="Duplicate">
              <Copy className="size-4" />
            </Button>
            {templates.some((t) => t.id === draft.id) && (
              <Button size="sm" variant="danger" onClick={remove} title="Delete">
                <Trash2 className="size-4" />
              </Button>
            )}
          </>
        )}
      </div>
      {isBuiltin && (
        <p className="px-1 text-[10px] text-muted-foreground">
          Built-in templates can’t be overwritten — save a copy to customise.
        </p>
      )}
    </div>
  );
}

function normalizeForEdit(t: ExcelTemplate): ExcelTemplate {
  return { ...t };
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (hexNoHash: string) => void;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <div className="mt-0.5 flex items-center gap-1.5">
        <input
          type="color"
          value={hx(value)}
          onChange={(e) => onChange(unhx(e.target.value))}
          className="h-8 w-9 cursor-pointer rounded border bg-card"
        />
        <span className="font-mono text-[11px] text-muted-foreground">#{value}</span>
      </div>
    </div>
  );
}

function BandField({
  draft,
  set,
}: {
  draft: ExcelTemplate;
  set: <K extends keyof ExcelTemplate>(k: K, v: ExcelTemplate[K]) => void;
}) {
  const on = draft.bandColor !== null;
  return (
    <div>
      <Label>Zebra stripe</Label>
      <div className="mt-0.5 flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={on}
          onChange={(e) => set("bandColor", e.target.checked ? "F5F5F5" : null)}
        />
        <input
          type="color"
          disabled={!on}
          value={hx(draft.bandColor ?? "F5F5F5")}
          onChange={(e) => set("bandColor", unhx(e.target.value))}
          className="h-8 w-9 cursor-pointer rounded border bg-card disabled:opacity-40"
        />
      </div>
    </div>
  );
}

function Preview({ t }: { t: ExcelTemplate }) {
  const cell = "px-2 py-1 text-[10px]";
  return (
    <div className="overflow-hidden rounded-md border" style={{ fontSize: 10 }}>
      {t.showTitleBlock && (
        <div className="px-2 pt-1.5 pb-0.5">
          <div className="font-bold" style={{ color: hx(t.titleColor) }}>
            Cost Audit
          </div>
          <div className="text-[9px] text-muted-foreground">All entities · FY 25-26</div>
        </div>
      )}
      <table className="w-full border-collapse">
        <thead>
          <tr style={{ background: hx(t.accent), color: hx(t.headerText) }}>
            <th className={cn(cell, "text-left font-semibold")}>Item</th>
            <th className={cn(cell, "text-right font-semibold")}>Amount</th>
            <th className={cn(cell, "text-right font-semibold")}>%</th>
          </tr>
        </thead>
        <tbody>
          {[
            ["COGS", `${t.currencySymbol}82,40,000`, "61.2%"],
            ["Payroll", `${t.currencySymbol}21,10,000`, "15.7%"],
          ].map((r, i) => (
            <tr key={i} style={{ background: t.bandColor && i % 2 === 1 ? hx(t.bandColor) : "#fff" }}>
              {r.map((c, j) => (
                <td key={j} className={cn(cell, j === 0 ? "text-left" : "text-right")}>
                  {c}
                </td>
              ))}
            </tr>
          ))}
          <tr style={{ background: hx(t.totalFill), color: hx(t.totalText) }} className="font-bold">
            <td className={cell}>Total</td>
            <td className={cn(cell, "text-right")}>{t.currencySymbol}1,34,60,000</td>
            <td className={cn(cell, "text-right")}>100%</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
