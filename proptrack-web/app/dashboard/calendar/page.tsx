"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { MaintenanceRequest, Property, Unit, CalendarEvent as CustomCalendarEvent, CalendarEventType } from "@/lib/types";
import { CATEGORY_LABELS, STATUS_LABELS, EVENT_TYPE_LABELS } from "@/lib/types";
import { ChevronLeft, ChevronRight, CalendarDays, ExternalLink, Plus, X, Download, Building2, Home, Pencil, Trash2 } from "lucide-react";

interface CalendarEntry {
  id: string;
  date: string;
  title: string;
  subtitle: string;
  type: "maintenance" | "rent_reminder" | "move_in" | "move_out" | "inspection" | "lease_end" | "other";
  // For maintenance entries
  request?: MaintenanceRequest;
  // For custom entries
  customEvent?: CustomCalendarEvent;
}

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const EVENT_TYPE_OPTIONS: { key: CalendarEventType; label: string }[] = [
  { key: "maintenance", label: "Maintenance" },
  { key: "rent_reminder", label: "Rent Reminder" },
  { key: "move_in", label: "Move-in" },
  { key: "move_out", label: "Move-out" },
  { key: "inspection", label: "Inspection" },
  { key: "other", label: "Other" },
];

const DOT_COLORS: Record<string, string> = {
  maintenance: "bg-orange-400",
  rent_reminder: "bg-green-500",
  move_in: "bg-blue-500",
  move_out: "bg-red-500",
  inspection: "bg-purple-500",
  lease_end: "bg-red-400",
  other: "bg-gray-400",
};

const BADGE_STYLES: Record<string, string> = {
  maintenance: "bg-orange-100 text-orange-700",
  rent_reminder: "bg-green-100 text-green-700",
  move_in: "bg-blue-100 text-blue-700",
  move_out: "bg-red-100 text-red-700",
  inspection: "bg-purple-100 text-purple-700",
  lease_end: "bg-red-100 text-red-600",
  other: "bg-gray-100 text-gray-600",
};

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

function googleCalendarUrl(entry: CalendarEntry) {
  const date = entry.date.replace(/-/g, "");
  const title = encodeURIComponent(entry.title);
  const details = encodeURIComponent(entry.subtitle);
  return `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${date}/${date}&details=${details}`;
}

