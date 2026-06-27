"use client";

import * as React from "react";
import { Store, ArrowUpRight, ArrowDownLeft, ChevronDown } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { Select } from "@/components/ui/input";
import { cn, formatDate } from "@/lib/utils";
import {
  loadLocations, loadStock, loadMovements,
  stockForLocation, locationTotalValue, locationItemCount,
  MOVEMENT_TYPE_LABELS,
  type ConsignmentLocation, type ConsignmentStatus,
} from "@/lib/inventory/consignment";

const STATUS_META: Record<ConsignmentStatus, { label: string; variant: "success" | "warning" | "default" }> = {
  active:       { label: "Active",       variant: "success" },
  reconciling:  { label: "Reconciling", variant: "warning" },
  closed:       { label: "Closed",      variant: "default" },
};

const MOV_BADGE: Record<string, "primary" | "success" | "warning" | "default"> = {
  dispatch:       "primary",
  "sale-report":  "success",
  return:         "warning",
  reconciliation: "default",
};

type Filter = "all" | "outbound" | "inbound";

export function ConsignmentClient() {
  const [locs, setLocs] = React.useState<ConsignmentLocation[]>([]);
  const [stock, setStock] = React.useState(loadStock());
  const [movements, setMovements] = React.useState(loadMovements());
  const [filter, setFilter] = React.useState<Filter>("all");
  const [selectedLoc, setSelectedLoc] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLocs(loadLocations());
    setStock(loadStock());
    setMovements(loadMovements());
  }, []);

  const filteredLocs = locs.filter((l) => filter === "all" || l.type === filter);
  const totalValue = stock.reduce((s, st) => s + st.totalValueOnSite, 0);
  const outboundValue = stock.filter((st) => {
    const loc = locs.find((l) => l.id === st.locationId);
    return loc?.type === "outbound";
  }).reduce((s, st) => s + st.totalValueOnSite, 0);

  const active = selectedLoc ? movements.filter((m) => m.locationId === selectedLoc) : [];
  const activeLocStock = selectedLoc ? stockForLocation(stock, selectedLoc) : [];

  return (
    <>
      <PageHeader
        title="Consignment / VMI"
        subtitle="Stock placed at customer / vendor sites — outbound consignments and inbound VMI arrangements."
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Stat label="Total value on site" value={totalValue} accent />
        <Stat label="Outbound (at customers)" value={outboundValue} />
        <StatCount label="Active locations" value={filteredLocs.filter((l) => l.status === "active").length} />
      </div>

      <div className="mb-4 flex gap-1">
        {(["all", "outbound", "inbound"] as Filter[]).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setSelectedLoc(null); }}
            className={cn("rounded-md px-3 py-1.5 text-xs font-medium capitalize transition-colors", filter === f ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
          >
            {f === "all" ? "All" : f === "outbound" ? "Outbound (at customers)" : "Inbound (VMI at us)"}
          </button>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {filteredLocs.map((loc) => {
          const meta = STATUS_META[loc.status];
          const locValue = locationTotalValue(stock, loc.id);
          const itemCount = locationItemCount(stock, loc.id);
          const isSelected = selectedLoc === loc.id;
          return (
            <Card
              key={loc.id}
              className={cn("cursor-pointer p-4 transition-colors hover:bg-accent/30", isSelected && "border-primary/50 bg-primary/5")}
              onClick={() => setSelectedLoc(isSelected ? null : loc.id)}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {loc.type === "outbound"
                      ? <ArrowUpRight className="size-4 text-primary" />
                      : <ArrowDownLeft className="size-4 text-success" />
                    }
                    <span className="font-semibold">{loc.name}</span>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{loc.partyName}</p>
                </div>
                <Badge variant={meta.variant}>{meta.label}</Badge>
              </div>
              <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                <span>Value on site: <strong className="text-foreground"><Money value={locValue} compact /></strong></span>
                <span>{itemCount} active SKUs</span>
                <span>Replenish: {loc.replenishmentFrequency}</span>
                {loc.lastReconciled && <span>Last reconciled: {formatDate(loc.lastReconciled)}</span>}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">{loc.address}</div>
            </Card>
          );
        })}
      </div>

      {selectedLoc && (
        <div className="mt-4 space-y-4">
          <h3 className="font-semibold">Stock at {locs.find((l) => l.id === selectedLoc)?.name}</h3>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 text-right font-medium">Placed</th>
                  <th className="px-4 py-2.5 text-right font-medium">Sold</th>
                  <th className="px-4 py-2.5 text-right font-medium">Returned</th>
                  <th className="px-4 py-2.5 text-right font-medium">On Hand</th>
                  <th className="px-4 py-2.5 text-right font-medium">Value</th>
                </tr>
              </thead>
              <tbody>
                {activeLocStock.map((s) => (
                  <tr key={s.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2">
                      <div className="font-medium">{s.itemName}</div>
                      <div className="text-[11px] text-muted-foreground">HSN {s.hsn} · {s.uom} · ₹{s.ratePerUnit}/unit</div>
                    </td>
                    <td className="px-4 py-2 text-right tabular">{s.qtyPlaced.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2 text-right tabular text-success">{s.qtySold.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2 text-right tabular text-warning">{s.qtyReturned > 0 ? s.qtyReturned.toLocaleString("en-IN") : "—"}</td>
                    <td className="px-4 py-2 text-right tabular font-medium">{s.qtyOnHand.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2 text-right tabular"><Money value={s.totalValueOnSite} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <h3 className="font-semibold">Recent movements</h3>
          <Card className="overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 font-medium">Ref</th>
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Item</th>
                  <th className="px-4 py-2.5 text-right font-medium">Qty</th>
                  <th className="px-4 py-2.5 font-medium">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {active.slice().reverse().map((m) => (
                  <tr key={m.id} className="border-b last:border-0 hover:bg-accent/40">
                    <td className="px-4 py-2 font-mono text-xs">{m.ref}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground">{formatDate(m.date)}</td>
                    <td className="px-4 py-2"><Badge variant={MOV_BADGE[m.type] ?? "default"} className="text-[10px]">{MOVEMENT_TYPE_LABELS[m.type]}</Badge></td>
                    <td className="px-4 py-2 text-xs">{m.itemName}</td>
                    <td className="px-4 py-2 text-right tabular text-xs">{m.qty.toLocaleString("en-IN")} {m.uom}</td>
                    <td className="px-4 py-2 max-w-[200px] truncate text-xs text-muted-foreground">{m.remarks}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </div>
      )}
    </>
  );
}

function Stat({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <Card className={cn("p-4", accent && "border-primary/30")}>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-bold tabular", accent && "text-primary")}><Money value={value} compact /></p>
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
