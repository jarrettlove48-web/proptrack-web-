"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@/lib/supabase-browser";
import type { MaintenanceRequest, Message } from "@/lib/types";
import { MessageCircle, Send, X, ChevronRight } from "lucide-react";

export default function MessagesPage() {
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data: profile } = await supabase.from("profiles").select("name").eq("id", user.id).single();
    if (profile) setUserName(profile.name);

    const { data } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("owner_id", user.id)
      .in("status", ["open", "in_progress"])
      .order("updated_at", { ascending: false });
    setRequests((data || []) as MaintenanceRequest[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (!selectedRequest) return;
    (async () => {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("request_id", selectedRequest.id)
        .order("created_at", { ascending: true });
      setMessages((data || []) as Message[]);
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
    })();
  }, [selectedRequest, supabase]);

  // Realtime messages
  useEffect(() => {
    if (!selectedRequest) return;
    const channel = supabase
      .channel("landlord-msgs")
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

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest || !newMessage.trim()) return;
    setSending(true);
    await supabase.from("messages").insert({
      request_id: selectedRequest.id,
      sender_id: userId,
      sender_name: userName || "Landlord",
      sender_role: "landlord",
      body: newMessage.trim(),
    });
    setNewMessage("");
    setSending(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-7 h-7 border-3 border-brand/20 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-charcoal mb-6" style={{ fontFamily: "var(--font-display)" }}>
        Messages
      </h1>

      <div className="flex gap-4 h-[calc(100vh-200px)] min-h-[400px]">
        {/* Request list */}
        <div className="w-80 shrink-0 bg-surface rounded-2xl border border-warm-300/50 overflow-y-auto hidden md:block">
          <div className="p-4 border-b border-warm-300/40">
            <p className="text-sm font-medium text-charcoal-secondary">
              Active requests ({requests.length})
            </p>
          </div>
          {requests.map((req) => (
            <button
              key={req.id}
              onClick={() => setSelectedRequest(req)}
              className={`w-full text-left p-4 border-b border-warm-300/30 hover:bg-warm-white transition-colors ${
                selectedRequest?.id === req.id ? "bg-brand-faint" : ""
              }`}
            >
              <p className="text-sm font-medium text-charcoal truncate">{req.description}</p>
              <p className="text-xs text-charcoal-tertiary mt-1">
                {req.property_name} · {req.unit_label}
              </p>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md mt-1.5 inline-block status-${req.status}`}>
                {req.status === "in_progress" ? "In Progress" : "Open"}
              </span>
            </button>
          ))}
          {requests.length === 0 && (
            <p className="text-sm text-charcoal-tertiary p-4 text-center">No active requests</p>
          )}
        </div>

        {/* Mobile request selector */}
        <div className="md:hidden w-full">
          {!selectedRequest ? (
            <div className="space-y-2">
              {requests.map((req) => (
                <button
                  key={req.id}
                  onClick={() => setSelectedRequest(req)}
                  className="w-full flex items-center justify-between bg-surface rounded-xl border border-warm-300/50 p-4"
                >
                  <div>
                    <p className="text-sm font-medium text-charcoal truncate">{req.description}</p>
                    <p className="text-xs text-charcoal-tertiary mt-0.5">{req.property_name} · {req.unit_label}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-charcoal-tertiary shrink-0" />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {/* Chat area */}
        {selectedRequest ? (
          <div className="flex-1 bg-surface rounded-2xl border border-warm-300/50 flex flex-col">
            <div className="p-4 border-b border-warm-300/40 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-charcoal">{selectedRequest.description.slice(0, 50)}...</p>
                <p className="text-xs text-charcoal-tertiary">{selectedRequest.tenant_name || "Tenant"}</p>
              </div>
              <button onClick={() => setSelectedRequest(null)} className="md:hidden p-1 text-charcoal-tertiary">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <p className="text-sm text-charcoal-tertiary text-center py-8">No messages in this thread yet.</p>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`max-w-[80%] ${msg.sender_role === "landlord" ? "ml-auto" : ""}`}>
                    <div className={`rounded-2xl px-4 py-2.5 ${
                      msg.sender_role === "landlord"
                        ? "bg-brand text-white rounded-br-md"
                        : "bg-warm-100 text-charcoal rounded-bl-md"
                    }`}>
                      <p className="text-sm">{msg.body}</p>
                    </div>
                    <p className={`text-[10px] mt-1 ${msg.sender_role === "landlord" ? "text-right" : ""} text-charcoal-tertiary`}>
                      {msg.sender_name} · {new Date(msg.created_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="border-t border-warm-300/40 p-4 flex items-center gap-3">
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 text-sm text-charcoal outline-none bg-warm-white border border-warm-300 rounded-xl px-4 py-2.5 focus:border-brand transition-colors placeholder:text-charcoal-tertiary"
              />
              <button
                type="submit"
                disabled={sending || !newMessage.trim()}
                className="w-10 h-10 rounded-xl bg-brand hover:bg-brand-dark text-white flex items-center justify-center transition-colors disabled:opacity-60 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        ) : (
          <div className="hidden md:flex flex-1 bg-surface rounded-2xl border border-warm-300/50 items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-10 h-10 text-charcoal-tertiary mx-auto mb-3" strokeWidth={1.3} />
              <p className="text-sm text-charcoal-secondary">Select a request to view messages</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
