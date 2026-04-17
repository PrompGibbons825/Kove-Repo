"use client";

import { useState, useEffect } from "react";
import type { Contact, Activity, ContactStatus } from "@/lib/types/database";

const STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "qualifying", label: "Qualifying" },
  { value: "qualified", label: "Qualified" },
  { value: "closing", label: "Closing" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "renewal", label: "Renewal" },
];

interface ContactDetailProps {
  contact: Contact;
  onClose: () => void;
  onEdit: (c: Contact) => void;
  onDelete: (id: string) => void;
  onRefresh: () => void;
}

export function ContactDetail({ contact, onClose, onEdit, onDelete, onRefresh }: ContactDetailProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [status, setStatus] = useState<ContactStatus>(contact.status);
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    // Fetch activities for this contact
    async function load() {
      try {
        const res = await fetch(`/api/contacts/${contact.id}`);
        const data = await res.json();
        // Activities would come from a separate endpoint in full impl
        setActivities([]);
      } catch {
        // silent
      } finally {
        setLoadingActivities(false);
      }
    }
    load();
  }, [contact.id]);

  async function handleStatusChange(newStatus: ContactStatus) {
    setStatus(newStatus);
    await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    onRefresh();
  }

  async function handleAddNote() {
    if (!note.trim()) return;
    setSavingNote(true);
    // In full implementation this would create an activity record
    // For now just clear the input
    setNote("");
    setSavingNote(false);
  }

  const initials = contact.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/30" onClick={onClose} />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 z-50 h-screen bg-[var(--color-surface)] border-l border-[var(--color-border)] shadow-xl flex flex-col"
        style={{ width: 480, animation: "slideInRight 0.25s ease" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)]" style={{ padding: "16px 24px" }}>
          <div className="flex items-center gap-3">
            <div
              className="flex items-center justify-center rounded-full text-[14px] font-semibold text-white"
              style={{ width: 40, height: 40, background: "var(--color-accent)" }}
            >
              {initials}
            </div>
            <div>
              <h2 className="text-[16px] font-semibold text-[var(--color-text-primary)] leading-tight">{contact.name}</h2>
              <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginTop: 2 }}>
                {contact.source ? `Source: ${contact.source}` : "No source"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onEdit(contact)}
              className="flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              style={{ width: 32, height: 32 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={() => onDelete(contact.id)}
              className="flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-error-soft)] hover:text-[var(--color-error)] transition-colors cursor-pointer"
              style={{ width: 32, height: 32 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
              </svg>
            </button>
            <button
              onClick={onClose}
              className="flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              style={{ width: 32, height: 32 }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6 6 18" /><path d="m6 6 12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto" style={{ padding: "20px 24px" }}>
          {/* Info cards */}
          <div className="grid grid-cols-2 gap-3" style={{ marginBottom: 24 }}>
            <InfoCard label="Phone" value={contact.phone ?? "—"} />
            <InfoCard label="Email" value={contact.email ?? "—"} />
            <InfoCard label="Pipeline" value={contact.pipeline_stage ?? "—"} />
            <InfoCard label="Last Contacted" value={contact.last_contacted_at ? new Date(contact.last_contacted_at).toLocaleDateString() : "Never"} />
          </div>

          {/* Status selector */}
          <div style={{ marginBottom: 24 }}>
            <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 8, display: "block" }}>Status</label>
            <div className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleStatusChange(opt.value)}
                  className="rounded-full text-[11px] font-medium transition-all cursor-pointer"
                  style={{
                    padding: "4px 14px",
                    background: status === opt.value ? "var(--color-accent)" : "var(--color-surface-hover)",
                    color: status === opt.value ? "white" : "var(--color-text-secondary)",
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* AI Summary */}
          {contact.ai_summary && (
            <div style={{ marginBottom: 24 }}>
              <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 8, display: "block" }}>AI Summary</label>
              <div
                className="rounded-xl border border-[var(--color-accent)]/15 text-[13px] text-[var(--color-text-secondary)] leading-relaxed"
                style={{ padding: "12px 16px", background: "var(--color-accent-soft)" }}
              >
                {contact.ai_summary}
              </div>
            </div>
          )}

          {/* Handoff notes */}
          {contact.handoff_notes && (
            <div style={{ marginBottom: 24 }}>
              <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 8, display: "block" }}>Handoff Notes</label>
              <div
                className="rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-text-secondary)] leading-relaxed"
                style={{ padding: "12px 16px", background: "var(--color-surface-hover)" }}
              >
                {contact.handoff_notes}
              </div>
            </div>
          )}

          {/* Add note */}
          <div style={{ marginBottom: 24 }}>
            <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 8, display: "block" }}>Add Note</label>
            <div className="flex gap-2">
              <textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Type a note..."
                rows={2}
                className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 resize-none transition-colors"
                style={{ padding: "10px 12px" }}
              />
              <button
                onClick={handleAddNote}
                disabled={!note.trim() || savingNote}
                className="flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-30 hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer self-end"
                style={{ width: 36, height: 36 }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
                </svg>
              </button>
            </div>
          </div>

          {/* Activity timeline */}
          <div>
            <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider" style={{ marginBottom: 12, display: "block" }}>Timeline</label>
            {loadingActivities ? (
              <p className="text-[13px] text-[var(--color-text-tertiary)]">Loading...</p>
            ) : activities.length === 0 ? (
              <div className="text-center text-[13px] text-[var(--color-text-tertiary)] rounded-xl border border-dashed border-[var(--color-border)]" style={{ padding: "24px 16px" }}>
                No activity yet. Add a note or make a call to start the timeline.
              </div>
            ) : (
              <div className="space-y-3">
                {activities.map((a) => (
                  <div key={a.id} className="flex gap-3 text-[13px]">
                    <div className="flex items-center justify-center rounded-full shrink-0" style={{ width: 28, height: 28, background: "var(--color-surface-hover)" }}>
                      <span className="text-[10px]">📝</span>
                    </div>
                    <div>
                      <p className="text-[var(--color-text-primary)]">{a.ai_summary ?? a.content ?? a.type}</p>
                      <p className="text-[11px] text-[var(--color-text-tertiary)]">{new Date(a.occurred_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-border)]" style={{ padding: "10px 14px" }}>
      <p className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">{label}</p>
      <p className="text-[13px] text-[var(--color-text-primary)] font-medium" style={{ marginTop: 4 }}>{value}</p>
    </div>
  );
}