function generateICS(entry: CalendarEntry) {
  const date = entry.date.replace(/-/g, "");
  const ics = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PropTrack//Calendar//EN",
    "BEGIN:VEVENT",
    `DTSTART;VALUE=DATE:${date}`,
    `DTEND;VALUE=DATE:${date}`,
    `SUMMARY:${entry.title}`,
    `DESCRIPTION:${entry.subtitle.replace(/\n/g, "\\n")}`,
    `UID:${entry.id}@proptrack.app`,
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");

  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${entry.title.replace(/[^a-zA-Z0-9]/g, "-")}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CalendarPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [customEvents, setCustomEvents] = useState<CustomCalendarEvent[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(formatDate(today.getFullYear(), today.getMonth(), today.getDate()));

  // Add/edit event modal
  const [showAddEvent, setShowAddEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [evtTitle, setEvtTitle] = useState("");
  const [evtDate, setEvtDate] = useState("");
  const [evtType, setEvtType] = useState<CalendarEventType>("maintenance");
  const [evtPropertyId, setEvtPropertyId] = useState("");
  const [evtUnitId, setEvtUnitId] = useState("");
  const [evtDescription, setEvtDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [reqRes, propRes, unitRes] = await Promise.all([
      supabase.from("maintenance_requests").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("properties").select("*").eq("owner_id", user.id).order("name"),
      supabase.from("units").select("*").eq("owner_id", user.id).order("label"),
    ]);
    // calendar_events table may not exist yet — fetch separately to avoid breaking other queries
    const evtRes = await supabase.from("calendar_events").select("*").eq("owner_id", user.id).order("event_date");

    setRequests((reqRes.data || []) as MaintenanceRequest[]);
    setCustomEvents((evtRes.data || []) as CustomCalendarEvent[]);
    setProperties((propRes.data || []) as Property[]);
    setUnits((unitRes.data || []) as Unit[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Build events map
  const eventsMap = useMemo(() => {
    const map: Record<string, CalendarEntry[]> = {};
    function push(entry: CalendarEntry) {
      if (!map[entry.date]) map[entry.date] = [];
      map[entry.date].push(entry);
    }

    // Maintenance request events
    for (const req of requests) {
      if (req.requested_date) {
        push({
          id: `req-${req.id}-requested`,
          date: toDateStr(req.requested_date),
          title: `${CATEGORY_LABELS[req.category]} — ${req.property_name}`,
          subtitle: `${req.description} · ${req.unit_label}${req.tenant_name ? ` · ${req.tenant_name}` : ""}`,
          type: "maintenance",
          request: req,
        });
      }
      if (req.service_date) {
        push({
          id: `req-${req.id}-service`,
          date: toDateStr(req.service_date),
          title: `Service: ${CATEGORY_LABELS[req.category]} — ${req.property_name}`,
          subtitle: `${req.description} · ${req.unit_label}`,
          type: "maintenance",
          request: req,
        });
      }
      if (req.confirmed_time) {
        push({
          id: `req-${req.id}-scheduled`,
          date: toDateStr(req.confirmed_time),
          title: `Scheduled: ${CATEGORY_LABELS[req.category]} — ${req.property_name}`,
          subtitle: `${req.description} · ${req.unit_label}`,
          type: "maintenance",
          request: req,
        });
      }
    }

    // Custom calendar events
    for (const evt of customEvents) {
      const prop = properties.find((p) => p.id === evt.property_id);
      push({
        id: `evt-${evt.id}`,
        date: evt.event_date,
        title: evt.title,
        subtitle: [evt.description, prop?.name].filter(Boolean).join(" · "),
        type: evt.event_type,
        customEvent: evt,
      });
    }

    // Lease end dates from units
    for (const unit of units) {
      if (unit.lease_end_date) {
        const prop = properties.find((p) => p.id === unit.property_id);
        push({
          id: `lease-${unit.id}`,
          date: unit.lease_end_date,
          title: `Lease ends — ${unit.label}`,
          subtitle: `${prop?.name || "Property"} · ${unit.tenant_name || "Tenant"}`,
          type: "lease_end",
        });
      }
    }

    return map;
  }, [requests, customEvents, units, properties]);

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

  function openAddEvent(date?: string) {
    setEditingEventId(null);
    setEvtTitle("");
    setEvtDate(date || selectedDate || formatDate(year, month, 1));
    setEvtType("maintenance");
    setEvtPropertyId("");
    setEvtUnitId("");
    setEvtDescription("");
    setSaveError("");
    setShowAddEvent(true);
  }

  function openEditEvent(evt: CustomCalendarEvent) {
    setEditingEventId(evt.id);
    setEvtTitle(evt.title);
    setEvtDate(evt.event_date);
    setEvtType(evt.event_type);
    setEvtPropertyId(evt.property_id || "");
    setEvtUnitId(evt.unit_id || "");
    setEvtDescription(evt.description || "");
    setSaveError("");
    setShowAddEvent(true);
  }

  async function handleDeleteEvent(id: string) {
    if (!confirm("Delete this event?")) return;
    await supabase.from("calendar_events").delete().eq("id", id);
    fetchData();
  }

  async function handleAddEvent(e: React.FormEvent) {
    e.preventDefault();
    if (!evtTitle.trim() || !evtDate) return;
    setSaving(true);
    setSaveError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setSaveError("You must be logged in."); return; }

    const payload = {
      title: evtTitle.trim(),
      event_date: evtDate,
      event_type: evtType,
      property_id: evtPropertyId || null,
      unit_id: evtUnitId || null,
      description: evtDescription.trim() || null,
    };

    const { error } = editingEventId
      ? await supabase.from("calendar_events").update(payload).eq("id", editingEventId)
      : await supabase.from("calendar_events").insert({ ...payload, owner_id: user.id });

    if (error) {
      setSaving(false);
      setSaveError(error.message || "Failed to save event.");
      return;
    }

    setShowAddEvent(false);
    setEditingEventId(null);
    setSaving(false);
    setSaveError("");
    fetchData();
  }

  const selectedEvents = selectedDate ? (eventsMap[selectedDate] || []) : [];
  const filteredEvtUnits = units.filter((u) => u.property_id === evtPropertyId);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-3 border-brand/20 border-t-brand rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal" style={{ fontFamily: "var(--font-display)" }}>Calendar</h1>
          <p className="text-sm text-charcoal-secondary mt-1">Events, reminders, and key dates</p>
        </div>
        <button
          onClick={() => openAddEvent()}
          className="flex items-center gap-1.5 text-sm font-medium bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl transition-colors"
        >
          <Plus className="w-4 h-4" />Add event
        </button>
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
                    {Array.from(new Set(dayEvents.map((e) => e.type))).slice(0, 3).map((type) => (
                      <span key={type} className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-white/70" : DOT_COLORS[type] || "bg-gray-400"}`} />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-warm-300/40 flex-wrap">
          {(Object.entries(DOT_COLORS) as [string, string][]).map(([type, color]) => (
            <div key={type} className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${color}`} />
              <span className="text-xs text-charcoal-tertiary">{type === "lease_end" ? "Lease End" : EVENT_TYPE_LABELS[type as CalendarEventType] || type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Selected day events */}
      {selectedDate && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-charcoal">
              {new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}
            </h3>
            <button onClick={() => openAddEvent(selectedDate)} className="text-xs font-medium text-brand hover:text-brand-dark transition-colors flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />Add
            </button>
          </div>
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
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-md ${BADGE_STYLES[ev.type] || "bg-gray-100 text-gray-600"}`}>
                          {ev.type === "lease_end" ? "Lease End" : EVENT_TYPE_LABELS[ev.type as CalendarEventType] || ev.type}
                        </span>
                        {ev.request && (
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-md status-${ev.request.status}`}>
                            {STATUS_LABELS[ev.request.status]}
                          </span>
                        )}
                      </div>
                      <p className="text-sm font-medium text-charcoal truncate">{ev.title}</p>
                      <p className="text-xs text-charcoal-tertiary mt-1 truncate">{ev.subtitle}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ev.customEvent && (
                        <>
                          <button
                            onClick={() => openEditEvent(ev.customEvent!)}
                            className="p-1.5 rounded-lg text-charcoal-tertiary hover:text-brand hover:bg-warm-100 transition-colors"
                            title="Edit event"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDeleteEvent(ev.customEvent!.id)}
                            className="p-1.5 rounded-lg text-charcoal-tertiary hover:text-red-500 hover:bg-red-50 transition-colors"
                            title="Delete event"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      <a
                        href={googleCalendarUrl(ev)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs font-medium text-brand hover:text-brand-dark transition-colors"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Google
                      </a>
                      <button
                        onClick={() => generateICS(ev)}
                        className="flex items-center gap-1 text-xs font-medium text-charcoal-secondary hover:text-charcoal transition-colors"
                      >
                        <Download className="w-3.5 h-3.5" />
                        .ics
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Add Event Modal */}
      {showAddEvent && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-charcoal">{editingEventId ? "Edit event" : "Add event"}</h3>
              <button onClick={() => setShowAddEvent(false)} className="p-1 text-charcoal-tertiary hover:text-charcoal"><X className="w-5 h-5" /></button>
            </div>

            {saveError && <div className="mb-4 px-4 py-3 rounded-xl bg-danger-light text-danger text-sm font-medium">{saveError}</div>}

            <form onSubmit={handleAddEvent} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Title *</label>
                <input type="text" placeholder="e.g. Rent Due, Inspection" value={evtTitle} onChange={(e) => setEvtTitle(e.target.value)} required
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" autoFocus />
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Date *</label>
                <input type="date" value={evtDate} onChange={(e) => setEvtDate(e.target.value)} required
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors" />
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Event type</label>
                <div className="flex flex-wrap gap-2">
                  {EVENT_TYPE_OPTIONS.map((opt) => (
                    <button key={opt.key} type="button" onClick={() => setEvtType(opt.key)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${evtType === opt.key ? "bg-brand text-white" : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Property (optional)</label>
                <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white">
                  <Building2 className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                  <select value={evtPropertyId} onChange={(e) => { setEvtPropertyId(e.target.value); setEvtUnitId(""); }}
                    className="flex-1 bg-transparent text-sm text-charcoal outline-none">
                    <option value="">None</option>
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              {evtPropertyId && (
                <div>
                  <label className="text-sm font-medium text-charcoal mb-2 block">Unit (optional)</label>
                  <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white">
                    <Home className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                    <select value={evtUnitId} onChange={(e) => setEvtUnitId(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-charcoal outline-none">
                      <option value="">None</option>
                      {filteredEvtUnits.map((u) => <option key={u.id} value={u.id}>{u.label}</option>)}
                    </select>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Description (optional)</label>
                <textarea value={evtDescription} onChange={(e) => setEvtDescription(e.target.value)} placeholder="Notes about this event..." rows={2}
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white resize-none outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
              </div>

              <button type="submit" disabled={saving || !evtTitle.trim() || !evtDate}
                className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
                {saving ? "Saving..." : editingEventId ? "Save changes" : "Add event"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
