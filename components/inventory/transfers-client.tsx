"use client";

import * as React from "react";
import { ArrowRightLeft, Plus, Search, ChevronDown, AlertTriangle } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { LOCATIONS } from "@/lib/accounting/org";
import {
  allTransfers, loadTransfers, saveTransfers, nextTransferRef, daysInTransit, hasShortage,
  TRANSFER_STATUS_META,
  type TransferOrder, type TransferStatus,
} from "@/lib/inventory/transfers";

const TODAY = new Date().toISOString().slice(0, 10);

const STATUS_TABS: Array<{ value: TransferStatus | "all"; label: string }> = [
  { value: "all",         label: "All"        },
  { value: "draft",       label: "Draft"      },
  { value: "dispatched",  label: "Dispatched" },
  { value: "in-transit",  label: "In Transit" },
  { value: "received",    label: "Received"   },
  { value: "cancelled",   label: "Cancelled"  },
];

function locName(id: string) {
  return LOCATIONS.find((l) => l.id === id)?.name ?? id;
}

export function TransfersClient() {
  const [transfers, setTransfers] = React.useState<TransferOrder[]>([]);
  const [statusTab, setStatusTab] = React.useState<TransferStatus | "all">("all");
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setTransfers(allTransfers(loadTransfers()));
  }, []);

  const filtered = transfers.filter((t) => {
    if (statusTab !== "all" && t.status !== statusTab) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        t.ref.toLowerCase().includes(q) ||
        locName(t.fromLocationId).toLowerCase().includes(q) ||
        locName(t.toLocationId).toLowerCase().includes(q)
      );
    }
    return true;
  });

  const inTransitCount = transfers.filter((t) => t.status === "in-transit" || t.status === "dispatched").length;

  function toggleExpand(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="Inter-warehouse Transfers"
        subtitle="Stock movements between locations — with in-transit tracking and shortage detection."
        actions={<span className="text-sm text-muted-foreground">{inTransitCount} in transit</span>}
      />

      <Card className="mb-4 flex flex-wrap items-center gap-3 p-3">
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusTab(t.value)}
              className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", statusTab === t.value ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search…" className="h-8 w-44 pl-7 text-xs" />
        </div>
      </Card>

      <div className="space-y-2">
        {filtered.map((trf) => {
          const meta = TRANSFER_STATUS_META[trf.status];
          const shortage = hasShortage(trf);
          const daysOnRoute = trf.dispatchDate && trf.status !== "received" ? daysInTransit(trf.dispatchDate, TODAY) : null;
          const isOpen = expanded.has(trf.id);
          const totalLines = trf.lines.length;
          const totalQty = trf.lines.reduce((s, l) => s + l.qtyRequested, 0);

          return (
            <Card key={trf.id} className={cn("overflow-hidden", shortage && "border-warning/50")}>
              <button className="w-full text-left" onClick={() => toggleExpand(trf.id)}>
                <div className="flex flex-wrap items-center gap-3 p-3">
                  <span className="font-mono text-xs text-primary">{trf.ref}</span>
                  <Badge variant={meta.variant}>{meta.label}</Badge>
                  {shortage && <Badge variant="warning"><AlertTriangle className="mr-1 size-3" />Shortage</Badge>}
                  <span className="flex items-center gap-1 text-xs">
                    <span className="font-medium">{locName(trf.fromLocationId)}</span>
                    <ArrowRightLeft className="size-3.5 text-muted-foreground" />
                    <span className="font-medium">{locName(trf.toLocationId)}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{totalLines} SKUs · {totalQty.toLocaleString("en-IN")} units</span>
                  {daysOnRoute !== null && (
                    <span className="text-xs text-muted-foreground">{daysOnRoute}d on route</span>
                  )}
                  {trf.dispatchDate && <span className="text-xs text-muted-foreground">Dispatched {formatDate(trf.dispatchDate)}</span>}
                  {trf.receivedDate && <span className="text-xs text-success">Received {formatDate(trf.receivedDate)}</span>}
                  {trf.remarks && <span className="text-xs text-muted-foreground italic">{trf.remarks}</span>}
                  <ChevronDown className={cn("ml-auto size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                </div>
              </button>

              {isOpen && (
                <div className="border-t bg-muted/30 px-4 pb-3 pt-2">
                  <div className="mb-2 flex gap-4 text-xs text-muted-foreground">
                    {trf.dispatchDate && <span>Dispatched: <strong>{formatDate(trf.dispatchDate)}</strong></span>}
                    {trf.expectedArrival && <span>Expected: <strong>{formatDate(trf.expectedArrival)}</strong></span>}
                    {trf.receivedDate && <span>Received: <strong className="text-success">{formatDate(trf.receivedDate)}</strong></span>}
                    <span>Created: {formatDate(trf.createdAt)}</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-muted-foreground">
                        <th className="pb-1 font-medium">Item</th>
                        <th className="pb-1 font-medium">UOM</th>
                        <th className="pb-1 text-right font-medium">Requested</th>
                        <th className="pb-1 text-right font-medium">Dispatched</th>
                        <th className="pb-1 text-right font-medium">Received</th>
                        <th className="pb-1 font-medium">From bin</th>
                        <th className="pb-1 font-medium">To bin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {trf.lines.map((l, i) => {
                        const lineShortage = trf.status === "received" && l.qtyReceived < l.qtyDispatched;
                        return (
                          <tr key={i} className="border-t border-border/50">
                            <td className="py-1 font-mono">{l.itemId}</td>
                            <td className="py-1">{l.uom}</td>
                            <td className="py-1 text-right">{l.qtyRequested}</td>
                            <td className="py-1 text-right">{l.qtyDispatched}</td>
                            <td className={cn("py-1 text-right", lineShortage ? "text-warning font-medium" : l.qtyReceived > 0 ? "text-success" : "text-muted-foreground")}>
                              {l.qtyReceived > 0 ? l.qtyReceived : "—"}
                              {lineShortage && <span className="ml-1 text-[10px]">(-{l.qtyDispatched - l.qtyReceived})</span>}
                            </td>
                            <td className="py-1">{l.fromBin ?? "—"}</td>
                            <td className="py-1">{l.toBin ?? "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          );
        })}
        {filtered.length === 0 && (
          <Card className="py-12 text-center text-sm text-muted-foreground">No transfers match the selected filter.</Card>
        )}
      </div>
    </>
  );
}
