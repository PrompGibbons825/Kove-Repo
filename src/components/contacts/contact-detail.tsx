"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { Contact, Activity, ContactStatus } from "@/lib/types/database";
import { useContactPanel, type ContactViewMode } from "./contact-panel-context";
import { useCall, formatDuration, type CallState } from "@/hooks/use-call";
import { useLiveTranscript } from "@/hooks/use-live-transcript";
import { LiveSession } from "@/components/calls/live-session";
import { ContactMessaging } from "./contact-messaging";

const STATUS_OPTIONS: { value: ContactStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "qualifying", label: "Qualifying" },
  { value: "qualified", label: "Qualified" },
  { value: "closing", label: "Closing" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "renewal", label: "Renewal" },
];

export function ContactDetail({ contained }: { contained?: boolean }) {
  const { contact, viewMode, width, rightOffset, closeContact, setViewMode, setWidth, updateContact } = useContactPanel();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(true);
  const [status, setStatus] = useState<ContactStatus>("new");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [visible, setVisible] = useState(false);
  const resizingRef = useRef(false);
  const [orgMembers, setOrgMembers] = useState<{ id: string; full_name: string; email: string }[]>([]);
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [pipelineOptions, setPipelineOptions] = useState<string[]>([]);
  const [sourceOptions, setSourceOptions] = useState<string[]>([]);

  // ── Call state ──
  const [callSummaryLoading, setCallSummaryLoading] = useState(false);

  const { callState, muted, duration, remoteStream, startCall, endCall, toggleMute } = useCall({
    onCallStarted: () => {},
    onCallEnded: async (info) => {
      const transcript = transcriptHook.getFullTranscript();
      if (transcript && contact) {
        setCallSummaryLoading(true);
        try {
          const res = await fetch("/api/ai/call-summary", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contactId: contact.id,
              transcript,
              duration: info.duration,
              direction: "outbound",
            }),
          });
          if (res.ok) {
            const data = await res.json();
            if (data.summary?.contact_summary_update) {
              updateContact({ ai_summary: data.summary.contact_summary_update });
            }
            if (data.summary?.suggested_next_status) {
              updateContact({ status: data.summary.suggested_next_status });
              setStatus(data.summary.suggested_next_status);
            }
            // Refresh activities
            fetch(`/api/activities?contact_id=${contact.id}`)
              .then((r) => r.json())
              .then((d) => setActivities(Array.isArray(d) ? d : (d.activities ?? [])))
              .catch(() => {});
          }
        } catch {}
        setCallSummaryLoading(false);
      }
      transcriptHook.reset();
    },
  });

  const transcriptHook = useLiveTranscript({
    remoteStream,
    active: callState === "active",
  });

  const handleStartCall = useCallback(() => {
    if (!contact?.phone) return;
    startCall(contact.phone);
  }, [contact?.phone, startCall]);

  const handleCallAction = useCallback(async (action: string, params?: Record<string, unknown>) => {
    if (!contact) return;
    try {
      await fetch("/api/ai/call-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, contactId: contact.id, params }),
      });
      // Refresh activities after action
      fetch(`/api/activities?contact_id=${contact.id}`)
        .then((r) => r.json())
        .then((d) => setActivities(Array.isArray(d) ? d : (d.activities ?? [])))
        .catch(() => {});
      // Refresh contact if status advanced
      if (action === "advance_status") {
        fetch(`/api/contacts/${contact.id}`)
          .then((r) => r.json())
          .then((c) => {
            if (c.status) { updateContact({ status: c.status }); setStatus(c.status); }
          })
          .catch(() => {});
      }
    } catch {}
  }, [contact, updateContact]);

  useEffect(() => {
    if (contact && viewMode !== "hidden") {
      setStatus(contact.status);
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [contact, viewMode]);

  useEffect(() => {
    if (!contact) return;
    setLoadingActivities(true);
    fetch(`/api/activities?contact_id=${contact.id}`)
      .then((r) => r.json())
      .then((data) => setActivities(Array.isArray(data) ? data : (data.activities ?? [])))
      .catch(() => {})
      .finally(() => setLoadingActivities(false));
  }, [contact?.id]);

  useEffect(() => {
    fetch("/api/users")
      .then((r) => r.json())
      .then((data) => setOrgMembers(data.users ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/settings/org")
      .then((r) => r.json())
      .then((data) => {
        setPipelineOptions(data.pipeline_options ?? []);
        setSourceOptions(data.source_options ?? []);
      })
      .catch(() => {});
  }, []);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startX - ev.clientX;
      setWidth(Math.max(320, Math.min(540, startW + delta)));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width, setWidth]);

  async function handleStatusChange(newStatus: ContactStatus) {
    if (!contact) return;
    setStatus(newStatus);
    await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    updateContact({ status: newStatus });
  }

  async function handleAddNote() {
    if (!note.trim() || !contact) return;
    setSavingNote(true);
    try {
      const res = await fetch("/api/activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contact_id: contact.id, type: "note", content: note.trim() }),
      });
      if (res.ok) {
        const created = await res.json();
        // API returns the activity directly (not wrapped)
        setActivities((prev) => [created.activity ?? created, ...prev]);
        setNote("");
      }
    } catch {
      // silently fail
    } finally {
      setSavingNote(false);
    }
  }

  async function handleFieldSave(field: string, value: string) {
    if (!contact) return;
    const update: Partial<Contact> = { [field]: value || null };
    await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(update),
    });
    updateContact(update);
  }

  function handleClose() {
    setVisible(false);
    setTimeout(closeContact, 250);
  }

  if (!contact || viewMode === "hidden") return null;

  const initials = contact.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  // ── Fullscreen mode ──
  if (viewMode === "fullscreen") {
    return (
      <div
        className="absolute inset-0 z-30 bg-[var(--color-background)] flex flex-col"
        style={{ opacity: visible ? 1 : 0, transition: "opacity 200ms ease" }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border)]" style={{ padding: "16px 32px" }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center justify-center rounded-full text-[18px] font-semibold text-white" style={{ width: 48, height: 48, background: "var(--color-accent)" }}>
              {initials}
            </div>
            <div>
              <EditableNameField
                value={contact.name}
                onSave={(v) => handleFieldSave("name", v)}
                className="text-[22px] font-semibold text-[var(--color-text-primary)] leading-tight"
              />
              <p className="text-[13px] text-[var(--color-text-tertiary)]" style={{ marginTop: 2 }}>
                {contact.source ?? "No source"} · {contact.phone ?? "No phone"} · {contact.email ?? "No email"}
              </p>
            </div>
            {/* Phone call button */}
            {contact.phone && (
              <PhoneButton callState={callState} onClick={callState === "idle" ? handleStartCall : endCall} />
            )}
          </div>
          <div className="flex items-center gap-2">
            <ViewModeButtons viewMode={viewMode} onSet={setViewMode} />
            <Sep />
            <CloseBtn onClick={handleClose} />
          </div>
        </div>

        {/* Active call bar */}
        {callState !== "idle" && (
          <CallBar callState={callState} duration={duration} muted={muted} onToggleMute={toggleMute} onEndCall={endCall} callSummaryLoading={callSummaryLoading} />
        )}

        {/* 3-column */}
        <div className="flex-1 flex overflow-hidden">
          {/* Left — Contact info (~280px) */}
          <div className="overflow-y-auto border-r border-[var(--color-border)]" style={{ width: 300, minWidth: 260, padding: "20px 24px" }}>
            <div style={{ marginBottom: 20 }}>
              <SectionLabel>Status</SectionLabel>
              <StatusStepper status={status} onChange={handleStatusChange} />
            </div>
            <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 20 }}>
              <EditableField label="Phone" value={contact.phone ?? ""} onSave={(v) => handleFieldSave("phone", v)} />
              <EditableField label="Email" value={contact.email ?? ""} onSave={(v) => handleFieldSave("email", v)} />
              <EditableSelectField label="Pipeline" value={contact.pipeline_stage ?? ""} options={pipelineOptions} onSave={(v) => handleFieldSave("pipeline_stage", v)} />
              <EditableSelectField label="Source" value={contact.source ?? ""} options={sourceOptions} onSave={(v) => handleFieldSave("source", v)} />
            </div>
            <AssignedMembers
              contact={contact}
              orgMembers={orgMembers}
              showPicker={showMemberPicker}
              setShowPicker={setShowMemberPicker}
              updateContact={updateContact}
            />
            <AISummary summary={contact.ai_summary} />
            {contact.handoff_notes && (
              <div style={{ marginBottom: 20 }}>
                <SectionLabel>Handoff Notes</SectionLabel>
                <div className="rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-text-secondary)] leading-relaxed" style={{ padding: "10px 14px", background: "var(--color-surface-hover)" }}>
                  {contact.handoff_notes}
                </div>
              </div>
            )}
            <NoteInput note={note} setNote={setNote} saving={savingNote} onAdd={handleAddNote} />
            <Timeline activities={activities} loading={loadingActivities} />
          </div>

          {/* Center — Messaging (flex-1) */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <ContactMessaging contact={contact} />
          </div>

          {/* Right — Live Session (~340px) */}
          <div className="border-l border-[var(--color-border)] flex flex-col" style={{ width: 340, minWidth: 300 }}>
            <div className="flex items-center border-b border-[var(--color-border)]" style={{ padding: "14px 16px" }}>
              <SectionLabel style={{ marginBottom: 0 }}>Live Session</SectionLabel>
              {callState === "active" && (
                <div className="rounded-full animate-pulse" style={{ width: 8, height: 8, background: "#ef4444", marginLeft: 8 }} />
              )}
            </div>
            <LiveSession
              active={callState === "active"}
              entries={transcriptHook.entries}
              contact={contact}
              onAction={handleCallAction}
              callDuration={duration}
            />
          </div>
        </div>
      </div>
    );
  }

  // ── Sidebar mode ──
  return (
    <aside
      className={
        contained
          ? "relative flex h-full w-full flex-col overflow-hidden bg-[var(--color-surface)]"
          : "fixed top-0 z-40 flex h-screen flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
      }
      style={contained ? { opacity: visible ? 1 : 0, transition: "opacity 200ms ease" } : {
        width: visible ? width : 0,
        right: rightOffset,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "width 250ms cubic-bezier(0.16,1,0.3,1), opacity 200ms ease, transform 250ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Resize handle — only in standalone mode */}
      {!contained && (
        <div onMouseDown={startResize} className="absolute left-0 top-0 bottom-0 cursor-col-resize hover:bg-[var(--color-accent)]/20 transition-colors z-10" style={{ width: 6 }} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)]" style={{ padding: "14px 20px" }}>
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex items-center justify-center rounded-full text-[13px] font-semibold text-white shrink-0" style={{ width: 36, height: 36, background: "var(--color-accent)" }}>
            {initials}
          </div>
          <div className="min-w-0">
            <EditableNameField
              value={contact.name}
              onSave={(v) => handleFieldSave("name", v)}
              className="text-[15px] font-semibold text-[var(--color-text-primary)] leading-tight w-full"
            />
            <p className="text-[11px] text-[var(--color-text-tertiary)] truncate" style={{ marginTop: 1 }}>{contact.source ?? "No source"}</p>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {contact.phone && (
            <PhoneButton callState={callState} onClick={callState === "idle" ? handleStartCall : endCall} size="sm" />
          )}
          <ViewModeButtons viewMode={viewMode} onSet={setViewMode} />
          <CloseBtn onClick={handleClose} size={14} />
        </div>
      </div>

      {/* Active call bar in sidebar */}
      {callState !== "idle" && (
        <CallBar callState={callState} duration={duration} muted={muted} onToggleMute={toggleMute} onEndCall={endCall} callSummaryLoading={callSummaryLoading} />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "16px 20px" }}>
        <div className="grid grid-cols-2 gap-2" style={{ marginBottom: 20 }}>
          <EditableField label="Phone" value={contact.phone ?? ""} onSave={(v) => handleFieldSave("phone", v)} />
          <EditableField label="Email" value={contact.email ?? ""} onSave={(v) => handleFieldSave("email", v)} />
          <EditableSelectField label="Pipeline" value={contact.pipeline_stage ?? ""} options={pipelineOptions} onSave={(v) => handleFieldSave("pipeline_stage", v)} />
          <EditableSelectField label="Source" value={contact.source ?? ""} options={sourceOptions} onSave={(v) => handleFieldSave("source", v)} />
        </div>
        <AssignedMembers
          contact={contact}
          orgMembers={orgMembers}
          showPicker={showMemberPicker}
          setShowPicker={setShowMemberPicker}
          updateContact={updateContact}
        />
        <div style={{ marginBottom: 20 }}>
          <SectionLabel>Status</SectionLabel>
          <StatusStepper status={status} onChange={handleStatusChange} />
        </div>
        <AISummary summary={contact.ai_summary} />
        {contact.handoff_notes && (
          <div style={{ marginBottom: 20 }}>
            <SectionLabel>Handoff Notes</SectionLabel>
            <div className="rounded-xl border border-[var(--color-border)] text-[13px] text-[var(--color-text-secondary)] leading-relaxed" style={{ padding: "10px 14px", background: "var(--color-surface-hover)" }}>
              {contact.handoff_notes}
            </div>
          </div>
        )}
        <NoteInput note={note} setNote={setNote} saving={savingNote} onAdd={handleAddNote} />
        <Timeline activities={activities} loading={loadingActivities} />
      </div>
    </aside>
  );
}

/* ── Shared sub-components ── */

function EditableSelectField({ label, value, options, onSave }: { label: string; value: string; options: string[]; onSave: (v: string) => void }) {
  if (options.length === 0) {
    return <EditableField label={label} value={value} onSave={onSave} />;
  }
  return (
    <div className="rounded-lg border border-[var(--color-border)] hover:border-[var(--color-accent)]/40 transition-colors" style={{ padding: "8px 12px" }}>
      <p className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">{label}</p>
      <select
        value={value}
        onChange={(e) => onSave(e.target.value)}
        className="w-full text-[13px] text-[var(--color-text-primary)] font-medium bg-transparent border-none outline-none cursor-pointer p-0"
        style={{ marginTop: 3 }}
      >
        <option value="">—</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function EditableNameField({ value, onSave, className }: { value: string; onSave: (v: string) => void; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value) onSave(trimmed);
    else setDraft(value);
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className={className}
        style={{ background: "transparent", border: "none", outline: "none", padding: 0, margin: 0, display: "block" }}
      />
    );
  }

  return (
    <p
      className={`${className} cursor-text hover:opacity-80 transition-opacity`}
      onClick={() => setEditing(true)}
      title="Click to edit name"
    >
      {value}
    </p>
  );
}

function SectionLabel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider block" style={{ marginBottom: 8, ...style }}>{children}</label>;
}

