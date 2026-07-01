"use client";

import * as React from "react";
import { Coins, Download, Plus, ArrowDownToLine, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { downloadCsv } from "@/lib/export";
import { useNewIntent } from "@/lib/commands/new-intent";
import { useJournal } from "@/components/accounting/journal-provider";
import { ENTITIES, LOCATIONS, entityById } from "@/lib/accounting/org";
import { EntityCombobox } from "@/components/ui/entity-combobox";
import { accountSafe } from "@/lib/accounting/chart-of-accounts";
import {
  loadPettyHeads,
  pettyHead,
  pettyCashBook,
  topUpDraft,
  expenseDraft,
  DEFAULT_BANK,
} from "@/lib/petty-cash";

const INDIA_ENTITIES = ENTITIES.filter((e) => e.country === "India");
const today = () => new Date().toISOString().slice(0, 10);
const acctName = (code: string) => accountSafe(code)?.name ?? code;

export function PettyCashClient() {
  const { entries, post } = useJournal();

  const [entityId, setEntityId] = React.useState(INDIA_ENTITIES[0]?.id ?? "ent-nexa-in");
  const locs = LOCATIONS.filter((l) => l.entityId === entityId);
  const [locationId, setLocationId] = React.useState(locs[0]?.id ?? "loc-blr");
  const [mode, setMode] = React.useState<"expense" | "topup" | null>(null);
  useNewIntent(() => setMode("expense"));

  React.useEffect(() => {
    if (!locs.some((l) => l.id === locationId)) setLocationId(locs[0]?.id ?? "");
  }, [entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  // book scoped to the selected entity's float
  const scoped = React.useMemo(() => entries.filter((e) => e.entityId === entityId), [entries, entityId]);
  const { rows, balance } = React.useMemo(() => pettyCashBook(scoped), [scoped]);

  const periodSpend = rows.reduce((s, r) => s + r.spend, 0);
  const periodTopUp = rows.reduce((s, r) => s + r.topUp, 0);

  const base = { date: today(), entityId, locationId, currency: "INR" };

  return (
    <>
      <PageHeader
        title="Petty Cash Book"
        subtitle="Imprest-float cash book — every top-up and expense posts a real double-entry voucher to the ledger."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => setMode(mode === "topup" ? null : "topup")}>
              <ArrowDownToLine className="size-4" /> Top up float
            </Button>
            <Button onClick={() => setMode(mode === "expense" ? null : "expense")}>
              <Plus className="size-4" /> Record expense
            </Button>
          </div>
        }
      />

      {/* scope */}
      <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
        <Field label="Entity (float)">
          <EntityCombobox value={entityId} onChange={setEntityId} indiaOnly className="h-9 w-52" />
        </Field>
        <Field label="Custodian location">
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-9 w-48">
            {locs.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
        </Field>
        <div className="ml-auto flex items-center gap-2 self-center">
          <Coins className="size-4 text-primary" />
          <span className="text-xs text-muted-foreground">Float balance</span>
          <Money value={balance} className={cn("text-lg font-bold tabular", balance < 0 && "text-danger")} />
        </div>
      </Card>

      {/* KPIs */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Current float" value={balance} accent />
        <Kpi label="Total spend" value={periodSpend} />
        <Kpi label="Total top-ups" value={periodTopUp} />
        <Kpi label="Vouchers" value={rows.length} plain />
      </div>

      {mode === "expense" && (
        <ExpenseForm
          onClose={() => setMode(null)}
          onSubmit={(amount, headLabel, narration) => {
            const head = pettyHead(headLabel);
            const r = post(expenseDraft(base, amount, head.accountCode, narration));
            if (r.ok) setMode(null);
            return r;
          }}
        />
      )}
      {mode === "topup" && (
        <TopUpForm
          onClose={() => setMode(null)}
          onSubmit={(amount, bank, narration) => {
            const r = post(topUpDraft(base, amount, bank, narration));
            if (r.ok) setMode(null);
            return r;
          }}
        />
      )}

      {/* book */}
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <span className="text-xs text-muted-foreground">{rows.length} vouchers · {entityById(entityId)?.name}</span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={() =>
              downloadCsv(
                `petty-cash-${entityId}`,
                ["Date", "Voucher", "Particulars", "Analysis head", "Top-up", "Spend", "Balance"],
                [...rows].reverse().map((r) => [formatDate(r.date), r.voucherNo, r.narration, acctName(r.contraAccount), r.topUp || "", r.spend || "", r.balance]),
              )
            }
          >
            <Download className="size-3.5" /> Export CSV
          </Button>
        </div>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Voucher</th>
                <th className="px-4 py-2.5 font-medium">Particulars</th>
                <th className="px-4 py-2.5 font-medium">Analysis head</th>
                <th className="px-4 py-2.5 text-right font-medium">Top-up</th>
                <th className="px-4 py-2.5 text-right font-medium">Spend</th>
                <th className="px-4 py-2.5 text-right font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className={cn("border-b last:border-0 hover:bg-accent/40", r.reversed && "opacity-50")}>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(r.date)}</td>
                  <td className="px-4 py-2 font-mono text-xs">{r.voucherNo}</td>
                  <td className="px-4 py-2">
                    {r.narration}
                    {r.reversed && <Badge variant="default" className="ml-1.5 text-[9px]">reversed</Badge>}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground">{acctName(r.contraAccount)}</td>
                  <td className="px-4 py-2 text-right tabular text-success">{r.topUp ? <Money value={r.topUp} /> : "—"}</td>
                  <td className="px-4 py-2 text-right tabular">{r.spend ? <Money value={r.spend} /> : "—"}</td>
                  <td className="px-4 py-2 text-right font-semibold tabular">
                    <Money value={r.balance} />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No petty cash movements yet — <button className="font-medium text-primary underline" onClick={() => setMode("topup")}>top up the float</button> to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

type PostResult = { ok: true } | { ok: false; errors: string[] };

function ExpenseForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (amount: number, head: string, narration: string) => PostResult }) {
  const [amount, setAmount] = React.useState("");
  const [head, setHead] = React.useState(() => loadPettyHeads()[0]?.label ?? "");
  const [narration, setNarration] = React.useState("");
  const [errors, setErrors] = React.useState<string[]>([]);
  const amt = parseFloat(amount) || 0;
  return (
    <FormCard title="Record petty cash expense" onClose={onClose} errors={errors}>
      <Field label="Amount (₹)"><Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" className="h-9 w-32" /></Field>
      <Field label="Analysis head">
        <Select value={head} onChange={(e) => setHead(e.target.value)} className="h-9 w-56">
          {loadPettyHeads().map((h) => (<option key={h.label} value={h.label}>{h.label}</option>))}
        </Select>
      </Field>
      <Field label="Particulars"><Input value={narration} onChange={(e) => setNarration(e.target.value)} placeholder="e.g. Auto fare — bank visit" className="h-9 w-64" /></Field>
      <Button
        disabled={amt <= 0 || !narration.trim()}
        onClick={() => {
          const r = onSubmit(amt, head, narration);
          if (!r.ok) setErrors(r.errors);
        }}
      >
        <Plus className="size-4" /> Post voucher
      </Button>
    </FormCard>
  );
}

function TopUpForm({ onClose, onSubmit }: { onClose: () => void; onSubmit: (amount: number, bank: string, narration: string) => PostResult }) {
  const [amount, setAmount] = React.useState("");
  const [narration, setNarration] = React.useState("Petty cash top-up");
  const [errors, setErrors] = React.useState<string[]>([]);
  const amt = parseFloat(amount) || 0;
  return (
    <FormCard title="Top up the imprest float (from bank)" onClose={onClose} errors={errors}>
      <Field label="Amount (₹)"><Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" className="h-9 w-32" /></Field>
      <Field label="Particulars"><Input value={narration} onChange={(e) => setNarration(e.target.value)} className="h-9 w-64" /></Field>
      <Button
        disabled={amt <= 0}
        onClick={() => {
          const r = onSubmit(amt, DEFAULT_BANK, narration);
          if (!r.ok) setErrors(r.errors);
        }}
      >
        <ArrowDownToLine className="size-4" /> Post top-up
      </Button>
    </FormCard>
  );
}

function FormCard({ title, onClose, errors, children }: { title: string; onClose: () => void; errors: string[]; children: React.ReactNode }) {
  return (
    <Card className="mb-4 border-primary/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <div className="flex flex-wrap items-end gap-3">{children}</div>
      {errors.length > 0 && (
        <div className="mt-3 flex items-start gap-2 rounded-md bg-danger/10 p-2.5 text-xs text-danger">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <ul className="space-y-0.5">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </div>
      )}
    </Card>
  );
}

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
    <Card className={cn("p-4", accent && "border-primary/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular", accent && "text-primary")}>
        {plain ? value.toLocaleString("en-IN") : <Money value={value} compact />}
      </p>
    </Card>
  );
}
