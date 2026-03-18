"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Property, Unit, MaintenanceRequest, Activity, RequestCategory } from "@/lib/types";
import { canAddProperty, canAddUnit, getEffectivePlan } from "@/lib/plans";
import { getActivityRoute } from "@/lib/activity-routes";
import { useDashboard } from "./layout";
import {
  Building2,
  Wrench,
  Users,
  AlertTriangle,
  ChevronRight,
  Plus,
  Home,
  X,
  MapPin,
  DollarSign,
  UserPlus,
  MessageCircle,
  User,
  Mail,
  Phone,
  Calendar,
} from "lucide-react";
import Link from "next/link";

const EXPENSE_CATEGORIES = [
  { key: "repair", label: "Repair" },
  { key: "maintenance", label: "Maintenance" },
  { key: "upgrade", label: "Upgrade" },
  { key: "inspection", label: "Inspection" },
  { key: "other", label: "Other" },
] as const;

const REQUEST_CATEGORIES: { key: RequestCategory; label: string }[] = [
  { key: "plumbing", label: "Plumbing" },
  { key: "electrical", label: "Electrical" },
  { key: "hvac", label: "HVAC" },
  { key: "appliance", label: "Appliance" },
  { key: "other", label: "Other" },
];

export default function DashboardPage() {
  const supabase = createClient();
  const { profile, showUpgradeModal, adminSimulatedPlan } = useDashboard();

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // Shared modal state
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Add property modal
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [newPropName, setNewPropName] = useState("");
  const [newPropAddress, setNewPropAddress] = useState("");

  // Add unit modal
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [unitPropertyId, setUnitPropertyId] = useState("");
  const [unitLabel, setUnitLabel] = useState("");
  const [unitTenantName, setUnitTenantName] = useState("");
  const [unitTenantEmail, setUnitTenantEmail] = useState("");
  const [unitTenantPhone, setUnitTenantPhone] = useState("");
  const [unitMoveIn, setUnitMoveIn] = useState("");
  const [unitLeaseEnd, setUnitLeaseEnd] = useState("");
  const [unitOccupied, setUnitOccupied] = useState(false);

  // New request modal
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [reqPropertyId, setReqPropertyId] = useState("");
  const [reqUnitId, setReqUnitId] = useState("");
  const [reqCategory, setReqCategory] = useState<RequestCategory>("plumbing");
  const [reqDescription, setReqDescription] = useState("");
  const [reqDate, setReqDate] = useState("");

  // Add expense modal
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expPropertyId, setExpPropertyId] = useState("");
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("repair");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [expVendor, setExpVendor] = useState("");

  // Plan with admin override
  const plan = getEffectivePlan(profile?.plan || "starter", profile?.email, adminSimulatedPlan);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [propRes, unitRes, reqRes] = await Promise.all([
      supabase.from("properties").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("units").select("*").eq("owner_id", user.id),
      supabase.from("maintenance_requests").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
    ]);

    const actRes = await supabase.from("activities").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }).limit(5);

    setProperties((propRes.data || []) as Property[]);
    setUnits((unitRes.data || []) as Unit[]);
    setRequests((reqRes.data || []) as MaintenanceRequest[]);
    setActivities((actRes.data || []) as Activity[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAddProperty(e: React.FormEvent) {
    e.preventDefault();
    if (!newPropName.trim()) return;
    setSaving(true); setSaveError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setSaveError("You must be logged in."); return; }

    const { data: propData, error } = await supabase.from("properties").insert({
      owner_id: user.id, name: newPropName.trim(), address: newPropAddress.trim(), unit_count: 0,
    }).select("id").single();

    if (error) { setSaving(false); setSaveError(error.message || "Failed to add property."); return; }

    await supabase.from("activities").insert({
      owner_id: user.id, type: "property_added", title: "Property added", subtitle: newPropName.trim(),
      related_id: propData?.id || null, related_property_id: propData?.id || null,
    });

    setNewPropName(""); setNewPropAddress(""); setShowAddProperty(false); setSaving(false); setSaveError(""); fetchData();
  }

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitLabel.trim() || !unitPropertyId) return;
    setSaving(true); setSaveError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setSaveError("You must be logged in."); return; }

    const { data: unitData, error } = await supabase.from("units").insert({
      property_id: unitPropertyId, owner_id: user.id, label: unitLabel.trim(),
      tenant_name: unitTenantName.trim(), tenant_email: unitTenantEmail.trim(), tenant_phone: unitTenantPhone.trim(),
      move_in_date: unitMoveIn, lease_end_date: unitLeaseEnd || null, is_occupied: unitOccupied,
    }).select("id").single();

    if (error) { setSaving(false); setSaveError(error.message || "Failed to add unit."); return; }

    const propUnits = units.filter((u) => u.property_id === unitPropertyId);
    await supabase.from("properties").update({ unit_count: propUnits.length + 1 }).eq("id", unitPropertyId);
    const prop = properties.find((p) => p.id === unitPropertyId);
    await supabase.from("activities").insert({
      owner_id: user.id, type: "unit_added", title: "Unit added",
      subtitle: `${unitLabel.trim()} at ${prop?.name || "property"}`,
      related_id: unitData?.id || null, related_property_id: unitPropertyId,
    });

    setUnitLabel(""); setUnitTenantName(""); setUnitTenantEmail(""); setUnitTenantPhone("");
    setUnitMoveIn(""); setUnitLeaseEnd(""); setUnitOccupied(false);
    setShowAddUnit(false); setSaving(false); setSaveError(""); fetchData();
  }

  async function handleNewRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!reqDescription.trim() || !reqPropertyId || !reqUnitId) return;
    setSaving(true); setSaveError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setSaveError("You must be logged in."); return; }

    const prop = properties.find((p) => p.id === reqPropertyId);
    const unit = units.find((u) => u.id === reqUnitId);

    const { data: reqData, error } = await supabase.from("maintenance_requests").insert({
      unit_id: reqUnitId, property_id: reqPropertyId, owner_id: user.id, category: reqCategory,
      description: reqDescription.trim(), status: "open", tenant_name: unit?.tenant_name || "",
      unit_label: unit?.label || "", property_name: prop?.name || "", requested_date: reqDate || null,
    }).select("id").single();

    if (error) { setSaving(false); setSaveError(error.message || "Failed to create request."); return; }

    await supabase.from("activities").insert({
      owner_id: user.id, type: "request_created", title: "Request created",
      subtitle: `${reqCategory} — ${prop?.name || "property"}`,
      related_id: reqData?.id || null, related_property_id: reqPropertyId,
    });

    setReqDescription(""); setReqCategory("plumbing"); setReqDate(""); setReqUnitId("");
    setShowNewRequest(false); setSaving(false); setSaveError(""); fetchData();
  }

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expDesc.trim() || !expAmount || !expPropertyId) return;
    setSaving(true); setSaveError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setSaveError("You must be logged in."); return; }

    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) { setSaving(false); setSaveError("Please enter a valid amount."); return; }

    const { data: expData, error } = await supabase.from("expenses").insert({
      owner_id: user.id, property_id: expPropertyId, description: expDesc.trim(),
      amount, category: expCategory, date: expDate, vendor: expVendor.trim() || null,
    }).select("id").single();

    if (error) { setSaving(false); setSaveError(error.message || "Failed to add expense."); return; }

    const prop = properties.find((p) => p.id === expPropertyId);
    await supabase.from("activities").insert({
      owner_id: user.id, type: "expense_added", title: "Expense logged",
      subtitle: `$${amount.toFixed(2)} - ${prop?.name || "property"}`,
      related_id: expData?.id || null, related_property_id: expPropertyId,
    });

    setExpDesc(""); setExpAmount(""); setExpVendor(""); setExpCategory("repair");
    setExpDate(new Date().toISOString().split("T")[0]);
    setShowAddExpense(false); setSaving(false); setSaveError(""); fetchData();
  }

  const openRequests = requests.filter((r) => r.status === "open");
  const inProgressRequests = requests.filter((r) => r.status === "in_progress");
  const occupiedUnits = units.filter((u) => u.is_occupied);
  const filteredReqUnits = units.filter((u) => u.property_id === reqPropertyId);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-3 border-brand/20 border-t-brand rounded-full animate-spin" /></div>;
  }

  // Stat card config with links
  const statCards = [
    { label: "Properties", value: properties.length, icon: Building2, color: "text-brand", bg: "bg-brand-faint", href: "/dashboard" },
    { label: "Total units", value: units.length, icon: Home, color: "text-brand", bg: "bg-brand-faint", href: properties[0] ? `/dashboard/property/${properties[0].id}` : "/dashboard" },
    { label: "Open requests", value: openRequests.length, icon: AlertTriangle, color: "text-danger", bg: "bg-danger-light", href: "/dashboard/requests" },
    { label: "Tenants", value: occupiedUnits.length, icon: Users, color: "text-accent", bg: "bg-accent-light", href: properties[0] ? `/dashboard/property/${properties[0].id}` : "/dashboard" },
  ];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
          {profile?.name ? `Hey, ${profile.name.split(" ")[0]}` : "Dashboard"}
        </h1>
        <p className="text-sm text-charcoal-secondary mt-1">
          Here&apos;s what&apos;s happening across your properties.
        </p>
      </div>

      {/* Clickable stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {statCards.map((stat) => (
          <Link
            key={stat.label}
            href={stat.href}
            className="bg-surface rounded-2xl p-4 border border-warm-300/50 hover:border-brand/30 hover:shadow-sm transition-all group"
          >
            <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-[18px] h-[18px] ${stat.color}`} strokeWidth={1.8} />
            </div>
            <p className="text-2xl font-bold text-charcoal">{stat.value}</p>
            <p className="text-xs text-charcoal-tertiary font-medium mt-0.5 group-hover:text-brand transition-colors">{stat.label}</p>
          </Link>
        ))}
      </div>

      {/* Quick-create buttons */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-8">
        <button
          onClick={() => {
            if (!canAddProperty(plan, properties.length)) { showUpgradeModal("properties"); return; }
            setShowAddProperty(true);
          }}
          className="flex items-center gap-2 bg-surface border border-warm-300/50 rounded-xl px-4 py-3 text-sm font-medium text-charcoal hover:border-brand/30 hover:text-brand transition-all"
        >
          <Plus className="w-4 h-4 text-brand" />Add property
        </button>
        <button
          onClick={() => {
            if (properties.length === 0) return;
            if (!canAddUnit(plan, units.length)) { showUpgradeModal("units"); return; }
            setUnitPropertyId(properties[0].id);
            setShowAddUnit(true);
          }}
          className="flex items-center gap-2 bg-surface border border-warm-300/50 rounded-xl px-4 py-3 text-sm font-medium text-charcoal hover:border-brand/30 hover:text-brand transition-all"
        >
          <Plus className="w-4 h-4 text-brand" />Add unit
        </button>
        <button
          onClick={() => {
            if (properties.length === 0) return;
            setReqPropertyId(properties[0].id); setReqUnitId("");
            setShowNewRequest(true);
          }}
          className="flex items-center gap-2 bg-surface border border-warm-300/50 rounded-xl px-4 py-3 text-sm font-medium text-charcoal hover:border-brand/30 hover:text-brand transition-all"
        >
          <Plus className="w-4 h-4 text-brand" />New request
        </button>
        <button
          onClick={() => {
            if (properties.length === 0) return;
            setExpPropertyId(properties[0].id);
            setShowAddExpense(true);
          }}
          className="flex items-center gap-2 bg-surface border border-warm-300/50 rounded-xl px-4 py-3 text-sm font-medium text-charcoal hover:border-brand/30 hover:text-brand transition-all"
        >
          <Plus className="w-4 h-4 text-brand" />Add expense
        </button>
      </div>

      {/* Properties list */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-charcoal">Your properties</h2>
          <button
            onClick={() => {
              if (!canAddProperty(plan, properties.length)) { showUpgradeModal("properties"); return; }
              setShowAddProperty(true);
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark transition-colors"
          >
            <Plus className="w-4 h-4" />Add property
          </button>
        </div>

        {properties.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-warm-300/50 p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-faint flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-brand" strokeWidth={1.6} />
            </div>
            <p className="font-medium text-charcoal mb-1">No properties yet</p>
            <p className="text-sm text-charcoal-secondary mb-4">Add your first property to start tracking maintenance.</p>
            <button
              onClick={() => { setShowAddProperty(true); }}
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />Add property
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {properties.map((property) => {
              const propertyUnits = units.filter((u) => u.property_id === property.id);
              const propertyRequests = openRequests.filter((r) => r.property_id === property.id);
              const occupied = propertyUnits.filter((u) => u.is_occupied).length;
              return (
                <Link key={property.id} href={`/dashboard/property/${property.id}`}
                  className="flex items-center justify-between bg-surface rounded-2xl border border-warm-300/50 p-5 hover:border-brand/30 hover:shadow-sm transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-brand-faint flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-brand" strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="font-semibold text-charcoal group-hover:text-brand transition-colors">{property.name}</p>
                      <p className="text-sm text-charcoal-secondary">{property.address || "No address"}</p>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-xs text-charcoal-tertiary flex items-center gap-1"><Home className="w-3 h-3" />{propertyUnits.length} unit{propertyUnits.length !== 1 ? "s" : ""}</span>
                        <span className="text-xs text-charcoal-tertiary flex items-center gap-1"><Users className="w-3 h-3" />{occupied} occupied</span>
                        {propertyRequests.length > 0 && <span className="text-xs text-danger font-medium flex items-center gap-1"><Wrench className="w-3 h-3" />{propertyRequests.length} open</span>}
                      </div>
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-charcoal-tertiary group-hover:text-brand transition-colors" />
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* Open requests */}
      {openRequests.length > 0 && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-charcoal">Open requests</h2>
            <Link href="/dashboard/requests" className="text-sm font-medium text-brand hover:text-brand-dark transition-colors">View all →</Link>
          </div>
          <div className="space-y-2">
            {openRequests.slice(0, 5).map((req) => (
              <div key={req.id} className="flex items-center justify-between bg-surface rounded-xl border border-warm-300/50 px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg cat-${req.category}`}>{req.category}</span>
                  <div>
                    <p className="text-sm font-medium text-charcoal">{req.description.slice(0, 60)}{req.description.length > 60 ? "..." : ""}</p>
                    <p className="text-xs text-charcoal-tertiary mt-0.5">{req.property_name} · {req.unit_label}</p>
                  </div>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg status-open">Open</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {inProgressRequests.length > 0 && (
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-charcoal mb-4">In progress ({inProgressRequests.length})</h2>
          <div className="space-y-2">
            {inProgressRequests.slice(0, 3).map((req) => (
              <div key={req.id} className="flex items-center justify-between bg-surface rounded-xl border border-warm-300/50 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-charcoal">{req.description.slice(0, 60)}{req.description.length > 60 ? "..." : ""}</p>
                  <p className="text-xs text-charcoal-tertiary mt-0.5">{req.property_name} · {req.unit_label}</p>
                </div>
                <span className="text-xs font-semibold px-2.5 py-1 rounded-lg status-in_progress">In Progress</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent activity — clickable with fallback name matching */}
      {activities.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-charcoal mb-4">Recent activity</h2>
          <div className="space-y-2">
            {activities.map((act) => {
              const route = getActivityRoute(act, properties);
              const activityContent = (
                <>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    act.type.includes("request") ? "bg-warning-light" :
                    act.type.includes("message") ? "bg-brand-faint" :
                    act.type.includes("expense") ? "bg-accent-light" :
                    act.type.includes("tenant") ? "bg-success-light" : "bg-brand-faint"
                  }`}>
                    {act.type.includes("request") ? <Wrench className="w-3.5 h-3.5 text-warning" strokeWidth={2} /> :
                     act.type.includes("message") ? <MessageCircle className="w-3.5 h-3.5 text-brand" strokeWidth={2} /> :
                     act.type.includes("expense") ? <DollarSign className="w-3.5 h-3.5 text-accent" strokeWidth={2} /> :
                     act.type.includes("tenant") ? <UserPlus className="w-3.5 h-3.5 text-success" strokeWidth={2} /> :
                     <Building2 className="w-3.5 h-3.5 text-brand" strokeWidth={2} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-charcoal truncate">{act.title}</p>
                    <p className="text-xs text-charcoal-tertiary truncate">{act.subtitle}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-charcoal-tertiary">
                      {(() => {
                        const diff = Date.now() - new Date(act.created_at).getTime();
                        const mins = Math.floor(diff / 60000);
                        if (mins < 1) return "Just now";
                        if (mins < 60) return `${mins}m ago`;
                        const hrs = Math.floor(mins / 60);
                        if (hrs < 24) return `${hrs}h ago`;
                        return `${Math.floor(hrs / 24)}d ago`;
                      })()}
                    </span>
                    {route && <ChevronRight className="w-4 h-4 text-charcoal-tertiary" />}
                  </div>
                </>
              );

              return route ? (
                <Link key={act.id} href={route}
                  className="flex items-center gap-3 bg-surface rounded-xl border border-warm-300/50 px-4 py-3 hover:border-brand/30 hover:shadow-sm transition-all cursor-pointer">
                  {activityContent}
                </Link>
              ) : (
                <div key={act.id} className="flex items-center gap-3 bg-surface rounded-xl border border-warm-300/50 px-4 py-3">
                  {activityContent}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ============ MODALS ============ */}

      {/* Add Property Modal */}
      {showAddProperty && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-charcoal">Add property</h3>
              <button onClick={() => { setShowAddProperty(false); setSaveError(""); }} className="p-1 text-charcoal-tertiary hover:text-charcoal"><X className="w-5 h-5" /></button>
            </div>
            {saveError && <div className="mb-4 px-4 py-3 rounded-xl bg-danger-light text-danger text-sm font-medium">{saveError}</div>}
            <form onSubmit={handleAddProperty} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Property name</label>
                <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                  <Building2 className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                  <input type="text" placeholder="e.g. Oak Street Duplex" value={newPropName} onChange={(e) => setNewPropName(e.target.value)} required
                    className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" autoFocus />
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Address (optional)</label>
                <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                  <MapPin className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                  <input type="text" placeholder="123 Main St, City, State" value={newPropAddress} onChange={(e) => setNewPropAddress(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" />
                </div>
              </div>
              <button type="submit" disabled={saving || !newPropName.trim()} className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
                {saving ? "Adding..." : "Add property"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Unit Modal */}
      {showAddUnit && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-charcoal">Add unit</h3>
              <button onClick={() => { setShowAddUnit(false); setSaveError(""); }} className="p-1 text-charcoal-tertiary hover:text-charcoal"><X className="w-5 h-5" /></button>
            </div>
            {saveError && <div className="mb-4 px-4 py-3 rounded-xl bg-danger-light text-danger text-sm font-medium">{saveError}</div>}
            <form onSubmit={handleAddUnit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Property *</label>
                <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white">
                  <Building2 className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                  <select value={unitPropertyId} onChange={(e) => setUnitPropertyId(e.target.value)} required className="flex-1 bg-transparent text-sm text-charcoal outline-none">
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Unit label *</label>
                <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                  <Home className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                  <input type="text" placeholder="e.g. Unit A, Apt 1" value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} required
                    className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" autoFocus />
                </div>
              </div>
              <div className="flex items-center gap-3">
                <input type="checkbox" id="unit-occ" checked={unitOccupied} onChange={(e) => setUnitOccupied(e.target.checked)} className="w-4 h-4 rounded border-warm-300 text-brand focus:ring-brand" />
                <label htmlFor="unit-occ" className="text-sm text-charcoal">Unit is currently occupied</label>
              </div>
              {unitOccupied && (
                <>
                  <div><label className="text-sm font-medium text-charcoal mb-2 block">Tenant name</label><div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors"><User className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} /><input type="text" placeholder="Full name" value={unitTenantName} onChange={(e) => setUnitTenantName(e.target.value)} className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" /></div></div>
                  <div><label className="text-sm font-medium text-charcoal mb-2 block">Tenant email</label><div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors"><Mail className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} /><input type="email" placeholder="tenant@email.com" value={unitTenantEmail} onChange={(e) => setUnitTenantEmail(e.target.value)} className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" /></div></div>
                  <div><label className="text-sm font-medium text-charcoal mb-2 block">Tenant phone</label><div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors"><Phone className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} /><input type="tel" placeholder="(555) 123-4567" value={unitTenantPhone} onChange={(e) => setUnitTenantPhone(e.target.value)} className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" /></div></div>
                  <div><label className="text-sm font-medium text-charcoal mb-2 block">Move-in date</label><div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors"><Calendar className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} /><input type="date" value={unitMoveIn} onChange={(e) => setUnitMoveIn(e.target.value)} className="flex-1 bg-transparent text-sm text-charcoal outline-none" /></div></div>
                  <div><label className="text-sm font-medium text-charcoal mb-2 block">Lease end date</label><div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors"><Calendar className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} /><input type="date" value={unitLeaseEnd} onChange={(e) => setUnitLeaseEnd(e.target.value)} className="flex-1 bg-transparent text-sm text-charcoal outline-none" /></div></div>
                </>
              )}
              <button type="submit" disabled={saving || !unitLabel.trim()} className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
                {saving ? "Adding..." : "Add unit"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* New Request Modal */}
      {showNewRequest && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-charcoal">New request</h3>
              <button onClick={() => { setShowNewRequest(false); setSaveError(""); }} className="p-1 text-charcoal-tertiary hover:text-charcoal"><X className="w-5 h-5" /></button>
            </div>
            {saveError && <div className="mb-4 px-4 py-3 rounded-xl bg-danger-light text-danger text-sm font-medium">{saveError}</div>}
            <form onSubmit={handleNewRequest} className="space-y-4">
              <div><label className="text-sm font-medium text-charcoal mb-2 block">Property *</label><select value={reqPropertyId} onChange={(e) => { setReqPropertyId(e.target.value); setReqUnitId(""); }} required className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors">{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
              <div><label className="text-sm font-medium text-charcoal mb-2 block">Unit *</label><select value={reqUnitId} onChange={(e) => setReqUnitId(e.target.value)} required className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors"><option value="">Select a unit</option>{filteredReqUnits.map((u) => <option key={u.id} value={u.id}>{u.label}{u.tenant_name ? ` — ${u.tenant_name}` : ""}</option>)}</select></div>
              <div><label className="text-sm font-medium text-charcoal mb-2 block">Category</label><div className="flex flex-wrap gap-2">{REQUEST_CATEGORIES.map((cat) => (<button key={cat.key} type="button" onClick={() => setReqCategory(cat.key)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${reqCategory === cat.key ? "bg-brand text-white" : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"}`}>{cat.label}</button>))}</div></div>
              <div><label className="text-sm font-medium text-charcoal mb-2 block">Description *</label><textarea value={reqDescription} onChange={(e) => setReqDescription(e.target.value)} placeholder="Describe the issue..." rows={3} required className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white resize-none outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" /></div>
              <div><label className="text-sm font-medium text-charcoal mb-2 block">Requested date (optional)</label><input type="date" value={reqDate} onChange={(e) => setReqDate(e.target.value)} className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors" /></div>
              <button type="submit" disabled={saving || !reqDescription.trim() || !reqUnitId} className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">{saving ? "Creating..." : "Create request"}</button>
            </form>
          </div>
        </div>
      )}

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-charcoal">Add expense</h3>
              <button onClick={() => { setShowAddExpense(false); setSaveError(""); }} className="p-1 text-charcoal-tertiary hover:text-charcoal"><X className="w-5 h-5" /></button>
            </div>
            {saveError && <div className="mb-4 px-4 py-3 rounded-xl bg-danger-light text-danger text-sm font-medium">{saveError}</div>}
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div><label className="text-sm font-medium text-charcoal mb-2 block">Property *</label><div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white"><Building2 className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} /><select value={expPropertyId} onChange={(e) => setExpPropertyId(e.target.value)} required className="flex-1 bg-transparent text-sm text-charcoal outline-none">{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></div></div>
              <div><label className="text-sm font-medium text-charcoal mb-2 block">Description *</label><input type="text" placeholder="e.g. Replaced kitchen faucet" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} required className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="text-sm font-medium text-charcoal mb-2 block">Amount *</label><div className="flex items-center gap-2 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors"><DollarSign className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} /><input type="number" step="0.01" min="0" placeholder="0.00" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} required className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" /></div></div>
                <div><label className="text-sm font-medium text-charcoal mb-2 block">Date *</label><input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} required className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors" /></div>
              </div>
              <div><label className="text-sm font-medium text-charcoal mb-2 block">Category</label><div className="flex flex-wrap gap-2">{EXPENSE_CATEGORIES.map((cat) => (<button key={cat.key} type="button" onClick={() => setExpCategory(cat.key)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${expCategory === cat.key ? "bg-brand text-white" : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"}`}>{cat.label}</button>))}</div></div>
              <div><label className="text-sm font-medium text-charcoal mb-2 block">Vendor (optional)</label><input type="text" placeholder="e.g. Home Depot" value={expVendor} onChange={(e) => setExpVendor(e.target.value)} className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" /></div>
              <button type="submit" disabled={saving || !expDesc.trim() || !expAmount} className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">{saving ? "Saving..." : "Add expense"}</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
