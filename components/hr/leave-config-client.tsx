"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Plus, RotateCcw, Save, Trash2, Check } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DEFAULT_LEAVE_TYPES, loadLeaveTypes, saveLeaveTypes } from "@/lib/hr/leave";
import type { LeaveType } from "@/lib/hr/types";

const TONES: LeaveType["tone"][] = ["primary", "success", "warning", "danger"];

function blankType(n: number): LeaveType {
  return {
    id: `lt-custom-${n}`,
    name: "New Leave Type",
    code: "NL",
    tone: "primary",
    allowHalfDay: true,
    annualDays: 10,
    paid: true,
    carryForward: false,
  };
}

export function LeaveConfigClient() {
  const [types, setTypes] = React.useState<LeaveType[]>(DEFAULT_LEAVE_TYPES);
  const [dirty, setDirty] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const seq = React.useRef(0);

  React.useEffect(() => {
    setTypes(loadLeaveTypes());
  }, []);

  function update(id: string, patch: Partial<LeaveType>) {
    setTypes((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    setDirty(true);
    setSaved(false);
  }
  function remove(id: string) {
    setTypes((prev) => prev.filter((t) => t.id !== id));
    setDirty(true);
    setSaved(false);
  }
  function add() {
    seq.current += 1;
    setTypes((prev) => [...prev, blankType(seq.current)]);
    setDirty(true);
    setSaved(false);
  }
  function save() {
    saveLeaveTypes(types);
    setDirty(false);
    setSaved(true);
  }
  function reset() {
    setTypes(DEFAULT_LEAVE_TYPES);
    saveLeaveTypes(DEFAULT_LEAVE_TYPES);
    setDirty(false);
    setSaved(true);
  }

  return (
    <>
      <PageHeader
        title="Leave Policy"
        subtitle="Define the leave types your organisation offers — units, allocation and rules."
        actions={
          <>
            <Link href="/leave">
              <Button variant="ghost" size="sm"><ArrowLeft className="size-3.5" /> Back to leave</Button>
            </Link>
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="size-3.5" /> Reset to defaults
            </Button>
            <Button size="sm" onClick={save} disabled={!dirty}>
              {saved ? <Check className="size-3.5" /> : <Save className="size-3.5" />}
              {saved ? "Saved" : "Save policy"}
            </Button>
          </>
        }
      />

      {dirty && (
        <p className="mb-3 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-warning">
          You have unsaved changes. Click <span className="font-semibold">Save policy</span> to apply them across the platform.
        </p>
      )}

      <div className="space-y-3">
        {types.map((t) => (
          <Card key={t.id}>
            <CardContent className="p-4">
              <div className="grid gap-4 lg:grid-cols-12">
                <Field className="lg:col-span-3" label="Name">
                  <Input value={t.name} onChange={(e) => update(t.id, { name: e.target.value })} />
                </Field>
                <Field className="lg:col-span-1" label="Code">
                  <Input
                    value={t.code}
                    maxLength={5}
                    onChange={(e) => update(t.id, { code: e.target.value.toUpperCase() })}
                  />
                </Field>
                <Field className="lg:col-span-2" label="Annual days (0 = unlimited)">
                  <Input
                    type="number"
                    min={0}
                    value={t.annualDays}
                    onChange={(e) => update(t.id, { annualDays: Math.max(0, Number(e.target.value) || 0) })}
                  />
                </Field>
                <Field className="lg:col-span-2" label="Colour">
                  <Select value={t.tone} onChange={(e) => update(t.id, { tone: e.target.value as LeaveType["tone"] })}>
                    {TONES.map((tone) => (
                      <option key={tone} value={tone} className="capitalize">{tone}</option>
                    ))}
                  </Select>
                </Field>
                <div className="flex items-end lg:col-span-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <Toggle on={t.allowHalfDay} onClick={() => update(t.id, { allowHalfDay: !t.allowHalfDay })}>
                      Half-day
                    </Toggle>
                    <Toggle on={t.paid} onClick={() => update(t.id, { paid: !t.paid })}>Paid</Toggle>
                    <Toggle on={t.carryForward} onClick={() => update(t.id, { carryForward: !t.carryForward })}>
                      Carry-forward
                    </Toggle>
                    <button
                      onClick={() => remove(t.id)}
                      className="ml-auto flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                      aria-label="Delete leave type"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  </div>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-2 border-t pt-3 text-xs text-muted-foreground">
                <Badge variant={t.tone}>{t.code}</Badge>
                <span>
                  {t.annualDays === 0 ? "Unlimited" : `${t.annualDays} days/year`} ·{" "}
                  {t.allowHalfDay ? "half or full day" : "full day only"} · {t.paid ? "paid" : "unpaid"}
                  {t.carryForward ? " · carries forward" : ""}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <button
        onClick={add}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed py-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        <Plus className="size-4" /> Add leave type
      </button>
    </>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <Label className="mb-1.5 block">{label}</Label>
      {children}
    </label>
  );
}

function Toggle({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
        on ? "border-primary/30 bg-primary/10 text-primary" : "border-input text-muted-foreground hover:bg-accent",
      )}
    >
      <span className={cn("size-2 rounded-full", on ? "bg-primary" : "bg-muted-foreground/40")} />
      {children}
    </button>
  );
}
