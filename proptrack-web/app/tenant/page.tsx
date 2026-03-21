"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-browser";
import type {
  Unit,
  Property,
  MaintenanceRequest,
  Message,
  RequestCategory,
} from "@/lib/types";
import {
  Building2,
  Wrench,
  Plus,
  Send,
  LogOut,
  Clock,
  CheckCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MessageCircle,
  Home,
  X,
  Camera,
  Image as ImageIcon,
  Pencil,
  Check,
  User,
  Phone,
} from "lucide-react";

const CATEGORIES: { key: RequestCategory; label: string }[] = [
  { key: "plumbing", label: "Plumbing" },
  { key: "electrical", label: "Electrical" },
  { key: "hvac", label: "HVAC" },
  { key: "appliance", label: "Appliance" },
  { key: "other", label: "Other" },
];

export default function TenantPortalPage() {
  const router = useRouter();
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [unit, setUnit] = useState<Unit | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [userId, setUserId] = useState<string>("");
  const [userName, setUserName] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // New request form
  const [showNewRequest, setShowNewRequest] = useState(false);
  const [newCategory, setNewCategory] = useState<RequestCategory>("plumbing");
  const [newDescription, setNewDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [uploadProgress, setUploadProgress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [timeSlots, setTimeSlots] = useState<{ date: string; startTime: string; endTime: string }[]>([]);

  // Selected request for messages
  const [selectedRequest, setSelectedRequest] = useState<MaintenanceRequest | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  // Profile editing
  const [userPhone, setUserPhone] = useState("");
  const [editingProfileField, setEditingProfileField] = useState<"name" | "phone" | null>(null);
  const [editProfileValue, setEditProfileValue] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  function startEditProfile(field: "name" | "phone", value: string) {
    setEditingProfileField(field); setEditProfileValue(value);
  }
  function cancelEditProfile() { setEditingProfileField(null); setEditProfileValue(""); }
  async function saveProfileEdit() {
    if (!editingProfileField || !userId) return;
    setSavingProfile(true);
    await supabase.from("profiles").update({ [editingProfileField]: editProfileValue.trim() }).eq("id", userId);
    if (editingProfileField === "name") setUserName(editProfileValue.trim() || "Tenant");
    if (editingProfileField === "phone") setUserPhone(editProfileValue.trim());
    setEditingProfileField(null); setEditProfileValue(""); setSavingProfile(false);
  }

  // Expanded requests
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const fetchData = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/invite");
      return;
    }
    setUserId(user.id);

    // Get profile name
    const { data: profileData } = await supabase
      .from("profiles")
      .select("name, role, phone")
      .eq("id", user.id)
      .single();

    if (profileData) {
      if (profileData.role !== "tenant") {
        router.push("/dashboard");
        return;
      }
      setUserName(profileData.name || "Tenant");
      setUserPhone(profileData.phone || "");
    }

    // Get tenant's unit
    const { data: unitData } = await supabase
      .from("units")
      .select("*")
      .eq("tenant_user_id", user.id)
      .single();

    if (!unitData) {
      setLoading(false);
      return;
    }
    setUnit(unitData as Unit);

    // Get property info
    const { data: propData } = await supabase
      .from("properties")
      .select("*")
      .eq("id", unitData.property_id)
      .single();
    if (propData) setProperty(propData as Property);

    // Get requests for this unit
    const { data: reqData } = await supabase
      .from("maintenance_requests")
      .select("*")
      .eq("unit_id", unitData.id)
      .order("created_at", { ascending: false });
    setRequests((reqData || []) as MaintenanceRequest[]);

    setLoading(false);
  }, [supabase, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Realtime subscription for messages and requests
  useEffect(() => {
    if (!unit) return;

    const reqChannel = supabase
      .channel("tenant-requests")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "maintenance_requests",
          filter: `unit_id=eq.${unit.id}`,
        },
        () => fetchData()
      )
      .subscribe();

    const msgChannel = supabase
      .channel("tenant-messages")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as Message;
          if (selectedRequest && msg.request_id === selectedRequest.id) {
            setMessages((prev) => [...prev, msg]);
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reqChannel);
      supabase.removeChannel(msgChannel);
    };
  }, [unit, selectedRequest, supabase, fetchData]);

  // Fetch messages when selecting a request
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

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newFiles = [...photoFiles, ...files].slice(0, 5); // max 5 photos
    setPhotoFiles(newFiles);
    // Generate previews
    const previews = newFiles.map((f) => URL.createObjectURL(f));
    setPhotoPreviews((prev) => { prev.forEach(URL.revokeObjectURL); return previews; });
  }

  function removePhoto(index: number) {
    const newFiles = photoFiles.filter((_, i) => i !== index);
    setPhotoFiles(newFiles);
    setPhotoPreviews((prev) => {
      URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }

  async function handleSubmitRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!unit || !property || !newDescription.trim()) return;
    if (photoFiles.length === 0) return; // require at least one photo
    setSubmitting(true);
    setUploadProgress("Creating request...");

    // 1. Insert the maintenance request
    const { data: reqData, error: reqError } = await supabase.from("maintenance_requests").insert({
      unit_id: unit.id,
      property_id: property.id,
      owner_id: unit.owner_id,
      category: newCategory,
      description: newDescription.trim(),
      status: "open",
      tenant_name: unit.tenant_name || userName,
      unit_label: unit.label,
      property_name: property.name,
      proposed_times: timeSlots.length > 0 ? timeSlots : null,
    }).select("id").single();

    if (reqError || !reqData) {
      setSubmitting(false);
      setUploadProgress("");
      return;
    }

    // 2. Upload photos to Supabase Storage
    setUploadProgress("Uploading photos...");
    const mediaRows: { request_id: string; media_url: string; media_type: string; uploaded_by: string }[] = [];

    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const ext = file.name.split(".").pop() || "jpg";
      const filePath = `${reqData.id}/${crypto.randomUUID()}.${ext}`;

      setUploadProgress(`Uploading photo ${i + 1} of ${photoFiles.length}...`);

      const { error: uploadErr } = await supabase.storage
        .from("request-media")
        .upload(filePath, file, { contentType: file.type });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from("request-media").getPublicUrl(filePath);
        mediaRows.push({
          request_id: reqData.id,
          media_url: urlData.publicUrl,
          media_type: file.type.startsWith("video/") ? "video" : "image",
          uploaded_by: userId,
        });
      }
    }

    // 3. Insert request_media rows
    if (mediaRows.length > 0) {
      await supabase.from("request_media").insert(mediaRows);
    }

    // Cleanup
    photoPreviews.forEach(URL.revokeObjectURL);
    setNewDescription("");
    setPhotoFiles([]);
    setPhotoPreviews([]);
    setTimeSlots([]);
    setUploadProgress("");
    setShowNewRequest(false);
    setSubmitting(false);
    fetchData();
  }

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedRequest || !newMessage.trim()) return;
    setSendingMessage(true);

    await supabase.from("messages").insert({
      request_id: selectedRequest.id,
      sender_id: userId,
      sender_name: userName,
      sender_role: "tenant",
      body: newMessage.trim(),
    });

    setNewMessage("");
    setSendingMessage(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/invite");
    router.refresh();
  }

  function toggleExpand(id: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const statusIcon = (status: string) => {
    if (status === "open") return <AlertTriangle className="w-4 h-4 text-danger" />;
    if (status === "in_progress") return <Clock className="w-4 h-4 text-warning" />;
    return <CheckCircle className="w-4 h-4 text-success" />;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-warm-white flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-brand/20 border-t-brand rounded-full animate-spin" />
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="min-h-screen bg-warm-white flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-warning-light flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7 text-warning" />
          </div>
          <h2 className="text-xl font-bold text-charcoal mb-2">No unit linked</h2>
          <p className="text-sm text-charcoal-secondary mb-6">
            Your account isn&apos;t linked to any unit yet. Please use an invite code from your landlord.
          </p>
          <button
            onClick={handleSignOut}
            className="text-sm font-medium text-brand hover:text-brand-dark"
          >
            Sign out and try again
          </button>
        </div>
      </div>
    );
  }

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
              <p className="font-semibold text-charcoal text-sm" style={{ fontFamily: "var(--font-display)" }}>
                PropTrack
              </p>
              <p className="text-xs text-charcoal-tertiary">
                {property?.name} · {unit.label}
              </p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-charcoal-tertiary hover:text-danger transition-colors"
          >
            <LogOut className="w-4 h-4" strokeWidth={1.8} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 page-enter">
        {/* Unit info card */}
        <div className="bg-white rounded-2xl border border-warm-300/50 p-5 mb-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-xl bg-brand-faint flex items-center justify-center">
              <Home className="w-5 h-5 text-brand" strokeWidth={1.8} />
            </div>
            <div>
              <p className="font-semibold text-charcoal">{unit.label}</p>
              <p className="text-sm text-charcoal-secondary">{property?.address || property?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-charcoal-tertiary">
            {unit.move_in_date && <span>Move-in: {unit.move_in_date}</span>}
            <span>
              {requests.filter((r) => r.status !== "resolved").length} active request
              {requests.filter((r) => r.status !== "resolved").length !== 1 ? "s" : ""}
            </span>
          </div>

          {/* My Info — editable name & phone */}
          <div className="mt-4 pt-3 border-t border-warm-300/40 space-y-2">
            <p className="text-xs font-semibold text-charcoal-tertiary uppercase tracking-wider mb-2">My Info</p>
            {/* Name */}
            {editingProfileField === "name" ? (
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-charcoal-tertiary shrink-0" />
                <input type="text" value={editProfileValue} onChange={(e) => setEditProfileValue(e.target.value)}
                  placeholder="Your name" autoFocus
                  className="flex-1 text-sm text-charcoal bg-transparent outline-none border-b border-brand min-w-0"
                  onKeyDown={(e) => { if (e.key === "Enter") saveProfileEdit(); if (e.key === "Escape") cancelEditProfile(); }} />
                <button onClick={saveProfileEdit} disabled={savingProfile} className="text-brand hover:text-brand-dark"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={cancelEditProfile} className="text-charcoal-tertiary hover:text-charcoal"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-charcoal-secondary group">
                <User className="w-3.5 h-3.5 text-charcoal-tertiary shrink-0" />
                <span className="flex-1 min-w-0 truncate">{userName}</span>
                <button onClick={() => startEditProfile("name", userName)}
                  className="text-charcoal-tertiary hover:text-brand transition-colors opacity-0 group-hover:opacity-60 hover:!opacity-100">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
            {/* Phone */}
            {editingProfileField === "phone" ? (
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-charcoal-tertiary shrink-0" />
                <input type="tel" value={editProfileValue} onChange={(e) => setEditProfileValue(e.target.value)}
                  placeholder="Phone number" autoFocus
                  className="flex-1 text-sm text-charcoal bg-transparent outline-none border-b border-brand min-w-0"
                  onKeyDown={(e) => { if (e.key === "Enter") saveProfileEdit(); if (e.key === "Escape") cancelEditProfile(); }} />
                <button onClick={saveProfileEdit} disabled={savingProfile} className="text-brand hover:text-brand-dark"><Check className="w-3.5 h-3.5" /></button>
                <button onClick={cancelEditProfile} className="text-charcoal-tertiary hover:text-charcoal"><X className="w-3.5 h-3.5" /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-charcoal-secondary group">
                <Phone className="w-3.5 h-3.5 text-charcoal-tertiary shrink-0" />
                <span className="flex-1 min-w-0 truncate">{userPhone || <span className="text-charcoal-tertiary italic text-xs">No phone set</span>}</span>
                <button onClick={() => startEditProfile("phone", userPhone)}
                  className="text-charcoal-tertiary hover:text-brand transition-colors opacity-0 group-hover:opacity-60 hover:!opacity-100">
                  <Pencil className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* New request button */}
        <button
          onClick={() => setShowNewRequest(true)}
          className="w-full flex items-center justify-center gap-2 bg-brand hover:bg-brand-dark text-white font-semibold py-3.5 rounded-xl transition-colors mb-6"
        >
          <Plus className="w-5 h-5" />
          Submit maintenance request
        </button>

        {/* New request form modal */}
        {showNewRequest && (
          <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-5">
                <h3 className="text-lg font-bold text-charcoal">New request</h3>
                <button
                  onClick={() => setShowNewRequest(false)}
                  className="p-1 text-charcoal-tertiary hover:text-charcoal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitRequest} className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-charcoal mb-2 block">
                    Category
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {CATEGORIES.map((cat) => (
                      <button
                        key={cat.key}
                        type="button"
                        onClick={() => setNewCategory(cat.key)}
                        className={`text-sm font-medium px-4 py-2 rounded-xl transition-colors ${
                          newCategory === cat.key
                            ? "bg-brand text-white"
                            : "bg-warm-100 text-charcoal-secondary hover:bg-warm-200"
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="text-sm font-medium text-charcoal mb-2 block">
                    What&apos;s the issue?
                  </label>
                  <textarea
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Describe the problem..."
                    rows={4}
                    required
                    className="w-full border border-warm-300 rounded-xl px-4 py-3 text-sm text-charcoal bg-warm-white resize-none outline-none focus:border-brand transition-colors placeholder:text-charcoal-tertiary"
                  />
                </div>

                {/* Photo upload */}
                <div>
                  <label className="text-sm font-medium text-charcoal mb-2 block">
                    Photos <span className="text-danger">*</span>
                    <span className="text-charcoal-tertiary font-normal ml-1">(at least 1 required)</span>
                  </label>

                  {photoPreviews.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {photoPreviews.map((src, i) => (
                        <div key={i} className="relative w-20 h-20 rounded-xl overflow-hidden border border-warm-300/50 group">
                          <img src={src} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                          <button type="button" onClick={() => removePhoto(i)}
                            className="absolute top-0.5 right-0.5 w-5 h-5 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                            <X className="w-3 h-3 text-white" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handlePhotoSelect} className="hidden" />

                  {photoFiles.length < 5 && (
                    <button type="button" onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-dark transition-colors border border-dashed border-warm-300 rounded-xl px-4 py-3 w-full justify-center hover:border-brand">
                      <Camera className="w-4 h-4" />
                      {photoFiles.length === 0 ? "Add photos of the issue" : "Add more photos"}
                      <span className="text-xs text-charcoal-tertiary">({photoFiles.length}/5)</span>
                    </button>
                  )}
                </div>

                {/* Preferred times (optional) */}
                <div>
                  <label className="text-sm font-medium text-charcoal mb-2 block">
                    Preferred times <span className="text-charcoal-tertiary font-normal">(optional, up to 3)</span>
                  </label>

                  {timeSlots.map((slot, i) => (
                    <div key={i} className="flex items-center gap-2 mb-2">
                      <input type="date" value={slot.date} onChange={(e) => {
                        const updated = [...timeSlots];
                        updated[i] = { ...updated[i], date: e.target.value };
                        setTimeSlots(updated);
                      }} className="flex-1 border border-warm-300 rounded-xl px-3 py-2 text-sm text-charcoal bg-warm-white outline-none focus:border-brand" />
                      <input type="time" value={slot.startTime} onChange={(e) => {
                        const updated = [...timeSlots];
                        updated[i] = { ...updated[i], startTime: e.target.value };
                        setTimeSlots(updated);
                      }} className="w-24 border border-warm-300 rounded-xl px-3 py-2 text-sm text-charcoal bg-warm-white outline-none focus:border-brand" />
                      <span className="text-xs text-charcoal-tertiary">to</span>
                      <input type="time" value={slot.endTime} onChange={(e) => {
                        const updated = [...timeSlots];
                        updated[i] = { ...updated[i], endTime: e.target.value };
                        setTimeSlots(updated);
                      }} className="w-24 border border-warm-300 rounded-xl px-3 py-2 text-sm text-charcoal bg-warm-white outline-none focus:border-brand" />
                      <button type="button" onClick={() => setTimeSlots(timeSlots.filter((_, j) => j !== i))}
                        className="p-1 text-charcoal-tertiary hover:text-danger transition-colors shrink-0">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}

                  {timeSlots.length < 3 && (
                    <button type="button" onClick={() => setTimeSlots([...timeSlots, { date: "", startTime: "09:00", endTime: "11:00" }])}
                      className="flex items-center gap-1.5 text-sm font-medium text-brand hover:text-brand-dark transition-colors">
                      <Plus className="w-4 h-4" />Add a preferred time
                    </button>
                  )}
                </div>

                {uploadProgress && (
                  <div className="flex items-center gap-2 text-sm text-brand">
                    <div className="w-4 h-4 border-2 border-brand/20 border-t-brand rounded-full animate-spin" />
                    {uploadProgress}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={submitting || !newDescription.trim() || photoFiles.length === 0}
                  className="w-full bg-brand hover:bg-brand-dark text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-60"
                >
                  {submitting ? "Submitting..." : "Submit request"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* Requests list */}
        <div>
          <h2 className="text-lg font-semibold text-charcoal mb-4">
            Your requests
          </h2>

          {requests.length === 0 ? (
            <div className="bg-white rounded-2xl border border-warm-300/50 p-8 text-center">
              <Wrench className="w-8 h-8 text-charcoal-tertiary mx-auto mb-3" strokeWidth={1.5} />
              <p className="text-sm text-charcoal-secondary">
                No maintenance requests yet. Submit one above if something needs fixing.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {requests.map((req) => {
                const isExpanded = expandedIds.has(req.id);
                return (
                  <div
                    key={req.id}
                    className="bg-white rounded-2xl border border-warm-300/50 overflow-hidden"
                  >
                    <button
                      onClick={() => toggleExpand(req.id)}
                      className="w-full flex items-center justify-between p-4 text-left hover:bg-warm-white/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {statusIcon(req.status)}
                        <div>
                          <p className="text-sm font-medium text-charcoal">
                            {req.description.slice(0, 70)}
                            {req.description.length > 70 ? "..." : ""}
                          </p>
                          <div className="flex items-center gap-3 mt-1">
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md cat-${req.category}`}>
                              {req.category}
                            </span>
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-md status-${req.status}`}>
                              {req.status === "in_progress" ? "In Progress" : req.status === "open" ? "Open" : "Resolved"}
                            </span>
                          </div>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-charcoal-tertiary shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-charcoal-tertiary shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-warm-300/40 p-4">
                        <p className="text-sm text-charcoal-secondary mb-4">
                          {req.description}
                        </p>
                        <p className="text-xs text-charcoal-tertiary mb-4">
                          Submitted{" "}
                          {new Date(req.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </p>

                        {/* Scheduling status */}
                        {req.confirmed_time && (
                          <div className="flex items-center gap-2 bg-success-light rounded-xl px-3 py-2 mb-3">
                            <CheckCircle className="w-3.5 h-3.5 text-success" />
                            <span className="text-xs font-medium text-success">
                              Scheduled: {new Date(req.confirmed_time).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {new Date(req.confirmed_time).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                            </span>
                          </div>
                        )}
                        {req.proposed_times && (req.proposed_times as any[]).length > 0 && !req.confirmed_time && (
                          <p className="text-xs text-charcoal-tertiary mb-3">
                            {(req.proposed_times as any[]).length} time{(req.proposed_times as any[]).length !== 1 ? "s" : ""} proposed — waiting for contractor
                          </p>
                        )}

                        {/* Message thread button */}
                        <button
                          onClick={() => setSelectedRequest(req)}
                          className="flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-dark transition-colors"
                        >
                          <MessageCircle className="w-4 h-4" />
                          Open messages
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Message drawer */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-end sm:items-center justify-center">
          <div className="bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl max-h-[85vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-warm-300/40">
              <div>
                <p className="font-semibold text-charcoal text-sm">Messages</p>
                <p className="text-xs text-charcoal-tertiary">
                  {selectedRequest.description.slice(0, 40)}...
                </p>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 text-charcoal-tertiary hover:text-charcoal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px]">
              {messages.length === 0 ? (
                <p className="text-sm text-charcoal-tertiary text-center py-8">
                  No messages yet. Send one to your landlord.
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`max-w-[80%] ${
                      msg.sender_role === "tenant" ? "ml-auto" : ""
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-4 py-2.5 ${
                        msg.sender_role === "tenant"
                          ? "bg-brand text-white rounded-br-md"
                          : "bg-warm-100 text-charcoal rounded-bl-md"
                      }`}
                    >
                      <p className="text-sm">{msg.body}</p>
                    </div>
                    <p
                      className={`text-[10px] mt-1 ${
                        msg.sender_role === "tenant"
                          ? "text-right text-charcoal-tertiary"
                          : "text-charcoal-tertiary"
                      }`}
                    >
                      {msg.sender_name} ·{" "}
                      {new Date(msg.created_at).toLocaleTimeString("en-US", {
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                    </p>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
              onSubmit={handleSendMessage}
              className="border-t border-warm-300/40 p-4 flex items-center gap-3"
            >
              <input
                type="text"
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 text-sm text-charcoal outline-none bg-warm-white border border-warm-300 rounded-xl px-4 py-2.5 focus:border-brand transition-colors placeholder:text-charcoal-tertiary"
              />
              <button
                type="submit"
                disabled={sendingMessage || !newMessage.trim()}
                className="w-10 h-10 rounded-xl bg-brand hover:bg-brand-dark text-white flex items-center justify-center transition-colors disabled:opacity-60 shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
