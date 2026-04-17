"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { User, Activity, Contact } from "@/lib/types/database";
import { useContactPanel } from "@/components/contacts/contact-panel-context";

type InboxFilter = "all" | "calls" | "sms" | "email";

const FILTERS: { id: InboxFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "calls", label: "Calls" },
  { id: "sms", label: "SMS" },
  { id: "email", label: "Email" },
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
  const { openContact } = useContactPanel();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

  // Compose states
  const [composeType, setComposeType] = useState<"sms" | "email" | null>(null);
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [composeSending, setComposeSending] = useState(false);

  const threadBottomRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    try {
      const [actRes, conRes] = await Promise.all([
        fetch("/api/activities"),
        fetch("/api/contacts"),
      ]);
      const actData = await actRes.json();
      const conData = await conRes.json();
      setActivities(actData.activities ?? []);
      setContacts(conData.contacts ?? []);
    } catch { /* silent */ } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    threadBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedContactId, activities.length]);

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
    const acts = (threadMap.get(contact.id) ?? []).sort(
      (a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime()
    );
    if (acts.length === 0) continue;
    const lastActivity = acts[acts.length - 1];
    threads.push({ contact, activities: acts, lastActivity });
  }

  threads.sort((a, b) => new Date(b.lastActivity.occurred_at).getTime() - new Date(a.lastActivity.occurred_at).getTime());

  const filteredThreads = threads.filter((t) => {
    if (filter !== "all") {
      const hasType = t.activities.some((a) =>
        filter === "calls" ? a.type === "call" || a.type === "voicemail" : a.type === filter
      );
      if (!hasType) return false;
    }
    if (search) {
      const q = search.toLowerCase();
      return t.contact.name.toLowerCase().includes(q) ||
        (t.contact.phone ?? "").includes(q) ||
        (t.contact.email ?? "").toLowerCase().includes(q);
    }
    return true;
  });

  const selectedThread = filteredThreads.find((t) => t.contact.id === selectedContactId) ?? filteredThreads[0] ?? null;
  const selectedContact = selectedThread?.contact ?? null;

  const threadActivities = (selectedThread?.activities ?? []).filter((a) => {
    if (filter === "all") return true;
    if (filter === "calls") return a.type === "call" || a.type === "voicemail";
    return a.type === filter;
  });

  async function handleSend() {
    if (!composeBody.trim()) return;
    setComposeSending(true);
    try {
      if (composeType === "sms") {
        await fetch("/api/comms/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: composeTo, message: composeBody, contact_id: selectedContact?.id }),
        });
      } else if (composeType === "email") {
        await fetch("/api/comms/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: composeTo, subject: composeSubject, text: composeBody, contact_id: selectedContact?.id }),
        });
      }
      setComposeBody("");
      setComposeSubject("");
      setComposeType(null);
      fetchData();
    } catch { /* silent */ } finally {
      setComposeSending(false);
    }
  }

  function openCompose(type: "sms" | "email") {
    setComposeType(type);
    if (selectedContact) {
      setComposeTo(type === "sms" ? (selectedContact.phone ?? "") : (selectedContact.email ?? ""));
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      {/* Left: Contact thread list */}
      <div
        className="flex flex-col border-r border-[var(--color-border)] shrink-0"
        style={{ width: 300 }}
      >
        {/* Header */}
        <div className="border-b border-[var(--color-border)]" style={{ padding: "20px 16px 12px" }}>
          <h1 className="text-[18px] font-semibold text-[var(--color-text-primary)]" style={{ marginBottom: 10 }}>Inbox</h1>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search contacts..."
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40"
            style={{ padding: "7px 10px" }}
          />
          <div className="flex gap-1" style={{ marginTop: 8 }}>
            {FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className="flex-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer"
                style={{
                  padding: "4px 0",
                  background: filter === f.id ? "var(--color-accent)" : "var(--color-surface-hover)",
                  color: filter === f.id ? "white" : "var(--color-text-tertiary)",
                }}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Thread list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-[13px] text-[var(--color-text-tertiary)] text-center" style={{ padding: 32 }}>Loading...</p>
          ) : filteredThreads.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-tertiary)] text-center" style={{ padding: 32 }}>No conversations yet.</p>
          ) : filteredThreads.map((t) => {
            const isSelected = t.contact.id === selectedThread?.contact.id;
            const initials = t.contact.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase();
            return (
              <button
                key={t.contact.id}
                onClick={() => setSelectedContactId(t.contact.id)}
                className="w-full text-left flex items-center gap-3 transition-colors cursor-pointer border-b border-[var(--color-border)]/50"
                style={{
                  padding: "12px 16px",
                  background: isSelected ? "var(--color-surface-hover)" : "transparent",
                }}
              >
                <div
                  className="flex items-center justify-center rounded-full shrink-0 text-[12px] font-semibold text-white"
                  style={{ width: 36, height: 36, background: "var(--color-accent)" }}
                >
                  {initials}
                </div>
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

      {/* Right: Conversation thread */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedThread ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[14px] text-[var(--color-text-tertiary)]">Select a contact to view their conversation</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div className="flex items-center justify-between border-b border-[var(--color-border)]" style={{ padding: "14px 24px" }}>
              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-full text-[13px] font-semibold text-white"
                  style={{ width: 36, height: 36, background: "var(--color-accent)" }}
                >
                  {selectedContact!.name.split(" ").map((w: string) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-[15px] font-semibold text-[var(--color-text-primary)]">{selectedContact!.name}</p>
                  <p className="text-[11px] text-[var(--color-text-tertiary)]">
                    {selectedContact!.phone ?? ""}{selectedContact!.phone && selectedContact!.email ? " · " : ""}{selectedContact!.email ?? ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openContact(selectedContact!)}
                  className="rounded-lg border border-[var(--color-border)] text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                  style={{ padding: "6px 12px" }}
                >
                  View Contact
                </button>
                <button
                  onClick={() => openCompose("sms")}
                  className="rounded-lg border border-[var(--color-border)] text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                  style={{ padding: "6px 12px" }}
                >
                  💬 SMS
                </button>
                <button
                  onClick={() => openCompose("email")}
                  className="rounded-lg border border-[var(--color-border)] text-[12px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                  style={{ padding: "6px 12px" }}
                >
                  ✉️ Email
                </button>
                <button
                  className="rounded-lg bg-[var(--color-accent)] text-white text-[12px] font-medium hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
                  style={{ padding: "6px 12px" }}
                >
                  📞 Call
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto" style={{ padding: "20px 24px" }}>
              {threadActivities.length === 0 ? (
                <p className="text-[13px] text-[var(--color-text-tertiary)] text-center" style={{ paddingTop: 40 }}>No {filter === "all" ? "activity" : filter} with this contact.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {threadActivities.map((a) => {
                    const isOutbound = a.direction === "outbound";
                    const isMessage = a.type === "sms" || a.type === "email";
                    return (
                      <div key={a.id} style={{ display: "flex", flexDirection: isOutbound && isMessage ? "row-reverse" : "row", gap: 12, alignItems: "flex-end" }}>
                        {!isMessage && (
                          <div
                            className="flex items-center justify-center rounded-full shrink-0 text-[14px]"
                            style={{ width: 32, height: 32, background: "var(--color-surface-hover)" }}
                          >
                            {activityIcon(a.type)}
                          </div>
                        )}
                        <div style={{ maxWidth: "70%", flex: isMessage ? "0 1 auto" : "1" }}>
                          {isMessage ? (
                            <div
                              className="rounded-2xl text-[13px] leading-relaxed"
                              style={{
                                padding: "10px 14px",
                                background: isOutbound ? "var(--color-accent)" : "var(--color-surface-hover)",
                                color: isOutbound ? "white" : "var(--color-text-primary)",
                                borderBottomRightRadius: isOutbound ? 4 : 16,
                                borderBottomLeftRadius: isOutbound ? 16 : 4,
                              }}
                            >
                              {a.type === "email" && (
                                <p className="text-[11px] font-medium opacity-70" style={{ marginBottom: 4 }}>
                                  ✉️ {(a.metadata as Record<string, string>)?.subject ?? "Email"}
                                </p>
                              )}
                              {a.content || a.ai_summary || "(no content)"}
                            </div>
                          ) : (
                            <div
                              className="rounded-xl border border-[var(--color-border)]"
                              style={{ padding: "10px 14px" }}
                            >
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
                                  {a.type === "voicemail" ? "Voicemail" : a.direction === "inbound" ? "Inbound call" : "Outbound call"}
                                </span>
                                {a.duration_seconds != null && (
                                  <span className="text-[11px] text-[var(--color-text-tertiary)]">
                                    {Math.floor(a.duration_seconds / 60)}:{String(a.duration_seconds % 60).padStart(2, "0")}
                                  </span>
                                )}
                              </div>
                              {a.ai_summary && (
                                <p className="text-[12px] text-[var(--color-text-secondary)]" style={{ marginTop: 4 }}>{a.ai_summary}</p>
                              )}
                              {a.transcript && (
                                <p className="text-[11px] text-[var(--color-accent)]" style={{ marginTop: 4 }}>📝 Transcript available</p>
                              )}
                            </div>
                          )}
                          <p
                            className="text-[10px] text-[var(--color-text-tertiary)]"
                            style={{ marginTop: 3, textAlign: isOutbound && isMessage ? "right" : "left" }}
                          >
                            {new Date(a.occurred_at).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={threadBottomRef} />
                </div>
              )}
            </div>

            {/* Compose panel */}
            {composeType && (
              <div className="border-t border-[var(--color-border)]" style={{ padding: "14px 24px" }}>
                <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
                  <span className="text-[12px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
                    {composeType === "sms" ? "💬 Reply via SMS" : "✉️ Reply via Email"}
                  </span>
                  <button onClick={() => setComposeType(null)} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] cursor-pointer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                  </button>
                </div>
                {composeType === "email" && (
                  <input
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    placeholder="Subject"
                    className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
                    style={{ padding: "8px 12px", marginBottom: 8 }}
                  />
                )}
                <div className="flex gap-2">
                  <textarea
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    placeholder={composeType === "sms" ? "Type your message..." : "Write your email..."}
                    rows={composeType === "email" ? 4 : 2}
                    className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none resize-none"
                    style={{ padding: "8px 12px" }}
                  />
                  <button
                    onClick={handleSend}
                    disabled={!composeBody.trim() || composeSending}
                    className="self-end flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-30 hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
                    style={{ width: 36, height: 36, flexShrink: 0 }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
