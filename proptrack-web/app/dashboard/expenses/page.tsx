"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { Expense } from "@/lib/types";
import { Receipt, DollarSign } from "lucide-react";

export default function ExpensesPage() {
  const supabase = createClient();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchExpenses = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("expenses")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });
    setExpenses((data || []) as Expense[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-3 border-brand/20 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
          Expenses
        </h1>
        <p className="text-sm text-charcoal-secondary mt-1">
          {expenses.length} expenses · ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })} total
        </p>
      </div>

      {/* Summary card */}
      <div className="bg-white rounded-2xl border border-warm-300/50 p-5 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-accent-light flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-accent" strokeWidth={1.8} />
          </div>
          <div>
            <p className="text-2xl font-bold text-charcoal">
              ${total.toLocaleString("en-US", { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-charcoal-tertiary">Total expenses tracked</p>
          </div>
        </div>
      </div>

      {expenses.length === 0 ? (
        <div className="bg-white rounded-2xl border border-warm-300/50 p-8 text-center">
          <Receipt className="w-8 h-8 text-charcoal-tertiary mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-charcoal-secondary">No expenses logged yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {expenses.map((exp) => (
            <div key={exp.id} className="bg-white rounded-xl border border-warm-300/50 px-4 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal">{exp.description}</p>
                <p className="text-xs text-charcoal-tertiary mt-0.5">
                  {exp.date} {exp.vendor ? `· ${exp.vendor}` : ""}
                </p>
              </div>
              <p className="font-semibold text-charcoal">
                ${Number(exp.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
