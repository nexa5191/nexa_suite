"use client";

import * as React from "react";
import {
  RotateCcw, Plus, ChevronRight, Truck, FileCheck2,
  CheckCircle2, AlertCircle, ReceiptText, Search,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, Select, Label } from "@/components/ui/input";
import { Drawer } from "@/components/ui/modal";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import { VENDORS, vendorById, vendorName } from "@/lib/vendors";
import { LOCATIONS } from "@/lib/accounting/org";
import {
  allRTVs, loadRTVs, saveRTVs, nextRTVRef, nextDNRef,
  RTV_STATUS_META, RTV_REASON_META,
  type ReturnToVendor, type RTVLine, type RTVStatus, type RTVReason,
} from "@/lib/inventory/rtv";

const TODAY = "2026-06-27";
const GST_RATE = 0.18;

const INVENTORY_VENDORS = VENDORS.filter((v) => v.active);

const SEED_IDS = [
  "rtv-001","rtv-002","rtv-003","rtv-004","rtv-005",
  "rtv-006","rtv-007","rtv-008","rtv-009","rtv-010",
];

const UOM_OPTIONS = ["KG", "LTR", "PCS", "BAG", "ROL", "PK", "CTN", "BOX", "MTR"];
const REASON_OPTIONS: RTVReason[] = [
  "quality-rejection","excess-quantity","wrong-item","damaged","expired","price-dispute",
];
const STATUS_TABS: Array<{ value: RTVStatus | "all"; label: string }> = [
  { value: "all",                  label: "All"                  },
  { value: "draft",                label: "Draft"                },
  { value: "approved",             label: "Approved"             },
  { value: "dispatched",           label: "Dispatched"           },
  { value: "credit-note-received", label: "Credit Note Received" },
  { value: "adjusted",             label: "Adjusted"             },
];

function fmtAmt(n: number) {
  return "₹" + new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(n);
}

function computeAmounts(lines: RTVLine[]) {
  const totalAmount = lines.reduce((s, l) => s + l.amount, 0);
  const gstAmount   = Math.round(totalAmount * GST_RATE);
  return { totalAmount, gstAmount, totalWithGst: totalAmount + gstAmount };
}

// ── Small shared helpers ─────────────────────────────────────────────────────

