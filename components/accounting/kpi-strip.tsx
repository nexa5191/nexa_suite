"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, RotateCw } from "lucide-react";
import { Money } from "@/components/ui/money";
import { cn } from "@/lib/utils";

export interface KpiDetail {
  label: string;
  value?: number;
  hint?: string;
}

export interface Kpi {
  label: string;
  value: number;
  sub?: string;
  colored?: boolean;
  /** Redirect target — turns the card into a drill-through link. */
  href?: string;
  /** Breakdown rows — turns the card into a flip card revealing the detail. */
  detail?: KpiDetail[];
  /** Heading shown on the flip side. Defaults to "Breakdown". */
  detailTitle?: string;
  /** Called when the card is clicked (works alongside flip/href). */
  onClick?: () => void;
}

export function KpiStrip({ items }: { items: Kpi[] }) {
  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {items.map((k) => (
        <KpiCard key={k.label} k={k} />
      ))}
    </div>
  );
}

function Face({ k }: { k: Kpi }) {
  return (
    <>
      <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        {k.label}
        {k.href && <ArrowUpRight className="size-3 opacity-0 transition-opacity group-hover:opacity-70" />}
        {k.detail && <RotateCw className="size-3 opacity-0 transition-opacity group-hover:opacity-70" />}
      </p>
      <p className={cn("mt-0.5 text-lg font-bold leading-tight tracking-tight", k.colored && k.value < 0 && "text-danger")}>
        <Money value={k.value} compact />
      </p>
      {k.sub && <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>}
    </>
  );
}

const SHELL = "rounded-lg border bg-card px-4 py-2.5 shadow-sm transition-colors";

function KpiCard({ k }: { k: Kpi }) {
  // Flip card — reveals a breakdown on the back face.
  if (k.detail && k.detail.length > 0) {
    return (
      <div className="group [perspective:1200px]">
        <Flip k={k} />
      </div>
    );
  }
  // Plain redirect card.
  if (k.href) {
    return (
      <Link href={k.href} className={cn(SHELL, "group block hover:border-primary/40 hover:bg-accent/40")}>
        <Face k={k} />
      </Link>
    );
  }
  // Clickable card (filter / action).
  return (
    <div
      className={cn(SHELL, k.onClick && "cursor-pointer hover:border-primary/40 hover:bg-accent/40")}
      onClick={k.onClick}
    >
      <Face k={k} />
    </div>
  );
}

function Flip({ k }: { k: Kpi }) {
  const [flipped, setFlipped] = React.useState(false);
  return (
    <div
      className={cn(SHELL, "cursor-pointer hover:border-primary/40")}
      onClick={() => { setFlipped((f) => !f); k.onClick?.(); }}
    >
      {!flipped ? (
        <>
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            {k.label}
            <RotateCw className="size-3 opacity-0 transition-opacity group-hover:opacity-70" />
          </p>
          <p className="mt-0.5 text-lg font-bold leading-tight tracking-tight">
            <Money value={k.value} compact />
          </p>
          {k.sub && <p className="mt-0.5 text-xs text-muted-foreground">{k.sub}</p>}
        </>
      ) : (
        <>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center justify-between">
            {k.detailTitle ?? "Breakdown"}
            <RotateCw className="size-3 opacity-60" />
          </p>
          <div className="max-h-36 overflow-y-auto scrollbar-thin space-y-0.5">
            {k.detail!.map((d) => (
              <div key={d.label} className="flex items-center justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">{d.label}</span>
                {d.value !== undefined && (
                  <span className="tabular font-medium shrink-0">
                    <Money value={d.value} compact />
                  </span>
                )}
                {d.hint && d.value === undefined && <span className="font-medium shrink-0">{d.hint}</span>}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