function EditableField({ label, value, onSave }: { label: string; value: string; onSave: (v: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setDraft(value); }, [value]);
  useEffect(() => { if (editing) inputRef.current?.focus(); }, [editing]);

  function commit() {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed !== value) onSave(trimmed);
  }

  return (
    <div
      className="rounded-lg border border-[var(--color-border)] cursor-text hover:border-[var(--color-accent)]/40 transition-colors"
      style={{ padding: "8px 12px" }}
      onClick={() => { if (!editing) setEditing(true); }}
    >
      <p className="text-[10px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">{label}</p>
      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
          className="w-full text-[13px] text-[var(--color-text-primary)] font-medium bg-transparent border-none outline-none p-0"
          style={{ marginTop: 3 }}
        />
      ) : (
        <p className="text-[13px] text-[var(--color-text-primary)] font-medium truncate" style={{ marginTop: 3 }}>{value || "—"}</p>
      )}
    </div>
  );
}

function StatusStepper({ status, onChange }: { status: ContactStatus; onChange: (s: ContactStatus) => void }) {
  const idx = STATUS_OPTIONS.findIndex((o) => o.value === status);
  const label = STATUS_OPTIONS[idx]?.label ?? status;
  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => { if (idx > 0) onChange(STATUS_OPTIONS[idx - 1].value); }}
        disabled={idx <= 0}
        className="flex items-center justify-center rounded-lg border border-[var(--color-border)] disabled:opacity-20 hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
        style={{ width: 30, height: 30 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
      </button>
      <span
        className="rounded-full text-[13px] font-semibold text-white text-center"
        style={{ padding: "5px 20px", background: "var(--color-accent)", minWidth: 100 }}
      >
        {label}
      </span>
      <button
        onClick={() => { if (idx < STATUS_OPTIONS.length - 1) onChange(STATUS_OPTIONS[idx + 1].value); }}
        disabled={idx >= STATUS_OPTIONS.length - 1}
        className="flex items-center justify-center rounded-lg border border-[var(--color-border)] disabled:opacity-20 hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
        style={{ width: 30, height: 30 }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
      </button>
      <span className="text-[11px] text-[var(--color-text-tertiary)]" style={{ marginLeft: 4 }}>
        {idx + 1} / {STATUS_OPTIONS.length}
      </span>
    </div>
  );
}

function AISummary({ summary }: { summary: string | null }) {
  if (!summary) return null;
  return (
    <div style={{ marginBottom: 20 }}>
      <SectionLabel>AI Summary</SectionLabel>
      <div className="rounded-xl border border-[var(--color-accent)]/15 text-[13px] text-[var(--color-text-secondary)] leading-relaxed" style={{ padding: "10px 14px", background: "var(--color-accent-soft)" }}>
        {summary}
      </div>
    </div>
  );
}

function NoteInput({ note, setNote, saving, onAdd }: { note: string; setNote: (n: string) => void; saving: boolean; onAdd: () => void }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <SectionLabel>Add Note</SectionLabel>
      <div className="flex gap-2">
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Type a note..." rows={2}
          className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 resize-none transition-colors"
          style={{ padding: "8px 12px" }}
        />
        <button onClick={onAdd} disabled={!note.trim() || saving}
          className="flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-30 hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer self-end"
          style={{ width: 34, height: 34 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
          </svg>
        </button>
      </div>
    </div>
  );
}

function Timeline({ activities, loading }: { activities: Activity[]; loading: boolean }) {
  return (
    <div>
      <SectionLabel>Timeline</SectionLabel>
      {loading ? (
        <p className="text-[13px] text-[var(--color-text-tertiary)]">Loading...</p>
      ) : activities.length === 0 ? (
        <div className="text-center text-[13px] text-[var(--color-text-tertiary)] rounded-xl border border-dashed border-[var(--color-border)]" style={{ padding: "20px 16px" }}>
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
  );
}

function ViewModeButtons({ viewMode, onSet }: { viewMode: ContactViewMode; onSet: (m: ContactViewMode) => void }) {
  return (
    <>
      <button onClick={() => onSet("sidebar")} title="Sidebar view"
        className="flex items-center justify-center rounded-lg transition-colors cursor-pointer"
        style={{ width: 28, height: 28, background: viewMode === "sidebar" ? "var(--color-surface-hover)" : "transparent", color: viewMode === "sidebar" ? "var(--color-text-primary)" : "var(--color-text-tertiary)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect width="18" height="18" x="3" y="3" rx="2" /><path d="M15 3v18" />
        </svg>
      </button>
      <button onClick={() => onSet("fullscreen")} title="Fullscreen view"
        className="flex items-center justify-center rounded-lg transition-colors cursor-pointer"
        style={{ width: 28, height: 28, background: viewMode === "fullscreen" ? "var(--color-surface-hover)" : "transparent", color: viewMode === "fullscreen" ? "var(--color-text-primary)" : "var(--color-text-tertiary)" }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 3H5a2 2 0 0 0-2 2v3" /><path d="M21 8V5a2 2 0 0 0-2-2h-3" /><path d="M3 16v3a2 2 0 0 0 2 2h3" /><path d="M16 21h3a2 2 0 0 0 2-2v-3" />
        </svg>
      </button>
    </>
  );
}

function CloseBtn({ onClick, size = 16 }: { onClick: () => void; size?: number }) {
  return (
    <button onClick={onClick} className="flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer" style={{ width: 28, height: 28 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 6 6 18" /><path d="m6 6 12 12" />
      </svg>
    </button>
  );
}

function EditBtn({ onClick, size = 16 }: { onClick: () => void; size?: number }) {
  return (
    <button onClick={onClick} title="Edit contact" className="flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer" style={{ width: 28, height: 28 }}>
      <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" /><path d="m15 5 4 4" />
      </svg>
    </button>
  );
}

function PhoneButton({ callState, onClick, size = "md" }: { callState: CallState; onClick: () => void; size?: "sm" | "md" }) {
  const isActive = callState !== "idle";
  const dim = size === "sm" ? 28 : 36;
  const iconSize = size === "sm" ? 14 : 18;
  return (
    <button
      onClick={onClick}
      title={isActive ? "End call" : "Call contact"}
      className="flex items-center justify-center rounded-full transition-all cursor-pointer"
      style={{
        width: dim, height: dim,
        background: isActive ? "#ef4444" : "var(--color-accent)",
        color: "white",
      }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={isActive ? { transform: "rotate(135deg)" } : {}}
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
      </svg>
    </button>
  );
}

function CallBar({ callState, duration, muted, onToggleMute, onEndCall, callSummaryLoading }: {
  callState: CallState; duration: number; muted: boolean;
  onToggleMute: () => void; onEndCall: () => void; callSummaryLoading: boolean;
}) {
  return (
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
          <button onClick={onToggleMute} title={muted ? "Unmute" : "Mute"}
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
        <button onClick={onEndCall}
          className="flex items-center justify-center rounded-lg text-white transition-colors cursor-pointer"
          style={{ height: 32, padding: "0 12px", background: "#ef4444", fontSize: 12, fontWeight: 600 }}
        >
          End Call
        </button>
      </div>
    </div>
  );
}

function Sep() {
  return <div style={{ width: 1, height: 20, background: "var(--color-border)", margin: "0 4px" }} />;
}

function AssignedMembers({
  contact,
  orgMembers,
  showPicker,
  setShowPicker,
  updateContact,
}: {
  contact: Contact;
  orgMembers: { id: string; full_name: string; email: string }[];
  showPicker: boolean;
  setShowPicker: (v: boolean) => void;
  updateContact: (partial: Partial<Contact>) => void;
}) {
  const assigned = contact.assigned_to ?? [];
  const assignedMembers = orgMembers.filter((m) => assigned.includes(m.id));
  const unassigned = orgMembers.filter((m) => !assigned.includes(m.id));

  async function addMember(userId: string) {
    const newAssigned = [...assigned, userId];
    await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_to: newAssigned }),
    });
    updateContact({ assigned_to: newAssigned });
    setShowPicker(false);
  }

  async function removeMember(userId: string) {
    const newAssigned = assigned.filter((id: string) => id !== userId);
    await fetch(`/api/contacts/${contact.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ assigned_to: newAssigned }),
    });
    updateContact({ assigned_to: newAssigned });
  }

  return (
    <div style={{ marginBottom: 20 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 8 }}>
        <label className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider">
          Assigned Members
        </label>
        <button
          onClick={() => setShowPicker(!showPicker)}
          className="text-[11px] font-medium text-[var(--color-accent)] hover:underline cursor-pointer"
        >
          + Add
        </button>
      </div>
      {assignedMembers.length === 0 ? (
        <p className="text-[12px] text-[var(--color-text-tertiary)] italic">No members assigned</p>
      ) : (
        <div className="space-y-1.5">
          {assignedMembers.map((m) => (
            <div key={m.id} className="flex items-center justify-between rounded-lg border border-[var(--color-border)]" style={{ padding: "6px 10px" }}>
              <div className="flex items-center gap-2">
                <div
                  className="flex items-center justify-center rounded-full text-[10px] font-semibold text-white"
                  style={{ width: 24, height: 24, background: "var(--color-accent)" }}
                >
                  {m.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <span className="text-[12px] text-[var(--color-text-primary)]">{m.full_name}</span>
              </div>
              <button
                onClick={() => removeMember(m.id)}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-error)] cursor-pointer"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
      {showPicker && unassigned.length > 0 && (
        <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]" style={{ marginTop: 8 }}>
          {unassigned.map((m) => (
            <button
              key={m.id}
              onClick={() => addMember(m.id)}
              className="w-full text-left flex items-center gap-2 hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
              style={{ padding: "6px 10px" }}
            >
              <div
                className="flex items-center justify-center rounded-full text-[9px] font-semibold text-white"
                style={{ width: 22, height: 22, background: "var(--color-text-tertiary)" }}
              >
                {m.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </div>
              <span className="text-[12px] text-[var(--color-text-secondary)]">{m.full_name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
