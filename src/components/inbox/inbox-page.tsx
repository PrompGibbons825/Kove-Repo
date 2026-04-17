"use client";

import { useState, useEffect, useCallback } from "react";
import type { User, Activity, Contact } from "@/lib/types/database";
import { ContactPanelProvider, useContactPanel } from "@/components/contacts/contact-panel-context";
import { ContactDetail } from "@/components/contacts/contact-detail";
import { ContactMessaging } from "@/components/contacts/contact-messaging";

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

// ── Inner component (needs ContactPanelProvider above it) ──
function InboxContent() {
  const { openContact } = useContactPanel();

  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<InboxFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);

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

  // ── Build threads ──
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
    threads.push({ contact, activities: acts, lastActivity: acts[acts.length - 1] });
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
      return (
        t.contact.name.toLowerCase().includes(q) ||
        (t.contact.phone ?? "").includes(q) ||
        (t.contact.email ?? "").toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Auto-select first thread
  useEffect(() => {
    if (!selectedContactId && filteredThreads.length > 0) {
      const first = filteredThreads[0].contact;
      setSelectedContactId(first.id);
      openContact(first, "sidebar");
    }
  }, [filteredThreads.length]); // eslint-disable-line react-hooks/exhaustive-deps

  function selectThread(contact: Contact) {
    setSelectedContactId(contact.id);
    openContact(contact, "sidebar");
  }

  const selectedContact = contacts.find((c) => c.id === selectedContactId) ?? null;

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── Left column: Thread list ── */}
      <div className="flex flex-col border-r border-[var(--color-border)] shrink-0" style={{ width: 300 }}>
        <div className="border-b border-[var(--color-border)]" style={{ padding: "20px 16px 12px" }}>
          <h1 className="text-[18px] font-semibold text-[var(--color-text-primary)]" style={{ marginBottom: 10 }}>
            Inbox
          </h1>
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

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <p className="text-[13px] text-[var(--color-text-tertiary)] text-center" style={{ padding: 32 }}>
              Loading...
            </p>
          ) : filteredThreads.length === 0 ? (
            <p className="text-[13px] text-[var(--color-text-tertiary)] text-center" style={{ padding: 32 }}>
              No conversations yet.
            </p>
          ) : (
            filteredThreads.map((t) => {
              const isSelected = t.contact.id === selectedContactId;
              const initials = t.contact.name
                .split(" ")
                .map((w: string) => w[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              return (
                <button
                  key={t.contact.id}
                  onClick={() => selectThread(t.contact)}
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
                      <span className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">
                        {t.contact.name}
                      </span>
                      <span className="text-[11px] text-[var(--color-text-tertiary)] shrink-0" style={{ marginLeft: 8 }}>
                        {timeAgo(t.lastActivity.occurred_at)}
                      </span>
                    </div>
                    <p className="text-[12px] text-[var(--color-text-tertiary)] truncate" style={{ marginTop: 1 }}>
                      {activityIcon(t.lastActivity.type)} {activityPreview(t.lastActivity)}
                    </p>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Center column: Messaging ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {!selectedContact ? (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-[14px] text-[var(--color-text-tertiary)]">Select a conversation</p>
          </div>
        ) : (
          <ContactMessaging contact={selectedContact} />
        )}
      </div>

      {/* ── Right column: Actual ContactDetail sidebar ── */}
      {selectedContact && (
        <div
          className="border-l border-[var(--color-border)] shrink-0 flex flex-col overflow-hidden"
          style={{ width: 380 }}
        >
          <ContactDetail contained />
        </div>
      )}
    </div>
  );
}

// ── Export: wrap with ContactPanelProvider ──
export default function InboxPage({ user: _user }: { user: User }) {
  return (
    <ContactPanelProvider>
      <InboxContent />
    </ContactPanelProvider>
  );
}
