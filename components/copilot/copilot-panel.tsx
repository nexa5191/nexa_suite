"use client";

import * as React from "react";
import Link from "next/link";
import {
  Sparkles, Send, ArrowRight, MessageSquareText, ShieldCheck, FileInput,
  CheckCircle2, AlertTriangle, XCircle, CornerDownLeft, FileText,
} from "lucide-react";
import { Drawer } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  answer, suggestions, closeReview, reviewSummary, draftJournal, SAMPLE_DOCS,
  type CopilotResult, type CopilotMetric, type CloseCheck, type CheckStatus, type SampleDoc,
} from "@/lib/copilot/copilot";

export const OPEN_COPILOT_EVENT = "nexa:open-copilot";

type Tab = "ask" | "review" | "draft";

const TONE_TEXT: Record<NonNullable<CopilotMetric["tone"]>, string> = {
  default: "text-foreground",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

const CHECK_ICON: Record<CheckStatus, React.ComponentType<{ className?: string }>> = {
  pass: CheckCircle2,
  warn: AlertTriangle,
  fail: XCircle,
};
const CHECK_TONE: Record<CheckStatus, string> = {
  pass: "text-success",
  warn: "text-warning",
  fail: "text-danger",
};

export function CopilotPanel() {
  const [open, setOpen] = React.useState(false);
  const [tab, setTab] = React.useState<Tab>("ask");

  const [query, setQuery] = React.useState("");
  const [result, setResult] = React.useState<CopilotResult | null>(null);
  const [checks, setChecks] = React.useState<CloseCheck[] | null>(null);
  const [docId, setDocId] = React.useState<string | null>(null);

  const inputRef = React.useRef<HTMLInputElement>(null);

  // Open via topbar button (custom event) or Mod+J.
  React.useEffect(() => {
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener(OPEN_COPILOT_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(OPEN_COPILOT_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  React.useEffect(() => {
    if (open && tab === "ask") setTimeout(() => inputRef.current?.focus(), 50);
  }, [open, tab]);

  function ask(q: string) {
    setQuery(q);
    setResult(answer(q));
  }
  function runReview() {
    setChecks(closeReview());
  }
  function pickDoc(id: string) {
    setDocId(id);
  }

  const draft = docId ? draftJournal(SAMPLE_DOCS.find((d) => d.id === docId)!) : null;

  return (
    <Drawer
      open={open}
      onClose={() => setOpen(false)}
      width="max-w-xl"
      title={<span className="flex items-center gap-2"><Sparkles className="size-4 text-primary" /> NEXA Copilot</span>}
      subtitle="Ask, review and draft — live from your ledgers"
    >
      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border bg-muted/30 p-1">
        <TabButton icon={MessageSquareText} label="Ask" active={tab === "ask"} onClick={() => setTab("ask")} />
        <TabButton icon={ShieldCheck} label="Close review" active={tab === "review"} onClick={() => setTab("review")} />
        <TabButton icon={FileInput} label="Doc → entry" active={tab === "draft"} onClick={() => setTab("draft")} />
      </div>

      {tab === "ask" && (
        <div className="space-y-4">
          <form
            onSubmit={(e) => { e.preventDefault(); if (query.trim()) ask(query); }}
            className="flex items-center gap-2 rounded-lg border bg-card px-3 focus-within:ring-2 focus-within:ring-primary/30"
          >
            <Sparkles className="size-4 shrink-0 text-primary" />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about receivables, payables, GST…"
              className="h-11 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
            <Button type="submit" size="sm" disabled={!query.trim()} className="h-8 shrink-0">
              <Send className="size-3.5" />
            </Button>
          </form>

          {!result && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Try asking</p>
              <div className="flex flex-col gap-1.5">
                {suggestions().map((s) => (
                  <button
                    key={s}
                    onClick={() => ask(s)}
                    className="group flex items-center justify-between rounded-md border px-3 py-2 text-left text-sm hover:border-primary/40 hover:bg-accent/40"
                  >
                    <span>{s}</span>
                    <ArrowRight className="size-3.5 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {result && <ResultView result={result} onClose={() => setOpen(false)} onFollowup={ask} />}
        </div>
      )}

      {tab === "review" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-lg border bg-card p-3">
            <div className="text-sm">
              <p className="font-medium">Month-end close review</p>
              <p className="text-xs text-muted-foreground">Anomaly scan across AP, GST and AR.</p>
            </div>
            <Button size="sm" onClick={runReview}><ShieldCheck className="size-4" /> Run review</Button>
          </div>

          {checks && <ReviewView checks={checks} onClose={() => setOpen(false)} />}
        </div>
      )}

      {tab === "draft" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Pick a sample vendor bill — Copilot reads it and drafts a balanced journal entry with the GST split and TDS section auto-detected.
          </p>
          <div className="space-y-1.5">
            {SAMPLE_DOCS.map((d) => (
              <DocRow key={d.id} doc={d} active={docId === d.id} onClick={() => pickDoc(d.id)} />
            ))}
          </div>
          {draft && <ResultView result={draft} onClose={() => setOpen(false)} onFollowup={ask} />}
        </div>
      )}
    </Drawer>
  );
}

function TabButton({ icon: Icon, label, active, onClick }: { icon: React.ComponentType<{ className?: string }>; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors",
        active ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" /> {label}
    </button>
  );
}

function ResultView({ result, onClose, onFollowup }: { result: CopilotResult; onClose: () => void; onFollowup: (q: string) => void }) {
  return (
    <div className="space-y-3 rounded-lg border bg-card p-4 animate-fade-in">
      <p className="text-sm font-semibold">{result.title}</p>
      <p className="text-sm leading-relaxed text-muted-foreground">{result.narrative}</p>

      {result.metrics && result.metrics.length > 0 && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {result.metrics.map((m) => (
            <div key={m.label} className="rounded-lg border bg-muted/20 p-2.5">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">{m.label}</p>
              <p className={cn("mt-0.5 text-base font-bold tabular", m.tone ? TONE_TEXT[m.tone] : "text-foreground")}>{m.value}</p>
              {m.delta && <p className="text-[10px] text-muted-foreground">{m.delta}</p>}
            </div>
          ))}
        </div>
      )}

      {result.columns && result.rows && result.rows.length > 0 && (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                {result.columns.map((c, i) => (
                  <th key={i} className={cn("px-3 py-2 font-medium", c.align === "right" && "text-right")}>{c.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, ri) => (
                <tr key={ri} className="border-b last:border-0">
                  {row.map((cell, ci) => (
                    <td key={ci} className={cn("px-3 py-1.5", result.columns![ci]?.align === "right" && "text-right tabular")}>{cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {result.footer && <p className="text-xs font-medium text-muted-foreground">{result.footer}</p>}

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {result.href && (
          <Link href={result.href.to} onClick={onClose}>
            <Button size="sm" variant="outline" className="h-8"><ArrowRight className="size-3.5" /> {result.href.label}</Button>
          </Link>
        )}
        {result.followups?.map((f) => (
          <button key={f} onClick={() => onFollowup(f)} className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground hover:border-primary/40 hover:text-foreground">
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

function ReviewView({ checks, onClose }: { checks: CloseCheck[]; onClose: () => void }) {
  const s = reviewSummary(checks);
  return (
    <div className="space-y-2 animate-fade-in">
      <div className="flex gap-2 text-xs">
        <Badge variant="success">{s.pass} passed</Badge>
        {s.warn > 0 && <Badge variant="warning">{s.warn} to review</Badge>}
        {s.fail > 0 && <Badge variant="danger">{s.fail} action needed</Badge>}
      </div>
      {checks.map((c) => {
        const Icon = CHECK_ICON[c.status];
        return (
          <div key={c.key} className="rounded-lg border bg-card p-3">
            <div className="flex items-start gap-2.5">
              <Icon className={cn("mt-0.5 size-4 shrink-0", CHECK_TONE[c.status])} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">{c.title}</p>
                  {c.amount && <span className={cn("text-xs font-semibold tabular", CHECK_TONE[c.status])}>{c.amount}</span>}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{c.detail}</p>
                {c.href && c.status !== "pass" && (
                  <Link href={c.href} onClick={onClose} className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                    Resolve <ArrowRight className="size-3" />
                  </Link>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocRow({ doc, active, onClick }: { doc: SampleDoc; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors",
        active ? "border-primary/50 bg-primary/5 ring-1 ring-primary/30" : "hover:bg-accent/40",
      )}
    >
      <FileText className="size-4 shrink-0 text-danger" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{doc.vendor}</p>
        <p className="truncate text-xs text-muted-foreground">{doc.invoiceNo} · {doc.description}</p>
      </div>
      <span className="shrink-0 text-xs font-semibold tabular">₹{doc.taxable.toLocaleString("en-IN")}</span>
    </button>
  );
}
