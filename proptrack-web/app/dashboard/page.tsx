"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Property, Unit, MaintenanceRequest, Activity } from "@/lib/types";
import { canAddProperty } from "@/lib/plans";
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
  Activity as ActivityIcon,
  MessageCircle,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const supabase = createClient();
  const { profile, showUpgradeModal } = useDashboard();

  const [properties, setProperties] = useState<Property[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  // Add property modal
  const [showAddProperty, setShowAddProperty] = useState(false);
  const [newPropName, setNewPropName] = useState("");
  const [newPropAddress, setNewPropAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { error } = await supabase.from("properties").insert({
      owner_id: user.id,
      name: newPropName.trim(),
      address: newPropAddress.trim(),
      unit_count: 0,
    });

    if (!error) {
      await supabase.from("activities").insert({
        owner_id: user.id,
        type: "property_added",
        title: "Property added",
        subtitle: newPropName.trim(),
      });
    }

    setNewPropName("");
    setNewPropAddress("");
    setShowAddProperty(false);
    setSaving(false);
    fetchData();
  }

  const openRequests = requests.filter((r) => r.status === "open");
  const inProgressRequests = requests.filter((r) => r.status === "in_progress");
  const occupiedUnits = units.filter((u) => u.is_occupied);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-3 border-brand/20 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

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

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { label: "Properties", value: properties.length, icon: Building2, color: "text-brand", bg: "bg-brand-faint" },
          { label: "Total units", value: units.length, icon: Home, color: "text-brand", bg: "bg-brand-faint" },
          { label: "Open requests", value: openRequests.length, icon: AlertTriangle, color: "text-danger", bg: "bg-danger-light" },
          { label: "Tenants", value: occupiedUnits.length, icon: Users, color: "text-accent", bg: "bg-accent-light" },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface rounded-2xl p-4 border border-warm-300/50">
            <div className={`w-9 h-9 rounded-xl ${stat.bg} flex items-center justify-center mb-3`}>
              <stat.icon className={`w-[18px] h-[18px] ${stat.color}`} strokeWidth={1.8} />
            </div>
            <p className="text-2xl font-bold text-charcoal">{stat.value}</p>
            <p className="text-xs text-charcoal-tertiary font-medium mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Properties list */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-charcoal">Your properties</h2>
          <button
            onClick={() => {
              const plan = profile?.plan || "starter";
              if (!canAddProperty(plan, properties.length)) {
                showUpgradeModal("properties");
                return;
              }
              setShowAddProperty(true);
            }}
            className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add property
          </button>
        </div>

        {properties.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-warm-300/50 p-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-faint flex items-center justify-center mx-auto mb-4">
              <Building2 className="w-6 h-6 text-brand" strokeWidth={1.6} />
            </div>
            <p className="font-medium text-charcoal mb-1">No properties yet</p>
            <p className="text-sm text-charcoal-secondary mb-4">
              Add your first property to start tracking maintenance.
            </p>
            <button
              onClick={() => {
                const plan = profile?.plan || "starter";
                if (!canAddProperty(plan, properties.length)) {
                  showUpgradeModal("properties");
                  return;
                }
                setShowAddProperty(true);
              }}
              className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add property
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {properties.map((property) => {
              const propertyUnits = units.filter((u) => u.property_id === property.id);
              const propertyRequests = openRequests.filter((r) => r.property_id === property.id);
              const occupied = propertyUnits.filter((u) => u.is_occupied).length;

              return (
                <Link
                  key={property.id}
                  href={`/dashboard/property/${property.id}`}
                  className="flex items-center justify-between bg-surface rounded-2xl border border-warm-300/50 p-5 hover:border-brand/30 hover:shadow-sm transition-all group"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-brand-faint flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-brand" strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="font-semibold text-charcoal group-hover:text-brand transition-colors">{property.name}</p>
                      <p className="text-sm text-charcoal-secondary">{property.address || "No address"}</p>
                      <div className="flex items-center gap-4 mt-1.5">
                        <span className="text-xs text-charcoal-tertiary flex items-center gap-1">
                          <Home className="w-3 h-3" />{propertyUnits.length} unit{propertyUnits.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-xs text-charcoal-tertiary flex items-center gap-1">
                          <Users className="w-3 h-3" />{occupied} occupied
                        </span>
                        {propertyRequests.length > 0 && (
                          <span className="text-xs text-danger font-medium flex items-center gap-1">
                            <Wrench className="w-3 h-3" />{propertyRequests.length} open
                          </span>
                        )}
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

      {/* Recent open requests */}
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
        <div>
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

      {activities.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-charcoal mb-4">Recent activity</h2>
          <div className="space-y-2">
            {activities.map((act) => (
              <div key={act.id} className="flex items-center gap-3 bg-surface rounded-xl border border-warm-300/50 px-4 py-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
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
                <span className="text-xs text-charcoal-tertiary shrink-0">
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
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Property Modal */}
      {showAddProperty && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-charcoal">Add property</h3>
              <button onClick={() => setShowAddProperty(false)} className="p-1 text-charcoal-tertiary hover:text-charcoal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddProperty} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Property name</label>
                <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                  <Building2 className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                  <input
                    type="text"
                    placeholder="e.g. Oak Street Duplex"
                    value={newPropName}
                    onChange={(e) => setNewPropName(e.target.value)}
                    required
                    className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary"
                    autoFocus
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Address (optional)</label>
                <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                  <MapPin className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                  <input
                    type="text"
                    placeholder="123 Main St, City, State"
                    value={newPropAddress}
                    onChange={(e) => setNewPropAddress(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saving || !newPropName.trim()}
                className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
              >
                {saving ? "Adding..." : "Add property"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
