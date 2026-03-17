"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Expense, Property } from "@/lib/types";
import { Receipt, DollarSign, Plus, X, Trash2, Building2 } from "lucide-react";

const EXPENSE_CATEGORIES = [
  { key: "repair", label: "Repair" },
  { key: "maintenance", label: "Maintenance" },
  { key: "upgrade", label: "Upgrade" },
  { key: "inspection", label: "Inspection" },
  { key: "other", label: "Other" },
] as const;

export default function ExpensesPage() {
  const supabase = createClient();
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const amount = parseFloat(expAmount);
    const { error } = await supabase.from("expenses").insert({
      owner_id: user.id,
      property_id: expPropertyId,
      description: expDesc.trim(),
      amount,
      category: expCategory,
      date: expDate,
      vendor: expVendor.trim() || null,
    });

    if (!error) {
      const prop = properties.find((p) => p.id === expPropertyId);
      await supabase.from("activities").insert({
        owner_id: user.id,
        type: "expense_added",
        title: "Expense logged",
        subtitle: `$${amount.toFixed(2)} - ${prop?.name || "property"}`,
      });
    }

    setExpDesc(""); setExpAmount(""); setExpVendor(""); setExpCategory("repair");
    setExpDate(new Date().toISOString().split("T")[0]);
    setShowAdd(false); setSaving(false);
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

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal" style={{ fontFamily: "var(--font-display)" }}>Expenses</h1>
          <p className="text-sm text-charcoal-secondary mt-1">{expenses.length} expenses · ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })} total</p>
        </div>
        <button onClick={() => setShowAdd(true)} className="flex items-center gap-1.5 text-sm font-medium bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl transition-colors">
          <Plus className="w-4 h-4" />Add expense
        </button>
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-2xl border border-warm-300/50 p-5 mb-6">
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
        <div className="bg-white rounded-2xl border border-warm-300/50 p-8 text-center">
          <Receipt className="w-8 h-8 text-charcoal-tertiary mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-charcoal-secondary mb-3">No expenses logged yet.</p>
          <button onClick={() => setShowAdd(true)} className="inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold px-5 py-2 rounded-xl text-sm transition-colors">
            <Plus className="w-4 h-4" />Log first expense
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((exp) => (
            <div key={exp.id} className="bg-white rounded-xl border border-warm-300/50 px-4 py-3 flex items-center justify-between group">
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
          <div className="bg-white rounded-2xl w-full max-w-md p-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold text-charcoal">Add expense</h3>
              <button onClick={() => setShowAdd(false)} className="p-1 text-charcoal-tertiary hover:text-charcoal"><X className="w-5 h-5" /></button>
            </div>

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
