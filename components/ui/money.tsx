"use client";

import { usePrefs } from "@/components/prefs/prefs-provider";
import { formatMoney, formatCompact } from "@/lib/currency";
import { cn } from "@/lib/utils";

/** Renders a base-currency (INR) amount in the active display currency. */
export function Money({
  value,
  compact = false,
  colored = false,
  className,
  bracketNegatives = false,
}: {
  value: number;
  compact?: boolean;
  colored?: boolean;
  className?: string;
  bracketNegatives?: boolean;
}) {
  const { currency } = usePrefs();
  const formatted = compact ? formatCompact(value, currency) : formatMoney(value, currency);
  const display =
    bracketNegatives && value < 0
      ? `(${(compact ? formatCompact(-value, currency) : formatMoney(-value, currency))})`
      : formatted;
  return (
    <span
      className={cn(
        "tabular",
        colored && value < 0 && "text-danger",
        colored && value > 0 && "text-success",
        className,
      )}
    >
      {display}
    </span>
  );
}
