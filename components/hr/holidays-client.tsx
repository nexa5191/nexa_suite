"use client";

import * as React from "react";
import { CalendarDays, MapPin, Check } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Drawer } from "@/components/ui/modal";
import { cn, formatDate } from "@/lib/utils";
import { LOCATIONS, locationById, ALL } from "@/lib/accounting/org";
import { loadHolidays, type Holiday } from "@/lib/hr/holidays";
import { TODAY } from "@/lib/calendar";
import { usePrefs } from "@/components/prefs/prefs-provider";

function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long" });
}
function weekdayShort(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "short" });
}
function monthKey(date: string) {
  return date.slice(0, 7); // YYYY-MM
}
function monthLabel(key: string) {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function HolidaysClient() {
  const prefs = usePrefs();
  const [selected, setSelected] = React.useState<Holiday | null>(null);

  // The user's own location sits in the extreme-left column. When the scope is
  // "all locations", fall back to the first location so there's always a "home"
  // column to anchor on.
  const userLocId = prefs.locationId !== ALL ? prefs.locationId : LOCATIONS[0]?.id;

  // Column order: user's location first, the rest in their natural order.
  const columns = React.useMemo(() => {
    const mine = LOCATIONS.find((l) => l.id === userLocId);
    const rest = LOCATIONS.filter((l) => l.id !== userLocId);
    return mine ? [mine, ...rest] : LOCATIONS;
  }, [userLocId]);

  const rows = React.useMemo(
    () => [...loadHolidays()].sort((a, b) => a.date.localeCompare(b.date)),
    [],
  );
  const upcoming = rows.find((h) => h.date >= TODAY);

  const observes = (h: Holiday, locId: string) => h.national || h.locationIds.includes(locId);

  // Count this location's working-day holidays (for the column subhead).
  const countFor = (locId: string) => rows.filter((h) => observes(h, locId)).length;

  return (
    <>
      <PageHeader
        title="Holidays"
        subtitle="Holiday calendar 2026 — each location's observed days at a glance."
      />

      {upcoming && (
        <Card className="mb-4 flex items-center gap-3 border-primary/30 bg-primary/5 p-4">
          <CalendarDays className="size-5 text-primary" />
          <p className="text-sm">
            Next holiday: <span className="font-semibold">{upcoming.name}</span> on{" "}
            {formatDate(upcoming.date)} ({weekday(upcoming.date)})
            {!observes(upcoming, userLocId) && (
              <span className="ml-1 text-muted-foreground">
                — not observed at {locationById(userLocId)?.name}
              </span>
            )}
          </p>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr className="bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="sticky left-0 z-10 bg-muted/40 px-4 py-3 text-left font-medium">Holiday</th>
                {columns.map((l, i) => (
                  <th
                    key={l.id}
                    className={cn(
                      "min-w-[7.5rem] px-3 py-3 text-center font-medium",
                      i === 0 && "bg-primary/10 text-primary",
                    )}
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="normal-case">{l.name}</span>
                      {i === 0 ? (
                        <span className="rounded-full bg-primary/15 px-1.5 py-px text-[9px] font-semibold text-primary">
                          Your location
                        </span>
                      ) : (
                        <span className="text-[10px] normal-case opacity-70">{l.state}</span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((h, idx) => {
                const past = h.date < TODAY;
                const isNext = upcoming?.id === h.id;
                const newMonth = idx === 0 || monthKey(rows[idx - 1].date) !== monthKey(h.date);
                return (
                  <React.Fragment key={h.id}>
                    {newMonth && (
                      <tr>
                        <td
                          colSpan={columns.length + 1}
                          className="sticky left-0 bg-muted/20 px-4 py-1.5 text-xs font-semibold text-muted-foreground"
                        >
                          {monthLabel(monthKey(h.date))}
                        </td>
                      </tr>
                    )}
                    <tr
                      onClick={() => setSelected(h)}
                      className={cn(
                        "cursor-pointer transition-colors hover:bg-accent/50",
                        past && "opacity-45",
                        isNext && "bg-primary/5",
                      )}
                    >
                      <td className="sticky left-0 z-10 border-t bg-card px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-12 shrink-0 text-center">
                            <div className="text-xs text-muted-foreground">{weekdayShort(h.date)}</div>
                            <div className="font-semibold tabular">{h.date.slice(8, 10)}</div>
                          </div>
                          <div className="min-w-0">
                            <div className="truncate font-medium">
                              {h.name}
                              {h.optional && (
                                <span className="ml-1.5 text-[11px] text-muted-foreground">(optional)</span>
                              )}
                            </div>
                            <div className="text-[11px] text-muted-foreground">
                              {h.national ? "National" : "Regional"} · {formatDate(h.date)}
                            </div>
                          </div>
                        </div>
                      </td>
                      {columns.map((l, i) => (
                        <td
                          key={l.id}
                          className={cn(
                            "border-t px-3 py-2.5 text-center",
                            i === 0 && "bg-primary/5",
                          )}
                        >
                          {observes(h, l.id) ? (
                            <Check
                              className={cn("mx-auto size-4", i === 0 ? "text-primary" : "text-emerald-500")}
                            />
                          ) : (
                            <span className="text-muted-foreground/25">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-muted/30 text-xs text-muted-foreground">
                <td className="sticky left-0 z-10 bg-muted/30 px-4 py-2.5 font-medium">Total observed</td>
                {columns.map((l, i) => (
                  <td key={l.id} className={cn("px-3 py-2.5 text-center font-semibold", i === 0 && "text-primary")}>
                    {countFor(l.id)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      <Drawer
        open={selected !== null}
        onClose={() => setSelected(null)}
        title={selected?.name}
        subtitle={selected ? `${formatDate(selected.date)} · ${weekday(selected.date)}` : undefined}
        actions={
          selected && (
            <Badge variant={selected.national ? "primary" : "warning"}>
              {selected.national ? "National" : "Regional"}
            </Badge>
          )
        }
      >
        {selected && (
          <div className="space-y-5 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <Detail label="Date" value={formatDate(selected.date)} />
              <Detail label="Weekday" value={weekday(selected.date)} />
              <Detail label="Type" value={selected.national ? "National holiday" : "Regional holiday"} />
              <Detail label="Optional" value={selected.optional ? "Yes" : "No"} />
            </div>

            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">Observed by</p>
              {selected.national ? (
                <p className="text-muted-foreground">All locations across the group.</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {selected.locationIds.map((lid) => (
                    <span key={lid} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 text-xs">
                      <MapPin className="size-3 text-muted-foreground" />
                      {locationById(lid)?.name}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {selected.date >= TODAY ? (
              <p className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs text-primary">
                Upcoming holiday.
              </p>
            ) : (
              <p className="rounded-md border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                This holiday has already passed.
              </p>
            )}
          </div>
        )}
      </Drawer>
    </>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
