"use client";

import { useMemo, useState } from "react";
import { Search, ChevronRight } from "lucide-react";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { PageHeader } from "@/components/shell/page-header";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Money } from "@/components/ui/money";
import { loadChartOfAccounts, TYPE_ORDER } from "@/lib/accounting/chart-of-accounts";
import { cumulativeBalance } from "@/lib/accounting/ledger";
import type { AccountType, ReportFilters } from "@/lib/accounting/types";
import { cn } from "@/lib/utils";

const TYPE_LABEL: Record<AccountType, string> = {
  asset: "Assets",
  liability: "Liabilities",
  equity: "Equity",
  income: "Income",
  expense: "Expenses",
};

const TYPE_VARIANT: Record<AccountType, "primary" | "warning" | "success" | "default" | "danger"> = {
  asset: "primary",
  liability: "warning",
  equity: "success",
  income: "success",
  expense: "danger",
};

export function CoaClient() {
  const prefs = usePrefs();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const filters: ReportFilters = {
    entityId: prefs.entityId,
    locationId: prefs.locationId,
    state: prefs.state,
    basis: prefs.basis,
    from: "",
    to: "9999-12-31",
  };
  const balances = useMemo(() => cumulativeBalance(filters, "9999-12-31"), [
    prefs.entityId,
    prefs.locationId,
    prefs.state,
    prefs.basis,
  ]);

  const types = (Object.keys(TYPE_LABEL) as AccountType[]).sort(
    (a, b) => TYPE_ORDER[a] - TYPE_ORDER[b],
  );

  const term = q.trim().toLowerCase();
  const isOpen = (t: string) => open[t] ?? true;

  return (
    <>
      <PageHeader
        title="Chart of Accounts"
        subtitle={`${loadChartOfAccounts().length} accounts · live balances reflect the selected scope and basis`}
        actions={
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search code or name…"
              className="pl-8"
            />
          </div>
        }
      />

      <div className="space-y-3">
        {types.map((type) => {
          const accounts = loadChartOfAccounts().filter(
            (a) =>
              a.type === type &&
              (!term || a.name.toLowerCase().includes(term) || a.code.includes(term)),
          );
          if (accounts.length === 0) return null;
          const typeTotal = accounts.reduce((s, a) => {
            const b = balances.get(a.code) ?? 0;
            return s + (a.normal === "debit" ? b : -b);
          }, 0);

          return (
            <div key={type} className="overflow-hidden rounded-lg border bg-card shadow-sm">
              <button
                onClick={() => setOpen((o) => ({ ...o, [type]: !isOpen(type) }))}
                className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-accent/50"
              >
                <ChevronRight className={cn("size-4 text-muted-foreground transition-transform", isOpen(type) && "rotate-90")} />
                <Badge variant={TYPE_VARIANT[type]}>{TYPE_LABEL[type]}</Badge>
                <span className="text-xs text-muted-foreground">{accounts.length} accounts</span>
                <span className="ml-auto text-sm font-semibold tabular">
                  <Money value={typeTotal} compact />
                </span>
              </button>

              {isOpen(type) && (
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-xs text-muted-foreground">
                        <th className="px-4 py-2 font-medium">Code</th>
                        <th className="px-4 py-2 font-medium">Account</th>
                        <th className="px-4 py-2 font-medium">Group</th>
                        <th className="px-4 py-2 font-medium">Normal</th>
                        <th className="px-4 py-2 text-right font-medium">Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accounts.map((a) => {
                        const raw = balances.get(a.code) ?? 0;
                        const signed = a.normal === "debit" ? raw : -raw;
                        return (
                          <tr key={a.code} className="border-b border-border/40 last:border-0 hover:bg-accent/30">
                            <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{a.code}</td>
                            <td className="px-4 py-2.5 font-medium">{a.name}</td>
                            <td className="px-4 py-2.5 text-muted-foreground">{a.subtype}</td>
                            <td className="px-4 py-2.5">
                              <span className="text-xs capitalize text-muted-foreground">{a.normal}</span>
                            </td>
                            <td className="px-4 py-2.5 text-right tabular">
                              <Money value={signed} />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
