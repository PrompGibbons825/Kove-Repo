"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { TranscriptEntry } from "@/hooks/use-live-transcript";
import type { Contact } from "@/lib/types/database";

interface CoachingSuggestion {
  suggestions: string[];
  qualificationMet: string[];
  sentiment: "positive" | "neutral" | "negative";
  nextAction: string;
}

interface LiveSessionProps {
  active: boolean;
  entries: TranscriptEntry[];
  contact: Contact;
  onAction: (action: string, params?: Record<string, unknown>) => void;
  callDuration?: number;
}

export function LiveSession({ active, entries, contact, onAction, callDuration }: LiveSessionProps) {
  const [coaching, setCoaching] = useState<CoachingSuggestion | null>(null);
  const [loadingCoach, setLoadingCoach] = useState(false);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastCoachRef = useRef(0);

  // Auto-scroll transcript
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries]);

  // Fetch coaching suggestions every ~5 seconds during active calls
  useEffect(() => {
    if (!active || entries.length === 0) return;

    const finalEntries = entries.filter((e) => e.isFinal);
    if (finalEntries.length === 0) return;

    const now = Date.now();
    if (now - lastCoachRef.current < 5000) return;

    lastCoachRef.current = now;
    setLoadingCoach(true);

    const transcript = finalEntries
      .map((e) => `${e.speaker === "agent" ? "Agent" : "Customer"}: ${e.text}`)
      .join("\n");

    fetch("/api/ai/live-coach", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transcript,
        contactContext: `${contact.name} — ${contact.status} — ${contact.ai_summary ?? "No summary"}`,
        previousSuggestions: coaching?.suggestions?.join(", ") ?? null,
      }),
    })
      .then(async (res) => {
        if (!res.ok || !res.body) return;
        // Read SSE stream and parse Claude response
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          // Parse Anthropic SSE events
          const lines = chunk.split("\n");
          for (const line of lines) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6));
                if (data.type === "content_block_delta" && data.delta?.text) {
                  fullText += data.delta.text;
                }
              } catch {}
            }
          }
        }

        // Parse the complete JSON response
        const jsonMatch = fullText.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          try {
            setCoaching(JSON.parse(jsonMatch[0]));
          } catch {}
        }
      })
      .catch(() => {})
      .finally(() => setLoadingCoach(false));
  }, [entries, active]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAction = useCallback((action: string, params?: Record<string, unknown>) => {
    setActionFeedback(`${action}...`);
    onAction(action, params);
    setTimeout(() => setActionFeedback(null), 2000);
  }, [onAction]);

  const sentimentColor = coaching?.sentiment === "positive" ? "#22c55e" : coaching?.sentiment === "negative" ? "#ef4444" : "var(--color-text-tertiary)";

  // Idle state
  if (!active && entries.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ padding: 32 }}>
        <div className="text-center">
          <div className="mx-auto rounded-2xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center" style={{ width: 80, height: 80, marginBottom: 16 }}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.5 }}>
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-[var(--color-text-tertiary)]">Live transcript will appear here</p>
          <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginTop: 6, opacity: 0.7 }}>
            During calls, the AI assistant will surface<br />talking points and real-time suggestions.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Transcript */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto" style={{ padding: "12px 16px" }}>
        {entries.filter(e => e.isFinal || entries.indexOf(e) === entries.length - 1).map((entry, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: entry.speaker === "agent" ? "var(--color-accent)" : sentimentColor }}
            >
              {entry.speaker === "agent" ? "You" : "Customer"}
            </span>
            <p
              className="text-[13px] leading-relaxed"
              style={{
                color: entry.isFinal ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
                fontStyle: entry.isFinal ? "normal" : "italic",
              }}
            >
              {entry.text}
            </p>
          </div>
        ))}
        {active && entries.length === 0 && (
          <div className="flex items-center gap-2" style={{ padding: "12px 0" }}>
            <div className="rounded-full animate-pulse" style={{ width: 8, height: 8, background: "#ef4444" }} />
            <span className="text-[13px] text-[var(--color-text-tertiary)]">Listening...</span>
          </div>
        )}
      </div>

      {/* AI Coaching Panel */}
      {coaching && (
        <div className="border-t border-[var(--color-border)]" style={{ padding: "12px 16px" }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 8 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
            </svg>
            <span className="text-[11px] font-semibold text-[var(--color-accent)] uppercase tracking-wider">AI Coach</span>
            {loadingCoach && <span className="text-[10px] text-[var(--color-text-tertiary)]">thinking...</span>}
          </div>
          <div className="space-y-1.5">
            {coaching.suggestions.map((s, i) => (
              <p key={i} className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed">💡 {s}</p>
            ))}
            {coaching.nextAction && (
              <p className="text-[12px] text-[var(--color-accent)] font-medium">→ {coaching.nextAction}</p>
            )}
          </div>
          {coaching.qualificationMet.length > 0 && (
            <div className="flex flex-wrap gap-1" style={{ marginTop: 8 }}>
              {coaching.qualificationMet.map((q, i) => (
                <span key={i} className="text-[10px] rounded-full border border-green-500/30 text-green-600" style={{ padding: "2px 8px", background: "rgba(34,197,94,0.1)" }}>
                  ✓ {q}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="border-t border-[var(--color-border)] flex flex-wrap gap-1.5" style={{ padding: "10px 16px" }}>
        {actionFeedback && (
          <div className="w-full text-[11px] text-[var(--color-accent)] font-medium" style={{ marginBottom: 4 }}>{actionFeedback}</div>
        )}
        <ActionBtn label="Advance Status" icon="↑" onClick={() => handleAction("advance_status")} />
        <ActionBtn label="Follow-up" icon="📅" onClick={() => handleAction("create_followup")} />
        <ActionBtn label="Appointment" icon="🗓" onClick={() => handleAction("schedule_appointment")} />
        <ActionBtn label="Handoff" icon="🤝" onClick={() => handleAction("assign_handoff")} />
        <ActionBtn label="Note" icon="📝" onClick={() => handleAction("log_note", { content: `Note from call` })} />
      </div>
    </div>
  );
}

function ActionBtn({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 rounded-lg border border-[var(--color-border)] text-[11px] font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
      style={{ padding: "4px 10px" }}
    >
      <span>{icon}</span> {label}
    </button>
  );
}
