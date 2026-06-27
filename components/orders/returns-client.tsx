"use client";

import * as React from "react";
import { RotateCcw, Search, ChevronDown, FileCheck2 } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { cn, formatDate } from "@/lib/utils";
import { LOCATIONS, entityById } from "@/lib/accounting/org";
import {
  allReturns, loadReturns, saveReturns, nextCRNRef, nextCNRef,
  RETURN_STATUS_META, RETURN_REASON_META, RETURN_DISPOSITION_META,
  type CustomerReturn, type ReturnStatus,
} from "@/lib/orders/returns";

const TODAY = new Date().toISOString().slice(0, 10);

const STATUS_TABS: Array<{ value: ReturnStatus | "all"; label: string }> = [
  { value: "all",                label: "All"               },
  { value: "requested",          label: "Requested"         },
  { value: "approved",           label: "Approved"          },
  { value: "goods-received",     label: "Goods Received"    },
  { value: "credit-note-issued", label: "Credit Note Issued"},
  { value: "closed",             label: "Closed"            },
];

function locName(id: string) {
  return LOCATIONS.find((l) => l.id === id)?.name ?? id;
}

export function ReturnsClient() {
  const [returns, setReturns] = React.useState<CustomerReturn[]>([]);
  const [tab, setTab] = React.useState<ReturnStatus | "all">("all");
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setReturns(allReturns(loadReturns()));
  }, []);

  const filtered = returns.filter((r) => {
    if (tab !== "all" && r.status !== tab) return false;
    if (query) {
      const q = query.toLowerCase();
      return (
        r.ref.toLowerCase().includes(q) ||
        r.customerName.toLowerCase().includes(q) ||
        (r.creditNoteRef?.toLowerCase().includes(q) ?? false)
      );
    }
    return true;
  });

  const pending = returns.filter((r) => r.status === "requested" || r.status === "approved").length;
  const totalCredit = returns.filter((r) => r.creditNoteRef).reduce((s, r) => s + r.totalReturned, 0);

  function approve(id: string) {
    const updated = returns.map((r) => r.id !== id ? r : { ...r, status: "approved" as ReturnStatus, approvedBy: "emp-020", receivedDate: null });
    save(updated);
  }

  function receiveGoods(id: string) {
    const updated = returns.map((r) => r.id !== id ? r : { ...r, status: "goods-received" as ReturnStatus, receivedDate: TODAY });
    save(updated);
  }

  function issueCreditNote(id: string) {
    const added = loadReturns();
    const cn = nextCNRef(added);
    const updated = returns.map((r) => r.id !== id ? r : { ...r, status: "credit-note-issued" as ReturnStatus, creditNoteRef: cn, creditNoteDate: TODAY });
    save(updated);
  }

  function save(updated: CustomerReturn[]) {
    setReturns(updated);
    const addedIds = new Set(loadReturns().map((r) => r.id));
    const newOnes = updated.filter((r) => !r.id.startsWith("crn-00") || addedIds.has(r.id));
    saveReturns(newOnes.filter((r) => !["crn-001","crn-002","crn-003","crn-004","crn-005","crn-006","crn-007","crn-008","crn-009","crn-010"].includes(r.id)));
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  // Reason breakdown
  const reasonBreakdown = filtered.reduce<Record<string, number>>((acc, r) => {
    r.lines.forEach((l) => { acc[l.reason] = (acc[l.reason] ?? 0) + l.amount; });
    return acc;
  }, {});

  return (
    <>
      <PageHeader
        title="Customer Returns"
        subtitle="Reverse sales — credit notes, goods-back-to-warehouse, rework and scrap dispositions."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCount label="Pending action" value={pending} accent={pending > 0} />
        <StatMoney label="Credit notes issued (FY)" value={totalCredit} />
        <StatCount label="Total returns" value={returns.length} />
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTab(t.value)}
                className={cn("rounded-md px-2.5 py-1 text-xs font-medium transition-colors", tab === t.value ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="relative ml-auto">
            <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Customer / CRN / CN…" className="h-8 w-48 pl-7 text-xs" />
          </div>
        </div>

        <div className="divide-y">
          {filtered.map((ret) => {
            const meta = RETURN_STATUS_META[ret.status];
            const isOpen = expanded.has(ret.id);
            return (
              <div key={ret.id}>
                <button className="w-full text-left hover:bg-accent/30 transition-colors" onClick={() => toggleExpand(ret.id)}>
                  <div className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className="font-mono text-xs text-primary">{ret.ref}</span>
                    <Badge variant={meta.variant}>{meta.label}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(ret.date)}</span>
                    <span className="flex-1 truncate text-sm font-medium">{ret.customerName}</span>
                    <span className="text-xs text-muted-foreground">{locName(ret.locationId)}</span>
                    <Money value={ret.totalReturned} className="text-sm font-semibold" />
                    {ret.creditNoteRef && <span className="font-mono text-[10px] text-success">{ret.creditNoteRef}</span>}
                    <ChevronDown className={cn("size-4 text-muted-foreground transition-transform", isOpen && "rotate-180")} />
                  </div>
                </button>

                {isOpen && (
                  <div className="border-t bg-muted/30 px-4 pb-3 pt-2">
                    {ret.remarks && <p className="mb-2 text-xs italic text-muted-foreground">{ret.remarks}</p>}
                    <div className="mb-2 flex flex-wrap gap-4 text-xs text-muted-foreground">
                      {ret.receivedDate && <span>Received: {formatDate(ret.receivedDate)}</span>}
                      {ret.creditNoteDate && <span>Credit note: {formatDate(ret.creditNoteDate)}</span>}
                      {ret.approvedBy && <span>Approved by: {ret.approvedBy}</span>}
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-left text-muted-foreground">
                          <th className="pb-1 font-medium">Item</th>
                          <th className="pb-1 text-right font-medium">Returned</th>
                          <th className="pb-1 text-right font-medium">Approved</th>
                          <th className="pb-1 font-medium">Reason</th>
                          <th className="pb-1 font-medium">Disposition</th>
                          <th className="pb-1 text-right font-medium">Amount</th>
                          <th className="pb-1 font-medium">Invoice</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ret.lines.map((l, i) => {
                          const reasonMeta = RETURN_REASON_META[l.reason];
                          const dispMeta = RETURN_DISPOSITION_META[l.disposition];
                          return (
                            <tr key={i} className="border-t border-border/50">
                              <td className="py-1 pr-2">{l.itemName}</td>
                              <td className="py-1 text-right">{l.qtyReturned} {l.uom}</td>
                              <td className={cn("py-1 text-right", l.qtyApproved < l.qtyReturned ? "text-warning font-medium" : "text-success")}>{l.qtyApproved}</td>
                              <td className="py-1"><Badge variant={reasonMeta.variant} className="text-[9px]">{reasonMeta.label}</Badge></td>
                              <td className="py-1"><Badge variant={dispMeta.variant} className="text-[9px]">{dispMeta.label}</Badge></td>
                              <td className="py-1 text-right"><Money value={l.amount} /></td>
                              <td className="py-1 font-mono text-[10px] text-muted-foreground">{l.originalInvoiceRef}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    <div className="mt-2 flex gap-2">
                      {ret.status === "requested" && (
                        <Button size="sm" className="h-7 px-2 text-xs" onClick={() => approve(ret.id)}>Approve</Button>
                      )}
                      {ret.status === "approved" && (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => receiveGoods(ret.id)}>
                          <RotateCcw className="size-3" /> Mark received
                        </Button>
                      )}
                      {ret.status === "goods-received" && !ret.creditNoteRef && (
                        <Button size="sm" className="h-7 px-2 text-xs" onClick={() => issueCreditNote(ret.id)}>
                          <FileCheck2 className="size-3" /> Issue credit note
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-muted-foreground">No returns match.</div>
          )}
        </div>
      </Card>
    </>
  );
}

function StatCount({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className={cn("p-4", accent && "border-warning/30 bg-warning/5")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-bold", accent && "text-warning")}>{value}</p>
    </Card>
  );
}
function StatMoney({ label, value }: { label: string; value: number }) {
  return (
    <Card className="p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular"><Money value={value} compact /></p>
    </Card>
  );
}
