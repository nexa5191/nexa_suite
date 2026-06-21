"use client";

import * as React from "react";
import Link from "next/link";
import { PackageOpen, Plus, Trash2, ChevronRight, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { ITEMS, itemById, itemName } from "@/lib/inventory/items";
import { ACTIVE_EMPLOYEES, employeeName } from "@/lib/hr/employees";
import { LOCATIONS } from "@/lib/accounting/org";
import { appendMovements, buildStockIndex, allMovements, loadAddedMovements, stockAt } from "@/lib/inventory/movements";
import {
  allIssues, loadIssues, saveIssues, nextIssueRef,
  buildIssueMovements, ISSUE_STATUS_META,
  type MaterialIssue, type IssueLine,
} from "@/lib/inventory/supply-chain";

function fmtQty(n: number, uom?: string) {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(n) + (uom ? ` ${uom}` : "");
}

const TODAY = "2026-06-22";

// Items that can be issued from stores to production (raw + packing + semi-finished)
const ISSUABLE = ITEMS.filter((it) => ["raw", "packing", "semi-finished"].includes(it.category));

export function IssuesClient() {
  const [added, setAdded] = React.useState<MaterialIssue[]>([]);
  const [selected, setSelected] = React.useState<MaterialIssue | null>(null);
  const [creating, setCreating] = React.useState(false);

  React.useEffect(() => { setAdded(loadIssues()); }, []);

  const SEED_IDS = ["mis-001", "mis-002"];

  function persist(next: MaterialIssue[]) {
    const extra = next.filter((m) => !SEED_IDS.includes(m.id));
    setAdded(extra);
    saveIssues(extra);
  }

  const issues = allIssues(added);

  function postIssue(id: string) {
    const issue = issues.find((m) => m.id === id);
    if (!issue || issue.status === "posted") return;
    appendMovements(buildIssueMovements(issue));
    const next = issues.map((m) => m.id === id ? { ...m, status: "posted" as const } : m);
    persist(next);
    setSelected(next.find((m) => m.id === id) ?? null);
  }

  const drafts = issues.filter((m) => m.status === "draft").length;

  return (
    <>
      <PageHeader
        title="Material Issues"
        subtitle="Issue raw materials and packing from the store to production. Posting records consumption movements in inventory."
        actions={
          <div className="flex gap-2">
            <Link href="/inventory"><Button variant="outline">Back to Inventory</Button></Link>
            <Button onClick={() => setCreating(true)}><Plus className="size-4" /> New Issue</Button>
          </div>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total issues" value={String(issues.length)} />
        <StatCard label="Draft (unposted)" value={String(drafts)} highlight={drafts > 0} />
        <StatCard label="Posted" value={String(issues.filter((m) => m.status === "posted").length)} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground text-left">
                <th className="px-5 py-3 font-medium">Ref / Date</th>
                <th className="px-5 py-3 font-medium">Production ref</th>
                <th className="px-5 py-3 font-medium">Location</th>
                <th className="px-5 py-3 font-medium">Items issued</th>
                <th className="px-5 py-3 font-medium">Issued by</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {issues.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-10 text-center text-muted-foreground">No material issues yet.</td></tr>
              )}
              {issues.map((mis) => {
                const meta = ISSUE_STATUS_META[mis.status];
                const loc = LOCATIONS.find((l) => l.id === mis.locationId);
                return (
                  <tr
                    key={mis.id}
                    onClick={() => setSelected(mis)}
                    className="cursor-pointer border-b last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-mono font-medium text-xs">{mis.ref}</p>
                      <p className="text-xs text-muted-foreground">{mis.date}</p>
                    </td>
                    <td className="px-5 py-3 font-mono text-xs text-muted-foreground">{mis.productionRef ?? "—"}</td>
                    <td className="px-5 py-3 text-xs">{loc?.name ?? mis.locationId}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {mis.lines.slice(0, 2).map((l) => (
                          <span key={l.itemId} className="rounded border bg-muted/30 px-1.5 py-0.5 text-[11px]">
                            {itemName(l.itemId)} × {fmtQty(l.qty)}
                          </span>
                        ))}
                        {mis.lines.length > 2 && <span className="text-[11px] text-muted-foreground">+{mis.lines.length - 2}</span>}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-xs">{employeeName(mis.issuedBy)}</td>
                    <td className="px-5 py-3"><Badge variant={meta.variant}>{meta.label}</Badge></td>
                    <td className="px-5 py-3"><ChevronRight className="size-4 text-muted-foreground/50" /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <IssueDetailDrawer
          issue={selected}
          onClose={() => setSelected(null)}
          onPost={() => postIssue(selected.id)}
        />
      )}

      {creating && (
        <CreateIssueDrawer
          onClose={() => setCreating(false)}
          onCreate={(mis) => {
            const next = [...issues, mis];
            persist(next);
            setCreating(false);
            setSelected(mis);
          }}
          nextRef={nextIssueRef(added)}
        />
      )}
    </>
  );
}

function IssueDetailDrawer({ issue, onClose, onPost }: {
  issue: MaterialIssue;
  onClose: () => void;
  onPost: () => void;
}) {
  const meta = ISSUE_STATUS_META[issue.status];
  const loc = LOCATIONS.find((l) => l.id === issue.locationId);
  return (
    <Drawer
      open
      onClose={onClose}
      title={<span className="flex items-center gap-1.5"><PackageOpen className="size-4 text-muted-foreground" />{issue.ref}</span>}
      subtitle={issue.date}
      actions={<Badge variant={meta.variant}>{meta.label}</Badge>}
    >
      <div className="space-y-5">
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Location" value={loc?.name ?? issue.locationId} />
          <Field label="Issued by" value={employeeName(issue.issuedBy)} />
          {issue.productionRef && <Field label="Production order" value={issue.productionRef} />}
          {issue.note && <Field label="Note" value={issue.note} className="col-span-2" />}
        </dl>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Items issued</p>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground text-left">
                <th className="py-1.5 font-medium">Item</th>
                <th className="py-1.5 font-medium">Category</th>
                <th className="py-1.5 text-right font-medium">Qty issued</th>
              </tr>
            </thead>
            <tbody>
              {issue.lines.map((l) => {
                const item = itemById(l.itemId);
                return (
                  <tr key={l.itemId} className="border-b last:border-0">
                    <td className="py-2">{itemName(l.itemId)}</td>
                    <td className="py-2 text-xs capitalize text-muted-foreground">{item?.category}</td>
                    <td className="py-2 text-right tabular-nums font-semibold">{fmtQty(l.qty, item?.uom)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="border-t pt-4">
          {issue.status === "draft" && (
            <>
              <p className="mb-3 text-xs text-muted-foreground">
                Posting will deduct the issued quantities from stock at {loc?.name} and record consumption movements.
              </p>
              <Button onClick={onPost}>
                <CheckCircle2 className="size-4" /> Post to inventory
              </Button>
            </>
          )}
          {issue.status === "posted" && (
            <div className="flex items-center gap-2 rounded-lg border border-success/30 bg-success/5 px-3 py-2 text-xs text-success">
              <CheckCircle2 className="size-4" />
              Posted — consumption movements recorded.
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

function CreateIssueDrawer({ onClose, onCreate, nextRef }: {
  onClose: () => void;
  onCreate: (mis: MaterialIssue) => void;
  nextRef: string;
}) {
  const [locationId, setLocationId] = React.useState("loc-mys");
  const [issuedBy, setIssuedBy] = React.useState("emp-021");
  const [productionRef, setProductionRef] = React.useState("");
  const [note, setNote] = React.useState("");
  const [lines, setLines] = React.useState<IssueLine[]>([{ itemId: ISSUABLE[0]?.id ?? "", qty: 0 }]);
  const [idx, setIdx] = React.useState(() => buildStockIndex(allMovements([])));

  React.useEffect(() => {
    setIdx(buildStockIndex(allMovements(loadAddedMovements())));
  }, []);

  function addLine() { setLines((p) => [...p, { itemId: ISSUABLE[0]?.id ?? "", qty: 0 }]); }
  function removeLine(i: number) { setLines((p) => p.filter((_, j) => j !== i)); }
  function updateLine(i: number, patch: Partial<IssueLine>) {
    setLines((p) => p.map((l, j) => j === i ? { ...l, ...patch } : l));
  }

  const valid = lines.length > 0 && lines.every((l) => l.qty > 0 && l.itemId);

  return (
    <Drawer open onClose={onClose} title="New Material Issue" subtitle={nextRef}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Issue from</span>
            <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-9">
              {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </Select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Issued by</span>
            <Select value={issuedBy} onChange={(e) => setIssuedBy(e.target.value)} className="h-9">
              {ACTIVE_EMPLOYEES.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
            </Select>
          </label>
          <label className="block col-span-2">
            <span className="mb-1 block text-xs font-medium text-muted-foreground">Production order (optional)</span>
            <Input
              value={productionRef}
              onChange={(e) => setProductionRef(e.target.value)}
              placeholder="PROD-3010"
              className="h-9"
            />
          </label>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">Items to issue</p>
          <div className="space-y-2">
            {lines.map((l, i) => {
              const item = itemById(l.itemId);
              const avail = item ? stockAt(idx, item.id, locationId) : 0;
              const overIssue = l.qty > avail;
              return (
                <div key={i} className={cn("rounded-lg border p-2.5 space-y-1", overIssue && "border-warning/50 bg-warning/5")}>
                  <div className="flex items-center gap-2">
                    <Select
                      value={l.itemId}
                      onChange={(e) => updateLine(i, { itemId: e.target.value })}
                      className="h-8 flex-1 text-xs"
                    >
                      {ISSUABLE.map((it) => <option key={it.id} value={it.id}>{it.name} ({it.uom})</option>)}
                    </Select>
                    <Input
                      type="number" min={1}
                      value={l.qty || ""}
                      onChange={(e) => updateLine(i, { qty: Number(e.target.value) })}
                      placeholder="Qty"
                      className={cn("h-8 w-24 text-right tabular", overIssue && "border-warning")}
                    />
                    <span className="w-6 text-xs text-muted-foreground">{item?.uom}</span>
                    <button onClick={() => removeLine(i)} className="text-muted-foreground hover:text-danger">
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                  <p className={cn("text-[11px] pl-1", overIssue ? "text-warning font-medium" : "text-muted-foreground")}>
                    Available at {LOCATIONS.find((loc) => loc.id === locationId)?.name}: {fmtQty(avail, item?.uom)}
                    {overIssue && " — over-issue warning"}
                  </p>
                </div>
              );
            })}
          </div>
          <Button size="sm" variant="ghost" onClick={addLine} className="mt-2">
            <Plus className="size-3.5" /> Add item
          </Button>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted-foreground">Note</span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Production run details…" className="h-9" />
        </label>

        <div className="flex gap-2 border-t pt-4">
          <Button onClick={() => onCreate({
            id: `mis-${Date.now()}`,
            ref: nextRef,
            date: TODAY,
            productionRef: productionRef.trim() || undefined,
            locationId,
            issuedBy,
            lines,
            note: note.trim() || undefined,
            status: "draft",
          })} disabled={!valid}>Save issue</Button>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </Drawer>
  );
}

function StatCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", highlight && "border-warning/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular", highlight && "text-warning")}>{value}</p>
    </Card>
  );
}

function Field({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm">{value}</dd>
    </div>
  );
}