function Field({ label, value, className }: { label: string; value: React.ReactNode; className?: string }) {
  return (
    <div className={cn("space-y-0.5", className)}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
}

function StatCard({
  label, value, sub, icon: Icon, highlight,
}: {
  label: string; value: string; sub?: string;
  icon?: React.ElementType; highlight?: boolean;
}) {
  return (
    <Card className={cn("flex items-start gap-3 p-4", highlight && "border-warning/40 bg-warning/5")}>
      {Icon && <Icon className={cn("mt-0.5 size-5 shrink-0 text-muted-foreground", highlight && "text-warning")} />}
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("text-xl font-bold tabular-nums", highlight && "text-warning")}>{value}</p>
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </div>
    </Card>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function RTVClient() {
  const [added, setAdded] = React.useState<ReturnToVendor[]>([]);
  const [statusFilter, setStatusFilter] = React.useState<RTVStatus | "all">("all");
  const [vendorFilter, setVendorFilter] = React.useState("all");
  const [search, setSearch] = React.useState("");
  const [selected, setSelected] = React.useState<ReturnToVendor | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [creditNoteTarget, setCreditNoteTarget] = React.useState<ReturnToVendor | null>(null);

  React.useEffect(() => { setAdded(loadRTVs()); }, []);

  function persist(next: ReturnToVendor[]) {
    const extra = next.filter((r) => !SEED_IDS.includes(r.id));
    setAdded(extra);
    saveRTVs(extra);
  }

  const allList = allRTVs(added);

  function updateRTV(id: string, patch: Partial<ReturnToVendor>) {
    const next = allList.map((r) => r.id === id ? { ...r, ...patch } : r);
    persist(next.filter((r) => !SEED_IDS.includes(r.id)));
    setAdded(next.filter((r) => !SEED_IDS.includes(r.id)));
    setSelected(next.find((r) => r.id === id) ?? null);
  }

  const q = search.toLowerCase();
  const visible = allList.filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
    if (vendorFilter !== "all" && r.vendorId !== vendorFilter) return false;
    if (q) {
      return (
        r.ref.toLowerCase().includes(q) ||
        vendorName(r.vendorId).toLowerCase().includes(q) ||
        r.poRef.toLowerCase().includes(q) ||
        (r.debitNoteRef ?? "").toLowerCase().includes(q) ||
        r.lines.some((l) => l.itemName.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const pendingDispatch    = allList.filter((r) => r.status === "approved").length;
  const pendingCreditNote  = allList.filter((r) => r.status === "dispatched").length;
  const awaitingCreditAmt  = allList
    .filter((r) => r.status === "dispatched")
    .reduce((s, r) => s + r.totalWithGst, 0);

  return (
    <>
      <PageHeader
        title="Return to Vendor"
        subtitle="Manage goods returns to vendors after GRN — quality rejections, excess supply, wrong items."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" /> New RTV
          </Button>
        }
      />

      {/* Summary strip */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <StatCard
          icon={Truck}
          label="Pending Dispatch"
          value={String(pendingDispatch)}
          sub="Approved — awaiting shipment"
          highlight={pendingDispatch > 0}
        />
        <StatCard
          icon={ReceiptText}
          label="Pending Credit Note"
          value={String(pendingCreditNote)}
          sub="Dispatched — credit not received"
          highlight={pendingCreditNote > 0}
        />
        <StatCard
          icon={AlertCircle}
          label="Value Awaiting Credit"
          value={fmtAmt(awaitingCreditAmt)}
          sub="Total with GST (dispatched)"
        />
      </div>

      {/* Filters */}
      <div className="mb-3 flex flex-wrap gap-2 items-center">
        {/* Status tabs */}
        <div className="flex flex-wrap gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.value}
              onClick={() => setStatusFilter(t.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === t.value
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-input bg-card text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-2">
          <Select
            value={vendorFilter}
            onChange={(e) => setVendorFilter(e.target.value)}
            className="h-8 w-44 text-xs"
          >
            <option value="all">All Vendors</option>
            {INVENTORY_VENDORS.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </Select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search ref, vendor, item…"
              className="h-8 pl-8 w-48 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground text-left">
                <th className="px-5 py-3 font-medium">RTV Ref</th>
                <th className="px-5 py-3 font-medium">Vendor</th>
                <th className="px-5 py-3 font-medium">PO Ref</th>
                <th className="px-5 py-3 font-medium">Items</th>
                <th className="px-5 py-3 font-medium text-right">Value (incl. GST)</th>
                <th className="px-5 py-3 font-medium">Debit Note</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 w-8" />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-5 py-10 text-center text-muted-foreground">
                    No RTVs match your filters.
                  </td>
                </tr>
              )}
              {visible.map((r) => {
                const meta = RTV_STATUS_META[r.status];
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelected(r)}
                    className="cursor-pointer border-b last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    <td className="px-5 py-3">
                      <p className="font-mono font-medium text-xs">{r.ref}</p>
                      <p className="text-xs text-muted-foreground">{r.date}</p>
                    </td>
                    <td className="px-5 py-3">
                      <p className="font-medium">{vendorName(r.vendorId)}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {LOCATIONS.find((l) => l.id === r.locationId)?.name ?? r.locationId}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground font-mono">{r.poRef}</td>
                    <td className="px-5 py-3">
                      <div className="flex flex-wrap gap-1">
                        {r.lines.slice(0, 2).map((l, i) => {
                          const rm = RTV_REASON_META[l.reason];
                          return (
                            <span
                              key={i}
                              className="rounded border bg-muted/30 px-1.5 py-0.5 text-[11px]"
                            >
                              {l.itemName.split(" ").slice(0, 2).join(" ")} × {l.qty} {l.uom}
                            </span>
                          );
                        })}
                        {r.lines.length > 2 && (
                          <span className="text-[11px] text-muted-foreground">+{r.lines.length - 2}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3 text-right tabular-nums font-medium">
                      {fmtAmt(r.totalWithGst)}
                    </td>
                    <td className="px-5 py-3">
                      {r.debitNoteRef ? (
                        <div>
                          <p className="text-xs font-mono font-medium">{r.debitNoteRef}</p>
                          <p className="text-[11px] text-muted-foreground">{r.debitNoteDate}</p>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <Badge variant={meta.variant}>{meta.label}</Badge>
                    </td>
                    <td className="px-5 py-3">
                      <ChevronRight className="size-4 text-muted-foreground/50" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {selected && (
        <RTVDetailDrawer
          rtv={selected}
          onClose={() => setSelected(null)}
          onUpdate={(patch) => updateRTV(selected.id, patch)}
          onMarkCreditNote={() => setCreditNoteTarget(selected)}
        />
      )}

      {creating && (
        <CreateRTVDrawer
          nextRef={nextRTVRef(added)}
          onClose={() => setCreating(false)}
          onCreate={(rtv) => {
            const next = [...allList, rtv];
            persist(next.filter((r) => !SEED_IDS.includes(r.id)));
            setCreating(false);
            setSelected(rtv);
          }}
        />
      )}

      {creditNoteTarget && (
        <CreditNoteModal
          rtv={creditNoteTarget}
          suggestedRef={nextDNRef(added)}
          onClose={() => setCreditNoteTarget(null)}
          onConfirm={(dnRef, dnDate, dnAmount) => {
            updateRTV(creditNoteTarget.id, {
              debitNoteRef: dnRef,
              debitNoteDate: dnDate,
              debitNoteAmount: dnAmount,
              status: "credit-note-received",
            });
            setCreditNoteTarget(null);
          }}
        />
      )}
    </>
  );
}

// ── Detail Drawer ────────────────────────────────────────────────────────────

function RTVDetailDrawer({
  rtv, onClose, onUpdate, onMarkCreditNote,
}: {
  rtv: ReturnToVendor;
  onClose: () => void;
  onUpdate: (patch: Partial<ReturnToVendor>) => void;
  onMarkCreditNote: () => void;
}) {
  const meta = RTV_STATUS_META[rtv.status];
  const loc  = LOCATIONS.find((l) => l.id === rtv.locationId);

  // Dispatch form state
  const [showDispatch, setShowDispatch] = React.useState(false);
  const [dispatchDate, setDispatchDate] = React.useState(TODAY);
  const [vehicleNo, setVehicleNo]       = React.useState(rtv.vehicleNo);

  function approve() {
    onUpdate({ status: "approved", approvedBy: "emp-020", approvedAt: TODAY });
  }

  function markDispatched() {
    if (!vehicleNo.trim()) return;
    onUpdate({ status: "dispatched", dispatchDate, vehicleNo: vehicleNo.trim() });
    setShowDispatch(false);
  }

  function markAdjusted() {
    onUpdate({ status: "adjusted" });
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-lg"
      title={
        <span className="flex items-center gap-1.5">
          <RotateCcw className="size-4 text-muted-foreground" />
          {rtv.ref}
        </span>
      }
      subtitle={rtv.date}
      actions={<Badge variant={meta.variant}>{meta.label}</Badge>}
    >
      <div className="space-y-5">
        {/* Core info */}
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <Field label="Vendor"   value={vendorName(rtv.vendorId)} />
          <Field label="Location" value={loc?.name ?? rtv.locationId} />
          <Field label="PO Ref"   value={<span className="font-mono">{rtv.poRef}</span>} />
          {rtv.dispatchDate && <Field label="Dispatch Date" value={rtv.dispatchDate} />}
          {rtv.vehicleNo && <Field label="Vehicle No" value={<span className="font-mono">{rtv.vehicleNo}</span>} />}
          {rtv.approvedBy && <Field label="Approved by" value={rtv.approvedBy} />}
          {rtv.remarks && <Field label="Remarks" value={rtv.remarks} className="col-span-2" />}
        </dl>

        {/* Lines */}
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Return Lines</p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground text-left">
                  <th className="py-1.5 font-medium">Item</th>
                  <th className="py-1.5 font-medium">HSN</th>
                  <th className="py-1.5 text-right font-medium">Qty</th>
                  <th className="py-1.5 text-right font-medium">Rate</th>
                  <th className="py-1.5 text-right font-medium">Amount</th>
                  <th className="py-1.5 font-medium pl-2">Reason</th>
                  <th className="py-1.5 text-[11px] text-muted-foreground">GRN</th>
                </tr>
              </thead>
              <tbody>
                {rtv.lines.map((l, i) => {
                  const rm = RTV_REASON_META[l.reason];
                  return (
                    <tr key={i} className="border-b last:border-0">
                      <td className="py-2 pr-2 text-xs font-medium">{l.itemName}</td>
                      <td className="py-2 text-xs text-muted-foreground font-mono">{l.hsn}</td>
                      <td className="py-2 text-right tabular-nums text-xs">{l.qty} {l.uom}</td>
                      <td className="py-2 text-right tabular-nums text-xs">{fmtAmt(l.rate)}</td>
                      <td className="py-2 text-right tabular-nums text-xs font-semibold">{fmtAmt(l.amount)}</td>
                      <td className="py-2 pl-2">
                        <Badge variant={rm.variant} className="text-[10px]">{rm.label}</Badge>
                      </td>
                      <td className="py-2 text-[11px] text-muted-foreground font-mono">{l.grnRef}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* GST Summary */}
        <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxable Amount</span>
            <span className="tabular-nums font-medium">{fmtAmt(rtv.totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">GST @ 18%</span>
            <span className="tabular-nums">{fmtAmt(rtv.gstAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total with GST</span>
            <span className="tabular-nums text-primary">{fmtAmt(rtv.totalWithGst)}</span>
          </div>
        </div>

        {/* Debit note / credit note section */}
        {rtv.debitNoteRef && (
          <div className="rounded-lg border border-success/30 bg-success/5 px-4 py-3 text-sm space-y-1">
            <p className="flex items-center gap-1.5 font-medium text-success">
              <FileCheck2 className="size-4" /> Debit Note / Credit Note Received
            </p>
            <dl className="grid grid-cols-3 gap-2 mt-2 text-xs">
              <div>
                <p className="text-muted-foreground">Ref</p>
                <p className="font-mono font-medium">{rtv.debitNoteRef}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Date</p>
                <p className="font-medium">{rtv.debitNoteDate}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Amount</p>
                <p className="font-medium tabular-nums">{fmtAmt(rtv.debitNoteAmount)}</p>
              </div>
            </dl>
          </div>
        )}

        {/* Dispatch inline form */}
        {showDispatch && (
          <div className="rounded-lg border bg-muted/10 p-4 space-y-3">
            <p className="text-sm font-medium">Mark as Dispatched</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Dispatch Date</Label>
                <Input type="date" value={dispatchDate} onChange={(e) => setDispatchDate(e.target.value)} className="h-8 text-xs" />
              </div>
              <div className="space-y-1">
                <Label>Vehicle No.</Label>
                <Input
                  value={vehicleNo}
                  onChange={(e) => setVehicleNo(e.target.value)}
                  placeholder="MH-01-AB-1234"
                  className="h-8 text-xs"
                />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={() => setShowDispatch(false)}>Cancel</Button>
              <Button size="sm" onClick={markDispatched} disabled={!vehicleNo.trim()}>
                <Truck className="size-3.5" /> Confirm Dispatch
              </Button>
            </div>
          </div>
        )}

        {/* Status action buttons */}
        <div className="flex flex-wrap gap-2 border-t pt-4">
          {rtv.status === "draft" && (
            <Button size="sm" onClick={approve}>
              <CheckCircle2 className="size-3.5" /> Approve
            </Button>
          )}
          {rtv.status === "approved" && !showDispatch && (
            <Button size="sm" onClick={() => setShowDispatch(true)}>
              <Truck className="size-3.5" /> Mark Dispatched
            </Button>
          )}
          {rtv.status === "dispatched" && (
            <Button size="sm" onClick={onMarkCreditNote}>
              <ReceiptText className="size-3.5" /> Mark Credit Note Received
            </Button>
          )}
          {rtv.status === "credit-note-received" && (
            <Button size="sm" onClick={markAdjusted}>
              <FileCheck2 className="size-3.5" /> Mark Adjusted
            </Button>
          )}
        </div>
      </div>
    </Drawer>
  );
}

// ── Credit Note Modal ────────────────────────────────────────────────────────

function CreditNoteModal({
  rtv, suggestedRef, onClose, onConfirm,
}: {
  rtv: ReturnToVendor;
  suggestedRef: string;
  onClose: () => void;
  onConfirm: (dnRef: string, dnDate: string, dnAmount: number) => void;
}) {
  const [dnRef, setDnRef]       = React.useState(suggestedRef);
  const [dnDate, setDnDate]     = React.useState(TODAY);
  const [dnAmount, setDnAmount] = React.useState(String(rtv.totalWithGst));

  return (
    <Modal
      open
      onClose={onClose}
      title="Mark Credit Note Received"
      description={`RTV ${rtv.ref} · ${vendorName(rtv.vendorId)}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={() => onConfirm(dnRef.trim(), dnDate, Number(dnAmount))}
            disabled={!dnRef.trim() || !dnDate || !dnAmount}
          >
            <ReceiptText className="size-3.5" /> Confirm
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-md border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
          Expected credit: <span className="font-semibold text-foreground">{fmtAmt(rtv.totalWithGst)}</span>
          {" "}(₹{rtv.totalAmount.toLocaleString("en-IN")} + GST ₹{rtv.gstAmount.toLocaleString("en-IN")})
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1">
            <Label>Debit Note / Credit Note Ref</Label>
            <Input value={dnRef} onChange={(e) => setDnRef(e.target.value)} className="h-8 text-xs font-mono" />
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" value={dnDate} onChange={(e) => setDnDate(e.target.value)} className="h-8 text-xs" />
          </div>
          <div className="space-y-1">
            <Label>Amount (₹)</Label>
            <Input
              type="number"
              value={dnAmount}
              onChange={(e) => setDnAmount(e.target.value)}
              className="h-8 text-xs"
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ── Create RTV Drawer ────────────────────────────────────────────────────────

const EMPTY_LINE = (): RTVLine => ({
  itemName: "", hsn: "", qty: 1, uom: "KG", rate: 0, amount: 0,
  grnRef: "", reason: "quality-rejection",
});

function CreateRTVDrawer({
  nextRef: ref,
  onClose,
  onCreate,
}: {
  nextRef: string;
  onClose: () => void;
  onCreate: (rtv: ReturnToVendor) => void;
}) {
  const [vendorId, setVendorId]   = React.useState(INVENTORY_VENDORS[0]?.id ?? "");
  const [poRef, setPoRef]         = React.useState("");
  const [locationId, setLocId]    = React.useState(LOCATIONS[0]?.id ?? "");
  const [date, setDate]           = React.useState(TODAY);
  const [vehicleNo, setVehicleNo] = React.useState("");
  const [remarks, setRemarks]     = React.useState("");
  const [lines, setLines]         = React.useState<RTVLine[]>([EMPTY_LINE()]);

  function setLine(i: number, patch: Partial<RTVLine>) {
    setLines((prev) =>
      prev.map((l, idx) => {
        if (idx !== i) return l;
        const updated = { ...l, ...patch };
        updated.amount = Math.round(updated.qty * updated.rate);
        return updated;
      })
    );
  }

  function addLine() { setLines((p) => [...p, EMPTY_LINE()]); }
  function removeLine(i: number) { setLines((p) => p.filter((_, idx) => idx !== i)); }

  const { totalAmount, gstAmount, totalWithGst } = computeAmounts(lines);
  const canSubmit = vendorId && poRef.trim() && lines.every((l) => l.itemName.trim() && l.qty > 0 && l.rate > 0);

  function handleCreate() {
    const rtv: ReturnToVendor = {
      id: `rtv-${Date.now()}`,
      ref,
      date,
      vendorId,
      poRef: poRef.trim(),
      locationId,
      lines,
      totalAmount,
      gstAmount,
      totalWithGst,
      status: "draft",
      debitNoteRef: null,
      debitNoteDate: null,
      debitNoteAmount: 0,
      dispatchDate: null,
      vehicleNo: vehicleNo.trim(),
      remarks: remarks.trim(),
      approvedBy: null,
      approvedAt: null,
    };
    onCreate(rtv);
  }

  return (
    <Drawer
      open
      onClose={onClose}
      width="max-w-2xl"
      title={<span className="flex items-center gap-1.5"><Plus className="size-4" />New Return to Vendor</span>}
      subtitle={ref}
    >
      <div className="space-y-5 pb-6">
        {/* Header fields */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Vendor *</Label>
            <Select value={vendorId} onChange={(e) => setVendorId(e.target.value)}>
              {INVENTORY_VENDORS.map((v) => (
                <option key={v.id} value={v.id}>{v.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>PO Reference *</Label>
            <Input value={poRef} onChange={(e) => setPoRef(e.target.value)} placeholder="PO-2007" className="h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <Label>Location *</Label>
            <Select value={locationId} onChange={(e) => setLocId(e.target.value)}>
              {LOCATIONS.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 text-sm" />
          </div>
          <div className="space-y-1">
            <Label>Vehicle No.</Label>
            <Input value={vehicleNo} onChange={(e) => setVehicleNo(e.target.value)} placeholder="KA-01-AB-1234" className="h-9 text-sm font-mono" />
          </div>
          <div className="space-y-1">
            <Label>Remarks</Label>
            <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Optional notes" className="h-9 text-sm" />
          </div>
        </div>

        {/* Line items */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Line Items</p>
            <Button variant="outline" size="sm" onClick={addLine}>
              <Plus className="size-3.5" /> Add Line
            </Button>
          </div>
          <div className="space-y-3">
            {lines.map((l, i) => (
              <div key={i} className="rounded-lg border p-3 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <Label>Item Name *</Label>
                    <Input value={l.itemName} onChange={(e) => setLine(i, { itemName: e.target.value })} placeholder="Wheat Flour (50 kg)" className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label>HSN</Label>
                    <Input value={l.hsn} onChange={(e) => setLine(i, { hsn: e.target.value })} placeholder="1101" className="h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1">
                    <Label>Qty *</Label>
                    <Input type="number" min={1} value={l.qty} onChange={(e) => setLine(i, { qty: Number(e.target.value) })} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label>UoM</Label>
                    <Select value={l.uom} onChange={(e) => setLine(i, { uom: e.target.value })}>
                      {UOM_OPTIONS.map((u) => <option key={u}>{u}</option>)}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>Rate (₹) *</Label>
                    <Input type="number" min={0} value={l.rate || ""} onChange={(e) => setLine(i, { rate: Number(e.target.value) })} className="h-8 text-xs" />
                  </div>
                  <div className="space-y-1">
                    <Label>Reason *</Label>
                    <Select value={l.reason} onChange={(e) => setLine(i, { reason: e.target.value as RTVReason })}>
                      {REASON_OPTIONS.map((r) => (
                        <option key={r} value={r}>{RTV_REASON_META[r].label}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label>GRN Ref</Label>
                    <Input value={l.grnRef} onChange={(e) => setLine(i, { grnRef: e.target.value })} placeholder="GRN-0001" className="h-8 text-xs font-mono" />
                  </div>
                  <div className="space-y-1 flex items-end">
                    <p className="text-xs text-muted-foreground">
                      Amount: <span className="font-semibold text-foreground">{fmtAmt(l.amount)}</span>
                    </p>
                  </div>
                </div>
                {lines.length > 1 && (
                  <div className="flex justify-end">
                    <button onClick={() => removeLine(i)} className="text-[11px] text-danger hover:underline">
                      Remove line
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* GST summary */}
        <div className="rounded-lg border bg-muted/20 px-4 py-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Taxable Amount</span>
            <span className="tabular-nums">{fmtAmt(totalAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">GST @ 18%</span>
            <span className="tabular-nums">{fmtAmt(gstAmount)}</span>
          </div>
          <div className="flex justify-between border-t pt-1 font-semibold">
            <span>Total with GST</span>
            <span className="tabular-nums text-primary">{fmtAmt(totalWithGst)}</span>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!canSubmit}>
            <RotateCcw className="size-3.5" /> Create RTV
          </Button>
        </div>
      </div>
    </Drawer>
  );
}
