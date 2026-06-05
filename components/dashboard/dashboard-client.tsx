"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from "recharts";
import { useRouter } from "next/navigation";
import { useReport } from "@/components/reports/use-report";
import { ReportControls } from "@/components/reports/report-controls";
import { PageHeader } from "@/components/shell/page-header";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { KpiStrip } from "@/components/accounting/kpi-strip";
import { ApprovalsWidget } from "@/components/hr/approvals-widget";
import { Money } from "@/components/ui/money";
import { buildPnL, monthlyTrend, entityBreakdown, cashAndReceivables } from "@/lib/accounting/reports";
import { formatCompact } from "@/lib/currency";
import { cn, monthLabel } from "@/lib/utils";

export function DashboardClient() {
  const ctl = useReport();
  const router = useRouter();
  const { currency, setEntity } = usePrefs();
  const pnl = buildPnL(ctl.filters);
  const trend = monthlyTrend(ctl.filters);
  const entities = entityBreakdown(ctl.filters.basis, ctl.filters.from, ctl.filters.to);
  const wc = cashAndReceivables(ctl.filters);

  const fmtAxis = (n: number) => formatCompact(n, currency);
  const trendData = trend.map((t) => ({ ...t, label: monthLabel(`${t.month}-01`) }));

  return (
    <>
      <PageHeader
        title="Dashboard"
        subtitle="Financial overview across all entities — adjust scope, basis and currency from the top bar."
      />

      <KpiStrip
        items={[
          { label: "Revenue", value: pnl.totalRevenue, href: "/reports/profit-loss" },
          { label: "Net Profit", value: pnl.netProfit, sub: `${(pnl.netMargin * 100).toFixed(1)}% margin`, colored: true, href: "/reports/profit-loss" },
          { label: "Cash & Bank", value: wc.cash, href: "/reports/cash-flow" },
          { label: "Receivables", value: wc.receivables, href: "/reports/balance-sheet" },
        ]}
      />

      <ReportControls ctl={ctl} />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={trendData} margin={{ left: 4, right: 8, top: 4 }}>
                  <defs>
                    <linearGradient id="gRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gExp" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--chart-3))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} width={56} />
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                  <Area type="monotone" dataKey="revenue" name="Revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#gRev)" />
                  <Area type="monotone" dataKey="expense" name="Expenses" stroke="hsl(var(--chart-3))" strokeWidth={2} fill="url(#gExp)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Working Capital</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            <WcRow label="Cash & Bank" value={wc.cash} href="/reports/cash-flow" />
            <WcRow label="Receivables" value={wc.receivables} href="/reports/balance-sheet" />
            <WcRow label="Payables" value={wc.payables} href="/reports/balance-sheet" />
            <div className="mt-2 border-t pt-3">
              <WcRow label="Net (Cash + AR − AP)" value={wc.cash + wc.receivables - wc.payables} bold />
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Net Profit Trend</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-60">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData} margin={{ left: 4, right: 8, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} />
                  <YAxis tickFormatter={fmtAxis} tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" tickLine={false} width={56} />
                  <Tooltip content={<ChartTooltip currency={currency} />} />
                  <Bar dataKey="profit" name="Net Profit" radius={[4, 4, 0, 0]}>
                    {trendData.map((d, i) => (
                      <Cell key={i} fill={d.profit >= 0 ? "hsl(var(--chart-5))" : "hsl(var(--danger))"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Revenue by Entity</CardTitle>
            <CardDescription>Click an entity to scope the P&amp;L to it.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1 pt-1">
              {entities
                .slice()
                .sort((a, b) => b.revenue - a.revenue)
                .map((e, i) => {
                  const max = Math.max(...entities.map((x) => x.revenue), 1);
                  return (
                    <button
                      key={e.id}
                      onClick={() => {
                        setEntity(e.id);
                        router.push("/reports/profit-loss");
                      }}
                      className="group block w-full rounded-md p-2 text-left transition-colors hover:bg-accent/50"
                    >
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="flex items-center gap-1 font-medium">
                          {e.name}
                          <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />
                        </span>
                        <span className="tabular text-muted-foreground">
                          <Money value={e.revenue} compact />
                        </span>
                      </div>
                      <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(e.revenue / max) * 100}%`, background: `hsl(var(--chart-${(i % 5) + 1}))` }}
                        />
                      </div>
                    </button>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-4">
        <ApprovalsWidget />
      </div>
    </>
  );
}

function WcRow({ label, value, bold, href }: { label: string; value: number; bold?: boolean; href?: string }) {
  const inner = (
    <>
      <span className={cn("flex items-center gap-1", bold ? "font-semibold" : "text-muted-foreground")}>
        {label}
        {href && <ArrowRight className="size-3 opacity-0 transition-opacity group-hover:opacity-60" />}
      </span>
      <span className={bold ? "font-bold tabular" : "tabular"}>
        <Money value={value} />
      </span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className="group -mx-2 flex items-center justify-between rounded-md px-2 py-1 text-sm transition-colors hover:bg-accent/50">
        {inner}
      </Link>
    );
  }
  return <div className="flex items-center justify-between px-2 py-1 text-sm">{inner}</div>;
}

function ChartTooltip({ active, payload, label, currency }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover p-2.5 text-xs shadow-lg">
      <p className="mb-1 font-semibold">{label}</p>
      {payload.map((p: any) => (
        <p key={p.dataKey} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <span className="inline-block size-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="tabular font-medium">{formatCompact(p.value, currency)}</span>
        </p>
      ))}
    </div>
  );
}
