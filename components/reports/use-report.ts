"use client";

import { useEffect, useMemo, useState } from "react";
import { usePrefs } from "@/components/prefs/prefs-provider";
import { useJournal } from "@/components/accounting/journal-provider";
import { periodPresets, DEFAULT_PERIOD_ID, type Period } from "@/lib/accounting/periods";
import { ENTITIES, LOCATIONS, ALL } from "@/lib/accounting/org";
import type { ReportFilters } from "@/lib/accounting/types";
import { formatDate } from "@/lib/utils";

// Period selection is persisted (view preference) so moving between report pages
// — P&L → Balance Sheet → Cash Flow — never resets the chosen range.
const PERIOD_KEY = "nexa-report-period";

export function useReport() {
  const prefs = usePrefs();
  // Subscribing to the journal version makes every report re-render (and re-read
  // the merged ledger) the moment a manual entry is posted or reversed.
  const { version } = useJournal();
  const presets = useMemo(() => periodPresets(new Date()), []);
  const [periodId, setPeriodId] = useState(DEFAULT_PERIOD_ID);
  const [custom, setCustom] = useState<{ from: string; to: string } | null>(null);

  // Hydrate from localStorage after mount (SSR-safe, mirrors PrefsProvider).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(PERIOD_KEY);
      if (raw) {
        const v = JSON.parse(raw) as { periodId?: string; custom?: { from: string; to: string } | null };
        if (v.custom) setCustom(v.custom);
        else if (v.periodId) setPeriodId(v.periodId);
      }
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(PERIOD_KEY, JSON.stringify({ periodId, custom }));
    } catch {}
  }, [periodId, custom]);

  const period: Period =
    custom !== null
      ? { id: "custom", label: "Custom", from: custom.from, to: custom.to }
      : presets.find((p) => p.id === periodId) ?? presets[0];

  const filters: ReportFilters = {
    entityId: prefs.entityId,
    locationId: prefs.locationId,
    state: prefs.state,
    basis: prefs.basis,
    from: period.from,
    to: period.to,
  };

  const entityName =
    prefs.entityId === ALL ? "All entities" : ENTITIES.find((e) => e.id === prefs.entityId)?.name ?? "—";
  const locName =
    prefs.locationId === ALL ? null : LOCATIONS.find((l) => l.id === prefs.locationId)?.name ?? null;
  const stateName = prefs.state === ALL ? null : prefs.state;

  const scopeLabel = [entityName, locName, stateName].filter(Boolean).join(" · ");
  const basisLabel = `${prefs.basis === "accrual" ? "Accrual" : "Cash"} basis`;
  const periodLabel = `${formatDate(period.from)} – ${formatDate(period.to)}`;

  return {
    filters,
    version,
    presets,
    periodId,
    setPeriodId: (id: string) => {
      setCustom(null);
      setPeriodId(id);
    },
    custom,
    setCustom,
    period,
    scopeLabel,
    basisLabel,
    periodLabel,
    fullScopeLabel: `${scopeLabel} · ${basisLabel}`,
  };
}

export type ReportController = ReturnType<typeof useReport>;
