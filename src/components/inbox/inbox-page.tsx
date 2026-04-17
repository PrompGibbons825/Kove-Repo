"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { User, Activity, Contact, ContactStatus } from "@/lib/types/database";
import { useCall, formatDuration, type CallState } from "@/hooks/use-call";
import { useLiveTranscript } from "@/hooks/use-live-transcript";
import { LiveSession } from "@/components/calls/live-session";
import { ContactMessaging } from "@/components/contacts/contact-messaging";

type InboxFilter = "all" | "calls" | "sms" | "email";

const FILTERS: { id: InboxFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "calls", label: "Calls" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
];

const STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "qualifying", label: "Qualifying" },
  { value: "qualified", label: "Qualified" },
  { value: "closing", label: "Closing" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "renewal", label: "Renewal" },
];

interface Thread {
  contact: Contact;
  activities: Activity[];
  lastActivity: Activity;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(dateStr).toLocaleDateString();
}

function activityIcon(type: string) {
  switch (type) {
    case "call": return "📞";
    case "sms": return "💬";
    case "email": return "✉️";
    case "voicemail": return "📱";
    case "note": return "📝";
    default: return "•";
  }
}

function activityPreview(a: Activity): string {
  if (a.type === "call") return a.duration_seconds != null ? `Call · ${Math.floor(a.duration_seconds / 60)}:${String(a.duration_seconds % 60).padStart(2, "0")}` : "Call";
  if (a.type === "voicemail") return "Voicemail";
  return a.content || a.ai_summary || a.type;
}

