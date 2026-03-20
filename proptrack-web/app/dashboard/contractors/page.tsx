"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Contractor, ContractorCategory } from "@/lib/types";
import { CONTRACTOR_CATEGORY_LABELS } from "@/lib/types";
import { canUseContractors, canAddContractor, getEffectivePlan } from "@/lib/plans";
import { HardHat, Plus, X, Phone, Mail, Globe, Copy, Check, Trash2, Pencil, UserCheck, Clock, Send } from "lucide-react";
import { useDashboard } from "../layout";

const CATEGORIES: { key: ContractorCategory; label: string }[] = [
  { key: "plumber", label: "Plumber" },
  { key: "electrician", label: "Electrician" },
  { key: "general_contractor", label: "General" },
  { key: "hvac_tech", label: "HVAC" },
  { key: "landscaper", label: "Landscaper" },
  { key: "painter", label: "Painter" },
  { key: "roofer", label: "Roofer" },
  { key: "other", label: "Other" },
];

export default function ContractorsPage() {
  const supabase = createClient();
  const { profile, showUpgradeModal, adminSimulatedPlan } = useDashboard();
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<ContractorCategory | "all">("all");

  // Add modal
  const [showAdd, setShowAdd] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [company, setCompany] = useState("");
  const [website, setWebsite] = useState("");
  const [category, setCategory] = useState<ContractorCategory>("plumber");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editFirstName, setEditFirstName] = useState("");
  const [editLastName, setEditLastName] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Copied invite code
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const plan = getEffectivePlan(profile?.plan || "starter", profile?.email, adminSimulatedPlan);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("contractors")
      .select("*")
      .eq("owner_id", user.id)
      .eq("is_active", true)
      .order("created_at", { ascending: false });
    setContractors((data || []) as Contractor[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    setSaveError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setSaveError("You must be logged in."); return; }

    if (!canAddContractor(plan, contractors.length)) {
      setSaving(false);
      setSaveError("You've reached your contractor limit. Upgrade to add more.");
      return;
    }

    const { data: cData, error } = await supabase.from("contractors").insert({
      owner_id: user.id,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      company: company.trim() || null,
      website: website.trim() || null,
      category,
      phone: phone.trim() || null,
      email: email.trim() || null,
      notes: notes.trim() || null,
    }).select("id").single();

    if (error) {
      setSaving(false);
      setSaveError(error.message || "Failed to add contractor.");
      return;
    }

    await supabase.from("activities").insert({
      owner_id: user.id,
      type: "contractor_added",
      title: "Contractor added",
      subtitle: `${firstName.trim()} ${lastName.trim()}${company.trim() ? ` — ${company.trim()}` : ""}`,
      related_id: cData?.id || null,
    });

    setFirstName(""); setLastName(""); setCompany(""); setWebsite("");
    setCategory("plumber"); setPhone(""); setEmail(""); setNotes("");
    setShowAdd(false); setSaving(false); setSaveError("");
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Remove this contractor?")) return;
    await supabase.from("contractors").update({ is_active: false }).eq("id", id);
    fetchData();
  }

  function startEdit(c: Contractor) {
    setEditingId(c.id);
    setEditFirstName(c.first_name);
    setEditLastName(c.last_name);
    setEditCompany(c.company || "");
    setEditPhone(c.phone || "");
    setEditEmail(c.email || "");
    setEditNotes(c.notes || "");
  }

  async function saveEdit(id: string) {
    await supabase.from("contractors").update({
      first_name: editFirstName.trim(),
      last_name: editLastName.trim(),
      company: editCompany.trim() || null,
      phone: editPhone.trim() || null,
      email: editEmail.trim() || null,
      notes: editNotes.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq("id", id);
    setEditingId(null);
    fetchData();
  }

  function getInviteUrl(code: string) {
    return `${window.location.origin}/contractor-invite?code=${code}`;
  }

  async function copyInviteCode(id: string, code: string) {
    await navigator.clipboard.writeText(getInviteUrl(code));
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function getInviteMailtoUrl(c: Contractor) {
    const inviteUrl = getInviteUrl(c.invite_code);
    const landlordName = profile?.name || "Your landlord";
    const subject = encodeURIComponent(`You're invited to PropTrack`);
    const body = encodeURIComponent(
      `Hi ${c.first_name},\n\n${landlordName} has added you as a preferred contractor on PropTrack. ` +
      `You can view and manage your assigned maintenance jobs through your own portal.\n\n` +
      `Click here to get started:\n${inviteUrl}\n\n` +
      `— Sent via PropTrack`
    );
    return `mailto:${c.email || ""}?subject=${subject}&body=${body}`;
  }

  const filtered = filterCategory === "all" ? contractors : contractors.filter((c) => c.category === filterCategory);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-3 border-brand/20 border-t-brand rounded-full animate-spin" /></div>;
  }

  if (!canUseContractors(plan)) {
    return (
      <div className="text-center py-20">
        <div className="w-14 h-14 rounded-2xl bg-brand-faint flex items-center justify-center mx-auto mb-4">
          <HardHat className="w-7 h-7 text-brand" strokeWidth={1.6} />
        </div>
        <h2 className="text-xl font-bold text-charcoal mb-2" style={{ fontFamily: "var(--font-display)" }}>Preferred Contractors</h2>
        <p className="text-sm text-charcoal-secondary mb-6 max-w-sm mx-auto">Save your go-to contractors, assign them to requests, and invite them to view jobs directly. Available on Essential and Pro plans.</p>
        <button onClick={() => showUpgradeModal("contractors")} className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
          Upgrade to unlock
        </button>
      </div>
    );
  }

  return (
    <div className="min-w-0">
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold text-charcoal" style={{ fontFamily: "var(--font-display)" }}>Contractors</h1>
          <p className="text-sm text-charcoal-secondary mt-1">
            {contractors.length} contractor{contractors.length !== 1 ? "s" : ""}
            {plan !== "pro" && ` · ${contractors.length}/${plan === "essential" ? "5" : "0"} used`}
          </p>
        </div>
        <button
          onClick={() => {
            if (!canAddContractor(plan, contractors.length)) {
              showUpgradeModal("contractors");
              return;
            }
            setShowAdd(true);
          }}
          className="flex items-center gap-1.5 text-sm font-medium bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl transition-colors shrink-0 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />Add contractor
        </button>
      </div>

      {/* Category filter */}
      <div className="flex items-center gap-2 mb-6 flex-wrap">
        <button onClick={() => setFilterCategory("all")}
          className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${filterCategory === "all" ? "bg-brand text-white" : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"}`}>
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button key={cat.key} onClick={() => setFilterCategory(cat.key)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors whitespace-nowrap ${filterCategory === cat.key ? "bg-brand text-white" : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"}`}>
            {cat.label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-warm-300/50 p-8 text-center">
          <HardHat className="w-8 h-8 text-charcoal-tertiary mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-charcoal-secondary mb-3">
            {filterCategory === "all" ? "No contractors added yet." : `No ${CONTRACTOR_CATEGORY_LABELS[filterCategory as ContractorCategory].toLowerCase()}s found.`}
          </p>
          {filterCategory === "all" && (
            <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors">
              <Plus className="w-4 h-4" />Add your first contractor
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <div key={c.id} className="bg-surface rounded-2xl border border-warm-300/50 p-5 group">
              {editingId === c.id ? (
                /* Inline edit mode */
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)}
                      className="border border-warm-300 rounded-xl px-3 py-2 text-sm bg-warm-white outline-none focus:border-brand" placeholder="First name" />
                    <input value={editLastName} onChange={(e) => setEditLastName(e.target.value)}
                      className="border border-warm-300 rounded-xl px-3 py-2 text-sm bg-warm-white outline-none focus:border-brand" placeholder="Last name" />
                  </div>
                  <input value={editCompany} onChange={(e) => setEditCompany(e.target.value)}
                    className="w-full border border-warm-300 rounded-xl px-3 py-2 text-sm bg-warm-white outline-none focus:border-brand" placeholder="Company (optional)" />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={editPhone} onChange={(e) => setEditPhone(e.target.value)}
                      className="border border-warm-300 rounded-xl px-3 py-2 text-sm bg-warm-white outline-none focus:border-brand" placeholder="Phone" />
                    <input value={editEmail} onChange={(e) => setEditEmail(e.target.value)}
                      className="border border-warm-300 rounded-xl px-3 py-2 text-sm bg-warm-white outline-none focus:border-brand" placeholder="Email" />
                  </div>
                  <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2}
                    className="w-full border border-warm-300 rounded-xl px-3 py-2 text-sm bg-warm-white outline-none focus:border-brand resize-none" placeholder="Notes" />
                  <div className="flex items-center gap-2">
                    <button onClick={() => saveEdit(c.id)} className="text-xs font-semibold bg-brand text-white px-4 py-1.5 rounded-lg hover:bg-brand-dark transition-colors">Save</button>
                    <button onClick={() => setEditingId(null)} className="text-xs font-semibold text-charcoal-secondary hover:text-charcoal transition-colors">Cancel</button>
                  </div>
                </div>
              ) : (
                /* Display mode */
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="font-medium text-charcoal truncate">{c.first_name} {c.last_name}</p>
                        {c.user_id && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-success bg-success-light px-2 py-0.5 rounded-full">
                            <UserCheck className="w-3 h-3" />Joined
                          </span>
                        )}
                        {!c.user_id && (
                          <span className="flex items-center gap-1 text-[10px] font-semibold text-warning bg-warning-light px-2 py-0.5 rounded-full">
                            <Clock className="w-3 h-3" />Pending
                          </span>
                        )}
                      </div>
                      {c.company && <p className="text-sm text-charcoal-secondary truncate">{c.company}</p>}

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ccat-${c.category}`}>
                          {CONTRACTOR_CATEGORY_LABELS[c.category]}
                        </span>
                        {c.phone && (
                          <a href={`tel:${c.phone}`} className="flex items-center gap-1 text-xs text-charcoal-tertiary hover:text-charcoal transition-colors truncate">
                            <Phone className="w-3 h-3 shrink-0" /><span className="truncate">{c.phone}</span>
                          </a>
                        )}
                        {c.email && (
                          <a href={`mailto:${c.email}`} className="flex items-center gap-1 text-xs text-charcoal-tertiary hover:text-brand transition-colors truncate">
                            <Mail className="w-3 h-3 shrink-0" /><span className="truncate">{c.email}</span>
                          </a>
                        )}
                        {c.website && (
                          <a href={c.website.startsWith("http") ? c.website : `https://${c.website}`} target="_blank" rel="noopener noreferrer"
                            className="flex items-center gap-1 text-xs text-charcoal-tertiary hover:text-brand transition-colors">
                            <Globe className="w-3 h-3 shrink-0" />Website
                          </a>
                        )}
                      </div>
                      {c.notes && <p className="text-xs text-charcoal-tertiary mt-2 italic truncate">{c.notes}</p>}
                    </div>

                    {/* Send invite — always visible on desktop */}
                    <div className="hidden sm:flex items-center gap-1 shrink-0">
                      {!c.user_id && c.email && (
                        <a href={getInviteMailtoUrl(c)} title="Email invite"
                          className="flex items-center gap-1 text-xs font-semibold text-brand hover:text-brand-dark bg-brand-faint px-2.5 py-1 rounded-lg transition-colors mr-1">
                          <Send className="w-3 h-3" />Invite
                        </a>
                      )}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => copyInviteCode(c.id, c.invite_code)} title="Copy invite link"
                          className="p-1.5 text-charcoal-tertiary hover:text-brand transition-colors">
                          {copiedId === c.id ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
                        </button>
                        <button onClick={() => startEdit(c)} title="Edit"
                          className="p-1.5 text-charcoal-tertiary hover:text-charcoal transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => handleDelete(c.id)} title="Remove"
                          className="p-1.5 text-charcoal-tertiary hover:text-danger transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Mobile action row */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-warm-300/30 sm:hidden">
                    {!c.user_id && c.email && (
                      <a href={getInviteMailtoUrl(c)}
                        className="flex items-center gap-1 text-xs font-semibold text-brand bg-brand-faint px-2.5 py-1.5 rounded-lg">
                        <Send className="w-3 h-3" />Invite
                      </a>
                    )}
                    <button onClick={() => copyInviteCode(c.id, c.invite_code)}
                      className="flex items-center gap-1 text-xs font-medium text-charcoal-secondary px-2.5 py-1.5 rounded-lg bg-warm-100">
                      {copiedId === c.id ? <><Check className="w-3 h-3 text-success" />Copied</> : <><Copy className="w-3 h-3" />Copy link</>}
                    </button>
                    <button onClick={() => startEdit(c)}
                      className="flex items-center gap-1 text-xs font-medium text-charcoal-secondary px-2.5 py-1.5 rounded-lg bg-warm-100">
                      <Pencil className="w-3 h-3" />Edit
                    </button>
                    <button onClick={() => handleDelete(c.id)}
                      className="flex items-center gap-1 text-xs font-medium text-danger px-2.5 py-1.5 rounded-lg bg-warm-100 ml-auto">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add Contractor Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-charcoal">Add contractor</h3>
              <button onClick={() => { setShowAdd(false); setSaveError(""); }} className="p-1 text-charcoal-tertiary hover:text-charcoal"><X className="w-5 h-5" /></button>
            </div>

            {saveError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-danger-light text-danger text-sm font-medium">{saveError}</div>
            )}

            <form onSubmit={handleAdd} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-charcoal mb-2 block">First name *</label>
                  <input type="text" placeholder="John" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus
                    className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
                </div>
                <div>
                  <label className="text-sm font-medium text-charcoal mb-2 block">Last name *</label>
                  <input type="text" placeholder="Smith" value={lastName} onChange={(e) => setLastName(e.target.value)} required
                    className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Company (optional)</label>
                <input type="text" placeholder="Smith Plumbing LLC" value={company} onChange={(e) => setCompany(e.target.value)}
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Specialty *</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((cat) => (
                    <button key={cat.key} type="button" onClick={() => setCategory(cat.key)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${category === cat.key ? "bg-brand text-white" : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"}`}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-charcoal mb-2 block">Phone</label>
                  <input type="tel" placeholder="(555) 123-4567" value={phone} onChange={(e) => setPhone(e.target.value)}
                    className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
                </div>
                <div>
                  <label className="text-sm font-medium text-charcoal mb-2 block">Email</label>
                  <input type="email" placeholder="john@smith.com" value={email} onChange={(e) => setEmail(e.target.value)}
                    className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Website (optional)</label>
                <input type="text" placeholder="https://smithplumbing.com" value={website} onChange={(e) => setWebsite(e.target.value)}
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Notes (optional)</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Reliable, does weekend calls, $80/hr" rows={2}
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white resize-none outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
              </div>

              <button type="submit" disabled={saving || !firstName.trim() || !lastName.trim()}
                className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
                {saving ? "Adding..." : "Add contractor"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
