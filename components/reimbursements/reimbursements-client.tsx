"use client";

import * as React from "react";
import { ReceiptText, Plus, Check, X, Banknote, Send, AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { useNewIntent } from "@/lib/commands/new-intent";
import { useJournal } from "@/components/accounting/journal-provider";
import { ACTIVE_EMPLOYEES, employeeById, employeeName } from "@/lib/hr/employees";
import { entityById } from "@/lib/accounting/org";
import {
  REIMB_CATEGORIES,
  STATUS_META,
  allReimbursements,
  effectiveStatus,
  loadCreatedReimbursements,
  saveCreatedReimbursements,
  loadReimbState,
  saveReimbState,
  nextReimbId,
  accrualDraft,
  paymentDraft,
  outstandingPayable,
  type Reimbursement,
  type ReimbStateStore,
  type ReimbStatus,
} from "@/lib/reimbursements";

const today = () => new Date().toISOString().slice(0, 10);

export function ReimbursementsClient() {
  const { entries, post } = useJournal();
  const [created, setCreated] = React.useState<Reimbursement[]>([]);
  const [state, setState] = React.useState<ReimbStateStore>({});
  const [filter, setFilter] = React.useState<"all" | ReimbStatus>("all");
  const [newOpen, setNewOpen] = React.useState(false);
  const [err, setErr] = React.useState<string[]>([]);
  useNewIntent(() => setNewOpen(true));

  React.useEffect(() => {
    setCreated(loadCreatedReimbursements());
    setState(loadReimbState());
  }, []);

  const claims = React.useMemo(() => allReimbursements(created), [created]);
  const withStatus = claims.map((r) => ({ r, status: effectiveStatus(r, state) }));
  const shown = filter === "all" ? withStatus : withStatus.filter((x) => x.status === filter);

  const pending = withStatus.filter((x) => x.status === "submitted");
  const toPay = withStatus.filter((x) => x.status === "approved");
  const pendingAmt = pending.reduce((s, x) => s + x.r.amount, 0);
  const payableAmt = outstandingPayable(entries);

  function patch(id: string, next: Partial<ReimbStateStore[string]>) {
    setState((prev) => {
      const merged = { ...prev, [id]: { ...prev[id], ...next } };
      saveReimbState(merged);
      return merged;
    });
  }

  function submit(r: Reimbursement) {
    patch(r.id, { status: "submitted" });
  }
  function reject(r: Reimbursement) {
    patch(r.id, { status: "rejected" });
  }
  function approve(r: Reimbursement) {
    const res = post(accrualDraft(r, employeeName(r.employeeId)));
    if (!res.ok) return setErr(res.errors);
    setErr([]);
    patch(r.id, { status: "approved", accrualVoucherId: res.entry.id, approvedBy: employeeById(r.employeeId)?.managerId ?? "emp-002" });
  }
  function pay(r: Reimbursement) {
    const res = post(paymentDraft(r, employeeName(r.employeeId)));
    if (!res.ok) return setErr(res.errors);
    setErr([]);
    patch(r.id, { status: "paid", paymentVoucherId: res.entry.id, paidOn: today() });
  }

  function addClaim(c: Reimbursement) {
    const next = [...created, c];
    setCreated(next);
    saveCreatedReimbursements(next);
    setNewOpen(false);
  }

  return (
    <>
      <PageHeader
        title="Employee Reimbursements"
        subtitle="Staff expense claims — approve to accrue the payable, pay to settle. Both post real vouchers to the ledger."
        actions={
          <Button onClick={() => setNewOpen((o) => !o)}>
            <Plus className="size-4" /> New claim
          </Button>
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Awaiting approval" value={pending.length} plain highlight={pending.length > 0} />
        <Kpi label="Pending amount" value={pendingAmt} />
        <Kpi label="Approved · to pay" value={toPay.length} plain />
        <Kpi label="Payable balance (a/c 2310)" value={payableAmt} accent />
      </div>

      <Card className="mb-4 flex items-start gap-3 border-primary/30 bg-primary/5 p-4">
        <ReceiptText className="mt-0.5 size-4 shrink-0 text-primary" />
        <p className="text-sm text-muted-foreground">
          On <span className="font-medium text-foreground">approval</span> the claim accrues to{" "}
          <span className="font-medium text-foreground">Employee Reimbursements Payable</span> (Dr expense head / Cr 2310). On{" "}
          <span className="font-medium text-foreground">payment</span> it settles against the bank — both are real journal vouchers
          visible in the General Ledger.
        </p>
      </Card>

      {newOpen && <NewClaimForm onClose={() => setNewOpen(false)} onAdd={addClaim} createdLen={created.length} />}

      {err.length > 0 && (
        <Card className="mb-4 flex items-start gap-2 bg-danger/10 p-3 text-xs text-danger">
          <AlertCircle className="mt-0.5 size-3.5 shrink-0" />
          <ul className="space-y-0.5">{err.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </Card>
      )}

      {/* filter chips */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        {(["all", "submitted", "approved", "paid", "draft", "rejected"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs font-medium capitalize transition-colors",
              filter === f ? "border-primary bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent",
            )}
          >
            {f === "all" ? "All" : STATUS_META[f].label}
          </button>
        ))}
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Expense</th>
                <th className="px-4 py-2.5 font-medium">Category</th>
                <th className="px-4 py-2.5 font-medium">Description</th>
                <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 text-right font-medium">Action</th>
              </tr>
            </thead>
            <tbody>
              {shown.map(({ r, status }) => {
                const meta = STATUS_META[status];
                return (
                  <tr key={r.id} className="border-b align-top last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-3">
                      <p className="font-medium leading-tight">{employeeName(r.employeeId)}</p>
                      <p className="text-xs text-muted-foreground">{entityById(r.entityId)?.name}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(r.expenseDate)}</td>
                    <td className="px-4 py-3 text-xs">{r.category}</td>
                    <td className="px-4 py-3 max-w-[260px]">{r.description}</td>
                    <td className="px-4 py-3 text-right"><Money value={r.amount} className="font-semibold" /></td>
                    <td className="px-4 py-3"><Badge variant={meta.variant}>{meta.label}</Badge></td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => submit(r)}><Send className="size-3.5" /> Submit</Button>
                        )}
                        {status === "submitted" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => reject(r)}><X className="size-3.5" /> Reject</Button>
                            <Button size="sm" onClick={() => approve(r)}><Check className="size-3.5" /> Approve</Button>
                          </>
                        )}
                        {status === "approved" && (
                          <Button size="sm" onClick={() => pay(r)}><Banknote className="size-3.5" /> Pay</Button>
                        )}
                        {(status === "paid" || status === "rejected") && <span className="text-xs text-muted-foreground">—</span>}
                      </div>
                    </td>
                  </tr>
                );
              })}
              {shown.length === 0 && (
                <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-muted-foreground">No claims in this view.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function NewClaimForm({ onClose, onAdd, createdLen }: { onClose: () => void; onAdd: (c: Reimbursement) => void; createdLen: number }) {
  const [employeeId, setEmployeeId] = React.useState(ACTIVE_EMPLOYEES[0]?.id ?? "emp-001");
  const [category, setCategory] = React.useState(REIMB_CATEGORIES[0].label);
  const [expenseDate, setExpenseDate] = React.useState(today());
  const [amount, setAmount] = React.useState("");
  const [description, setDescription] = React.useState("");
  const amt = parseFloat(amount) || 0;
  const emp = employeeById(employeeId);

  return (
    <Card className="mb-4 border-primary/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">New reimbursement claim</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Employee">
          <Select value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} className="h-9 w-56">
            {ACTIVE_EMPLOYEES.map((e) => (<option key={e.id} value={e.id}>{e.name} — {e.designation}</option>))}
          </Select>
        </Field>
        <Field label="Category">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} className="h-9 w-48">
            {REIMB_CATEGORIES.map((c) => (<option key={c.label} value={c.label}>{c.label}</option>))}
          </Select>
        </Field>
        <Field label="Expense date"><Input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="h-9 w-40" /></Field>
        <Field label="Amount (₹)"><Input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0" inputMode="decimal" className="h-9 w-28" /></Field>
        <Field label="Description"><Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What was it for?" className="h-9 w-64" /></Field>
        <Button
          disabled={amt <= 0 || !description.trim() || !emp}
          onClick={() =>
            onAdd({
              id: nextReimbId([]) + `-${createdLen}`,
              employeeId,
              entityId: emp!.entityId,
              locationId: emp!.locationId,
              claimDate: today(),
              expenseDate,
              category,
              description,
              amount: amt,
              seedStatus: "submitted",
            })
          }
        >
          <Plus className="size-4" /> Submit claim
        </Button>
      </div>
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

function Kpi({ label, value, accent, plain, highlight }: { label: string; value: number; accent?: boolean; plain?: boolean; highlight?: boolean }) {
  return (
    <Card className={cn("p-4", accent && "border-primary/40", highlight && "border-warning/40")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-2xl font-bold tabular", accent && "text-primary", highlight && "text-warning")}>
        {plain ? value.toLocaleString("en-IN") : <Money value={value} compact />}
      </p>
    </Card>
  );
}
