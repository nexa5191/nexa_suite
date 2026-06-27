"use client";

import * as React from "react";
import { Wallet, Plus, Search, ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { VENDORS, vendorName } from "@/lib/vendors";
import {
  loadAdvances, saveAdvances, nextAdvRef, advanceSummary, STATUS_META,
  type AdvancePayment, type AdvanceStatus,
} from "@/lib/vendors/advance-payments";

const TODAY = new Date().toISOString().slice(0, 10);
const ELIGIBLE = VENDORS.filter((v) => v.vClass !== "Employee");
const STATUS_TABS: Array<{ value: AdvanceStatus | "all"; label: string }> = [
  { value: "all",      label: "All"      },
  { value: "pending",  label: "Pending"  },
  { value: "adjusted", label: "Adjusted" },
  { value: "refunded", label: "Refunded" },
];

function fmtAmt(n: number) {
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

export function AdvancePaymentsClient() {
  const [advances, setAdvances] = React.useState<AdvancePayment[]>([]);
  const [tab, setTab] = React.useState<AdvanceStatus | "all">("all");
  const [query, setQuery] = React.useState("");
  const [showForm, setShowForm] = React.useState(false);

  React.useEffect(() => {
    setAdvances(loadAdvances());
  }, []);

  const save = (updated: AdvancePayment[]) => {
    setAdvances(updated);
    saveAdvances(updated);
  };

  const filtered = advances.filter((a) => {
    if (tab !== "all" && a.status !== tab) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        a.ref.toLowerCase().includes(q) ||
        vendorName(a.vendorId).toLowerCase().includes(q) ||
        a.purpose.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const summary = advanceSummary(advances);

  return (
    <>
      <PageHeader
        title="Vendor Advances"
        subtitle="Advance payments to suppliers — tracked against POs and knocked off on bill booking."
        actions={
          <Button onClick={() => setShowForm(!showForm)}>
            <Plus className="size-4" /> New Advance
          </Button>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Outstanding" value={summary.totalOutstanding} accent />
        <Stat label="Adjusted this FY" value={summary.totalAdjustedFY} />
        <StatCount label="Pending advances" value={summary.pendingCount} />
      </div>

      {showForm && (
        <NewAdvanceForm
          advances={advances}
          onClose={() => setShowForm(false)}
          onSave={(a) => { save([...advances, a]); setShowForm(false); }}
        />
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="flex gap-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium transition-colors",
                  tab === t.value ? "bg-primary text-primary-foreground" : "hover:bg-accent",
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="h-8 w-48 pl-7 text-xs" />
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Ref</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Vendor</th>
                <th className="px-4 py-2.5 font-medium">Purpose</th>
                <th className="px-4 py-2.5 font-medium">Linked PO</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 text-right font-medium">Adjusted</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => {
                const meta = STATUS_META[a.status];
                const outstanding = a.status === "pending" ? a.amount - a.adjustedAmount : 0;
                return (
                  <tr key={a.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2 font-mono text-xs text-primary">{a.ref}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(a.date)}</td>
                    <td className="px-4 py-2 font-medium">{vendorName(a.vendorId)}</td>
                    <td className="px-4 py-2 max-w-[220px] truncate text-xs text-muted-foreground">{a.purpose}</td>
                    <td className="px-4 py-2 font-mono text-xs">
                      {a.poId ? (
                        <span className="flex items-center gap-1">
                          <ArrowRight className="size-3 text-muted-foreground" /> {a.poId}
                        </span>
                      ) : "—"}
                    </td>
                    <td className="px-4 py-2 text-right tabular"><Money value={a.amount} /></td>
                    <td className="px-4 py-2 text-right tabular">
                      {a.adjustedAmount > 0 ? <Money value={a.adjustedAmount} /> : "—"}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex flex-col gap-0.5">
                        <Badge variant={meta.variant}>{meta.label}</Badge>
                        {outstanding > 0 && (
                          <span className="text-[10px] text-warning">o/s {fmtAmt(outstanding)}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-sm text-muted-foreground">No advances match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className={cn("p-4", accent && "border-primary/30")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular", accent && "text-primary")}><Money value={value} /></p>
    </Card>
  );
}

function StatCount({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </Card>
  );
}

function NewAdvanceForm({
  advances, onClose, onSave,
}: {
  advances: AdvancePayment[];
  onClose: () => void;
  onSave: (a: AdvancePayment) => void;
}) {
  const [vendorId, setVendorId] = React.useState(ELIGIBLE[0]?.id ?? "");
  const [amount, setAmount] = React.useState("");
  const [purpose, setPurpose] = React.useState("");
  const [date, setDate] = React.useState(TODAY);

  const amt = parseFloat(amount) || 0;
  const valid = amt > 0 && purpose.trim() && vendorId;

  function submit() {
    if (!valid) return;
    const a: AdvancePayment = {
      id: `adv-${Date.now()}`,
      ref: nextAdvRef(advances),
      vendorId,
      poId: null,
      amount: amt,
      date,
      purpose: purpose.trim(),
      status: "pending",
      adjustedAgainst: null,
      adjustedAmount: 0,
      adjustedDate: null,
    };
    onSave(a);
  }

  return (
    <Card className="mb-4 border-primary/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold"><Wallet className="size-4" /> New Advance Payment</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <F label="Date"><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-36" /></F>
        <F label="Vendor">
          <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="h-9 w-56">
            {ELIGIBLE.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </Select>
        </F>
        <F label="Amount (₹)"><Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" className="h-9 w-32" /></F>
        <F label="Purpose"><Input value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Security deposit" className="h-9 w-64" /></F>
        <Button disabled={!valid} onClick={submit}><Plus className="size-4" /> Post advance</Button>
      </div>
    </Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
