"use client";

import * as React from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/input";
import { Drawer } from "@/components/ui/modal";
import { Collapsible } from "@/components/ui/collapsible";
import { cn, formatDate } from "@/lib/utils";
import { LOCATIONS, locationById, ALL } from "@/lib/accounting/org";
import { HOLIDAYS, type Holiday } from "@/lib/hr/holidays";
import { TODAY } from "@/lib/calendar";

function weekday(date: string) {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("en-IN", { weekday: "long" });
}

function monthKey(date: string) {
  return date.slice(0, 7); // YYYY-MM
}

function monthLabel(key: string) {
  return new Date(`${key}-01T00:00:00Z`).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

export function HolidaysClient() {
  const [location, setLocation] = React.useState(ALL);
  const [selected, setSelected] = React.useState<Holiday | null>(null);

  const rows = HOLIDAYS.filter((h) => location === ALL || h.locationIds.includes(location)).sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  const upcoming = HOLIDAYS.filter((h) => h.date >= TODAY).sort((a, b) => a.date.localeCompare(b.date))[0];

  // Group filtered rows into month sections, preserving date order.
  const months = React.useMemo(() => {
    const map = new Map<string, Holiday[]>();
    for (const h of rows) {
      const k = monthKey(h.date);
      const arr = map.get(k);
      if (arr) arr.push(h);
      else map.set(k, [h]);
    }
    return Array.from(map.entries());
  }, [rows]);

  // Default-open the nearest month that still has an upcoming holiday.
  const openMonth = upcoming ? monthKey(upcoming.date) : months[0]?.[0];

  return (
    <>
      <PageHeader
        title="Holidays"
        subtitle="Holiday calendar 2026 across all locations."
        actions={
          <Select value={location} onChange={(e) => setLocation(e.target.value)} className="h-9 w-52">
            <option value={ALL}>All locations</option>
            {LOCATIONS.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </Select>
        }
      />

      {upcoming && (
        <Card className="mb-4 flex items-center gap-3 border-primary/30 bg-primary/5 p-4">
          <CalendarDays className="size-5 text-primary" />
          <p className="text-sm">
            Next holiday: <span className="font-semibold">{upcoming.name}</span> on {formatDate(upcoming.date)} ({weekday(upcoming.date)})
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {months.map(([key, items]) => {
          const upcomingCount = items.filter((h) => h.date >= TODAY).length;
          return (
            <Card key={key} className="overflow-hidden">
              <Collapsible
                defaultOpen={key === openMonth}
                headerClassName="bg-muted/40 px-5 py-3 hover:bg-muted/60"
                header={
                  <span className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{monthLabel(key)}</span>
                    <span className="text-xs text-muted-foreground">
                      {items.length} holiday{items.length === 1 ? "" : "s"}
                      {upcomingCount > 0 && <span className="ml-2 text-primary">· {upcomingCount} upcoming</span>}
                    </span>
                  </span>
                }
              >
                <table className="w-full text-sm">
                  <tbody>
                    {items.map((h) => {
                      const past = h.date < TODAY;
                      return (
                        <tr
                          key={h.id}
                          onClick={() => setSelected(h)}
                          className={cn(
                            "cursor-pointer border-t transition-colors hover:bg-accent/50",
                            past && "opacity-50",
                          )}
                        >
                          <td className="w-28 px-5 py-3 font-medium">{formatDate(h.date)}</td>
                          <td className="w-28 px-5 py-3 text-muted-foreground">{weekday(h.date)}</td>
                          <td className="px-5 py-3">
                            {h.name}
                            {h.optional && <span className="ml-2 text-[11px] text-muted-foreground">(optional)</span>}
                          </td>
                          <td className="px-5 py-3">
                            <Badge variant={h.national ? "primary" : "warning"}>{h.national ? "National" : "Regional"}</Badge>
                          </td>
                          <td className="px-5 py-3">
                            {h.national ? (
                              <span className="text-xs text-muted-foreground">All locations</span>
                            ) : (
                              <div className="flex flex-wrap gap-1">
                                {h.locationIds.map((lid) => (
                                  <span key={lid} className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                                    {locationById(lid)?.name}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Collapsible>
            </Card>
          );
        })}
      </div>

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
