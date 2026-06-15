"use client";

import * as React from "react";
import { Upload, Download, FileSpreadsheet, CheckCircle2, AlertTriangle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { useJournal } from "@/components/accounting/journal-provider";
import { parseJournalImport, importTemplateCsv, IMPORT_COLUMNS, type ImportResult } from "@/lib/accounting/journal-import";
import { downloadCsv } from "@/lib/csv/csv";

export function JournalImport({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { postMany } = useJournal();
  const [text, setText] = React.useState("");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [done, setDone] = React.useState<{ posted: number } | null>(null);
  const today = React.useMemo(() => new Date().toISOString().slice(0, 10), []);

  const result: ImportResult | null = React.useMemo(
    () => (text.trim() ? parseJournalImport(text, today) : null),
    [text, today],
  );

  function reset() {
    setText("");
    setFileName(null);
    setDone(null);
  }
  function close() {
    reset();
    onClose();
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    setText(await f.text());
    e.target.value = ""; // allow re-selecting the same file
  }

  function postAll() {
    if (!result) return;
    const drafts = result.vouchers.filter((v) => v.valid && v.draft).map((v) => v.draft!);
    const { posted } = postMany(drafts);
    setDone({ posted });
  }

  return (
    <Modal
      open={open}
      onClose={close}
      title="Import journal entries"
      description="Bulk-post vouchers from a CSV. Lines sharing a Ref become one balanced voucher."
      className="max-w-3xl"
      footer={
        done ? (
          <Button onClick={close}>Done</Button>
        ) : (
          <>
            <Button variant="ghost" onClick={close}>Cancel</Button>
            <Button onClick={postAll} disabled={!result || result.validCount === 0}>
              Post {result?.validCount ?? 0} voucher{result?.validCount === 1 ? "" : "s"}
            </Button>
          </>
        )
      }
    >
      {done ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle2 className="size-10 text-success" />
          <p className="text-lg font-semibold">{done.posted} voucher{done.posted === 1 ? "" : "s"} posted</p>
          <p className="text-sm text-muted-foreground">They’re live in the ledger with gapless JV numbers.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Source controls */}
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border bg-card px-3 py-1.5 text-sm font-medium shadow-sm transition-colors hover:bg-accent">
              <Upload className="size-4" /> Choose CSV file
              <input type="file" accept=".csv,text/csv,text/plain" onChange={onFile} className="hidden" />
            </label>
            {fileName && <span className="text-xs text-muted-foreground">{fileName}</span>}
            <Button
              variant="outline"
              size="sm"
              className="ml-auto"
              onClick={() => downloadCsv("nexa-journal-import-template", importTemplateCsv())}
            >
              <Download className="size-4" /> Template
            </Button>
          </div>

          {/* Paste area */}
          <div>
            <p className="mb-1 text-xs font-medium text-muted-foreground">…or paste CSV here</p>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              rows={5}
              spellCheck={false}
              placeholder={IMPORT_COLUMNS.join(",")}
              className="w-full rounded-md border border-input bg-card px-3 py-2 font-mono text-xs shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>

          {/* Preview */}
          {result?.headerError && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertTriangle className="mt-0.5 size-4 shrink-0" /> {result.headerError}
            </div>
          )}

          {result && !result.headerError && (
            <>
              <div className="flex items-center gap-2 text-sm">
                <FileSpreadsheet className="size-4 text-muted-foreground" />
                <span>
                  <strong>{result.validCount}</strong> of {result.totalCount} voucher{result.totalCount === 1 ? "" : "s"} ready
                </span>
                {result.validCount < result.totalCount && (
                  <Badge variant="warning">{result.totalCount - result.validCount} need fixing</Badge>
                )}
              </div>

              <div className="max-h-[40vh] overflow-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-muted text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 font-medium">Ref</th>
                      <th className="px-3 py-2 font-medium">Date</th>
                      <th className="px-3 py-2 font-medium">Narration</th>
                      <th className="px-3 py-2 font-medium">Entity</th>
                      <th className="px-3 py-2 text-right font-medium">Dr</th>
                      <th className="px-3 py-2 text-right font-medium">Cr</th>
                      <th className="px-3 py-2 font-medium">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.vouchers.map((v) => (
                      <tr key={v.ref} className="border-t border-border/40 align-top">
                        <td className="px-3 py-2 font-mono text-xs">{v.ref}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{v.date}</td>
                        <td className="px-3 py-2">
                          <span className="block max-w-[200px] truncate">{v.narration || <span className="text-muted-foreground">—</span>}</span>
                          {v.errors.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-[11px] text-destructive">
                              {v.errors.map((e, i) => <li key={i}>• {e}</li>)}
                            </ul>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">{v.entityName}</td>
                        <td className="px-3 py-2 text-right tabular"><Money value={v.totals.debit} /></td>
                        <td className="px-3 py-2 text-right tabular"><Money value={v.totals.credit} /></td>
                        <td className="px-3 py-2">
                          {v.valid ? (
                            <Badge variant="success">Ready</Badge>
                          ) : (
                            <Badge variant="danger">Error</Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!result && (
            <p className="rounded-md border border-dashed bg-muted/30 px-3 py-6 text-center text-sm text-muted-foreground">
              Columns: <span className="font-mono">{IMPORT_COLUMNS.join(", ")}</span>. Entity, Location and Account accept the name or the code.
            </p>
          )}
        </div>
      )}
    </Modal>
  );
}
