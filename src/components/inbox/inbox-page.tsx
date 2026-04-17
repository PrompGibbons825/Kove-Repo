"use client";

import { useState, useEffect, useCallback } from "react";
import type { User, Activity } from "@/lib/types/database";

type InboxTab = "all" | "calls" | "sms" | "email";

const TABS: { id: InboxTab; label: string; icon: string }[] = [
  { id: "all", label: "All", icon: "📥" },
  { id: "calls", label: "Calls", icon: "📞" },
  { id: "sms", label: "SMS", icon: "💬" },
  { id: "email", label: "Email", icon: "✉️" },
];

interface InboxActivity extends Activity {
  contact_name?: string;
}

export default function InboxPage({ user }: { user: User }) {
  const [tab, setTab] = useState<InboxTab>("all");
  const [activities, setActivities] = useState<InboxActivity[]>([]);
  const [contacts, setContacts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  // Compose states
  const [showSmsCompose, setShowSmsCompose] = useState(false);
  const [showEmailCompose, setShowEmailCompose] = useState(false);
  const [showDialer, setShowDialer] = useState(false);

  // SMS compose
  const [smsTo, setSmsTo] = useState("");
  const [smsMessage, setSmsMessage] = useState("");
  const [smsSending, setSmsSending] = useState(false);

  // Email compose
  const [emailTo, setEmailTo] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailSending, setEmailSending] = useState(false);

  // Call state
  const [callTo, setCallTo] = useState("");
  const [calling, setCalling] = useState(false);
  const [callStatus, setCallStatus] = useState<string | null>(null);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await fetch("/api/activities");
      const data = await res.json();
      const acts: Activity[] = data.activities ?? [];
      // Filter to comm types
      const comms = acts.filter((a) =>
        ["call", "sms", "email", "voicemail"].includes(a.type)
      );
      setActivities(comms);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await fetch("/api/contacts");
      const data = await res.json();
      const map: Record<string, string> = {};
      for (const c of data.contacts ?? []) {
        map[c.id] = c.name;
      }
      setContacts(map);
    } catch {
      /* silent */
    }
  }, []);

  useEffect(() => {
    fetchActivities();
    fetchContacts();
  }, [fetchActivities, fetchContacts]);

  const filtered = tab === "all"
    ? activities
    : activities.filter((a) => {
        if (tab === "calls") return a.type === "call" || a.type === "voicemail";
        return a.type === tab;
      });

  async function handleSendSms() {
    if (!smsTo.trim() || !smsMessage.trim()) return;
    setSmsSending(true);
    try {
      await fetch("/api/comms/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: smsTo.trim(), message: smsMessage.trim() }),
      });
      setSmsTo("");
      setSmsMessage("");
      setShowSmsCompose(false);
      fetchActivities();
    } catch { /* silent */ } finally {
      setSmsSending(false);
    }
  }

  async function handleSendEmail() {
    if (!emailTo.trim() || !emailBody.trim()) return;
    setEmailSending(true);
    try {
      await fetch("/api/comms/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: emailTo.trim(),
          subject: emailSubject.trim(),
          text: emailBody.trim(),
        }),
      });
      setEmailTo("");
      setEmailSubject("");
      setEmailBody("");
      setShowEmailCompose(false);
      fetchActivities();
    } catch { /* silent */ } finally {
      setEmailSending(false);
    }
  }

  async function handleCall() {
    if (!callTo.trim()) return;
    setCalling(true);
    setCallStatus("Connecting...");
    try {
      // Get WebRTC token
      const tokenRes = await fetch("/api/comms/call/token");
      const tokenData = await tokenRes.json();
      if (!tokenData.token) {
        setCallStatus("No call token available. Check settings.");
        setCalling(false);
        return;
      }
      // In a real implementation, this would initialize the Telnyx WebRTC SDK
      // For now, we show the call UI and log the attempt
      setCallStatus(`Calling ${callTo}...`);
      // TODO: Initialize TelnyxRTC client with token and make the call
      setTimeout(() => {
        setCallStatus("Call feature requires Telnyx WebRTC setup. Token generated successfully.");
        setCalling(false);
      }, 2000);
    } catch {
      setCallStatus("Call failed");
      setCalling(false);
    }
  }

  function getActivityIcon(type: string) {
    switch (type) {
      case "call": return "📞";
      case "sms": return "💬";
      case "email": return "✉️";
      case "voicemail": return "📱";
      default: return "📝";
    }
  }

  function getDirectionBadge(direction?: string) {
    if (!direction) return null;
    const isInbound = direction === "inbound";
    return (
      <span
        className="rounded-full text-[10px] font-medium"
        style={{
          padding: "1px 8px",
          background: isInbound ? "var(--color-accent-soft)" : "var(--color-surface-hover)",
          color: isInbound ? "var(--color-accent)" : "var(--color-text-tertiary)",
        }}
      >
        {isInbound ? "↙ Inbound" : "↗ Outbound"}
      </span>
    );
  }

  return (
    <div style={{ padding: "32px 40px" }}>
      {/* Header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 24 }}>
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--color-text-primary)]">Inbox</h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)]" style={{ marginTop: 2 }}>
            All calls, messages, and emails in one place.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowDialer(true); setShowSmsCompose(false); setShowEmailCompose(false); }}
            className="flex items-center gap-2 rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
            style={{ padding: "8px 16px" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
            Call
          </button>
          <button
            onClick={() => { setShowSmsCompose(true); setShowDialer(false); setShowEmailCompose(false); }}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] text-[13px] font-medium hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
            style={{ padding: "8px 16px" }}
          >
            💬 SMS
          </button>
          <button
            onClick={() => { setShowEmailCompose(true); setShowDialer(false); setShowSmsCompose(false); }}
            className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] text-[var(--color-text-primary)] text-[13px] font-medium hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
            style={{ padding: "8px 16px" }}
          >
            ✉️ Email
          </button>
        </div>
      </div>

      {/* Compose Panels */}
      {showDialer && (
        <ComposePanel title="Make a Call" onClose={() => { setShowDialer(false); setCallStatus(null); }}>
          <div className="flex gap-2">
            <input
              value={callTo}
              onChange={(e) => setCallTo(e.target.value)}
              placeholder="+1 (555) 123-4567"
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40"
              style={{ padding: "8px 12px" }}
            />
            <button
              onClick={handleCall}
              disabled={!callTo.trim() || calling}
              className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium disabled:opacity-30 cursor-pointer"
              style={{ padding: "8px 20px" }}
            >
              {calling ? "Calling..." : "Call"}
            </button>
          </div>
          {callStatus && (
            <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginTop: 8 }}>{callStatus}</p>
          )}
        </ComposePanel>
      )}

      {showSmsCompose && (
        <ComposePanel title="Send SMS" onClose={() => setShowSmsCompose(false)}>
          <input
            value={smsTo}
            onChange={(e) => setSmsTo(e.target.value)}
            placeholder="Phone number"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40"
            style={{ padding: "8px 12px", marginBottom: 8 }}
          />
          <div className="flex gap-2">
            <textarea
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              placeholder="Type your message..."
              rows={2}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 resize-none"
              style={{ padding: "8px 12px" }}
            />
            <button
              onClick={handleSendSms}
              disabled={!smsTo.trim() || !smsMessage.trim() || smsSending}
              className="self-end rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium disabled:opacity-30 cursor-pointer"
              style={{ padding: "8px 20px" }}
            >
              {smsSending ? "Sending..." : "Send"}
            </button>
          </div>
        </ComposePanel>
      )}

      {showEmailCompose && (
        <ComposePanel title="Compose Email" onClose={() => setShowEmailCompose(false)}>
          <input
            value={emailTo}
            onChange={(e) => setEmailTo(e.target.value)}
            placeholder="To email"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40"
            style={{ padding: "8px 12px", marginBottom: 8 }}
          />
          <input
            value={emailSubject}
            onChange={(e) => setEmailSubject(e.target.value)}
            placeholder="Subject"
            className="w-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40"
            style={{ padding: "8px 12px", marginBottom: 8 }}
          />
          <div className="flex gap-2">
            <textarea
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              placeholder="Write your email..."
              rows={5}
              className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 resize-none"
              style={{ padding: "8px 12px" }}
            />
          </div>
          <button
            onClick={handleSendEmail}
            disabled={!emailTo.trim() || !emailBody.trim() || emailSending}
            className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium disabled:opacity-30 cursor-pointer"
            style={{ padding: "8px 20px", marginTop: 8 }}
          >
            {emailSending ? "Sending..." : "Send Email"}
          </button>
        </ComposePanel>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--color-border)]" style={{ marginBottom: 20 }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="text-[13px] font-medium transition-colors cursor-pointer"
            style={{
              padding: "8px 16px",
              borderBottom: tab === t.id ? "2px solid var(--color-accent)" : "2px solid transparent",
              color: tab === t.id ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              marginBottom: -1,
            }}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Activity Feed */}
      {loading ? (
        <div className="text-center text-[14px] text-[var(--color-text-tertiary)]" style={{ padding: 60 }}>
          Loading inbox...
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center rounded-xl border border-dashed border-[var(--color-border)]" style={{ padding: "60px 24px" }}>
          <p className="text-[14px] text-[var(--color-text-tertiary)]">
            {tab === "all" ? "No communications yet." : `No ${tab} activity yet.`}
          </p>
          <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4, opacity: 0.7 }}>
            Send an SMS, make a call, or compose an email to get started.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
              style={{ padding: "14px 18px" }}
            >
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{ width: 36, height: 36, background: "var(--color-surface-hover)", fontSize: 16 }}
              >
                {getActivityIcon(a.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-medium text-[var(--color-text-primary)]">
                    {a.contact_id && contacts[a.contact_id]
                      ? contacts[a.contact_id]
                      : (a.metadata as Record<string, string>)?.from ?? (a.metadata as Record<string, string>)?.to ?? "Unknown"}
                  </span>
                  {getDirectionBadge(a.direction)}
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">
                    {new Date(a.occurred_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-[13px] text-[var(--color-text-secondary)] truncate" style={{ marginTop: 2 }}>
                  {a.content || a.ai_summary || `${a.type} activity`}
                </p>
                {a.duration_seconds != null && (
                  <span className="text-[11px] text-[var(--color-text-tertiary)]">
                    Duration: {Math.floor(a.duration_seconds / 60)}:{String(a.duration_seconds % 60).padStart(2, "0")}
                  </span>
                )}
                {a.transcript && (
                  <p className="text-[11px] text-[var(--color-text-tertiary)] truncate" style={{ marginTop: 2 }}>
                    📝 Transcript available
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Compose Panel wrapper ── */
function ComposePanel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)]"
      style={{ padding: "16px 20px", marginBottom: 20 }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <h3 className="text-[14px] font-semibold text-[var(--color-text-primary)]">{title}</h3>
        <button
          onClick={onClose}
          className="flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
          style={{ width: 28, height: 28 }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>
      {children}
    </div>
  );
}
