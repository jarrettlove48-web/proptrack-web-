"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { MaintenanceRequest, RequestStatus, RequestCategory, Property, Unit, Contractor, RequestMedia } from "@/lib/types";
import { STATUS_LABELS, CATEGORY_LABELS, CONTRACTOR_CATEGORY_LABELS, CONTRACTOR_STATUS_LABELS, REQUEST_TO_CONTRACTOR_CATEGORY } from "@/lib/types";
import { Wrench, Filter, Plus, X, Building2, Calendar, HardHat, UserCheck, ChevronDown, Clock, Pencil, Check } from "lucide-react";
import { useDashboard } from "../layout";
import { sendNotification } from "@/lib/notify";

const CATEGORIES: { key: RequestCategory; label: string }[] = [
  { key: "plumbing", label: "Plumbing" },
  { key: "electrical", label: "Electrical" },
  { key: "hvac", label: "HVAC" },
  { key: "appliance", label: "Appliance" },
  { key: "other", label: "Other" },
];

export default function RequestsPage() {
  const supabase = createClient();
  const { profile } = useDashboard();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [mediaByRequest, setMediaByRequest] = useState<Record<string, RequestMedia[]>>({});
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");
  const [assigningId, setAssigningId] = useState<string | null>(null);

  // Inline editing
  const [editingReqId, setEditingReqId] = useState<string | null>(null);
  const [editingReqField, setEditingReqField] = useState<"description" | "category" | null>(null);
  const [editReqValue, setEditReqValue] = useState("");
  const [savingReqEdit, setSavingReqEdit] = useState(false);

  function startEditReq(id: string, field: "description" | "category", value: string) {
    setEditingReqId(id); setEditingReqField(field); setEditReqValue(value);
  }
  function cancelEditReq() { setEditingReqId(null); setEditingReqField(null); setEditReqValue(""); }
  async function saveReqEdit() {
    if (!editingReqId || !editingReqField) return;
    setSavingReqEdit(true);
    await supabase.from("maintenance_requests").update({ [editingReqField]: editReqValue.trim(), updated_at: new Date().toISOString() }).eq("id", editingReqId);
    setEditingReqId(null); setEditingReqField(null); setEditReqValue(""); setSavingReqEdit(false);
    fetchData();
  }

  // Add request modal
  const [showAdd, setShowAdd] = useState(false);
  const [reqPropertyId, setReqPropertyId] = useState("");
  const [reqUnitId, setReqUnitId] = useState("");
  const [reqCategory, setReqCategory] = useState<RequestCategory>("plumbing");
  const [reqDescription, setReqDescription] = useState("");
  const [reqDate, setReqDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [reqRes, propRes, unitRes, conRes] = await Promise.all([
      supabase.from("maintenance_requests").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("properties").select("*").eq("owner_id", user.id).order("name"),
      supabase.from("units").select("*").eq("owner_id", user.id).order("label"),
      supabase.from("contractors").select("*").eq("owner_id", user.id).eq("is_active", true).order("first_name"),
    ]);
    const reqs = (reqRes.data || []) as MaintenanceRequest[];
    setRequests(reqs);
    setProperties((propRes.data || []) as Property[]);
    setUnits((unitRes.data || []) as Unit[]);
    setContractors((conRes.data || []) as Contractor[]);
    if (propRes.data?.length && !reqPropertyId) setReqPropertyId(propRes.data[0].id);

    // Fetch media for all requests that have IDs
    const reqIds = reqs.map((r) => r.id);
    if (reqIds.length > 0) {
      const { data: mediaData } = await supabase.from("request_media").select("*").in("request_id", reqIds);
      const grouped: Record<string, RequestMedia[]> = {};
      (mediaData || []).forEach((m: RequestMedia) => {
        if (!grouped[m.request_id]) grouped[m.request_id] = [];
        grouped[m.request_id].push(m);
      });
      setMediaByRequest(grouped);
    }

    setLoading(false);
  }, [supabase, reqPropertyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredUnits = units.filter((u) => u.property_id === reqPropertyId);

  async function handleAddRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!reqDescription.trim() || !reqPropertyId || !reqUnitId) return;
    setSaving(true);
    setSaveError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setSaveError("You must be logged in."); return; }

    const prop = properties.find((p) => p.id === reqPropertyId);
    const unit = units.find((u) => u.id === reqUnitId);

    const { data: reqData, error } = await supabase.from("maintenance_requests").insert({
      unit_id: reqUnitId,
      property_id: reqPropertyId,
      owner_id: user.id,
      category: reqCategory,
      description: reqDescription.trim(),
      status: "open",
      tenant_name: unit?.tenant_name || "",
      unit_label: unit?.label || "",
      property_name: prop?.name || "",
      requested_date: reqDate || null,
    }).select("id").single();

    if (error) {
      setSaving(false);
      setSaveError(error.message || "Failed to create request. Please try again.");
      return;
    }

    await supabase.from("activities").insert({
      owner_id: user.id,
      type: "request_created",
      title: "Request created",
      subtitle: `${reqCategory} — ${prop?.name || "property"}`,
      related_id: reqData?.id || null,
      related_property_id: reqPropertyId,
    });

    setReqDescription(""); setReqCategory("plumbing"); setReqDate("");
    setShowAdd(false); setSaving(false);
    setSaveError("");
    fetchData();
  }

  async function updateStatus(id: string, status: RequestStatus) {
    await supabase.from("maintenance_requests").update({ status, updated_at: new Date().toISOString() }).eq("id", id);
    fetchData();
  }

  async function assignContractor(requestId: string, contractorId: string) {
    const { data: { user } } = await supabase.auth.getUser();
    const contractor = contractors.find((c) => c.id === contractorId);
    await supabase.from("maintenance_requests").update({
      assigned_contractor_id: contractorId,
      contractor_status: "pending",
      updated_at: new Date().toISOString(),
    }).eq("id", requestId);

    if (user && contractor) {
      await supabase.from("activities").insert({
        owner_id: user.id,
        type: "contractor_assigned",
        title: "Contractor assigned",
        subtitle: `${contractor.first_name} ${contractor.last_name}`,
        related_id: requestId,
      });

      // Email the contractor
      if (contractor.email) {
        const req = requests.find((r) => r.id === requestId);
        sendNotification({
          type: "contractor_assigned",
          recipientEmail: contractor.email,
          recipientName: `${contractor.first_name} ${contractor.last_name}`,
          data: {
            category: CATEGORY_LABELS[req?.category || "other"],
            description: req?.description || "",
            propertyName: req?.property_name || "",
            unitLabel: req?.unit_label || "",
            tenantName: req?.tenant_name || "",
            portalUrl: `${window.location.origin}/contractor`,
          },
        });
      }
    }

    setAssigningId(null);
    fetchData();
  }

  async function unassignContractor(requestId: string) {
    await supabase.from("maintenance_requests").update({
      assigned_contractor_id: null,
      contractor_status: null,
      updated_at: new Date().toISOString(),
    }).eq("id", requestId);
    fetchData();
  }

  /** Returns contractors sorted: matching category first, then the rest */
  function getSortedContractors(category: RequestCategory) {
    const matchCat = REQUEST_TO_CONTRACTOR_CATEGORY[category];
    const matched = contractors.filter((c) => c.category === matchCat);
    const others = contractors.filter((c) => c.category !== matchCat);
    return { matched, others };
  }

  const filtered = statusFilter === "all" ? requests : requests.filter((r) => r.status === statusFilter);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-3 border-brand/20 border-t-brand rounded-full animate-spin" /></div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal" style={{ fontFamily: "var(--font-display)" }}>Requests</h1>
          <p className="text-sm text-charcoal-secondary mt-1">{requests.length} total · {requests.filter((r) => r.status === "open").length} open</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm font-medium bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" />New request
        </button>
      </div>

      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-charcoal-tertiary" />
        {(["all", "open", "in_progress", "resolved"] as const).map((f) => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${statusFilter === f ? "bg-brand text-white" : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"}`}>
            {f === "all" ? "All" : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-warm-300/50 p-8 text-center">
          <Wrench className="w-8 h-8 text-charcoal-tertiary mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-charcoal-secondary">{statusFilter === "all" ? "No requests yet." : `No ${STATUS_LABELS[statusFilter as RequestStatus].toLowerCase()} requests.`}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => {
            const media = mediaByRequest[req.id] || [];
            const assignedContractor = contractors.find((c) => c.id === req.assigned_contractor_id);
            const isAssigning = assigningId === req.id;
            const sorted = getSortedContractors(req.category);

            return (
              <div key={req.id} className="bg-surface rounded-2xl border border-warm-300/50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    {editingReqId === req.id && editingReqField === "description" ? (
                      <div className="flex items-center gap-2">
                        <input type="text" value={editReqValue} onChange={(e) => setEditReqValue(e.target.value)}
                          placeholder="Description" autoFocus
                          className="flex-1 font-medium text-charcoal bg-transparent outline-none border-b border-brand min-w-0"
                          onKeyDown={(e) => { if (e.key === "Enter") saveReqEdit(); if (e.key === "Escape") cancelEditReq(); }} />
                        <button onClick={saveReqEdit} disabled={savingReqEdit} className="text-brand hover:text-brand-dark"><Check className="w-3.5 h-3.5" /></button>
                        <button onClick={cancelEditReq} className="text-charcoal-tertiary hover:text-charcoal"><X className="w-3.5 h-3.5" /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 group">
                        <p className="font-medium text-charcoal">{req.description}</p>
                        <button onClick={() => startEditReq(req.id, "description", req.description)}
                          className="text-charcoal-tertiary hover:text-brand transition-colors opacity-0 group-hover:opacity-60 hover:!opacity-100 shrink-0">
                          <Pencil className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {editingReqId === req.id && editingReqField === "category" ? (
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {CATEGORIES.map((c) => (
                            <button key={c.key} type="button"
                              onClick={() => { setEditReqValue(c.key); }}
                              className={`text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors ${editReqValue === c.key ? "bg-brand text-white" : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"}`}>
                              {c.label}
                            </button>
                          ))}
                          <button onClick={saveReqEdit} disabled={savingReqEdit} className="text-brand hover:text-brand-dark ml-1"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={cancelEditReq} className="text-charcoal-tertiary hover:text-charcoal"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <button onClick={() => startEditReq(req.id, "category", req.category)}
                          className={`text-xs font-semibold px-2.5 py-1 rounded-lg cat-${req.category} hover:ring-1 hover:ring-brand/30 transition-all cursor-pointer`}>
                          {CATEGORY_LABELS[req.category]}
                        </button>
                      )}
                      <span className="text-xs text-charcoal-tertiary">{req.property_name} · {req.unit_label}</span>
                      {req.tenant_name && <span className="text-xs text-charcoal-tertiary">by {req.tenant_name}</span>}
                    </div>

                    {/* Media thumbnails */}
                    {media.length > 0 && (
                      <div className="flex gap-2 mt-3">
                        {media.slice(0, 4).map((m) => (
                          <a key={m.id} href={m.media_url} target="_blank" rel="noopener noreferrer"
                            className="w-16 h-16 rounded-lg overflow-hidden border border-warm-300/50 hover:border-brand transition-colors shrink-0">
                            <img src={m.media_url} alt="Request photo" className="w-full h-full object-cover" />
                          </a>
                        ))}
                        {media.length > 4 && (
                          <div className="w-16 h-16 rounded-lg bg-warm-100 flex items-center justify-center text-xs font-semibold text-charcoal-secondary">
                            +{media.length - 4}
                          </div>
                        )}
                      </div>
                    )}

                    <p className="text-xs text-charcoal-tertiary mt-2">{new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</p>
                    <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                      {req.requested_date && (
                        <span className="text-xs text-charcoal-tertiary flex items-center gap-1">
                          <Calendar className="w-3 h-3" />Requested: {new Date(req.requested_date).toLocaleDateString()}
                        </span>
                      )}
                      {req.service_date && (
                        <span className="text-xs text-success flex items-center gap-1">
                          <Calendar className="w-3 h-3" />Service: {new Date(req.service_date).toLocaleDateString()}
                        </span>
                      )}
                      {req.confirmed_time && (
                        <span className="text-xs text-success flex items-center gap-1">
                          <Calendar className="w-3 h-3" />Scheduled: {new Date(req.confirmed_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {new Date(req.confirmed_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      )}
                      {req.proposed_times && (req.proposed_times as any[]).length > 0 && !req.confirmed_time && (
                        <span className="text-xs text-charcoal-tertiary flex items-center gap-1">
                          <Clock className="w-3 h-3" />{(req.proposed_times as any[]).length} time{(req.proposed_times as any[]).length !== 1 ? "s" : ""} proposed
                        </span>
                      )}
                    </div>

                    {/* Contractor assignment section */}
                    <div className="mt-3 pt-3 border-t border-warm-300/30">
                      {assignedContractor ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <HardHat className="w-3.5 h-3.5 text-charcoal-tertiary" />
                          <span className="text-xs font-medium text-charcoal">
                            {assignedContractor.first_name} {assignedContractor.last_name}
                          </span>
                          {assignedContractor.company && (
                            <span className="text-xs text-charcoal-tertiary">({assignedContractor.company})</span>
                          )}
                          {req.contractor_status && (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cstatus-${req.contractor_status}`}>
                              {CONTRACTOR_STATUS_LABELS[req.contractor_status]}
                            </span>
                          )}
                          <button onClick={() => unassignContractor(req.id)}
                            className="text-[10px] text-charcoal-tertiary hover:text-danger transition-colors ml-1">
                            Remove
                          </button>
                        </div>
                      ) : contractors.length > 0 ? (
                        <div className="relative">
                          <button onClick={() => setAssigningId(isAssigning ? null : req.id)}
                            className="flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-dark transition-colors">
                            <HardHat className="w-3.5 h-3.5" />
                            Assign contractor
                            <ChevronDown className={`w-3 h-3 transition-transform ${isAssigning ? "rotate-180" : ""}`} />
                          </button>

                          {isAssigning && (
                            <div className="absolute top-7 left-0 z-20 bg-surface border border-warm-300/50 rounded-xl shadow-lg w-72 max-h-60 overflow-y-auto">
                              {sorted.matched.length > 0 && (
                                <>
                                  <p className="text-[10px] font-semibold text-charcoal-tertiary uppercase tracking-wider px-3 pt-3 pb-1">Best match</p>
                                  {sorted.matched.map((c) => (
                                    <button key={c.id} onClick={() => assignContractor(req.id, c.id)}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-warm-100 transition-colors text-left">
                                      <UserCheck className="w-3.5 h-3.5 text-success shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-charcoal truncate">{c.first_name} {c.last_name}</p>
                                        <p className="text-[10px] text-charcoal-tertiary truncate">{CONTRACTOR_CATEGORY_LABELS[c.category]}{c.company ? ` · ${c.company}` : ""}</p>
                                      </div>
                                    </button>
                                  ))}
                                </>
                              )}
                              {sorted.others.length > 0 && (
                                <>
                                  <p className="text-[10px] font-semibold text-charcoal-tertiary uppercase tracking-wider px-3 pt-3 pb-1">
                                    {sorted.matched.length > 0 ? "Other contractors" : "Your contractors"}
                                  </p>
                                  {sorted.others.map((c) => (
                                    <button key={c.id} onClick={() => assignContractor(req.id, c.id)}
                                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-warm-100 transition-colors text-left">
                                      <HardHat className="w-3.5 h-3.5 text-charcoal-tertiary shrink-0" />
                                      <div className="min-w-0">
                                        <p className="text-xs font-medium text-charcoal truncate">{c.first_name} {c.last_name}</p>
                                        <p className="text-[10px] text-charcoal-tertiary truncate">{CONTRACTOR_CATEGORY_LABELS[c.category]}{c.company ? ` · ${c.company}` : ""}</p>
                                      </div>
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="text-xs text-charcoal-tertiary">
                          <a href="/dashboard/contractors" className="text-brand hover:text-brand-dark">Add contractors</a> to assign them to requests
                        </p>
                      )}
                    </div>
                  </div>
                  <select value={req.status} onChange={(e) => updateStatus(req.id, e.target.value as RequestStatus)}
                    className={`text-xs font-semibold px-3 py-1.5 rounded-lg border-0 cursor-pointer status-${req.status}`}>
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Request Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-charcoal">New request</h3>
              <button onClick={() => { setShowAdd(false); setSaveError(""); }} className="p-1 text-charcoal-tertiary hover:text-charcoal"><X className="w-5 h-5" /></button>
            </div>

            {saveError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-danger-light text-danger text-sm font-medium">{saveError}</div>
            )}

            <form onSubmit={handleAddRequest} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Property *</label>
                <select value={reqPropertyId} onChange={(e) => { setReqPropertyId(e.target.value); setReqUnitId(""); }} required
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors">
                  {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Unit *</label>
                <select value={reqUnitId} onChange={(e) => setReqUnitId(e.target.value)} required
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors">
                  <option value="">Select a unit</option>
                  {filteredUnits.map((u) => <option key={u.id} value={u.id}>{u.label}{u.tenant_name ? ` — ${u.tenant_name}` : ""}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button key={cat.key} type="button" onClick={() => setReqCategory(cat.key)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${reqCategory === cat.key ? "bg-brand text-white" : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"}`}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Description *</label>
                <textarea value={reqDescription} onChange={(e) => setReqDescription(e.target.value)} placeholder="Describe the issue..." rows={3} required
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white resize-none outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" autoFocus />
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Requested date (optional)</label>
                <input type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)}
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors" />
              </div>

              <button type="submit" disabled={saving || !reqDescription.trim() || !reqUnitId}
                className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
                {saving ? "Creating..." : "Create request"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
