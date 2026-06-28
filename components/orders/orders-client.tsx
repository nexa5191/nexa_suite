"use client";

import * as React from "react";
import Link from "next/link";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { Search, Plug, ArrowRight, Package, ChevronDown, Check } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Money } from "@/components/ui/money";
import { useReport } from "@/components/reports/use-report";
import { ReportControls } from "@/components/reports/report-controls";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { itemById } from "@/lib/inventory/items";
import { CONNECTORS, connectorById } from "@/lib/connections";
import { formatCompact } from "@/lib/currency";
import { cn, monthLabel } from "@/lib/utils";
import {
  ORDERS, CHANNELS, STATUS_META, FUNNEL_ORDER,
  orderKpis, monthlyOrders, byChannel, statusCounts, topSkus,
  type OrderStatus,
} from "@/lib/orders";

const OMS_IDS = CONNECTORS.filter((c) => c.category === "OMS").map((c) => c.id);
const PAGE = 100;

/** Checkbox dropdown for filtering on several values at once (empty = all). */
function MultiSelect({
  label,
  options,
  selected,
  onChange,
  width = "w-44",
}: {
  label: string;
  options: { value: string; label: string }[];
  selected: string[];
  onChange: (next: string[]) => void;
  width?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const summary =
    selected.length === 0
      ? `All ${label}`
      : selected.length === 1
        ? options.find((o) => o.value === selected[0])?.label ?? `1 ${label}`
        : `${selected.length} ${label}`;

  return (
    <div ref={ref} className={cn("relative", width)}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex h-9 w-full items-center gap-2 rounded-md border bg-card px-3 text-sm shadow-sm transition-colors",
          open ? "border-primary" : "hover:bg-accent/50",
        )}
      >
        <span className="min-w-0 flex-1 truncate text-left">{summary}</span>
        {selected.length > 0 && (
          <span className="rounded bg-primary/10 px-1.5 text-[11px] font-medium tabular text-primary">{selected.length}</span>
        )}
        <ChevronDown className={cn("size-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 w-56 max-w-[calc(100vw-1rem)] overflow-hidden rounded-lg border bg-popover shadow-xl">
          <div className="flex items-center justify-between border-b px-2.5 py-1.5 text-xs">
            <span className="font-medium capitalize text-muted-foreground">{label}</span>
            <button
              onClick={() => onChange([])}
              disabled={selected.length === 0}
              className="text-primary hover:underline disabled:opacity-40"
            >
              Clear
            </button>
          </div>
          <div className="max-h-64 overflow-y-auto py-1">
            {options.map((o) => {
              const on = selected.includes(o.value);
              return (
                <button
                  key={o.value}
                  onClick={() => toggle(o.value)}
                  className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-accent"
                >
                  <span
                    className={cn(
                      "grid size-4 shrink-0 place-items-center rounded border",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {on && <Check className="size-3" />}
                  </span>
                  <span className="truncate">{o.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function loadConnectedOms(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem("nexa-connections");
    if (!raw) return [];
    return Object.keys(JSON.parse(raw)).filter((id) => OMS_IDS.includes(id));
  } catch {
    return [];
  }
}

export function OrdersClient() {
  const ctl = useReport();
  const { currency } = usePrefs();
  const [connectedOms, setConnectedOms] = React.useState<string[]>([]);
  // Multi-select filters — empty array means "all".
  const [channelSel, setChannelSel] = React.useState<string[]>([]);
  const [statusSel, setStatusSel] = React.useState<string[]>([]);
  const [q, setQ] = React.useState("");
  const [limit, setLimit] = React.useState(PAGE);

  React.useEffect(() => setConnectedOms(loadConnectedOms()), []);

  const { from, to } = ctl.filters;
  const term = q.trim().toLowerCase();
  const orders = React.useMemo(
    () =>
      ORDERS.filter((o) => {
        if (from && o.date < from) return false;
        if (to && o.date > to) return false;
        if (channelSel.length && !channelSel.includes(o.channel)) return false;
        if (statusSel.length && !statusSel.includes(o.status)) return false;
        if (term && !`${o.orderNo} ${o.customer} ${itemById(o.itemId)?.name ?? ""}`.toLowerCase().includes(term)) return false;
        return true;
      }),
    [from, to, channelSel, statusSel, term],
  );

  const k = orderKpis(orders);
  const trend = monthlyOrders(orders).map((m) => ({ ...m, label: monthLabel(`${m.month}-01`) }));
  const channels = byChannel(orders);
  const counts = statusCounts(orders);
  const skus = topSkus(orders);
  const funnelMax = Math.max(counts.new, 1);
  const rows = orders.slice().sort((a, b) => (a.date < b.date ? 1 : -1));
  const shown = rows.slice(0, limit);

  const fmtAxis = (n: number) => formatCompact(n, currency);

  return (
    <>
      <PageHeader
        title="Orders"
        subtitle="Sales-order analytics from your connected OMS — demand, channels, fulfilment and returns."
        actions={
          <Link href="/connections">
            <Badge variant="primary" className="h-7 px-3"><Plug className="size-3.5" /> Manage sources</Badge>
          </Link>
        }
      />

      {/* Source provenance */}
      <Card className="mb-4 flex flex-wrap items-center gap-2 p-3 text-sm">
        <span className="text-muted-foreground">Synced from:</span>
        {connectedOms.length > 0 ? (
          connectedOms.map((id) => (
            <Badge key={id} variant="success">{connectorById(id)?.name}</Badge>
          ))
        ) : (
          <span className="flex items-center gap-1 text-muted-foreground">
            No OMS connected — showing the warehouse sample.
            <Link href="/connections" className="inline-flex items-center gap-0.5 text-primary hover:underline">
              Connect one <ArrowRight className="size-3" />
            </Link>
          </span>
        )}
      </Card>

      <ReportControls ctl={ctl} />

      {/* KPIs */}
      <div className="mb-4 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="GMV" money={k.gmv} />
        <Stat label="Orders" value={k.count.toLocaleString("en-IN")} />
        <Stat label="Units" value={k.units.toLocaleString("en-IN")} />
        <Stat label="Avg order value" money={k.aov} />
        <Stat label="Delivered" value={pct(k.deliveredPct)} />
        <Stat label="Return rate" value={pct(k.returnRate)} tone={k.returnRate > 0.05 ? "danger" : undefined} />
      </div>

      {/* Charts */}
      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        <Card className="p-4 lg:col-span-2">
          <p className="mb-2 text-sm font-semibold">GMV & order trend</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ left: 4, right: 8, top: 4 }}>
                <defs>
                  <linearGradient id="oGmv" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} width={56} />
                <Tooltip
                  formatter={(v, n) => { const num = v as number; return n === "gmv" ? formatCompact(num, currency) : num; }}
                  contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))" }}
                />
                <Area type="monotone" dataKey="gmv" name="GMV" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#oGmv)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-2 text-sm font-semibold">Orders by channel</p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={channels} layout="vertical" margin={{ left: 8, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                <YAxis type="category" dataKey="channel" tick={{ fontSize: 11 }} width={92} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))" }} />
                <Bar dataKey="orders" name="Orders" radius={[0, 4, 4, 0]}>
                  {channels.map((_, i) => (
                    <Cell key={i} fill={`hsl(var(--chart-${(i % 5) + 1}))`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Funnel + top SKUs */}
      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Fulfilment funnel</p>
          <div className="space-y-2">
            {FUNNEL_ORDER.map((s) => {
              const c = counts[s];
              return (
                <div key={s} className="flex items-center gap-3">
                  <span className="w-20 text-xs text-muted-foreground">{STATUS_META[s].label}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-md bg-muted">
                    <div
                      className="flex h-full items-center justify-end rounded-md bg-primary/70 px-2 text-[11px] font-medium text-primary-foreground"
                      style={{ width: `${Math.max((c / funnelMax) * 100, 4)}%` }}
                    >
                      {c}
                    </div>
                  </div>
                </div>
              );
            })}
            <div className="flex gap-4 pt-1 text-xs text-muted-foreground">
              <span>Cancelled <b className="text-danger">{counts.cancelled}</b></span>
              <span>Returned <b className="text-danger">{counts.returned}</b></span>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <p className="mb-3 text-sm font-semibold">Top SKUs by GMV</p>
          <div className="space-y-1.5">
            {skus.map((s, i) => {
              const max = Math.max(...skus.map((x) => x.gmv), 1);
              return (
                <div key={s.itemId}>
                  <div className="mb-0.5 flex items-center justify-between text-sm">
                    <span className="flex items-center gap-1.5 font-medium"><Package className="size-3.5 text-muted-foreground" />{s.name}</span>
                    <span className="tabular text-muted-foreground"><Money value={s.gmv} compact /> · {s.units.toLocaleString("en-IN")}u</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${(s.gmv / max) * 100}%`, background: `hsl(var(--chart-${(i % 5) + 1}))` }} />
                  </div>
                </div>
              );
            })}
            {skus.length === 0 && <p className="text-sm text-muted-foreground">No orders in range.</p>}
          </div>
        </Card>
      </div>

      {/* Filters + table */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <MultiSelect
          label="channels"
          width="w-44"
          options={CHANNELS.map((c) => ({ value: c.name, label: c.name }))}
          selected={channelSel}
          onChange={setChannelSel}
        />
        <MultiSelect
          label="statuses"
          width="w-44"
          options={(Object.keys(STATUS_META) as OrderStatus[]).map((s) => ({ value: s, label: STATUS_META[s].label }))}
          selected={statusSel}
          onChange={setStatusSel}
        />
        {(channelSel.length > 0 || statusSel.length > 0) && (
          <button
            onClick={() => {
              setChannelSel([]);
              setStatusSel([]);
            }}
            className="text-xs font-medium text-primary hover:underline"
          >
            Reset
          </button>
        )}
        <div className="relative w-full sm:w-56">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search order / customer / SKU…" className="pl-8" />
        </div>
        <span className="ml-auto text-xs text-muted-foreground">{rows.length.toLocaleString("en-IN")} orders</span>
      </div>

      <div className="max-h-[70vh] overflow-auto rounded-lg border bg-card shadow-sm">
        <table className="w-full text-sm">
          <thead className="sticky top-0 z-10">
            <tr className="border-b bg-muted text-left text-xs text-muted-foreground">
              <th className="px-4 py-2.5 font-medium">Order</th>
              <th className="px-4 py-2.5 font-medium">Date</th>
              <th className="px-4 py-2.5 font-medium">Channel / Source</th>
              <th className="px-4 py-2.5 font-medium">Customer</th>
              <th className="px-4 py-2.5 font-medium">Item</th>
              <th className="px-4 py-2.5 text-right font-medium">Qty</th>
              <th className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th className="px-4 py-2.5 font-medium">Pay</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((o) => (
              <tr key={o.id} className="border-b border-border/40 last:border-0 hover:bg-accent/30">
                <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs">{o.orderNo}</td>
                <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">{o.date}</td>
                <td className="px-4 py-2.5">
                  <span className="block">{o.channel}</span>
                  <span className="text-[11px] text-muted-foreground">{connectorById(o.source)?.name}</span>
                </td>
                <td className="px-4 py-2.5">{o.customer}</td>
                <td className="px-4 py-2.5">{itemById(o.itemId)?.name}</td>
                <td className="px-4 py-2.5 text-right tabular">{o.qty}</td>
                <td className="px-4 py-2.5 text-right tabular"><Money value={o.amount} /></td>
                <td className="px-4 py-2.5"><span className="text-xs text-muted-foreground">{o.payment}</span></td>
                <td className="px-4 py-2.5"><Badge variant={STATUS_META[o.status].variant}>{STATUS_META[o.status].label}</Badge></td>
              </tr>
            ))}
            {shown.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-muted-foreground">No orders match these filters.</td></tr>
            )}
          </tbody>
        </table>
        {rows.length > limit && (
          <div className="border-t p-3 text-center">
            <button onClick={() => setLimit((l) => l + PAGE)} className="text-sm font-medium text-primary hover:underline">
              Show more ({(rows.length - limit).toLocaleString("en-IN")} remaining)
            </button>
          </div>
        )}
      </div>
    </>
  );
}

const pct = (n: number) => `${(n * 100).toFixed(1)}%`;

function Stat({ label, value, money, tone }: { label: string; value?: string; money?: number; tone?: "danger" }) {
  return (
    <Card className="p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-0.5 text-lg font-bold tabular", tone === "danger" && "text-danger")}>
        {money !== undefined ? <Money value={money} compact /> : value}
      </p>
    </Card>
  );
}
