"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { Property, Unit, MaintenanceRequest, Tenant } from "@/lib/types";
import Link from "next/link";
import { canAddUnit, getEffectivePlan } from "@/lib/plans";
import { useDashboard } from "../../layout";
import {
  Building2, Home, User, Wrench, Mail, Phone, ChevronLeft,
  Copy, Check, Send, UserPlus, Plus, X, Calendar, Pencil, Trash2,
} from "lucide-react";

type EditableUnitField = "label" | "tenant_name" | "tenant_email" | "tenant_phone" | "lease_end_date";
type EditableTenantField = "name" | "email" | "phone" | "move_in_date" | "lease_start" | "lease_end";
type EditablePropertyField = "name" | "address";

export default function PropertyDetailPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();
  const { profile, showUpgradeModal, adminSimulatedPlan } = useDashboard();
  const plan = getEffectivePlan(profile?.plan || "starter", profile?.email, adminSimulatedPlan);

  const [property, setProperty] = useState<Property | null>(null);
  const [units, setUnits] = useState<Unit[]>([]);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Inline editing for unit fields (legacy single-tenant)
  const [editingUnit, setEditingUnit] = useState<string | null>(null);
  const [editingUnitField, setEditingUnitField] = useState<EditableUnitField | null>(null);
  const [editValue, setEditValue] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Inline editing for tenant records
  const [editingTenant, setEditingTenant] = useState<string | null>(null);
  const [editingTenantField, setEditingTenantField] = useState<EditableTenantField | null>(null);
  const [editTenantValue, setEditTenantValue] = useState("");

  // Add tenant inline
  const [addingTenantUnitId, setAddingTenantUnitId] = useState<string | null>(null);
  const [newTenantName, setNewTenantName] = useState("");
  const [newTenantEmail, setNewTenantEmail] = useState("");
  const [newTenantPhone, setNewTenantPhone] = useState("");

  // Inline editing for property fields
  const [editingPropertyField, setEditingPropertyField] = useState<EditablePropertyField | null>(null);
  const [editPropertyValue, setEditPropertyValue] = useState("");
  const [savingProperty, setSavingProperty] = useState(false);

  // Add unit modal
  const [showAddUnit, setShowAddUnit] = useState(false);
  const [unitLabel, setUnitLabel] = useState("");
  const [tenantName, setTenantName] = useState("");
  const [tenantEmail, setTenantEmail] = useState("");
  const [tenantPhone, setTenantPhone] = useState("");
  const [moveInDate, setMoveInDate] = useState("");
  const [leaseEndDate, setLeaseEndDate] = useState("");
  const [isOccupied, setIsOccupied] = useState(false);
  const [savingUnit, setSavingUnit] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchData = useCallback(async () => {
    const [propRes, unitRes, reqRes] = await Promise.all([
      supabase.from("properties").select("*").eq("id", id).single(),
      supabase.from("units").select("*").eq("property_id", id).order("label"),
      supabase.from("maintenance_requests").select("*").eq("property_id", id).order("created_at", { ascending: false }),
    ]);
    // Fetch active tenants
    const tenantRes = await supabase.from("tenants").select("*").eq("property_id", id).eq("is_active", true).order("created_at");

    if (propRes.data) setProperty(propRes.data as Property);
    setUnits((unitRes.data || []) as Unit[]);
    setRequests((reqRes.data || []) as MaintenanceRequest[]);
    setTenants((tenantRes.data || []) as Tenant[]);
    setLoading(false);
  }, [supabase, id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // --- Unit field inline editing ---
  function startEditUnit(unitId: string, field: EditableUnitField, currentValue: string | null) {
    setEditingUnit(unitId);
    setEditingUnitField(field);
    // For lease_end_date, pass the raw date value for the input
    if (field === "lease_end_date") {
      const unit = units.find(u => u.id === unitId);
      setEditValue(unit?.lease_end_date || "");
    } else {
      setEditValue(currentValue || "");
    }
  }

  async function saveUnitEdit() {
    if (!editingUnit || !editingUnitField) return;
    setSavingEdit(true);
    const value = editingUnitField === "lease_end_date" ? (editValue || null) : editValue.trim();
    await supabase.from("units").update({ [editingUnitField]: value }).eq("id", editingUnit);
    setEditingUnit(null); setEditingUnitField(null); setEditValue(""); setSavingEdit(false);
    fetchData();
  }

  function cancelUnitEdit() {
    setEditingUnit(null); setEditingUnitField(null); setEditValue("");
  }

  // --- Tenant inline editing ---
  function startEditTenant(tenantId: string, field: EditableTenantField, currentValue: string | null) {
    setEditingTenant(tenantId);
    setEditingTenantField(field);
    setEditTenantValue(currentValue || "");
  }

  async function saveTenantEdit() {
    if (!editingTenant || !editingTenantField) return;
    setSavingEdit(true);
    const isDateField = ["move_in_date", "lease_start", "lease_end"].includes(editingTenantField);
    const value = isDateField ? (editTenantValue || null) : editTenantValue.trim();
    await supabase.from("tenants").update({ [editingTenantField]: value }).eq("id", editingTenant);
    setEditingTenant(null); setEditingTenantField(null); setEditTenantValue(""); setSavingEdit(false);
    fetchData();
  }

  function cancelTenantEdit() {
    setEditingTenant(null); setEditingTenantField(null); setEditTenantValue("");
  }

  // --- Property field inline editing ---
  function startEditProperty(field: EditablePropertyField) {
    if (!property) return;
    setEditingPropertyField(field);
    setEditPropertyValue(property[field] || "");
  }

  async function savePropertyEdit() {
    if (!editingPropertyField || !property) return;
    const value = editPropertyValue.trim();
    if (editingPropertyField === "name" && !value) return; // name is required
    setSavingProperty(true);
    await supabase.from("properties").update({ [editingPropertyField]: value }).eq("id", property.id);
    setEditingPropertyField(null);
    setEditPropertyValue("");
    setSavingProperty(false);
    fetchData();
  }

  function cancelPropertyEdit() {
    setEditingPropertyField(null);
    setEditPropertyValue("");
  }

  // --- Add tenant ---
  async function handleAddTenant(unitId: string) {
    if (!newTenantName.trim() || !property) return;
    setSavingEdit(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingEdit(false); return; }

    const activeTenants = tenants.filter(t => t.unit_id === unitId);

    await supabase.from("tenants").insert({
      unit_id: unitId,
      property_id: property.id,
      name: newTenantName.trim(),
      email: newTenantEmail.trim() || null,
      phone: newTenantPhone.trim() || null,
      is_active: true,
    });

    // Update unit to occupied and sync tenant info
    if (activeTenants.length === 0) {
      await supabase.from("units").update({
        is_occupied: true,
        tenant_name: newTenantName.trim(),
        tenant_email: newTenantEmail.trim(),
        tenant_phone: newTenantPhone.trim(),
      }).eq("id", unitId);
    }

    setAddingTenantUnitId(null); setNewTenantName(""); setNewTenantEmail(""); setNewTenantPhone("");
    setSavingEdit(false);
    fetchData();
  }

  async function handleMoveTenantOut(tenantId: string, unitId: string) {
    if (!confirm("Move this tenant out? Their record will be preserved in history.")) return;
    await supabase.from("tenants").update({
      is_active: false, move_out_date: new Date().toISOString().split("T")[0],
    }).eq("id", tenantId);

    // Check remaining active tenants
    const remaining = tenants.filter(t => t.unit_id === unitId && t.id !== tenantId);
    if (remaining.length === 0) {
      await supabase.from("units").update({
        is_occupied: false, tenant_name: "", tenant_email: "", tenant_phone: "",
      }).eq("id", unitId);
    } else {
      // Sync first remaining tenant to unit
      const next = remaining[0];
      await supabase.from("units").update({
        tenant_name: next.name, tenant_email: next.email || "", tenant_phone: next.phone || "",
      }).eq("id", unitId);
    }

    fetchData();
  }

  async function handleAddUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitLabel.trim() || !property) return;
    setSavingUnit(true); setSaveError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSavingUnit(false); setSaveError("You must be logged in."); return; }

    const { data: unitData, error } = await supabase.from("units").insert({
      property_id: property.id, owner_id: user.id, label: unitLabel.trim(),
      tenant_name: tenantName.trim(), tenant_email: tenantEmail.trim(), tenant_phone: tenantPhone.trim(),
      move_in_date: moveInDate, lease_end_date: leaseEndDate || null, is_occupied: isOccupied,
    }).select("id").single();

    if (error) { setSavingUnit(false); setSaveError(error.message || "Failed to add unit."); return; }

    await supabase.from("properties").update({ unit_count: units.length + 1 }).eq("id", property.id);
    await supabase.from("activities").insert({
      owner_id: user.id, type: "unit_added", title: "Unit added",
      subtitle: `${unitLabel.trim()} at ${property.name}`,
      related_id: unitData?.id || null, related_property_id: property.id,
    });

    // If occupied, also create a tenant record
    if (isOccupied && tenantName.trim() && unitData?.id) {
      await supabase.from("tenants").insert({
        unit_id: unitData.id, property_id: property.id,
        name: tenantName.trim(), email: tenantEmail.trim() || null, phone: tenantPhone.trim() || null,
        move_in_date: moveInDate || null, lease_end: leaseEndDate || null, is_active: true,
      });
    }

    setUnitLabel(""); setTenantName(""); setTenantEmail(""); setTenantPhone("");
    setMoveInDate(""); setLeaseEndDate(""); setIsOccupied(false); setShowAddUnit(false);
    setSavingUnit(false); setSaveError(""); fetchData();
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

  // Render inline editable field for UNIT
  function renderUnitField(unit: Unit, field: EditableUnitField, icon: React.ReactNode, displayValue: string | null, inputType = "text", placeholder = "") {
    const isEditing = editingUnit === unit.id && editingUnitField === field;
    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          {icon}
          <input type={inputType} value={editValue} onChange={(e) => setEditValue(e.target.value)}
            placeholder={placeholder} autoFocus
            className="flex-1 bg-transparent text-sm text-charcoal outline-none border-b border-brand min-w-0"
            onKeyDown={(e) => { if (e.key === "Enter") saveUnitEdit(); if (e.key === "Escape") cancelUnitEdit(); }} />
          <button onClick={saveUnitEdit} disabled={savingEdit} className="text-brand hover:text-brand-dark"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={cancelUnitEdit} className="text-charcoal-tertiary hover:text-charcoal"><X className="w-3.5 h-3.5" /></button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-charcoal-secondary">
        {icon}
        <span className="flex-1 min-w-0 truncate">{displayValue || <span className="text-charcoal-tertiary italic text-xs">Not set</span>}</span>
        <button onClick={() => startEditUnit(unit.id, field, displayValue)}
          className="text-charcoal-tertiary hover:text-brand transition-colors opacity-60 hover:opacity-100">
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Render inline editable field for TENANT
  function renderTenantField(tenant: Tenant, field: EditableTenantField, icon: React.ReactNode, displayValue: string | null, inputType = "text", placeholder = "") {
    const isEditing = editingTenant === tenant.id && editingTenantField === field;
    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          {icon}
          <input type={inputType} value={editTenantValue} onChange={(e) => setEditTenantValue(e.target.value)}
            placeholder={placeholder} autoFocus
            className="flex-1 bg-transparent text-sm text-charcoal outline-none border-b border-brand min-w-0"
            onKeyDown={(e) => { if (e.key === "Enter") saveTenantEdit(); if (e.key === "Escape") cancelTenantEdit(); }} />
          <button onClick={saveTenantEdit} disabled={savingEdit} className="text-brand hover:text-brand-dark"><Check className="w-3.5 h-3.5" /></button>
          <button onClick={cancelTenantEdit} className="text-charcoal-tertiary hover:text-charcoal"><X className="w-3.5 h-3.5" /></button>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-sm text-charcoal-secondary">
        {icon}
        <span className="flex-1 min-w-0 truncate">{displayValue || <span className="text-charcoal-tertiary italic text-xs">Not set</span>}</span>
        <button onClick={() => startEditTenant(tenant.id, field, displayValue)}
          className="text-charcoal-tertiary hover:text-brand transition-colors opacity-60 hover:opacity-100">
          <Pencil className="w-3 h-3" />
        </button>
      </div>
    );
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
        <div className="flex-1 min-w-0">
          {editingPropertyField === "name" ? (
            <div className="flex items-center gap-2">
              <input type="text" value={editPropertyValue} onChange={(e) => setEditPropertyValue(e.target.value)}
                placeholder="Property name" autoFocus
                className="text-2xl font-bold text-charcoal bg-transparent outline-none border-b-2 border-brand w-full"
                style={{ fontFamily: "var(--font-display)" }}
                onKeyDown={(e) => { if (e.key === "Enter") savePropertyEdit(); if (e.key === "Escape") cancelPropertyEdit(); }} />
              <button onClick={savePropertyEdit} disabled={savingProperty || !editPropertyValue.trim()} className="text-brand hover:text-brand-dark"><Check className="w-5 h-5" /></button>
              <button onClick={cancelPropertyEdit} className="text-charcoal-tertiary hover:text-charcoal"><X className="w-5 h-5" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group">
              <h1 className="text-2xl font-bold text-charcoal" style={{ fontFamily: "var(--font-display)" }}>{property.name}</h1>
              <button onClick={() => startEditProperty("name")}
                className="text-charcoal-tertiary hover:text-brand transition-colors opacity-0 group-hover:opacity-100">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          )}
          {editingPropertyField === "address" ? (
            <div className="flex items-center gap-2 mt-1">
              <input type="text" value={editPropertyValue} onChange={(e) => setEditPropertyValue(e.target.value)}
                placeholder="Property address" autoFocus
                className="text-sm text-charcoal-secondary bg-transparent outline-none border-b border-brand flex-1"
                onKeyDown={(e) => { if (e.key === "Enter") savePropertyEdit(); if (e.key === "Escape") cancelPropertyEdit(); }} />
              <button onClick={savePropertyEdit} disabled={savingProperty} className="text-brand hover:text-brand-dark"><Check className="w-4 h-4" /></button>
              <button onClick={cancelPropertyEdit} className="text-charcoal-tertiary hover:text-charcoal"><X className="w-4 h-4" /></button>
            </div>
          ) : (
            <div className="flex items-center gap-2 group mt-0.5">
              <p className="text-sm text-charcoal-secondary">{property.address || <span className="italic text-charcoal-tertiary">No address</span>} · {units.length} unit{units.length !== 1 ? "s" : ""} · {openRequests.length} open</p>
              <button onClick={() => startEditProperty("address")}
                className="text-charcoal-tertiary hover:text-brand transition-colors opacity-0 group-hover:opacity-100">
                <Pencil className="w-3 h-3" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Units */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-charcoal">Units</h2>
        <button onClick={() => { if (!canAddUnit(plan, units.length)) { showUpgradeModal("units"); return; } setShowAddUnit(true); }}
          className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark transition-colors">
          <Plus className="w-4 h-4" />Add unit
        </button>
      </div>

      {units.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-warm-300/50 p-8 text-center mb-8">
          <Home className="w-8 h-8 text-charcoal-tertiary mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-charcoal-secondary mb-3">No units added yet.</p>
          <button onClick={() => { if (!canAddUnit(plan, units.length)) { showUpgradeModal("units"); return; } setShowAddUnit(true); }}
            className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors">
            <Plus className="w-4 h-4" />Add first unit
          </button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {units.map((unit) => {
            const unitRequests = openRequests.filter((r) => r.unit_id === unit.id);
            const unitTenants = tenants.filter((t) => t.unit_id === unit.id);
            const hasTenantsTable = unitTenants.length > 0;

            return (
              <div key={unit.id} className="bg-surface rounded-2xl border border-warm-300/50 p-5">
                {/* Unit header */}
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${unit.is_occupied ? "bg-brand-faint" : "bg-warm-100"}`}>
                      <Home className={`w-5 h-5 ${unit.is_occupied ? "text-brand" : "text-charcoal-tertiary"}`} strokeWidth={1.8} />
                    </div>
                    <div>
                      {editingUnit === unit.id && editingUnitField === "label" ? (
                        <div className="flex items-center gap-2">
                          <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)}
                            placeholder="Unit label" autoFocus
                            className="font-semibold text-charcoal bg-transparent outline-none border-b border-brand min-w-0 w-32"
                            onKeyDown={(e) => { if (e.key === "Enter") saveUnitEdit(); if (e.key === "Escape") cancelUnitEdit(); }} />
                          <button onClick={saveUnitEdit} disabled={savingEdit} className="text-brand hover:text-brand-dark"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={cancelUnitEdit} className="text-charcoal-tertiary hover:text-charcoal"><X className="w-3.5 h-3.5" /></button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 group">
                          <p className="font-semibold text-charcoal">{unit.label}</p>
                          <button onClick={() => startEditUnit(unit.id, "label", unit.label)}
                            className="text-charcoal-tertiary hover:text-brand transition-colors opacity-0 group-hover:opacity-60 hover:!opacity-100">
                            <Pencil className="w-3 h-3" />
                          </button>
                        </div>
                      )}
                      <p className="text-xs text-charcoal-tertiary">{unit.is_occupied ? "Occupied" : "Vacant"}</p>
                    </div>
                  </div>
                  {unitRequests.length > 0 && <span className="text-xs font-semibold px-2 py-1 rounded-lg status-open">{unitRequests.length} open</span>}
                </div>

                {/* Tenants related list */}
                {hasTenantsTable ? (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-charcoal-tertiary uppercase tracking-wider">Tenants ({unitTenants.length})</p>
                      <button onClick={() => { setAddingTenantUnitId(unit.id); setNewTenantName(""); setNewTenantEmail(""); setNewTenantPhone(""); }}
                        className="text-xs font-medium text-brand hover:text-brand-dark transition-colors flex items-center gap-0.5">
                        <Plus className="w-3 h-3" />Add
                      </button>
                    </div>
                    <div className="space-y-2">
                      {unitTenants.map((t) => (
                        <div key={t.id} className="bg-warm-white rounded-xl px-3 py-2.5 border border-warm-300/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-[10px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded">ACTIVE</span>
                            <button onClick={() => handleMoveTenantOut(t.id, unit.id)}
                              className="text-xs font-medium text-charcoal-tertiary hover:text-danger transition-colors opacity-60 hover:opacity-100 flex items-center gap-0.5">
                              <Trash2 className="w-3 h-3" />Move out
                            </button>
                          </div>
                          <div className="space-y-1">
                            {renderTenantField(t, "name", <User className="w-3 h-3 text-charcoal-tertiary shrink-0" />, t.name, "text", "Tenant name")}
                            {renderTenantField(t, "email", <Mail className="w-3 h-3 text-charcoal-tertiary shrink-0" />, t.email, "email", "tenant@email.com")}
                            {renderTenantField(t, "phone", <Phone className="w-3 h-3 text-charcoal-tertiary shrink-0" />, t.phone, "tel", "(555) 123-4567")}
                            {renderTenantField(t, "lease_end", <Calendar className="w-3 h-3 text-charcoal-tertiary shrink-0" />,
                              t.lease_end ? new Date(t.lease_end + "T12:00:00").toLocaleDateString() : null, "date", "")}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Inline add tenant form */}
                    {addingTenantUnitId === unit.id && (
                      <div className="mt-2 bg-warm-white rounded-xl px-3 py-3 border border-brand/30 space-y-2">
                        <input type="text" placeholder="Tenant name *" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} autoFocus
                          className="w-full bg-transparent text-sm text-charcoal outline-none border-b border-warm-300 pb-1 placeholder:text-charcoal-tertiary"
                          onKeyDown={(e) => { if (e.key === "Enter" && newTenantName.trim()) handleAddTenant(unit.id); if (e.key === "Escape") setAddingTenantUnitId(null); }} />
                        <input type="email" placeholder="Email" value={newTenantEmail} onChange={(e) => setNewTenantEmail(e.target.value)}
                          className="w-full bg-transparent text-sm text-charcoal outline-none border-b border-warm-300 pb-1 placeholder:text-charcoal-tertiary" />
                        <input type="tel" placeholder="Phone" value={newTenantPhone} onChange={(e) => setNewTenantPhone(e.target.value)}
                          className="w-full bg-transparent text-sm text-charcoal outline-none border-b border-warm-300 pb-1 placeholder:text-charcoal-tertiary" />
                        <div className="flex items-center gap-2 pt-1">
                          <button onClick={() => handleAddTenant(unit.id)} disabled={!newTenantName.trim() || savingEdit}
                            className="text-xs font-medium bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-60">
                            {savingEdit ? "Adding..." : "Add"}
                          </button>
                          <button onClick={() => setAddingTenantUnitId(null)} className="text-xs font-medium text-charcoal-tertiary hover:text-charcoal">Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                ) : unit.is_occupied ? (
                  /* Legacy single-tenant fields (no tenants table records) */
                  <div className="space-y-1.5 mb-4">
                    {renderUnitField(unit, "tenant_name", <User className="w-3.5 h-3.5 text-charcoal-tertiary shrink-0" />, unit.tenant_name, "text", "Tenant name")}
                    {renderUnitField(unit, "tenant_email", <Mail className="w-3.5 h-3.5 text-charcoal-tertiary shrink-0" />, unit.tenant_email, "email", "tenant@email.com")}
                    {renderUnitField(unit, "tenant_phone", <Phone className="w-3.5 h-3.5 text-charcoal-tertiary shrink-0" />, unit.tenant_phone, "tel", "(555) 123-4567")}
                    {renderUnitField(unit, "lease_end_date", <Calendar className="w-3.5 h-3.5 text-charcoal-tertiary shrink-0" />,
                      unit.lease_end_date ? new Date(unit.lease_end_date + "T12:00:00").toLocaleDateString() : null, "date", "")}

                    {/* Upgrade to tenants table */}
                    <button onClick={() => { setAddingTenantUnitId(unit.id); setNewTenantName(unit.tenant_name || ""); setNewTenantEmail(unit.tenant_email || ""); setNewTenantPhone(unit.tenant_phone || ""); }}
                      className="text-xs font-medium text-brand hover:text-brand-dark transition-colors flex items-center gap-1 mt-2">
                      <Plus className="w-3 h-3" />Add another tenant
                    </button>
                  </div>
                ) : (
                  /* Vacant unit — option to add tenant */
                  <div className="mb-4">
                    {addingTenantUnitId === unit.id ? (
                      <div className="bg-warm-white rounded-xl px-3 py-3 border border-brand/30 space-y-2">
                        <input type="text" placeholder="Tenant name *" value={newTenantName} onChange={(e) => setNewTenantName(e.target.value)} autoFocus
                          className="w-full bg-transparent text-sm text-charcoal outline-none border-b border-warm-300 pb-1 placeholder:text-charcoal-tertiary"
                          onKeyDown={(e) => { if (e.key === "Enter" && newTenantName.trim()) handleAddTenant(unit.id); if (e.key === "Escape") setAddingTenantUnitId(null); }} />
                        <input type="email" placeholder="Email" value={newTenantEmail} onChange={(e) => setNewTenantEmail(e.target.value)}
                          className="w-full bg-transparent text-sm text-charcoal outline-none border-b border-warm-300 pb-1 placeholder:text-charcoal-tertiary" />
                        <input type="tel" placeholder="Phone" value={newTenantPhone} onChange={(e) => setNewTenantPhone(e.target.value)}
                          className="w-full bg-transparent text-sm text-charcoal outline-none border-b border-warm-300 pb-1 placeholder:text-charcoal-tertiary" />
                        <div className="flex items-center gap-2 pt-1">
                          <button onClick={() => handleAddTenant(unit.id)} disabled={!newTenantName.trim() || savingEdit}
                            className="text-xs font-medium bg-brand text-white px-3 py-1.5 rounded-lg hover:bg-brand-dark transition-colors disabled:opacity-60">
                            {savingEdit ? "Adding..." : "Add tenant"}
                          </button>
                          <button onClick={() => setAddingTenantUnitId(null)} className="text-xs font-medium text-charcoal-tertiary hover:text-charcoal">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <button onClick={() => { setAddingTenantUnitId(unit.id); setNewTenantName(""); setNewTenantEmail(""); setNewTenantPhone(""); }}
                        className="text-xs font-medium text-charcoal-secondary hover:text-brand transition-colors flex items-center gap-1">
                        <UserPlus className="w-3.5 h-3.5" />Add tenant
                      </button>
                    )}
                  </div>
                )}

                {/* Invite code section */}
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
            {saveError && <div className="mb-4 px-4 py-3 rounded-xl bg-danger-light text-danger text-sm font-medium">{saveError}</div>}
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
                <input type="checkbox" id="occupied" checked={isOccupied} onChange={(e) => setIsOccupied(e.target.checked)} className="w-4 h-4 rounded border-warm-300 text-brand focus:ring-brand" />
                <label htmlFor="occupied" className="text-sm text-charcoal">Unit is currently occupied</label>
              </div>
              {isOccupied && (
                <>
                  <div><label className="text-sm font-medium text-charcoal mb-2 block">Tenant name</label><div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors"><User className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} /><input type="text" placeholder="Full name" value={tenantName} onChange={(e) => setTenantName(e.target.value)} className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" /></div></div>
                  <div><label className="text-sm font-medium text-charcoal mb-2 block">Tenant email</label><div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors"><Mail className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} /><input type="email" placeholder="tenant@email.com" value={tenantEmail} onChange={(e) => setTenantEmail(e.target.value)} className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" /></div></div>
                  <div><label className="text-sm font-medium text-charcoal mb-2 block">Tenant phone</label><div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors"><Phone className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} /><input type="tel" placeholder="(555) 123-4567" value={tenantPhone} onChange={(e) => setTenantPhone(e.target.value)} className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" /></div></div>
                  <div><label className="text-sm font-medium text-charcoal mb-2 block">Move-in date</label><div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors"><Calendar className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} /><input type="date" value={moveInDate} onChange={(e) => setMoveInDate(e.target.value)} className="flex-1 bg-transparent text-sm text-charcoal outline-none" /></div></div>
                  <div><label className="text-sm font-medium text-charcoal mb-2 block">Lease end date</label><div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors"><Calendar className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} /><input type="date" value={leaseEndDate} onChange={(e) => setLeaseEndDate(e.target.value)} className="flex-1 bg-transparent text-sm text-charcoal outline-none" /></div></div>
                </>
              )}
              <button type="submit" disabled={savingUnit || !unitLabel.trim()} className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
                {savingUnit ? "Adding..." : "Add unit"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
