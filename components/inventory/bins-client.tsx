"use client";

import * as React from "react";
import { LayoutGrid, Plus, Search } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { LOCATIONS } from "@/lib/accounting/org";
import {
  allBins, loadBins, saveBins, allBinStock, loadBinStock, stockForBin, nextBinId,
  ZONE_META, SEED_BINS,
  type Bin, type BinZone,
} from "@/lib/inventory/bins";

const ZONES: BinZone[] = ["receiving", "storage", "picking", "dispatch", "quarantine"];

function pct(current: number, cap: number) {
  if (cap <= 0) return 0;
  return Math.min(100, Math.round((current / cap) * 100));
}

export function BinsClient() {
  const [bins, setBins] = React.useState<Bin[]>([]);
  const [stock, setStock] = React.useState(allBinStock([]));
  const [locationId, setLocationId] = React.useState(LOCATIONS[0]?.id ?? "");
  const [zone, setZone] = React.useState<BinZone | "all">("all");
  const [query, setQuery] = React.useState("");
  const [showForm, setShowForm] = React.useState(false);

  React.useEffect(() => {
    setBins(allBins(loadBins()));
    setStock(allBinStock(loadBinStock()));
  }, []);

  const save = (updated: Bin[]) => { setBins(updated); saveBins(updated.filter((b) => !SEED_BINS.some((s) => s.id === b.id))); };

  const locBins = bins.filter((b) => {
    if (b.locationId !== locationId) return false;
    if (zone !== "all" && b.zone !== zone) return false;
    if (query) {
      const q = query.toLowerCase();
      return b.code.toLowerCase().includes(q) || b.description.toLowerCase().includes(q);
    }
    return true;
  });

  const zoneGroups = ZONES.filter((z) => zone === "all" || z === zone);

  return (
    <>
      <PageHeader
        title="Bin / Rack Management"
        subtitle="Sub-location tracking within each warehouse — assign stock to aisles, racks and zones."
        actions={<Button onClick={() => setShowForm(!showForm)}><Plus className="size-4" /> Add bin</Button>}
      />

      <Card className="mb-4 flex flex-wrap items-end gap-3 p-3">
        <F label="Location">
          <Select value={locationId} onChange={(e) => setLocationId(e.target.value)} className="h-9 w-44">
            {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </Select>
        </F>
        <F label="Zone">
          <Select value={zone} onChange={(e) => setZone(e.target.value as BinZone | "all")} className="h-9 w-36">
            <option value="all">All zones</option>
            {ZONES.map((z) => <option key={z} value={z}>{ZONE_META[z].label}</option>)}
          </Select>
        </F>
        <div className="relative ml-auto">
          <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search bins…" className="h-9 w-44 pl-7 text-xs" />
        </div>
      </Card>

      {showForm && (
        <AddBinForm
          locationId={locationId}
          bins={bins}
          onClose={() => setShowForm(false)}
          onSave={(b) => { save([...bins, b]); setShowForm(false); }}
        />
      )}

      <div className="space-y-4">
        {zoneGroups.map((z) => {
          const zoneBins = locBins.filter((b) => b.zone === z);
          if (zoneBins.length === 0) return null;
          const meta = ZONE_META[z];
          return (
            <div key={z}>
              <h3 className={cn("mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider", meta.color)}>
                <span className={cn("size-2 rounded-full", meta.bg, meta.border, "border")} />
                {meta.label} · {zoneBins.length} bins
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {zoneBins.map((bin) => {
                  const utilPct = pct(bin.currentKg, bin.capacityKg);
                  const binStock = stockForBin(bin.id, stock);
                  return (
                    <Card key={bin.id} className={cn("p-3", meta.border, "border")}>
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono text-sm font-semibold">{bin.code}</p>
                          <p className="mt-0.5 text-[11px] text-muted-foreground">{bin.description}</p>
                        </div>
                        <Badge variant={meta.badge}>{meta.label}</Badge>
                      </div>
                      <div className="mt-2">
                        <div className="mb-1 flex justify-between text-[11px] text-muted-foreground">
                          <span>Utilisation</span>
                          <span>{utilPct}% ({bin.currentKg.toLocaleString("en-IN")} / {bin.capacityKg.toLocaleString("en-IN")} kg)</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div
                            className={cn("h-full rounded-full transition-all", utilPct >= 90 ? "bg-danger" : utilPct >= 75 ? "bg-warning" : "bg-primary")}
                            style={{ width: `${utilPct}%` }}
                          />
                        </div>
                      </div>
                      {binStock.length > 0 && (
                        <div className="mt-2 space-y-0.5 border-t pt-2">
                          {binStock.map((s) => (
                            <div key={s.itemId} className="flex items-center justify-between text-[11px]">
                              <span className="truncate text-muted-foreground">{s.itemId}</span>
                              <span className="font-medium">{s.qty.toLocaleString("en-IN")} {s.uom}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
        {locBins.length === 0 && (
          <Card className="py-12 text-center text-sm text-muted-foreground">
            <LayoutGrid className="mx-auto mb-2 size-8 opacity-30" />
            No bins found for this location / filter.
          </Card>
        )}
      </div>
    </>
  );
}

function AddBinForm({ locationId, bins, onClose, onSave }: { locationId: string; bins: Bin[]; onClose: () => void; onSave: (b: Bin) => void }) {
  const [code, setCode] = React.useState("");
  const [zone, setZone] = React.useState<BinZone>("storage");
  const [desc, setDesc] = React.useState("");
  const [cap, setCap] = React.useState("");

  function submit() {
    const b: Bin = {
      id: nextBinId(bins),
      code: code.trim(),
      locationId,
      zone,
      description: desc.trim(),
      capacityKg: parseFloat(cap) || 0,
      currentKg: 0,
      isActive: true,
    };
    onSave(b);
  }

  const valid = code.trim() && desc.trim() && parseFloat(cap) > 0;

  return (
    <Card className="mb-4 border-primary/30 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold">Add bin / rack</h3>
        <button onClick={onClose} className="text-xs text-muted-foreground hover:text-foreground">Close</button>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <F label="Code"><Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="A-01-01" className="h-9 w-28" /></F>
        <F label="Zone">
          <Select value={zone} onChange={(e) => setZone(e.target.value as BinZone)} className="h-9 w-36">
            {ZONES.map((z) => <option key={z} value={z}>{ZONE_META[z].label}</option>)}
          </Select>
        </F>
        <F label="Description"><Input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Aisle A, rack 01, level 01" className="h-9 w-64" /></F>
        <F label="Capacity (kg)"><Input value={cap} onChange={(e) => setCap(e.target.value)} inputMode="decimal" placeholder="10000" className="h-9 w-28" /></F>
        <Button disabled={!valid} onClick={submit}><Plus className="size-4" /> Add bin</Button>
      </div>
    </Card>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