export default function InboxPage({ user: _user }: { user: User }) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // Contact detail state (right sidebar)
  const [contactActivities, setContactActivities] = useState<Activity[]>([]);
  const [loadingContactActivities, setLoadingContactActivities] = useState(false);
  const [status, setStatus] = useState<ContactStatus>("new");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [orgMembers, setOrgMembers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [pipelineOptions, setPipelineOptions] = useState<string[]>([]);
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);

  // ── Call state ──
  const [callSummaryLoading, setCallSummaryLoading] = useState(false);
  const transcriptRef = useRef<{ getFullTranscript: () => string; reset: () => void } | null>(null);

  const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? null;

  const { callState, muted, duration, remoteStream, startCall, endCall, toggleMute } = useCall({
    onCallStarted: () => {},
    onCallEnded: async (info) => {
      try {
        const transcript = transcriptRef.current?.getFullTranscript?.() ?? "";
        const cId = selectedContactId;
        if (transcript && cId) {
          setCallSummaryLoading(true);
          try {
            const res = await fetch("/api/ai/call-summary", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ contactId: cId, transcript, duration: info.duration, direction: "outbound" }),
            });
            if (res.ok) {
              const data = await res.json();
              if (data.summary?.contact_summary_update) {
                updateContactLocal({ ai_summary: data.summary.contact_summary_update });
              }
              if (data.summary?.suggested_next_status) {
                updateContactLocal({ status: data.summary.suggested_next_status });
                setStatus(data.summary.suggested_next_status);
              }
              refreshContactActivities(cId);
            }
          } catch (err) { console.error("[call-summary] failed:", err); }
          setCallSummaryLoading(false);
        }
        transcriptRef.current?.reset?.();
      } catch (err) {
        console.error("[onCallEnded] error:", err);
        setCallSummaryLoading(false);
      }
    },
  });

  const transcriptHook = useLiveTranscript({ remoteStream, active: callState === "active" });
  useEffect(() => { transcriptRef.current = transcriptHook; });

  // ── Data fetching ──
  const fetchData = useCallback(async () => {
    try {
      const [actRes, conRes] = await Promise.all([fetch("/api/activities"), fetch("/api/contacts")]);
      const actData = await actRes.json();
      const conData = await conRes.json();
      setActivities(actData.activities ?? []);
      setContacts(conData.contacts ?? []);
    } catch { /* silent */ } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    fetch("/api/users").then((r) => r.json()).then((data) => setOrgMembers(data.users ?? [])).catch(() => {});
    fetch("/api/settings/org").then((r) => r.json()).then((data) => {
      setPipelineOptions(data.pipeline_options ?? []);
      setSourceOptions(data.source_options ?? []);
    }).catch(() => {});
  }, []);

  function refreshContactActivities(contactId: string) {
    fetch(`/api/activities?contact_id=${contactId}`)
      .then((r) => r.json())
      .then((d) => setContactActivities(Array.isArray(d) ? d : (d.activities ?? [])))
      .catch(() => {});
  }

  // When selected contact changes, load their activities
  useEffect(() => {
    if (!selectedContactId) return;
    setLoadingContactActivities(true);
    fetch(`/api/activities?contact_id=${selectedContactId}`)
      .then((r) => r.json())
      .then((data) => setContactActivities(Array.isArray(data) ? data : (data.activities ?? [])))
      .catch(() => {})
      .finally(() => setLoadingContactActivities(false));
    const c = contacts.find((c) => c.id === selectedContactId);
    if (c) setStatus(c.status);
  }, [selectedContactId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Threads ──
  const commTypes = ["call", "sms", "email", "voicemail"];
  const commActivities = activities.filter((a) => commTypes.includes(a.type));
  const threadMap = new Map<string, Activity[]>();
  for (const a of commActivities) {
    if (!a.contact_id) continue;
    if (!threadMap.has(a.contact_id)) threadMap.set(a.contact_id, []);
    threadMap.get(a.contact_id)!.push(a);
  }
  const threads: Thread[] = [];
  for (const contact of contacts) {
    const acts = (threadMap.get(contact.id) ?? []).sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
    if (acts.length === 0) continue;
    threads.push({ contact, activities: acts, lastActivity: acts[acts.length - 1] });
  }
  threads.sort((a, b) => new Date(b.lastActivity.occurred_at).getTime() - new Date(a.lastActivity.occurred_at).getTime());

  const filteredThreads = threads.filter((t) => {
    if (filter !== "all") {
      const hasType = t.activities.some((a) => filter === "calls" ? a.type === "call" || a.type === "voicemail" : a.type === filter);
      if (!hasType) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return t.contact.name.toLowerCase().includes(q) || (t.contact.phone ?? "").includes(q) || (t.contact.email ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const selectedThread = filteredThreads.find((t) => t.contact.id === selectedContactId) ?? null;

  // Auto-select first thread
  useEffect(() => {
    if (!selectedContactId && filteredThreads.length > 0) {
      setSelectedContactId(filteredThreads[0].contact.id);
    }
  }, [filteredThreads.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateContactLocal(partial: Partial<Contact>) {
    setContacts((prev) => prev.map((c) => c.id === selectedContactId ? { ...c, ...partial } : c));
  }

  async function handleStatusChange(newStatus: ContactStatus) {
    if (!selectedContact) return;
    setStatus(newStatus);
    await fetch(`/api/contacts/${selectedContact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: newStatus }) });
    updateContactLocal({ status: newStatus });
  }

  async function handleFieldSave(field: string, value: string) {
    if (!selectedContact) return;
    const update: Partial<Contact> = { [field]: value || null };
    await fetch(`/api/contacts/${selectedContact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(update) });
    updateContactLocal(update);
  }

  async function handleAddNote() {
    if (!note.trim() || !selectedContact) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/activities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contact_id: selectedContact.id, type: "note", content: note.trim() }) });
      if (res.ok) {
        const created = await res.json();
        setContactActivities((prev) => [created.activity ?? created, ...prev]);
        setNote("");
      }
    } catch {} finally { setSavingNote(false); }
  }

  const handleStartCall = useCallback(() => {
    if (!selectedContact?.phone) return;
    startCall(selectedContact.phone);
  }, [selectedContact?.phone, startCall]);

  const handleCallAction = useCallback(async (action: string, params?: Record<string, unknown>) => {
    if (!selectedContact) return;
    try {
      await fetch("/api/ai/call-actions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, contactId: selectedContact.id, params }) });
      refreshContactActivities(selectedContact.id);
      if (action === "advance_status") {
        fetch(`/api/contacts/${selectedContact.id}`).then((r) => r.json()).then((c) => { if (c.status) { updateContactLocal({ status: c.status }); setStatus(c.status); } }).catch(() => {});
      }
    } catch {}
  }, [selectedContact]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleUpdateActivity(id: string, content: string) {
    const res = await fetch(`/api/activities/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    if (res.ok) {
      setContactActivities((prev) => prev.map((a) => a.id === id ? { ...a, content } : a));
    }
  }

  async function handleDeleteActivity(id: string) {
    const res = await fetch(`/api/activities/${id}`, { method: "DELETE" });
    if (res.ok) {
      setContactActivities((prev) => prev.filter((a) => a.id !== id));
    }
  }

  const isInCall = callState !== "idle";

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left column: Thread list ── */}
      <div className="flex flex-col border-r border-[var(--color-border)] shrink-0" style={{ width: 300 }}>
        <div className="border-b border-[var(--color-border)]" style={{ padding: "20px 16px 12px" }}>
          <h1 className="text-[18px] font-semibold text-[var(--color-text-primary)]" style={{ marginBottom: 10 }}>Inbox</h1>
          <input
            value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts..."
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40"
            style={{ padding: "7px 10px" }}
          />
          <div className="flex gap-1" style={{ marginTop: 8 }}>
            {FILTERS.map((f) => (
              <button key={f.id} onClick={() => setFilter(f.id)}
                className="flex-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                style={{ padding: "4px 0", background: filter === f.id ? "var(--color-accent)" : "var(--color-surface-hover)", color: filter === f.id ? "white" : "var(--color-text-tertiary)" }}
              >{f.label}</button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-[13px] text-[var(--color-text-tertiary)] text-center" style={{ padding: 32 }}>Loading...</p>
          ) : filteredThreads.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-tertiary)] text-center" style={{ padding: 32 }}>No conversations yet.</p>
          ) : filteredThreads.map((t) => {
            const isSelected = t.contact.id === selectedContactId;
            const initials = t.contact.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <button key={t.contact.id} onClick={() => setSelectedContactId(t.contact.id)}
                className="w-full text-left flex items-center gap-3 transition-colors cursor-pointer border-b border-[var(--color-border)]/50"
                style={{ padding: "12px 16px", background: isSelected ? "var(--color-surface-hover)" : "transparent" }}
              >
                <div className="flex items-center justify-center rounded-full shrink-0 text-[12px] font-semibold text-white" style={{ width: 36, height: 36, background: "var(--color-accent)" }}>{initials}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{t.contact.name}</span>
                    <span className="text-[11px] text-[var(--color-text-tertiary)] shrink-0" style={{ marginLeft: 8 }}>{timeAgo(t.lastActivity.occurred_at)}</span>
                  </div>
                  <p className="text-[12px] text-[var(--color-text-tertiary)] truncate" style={{ marginTop: 1 }}>
                    {activityIcon(t.lastActivity.type)} {activityPreview(t.lastActivity)}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Center column: Messaging or Live Session ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedContact ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[14px] text-[var(--color-text-tertiary)]">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Header with call button */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)]" style={{ padding: "14px 24px" }}>
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center rounded-full text-[13px] font-semibold text-white" style={{ width: 36, height: 36, background: "var(--color-accent)" }}>
                  {selectedContact.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">{selectedContact.name}</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)]">
                    {selectedContact.phone ?? ""}{selectedContact.phone && selectedContact.email ? " · " : ""}{selectedContact.email ?? ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedContact.phone && (
                  <button onClick={callState === "idle" ? handleStartCall : endCall}
                    className="flex items-center gap-1.5 rounded-lg text-white text-[12px] font-medium transition-colors cursor-pointer"
                    style={{ padding: "6px 14px", background: isInCall ? "#ef4444" : "var(--color-accent)" }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={isInCall ? { transform: "rotate(135deg)" } : {}}>
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                    </svg>
                    {isInCall ? "End Call" : "Call"}
                  </button>
                )}
              </div>
            </div>

            {/* Call bar */}
            {isInCall && (
              <div className="flex items-center justify-between border-b border-[var(--color-border)]"
                style={{ padding: "8px 24px", background: callState === "active" ? "rgba(34,197,94,0.08)" : "var(--color-surface-hover)" }}
              >
                <div className="flex items-center gap-3">
                  <div className="rounded-full animate-pulse" style={{ width: 10, height: 10, background: callState === "active" ? "#22c55e" : "#f59e0b" }} />
                  <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
                    {callState === "connecting" ? "Connecting..." : callState === "ringing" ? "Ringing..." : callSummaryLoading ? "Generating summary..." : `In Call — ${formatDuration(duration)}`}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {callState === "active" && (
                    <button onClick={toggleMute} title={muted ? "Unmute" : "Mute"}
                      className="flex items-center justify-center rounded-lg transition-colors cursor-pointer"
                      style={{ width: 32, height: 32, background: muted ? "var(--color-accent)" : "var(--color-surface-hover)", color: muted ? "white" : "var(--color-text-secondary)" }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        {muted ? (
                          <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /><line x1="2" x2="22" y1="2" y2="22" /></>
                        ) : (
                          <><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></>
                        )}
                      </svg>
                    </button>
                  )}
                  <button onClick={endCall} className="flex items-center justify-center rounded-lg text-white transition-colors cursor-pointer"
                    style={{ height: 32, padding: "0 12px", background: "#ef4444", fontSize: 12, fontWeight: 600 }}>End Call</button>
                </div>
              </div>
            )}

            {/* Dynamic center: LiveSession during call, Messaging otherwise */}
            {isInCall ? (
              <div className="flex-1 flex flex-col overflow-hidden">
                <LiveSession active={callState === "active"} entries={transcriptHook.entries} contact={selectedContact} onAction={handleCallAction} callDuration={duration} />
              </div>
            ) : (
              <ContactMessaging contact={selectedContact} />
            )}
          </>
        )}
      </div>

      {/* ── Right column: Contact detail sidebar ── */}
      {selectedContact && (
        <div className="border-l border-[var(--color-border)] overflow-y-auto shrink-0" style={{ width: 320, padding: "20px 20px" }}>
          {/* Avatar + Name */}
          <div className="flex items-center gap-3" style={{ marginBottom: 20 }}>
            <div className="flex items-center justify-center rounded-full text-[14px] font-semibold text-white shrink-0" style={{ width: 44, height: 44, background: "var(--color-accent)" }}>
              {selectedContact.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-[16px] font-semibold text-[var(--color-text-primary)] truncate">{selectedContact.name}</p>
              <p className="text-[11px] text-[var(--color-text-tertiary)] truncate">{selectedContact.source ?? "No source"}</p>
            </div>
          </div>

          {/* Status */}
          <div style={{ marginBottom: 16 }}>
            <SidebarLabel>Status</SidebarLabel>
            <div className="flex items-center gap-1.5">
              <button onClick={() => { const idx = STATUS_OPTIONS.findIndex((o) => o.value === status); if (idx > 0) handleStatusChange(STATUS_OPTIONS[idx - 1].value); }}
                className="flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] cursor-pointer" style={{ width: 26, height: 26 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <span className="rounded-full text-[12px] font-semibold text-white text-center" style={{ padding: "3px 14px", background: "var(--color-accent)", flex: 1 }}>
                {STATUS_OPTIONS.find((o) => o.value === status)?.label ?? status}
              </span>
              <button onClick={() => { const idx = STATUS_OPTIONS.findIndex((o) => o.value === status); if (idx < STATUS_OPTIONS.length - 1) handleStatusChange(STATUS_OPTIONS[idx + 1].value); }}
                className="flex items-center justify-center rounded border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] cursor-pointer" style={{ width: 26, height: 26 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 gap-2" style={{ marginBottom: 16 }}>
            <SidebarField label="Phone" value={selectedContact.phone ?? ""} onSave={(v) => handleFieldSave("phone", v)} />
            <SidebarField label="Email" value={selectedContact.email ?? ""} onSave={(v) => handleFieldSave("email", v)} />
            <SidebarSelect label="Pipeline" value={selectedContact.pipeline_stage ?? ""} options={pipelineOptions} onSave={(v) => handleFieldSave("pipeline_stage", v)} />
            <SidebarSelect label="Source" value={selectedContact.source ?? ""} options={sourceOptions} onSave={(v) => handleFieldSave("source", v)} />
          </div>

          {/* Assigned Members */}
          <SidebarAssigned contact={selectedContact} orgMembers={orgMembers} updateContact={updateContactLocal} />

          {/* AI Summary */}
          {selectedContact.ai_summary && (
            <div style={{ marginBottom: 16 }}>
              <SidebarLabel>AI Summary</SidebarLabel>
              <div className="rounded-lg border border-[var(--color-accent)]/15 text-[12px] text-[var(--color-text-secondary)] leading-relaxed" style={{ padding: "8px 12px", background: "var(--color-accent-soft)" }}>
                {selectedContact.ai_summary}
              </div>
            </div>
          )}

          {/* Handoff Notes */}
          {selectedContact.handoff_notes && (
            <div style={{ marginBottom: 16 }}>
              <SidebarLabel>Handoff Notes</SidebarLabel>
              <div className="rounded-lg border border-[var(--color-border)] text-[12px] text-[var(--color-text-secondary)] leading-relaxed" style={{ padding: "8px 12px", background: "var(--color-surface-hover)" }}>
                {selectedContact.handoff_notes}
              </div>
            </div>
          )}

          {/* Add Note */}
          <div style={{ marginBottom: 16 }}>
            <SidebarLabel>Add Note</SidebarLabel>
            <div className="flex gap-1.5">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Type a note..." rows={2}
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 resize-none"
                style={{ padding: "6px 10px" }}
              />
              <button onClick={handleAddNote} disabled={!note.trim() || savingNote}
                className="self-end flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-30 hover:bg-[var(--color-accent-hover)] cursor-pointer"
                style={{ width: 30, height: 30 }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
              </button>
            </div>
          </div>

          {/* Timeline */}
          <SidebarLabel>Timeline</SidebarLabel>
          {loadingContactActivities ? (
            <p className="text-[12px] text-[var(--color-text-tertiary)]">Loading...</p>
          ) : contactActivities.length === 0 ? (
            <div className="text-center text-[12px] text-[var(--color-text-tertiary)] rounded-lg border border-dashed border-[var(--color-border)]" style={{ padding: "16px 12px" }}>
              No activity yet.
            </div>
          ) : (
            <div className="space-y-3">
              {contactActivities.map((a) => (
                <InboxTimelineEntry key={a.id} activity={a} onUpdate={handleUpdateActivity} onDelete={handleDeleteActivity} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ── Sidebar sub-components ── */

function SidebarLabel({ children }: { children: React.ReactNode }) {
  return <label className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 6 }}>{children}</label>;
}

function SidebarField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);
  function commit() { setEditing(false); if (draft.trim() !== value) onSave(draft.trim()); }
  return (
    <div className="rounded-lg border border-[var(--color-border)] cursor-text hover:border-[var(--color-accent)]/40 transition-colors" style={{ padding: "6px 10px" }} onClick={() => !editing && setEditing(true)}>
      <p className="text-[9px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">{label}</p>
      {editing ? (
        <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          className="w-full text-[12px] text-[var(--color-text-primary)] font-medium bg-transparent border-none outline-none p-0" style={{ marginTop: 2 }} />
      ) : (
        <p className="text-[12px] text-[var(--color-text-primary)] font-medium truncate" style={{ marginTop: 2 }}>{value || "—"}</p>
      )}
    </div>
  );
}

function SidebarSelect({ label, value, options, onSave }: { label: string; value: string; options: string[]; onSave: (v: string) => void }) {
  if (options.length === 0) return <SidebarField label={label} value={value} onSave={onSave} />;
  return (
    <div className="rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)]/40 transition-colors" style={{ padding: "6px 10px" }}>
      <p className="text-[9px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">{label}</p>
      <select value={value} onChange={(e) => onSave(e.target.value)}
        className="w-full text-[12px] text-[var(--color-text-primary)] font-medium bg-transparent border-none outline-none cursor-pointer p-0" style={{ marginTop: 2 }}>
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function SidebarAssigned({ contact, orgMembers, updateContact }: {
  contact: Contact; orgMembers: { id: string; full_name: string; email: string }[]; updateContact: (partial: Partial<Contact>) => void;
}) {
  const [showPicker, setShowPicker] = useState(false);
  const assigned = contact.assigned_to ?? [];
  const assignedMembers = orgMembers.filter((m) => assigned.includes(m.id));
  const unassigned = orgMembers.filter((m) => !assigned.includes(m.id));

  async function addMember(userId: string) {
    const newAssigned = [...assigned, userId];
    await fetch(`/api/contacts/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assigned_to: newAssigned }) });
    updateContact({ assigned_to: newAssigned });
    setShowPicker(false);
  }
  async function removeMember(userId: string) {
    const newAssigned = assigned.filter((id: string) => id !== userId);
    await fetch(`/api/contacts/${contact.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ assigned_to: newAssigned }) });
    updateContact({ assigned_to: newAssigned });
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 6 }}>
        <SidebarLabel>Assigned</SidebarLabel>
        <button onClick={() => setShowPicker(!showPicker)} className="text-[10px] font-medium text-[var(--color-accent)] hover:underline cursor-pointer">+ Add</button>
      </div>
      {assignedMembers.length === 0 ? (
        <p className="text-[11px] text-[var(--color-text-tertiary)] italic">None assigned</p>
      ) : (
        <div className="space-y-1">
          {assignedMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)]" style={{ padding: "4px 8px" }}>
              <span className="text-[11px] text-[var(--color-text-primary)]">{m.full_name}</span>
              <button onClick={() => removeMember(m.id)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] cursor-pointer">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      {showPicker && unassigned.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]" style={{ marginTop: 6 }}>
          {unassigned.map((m) => (
            <button key={m.id} onClick={() => addMember(m.id)}
              className="w-full text-left text-[11px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] cursor-pointer" style={{ padding: "4px 8px" }}>
              {m.full_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function inboxTimelineIcon(type: string) {
  switch (type) {
    case "call": return "📞";
    case "sms": return "💬";
    case "email": return "✉️";
    case "voicemail": return "📱";
    case "note": return "📝";
    default: return "•";
  }
}

function inboxTimelineLabel(type: string, direction?: string | null) {
  if (type === "call") return direction === "inbound" ? "Inbound call" : "Outbound call";
  if (type === "sms") return direction === "inbound" ? "Inbound SMS" : "Outbound SMS";
  if (type === "email") return direction === "inbound" ? "Inbound email" : "Outbound email";
  if (type === "voicemail") return "Voicemail";
  return "Note";
}

function InboxTimelineEntry({
  activity,
  onUpdate,
  onDelete,
}: {
  activity: Activity & { user_name?: string | null };
  onUpdate: (id: string, content: string) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(activity.content ?? "");
  const [deleting, setDeleting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const isNote = activity.type === "note";

  useEffect(() => { setDraft(activity.content ?? ""); }, [activity.content]);
  useEffect(() => { if (editing) textareaRef.current?.focus(); }, [editing]);

  function commitEdit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== activity.content) onUpdate(activity.id, trimmed);
    else setDraft(activity.content ?? "");
  }

  const displayText = activity.ai_summary ?? activity.content ?? activity.type;
  const attribution = activity.user_name ?? (activity.direction === "inbound" ? "Contact" : null);

  return (
    <div className="flex gap-2 group">
      <div className="flex items-start justify-center rounded-full shrink-0" style={{ width: 24, height: 24, marginTop: 2, background: "var(--color-surface-hover)" }}>
        <span style={{ fontSize: 10, lineHeight: "24px" }}>{inboxTimelineIcon(activity.type)}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1 flex-wrap" style={{ marginBottom: 1 }}>
          <span className="text-[10px] font-medium text-[var(--color-text-secondary)]">
            {inboxTimelineLabel(activity.type, activity.direction)}
          </span>
          {attribution && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">by {attribution}</span>
          )}
          {activity.duration_seconds != null && (
            <span className="text-[10px] text-[var(--color-text-tertiary)]">
              · {Math.floor(activity.duration_seconds / 60)}:{String(activity.duration_seconds % 60).padStart(2, "0")}
            </span>
          )}
        </div>
        {editing ? (
          <div className="flex gap-1 items-end" style={{ marginTop: 3 }}>
            <textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              className="flex-1 rounded-lg border border-[var(--color-accent)]/40 bg-[var(--color-background)] text-[11px] text-[var(--color-text-primary)] focus:outline-none resize-none"
              style={{ padding: "4px 8px" }}
            />
            <div className="flex flex-col gap-1">
              <button onClick={commitEdit}
                className="flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-white cursor-pointer"
                style={{ width: 24, height: 24 }}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M20 6 9 17l-5-5"/></svg>
              </button>
              <button onClick={() => { setEditing(false); setDraft(activity.content ?? ""); }}
                className="flex items-center justify-center rounded-lg border border-[var(--color-border)] text-[var(--color-text-tertiary)] cursor-pointer"
                style={{ width: 24, height: 24 }}>
                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed text-[var(--color-text-primary)]" style={{ whiteSpace: "pre-wrap" }}>
            {displayText}
          </p>
        )}
        <p className="text-[9px] text-[var(--color-text-tertiary)]" style={{ marginTop: 1 }}>
          {new Date(activity.occurred_at).toLocaleString()}
        </p>
      </div>
      {isNote && !editing && (
        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button onClick={() => setEditing(true)} title="Edit note"
            className="flex items-center justify-center rounded text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] cursor-pointer"
            style={{ width: 20, height: 20 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
          </button>
          <button onClick={() => { setDeleting(true); onDelete(activity.id); }} disabled={deleting} title="Delete note"
            className="flex items-center justify-center rounded text-[var(--color-text-tertiary)] hover:text-red-500 hover:bg-[var(--color-surface-hover)] cursor-pointer disabled:opacity-30"
            style={{ width: 20, height: 20 }}>
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
          </button>
        </div>
      )}
    </div>
  );
}
