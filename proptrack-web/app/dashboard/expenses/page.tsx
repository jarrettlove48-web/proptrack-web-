"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Expense, Property } from "@/lib/types";
import { canTrackExpenses } from "@/lib/plans";
import { Receipt, DollarSign, Plus, X, Trash2, Building2, Download } from "lucide-react";
import { useDashboard } from "../layout";

const EXPENSE_CATEGORIES = [
  { key: "repair", label: "Repair" },
  { key: "maintenance", label: "Maintenance" },
  { key: "upgrade", label: "Upgrade" },
  { key: "inspection", label: "Inspection" },
  { key: "other", label: "Other" },
] as const;

export default function ExpensesPage() {
  const supabase = createClient();
  const { profile, showUpgradeModal } = useDashboard();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  // Add expense modal
  const [showAdd, setShowAdd] = useState(false);
  const [expDesc, setExpDesc] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState<string>("repair");
  const [expDate, setExpDate] = useState(new Date().toISOString().split("T")[0]);
  const [expVendor, setExpVendor] = useState("");
  const [expPropertyId, setExpPropertyId] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [expRes, propRes] = await Promise.all([
      supabase.from("expenses").select("*").eq("owner_id", user.id).order("created_at", { ascending: false }),
      supabase.from("properties").select("*").eq("owner_id", user.id).order("name"),
    ]);
    setExpenses((expRes.data || []) as Expense[]);
    setProperties((propRes.data || []) as Property[]);
    if (propRes.data?.length && !expPropertyId) setExpPropertyId(propRes.data[0].id);
    setLoading(false);
  }, [supabase, expPropertyId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleAddExpense(e: React.FormEvent) {
    e.preventDefault();
    if (!expDesc.trim() || !expAmount || !expPropertyId) return;
    setSaving(true);
    setSaveError("");

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); setSaveError("You must be logged in."); return; }

    const amount = parseFloat(expAmount);
    if (isNaN(amount) || amount <= 0) {
      setSaving(false);
      setSaveError("Please enter a valid amount.");
      return;
    }

    const { error } = await supabase.from("expenses").insert({
      owner_id: user.id,
      property_id: expPropertyId,
      description: expDesc.trim(),
      amount,
      category: expCategory,
      date: expDate,
      vendor: expVendor.trim() || null,
    });

    if (error) {
      setSaving(false);
      setSaveError(error.message || "Failed to add expense. Please try again.");
      return;
    }

    const prop = properties.find((p) => p.id === expPropertyId);
    await supabase.from("activities").insert({
      owner_id: user.id,
      type: "expense_added",
      title: "Expense logged",
      subtitle: `$${amount.toFixed(2)} - ${prop?.name || "property"}`,
    });

    setExpDesc(""); setExpAmount(""); setExpVendor(""); setExpCategory("repair");
    setExpDate(new Date().toISOString().split("T")[0]);
    setShowAdd(false); setSaving(false);
    setSaveError("");
    fetchData();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this expense?")) return;
    await supabase.from("expenses").delete().eq("id", id);
    fetchData();
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><div className="w-7 h-7 border-3 border-brand/20 border-t-brand rounded-full animate-spin" /></div>;
  }

  const plan = profile?.plan || "starter";
  if (!canTrackExpenses(plan)) {
    return (
      <div className="text-center py-20">
        <div className="w-14 h-14 rounded-2xl bg-brand-faint flex items-center justify-center mx-auto mb-4">
          <Receipt className="w-7 h-7 text-brand" strokeWidth={1.6} />
        </div>
        <h2 className="text-xl font-bold text-charcoal mb-2" style={{ fontFamily: "var(--font-display)" }}>Expense tracking</h2>
        <p className="text-sm text-charcoal-secondary mb-6 max-w-sm mx-auto">Track property expenses, vendors, and categories. Available on Essential and Pro plans.</p>
        <button onClick={() => showUpgradeModal("expenses")} className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-6 py-2.5 rounded-xl text-sm transition-colors">
          Upgrade to unlock
        </button>
      </div>
    );
  }

  function handleExportCSV() {
    const headers = ["Date", "Description", "Amount", "Category", "Vendor", "Property"];
    const rows = expenses.map((exp) => {
      const prop = properties.find((p) => p.id === exp.property_id);
      const esc = (s: string) => '"' + s.replace(/"/g, '""') + '"';
      return [exp.date, esc(exp.description), Number(exp.amount).toFixed(2), exp.category, esc(exp.vendor || ""), esc(prop?.name || "")].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `proptrack-expenses-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal" style={{ fontFamily: "var(--font-display)" }}>Expenses</h1>
          <p className="text-sm text-charcoal-secondary mt-1">{expenses.length} expenses · ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleExportCSV} className="flex items-center gap-1.5 text-sm font-medium text-charcoal-secondary hover:text-charcoal border border-warm-300 px-4 py-2 rounded-xl transition-colors">
            <Download className="w-4 h-4" />Export
          </button>
          <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm font-medium bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl transition-colors">
            <Plus className="w-4 h-4" />Add expense
          </button>
        </div>
      </div>

      {/* Summary card */}
      <div className="bg-surface rounded-2xl border border-warm-300/50 p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-accent" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-2xl font-bold text-charcoal">${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
            <p className="text-xs text-charcoal-tertiary">Total expenses tracked</p>
          </div>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-surface rounded-2xl border border-warm-300/50 p-8 text-center">
          <Receipt className="w-8 h-8 text-charcoal-tertiary mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-charcoal-secondary mb-3">No expenses logged yet.</p>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors">
            <Plus className="w-4 h-4" />Log first expense
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((exp) => (
            <div key={exp.id} className="bg-surface rounded-xl border border-warm-300/50 px-4 py-3 flex items-center justify-between group">
              <div>
                <p className="text-sm font-medium text-charcoal">{exp.description}</p>
                <p className="text-xs text-charcoal-tertiary mt-0.5">
                  {exp.date} {exp.vendor ? `· ${exp.vendor}` : ""} · {exp.category}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <p className="font-semibold text-charcoal">${Number(exp.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}</p>
                <button onClick={() => handleDelete(exp.id)} className="opacity-0 group-hover:opacity-100 text-charcoal-tertiary hover:text-danger transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Expense Modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-charcoal">Add expense</h3>
              <button onClick={() => { setShowAdd(false); setSaveError(""); }} className="p-1 text-charcoal-tertiary hover:text-charcoal"><X className="w-5 h-5" /></button>
            </div>

            {saveError && (
              <div className="mb-4 px-4 py-3 rounded-xl bg-danger-light text-danger text-sm font-medium">{saveError}</div>
            )}

            <form onSubmit={handleAddExpense} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Property *</label>
                <div className="flex items-center gap-3 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white">
                  <Building2 className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                  <select value={expPropertyId} onChange={(e) => setExpPropertyId(e.target.value)} required
                    className="flex-1 bg-transparent text-sm text-charcoal outline-none">
                    {properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Description *</label>
                <input type="text" placeholder="e.g. Replaced kitchen faucet" value={expDesc} onChange={(e) => setExpDesc(e.target.value)} required
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" autoFocus />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-charcoal mb-2 block">Amount *</label>
                  <div className="flex items-center gap-2 border border-warm-300 rounded-xl px-4 py-3 bg-warm-white focus-within:border-brand transition-colors">
                    <DollarSign className="w-[18px] h-[18px] text-charcoal-tertiary shrink-0" strokeWidth={1.8} />
                    <input type="number" step="0.01" min="0" placeholder="0.00" value={expAmount} onChange={(e) => setExpAmount(e.target.value)} required
                      className="flex-1 bg-transparent text-sm text-charcoal outline-none placeholder:text-charcoal-tertiary" />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-charcoal mb-2 block">Date *</label>
                  <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} required
                    className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors" />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Category</label>
                <div className="flex flex-wrap gap-2">
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <button key={cat.key} type="button" onClick={() => setExpCategory(cat.key)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${expCategory === cat.key ? "bg-brand text-white" : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"}`}>
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium text-charcoal mb-2 block">Vendor (optional)</label>
                <input type="text" placeholder="e.g. Home Depot, Mike's Plumbing" value={expVendor} onChange={(e) => setExpVendor(e.target.value)}
                  className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
              </div>

              <button type="submit" disabled={saving || !expDesc.trim() || !expAmount}
                className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60">
                {saving ? "Saving..." : "Add expense"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
