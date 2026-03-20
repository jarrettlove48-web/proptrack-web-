"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type { MaintenanceRequest, Contractor, RequestMedia, Message, ProposedTimeSlot } from "@/lib/types";
import { CATEGORY_LABELS, CONTRACTOR_STATUS_LABELS } from "@/lib/types";
import { sendNotification } from "@/lib/notify";
import {
  Building2,
  HardHat,
  LogOut,
  CheckCircle,
  XCircle,
  Clock,
  MessageCircle,
  Send,
  X,
} from "lucide-react";

export default function ContractorPortalPage() {
  const router = useRouter();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [contractor, setContractor] = useState<Contractor | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [mediaByRequest, setMediaByRequest] = useState<Record<string, RequestMedia[]>>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");

  // Messages
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/contractor-invite"); return; }
    setUserId(user.id);

    // Get profile
    const { data: profile } = await supabase.from("profiles").select("name, role").eq("id", user.id).single();
    if (!profile || profile.role !== "contractor") {
      router.push("/auth");
      return;
    }
    setUserName(profile.name || "Contractor");

    // Get contractor record
    const { data: cData } = await supabase.from("contractors").select("*").eq("user_id", user.id).single();
    if (!cData) { setLoading(false); return; }
    setContractor(cData as Contractor);

    // Get assigned requests
    const { data: reqData } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("assigned_contractor_id", cData.id)
      .order("created_at", { ascending: false });
    const reqs = (reqData || []) as MaintenanceRequest[];
    setRequests(reqs);

    // Get media
    const reqIds = reqs.map((r) => r.id);
    if (reqIds.length > 0) {
      const { data: mediaData } = await supabase.from("request_media").select("*").in("request_id", reqIds);
      const grouped: Record<string, RequestMedia[]> = {};
      (mediaData || []).forEach((m: RequestMedia) => {
        if (!grouped[m.request_id]) grouped[m.request_id] = [];
        grouped[m.request_id].push(m);
      });
      setMediaByRequest(grouped);
    }

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime for requests
  useEffect(() => {
    if (!contractor) return;
    const channel = supabase
      .channel("contractor-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "maintenance_requests", filter: `assigned_contractor_id=eq.${contractor.id}` }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [contractor, supabase, fetchData]);

  // Fetch messages when selecting a request
  useEffect(() => {
    if (!selectedRequest) return;
    (async () => {
      const { data } = await supabase.from("messages").select("*").eq("request_id", selectedRequest.id).order("created_at", { ascending: true });
      setMessages((data || []) as Message[]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    })();
  }, [selectedRequest, supabase]);

  // Realtime messages
  useEffect(() => {
    if (!selectedRequest) return;
    const channel = supabase
      .channel("contractor-messages")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages" }, (payload) => {
        const msg = payload.new as Message;
        if (msg.request_id === selectedRequest.id) {
          setMessages((prev) => [...prev, msg]);
          setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedRequest, supabase]);

  async function updateContractorStatus(requestId: string, status: "accepted" | "declined") {
    await supabase.from("maintenance_requests").update({
      contractor_status: status,
      updated_at: new Date().toISOString(),
    }).eq("id", requestId);

    // Notify landlord
    const req = requests.find((r) => r.id === requestId);
    if (req) {
      const { data: ownerProfile } = await supabase
        .from("profiles")
        .select("email, name")
        .eq("id", req.owner_id)
        .single();

      if (ownerProfile?.email) {
        sendNotification({
          type: status === "accepted" ? "contractor_accepted" : "contractor_declined",
          recipientEmail: ownerProfile.email,
          recipientName: ownerProfile.name || "Landlord",
          data: {
            contractorName: contractor ? `${contractor.first_name} ${contractor.last_name}` : "Contractor",
            category: CATEGORY_LABELS[req.category],
            description: req.description,
            propertyName: req.property_name,
            dashboardUrl: `${window.location.origin}/dashboard/requests`,
          },
        });
      }
    }

    fetchData();
  }

  async function confirmTimeSlot(requestId: string, slot: ProposedTimeSlot) {
    const confirmedTime = new Date(`${slot.date}T${slot.startTime}:00`).toISOString();
    await supabase.from("maintenance_requests").update({
      confirmed_time: confirmedTime,
      confirmed_by: userId,
      updated_at: new Date().toISOString(),
    }).eq("id", requestId);
    fetchData();
  }

  function formatTime(time24: string): string {
    const [h, m] = time24.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 || 12;
    return `${h12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest || !newMessage.trim()) return;
    setSendingMessage(true);
    await supabase.from("messages").insert({
      request_id: selectedRequest.id,
      sender_id: userId,
      sender_name: userName,
      sender_role: "contractor",
      body: newMessage.trim(),
    });
    setNewMessage("");
    setSendingMessage(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/contractor-invite");
    router.refresh();
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand/20 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  if (!contractor) {
    return (
      <div className="min-h-screen bg-warm-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <HardHat className="w-10 h-10 text-charcoal-tertiary mx-auto mb-3" />
          <h2 className="text-xl font-bold text-charcoal mb-2">No contractor record found</h2>
          <p className="text-sm text-charcoal-secondary mb-4">Please use an invite link from your landlord.</p>
          <button onClick={handleSignOut} className="text-sm font-medium text-brand hover:text-brand-dark">Sign out</button>
        </div>
      </div>
    );
  }

  const pendingRequests = requests.filter((r) => r.contractor_status === "pending");
  const acceptedRequests = requests.filter((r) => r.contractor_status === "accepted");
  const otherRequests = requests.filter((r) => r.contractor_status !== "pending" && r.contractor_status !== "accepted");

  return (
    <div className="min-h-screen bg-warm-white">
      {/* Header */}
      <header className="bg-white border-b border-warm-300/60 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-brand flex items-center justify-center">
              <Building2 className="w-5 h-5 text-white" strokeWidth={1.8} />
            </div>
            <div>
              <p className="font-semibold text-charcoal text-sm" style={{ fontFamily: "var(--font-display)" }}>PropTrack</p>
              <p className="text-xs text-charcoal-tertiary">
                {contractor.first_name} {contractor.last_name}{contractor.company ? ` · ${contractor.company}` : ""}
              </p>
            </div>
          </div>
          <button onClick={handleSignOut} className="flex items-center gap-1.5 text-sm text-charcoal-tertiary hover:text-danger transition-colors">
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 page-enter">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-white rounded-2xl border border-warm-300/50 p-4 text-center">
            <p className="text-2xl font-bold text-warning">{pendingRequests.length}</p>
            <p className="text-xs text-charcoal-tertiary mt-1">Pending</p>
          </div>
          <div className="bg-white rounded-2xl border border-warm-300/50 p-4 text-center">
            <p className="text-2xl font-bold text-success">{acceptedRequests.length}</p>
            <p className="text-xs text-charcoal-tertiary mt-1">Accepted</p>
          </div>
          <div className="bg-white rounded-2xl border border-warm-300/50 p-4 text-center">
            <p className="text-2xl font-bold text-charcoal">{requests.length}</p>
            <p className="text-xs text-charcoal-tertiary mt-1">Total</p>
          </div>
        </div>

        {requests.length === 0 ? (
          <div className="bg-white rounded-2xl border border-warm-300/50 p-8 text-center">
            <HardHat className="w-8 h-8 text-charcoal-tertiary mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-charcoal-secondary">No jobs assigned yet. Your landlord will assign requests to you.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Pending first, then accepted, then rest */}
            {[...pendingRequests, ...acceptedRequests, ...otherRequests].map((req) => {
              const media = mediaByRequest[req.id] || [];
              return (
                <div key={req.id} className="bg-white rounded-2xl border border-warm-300/50 p-5">
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="flex-1">
                      <p className="font-medium text-charcoal">{req.description}</p>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg cat-${req.category}`}>{CATEGORY_LABELS[req.category]}</span>
                        <span className="text-xs text-charcoal-tertiary">{req.property_name} · {req.unit_label}</span>
                        {req.tenant_name && <span className="text-xs text-charcoal-tertiary">by {req.tenant_name}</span>}
                      </div>
                    </div>
                    {req.contractor_status && (
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg shrink-0 cstatus-${req.contractor_status}`}>
                        {CONTRACTOR_STATUS_LABELS[req.contractor_status]}
                      </span>
                    )}
                  </div>

                  {/* Photos */}
                  {media.length > 0 && (
                    <div className="flex gap-2 mt-3">
                      {media.map((m) => (
                        <a key={m.id} href={m.media_url} target="_blank" rel="noopener noreferrer"
                          className="w-20 h-20 rounded-lg overflow-hidden border border-warm-300/50 hover:border-brand transition-colors shrink-0">
                          <img src={m.media_url} alt="Request photo" className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* Proposed times */}
                  {req.proposed_times && (req.proposed_times as ProposedTimeSlot[]).length > 0 && !req.confirmed_time && (
                    <div className="mt-3 pt-3 border-t border-warm-300/30">
                      <p className="text-xs font-semibold text-charcoal-secondary mb-2">Preferred times from tenant</p>
                      <div className="space-y-1.5">
                        {(req.proposed_times as ProposedTimeSlot[]).map((slot, i) => (
                          <div key={i} className="flex items-center justify-between bg-warm-white rounded-xl px-3 py-2">
                            <div className="text-xs text-charcoal">
                              <span className="font-medium">
                                {new Date(slot.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                              </span>
                              <span className="text-charcoal-tertiary ml-2">
                                {formatTime(slot.startTime)} — {formatTime(slot.endTime)}
                              </span>
                            </div>
                            {req.contractor_status === "accepted" && (
                              <button onClick={() => confirmTimeSlot(req.id, slot)}
                                className="text-xs font-semibold text-brand hover:text-brand-dark transition-colors">
                                Select
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Confirmed time */}
                  {req.confirmed_time && (
                    <div className="mt-3">
                      <div className="flex items-center gap-2 bg-success-light rounded-xl px-3 py-2">
                        <CheckCircle className="w-3.5 h-3.5 text-success" />
                        <span className="text-xs font-medium text-success">
                          Scheduled: {new Date(req.confirmed_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {new Date(req.confirmed_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                        </span>
                      </div>
                    </div>
                  )}

                  <p className="text-xs text-charcoal-tertiary mt-3">
                    {new Date(req.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                  </p>

                  {/* Action buttons */}
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-warm-300/30">
                    {req.contractor_status === "pending" && (
                      <>
                        <button onClick={() => updateContractorStatus(req.id, "accepted")}
                          className="flex items-center gap-1.5 text-sm font-medium bg-success/10 text-success hover:bg-success/20 px-4 py-2 rounded-xl transition-colors">
                          <CheckCircle className="w-4 h-4" />Accept
                        </button>
                        <button onClick={() => updateContractorStatus(req.id, "declined")}
                          className="flex items-center gap-1.5 text-sm font-medium bg-danger/10 text-danger hover:bg-danger/20 px-4 py-2 rounded-xl transition-colors">
                          <XCircle className="w-4 h-4" />Decline
                        </button>
                      </>
                    )}
                    <button onClick={() => setSelectedRequest(req)}
                      className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark transition-colors ml-auto">
                      <MessageCircle className="w-4 h-4" />Messages
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Message drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-warm-300/40">
              <div>
                <p className="font-semibold text-charcoal text-sm">Messages</p>
                <p className="text-xs text-charcoal-tertiary">{selectedRequest.description.slice(0, 40)}...</p>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="p-1 text-charcoal-tertiary hover:text-charcoal">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {messages.length === 0 ? (
                <p className="text-sm text-charcoal-tertiary text-center py-8">No messages yet. Send one to the landlord.</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`max-w-[80%] ${msg.sender_role === "contractor" ? "ml-auto" : ""}`}>
                    <div className={`rounded-2xl px-4 py-2.5 ${
                      msg.sender_role === "contractor"
                        ? "bg-brand text-white rounded-br-md"
                        : "bg-warm-100 text-charcoal rounded-bl-md"
                    }`}>
                      <p className="text-sm">{msg.body}</p>
                    </div>
                    <p className={`text-[10px] mt-1 ${msg.sender_role === "contractor" ? "text-right" : ""} text-charcoal-tertiary`}>
                      {msg.sender_name} · {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSendMessage} className="border-t border-warm-300/40 p-4 flex items-center gap-3">
              <input type="text" value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Type a message..."
                className="flex-1 text-sm text-charcoal outline-none bg-warm-white border border-warm-300 rounded-xl px-4 py-2.5 focus:border-brand transition-colors placeholder:text-charcoal-tertiary" />
              <button type="submit" disabled={sendingMessage || !newMessage.trim()}
                className="w-10 h-10 rounded-xl bg-brand hover:bg-brand-dark text-white flex items-center justify-center transition-colors disabled:opacity-60 shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
