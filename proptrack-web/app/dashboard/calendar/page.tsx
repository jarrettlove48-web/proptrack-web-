"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { MaintenanceRequest } from "@/lib/types";
import { CATEGORY_LABELS, STATUS_LABELS } from "@/lib/types";
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink } from "lucide-react";

interface CalendarEvent {
  id: string;
  date: string;
  type: "created" | "requested" | "service";
  request: MaintenanceRequest;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function formatDate(y: number, m: number, d: number) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function toDateStr(iso: string) {
  return iso.slice(0, 10);
}

function googleCalendarUrl(event: CalendarEvent) {
  const date = event.date.replace(/-/g, "");
  const title = encodeURIComponent(`${CATEGORY_LABELS[event.request.category]} — ${event.request.property_name}`);
  const details = encodeURIComponent(event.request.description);
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}/${date}&details=${details}`;
}

const EVENT_COLORS: Record<CalendarEvent["type"], string> = {
  created: "bg-info",
  requested: "bg-warning",
  service: "bg-success",
};

const EVENT_LABELS: Record<CalendarEvent["type"], string> = {
  created: "Created",
  requested: "Requested",
  service: "Service",
};

export default function CalendarPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDate(today.getFullYear(), today.getMonth(), today.getDate()));

  const fetchRequests = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    setRequests((data || []) as MaintenanceRequest[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  // Build events map: date string → CalendarEvent[]
  const eventsMap = useMemo(() => {
    const map: Record<string, CalendarEvent[]> = {};
    function push(date: string, type: CalendarEvent["type"], request: MaintenanceRequest) {
      if (!map[date]) map[date] = [];
      map[date].push({ id: `${request.id}-${type}`, date, type, request });
    }
    for (const req of requests) {
      push(toDateStr(req.created_at), "created", req);
      if (req.requested_date) push(toDateStr(req.requested_date), "requested", req);
      if (req.service_date) push(toDateStr(req.service_date), "service", req);
    }
    return map;
  }, [requests]);

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  const todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

  function prevMonth() {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else setMonth(month + 1);
  }

  const selectedEvents = selectedDate ? (eventsMap[selectedDate] || []) : [];

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-3 border-brand/20 border-t-brand rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal" style={{ fontFamily: "var(--font-display)" }}>Calendar</h1>
        <p className="text-sm text-charcoal-secondary mt-1">Maintenance dates at a glance</p>
      </div>

      {/* Month navigation */}
      <div className="bg-surface rounded-2xl border border-warm-300/50 p-5 mb-4">
        <div className="flex items-center justify-between mb-4">
          <button onClick={prevMonth} className="p-2 rounded-xl hover:bg-warm-100 transition-colors text-charcoal-secondary">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-bold text-charcoal">{MONTHS[month]} {year}</h2>
          <button onClick={nextMonth} className="p-2 rounded-xl hover:bg-warm-100 transition-colors text-charcoal-secondary">
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1 mb-1">
          {WEEKDAYS.map((d) => (
            <div key={d} className="text-center text-xs font-semibold text-charcoal-tertiary py-2">{d}</div>
          ))}
        </div>

        {/* Day cells */}
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for offset */}
          {Array.from({ length: firstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="aspect-square" />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1;
            const dateStr = formatDate(year, month, day);
            const dayEvents = eventsMap[dateStr] || [];
            const isToday = dateStr === todayStr;
            const isSelected = dateStr === selectedDate;
            const hasEvents = dayEvents.length > 0;

            return (
              <button
                key={day}
                onClick={() => setSelectedDate(dateStr)}
                className={`aspect-square rounded-xl flex flex-col items-center justify-center gap-0.5 text-sm transition-colors relative ${
                  isSelected
                    ? "bg-brand text-white font-bold"
                    : isToday
                      ? "bg-brand-faint text-brand-dark font-semibold"
                      : hasEvents
                        ? "hover:bg-warm-100 text-charcoal font-medium"
                        : "hover:bg-warm-100 text-charcoal-secondary"
                }`}
              >
                {day}
                {hasEvents && (
                  <div className="flex gap-0.5">
                    {/* Show up to 3 dots for event types present */}
                    {Array.from(new Set(dayEvents.map((e) => e.type))).slice(0, 3).map((type) => (
                      <span key={type} className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/70" : EVENT_COLORS[type]}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 pt-3 border-t border-warm-300/40">
          {(["created", "requested", "service"] as const).map((type) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${EVENT_COLORS[type]}`} />
              <span className="text-xs text-charcoal-tertiary">{EVENT_LABELS[type]}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected day events */}
      {selectedDate && (
        <div>
          <h3 className="text-sm font-semibold text-charcoal mb-3">
            {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
          </h3>
          {selectedEvents.length === 0 ? (
            <div className="bg-surface rounded-2xl border border-warm-300/50 p-6 text-center">
              <CalendarDays className="w-7 h-7 text-charcoal-tertiary mx-auto mb-2" strokeWidth={1.5} />
              <p className="text-sm text-charcoal-secondary">No events on this day</p>
            </div>
          ) : (
            <div className="space-y-2">
              {selectedEvents.map((ev) => (
                <div key={ev.id} className="bg-surface rounded-2xl border border-warm-300/50 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md cat-${ev.request.category}`}>
                          {CATEGORY_LABELS[ev.request.category]}
                        </span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md status-${ev.request.status}`}>
                          {STATUS_LABELS[ev.request.status]}
                        </span>
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${
                          ev.type === "created" ? "bg-info-light text-info" :
                          ev.type === "requested" ? "bg-warning-light text-warning" :
                          "bg-success-light text-success"
                        }`}>
                          {EVENT_LABELS[ev.type]}
                        </span>
                      </div>
                      <p className="text-sm font-medium text-charcoal truncate">{ev.request.description}</p>
                      <p className="text-xs text-charcoal-tertiary mt-1">
                        {ev.request.property_name} · {ev.request.unit_label}
                        {ev.request.tenant_name ? ` · ${ev.request.tenant_name}` : ""}
                      </p>
                    </div>
                    <a
                      href={googleCalendarUrl(ev)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark transition-colors shrink-0"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Google Cal
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
