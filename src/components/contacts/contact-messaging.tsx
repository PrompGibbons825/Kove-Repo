"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Contact, Activity } from "@/lib/types/database";

interface ContactMessagingProps {
  contact: Contact;
}

export function ContactMessaging({ contact }: ContactMessagingProps) {
  const [messages, setMessages] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgPhone, setOrgPhone] = useState<string | null | undefined>(undefined);
  const [sendAs, setSendAs] = useState<"sms" | "email">("sms");
  const [draft, setDraft] = useState("");
  const [subject, setSubject] = useState("");
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCcBcc, setShowCcBcc] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [composeHeight, setComposeHeight] = useState(180);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resizingCompose = useRef(false);

  // Load org phone config
  useEffect(() => {
    fetch("/api/settings/org")
      .then((r) => r.json())
      .then((d) => setOrgPhone(d.telnyx_phone ?? null))
      .catch(() => setOrgPhone(null));
  }, []);

  // Load message activities
  useEffect(() => {
    setLoading(true);
    fetch(`/api/activities?contact_id=${contact.id}`)
      .then((r) => r.json())
      .then((data) => {
        const all: Activity[] = Array.isArray(data) ? data : (data.activities ?? []);
        // Include sms, email, call, and voicemail — sort oldest first
        const msgs = all
          .filter((a) => a.type === "sms" || a.type === "email" || a.type === "call" || a.type === "voicemail")
          .sort((a, b) => new Date(a.occurred_at).getTime() - new Date(b.occurred_at).getTime());
        setMessages(msgs);
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
    setSendError(null);
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
        } else {
          const err = await res.json().catch(() => ({}));
          setSendError(err.error ?? "Failed to send SMS");
        }
      } else {
        // Email sending
        const res = await fetch("/api/comms/email/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: contact.email,
            subject: subject.trim() || "Follow up",
            cc: cc.trim() || undefined,
            bcc: bcc.trim() || undefined,
            body: draft.trim(),
            contact_id: contact.id,
          }),
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
          setSubject("");
          setCc("");
          setBcc("");
          setShowCcBcc(false);
        } else {
          const err = await res.json().catch(() => ({}));
          setSendError(err.error ?? "Failed to send email");
        }
      }
    } catch (err) {
      setSendError("Network error — please try again");
    } finally {
      setSending(false);
    }
  }, [sendAs, draft, contact]);

  const typeIcon = (type: string) => {
    if (type === "email") return "✉️";
    if (type === "call") return "📞";
    if (type === "voicemail") return "📱";
    return "💬";
  };

  const formatCallDuration = (seconds: number | null | undefined) => {
    if (!seconds) return "";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return ` · ${m}:${String(s).padStart(2, "0")}`;
  };

  // Auto-grow textarea
  const autoGrow = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = `${Math.min(ta.scrollHeight, 300)}px`;
  }, []);

  // Resize handle for compose area
  const startComposeResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingCompose.current = true;
    const startY = e.clientY;
    const startH = composeHeight;
    const onMove = (ev: MouseEvent) => {
      if (!resizingCompose.current) return;
      const delta = startY - ev.clientY;
      setComposeHeight(Math.max(100, Math.min(500, startH + delta)));
    };
    const onUp = () => { resizingCompose.current = false; window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [composeHeight]);

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
            {messages.map((msg) => {
              const isCall = msg.type === "call" || msg.type === "voicemail";
              if (isCall) {
                return (
                  <div key={msg.id} className="flex justify-center">
                    <div className="flex items-center gap-2 rounded-full text-[12px] text-[var(--color-text-tertiary)]"
                      style={{ padding: "4px 14px", background: "var(--color-surface-hover)" }}
                    >
                      <span>{typeIcon(msg.type)}</span>
                      <span>{msg.type === "voicemail" ? "Voicemail" : msg.direction === "inbound" ? "Incoming call" : "Outgoing call"}{formatCallDuration(msg.duration_seconds)}</span>
                      <span className="opacity-60">{new Date(msg.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                    </div>
                  </div>
                );
              }
              return (
                <div key={msg.id} className="flex" style={{ justifyContent: msg.direction === "outbound" ? "flex-end" : "flex-start" }}>
                  <div className="rounded-2xl text-[13px] leading-relaxed"
                    style={{
                      maxWidth: "80%", padding: "8px 14px",
                      background: msg.direction === "outbound" ? "var(--color-accent)" : "var(--color-surface-hover)",
                      color: msg.direction === "outbound" ? "white" : "var(--color-text-primary)",
                      borderBottomRightRadius: msg.direction === "outbound" ? 4 : 16,
                      borderBottomLeftRadius: msg.direction === "inbound" ? 4 : 16,
                    }}
                  >
                    <p>{msg.content}</p>
                    <p className="text-[10px]" style={{ marginTop: 4, opacity: 0.7, color: msg.direction === "outbound" ? "rgba(255,255,255,0.7)" : "var(--color-text-tertiary)" }}>
                      {msg.type === "email" ? "Email" : "SMS"} · {new Date(msg.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Resize handle */}
      <div onMouseDown={startComposeResize}
        className="cursor-row-resize hover:bg-[var(--color-accent)]/20 transition-colors border-t border-[var(--color-border)]"
        style={{ height: 5, flexShrink: 0 }}
      />

      {/* Compose area */}
      <div style={{ height: composeHeight, minHeight: 100, flexShrink: 0, padding: "8px 16px", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div className="flex items-center gap-2" style={{ marginBottom: 6, flexShrink: 0 }}>
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
            SMS
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
            Email
          </button>
        </div>

        {sendAs === "sms" && orgPhone === null && (
          <div className="rounded-lg text-[12px]" style={{ padding: "8px 12px", marginBottom: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", flexShrink: 0 }}>
            No phone number configured. Go to{" "}
            <a href="/settings" className="underline font-medium">Settings → Communications</a>{" "}
            to set up a number.
          </div>
        )}
        {sendAs === "sms" && !contact.phone && (
          <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginBottom: 6, flexShrink: 0 }}>No phone number on file</p>
        )}
        {sendAs === "email" && !contact.email && (
          <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginBottom: 6, flexShrink: 0 }}>No email on file</p>
        )}

        {/* Email-specific fields */}
        {sendAs === "email" && (
          <div className="flex flex-col gap-1.5" style={{ marginBottom: 6, flexShrink: 0 }}>
            <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]" style={{ padding: "5px 10px" }}>
              <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] shrink-0">To</span>
              <span className="text-[12px] text-[var(--color-text-primary)] truncate">{contact.email ?? "—"}</span>
              <button onClick={() => setShowCcBcc((p) => !p)} className="ml-auto text-[10px] font-medium text-[var(--color-accent)] hover:underline cursor-pointer shrink-0">
                {showCcBcc ? "Hide" : "CC/BCC"}
              </button>
            </div>
            <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject"
              className="rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40"
              style={{ padding: "5px 10px" }}
            />
            {showCcBcc && (
              <>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]" style={{ padding: "5px 10px" }}>
                  <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] shrink-0">CC</span>
                  <input value={cc} onChange={(e) => setCc(e.target.value)} placeholder="cc@example.com" className="flex-1 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] bg-transparent border-none outline-none" />
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-background)]" style={{ padding: "5px 10px" }}>
                  <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] shrink-0">BCC</span>
                  <input value={bcc} onChange={(e) => setBcc(e.target.value)} placeholder="bcc@example.com" className="flex-1 text-[12px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] bg-transparent border-none outline-none" />
                </div>
              </>
            )}
          </div>
        )}

        {/* Error banner */}
        {sendError && (
          <div className="flex items-center justify-between rounded-lg text-[12px]" style={{ padding: "7px 10px", marginBottom: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", color: "#ef4444", flexShrink: 0 }}>
            <span>{sendError}</span>
            <button onClick={() => setSendError(null)} className="ml-2 opacity-60 hover:opacity-100 cursor-pointer">✕</button>
          </div>
        )}

        {/* Text area with overlayed send button */}
        <div className="relative flex-1 min-h-0">
          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => { setDraft(e.target.value); autoGrow(); }}
            placeholder={sendAs === "sms" ? "Type SMS..." : "Compose email..."}
            disabled={(sendAs === "sms" && !contact.phone) || (sendAs === "email" && !contact.email)}
            className="w-full h-full rounded-lg border border-[var(--color-border)] bg-[var(--color-background)] text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)]/40 resize-none transition-colors disabled:opacity-40"
            style={{ padding: "8px 44px 8px 12px" }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && sendAs === "sms") {
                e.preventDefault();
                sendMessage();
              }
            }}
          />
          <button
            onClick={sendMessage}
            disabled={!draft.trim() || sending || (sendAs === "sms" && (!contact.phone || orgPhone === null)) || (sendAs === "email" && !contact.email)}
            className="absolute bottom-2 right-2 flex items-center justify-center rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-30 hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
            style={{ width: 30, height: 30 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m22 2-7 20-4-9-9-4Z" /><path d="m22 2-11 11" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
