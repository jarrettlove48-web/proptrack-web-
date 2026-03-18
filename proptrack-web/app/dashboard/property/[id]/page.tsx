"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Property, Unit, MaintenanceRequest } from "@/lib/types";
import Link from "next/link";
import { canAddUnit } from "@/lib/plans";
import { useDashboard } from "../../layout";
import {
  Building2, Home, User, Wrench, Mail, Phone, ChevronLeft,
  Copy, Check, Send, UserPlus, Plus, X, Calendar,
} from "lucide-react";

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const { profile, showUpgradeModal } = useDashboard();

  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Add unit modal
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [unitLabel, setUnitLabel] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [isOccupied, setIsOccupied] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchData = useCallback(async () => {
    const [propRes, unitRes, reqRes] = await Promise.all([
      supabase.from("properties").select("*").eq("id", id).single(),
      supabase.from("units").select("*").eq("property_id", id).order("label"),
      supabase.from("maintenance_requests").select("*").eq("property_id", id).order("created_at", { ascending: false }),
    ]);
    if (propRes.data) setProperty(propRes.data as Property);
    setUnits((unitRes.data || []) as Unit[]);
    setRequests((reqRes.data || []) as MaintenanceRequest[]);
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitLabel.trim() || !property) return;
    setSavingUnit(true);
    setSaveError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingUnit(false); setSaveError("You must be logged in."); return; }

    const { error } = await supabase.from("units").insert({
      property_id: property.id,
      owner_id: user.id,
      label: unitLabel.trim(),
      tenant_name: tenantName.trim(),
      tenant_email: tenantEmail.trim(),
      tenant_phone: tenantPhone.trim(),
      move_in_date: moveInDate,
      is_occupied: isOccupied,
    });

    if (error) {
      setSavingUnit(false);
      setSaveError(error.message || "Failed to add unit. Please try again.");
      return;
    }

    // Update property unit count
    await supabase.from("properties").update({ unit_count: units.length + 1 }).eq("id", property.id);
    await supabase.from("activities").insert({
      owner_id: user.id,
      type: "unit_added",
      title: "Unit added",
      subtitle: `${unitLabel.trim()} at ${property.name}`,
    });

    setUnitLabel(""); setTenantName(""); setTenantEmail(""); setTenantPhone("");
    setMoveInDate(""); setIsOccupied(false); setShowAddUnit(false);
    setSavingUnit(false);
    setSaveError("");
    fetchData();
  }

  async function generateInviteCode(unitId: string) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));

    await supabase.from("units").update({
      invite_code: code, is_invited: true, invited_at: new Date().toISOString(), tenant_portal_active: true,
    }).eq("id", unitId);
    fetchData();
  }

  function copyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }

  const openRequests = requests.filter((r) => r.status === "open");

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-3 border-brand/20 border-t-brand rounded-full animate-spin" /></div>;
  }

  if (!property) {
    return <div className="text-center py-20"><p className="text-charcoal-secondary">Property not found.</p><Link href="/dashboard" className="text-brand text-sm mt-2 inline-block">← Back to dashboard</Link></div>;
  }

  return (
    <div>
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-charcoal-secondary hover:text-charcoal mb-6 transition-colors">
        <ChevronLeft className="w-4 h-4" />Back to dashboard
      </Link>

      <div className="flex items-center gap-4 mb-8">
        <div className="w-12 h-12 rounded-xl bg-brand-faint flex items-center justify-center">
          <Building2 className="w-6 h-6 text-brand" strokeWidth={1.8} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-charcoal" style={{ fontFamily: "var(--font-display)" }}>{property.name}</h1>
          <p className="text-sm text-charcoal-secondary">{property.address || "No address"} · {units.length} unit{units.length !== 1 ? "s" : ""} · {openRequests.length} open</p>
        </div>
      </div>

      {/* Units */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-charcoal">Units</h2>
        <button onClick={() => { const plan = profile?.plan || "starter"; if (!canAddUnit(plan, units.length)) { showUpgradeModal("units"); return; } setShowAddUnit(true); }} className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark transition-colors">
          <Plus className="w-4 h-4" />Add unit
        </button>
      </div>

      {units.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-warm-300/50 p-8 text-center mb-8">
          <Home className="w-8 h-8 text-charcoal-tertiary mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-charcoal-secondary mb-3">No units added yet.</p>
          <button onClick={() => { const plan = profile?.plan || "starter"; if (!canAddUnit(plan, units.length)) { showUpgradeModal("units"); return; } setShowAddUnit(true); }} className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors">
            <Plus className="w-4 h-4" />Add first unit
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {units.map((unit) => {
            const unitRequests = openRequests.filter((r) => r.unit_id === unit.id);
            return (
              <div key={unit.id} className="bg-surface rounded-2xl border border-warm-300/50 p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${unit.is_occupied ? "bg-brand-faint" : "bg-warm-100"}`}>
                      <Home className={`w-5 h-5 ${unit.is_occupied ? "text-brand" : "text-charcoal-tertiary"}`} strokeWidth={1.8} />
                    </div>
                    <div>
                      <p className="font-semibold text-charcoal">{unit.label}</p>
                      <p className="text-xs text-charcoal-tertiary">{unit.is_occupied ? "Occupied" : "Vacant"}</p>
                    </div>
                  </div>
                  {unitRequests.length > 0 && <span className="text-xs font-semibold px-2 py-1 rounded-lg status-open">{unitRequests.length} open</span>}
                </div>

                {unit.is_occupied && (
                  <div className="space-y-1.5 mb-4">
                    {unit.tenant_name && <div className="flex items-center gap-2 text-sm text-charcoal-secondary"><User className="w-3.5 h-3.5 text-charcoal-tertiary" />{unit.tenant_name}</div>}
                    {unit.tenant_email && <div className="flex items-center gap-2 text-sm text-charcoal-secondary"><Mail className="w-3.5 h-3.5 text-charcoal-tertiary" />{unit.tenant_email}</div>}
                    {unit.tenant_phone && <div className="flex items-center gap-2 text-sm text-charcoal-secondary"><Phone className="w-3.5 h-3.5 text-charcoal-tertiary" />{unit.tenant_phone}</div>}
                  </div>
                )}

                <div className="border-t border-warm-300/40 pt-3 mt-3">
                  {unit.invite_code ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-charcoal-tertiary mb-1">Invite code</p>
                        <p className="text-lg font-bold tracking-widest text-brand">{unit.invite_code}</p>
                      </div>
                      <button onClick={() => copyCode(unit.invite_code!)} className="flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-dark transition-colors bg-brand-faint px-3 py-2 rounded-lg">
                        {copiedCode === unit.invite_code ? <><Check className="w-3.5 h-3.5" />Copied</> : <><Copy className="w-3.5 h-3.5" />Copy</>}
                      </button>
                    </div>
                  ) : unit.tenant_portal_active ? (
                    <div className="flex items-center gap-2 text-xs text-success font-medium"><Check className="w-3.5 h-3.5" />Tenant connected</div>
                  ) : (
                    <button onClick={() => generateInviteCode(unit.id)} className="flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-dark transition-colors">
                      <UserPlus className="w-4 h-4" />Generate invite code
                    </button>
                  )}
                  {unit.invite_code && unit.tenant_email && (
                    <a href={`mailto:${unit.tenant_email}?subject=Your PropTrack Invite Code&body=Hi ${unit.tenant_name || "there"},%0A%0AYour invite code is: ${unit.invite_code}%0A%0AVisit https://app.proptrack.app/invite to get started.`}
                      className="flex items-center gap-1.5 text-xs font-medium text-charcoal-secondary hover:text-brand mt-2 transition-colors">
                      <Send className="w-3.5 h-3.5" />Email code to tenant
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recent requests */}
      {requests.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-charcoal mb-4">Recent requests</h2>
          <div className="space-y-2">
            {requests.slice(0, 8).map((req) => (
              <div key={req.id} className="bg-surface rounded-xl border border-warm-300/50 px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg cat-${req.category}`}>{req.category}</span>
                  <div>
                    <p className="text-sm font-medium text-charcoal">{req.description.slice(0, 50)}{req.description.length > 50 ? "..." : ""}</p>
                    <p className="text-xs text-charcoal-tertiary mt-0.5">{req.unit_label} · {new Date(req.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg status-${req.status}`}>
                  {req.status === "in_progress" ? "In Progress" : req.status === "open" ? "Open" : "Resolved"}
                </span>
              </div>
            ))}
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

            {saveError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-danger-light text-danger text-sm font-medium">{saveError}</div>
            )}

            <form onSubmit={handleAddUnit} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Unit label *</label>
                <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                  <Home className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                  <input type="text" placeholder="e.g. Unit A, Apt 1, Basement" value={unitLabel} onChange={(e) => setUnitLabel(e.target.value)} required
                    className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" autoFocus />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <input type="checkbox" id="occupied" checked={isOccupied} onChange={(e) => setIsOccupied(e.target.checked)}
                  className="w-4 h-4 rounded border-warm-300 text-brand focus:ring-brand" />
                <label htmlFor="occupied" className="text-sm text-charcoal">Unit is currently occupied</label>
              </div>

              {isOccupied && (
                <>
                  <div>
                    <label className="text-sm font-medium text-charcoal mb-2 block">Tenant name</label>
                    <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                      <User className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                      <input type="text" placeholder="Full name" value={tenantName} onChange={(e) => setTenantName(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-charcoal mb-2 block">Tenant email</label>
                    <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                      <Mail className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                      <input type="email" placeholder="tenant@email.com" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-charcoal mb-2 block">Tenant phone</label>
                    <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                      <Phone className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                      <input type="tel" placeholder="(555) 123-4567" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-charcoal mb-2 block">Move-in date</label>
                    <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                      <Calendar className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                      <input type="date" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)}
                        className="flex-1 bg-transparent text-sm text-charcoal outline-none" />
                    </div>
                  </div>
                </>
              )}

              <button type="submit" disabled={savingUnit || !unitLabel.trim()}
                className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
                {savingUnit ? "Adding..." : "Add unit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
