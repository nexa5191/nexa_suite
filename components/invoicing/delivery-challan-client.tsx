"use client";

import * as React from "react";
import { Truck, Plus, Search, ChevronDown, FileText } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { ENTITIES, entityById } from "@/lib/accounting/org";
import {
  loadChallans, saveChallans, createChallan,
  type DeliveryChallan, type ChallanType, type ChallanStatus,
} from "@/lib/invoicing/delivery-challan";

const TYPE_META: Record<ChallanType, { label: string; variant: "default" | "primary" | "warning" | "success" | "danger" | "outline" }> = {
  "sale":             { label: "Sale",             variant: "primary"  },
  "returnable":       { label: "Returnable",       variant: "warning"  },
  "job-work":         { label: "Job Work",         variant: "success"  },
  "branch-transfer":  { label: "Branch Transfer",  variant: "outline"  },
  "sample":           { label: "Sample",           variant: "default"  },
};

const STATUS_META: Record<ChallanStatus, { label: string; variant: "default" | "primary" | "warning" | "success" | "danger" }> = {
  draft:     { label: "Draft",     variant: "default"  },
  issued:    { label: "Issued",    variant: "primary"  },
  delivered: { label: "Delivered", variant: "success"  },
  returned:  { label: "Returned",  variant: "warning"  },
  invoiced:  { label: "Invoiced",  variant: "success"  },
  cancelled: { label: "Cancelled", variant: "danger"   },
};

const STATUS_TABS: Array<{ value: ChallanStatus | "all"; label: string }> = [
  { value: "all",       label: "All"       },
  { value: "draft",     label: "Draft"     },
  { value: "issued",    label: "Issued"    },
  { value: "delivered", label: "Delivered" },
  { value: "invoiced",  label: "Invoiced"  },
  { value: "cancelled", label: "Cancelled" },
];

export function DeliveryChallanClient() {
  const [challans, setChallans] = React.useState<DeliveryChallan[]>([]);
  const [statusTab, setStatusTab] = React.useState<ChallanStatus | "all">("all");
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setChallans(loadChallans());
  }, []);

  const filtered = challans.filter((c) => {
    if (statusTab !== "all" && c.status !== statusTab) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        c.ref.toLowerCase().includes(q) ||
        c.consigneeName.toLowerCase().includes(q) ||
        (c.vehicleNo && c.vehicleNo.toLowerCase().includes(q)) ||
        (c.linkedInvoiceRef?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  function toggleExpand(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  const totalValue = filtered.reduce((s, c) => s + c.totalAmount, 0);

  return (
    <>
      <PageHeader
        title="Delivery Challans"
        subtitle="Outbound document before invoice — sale, returnable, job-work, branch transfer and sample types."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        {(["sale", "branch-transfer", "job-work", "returnable"] as ChallanType[]).map((t) => {
          const count = challans.filter((c) => c.type === t && c.status !== "cancelled").length;
          const meta = TYPE_META[t];
          return (
            <Card key={t} className="p-4">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{meta.label}</p>
              <p className="mt-1 text-xl font-bold">{count}</p>
            </Card>
          );
        })}
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
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
        </div>

        <div className="divide-y">
          {filtered.map((c) => {
            const typeMeta = TYPE_META[c.type];
            const statusMeta = STATUS_META[c.status];
            const isOpen = expanded.has(c.id);
            return (
              <div key={c.id}>
                <button className="w-full text-left hover:bg-accent/30 transition-colors" onClick={() => toggleExpand(c.id)}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="font-mono text-xs text-primary">{c.ref}</span>
                    <Badge variant={typeMeta.variant} className="text-[10px]">{typeMeta.label}</Badge>
                    <Badge variant={statusMeta.variant} className="text-[10px]">{statusMeta.label}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(c.date)}</span>
                    <span className="flex-1 truncate text-sm font-medium">{c.consigneeName}</span>
                    <span className="text-xs text-muted-foreground">{c.dispatchFrom} → {c.deliverTo}</span>
                    {c.vehicleNo && <span className="font-mono text-xs text-muted-foreground">{c.vehicleNo}</span>}
                    <Money value={c.totalAmount} className="text-sm font-semibold" />
                    {c.ewayBillNo && <Badge variant="outline" className="text-[10px]">EWB {c.ewayBillNo}</Badge>}
                    {c.linkedInvoiceRef && <span className="text-[10px] text-success">{c.linkedInvoiceRef}</span>}
                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </div>
                </button>
                {isOpen && (
                  <div className="border-t bg-muted/30 px-4 pb-3 pt-2">
                    <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      <span>Entity: {entityById(c.entityId)?.name ?? c.entityId}</span>
                      {c.driverName && <span>Driver: {c.driverName}</span>}
                      {c.remarks && <span className="italic">{c.remarks}</span>}
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="pb-1 font-medium">Item</th>
                          <th className="pb-1 font-medium">HSN</th>
                          <th className="pb-1 text-right font-medium">Qty</th>
                          <th className="pb-1 font-medium">UOM</th>
                          <th className="pb-1 text-right font-medium">Rate</th>
                          <th className="pb-1 text-right font-medium">Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {c.lines.map((l, i) => (
                          <tr key={i} className="border-t border-border/50">
                            <td className="py-1">{l.itemName}</td>
                            <td className="py-1 font-mono">{l.hsn}</td>
                            <td className="py-1 text-right">{l.qty.toLocaleString("en-IN")}</td>
                            <td className="py-1">{l.uom}</td>
                            <td className="py-1 text-right"><Money value={l.rate} /></td>
                            <td className="py-1 text-right font-medium"><Money value={l.amount} /></td>
                          </tr>
                        ))}
                        <tr className="border-t-2 font-semibold">
                          <td colSpan={4} className="py-1">Total</td>
                          <td />
                          <td className="py-1 text-right"><Money value={c.totalAmount} /></td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No challans match.</div>
          )}
        </div>
      </Card>
    </>
  );
}
