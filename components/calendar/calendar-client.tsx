"use client";

import * as React from "react";
import {
  ChevronLeft, ChevronRight, X, MapPin, Users, Paperclip, Plug, Check, Cloud, HardDrive, CalendarDays,
} from "lucide-react";
import { PageHeader } from "@/components/shell/page-header";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { employeeName } from "@/lib/hr/employees";
import {
  CALENDARS, CAL_EVENTS, TODAY, calendarById, eventSpan, formatEventTime,
  type CalEvent,
} from "@/lib/calendar";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function monthMatrix(year: number, month: number): string[][] {
  const first = new Date(Date.UTC(year, month, 1));
  const startDay = first.getUTCDay();
  const start = new Date(first);
  start.setUTCDate(1 - startDay);
  const weeks: string[][] = [];
  for (let w = 0; w < 6; w++) {
    const row: string[] = [];
    for (let d = 0; d < 7; d++) {
      row.push(start.toISOString().slice(0, 10));
      start.setUTCDate(start.getUTCDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

export function CalendarClient() {
  // current view = June 2026 (the demo "today" month)
  const [year, setYear] = React.useState(2026);
  const [month, setMonth] = React.useState(5); // 0-based → June
  const [visible, setVisible] = React.useState<Set<string>>(new Set(CALENDARS.map((c) => c.id)));
  const [selected, setSelected] = React.useState<CalEvent | null>(null);

  // index events by date key for visible calendars
  const byDay = React.useMemo(() => {
    const map = new Map<string, CalEvent[]>();
    for (const ev of CAL_EVENTS) {
      if (!visible.has(ev.calendarId)) continue;
      for (const key of eventSpan(ev)) {
        const arr = map.get(key) ?? [];
        arr.push(ev);
        map.set(key, arr);
      }
    }
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.allDay === b.allDay ? a.start.localeCompare(b.start) : a.allDay ? -1 : 1));
    }
    return map;
  }, [visible]);

  const weeks = monthMatrix(year, month);
  const monthLabel = new Date(Date.UTC(year, month, 1)).toLocaleDateString("en-IN", { month: "long", year: "numeric" });

  function shift(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  }
  function toggle(id: string) {
    setVisible((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  return (
    <>
      <PageHeader
        title="Calendar"
        subtitle="Your connected calendar plus shared team, holiday and leave calendars."
        actions={
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => shift(-1)}><ChevronLeft className="size-4" /></Button>
            <Button variant="outline" size="sm" onClick={() => { setYear(2026); setMonth(5); }}>Today</Button>
            <Button variant="outline" size="icon" onClick={() => shift(1)}><ChevronRight className="size-4" /></Button>
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-[260px_1fr]">
        {/* Sidebar: calendars + connect */}
        <div className="space-y-4">
          <Card className="p-3">
            <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Calendars</p>
            <div className="space-y-0.5">
              {CALENDARS.map((c) => (
                <button
                  key={c.id}
                  onClick={() => toggle(c.id)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
                >
                  <span
                    className={cn("flex size-4 items-center justify-center rounded-[4px] border")}
                    style={{ borderColor: c.color, background: visible.has(c.id) ? c.color : "transparent" }}
                  >
                    {visible.has(c.id) && <Check className="size-3 text-white" />}
                  </span>
                  <span className={cn("flex-1 text-left", !visible.has(c.id) && "text-muted-foreground")}>{c.name}</span>
                  {c.provider === "google" && <span className="text-[10px] text-muted-foreground">Google</span>}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-3">
            <p className="px-1 pb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Connections</p>
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-md border p-2">
                <span className="flex size-7 items-center justify-center rounded-md text-white" style={{ background: "#1A73E8" }}>
                  <HardDrive className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">Google Calendar</p>
                  <p className="truncate text-[11px] text-muted-foreground">Connected</p>
                </div>
                <Check className="size-4 text-success" />
              </div>
              <div className="flex items-center gap-2 rounded-md border p-2">
                <span className="flex size-7 items-center justify-center rounded-md text-white" style={{ background: "#0078D4" }}>
                  <Cloud className="size-3.5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium">Outlook Calendar</p>
                  <p className="truncate text-[11px] text-muted-foreground">Not connected</p>
                </div>
                <Button size="sm" variant="outline" className="h-7"><Plug className="size-3" /> Connect</Button>
              </div>
            </div>
          </Card>
        </div>

        {/* Month grid */}
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <p className="text-sm font-semibold">{monthLabel}</p>
            <span className="flex items-center gap-1 text-xs text-muted-foreground"><CalendarDays className="size-3.5" /> Month</span>
          </div>
          <div className="grid grid-cols-7 border-b bg-muted/30 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {WEEKDAYS.map((d) => (<div key={d} className="py-2">{d}</div>))}
          </div>
          <div className="grid grid-cols-7">
            {weeks.flat().map((key) => {
              const inMonth = Number(key.slice(5, 7)) === month + 1;
              const isToday = key === TODAY;
              const events = byDay.get(key) ?? [];
              return (
                <div key={key} className={cn("min-h-[104px] border-b border-r p-1.5", !inMonth && "bg-muted/20")}>
                  <div className="mb-1 flex justify-end">
                    <span className={cn(
                      "flex size-6 items-center justify-center rounded-full text-xs",
                      isToday ? "bg-primary font-semibold text-primary-foreground" : inMonth ? "text-foreground" : "text-muted-foreground/50",
                    )}>
                      {Number(key.slice(8, 10))}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    {events.slice(0, 3).map((ev) => {
                      const cal = calendarById(ev.calendarId);
                      return (
                        <button
                          key={ev.id + key}
                          onClick={() => setSelected(ev)}
                          className="flex w-full items-center gap-1 truncate rounded px-1 py-0.5 text-left text-[11px] hover:opacity-80"
                          style={{ background: `${cal?.color}1a`, color: cal?.color }}
                          title={ev.title}
                        >
                          {!ev.allDay && <span className="size-1.5 shrink-0 rounded-full" style={{ background: cal?.color }} />}
                          <span className="truncate">{ev.title}</span>
                        </button>
                      );
                    })}
                    {events.length > 3 && <p className="px-1 text-[10px] text-muted-foreground">+{events.length - 3} more</p>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {selected && <EventDetail event={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

function EventDetail({ event, onClose }: { event: CalEvent; onClose: () => void }) {
  const cal = calendarById(event.calendarId);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <Card className="w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-2">
            <span className="mt-1 size-3 shrink-0 rounded-full" style={{ background: cal?.color }} />
            <div>
              <h3 className="font-semibold leading-tight">{event.title}</h3>
              <p className="text-xs text-muted-foreground">{formatEventTime(event)} · {cal?.name}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground"><X className="size-4" /></button>
        </div>

        <div className="mt-4 space-y-3 text-sm">
          {event.location && (
            <p className="flex items-center gap-2 text-muted-foreground"><MapPin className="size-4 shrink-0" /> {event.location}</p>
          )}
          {event.description && <p className="text-muted-foreground">{event.description}</p>}
          {event.attendeeIds && event.attendeeIds.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Users className="size-3.5" /> Attendees</p>
              <div className="flex flex-wrap gap-1">
                {event.attendeeIds.map((id) => (
                  <Badge key={id} variant="default">{employeeName(id)}</Badge>
                ))}
              </div>
            </div>
          )}
          {event.attachments && event.attachments.length > 0 && (
            <div>
              <p className="mb-1 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Paperclip className="size-3.5" /> Attachments</p>
              <div className="space-y-1">
                {event.attachments.map((a) => (
                  <div key={a.name} className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs">
                    <Paperclip className="size-3.5 text-muted-foreground" />
                    <span className="flex-1 truncate">{a.name}</span>
                    <span className="uppercase text-muted-foreground">{a.kind}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
