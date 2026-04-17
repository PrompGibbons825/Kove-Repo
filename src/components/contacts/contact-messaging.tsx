"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Contact, Activity } from "@/lib/types/database";

interface ContactMessagingProps {
  contact: Contact;
}

export function ContactMessaging({ contact }: ContactMessagingProps) {
  const [messages, setMessages] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendAs, setSendAs] = useState<"sms" | "email">("sms");
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load message activities
  useEffect(() => {
    setLoading(true);
    fetch(`/api/activities?contact_id=${contact.id}`)
      .then((r) => r.json())
      .then((data) => {
        const all: Activity[] = Array.isArray(data) ? data : (data.activities ?? []);
        // Filter to only sms and email
        setMessages(all.filter((a) => a.type === "sms" || a.type === "email"));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [contact.id]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!draft.trim()) return;
    setSending(true);
    try {
      if (sendAs === "sms") {
        const res = await fetch("/api/comms/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ contact_id: contact.id, to: contact.phone, message: draft.trim() }),
        });
        if (res.ok) {
          const data = await res.json();
          setMessages((prev) => [...prev, {
            id: data.activity?.id ?? crypto.randomUUID(),
            contact_id: contact.id,
            user_id: "",
            org_id: "",
            type: "sms",
            content: draft.trim(),
            ai_summary: null,
            action_items: [],
            direction: "outbound",
            duration_seconds: null,
            recording_url: null,
            transcript: null,
            metadata: {},
            occurred_at: new Date().toISOString(),
          }]);
          setDraft("");
        }
      } else {
        // Email sending
        const res = await fetch("/api/comms/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: contact.email, subject: "Follow up", body: draft.trim(), contact_id: contact.id }),
        });
        if (res.ok) {
          setMessages((prev) => [...prev, {
            id: crypto.randomUUID(),
            contact_id: contact.id,
            user_id: "",
            org_id: "",
            type: "email",
            content: draft.trim(),
            ai_summary: null,
            action_items: [],
            direction: "outbound",
            duration_seconds: null,
            recording_url: null,
            transcript: null,
            metadata: {},
            occurred_at: new Date().toISOString(),
          }]);
          setDraft("");
        }
      }
    } catch {
    } finally {
      setSending(false);
    }
  }, [sendAs, draft, contact]);

  const typeIcon = (type: string) => type === "email" ? "✉️" : "💬";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center border-b border-[var(--color-border)]" style={{ padding: "10px 16px" }}>
        <span className="text-[13px] font-semibold text-[var(--color-text-primary)]">Messages</span>
      </div>

      {/* All messages — unified thread */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ padding: 16 }}>
        {loading ? (
          <p className="text-[13px] text-[var(--color-text-tertiary)] text-center" style={{ padding: 32 }}>Loading...</p>
        ) : messages.length === 0 ? (
          <div className="text-center" style={{ padding: 48 }}>
            <p className="text-[14px] text-[var(--color-text-tertiary)]">No messages yet</p>
            <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4, opacity: 0.7 }}>
              Send an SMS or email below to start the conversation
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="flex"
                style={{ justifyContent: msg.direction === "outbound" ? "flex-end" : "flex-start" }}
              >
                <div
                  className="rounded-2xl text-[13px] leading-relaxed"
                  style={{
                    maxWidth: "80%",
                    padding: "8px 14px",
                    background: msg.direction === "outbound" ? "var(--color-accent)" : "var(--color-surface-hover)",
                    color: msg.direction === "outbound" ? "white" : "var(--color-text-primary)",
                    borderBottomRightRadius: msg.direction === "outbound" ? 4 : 16,
                    borderBottomLeftRadius: msg.direction === "inbound" ? 4 : 16,
                  }}
                >
                  <p>{msg.content}</p>
                  <p
                    className="text-[10px] flex items-center gap-1"
                    style={{
                      marginTop: 4,
                      opacity: 0.7,
                      color: msg.direction === "outbound" ? "rgba(255,255,255,0.7)" : "var(--color-text-tertiary)",
                    }}
                  >
                    <span>{typeIcon(msg.type)}</span>
                    {new Date(msg.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose — inline send-as toggle */}
      <div className="border-t border-[var(--color-border)]" style={{ padding: "10px 16px" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
          <span className="text-[11px] text-[var(--color-text-tertiary)]">Send as:</span>
          <button
            onClick={() => setSendAs("sms")}
            className="text-[11px] font-medium rounded-full transition-colors cursor-pointer"
            style={{
              padding: "2px 10px",
              background: sendAs === "sms" ? "var(--color-accent)" : "var(--color-surface-hover)",
              color: sendAs === "sms" ? "white" : "var(--color-text-secondary)",
            }}
          >
            💬 SMS
          </button>
          <button
            onClick={() => setSendAs("email")}
            className="text-[11px] font-medium rounded-full transition-colors cursor-pointer"
            style={{
              padding: "2px 10px",
              background: sendAs === "email" ? "var(--color-accent)" : "var(--color-surface-hover)",
              color: sendAs === "email" ? "white" : "var(--color-text-secondary)",
            }}
          >
            ✉️ Email
          </button>
        </div>
        {sendAs === "sms" && !contact.phone && (
          <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginBottom: 8 }}>No phone number on file</p>
        )}
        {sendAs === "email" && !contact.email && (
          <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginBottom: 8 }}>No email on file</p>
        )}
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={sendAs === "sms" ? "Type SMS..." : "Type email..."}
            rows={2}
            disabled={(sendAs === "sms" && !contact.phone) || (sendAs === "email" && !contact.email)}
            className="flex-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 resize-none transition-colors disabled:opacity-40"
            style={{ padding: "8px 12px" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!draft.trim() || sending || (sendAs === "sms" && !contact.phone) || (sendAs === "email" && !contact.email)}
            className="flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-30 hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer self-end"
            style={{ width: 34, height: 34 }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" /><path d="m22 2-11 11" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
