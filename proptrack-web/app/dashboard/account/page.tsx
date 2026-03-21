"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase-browser";
import { useDashboard } from "../layout";
import { getUpgradePlan, startCheckout, PLAN_LABELS } from "@/lib/plans";
import { isAdmin, getEffectivePlan } from "@/lib/plans";
import type { PlanTier } from "@/lib/types";
import { User, Mail, Phone, Shield, Sun, Moon, Pencil, Check, ExternalLink, ArrowUpRight, FlaskConical } from "lucide-react";

export default function AccountPage() {
  const supabase = createClient();
  const { profile, refreshProfile, isDark, toggleDarkMode, adminSimulatedPlan, setAdminSimulatedPlan } = useDashboard();

  const [editingField, setEditingField] = useState<null | "name" | "phone">(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const plan = (profile?.plan || "starter") as keyof typeof PLAN_LABELS;
  const upgradePlan = getUpgradePlan(plan);
  const [checkingOut, setCheckingOut] = useState(false);

  function startEditing(field: "name" | "phone") {
    setEditingField(field);
    setEditValue(field === "name" ? (profile?.name || "") : (profile?.phone || ""));
  }

  async function saveField() {
    if (!profile || !editingField) return;
    setSaving(true);
    await supabase
      .from("profiles")
      .update({ [editingField]: editValue.trim(), updated_at: new Date().toISOString() })
      .eq("id", profile.id);
    await refreshProfile();
    setEditingField(null);
    setEditValue("");
    setSaving(false);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Account
      </h1>

      {/* Profile card */}
      <div className="bg-surface rounded-2xl border border-warm-300/50 p-6 mb-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-brand-faint flex items-center justify-center text-xl font-bold text-brand-dark">
            {profile?.name?.charAt(0)?.toUpperCase() || "?"}
          </div>
          <div>
            <p className="text-lg font-semibold text-charcoal">{profile?.name || "—"}</p>
            <p className="text-sm text-charcoal-secondary">Landlord</p>
          </div>
          <span className="ml-auto text-xs font-semibold px-3 py-1 rounded-full bg-brand-faint text-brand-dark">
            {PLAN_LABELS[plan]}
          </span>
        </div>

        <div className="space-y-4">
          {/* Name — editable */}
          <div className="flex items-center gap-3">
            <User className="w-4 h-4 text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-charcoal-tertiary">Name</p>
              {editingField === "name" ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="text-sm text-charcoal bg-warm-white border border-warm-300 rounded-lg px-2.5 py-1 outline-none focus:border-brand transition-colors w-full max-w-xs"
                  />
                  <button
                    onClick={saveField}
                    disabled={saving}
                    className="p-1 rounded-lg text-brand hover:bg-brand-faint transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-charcoal">{profile?.name || "—"}</p>
                  <button
                    onClick={() => startEditing("name")}
                    className="p-0.5 rounded text-charcoal-tertiary hover:text-brand transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Email — read only */}
          <div className="flex items-center gap-3">
            <Mail className="w-4 h-4 text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
            <div>
              <p className="text-xs text-charcoal-tertiary">Email</p>
              <p className="text-sm text-charcoal">{profile?.email || "—"}</p>
            </div>
          </div>

          {/* Phone — editable */}
          <div className="flex items-center gap-3">
            <Phone className="w-4 h-4 text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
            <div className="flex-1 min-w-0">
              <p className="text-xs text-charcoal-tertiary">Phone</p>
              {editingField === "phone" ? (
                <div className="flex items-center gap-2 mt-0.5">
                  <input
                    autoFocus
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="text-sm text-charcoal bg-warm-white border border-warm-300 rounded-lg px-2.5 py-1 outline-none focus:border-brand transition-colors w-full max-w-xs"
                  />
                  <button
                    onClick={saveField}
                    disabled={saving}
                    className="p-1 rounded-lg text-brand hover:bg-brand-faint transition-colors disabled:opacity-50"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <p className="text-sm text-charcoal">{profile?.phone || "Not set"}</p>
                  <button
                    onClick={() => startEditing("phone")}
                    className="p-0.5 rounded text-charcoal-tertiary hover:text-brand transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Appearance card */}
      <div className="bg-surface rounded-2xl border border-warm-300/50 p-6 mb-6">
        <h2 className="font-semibold text-charcoal mb-4">Appearance</h2>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isDark ? (
              <Moon className="w-5 h-5 text-charcoal-secondary" strokeWidth={1.8} />
            ) : (
              <Sun className="w-5 h-5 text-charcoal-secondary" strokeWidth={1.8} />
            )}
            <div>
              <p className="text-sm font-medium text-charcoal">Dark mode</p>
              <p className="text-xs text-charcoal-tertiary">{isDark ? "On" : "Off"}</p>
            </div>
          </div>
          <button
            onClick={toggleDarkMode}
            className={`relative w-11 h-6 rounded-full transition-colors ${
              isDark ? "bg-brand" : "bg-warm-300"
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                isDark ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>
      </div>

      {/* Dev Mode — admin only */}
      {isAdmin(profile?.email) && (
        <div className="bg-surface rounded-2xl border border-amber-300/60 p-6 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <FlaskConical className="w-4 h-4 text-amber-600" strokeWidth={1.8} />
            <h2 className="font-semibold text-charcoal">Dev Mode</h2>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">Admin</span>
          </div>
          <p className="text-xs text-charcoal-tertiary mb-3">Simulate different plan tiers to test feature gating.</p>
          <div className="flex gap-2">
            {(["starter", "essential", "pro"] as PlanTier[]).map((tier) => {
              const active = getEffectivePlan((profile?.plan || "starter") as PlanTier, profile?.email, adminSimulatedPlan) === tier;
              return (
                <button
                  key={tier}
                  onClick={() => setAdminSimulatedPlan(tier === "pro" && !adminSimulatedPlan ? null : tier)}
                  className={`flex-1 text-xs font-semibold py-2 rounded-xl transition-colors capitalize ${
                    active
                      ? "bg-brand text-white"
                      : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"
                  }`}
                >
                  {tier}
                </button>
              );
            })}
          </div>
          {adminSimulatedPlan && (
            <button
              onClick={() => setAdminSimulatedPlan(null)}
              className="mt-2 text-xs text-charcoal-tertiary hover:text-charcoal transition-colors"
            >
              Reset to default (Pro)
            </button>
          )}
        </div>
      )}

      {/* Plan & Billing card */}
      <div className="bg-surface rounded-2xl border border-warm-300/50 p-6 mb-6">
        <h2 className="font-semibold text-charcoal mb-4">Plan &amp; Billing</h2>
        <div className="flex items-center gap-3 mb-4">
          <Shield className="w-4 h-4 text-charcoal-tertiary" strokeWidth={1.8} />
          <div>
            <p className="text-xs text-charcoal-tertiary">Current plan</p>
            <p className="text-sm font-medium text-charcoal">{PLAN_LABELS[plan]}</p>
          </div>
        </div>
        {upgradePlan && (
          <button
            onClick={async () => {
              setCheckingOut(true);
              try {
                await startCheckout(upgradePlan, profile?.email);
              } catch {
                setCheckingOut(false);
              }
            }}
            disabled={checkingOut}
            className="flex items-center justify-center gap-2 w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors text-sm disabled:opacity-60"
          >
            <ArrowUpRight className="w-4 h-4" />
            {checkingOut ? "Redirecting to Stripe..." : `Upgrade to ${upgradePlan === "essential" ? "Essential" : "Pro"}`}
          </button>
        )}
        {!upgradePlan && (
          <p className="text-sm text-charcoal-tertiary">You are on the highest plan. Thank you for your support!</p>
        )}
      </div>

      {/* Quick Links card */}
      <div className="bg-surface rounded-2xl border border-warm-300/50 p-6">
        <h2 className="font-semibold text-charcoal mb-4">Quick links</h2>
        <div className="space-y-3">
          <a
            href="https://proptrack.app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between text-sm text-charcoal-secondary hover:text-brand transition-colors"
          >
            <span>PropTrack landing page</span>
            <ExternalLink className="w-4 h-4" />
          </a>
          <a
            href="mailto:support@proptrack.app"
            className="flex items-center justify-between text-sm text-charcoal-secondary hover:text-brand transition-colors"
          >
            <span>Contact support</span>
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}
