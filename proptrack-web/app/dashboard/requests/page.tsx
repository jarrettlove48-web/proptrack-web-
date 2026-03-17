"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { MaintenanceRequest, RequestStatus } from "@/lib/types";
import { STATUS_LABELS, CATEGORY_LABELS } from "@/lib/types";
import { Wrench, Filter } from "lucide-react";

export default function RequestsPage() {
  const supabase = createClient();
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<RequestStatus | "all">("all");

  const fetchRequests = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("owner_id", user.id)
      .order("created_at", { ascending: false });

    setRequests((data || []) as MaintenanceRequest[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function updateStatus(id: string, status: RequestStatus) {
    await supabase
      .from("maintenance_requests")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id);
    fetchRequests();
  }

  const filtered = statusFilter === "all"
    ? requests
    : requests.filter((r) => r.status === statusFilter);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-3 border-brand/20 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-charcoal" style={{ fontFamily: "var(--font-display)" }}>
            Requests
          </h1>
          <p className="text-sm text-charcoal-secondary mt-1">
            {requests.length} total · {requests.filter((r) => r.status === "open").length} open
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-6">
        <Filter className="w-4 h-4 text-charcoal-tertiary" />
        {(["all", "open", "in_progress", "resolved"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setStatusFilter(f)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              statusFilter === f
                ? "bg-brand text-white"
                : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"
            }`}
          >
            {f === "all" ? "All" : STATUS_LABELS[f]}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-2xl border border-warm-300/50 p-8 text-center">
          <Wrench className="w-8 h-8 text-charcoal-tertiary mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm text-charcoal-secondary">
            {statusFilter === "all" ? "No requests yet." : `No ${STATUS_LABELS[statusFilter as RequestStatus].toLowerCase()} requests.`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((req) => (
            <div
              key={req.id}
              className="bg-white rounded-2xl border border-warm-300/50 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <p className="font-medium text-charcoal">{req.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg cat-${req.category}`}>
                      {CATEGORY_LABELS[req.category]}
                    </span>
                    <span className="text-xs text-charcoal-tertiary">
                      {req.property_name} · {req.unit_label}
                    </span>
                    {req.tenant_name && (
                      <span className="text-xs text-charcoal-tertiary">
                        by {req.tenant_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-charcoal-tertiary mt-2">
                    {new Date(req.created_at).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </p>
                </div>

                {/* Status selector */}
                <select
                  value={req.status}
                  onChange={(e) => updateStatus(req.id, e.target.value as RequestStatus)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg border-0 cursor-pointer status-${req.status}`}
                >
                  <option value="open">Open</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
