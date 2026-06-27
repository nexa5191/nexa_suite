import type { BusinessEvent } from "./types";

export const BUSINESS_EVENTS: BusinessEvent[] = [];

// GST applies to domestic India flows only.
export function gstRateFor(ev: BusinessEvent): number {
  if (ev.kind === "transfer") return 0;
  if (ev.incomeOrExpenseAccount === "4030") return 0; // exports zero-rated
  if (ev.entityId === "ent-nexa-global") return 0;
  return 0.18;
}
