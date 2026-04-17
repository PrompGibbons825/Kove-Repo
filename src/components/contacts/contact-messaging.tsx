"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Contact, Activity } from "@/lib/types/database";

interface ContactMessagingProps {
  contact: Contact;
}

export function ContactMessaging({ contact }: ContactMessagingProps) {
  const [messages, setMessages] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"sms" | "email">("sms");
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
      if (tab === "sms") {
        const res = await fetch("/api/comms/sms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: contact.phone, text: draft.trim() }),
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
          body: JSON.stringify({ to: contact.email, subject: "Follow up", body: draft.trim() }),
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
  }, [tab, draft, contact]);

  const filteredMessages = messages.filter((m) => m.type === tab);

  return (
    <div className="flex flex-col h-full">
      {/* Tab switcher */}
      <div className="flex items-center border-b border-[var(--color-border)]" style={{ padding: "0 16px" }}>
        <button
          onClick={() => setTab("sms")}
          className="text-[13px] font-medium transition-colors cursor-pointer"
          style={{
            padding: "10px 16px",
            color: tab === "sms" ? "var(--color-accent)" : "var(--color-text-tertiary)",
            borderBottom: tab === "sms" ? "2px solid var(--color-accent)" : "2px solid transparent",
          }}
        >
          SMS
        </button>
        <button
          onClick={() => setTab("email")}
          className="text-[13px] font-medium transition-colors cursor-pointer"
          style={{
            padding: "10px 16px",
            color: tab === "email" ? "var(--color-accent)" : "var(--color-text-tertiary)",
            borderBottom: tab === "email" ? "2px solid var(--color-accent)" : "2px solid transparent",
          }}
        >
          Email
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ padding: 16 }}>
        {loading ? (
          <p className="text-[13px] text-[var(--color-text-tertiary)] text-center" style={{ padding: 32 }}>Loading...</p>
        ) : filteredMessages.length === 0 ? (
          <div className="text-center" style={{ padding: 48 }}>
            <p className="text-[14px] text-[var(--color-text-tertiary)]">No {tab === "sms" ? "SMS" : "email"} messages yet</p>
            <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4, opacity: 0.7 }}>
              Send a message below to start the conversation
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredMessages.map((msg) => (
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
                    className="text-[10px]"
                    style={{
                      marginTop: 4,
                      opacity: 0.7,
                      color: msg.direction === "outbound" ? "rgba(255,255,255,0.7)" : "var(--color-text-tertiary)",
                    }}
                  >
                    {new Date(msg.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Compose */}
      <div className="border-t border-[var(--color-border)]" style={{ padding: "12px 16px" }}>
        {tab === "sms" && !contact.phone && (
          <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginBottom: 8 }}>No phone number on file</p>
        )}
        {tab === "email" && !contact.email && (
          <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginBottom: 8 }}>No email on file</p>
        )}
        <div className="flex gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={`Type ${tab === "sms" ? "SMS" : "email"}...`}
            rows={2}
            disabled={(tab === "sms" && !contact.phone) || (tab === "email" && !contact.email)}
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
            disabled={!draft.trim() || sending || (tab === "sms" && !contact.phone) || (tab === "email" && !contact.email)}
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
