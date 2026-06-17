"use client";

import { useState } from "react";
import { Plus, Trash2, Trophy, Check, X, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";

// A generic capital / lease-vs-buy decision analyzer. You set the criteria
// (max acceptable payback, minimum return), enter each option's economics, and
// the tool computes payback, ROI and a verdict — works for property, a printer,
// a machine, software, anything with an upfront cost and a periodic benefit.

type Cadence = "monthly" | "yearly";

interface Option {
  id: string;
  name: string;
  purpose: string; // free text — "Lease", "Buy", "Outsource", …
  upfront: string; // upfront / deposit cost
  benefit: string; // periodic saving or income generated
  cost: string; // periodic running cost
  cadence: Cadence;
  life: string; // useful life in years
  salvage: string; // residual / resale value at end of life
}

let seq = 0;
const uid = () => `opt-${++seq}`;

const seed: Option[] = [
  { id: uid(), name: "Office — Lease", purpose: "Lease", upfront: "300000", benefit: "0", cost: "120000", cadence: "monthly", life: "5", salvage: "0" },
  { id: uid(), name: "Office — Buy", purpose: "Buy", upfront: "9000000", benefit: "120000", cost: "20000", cadence: "monthly", life: "10", salvage: "8000000" },
  { id: uid(), name: "Production printer", purpose: "Buy", upfront: "450000", benefit: "35000", cost: "6000", cadence: "monthly", life: "5", salvage: "40000" },
  { id: uid(), name: "CNC machine", purpose: "Buy", upfront: "2800000", benefit: "180000", cost: "25000", cadence: "monthly", life: "8", salvage: "300000" },
];

const num = (s: string) => Number(s) || 0;

function analyse(o: Option, maxPayback: number, minRoi: number) {
  const perYear = o.cadence === "monthly" ? 12 : 1;
  const annualNet = (num(o.benefit) - num(o.cost)) * perYear;
  const life = num(o.life);
  const upfront = num(o.upfront);
  const paybackYears = annualNet > 0 ? upfront / annualNet : Infinity;
  const totalNet = annualNet * life + num(o.salvage) - upfront;
  const roiTotal = upfront > 0 ? totalNet / upfront : 0;
  const roiAnnual = life > 0 ? roiTotal / life : 0;
  const meetsPayback = paybackYears <= maxPayback;
  const meetsRoi = roiAnnual * 100 >= minRoi;
  let verdict: "go" | "review" | "reject";
  if (annualNet <= 0 && num(o.salvage) - upfront + annualNet * life <= 0) verdict = "reject";
  else if (meetsPayback && meetsRoi) verdict = "go";
  else verdict = "review";
  return { annualNet, paybackYears, totalNet, roiAnnual, meetsPayback, meetsRoi, verdict };
}

const VERDICT = {
  go: { label: "Go", variant: "success" as const, icon: Check },
  review: { label: "Review", variant: "warning" as const, icon: AlertTriangle },
  reject: { label: "Reject", variant: "danger" as const, icon: X },
};

export function DecisionsClient() {
  const [options, setOptions] = useState<Option[]>(seed);
  const [maxPayback, setMaxPayback] = useState("3");
  const [minRoi, setMinRoi] = useState("15");

  const mp = num(maxPayback);
  const mr = num(minRoi);
  const rows = options.map((o) => ({ o, a: analyse(o, mp, mr) }));

  // Recommendation: the "Go" option with the shortest payback.
  const recommended = rows
    .filter((r) => r.a.verdict === "go")
    .sort((x, y) => x.a.paybackYears - y.a.paybackYears)[0]?.o.id;

  function update(id: string, patch: Partial<Option>) {
    setOptions((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }
  const add = () =>
    setOptions((prev) => [
      ...prev,
      { id: uid(), name: "New option", purpose: "Buy", upfront: "0", benefit: "0", cost: "0", cadence: "monthly", life: "5", salvage: "0" },
    ]);
  const remove = (id: string) => setOptions((prev) => prev.filter((o) => o.id !== id));

  const fmtYears = (y: number) => (Number.isFinite(y) ? `${y.toFixed(1)} yr` : "—");

  return (
    <>
      <PageHeader
        title="Capital Decisions"
        subtitle="Lease vs buy vs invest — set your payback criteria, then compare any options (property, machinery, equipment, software)."
        actions={
          <Button onClick={add}>
            <Plus className="size-4" /> Add option
          </Button>
        }
      />

      {/* Decision criteria */}
      <Card className="mb-4 p-4">
        <p className="mb-3 text-sm font-semibold">Decision criteria</p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <Label htmlFor="mp">Max acceptable payback (years)</Label>
            <Input id="mp" type="number" min={0} value={maxPayback} onChange={(e) => setMaxPayback(e.target.value)} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="mr">Minimum annual return (%)</Label>
            <Input id="mr" type="number" min={0} value={minRoi} onChange={(e) => setMinRoi(e.target.value)} className="mt-1" />
          </div>
          <div className="flex items-end">
            <p className="text-xs text-muted-foreground">
              An option is a <span className="font-medium text-success">Go</span> when it pays back within{" "}
              {mp || 0} years <span className="font-medium">and</span> returns at least {mr || 0}% a year.
            </p>
          </div>
        </div>
      </Card>

      {/* Options table */}
      <div className="max-h-[70vh] overflow-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
              <th className="px-3 py-2.5 font-medium">Option</th>
              <th className="px-3 py-2.5 font-medium">Type</th>
              <th className="px-3 py-2.5 text-right font-medium">Upfront</th>
              <th className="px-3 py-2.5 text-right font-medium">Benefit / period</th>
              <th className="px-3 py-2.5 text-right font-medium">Cost / period</th>
              <th className="px-3 py-2.5 font-medium">Cadence</th>
              <th className="px-3 py-2.5 text-right font-medium">Life (yr)</th>
              <th className="px-3 py-2.5 text-right font-medium">Salvage</th>
              <th className="px-3 py-2.5 text-right font-medium">Payback</th>
              <th className="px-3 py-2.5 text-right font-medium">Annual ROI</th>
              <th className="px-3 py-2.5 text-right font-medium">Net over life</th>
              <th className="px-3 py-2.5 font-medium">Verdict</th>
              <th className="w-10 px-2 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ o, a }) => {
              const v = VERDICT[a.verdict];
              const isBest = o.id === recommended;
              return (
                <tr key={o.id} className={cn("border-b border-border/40 last:border-0", isBest && "bg-success/5")}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-1.5">
                      {isBest && <Trophy className="size-3.5 text-success" />}
                      <Input value={o.name} onChange={(e) => update(o.id, { name: e.target.value })} className="h-8 w-40" />
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Input value={o.purpose} onChange={(e) => update(o.id, { purpose: e.target.value })} className="h-8 w-24" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} value={o.upfront} onChange={(e) => update(o.id, { upfront: e.target.value })} className="h-8 w-28 text-right tabular" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} value={o.benefit} onChange={(e) => update(o.id, { benefit: e.target.value })} className="h-8 w-28 text-right tabular" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} value={o.cost} onChange={(e) => update(o.id, { cost: e.target.value })} className="h-8 w-28 text-right tabular" />
                  </td>
                  <td className="px-3 py-2">
                    <Select value={o.cadence} onChange={(e) => update(o.id, { cadence: e.target.value as Cadence })} className="h-8 w-28">
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </Select>
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} value={o.life} onChange={(e) => update(o.id, { life: e.target.value })} className="h-8 w-16 text-right tabular" />
                  </td>
                  <td className="px-3 py-2">
                    <Input type="number" min={0} value={o.salvage} onChange={(e) => update(o.id, { salvage: e.target.value })} className="h-8 w-28 text-right tabular" />
                  </td>
                  <td className={cn("px-3 py-2 text-right tabular", a.meetsPayback ? "text-success" : "text-danger")}>{fmtYears(a.paybackYears)}</td>
                  <td className={cn("px-3 py-2 text-right tabular", a.meetsRoi ? "text-success" : "text-muted-foreground")}>{(a.roiAnnual * 100).toFixed(1)}%</td>
                  <td className="px-3 py-2 text-right tabular">
                    <Money value={a.totalNet} compact colored />
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant={v.variant} className="gap-1">
                      <v.icon className="size-3" /> {v.label}
                    </Badge>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <button onClick={() => remove(o.id)} className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-danger" aria-label="Remove option">
                      <Trash2 className="size-4" />
                    </button>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 && (
              <tr>
                <td colSpan={13} className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Add an option to start comparing.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {recommended ? (
        <p className="mt-3 flex items-center gap-1.5 text-sm">
          <Trophy className="size-4 text-success" />
          <span className="font-medium">Recommended:</span>
          {options.find((o) => o.id === recommended)?.name} — the fastest payback that clears your criteria.
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted-foreground">No option currently meets both criteria — relax the payback/return thresholds or revise the inputs.</p>
      )}
    </>
  );
}
