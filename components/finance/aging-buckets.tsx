"use client";

import * as React from "react";
import { SlidersHorizontal, Plus, X, RotateCcw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DEFAULT_BREAKPOINTS,
  loadBreakpoints,
  saveBreakpoints,
  schemeFromBreakpoints,
  cleanBreakpoints,
  type AgingBucket,
} from "@/lib/finance/receivables";

export interface AgingScheme {
  breaks: number[];
  scheme: AgingBucket[];
  update: (next: number[]) => void;
  reset: () => void;
  isDefault: boolean;
}

/**
 * The active aging-bucket scheme, persisted and shared between Receivables and
 * Payables. SSR-equal default first, then the saved breakpoints load on mount.
 */
export function useAgingScheme(): AgingScheme {
  const [breaks, setBreaks] = React.useState<number[]>(DEFAULT_BREAKPOINTS);

  React.useEffect(() => {
    setBreaks(loadBreakpoints());
  }, []);

  const scheme = React.useMemo(() => schemeFromBreakpoints(breaks), [breaks]);

  const update = React.useCallback((next: number[]) => {
    const cleaned = cleanBreakpoints(next);
    const final = cleaned.length ? cleaned : DEFAULT_BREAKPOINTS;
    saveBreakpoints(final);
    setBreaks(final);
  }, []);

  const reset = React.useCallback(() => update(DEFAULT_BREAKPOINTS), [update]);

  return { breaks, scheme, update, reset, isDefault: sameBreaks(breaks, DEFAULT_BREAKPOINTS) };
}

function sameBreaks(a: number[], b: number[]): boolean {
  const x = cleanBreakpoints(a), y = cleanBreakpoints(b);
  return x.length === y.length && x.every((v, i) => v === y[i]);
}

/** A compact popover for editing the aging-bucket breakpoints. */
export function AgingBucketEditor({ breaks, onChange, onReset, isDefault }: {
  breaks: number[];
  onChange: (next: number[]) => void;
  onReset: () => void;
  isDefault: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<number[]>(breaks);

  // Re-seed the draft whenever the panel opens or the saved breakpoints change.
  React.useEffect(() => {
    setDraft(breaks);
  }, [breaks, open]);

  const preview = React.useMemo(() => schemeFromBreakpoints(draft), [draft]);

  const setAt = (i: number, v: number) => setDraft((d) => d.map((x, j) => (j === i ? v : x)));
  const removeAt = (i: number) => setDraft((d) => d.filter((_, j) => j !== i));
  const add = () => setDraft((d) => [...d, (d.length ? Math.max(...d) : 0) + 30]);

  function apply() {
    onChange(draft);
    setOpen(false);
  }
  function resetAll() {
    onReset();
    setOpen(false);
  }

  return (
    <div className="relative">
      <Button variant="outline" size="sm" className="h-9" onClick={() => setOpen((o) => !o)}>
        <SlidersHorizontal className="size-4" /> Buckets
        {!isDefault && <Badge variant="primary" className="ml-1 text-[10px]">custom</Badge>}
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <Card className="absolute right-0 z-50 mt-2 w-80 p-4 shadow-lg">
            <p className="text-sm font-semibold">Aging buckets</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Day breakpoints that divide the overdue buckets. &ldquo;Current&rdquo; and the final open-ended bucket are added
              automatically.
            </p>

            <div className="mt-3 space-y-2">
              {draft.map((bp, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="w-16 text-xs text-muted-foreground">Up to</span>
                  <Input
                    type="number"
                    min={1}
                    step={5}
                    value={bp || ""}
                    onChange={(e) => setAt(i, Number(e.target.value))}
                    className="h-8 flex-1 tabular"
                  />
                  <span className="text-xs text-muted-foreground">days</span>
                  <button
                    onClick={() => removeAt(i)}
                    className="text-muted-foreground hover:text-danger"
                    aria-label="Remove breakpoint"
                  >
                    <X className="size-4" />
                  </button>
                </div>
              ))}
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={add}>
                <Plus className="size-3.5" /> Add breakpoint
              </Button>
            </div>

            <div className="mt-3 border-t pt-3">
              <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">Preview</p>
              <div className="flex flex-wrap gap-1">
                {preview.map((b) => (
                  <Badge key={b.key} variant={b.tone} className="text-[10px]">{b.label}</Badge>
                ))}
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={resetAll}>
                <RotateCcw className="size-3.5" /> Reset
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" className="h-8" onClick={() => setOpen(false)}>Cancel</Button>
                <Button size="sm" className="h-8" onClick={apply}>Apply</Button>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
