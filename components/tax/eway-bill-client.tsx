"use client";

import * as React from "react";
import { FileWarning, Search, Clock, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import {
  loadEways, saveEways, liveStatus, isExpiringWithin24h, expiryLabel, canExtend, extendBill,
  type EwayBill, type EwayStatus, type EwayBillType,
} from "@/lib/tax/eway-bill";

const TODAY = new Date().toISOString().slice(0, 10);

const STATUS_META: Record<EwayStatus, { label: string; variant: "default" | "primary" | "warning" | "success" | "danger" }> = {
  active:   { label: "Active",   variant: "success" },
  extended: { label: "Extended", variant: "primary" },
  expired:  { label: "Expired",  variant: "danger"  },
  cancelled:{ label: "Cancelled",variant: "default" },
};

const TYPE_META: Record<EwayBillType, string> = {
  "outward":    "Outward Supply",
  "inward":     "Inward Supply",
  "job-work":   "Job Work",
  "SKD/CKD":    "SKD/CKD",
  "line-sales": "Line Sales",
  "other":      "Other",
};

const TRANSPORT_ICON: Record<string, string> = {
  road: "🚛", rail: "🚂", air: "✈️", ship: "🚢",
};

type StatusFilter = EwayStatus | "all";

export function EwayBillClient() {
  const [bills, setBills] = React.useState<EwayBill[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("active");
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setBills(loadEways());
  }, []);

  const richBills = bills.map((b) => ({ ...b, liveStatus: liveStatus(b, TODAY) }));

  const filtered = richBills.filter((b) => {
    if (statusFilter !== "all" && b.liveStatus !== statusFilter) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        b.ewbNo.includes(q) ||
        b.toTradeName.toLowerCase().includes(q) ||
        b.fromTradeName.toLowerCase().includes(q) ||
        b.documentNo.toLowerCase().includes(q)
      );
    }
    return true;
  });

  const expiringSoon = richBills.filter((b) => isExpiringWithin24h(b, TODAY)).length;
  const active = richBills.filter((b) => b.liveStatus === "active" || b.liveStatus === "extended").length;

  function extend(id: string) {
    const updated = bills.map((b) => (b.id === id ? extendBill(b) : b));
    setBills(updated);
    saveEways(updated);
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  return (
    <>
      <PageHeader
        title="E-way Bills"
        subtitle="GST-mandated e-way bills for goods movement exceeding 50 km or ₹50,000 in value."
      />

      {expiringSoon > 0 && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-warning/40 bg-warning/10 p-3">
          <AlertTriangle className="size-4 text-warning" />
          <span className="text-sm"><strong>{expiringSoon}</strong> e-way bill{expiringSoon > 1 ? "s" : ""} expiring within 24 hours — extend before delivery is delayed.</span>
        </div>
      )}

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="Active" value={active} icon={<CheckCircle2 className="size-4 text-success" />} />
        <Stat label="Expiring <24h" value={expiringSoon} icon={<Clock className="size-4 text-warning" />} accent={expiringSoon > 0} />
        <Stat label="Expired" value={richBills.filter((b) => b.liveStatus === "expired").length} icon={<XCircle className="size-4 text-danger" />} />
        <Stat label="Cancelled" value={richBills.filter((b) => b.liveStatus === "cancelled").length} icon={<FileWarning className="size-4 text-muted-foreground" />} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="flex gap-1">
            {(["all", "active", "expired", "cancelled"] as StatusFilter[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium capitalize transition-colors", statusFilter === s ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
              >
                {s === "all" ? "All" : STATUS_META[s as EwayStatus]?.label ?? s}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="EWB no / trade name…" className="h-8 w-48 pl-7 text-xs" />
          </div>
        </div>

        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-2.5 font-medium">EWB No.</th>
                <th className="px-4 py-2.5 font-medium">Date</th>
                <th className="px-4 py-2.5 font-medium">Type</th>
                <th className="px-4 py-2.5 font-medium">From → To</th>
                <th className="px-4 py-2.5 font-medium">Document</th>
                <th className="px-4 py-2.5 text-right font-medium">Value</th>
                <th className="px-4 py-2.5 font-medium">Validity</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((b) => {
                const meta = STATUS_META[b.liveStatus];
                const expiring = isExpiringWithin24h(b, TODAY);
                const expLabel = expiryLabel(b, TODAY);
                return (
                  <tr key={b.id} className={cn("border-b last:border-0 hover:bg-accent/40", expiring && "bg-warning/5")}>
                    <td className="px-4 py-2 font-mono text-xs">{b.ewbNo}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(b.date)}</td>
                    <td className="px-4 py-2 text-xs">{TYPE_META[b.type]}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-1 text-xs">
                        <span className="font-medium">{b.fromState}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium">{b.toState}</span>
                        <span title={b.transportMode}>{TRANSPORT_ICON[b.transportMode]}</span>
                        <span className="text-muted-foreground">{b.distanceKm} km</span>
                      </div>
                      <div className="text-[11px] text-muted-foreground">{b.toTradeName}</div>
                    </td>
                    <td className="px-4 py-2">
                      <div className="font-mono text-xs">{b.documentNo}</div>
                      <div className="text-[11px] text-muted-foreground capitalize">{b.documentType.replace("-", " ")}</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular"><Money value={b.totalValue} /></td>
                    <td className="px-4 py-2">
                      <div className={cn("text-xs font-medium", expiring ? "text-warning" : b.liveStatus === "expired" ? "text-danger" : "text-muted-foreground")}>
                        {expLabel}
                      </div>
                      <div className="text-[11px] text-muted-foreground">Valid till {formatDate(b.validUpto)}</div>
                    </td>
                    <td className="px-4 py-2"><Badge variant={meta.variant} className="text-[10px]">{meta.label}</Badge></td>
                    <td className="px-4 py-2">
                      {canExtend(b, TODAY) && (
                        <Button size="sm" variant="outline" className="h-6 px-2 text-[10px]" onClick={() => extend(b.id)}>
                          Extend
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">No e-way bills match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}

function Stat({ label, value, icon, accent }: { label: string; value: number; icon: React.ReactNode; accent?: boolean }) {
  return (
    <Card className={cn("flex items-center gap-3 p-4", accent && "border-warning/40 bg-warning/5")}>
      {icon}
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
        <p className="text-xl font-bold">{value}</p>
      </div>
    </Card>
  );
}
