"use client";

import * as React from "react";
import Link from "next/link";
import {
  Plus, X, Tag as TagIcon, StickyNote, Phone, Users, Mail, Handshake,
  GitBranch, Receipt, Building2, Globe, PhoneCall, Check,
  ChevronRight, FileDown, Search,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { employeeName } from "@/lib/hr/employees";
import { entityById } from "@/lib/accounting/org";
import {
  ACCOUNTS,
  CRM_TAGS,
  EVENT_TYPES,
  PIPELINE_STAGES,
  OPEN_STAGES,
  stageMeta,
  tagById,
  accountById,
  contactsForAccount,
  primaryContact,
  journeyForAccount,
  effectiveStage,
  effectiveTags,
  loadAddedEvents,
  saveAddedEvents,
  loadTagOverrides,
  saveTagOverrides,
  loadStageOverrides,
  saveStageOverrides,
  type JourneyEvent,
  type EventType,
  type PipelineStage,
  type CrmAccount,
} from "@/lib/crm";

const EVENT_ICON: Record<EventType, React.ComponentType<{ className?: string }>> = {
  note: StickyNote,
  call: Phone,
  meeting: Users,
  email: Mail,
  deal: Handshake,
  stage: GitBranch,
  invoice: Receipt,
};

export function CrmClient() {
  const [added, setAdded] = React.useState<JourneyEvent[]>([]);
  const [tagOverrides, setTagOverrides] = React.useState<Record<string, string[]>>({});
  const [stageOverrides, setStageOverrides] = React.useState<Record<string, PipelineStage>>({});
  const [selectedId, setSelectedId] = React.useState(ACCOUNTS[0]?.id ?? "");
  const [query, setQuery] = React.useState("");
  const [seq, setSeq] = React.useState(1); // deterministic id counter for new events

  React.useEffect(() => {
    const ev = loadAddedEvents();
    setAdded(ev);
    setTagOverrides(loadTagOverrides());
    setStageOverrides(loadStageOverrides());
    setSeq(ev.length + 1);
  }, []);

  const account = accountById(selectedId)!;
  const stage = effectiveStage(account, stageOverrides);

  // ---- pipeline summary ----
  const accountsWithStage = ACCOUNTS.map((a) => ({ a, stage: effectiveStage(a, stageOverrides) }));

  // ---- client search (name, legal name, industry, owner, entity, contacts,
  // email / phone / website / GSTIN) — all terms must match (AND). ----
  const matchesQuery = (a: CrmAccount, st: PipelineStage) => {
    const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return true;
    const contacts = contactsForAccount(a.id)
      .map((c) => `${c.name} ${c.title} ${c.email}`)
      .join(" ");
    const hay = [
      a.name, a.legalName, a.industry, a.email, a.phone, a.website, a.gstin,
      employeeName(a.ownerId), entityById(a.entityId)?.name ?? "", stageMeta(st).label, contacts,
    ]
      .join(" ")
      .toLowerCase();
    return terms.every((t) => hay.includes(t));
  };
  const filteredAccounts = accountsWithStage.filter(({ a, stage: st }) => matchesQuery(a, st));
  const openValue = accountsWithStage
    .filter((x) => OPEN_STAGES.includes(x.stage))
    .reduce((s, x) => s + x.a.dealValue, 0);
  const wonValue = accountsWithStage.filter((x) => x.stage === "won").reduce((s, x) => s + x.a.dealValue, 0);

  const journey = journeyForAccount(selectedId, added);

  // ---- mutations ----
  function persistAdded(next: JourneyEvent[]) {
    setAdded(next);
    saveAddedEvents(next);
  }
  function persistTags(next: Record<string, string[]>) {
    setTagOverrides(next);
    saveTagOverrides(next);
  }

  function toggleTag(ev: JourneyEvent, tagId: string) {
    const current = effectiveTags(ev, tagOverrides);
    const nextTags = current.includes(tagId) ? current.filter((t) => t !== tagId) : [...current, tagId];
    persistTags({ ...tagOverrides, [ev.id]: nextTags });
  }

  function changeStage(next: PipelineStage) {
    const updated = { ...stageOverrides, [account.id]: next };
    setStageOverrides(updated);
    saveStageOverrides(updated);
    // log a stage-change event on the journey
    const ev: JourneyEvent = {
      id: `evt-user-${seq}`,
      accountId: account.id,
      date: "2026-06-05",
      type: "stage",
      title: `Stage → ${stageMeta(next).label}`,
      detail: `Moved from ${stageMeta(stage).label} to ${stageMeta(next).label}.`,
      tags: [],
      authorId: account.ownerId,
    };
    setSeq((n) => n + 1);
    persistAdded([...added, ev]);
  }

  function addEvent(ev: Omit<JourneyEvent, "id" | "accountId">) {
    const full: JourneyEvent = { ...ev, id: `evt-user-${seq}`, accountId: account.id };
    setSeq((n) => n + 1);
    persistAdded([...added, full]);
  }

  return (
    <>
      <PageHeader
        title="CRM"
        subtitle="Sales accounts, pipeline and a tagged customer-journey timeline."
        actions={
          <Link href="/invoicing/new">
            <Button variant="outline">
              <FileDown className="size-4" /> Raise invoice
            </Button>
          </Link>
        }
      />

      {/* Pipeline summary */}
      <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Accounts" value={String(ACCOUNTS.length)} />
        <Metric label="Open deals" value={String(accountsWithStage.filter((x) => OPEN_STAGES.includes(x.stage)).length)} />
        <MetricMoney label="Open pipeline" value={openValue} />
        <MetricMoney label="Won (ACV)" value={wonValue} />
      </div>

      {/* Pipeline lanes */}
      <Card className="mb-4 p-4">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Pipeline</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {PIPELINE_STAGES.map((st) => {
            const items = accountsWithStage.filter((x) => x.stage === st.key);
            const value = items.reduce((s, x) => s + x.a.dealValue, 0);
            return (
              <div key={st.key} className="rounded-lg border bg-muted/20 p-2.5">
                <div className="flex items-center justify-between">
                  <Badge variant={st.variant}>{st.label}</Badge>
                  <span className="text-xs text-muted-foreground">{items.length}</span>
                </div>
                <p className="mt-2 text-sm font-semibold tabular">
                  <Money value={value} compact />
                </p>
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        {/* LEFT — searchable account list */}
        <div className="space-y-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search clients…"
              aria-label="Search clients"
              className="pl-8 pr-8"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {query && (
            <p className="px-1 text-xs text-muted-foreground">
              {filteredAccounts.length} of {ACCOUNTS.length} clients
            </p>
          )}

          {filteredAccounts.map(({ a, stage: st }) => (
            <button
              key={a.id}
              onClick={() => setSelectedId(a.id)}
              className={cn(
                "w-full rounded-lg border p-3 text-left transition-colors",
                a.id === selectedId ? "border-primary bg-primary/5 ring-1 ring-primary/30" : "hover:bg-accent/50",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{a.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{a.industry}</p>
                </div>
                <Badge variant={stageMeta(st).variant} className="shrink-0 text-[10px]">
                  {stageMeta(st).label}
                </Badge>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                <span>{employeeName(a.ownerId)}</span>
                <Money value={a.dealValue} compact className="font-medium text-foreground" />
              </div>
            </button>
          ))}

          {filteredAccounts.length === 0 && (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No clients match “{query}”.
            </div>
          )}
        </div>

        {/* RIGHT — account detail + journey */}
        <div className="space-y-4">
          <AccountHeader
            accountId={account.id}
            stage={stage}
            onStageChange={changeStage}
          />
          <AddEventForm onAdd={addEvent} />
          <Timeline
            events={journey}
            tagOverrides={tagOverrides}
            onToggleTag={toggleTag}
          />
        </div>
      </div>
    </>
  );
}

function AccountHeader({
  accountId,
  stage,
  onStageChange,
}: {
  accountId: string;
  stage: PipelineStage;
  onStageChange: (s: PipelineStage) => void;
}) {
  const acc = accountById(accountId)!;
  const contacts = contactsForAccount(accountId);
  const primary = primaryContact(accountId);
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Building2 className="size-5" />
          </span>
          <div>
            <p className="text-lg font-bold leading-tight">{acc.name}</p>
            <p className="text-sm text-muted-foreground">
              {acc.legalName} · {acc.industry}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Stage</span>
          <Select value={stage} onChange={(e) => onStageChange(e.target.value as PipelineStage)} className="h-8 w-36 text-xs">
            {PIPELINE_STAGES.map((s) => (
              <option key={s.key} value={s.key}>
                {s.label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="mt-4 grid gap-3 border-t pt-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
        <Info label="Owner" value={employeeName(acc.ownerId)} />
        <Info label="Billing entity" value={entityById(acc.entityId)?.name ?? "—"} />
        <Info label="Deal value" value={<Money value={acc.dealValue} />} />
        <Info label="Customer since" value={formatDate(acc.since)} />
      </div>

      <div className="mt-4 grid gap-3 border-t pt-4 sm:grid-cols-2">
        <div className="space-y-1 text-xs text-muted-foreground">
          <p className="flex items-center gap-1.5"><Globe className="size-3.5" /> {acc.website}</p>
          <p className="flex items-center gap-1.5"><Mail className="size-3.5" /> {acc.email}</p>
          <p className="flex items-center gap-1.5"><PhoneCall className="size-3.5" /> {acc.phone}</p>
          {acc.gstin !== "—" && <p className="font-mono">{acc.gstin}</p>}
        </div>
        <div>
          <p className="mb-1.5 text-xs font-medium text-muted-foreground">Contacts</p>
          <div className="space-y-1">
            {contacts.map((c) => (
              <div key={c.id} className="flex items-center justify-between text-sm">
                <span>
                  {c.name} <span className="text-xs text-muted-foreground">· {c.title}</span>
                </span>
                {c.primary && <Badge variant="primary" className="text-[10px]">Primary</Badge>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}

function AddEventForm({ onAdd }: { onAdd: (ev: Omit<JourneyEvent, "id" | "accountId">) => void }) {
  const [open, setOpen] = React.useState(false);
  const [type, setType] = React.useState<EventType>("note");
  const [title, setTitle] = React.useState("");
  const [detail, setDetail] = React.useState("");
  const [date, setDate] = React.useState("2026-06-05");
  const [tags, setTags] = React.useState<string[]>([]);

  function submit() {
    if (!title.trim()) return;
    onAdd({ type, title: title.trim(), detail: detail.trim(), date, tags, authorId: "emp-003" });
    setTitle("");
    setDetail("");
    setTags([]);
    setType("note");
    setOpen(false);
  }

  if (!open) {
    return (
      <Button variant="outline" className="w-full" onClick={() => setOpen(true)}>
        <Plus className="size-4" /> Log an interaction
      </Button>
    );
  }

  return (
    <Card className="space-y-3 border-primary/30 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Log an interaction</p>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="size-4" />
        </button>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Type</span>
          <Select value={type} onChange={(e) => setType(e.target.value as EventType)} className="w-full">
            {EVENT_TYPES.filter((t) => t.key !== "stage").map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </Select>
        </label>
        <label className="block sm:col-span-2">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Title</span>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Pricing call with buyer" />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Detail</span>
        <Input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder="What happened, next steps…" />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[160px_1fr]">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Date</span>
          <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-muted-foreground">Tags</span>
          <div className="flex flex-wrap gap-1.5">
            {CRM_TAGS.map((t) => {
              const on = tags.includes(t.id);
              return (
                <button
                  key={t.id}
                  onClick={() => setTags((p) => (on ? p.filter((x) => x !== t.id) : [...p, t.id]))}
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-xs transition-colors",
                    on ? "border-transparent" : "border-dashed text-muted-foreground hover:bg-accent",
                  )}
                >
                  {on ? (
                    <Badge variant={t.variant} className="border-0 px-0 py-0">
                      {t.label}
                    </Badge>
                  ) : (
                    t.label
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Cancel
        </Button>
        <Button onClick={submit} disabled={!title.trim()}>
          <Check className="size-4" /> Add to journey
        </Button>
      </div>
    </Card>
  );
}

function Timeline({
  events,
  tagOverrides,
  onToggleTag,
}: {
  events: JourneyEvent[];
  tagOverrides: Record<string, string[]>;
  onToggleTag: (ev: JourneyEvent, tagId: string) => void;
}) {
  return (
    <Card className="p-5">
      <p className="mb-4 text-sm font-semibold">Journey timeline</p>
      <div className="space-y-0">
        {events.map((ev, idx) => (
          <TimelineRow
            key={ev.id}
            ev={ev}
            last={idx === events.length - 1}
            tags={effectiveTags(ev, tagOverrides)}
            onToggleTag={onToggleTag}
          />
        ))}
      </div>
    </Card>
  );
}

function TimelineRow({
  ev,
  last,
  tags,
  onToggleTag,
}: {
  ev: JourneyEvent;
  last: boolean;
  tags: string[];
  onToggleTag: (ev: JourneyEvent, tagId: string) => void;
}) {
  const [editing, setEditing] = React.useState(false);
  const Icon = EVENT_ICON[ev.type];
  const unused = CRM_TAGS.filter((t) => !tags.includes(t.id));

  return (
    <div className="relative flex gap-3 pb-5">
      {!last && <span className="absolute left-[15px] top-8 h-full w-px bg-border" />}
      <span className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground">
        <Icon className="size-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <p className="font-medium">{ev.title}</p>
          <span className="text-xs text-muted-foreground">{formatDate(ev.date)}</span>
        </div>
        {ev.detail && <p className="mt-0.5 text-sm text-muted-foreground">{ev.detail}</p>}

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {tags.map((tid) => {
            const t = tagById(tid);
            return (
              <button key={tid} onClick={() => onToggleTag(ev, tid)} className="group" title="Remove tag">
                <Badge variant={t.variant} className="gap-1">
                  {t.label}
                  <X className="size-3 opacity-50 group-hover:opacity-100" />
                </Badge>
              </button>
            );
          })}

          <div className="relative">
            <button
              onClick={() => setEditing((v) => !v)}
              className="flex items-center gap-1 rounded-full border border-dashed px-2 py-0.5 text-xs text-muted-foreground hover:bg-accent"
            >
              <TagIcon className="size-3" /> Tag
            </button>
            {editing && (
              <div className="absolute left-0 top-7 z-20 w-44 rounded-lg border bg-card p-1.5 shadow-lg">
                {unused.length === 0 && <p className="px-2 py-1 text-xs text-muted-foreground">All tags applied</p>}
                {unused.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      onToggleTag(ev, t.id);
                      setEditing(false);
                    }}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-accent"
                  >
                    <span className={cn("size-2 rounded-full", dotClass(t.variant))} />
                    {t.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
          <ChevronRight className="size-3" /> {employeeName(ev.authorId)}
          {!ev.seed && <span className="ml-1 rounded bg-primary/10 px-1 text-[10px] text-primary">added</span>}
        </p>
      </div>
    </div>
  );
}

function dotClass(variant: string) {
  return {
    default: "bg-muted-foreground",
    primary: "bg-primary",
    success: "bg-success",
    warning: "bg-warning",
    danger: "bg-danger",
  }[variant] ?? "bg-muted-foreground";
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular">{value}</p>
    </Card>
  );
}

function MetricMoney({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold tabular">
        <Money value={value} compact />
      </p>
    </Card>
  );
}
