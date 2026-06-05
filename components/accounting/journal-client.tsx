"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { useReport } from "@/components/reports/use-report";
import { ReportControls } from "@/components/reports/report-controls";
import { PageHeader } from "@/components/shell/page-header";
import { Drawer } from "@/components/ui/modal";
import { Input, Select } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { allPostings, filteredPostings } from "@/lib/accounting/ledger";
import { CHART_OF_ACCOUNTS, accountSafe } from "@/lib/accounting/chart-of-accounts";
import { locationById, entityById } from "@/lib/accounting/org";
import type { Posting } from "@/lib/accounting/types";
import { cn, formatDate } from "@/lib/utils";

const PAGE = 200;

export function JournalClient() {
  const ctl = useReport();
  const [account, setAccount] = useState("all");
  const [q, setQ] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  const postings = useMemo(() => filteredPostings(ctl.filters), [
    ctl.filters.entityId,
    ctl.filters.locationId,
    ctl.filters.state,
    ctl.filters.basis,
    ctl.filters.from,
    ctl.filters.to,
  ]);

  const term = q.trim().toLowerCase();
  const rows = postings.filter(
    (p) =>
      (account === "all" || p.accountCode === account) &&
      (!term ||
        p.memo.toLowerCase().includes(term) ||
        p.category.toLowerCase().includes(term) ||
        (accountSafe(p.accountCode)?.name.toLowerCase().includes(term) ?? false)),
  );

  const totalDr = rows.reduce((s, p) => s + p.debit, 0);
  const totalCr = rows.reduce((s, p) => s + p.credit, 0);
  const shown = rows.slice(0, limit);

  // Full double-entry for the selected posting: every line sharing the same
  // business event and basis (one posting is just a single leg of the entry).
  const entryLines = useMemo(() => {
    if (!openId) return [] as Posting[];
    const sel = allPostings().find((p) => p.id === openId);
    if (!sel) return [] as Posting[];
    return allPostings().filter((p) => p.eventId === sel.eventId && p.basis === sel.basis && p.date === sel.date);
  }, [openId]);
  const selected = entryLines[0];
  const entryDr = entryLines.reduce((s, p) => s + p.debit, 0);
  const entryCr = entryLines.reduce((s, p) => s + p.credit, 0);

  return (
    <>
      <PageHeader
        title="General Ledger"
        subtitle={`Double-entry postings · ${ctl.basisLabel} · debits = credits by construction`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Select value={account} onChange={(e) => setAccount(e.target.value)} className="h-9 w-48">
              <option value="all">All accounts</option>
              {CHART_OF_ACCOUNTS.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} · {a.name}
                </option>
              ))}
            </Select>
            <div className="relative w-full sm:w-56">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search narration…" className="pl-8" />
            </div>
          </div>
        }
      />
      <ReportControls ctl={ctl} />

      <div className="mb-3 grid grid-cols-3 gap-3">
        <Stat label="Entries" value={rows.length.toLocaleString("en-IN")} />
        <Stat label="Total Debit" money={totalDr} />
        <Stat label="Total Credit" money={totalCr} />
      </div>

      <div className="overflow-x-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Account</th>
              <th className="px-4 py-2.5 font-medium">Narration</th>
              <th className="px-4 py-2.5 font-medium">Entity / Location</th>
              <th className="px-4 py-2.5 text-right font-medium">Debit</th>
              <th className="px-4 py-2.5 text-right font-medium">Credit</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((p) => {
              const acc = accountSafe(p.accountCode);
              const loc = locationById(p.locationId);
              const ent = entityById(p.entityId);
              return (
                <tr
                  key={p.id}
                  onClick={() => setOpenId(p.id)}
                  className="cursor-pointer border-b border-border/40 last:border-0 hover:bg-accent/30"
                >
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{formatDate(p.date)}</td>
                  <td className="px-4 py-2.5">
                    <span className="font-mono text-xs text-muted-foreground">{p.accountCode}</span>{" "}
                    <span className="font-medium">{acc?.name}</span>
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="block max-w-[280px] truncate">{p.memo}</span>
                    <Badge variant="default" className="mt-0.5">{p.category}</Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
                    {ent?.name} · {loc?.name}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular">{p.debit ? <Money value={p.debit} /> : <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular">{p.credit ? <Money value={p.credit} /> : <span className="text-muted-foreground">—</span>}</td>
                </tr>
              );
            })}
            {shown.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  No postings match the current filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {rows.length > limit && (
          <div className="border-t p-3 text-center">
            <button
              onClick={() => setLimit((l) => l + PAGE)}
              className="text-sm font-medium text-primary hover:underline"
            >
              Show more ({(rows.length - limit).toLocaleString("en-IN")} remaining)
            </button>
          </div>
        )}
      </div>

      <Drawer
        open={!!selected}
        onClose={() => setOpenId(null)}
        title="Journal entry"
        subtitle={selected ? `${formatDate(selected.date)} · ${selected.eventId}` : undefined}
        width="max-w-lg"
        actions={selected ? <Badge variant="default" className="uppercase">{selected.basis}</Badge> : undefined}
      >
        {selected && (
          <div className="space-y-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Narration</p>
              <p className="mt-1 text-sm">{selected.memo}</p>
              <Badge variant="default" className="mt-1.5">{selected.category}</Badge>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Entity" value={entityById(selected.entityId)?.name ?? "—"} />
              <Field label="Location" value={locationById(selected.locationId)?.name ?? "—"} />
              <Field label="State" value={selected.state} />
              <Field label="Currency" value={selected.currency} />
            </div>

            <div>
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">Postings</p>
              <div className="overflow-hidden rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
                      <th className="px-3 py-2 font-medium">Account</th>
                      <th className="px-3 py-2 text-right font-medium">Debit</th>
                      <th className="px-3 py-2 text-right font-medium">Credit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {entryLines.map((line) => {
                      const acc = accountSafe(line.accountCode);
                      return (
                        <tr key={line.id} className={cn("border-b border-border/40 last:border-0", line.id === openId && "bg-accent/40")}>
                          <td className="px-3 py-2">
                            <span className="font-mono text-xs text-muted-foreground">{line.accountCode}</span>{" "}
                            <span className="font-medium">{acc?.name}</span>
                          </td>
                          <td className="px-3 py-2 text-right tabular">{line.debit ? <Money value={line.debit} /> : <span className="text-muted-foreground">—</span>}</td>
                          <td className="px-3 py-2 text-right tabular">{line.credit ? <Money value={line.credit} /> : <span className="text-muted-foreground">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t bg-muted/30 font-semibold">
                      <td className="px-3 py-2 text-right">Total</td>
                      <td className="px-3 py-2 text-right tabular"><Money value={entryDr} /></td>
                      <td className="px-3 py-2 text-right tabular"><Money value={entryCr} /></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        )}
      </Drawer>
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

function Stat({ label, value, money }: { label: string; value?: string; money?: number }) {
  return (
    <div className="rounded-lg border bg-card p-3 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold tabular">
        {money !== undefined ? <Money value={money} compact /> : value}
      </p>
    </div>
  );
}
