"use client";

import * as React from "react";
import Link from "next/link";
import {
  Upload,
  Download,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Scale,
  FileSpreadsheet,
  ClipboardPaste,
  ArrowLeft,
  RefreshCw,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { useJournal } from "@/components/accounting/journal-provider";
import { CHART_OF_ACCOUNTS } from "@/lib/accounting/chart-of-accounts";
import { ENTITIES, ALL, locationsForEntity } from "@/lib/accounting/org";
import { VOUCHER_TYPES, nextVoucherNo } from "@/lib/accounting/manual-entries";
import { downloadCsv } from "@/lib/csv/csv";
import { downloadXlsx } from "@/lib/xlsx/xlsx";
import { readXlsxGrid } from "@/lib/xlsx/read-xlsx";
import {
  type EditableDoc,
  type EditableLine,
  type ParseResult,
  BOOKS_OPENING,
  blankDoc,
  blankLine,
  buildDraft,
  docTotals,
  parseUpload,
  parseUploadGrid,
  validateDoc,
} from "@/lib/accounting/journal-upload";
import { uploadTemplateCsv, uploadTemplateWorkbook } from "@/lib/accounting/upload-template";

const todayIso = () => new Date().toISOString().slice(0, 10);

/** SAP-style bulk document entry as a full page: a header section + line items
 *  per document, fully editable after an upload, validated live, committed only
 *  on confirm. */
export function JournalUploadScreen() {
  const prefs = usePrefs();
  const { entries, postMany } = useJournal();
  const today = React.useMemo(() => todayIso(), []);
  const defaultEntity = prefs.entityId !== ALL ? prefs.entityId : ENTITIES[0].id;

  const [docs, setDocs] = React.useState<EditableDoc[]>(() => [blankDoc(defaultEntity, todayIso())]);
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [parseError, setParseError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ posted: number } | null>(null);
  const [showPaste, setShowPaste] = React.useState(false);
  const [pasteText, setPasteText] = React.useState("");
  const [showIssues, setShowIssues] = React.useState(false);

  function startOver() {
    setDocs([blankDoc(defaultEntity, today)]);
    setFileName(null);
    setParseError(null);
    setDone(null);
    setShowPaste(false);
    setPasteText("");
  }

  function applyResult(res: ParseResult, name: string | null) {
    if (res.error) {
      setParseError(res.error);
      return;
    }
    setParseError(null);
    setFileName(name);
    setDocs(res.docs.length ? res.docs : [blankDoc(defaultEntity, today)]);
  }
  function ingest(text: string, name: string | null) {
    applyResult(parseUpload(text, today), name);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      if (/\.xlsx$/i.test(f.name)) {
        // Read the "Template" sheet of the workbook (falls back to the first sheet).
        const rows = await readXlsxGrid(new Uint8Array(await f.arrayBuffer()), "Template");
        applyResult(parseUploadGrid(rows, today), f.name);
      } else {
        ingest(await f.text(), f.name);
      }
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "Could not read that file.");
    }
    e.target.value = "";
  }

  // ---- per-document mutators ----
  const patchDoc = (id: string, patch: Partial<EditableDoc>) =>
    setDocs((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
  const changeEntity = (id: string, entityId: string) =>
    patchDoc(id, { entityId, locationId: locationsForEntity(entityId)[0]?.id ?? "" });
  const patchLine = (docId: string, lineId: string, patch: Partial<EditableLine>) =>
    setDocs((prev) =>
      prev.map((d) =>
        d.id === docId ? { ...d, lines: d.lines.map((l) => (l.id === lineId ? { ...l, ...patch } : l)) } : d,
      ),
    );
  // One amount per line: typing a debit clears the credit and vice-versa.
  const setAmount = (docId: string, lineId: string, side: "debit" | "credit", v: string) =>
    patchLine(docId, lineId, side === "debit" ? { debit: v, credit: "" } : { credit: v, debit: "" });
  const addLine = (docId: string) =>
    setDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, lines: [...d.lines, blankLine()] } : d)));
  const removeLine = (docId: string, lineId: string) =>
    setDocs((prev) =>
      prev.map((d) =>
        d.id === docId && d.lines.length > 2 ? { ...d, lines: d.lines.filter((l) => l.id !== lineId) } : d,
      ),
    );
  const addDoc = () => setDocs((prev) => [...prev, blankDoc(defaultEntity, today)]);
  const removeDoc = (id: string) => setDocs((prev) => (prev.length > 1 ? prev.filter((d) => d.id !== id) : prev));

  // ---- validation ----
  const validity = React.useMemo(
    () => docs.map((d) => ({ id: d.id, errors: validateDoc(d, today) })),
    [docs, today],
  );
  const readyCount = validity.filter((v) => v.errors.length === 0).length;
  const issues = docs
    .map((d, i) => ({ doc: d, index: i, errors: validity.find((v) => v.id === d.id)?.errors ?? [] }))
    .filter((x) => x.errors.length > 0);

  function postAll() {
    const drafts = docs.filter((d) => validateDoc(d, today).length === 0).map(buildDraft);
    if (drafts.length === 0) return;
    const { posted } = postMany(drafts);
    setDone({ posted });
  }

  if (done) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border bg-card py-16 text-center shadow-sm">
        <CheckCircle2 className="size-12 text-success" />
        <p className="text-xl font-bold">
          {done.posted} document{done.posted === 1 ? "" : "s"} posted
        </p>
        <p className="text-sm text-muted-foreground">Live in the ledger with gapless voucher numbers.</p>
        <div className="mt-2 flex items-center gap-2">
          <Link
            href="/journal-entries"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-4 text-sm font-medium hover:bg-accent"
          >
            <ArrowLeft className="size-4" /> Back to journal
          </Link>
          <Button onClick={startOver}>
            <Plus className="size-4" /> Upload more
          </Button>
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Upload Documents"
        subtitle="Header then line items — SAP-style. Files load into an editable preview; nothing posts until you confirm."
        actions={
          <Link
            href="/journal-entries"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-sm font-medium hover:bg-accent"
          >
            <ArrowLeft className="size-4" /> Back
          </Link>
        }
      />

      <div className="space-y-4 pb-24">
        {/* Source controls */}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3 shadow-sm">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
            <Upload className="size-4" /> Choose file
            <input
              type="file"
              accept=".csv,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={onFile}
              className="hidden"
            />
          </label>
          <Button variant="outline" size="sm" onClick={() => setShowPaste((s) => !s)}>
            <ClipboardPaste className="size-4" /> Paste
          </Button>
          {fileName && (
            <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
              <FileSpreadsheet className="size-3.5" /> {fileName}
            </span>
          )}
          <span className="ml-auto text-xs text-muted-foreground">Template:</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadXlsx("nexa-document-upload-template", uploadTemplateWorkbook(today))}
          >
            <FileSpreadsheet className="size-4" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => downloadCsv("nexa-document-upload-template", uploadTemplateCsv())}
          >
            <Download className="size-4" /> CSV
          </Button>
        </div>

        {showPaste && (
          <div>
            <textarea
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              rows={4}
              spellCheck={false}
              placeholder="Doc,Type,Date,Entity,Location,Basis,Narration,AutoReverse,ReverseDate,Account,Debit,Credit,LineText"
              className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <div className="mt-1.5 flex justify-end">
              <Button size="sm" disabled={!pasteText.trim()} onClick={() => ingest(pasteText, "pasted data")}>
                Load into editor
              </Button>
            </div>
          </div>
        )}

        {parseError && (
          <div className="flex items-start gap-2 rounded-md border border-danger/40 bg-danger/8 px-3 py-2 text-sm text-danger">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {parseError}
          </div>
        )}

        {/* Pre-flight validation check */}
        {issues.length === 0 ? (
          <div className="flex items-center gap-2 rounded-md border border-success/40 bg-success/8 px-3 py-2 text-sm text-success">
            <CheckCircle2 className="size-4 shrink-0" />
            Pre-flight check passed — all {docs.length} document{docs.length === 1 ? "" : "s"} balance and validate.
          </div>
        ) : (
          <div className="rounded-md border border-warning/40 bg-warning/8">
            <button
              onClick={() => setShowIssues((s) => !s)}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium text-warning"
            >
              <AlertTriangle className="size-4 shrink-0" />
              Pre-flight check: {readyCount} ready · {issues.length} need attention
              <span className="ml-auto text-xs font-normal underline">{showIssues ? "Hide" : "Review"}</span>
            </button>
            {showIssues && (
              <ul className="space-y-1.5 border-t border-warning/30 px-3 py-2 text-xs">
                {issues.map(({ doc, index, errors }) => (
                  <li key={doc.id}>
                    <span className="font-medium">
                      Document {index + 1}
                      {doc.ref ? ` (${doc.ref})` : ""}
                    </span>
                    <ul className="ml-3 mt-0.5 list-disc space-y-0.5 pl-3 text-danger marker:text-danger/60">
                      {errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {/* Documents */}
        <div className="space-y-3">
          {docs.map((doc, di) => (
            <DocCard
              key={doc.id}
              doc={doc}
              index={di}
              canRemove={docs.length > 1}
              voucherNo={nextVoucherNo(entries, doc.type)}
              errors={validity.find((v) => v.id === doc.id)?.errors ?? []}
              onPatch={(patch) => patchDoc(doc.id, patch)}
              onChangeEntity={(e) => changeEntity(doc.id, e)}
              onPatchLine={(lid, patch) => patchLine(doc.id, lid, patch)}
              onSetAmount={(lid, side, v) => setAmount(doc.id, lid, side, v)}
              onAddLine={() => addLine(doc.id)}
              onRemoveLine={(lid) => removeLine(doc.id, lid)}
              onRemoveDoc={() => removeDoc(doc.id)}
            />
          ))}
        </div>

        <button
          onClick={addDoc}
          className="inline-flex items-center gap-1.5 rounded-md border border-dashed px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        >
          <Plus className="size-4" /> Add document
        </button>
      </div>

      {/* Sticky action bar */}
      <div className="sticky bottom-0 -mx-4 flex items-center gap-3 border-t bg-card/95 px-4 py-3 shadow-[0_-1px_3px_rgba(0,0,0,0.04)] backdrop-blur">
        {readyCount > 0 ? (
          <Badge variant="success" className="gap-1">
            <CheckCircle2 className="size-3" /> {readyCount} of {docs.length} ready
          </Badge>
        ) : (
          <Badge variant="warning" className="gap-1">
            <AlertTriangle className="size-3" /> Nothing ready to post
          </Badge>
        )}
        <Button className="ml-auto" onClick={postAll} disabled={readyCount === 0}>
          Post {readyCount} document{readyCount === 1 ? "" : "s"}
        </Button>
      </div>
    </>
  );
}

function DocCard({
  doc,
  index,
  canRemove,
  voucherNo,
  errors,
  onPatch,
  onChangeEntity,
  onPatchLine,
  onSetAmount,
  onAddLine,
  onRemoveLine,
  onRemoveDoc,
}: {
  doc: EditableDoc;
  index: number;
  canRemove: boolean;
  voucherNo: string;
  errors: string[];
  onPatch: (patch: Partial<EditableDoc>) => void;
  onChangeEntity: (entityId: string) => void;
  onPatchLine: (lineId: string, patch: Partial<EditableLine>) => void;
  onSetAmount: (lineId: string, side: "debit" | "credit", v: string) => void;
  onAddLine: () => void;
  onRemoveLine: (lineId: string) => void;
  onRemoveDoc: () => void;
}) {
  const totals = docTotals(doc);
  const locations = locationsForEntity(doc.entityId);
  const ok = errors.length === 0;

  return (
    <div className={cn("overflow-hidden rounded-xl border shadow-sm", ok ? "border-border" : "border-danger/40")}>
      {/* Document header (SAP-style) */}
      <div className="flex items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Document {index + 1}
          </span>
          <Badge variant="primary" className="font-mono">{voucherNo}</Badge>
          {ok ? (
            <Badge variant="success" className="gap-1">
              <Scale className="size-3" /> Balanced
            </Badge>
          ) : (
            <Badge variant="warning" className="gap-1">
              <AlertTriangle className="size-3" /> Needs fixing
            </Badge>
          )}
        </div>
        {canRemove && (
          <button
            onClick={onRemoveDoc}
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-danger"
            aria-label="Remove document"
          >
            <Trash2 className="size-4" />
          </button>
        )}
      </div>

      <div className="space-y-3 p-3">
        {/* Header fields */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <div>
            <Label>Type</Label>
            <Select value={doc.type} onChange={(e) => onPatch({ type: e.target.value as EditableDoc["type"] })} className="mt-1">
              {VOUCHER_TYPES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Date</Label>
            <Input
              type="date"
              value={doc.date}
              min={BOOKS_OPENING}
              max={todayIso()}
              onChange={(e) => onPatch({ date: e.target.value })}
              className="mt-1"
            />
          </div>
          <div>
            <Label>Entity</Label>
            <Select value={doc.entityId} onChange={(e) => onChangeEntity(e.target.value)} className="mt-1">
              {ENTITIES.map((en) => (
                <option key={en.id} value={en.id}>
                  {en.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Location</Label>
            <Select value={doc.locationId} onChange={(e) => onPatch({ locationId: e.target.value })} className="mt-1">
              {locations.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label>Basis</Label>
            <Select value={doc.basis} onChange={(e) => onPatch({ basis: e.target.value as EditableDoc["basis"] })} className="mt-1">
              <option value="accrual">Accrual</option>
              <option value="cash">Cash</option>
              <option value="both">Both ledgers</option>
            </Select>
          </div>
          <div className="col-span-2 sm:col-span-3">
            <Label>Header text / narration</Label>
            <Input
              value={doc.narration}
              onChange={(e) => onPatch({ narration: e.target.value })}
              placeholder="What is this document for?"
              className="mt-1"
            />
          </div>
        </div>

        {/* Auto-reverse (accruals / provisions) */}
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-dashed p-2.5">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={doc.autoReverse}
              onChange={(e) => onPatch({ autoReverse: e.target.checked, reverseDate: e.target.checked ? doc.reverseDate || doc.date : "" })}
              className="size-4 rounded border-input"
            />
            <RefreshCw className="size-4 text-muted-foreground" /> Auto-reverse
          </label>
          {doc.autoReverse && (
            <div className="flex items-center gap-2">
              <Label htmlFor={`rev-${doc.id}`}>on</Label>
              <Input
                id={`rev-${doc.id}`}
                type="date"
                value={doc.reverseDate}
                min={doc.date}
                onChange={(e) => onPatch({ reverseDate: e.target.value })}
                className="h-8 w-[150px]"
              />
              <span className="text-xs text-muted-foreground">posts an offsetting voucher on this date</span>
            </div>
          )}
        </div>

        {/* Line items */}
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                <th className="w-8 px-2 py-2 text-center font-medium">#</th>
                <th className="px-3 py-2 font-medium">G/L Account</th>
                <th className="px-3 py-2 font-medium">Line text</th>
                <th className="w-32 px-3 py-2 text-right font-medium">Debit</th>
                <th className="w-32 px-3 py-2 text-right font-medium">Credit</th>
                <th className="w-9 px-2 py-2" />
              </tr>
            </thead>
            <tbody>
              {doc.lines.map((l, li) => (
                <tr key={l.id} className="border-b border-border/40 last:border-0">
                  <td className="px-2 py-1.5 text-center text-xs text-muted-foreground tabular">{li + 1}</td>
                  <td className="px-3 py-1.5">
                    <Select value={l.accountCode} onChange={(e) => onPatchLine(l.id, { accountCode: e.target.value })}>
                      <option value="">Select account…</option>
                      {CHART_OF_ACCOUNTS.map((a) => (
                        <option key={a.code} value={a.code}>
                          {a.code} · {a.name}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      value={l.text}
                      onChange={(e) => onPatchLine(l.id, { text: e.target.value })}
                      placeholder="—"
                      className="h-9"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={l.debit}
                      onChange={(e) => onSetAmount(l.id, "debit", e.target.value)}
                      placeholder="0.00"
                      className="text-right tabular"
                    />
                  </td>
                  <td className="px-3 py-1.5">
                    <Input
                      type="number"
                      min={0}
                      value={l.credit}
                      onChange={(e) => onSetAmount(l.id, "credit", e.target.value)}
                      placeholder="0.00"
                      className="text-right tabular"
                    />
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => onRemoveLine(l.id)}
                      disabled={doc.lines.length <= 2}
                      className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-danger disabled:opacity-30"
                      aria-label="Remove line"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t bg-muted/30">
                <td colSpan={3} className="px-3 py-2">
                  <button onClick={onAddLine} className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    <Plus className="size-3.5" /> Add line
                  </button>
                </td>
                <td className="px-3 py-2 text-right tabular font-semibold">
                  <Money value={totals.debit} />
                </td>
                <td className="px-3 py-2 text-right tabular font-semibold">
                  <Money value={totals.credit} />
                </td>
                <td />
              </tr>
              {!totals.balanced && (
                <tr className="border-t bg-warning/8 text-xs">
                  <td colSpan={3} className="px-3 py-1.5 text-right font-medium text-warning">
                    Out of balance by
                  </td>
                  <td colSpan={2} className="px-3 py-1.5 text-right tabular font-semibold text-warning">
                    <Money value={Math.abs(totals.difference)} />
                  </td>
                  <td />
                </tr>
              )}
            </tfoot>
          </table>
        </div>

        {errors.length > 0 && (
          <ul className="space-y-0.5 text-xs text-danger">
            {errors.map((e, i) => (
              <li key={i} className="flex gap-1.5">
                <span>•</span>
                <span>{e}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
