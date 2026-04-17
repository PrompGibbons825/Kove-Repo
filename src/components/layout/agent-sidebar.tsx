"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { User, Organization } from "@/lib/types/database";

type Mode = "ask" | "plan" | "agent";

interface AgentSidebarProps {
  user: User;
  org: Organization;
  width: number;
  onWidthChange: (w: number) => void;
  onClose: () => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const MODE_META: Record<Mode, { label: string; desc: string; color: string }> = {
  ask:   { label: "Ask",   desc: "Quick answers about your data",       color: "var(--color-accent)" },
  plan:  { label: "Plan",  desc: "Build step-by-step action plans",     color: "#f59e0b" },
  agent: { label: "Agent", desc: "Autonomous task execution",           color: "#10b981" },
};

export function AgentSidebar({ user, org, width, onWidthChange, onClose }: AgentSidebarProps) {
  const [mode, setMode] = useState<Mode>("agent");
  const [modeOpen, setModeOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `Hey ${user.full_name?.split(" ")[0] ?? "there"}! I'm your AI sales assistant. Ask me anything — lead priorities, follow-up suggestions, or data insights.`,
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resizingRef = useRef(false);

  // Animate in on mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Resize drag
  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      const delta = startX - ev.clientX;
      onWidthChange(Math.max(320, Math.min(700, startW + delta)));
    };
    const onUp = () => {
      resizingRef.current = false;
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [width, onWidthChange]);

  function handleClose() {
    setVisible(false);
    setTimeout(onClose, 250);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: userMessage.content,
          mode,
          conversationHistory: messages.map((m) => ({ role: m.role, content: m.content })),
          pageContext: { page: window.location.pathname },
        }),
      });
      const data = await response.json();
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: data.response ?? "Something went wrong. Try again." }]);
    } catch {
      setMessages((prev) => [...prev, { id: crypto.randomUUID(), role: "assistant", content: "Connection error. Check your internet and try again." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  }

  return (
    <aside
      className="fixed top-0 right-0 z-50 flex h-screen flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
      style={{
        width: visible ? width : 40,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "width 250ms cubic-bezier(0.16,1,0.3,1), opacity 200ms ease, transform 250ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {/* Resize handle */}
      <div
        onMouseDown={startResize}
        className="absolute left-0 top-0 bottom-0 cursor-col-resize hover:bg-[var(--color-accent)]/20 transition-colors z-10"
        style={{ width: 6 }}
      />

      {/* Header */}
      <div style={{ padding: "16px 20px 12px" }} className="flex items-center justify-between border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center rounded-xl" style={{ width: 36, height: 36, background: "var(--color-accent)" }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
          </div>
          <div>
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-tight">kove AI</p>
            <p className="text-[11px] text-[var(--color-text-tertiary)] leading-tight" style={{ marginTop: 2 }}>Always ready to help</p>
          </div>
        </div>
        <button
          onClick={handleClose}
          className="flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-all duration-150 cursor-pointer"
          style={{ width: 32, height: 32 }}
          aria-label="Close agent"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18" /><path d="m6 6 12 12" />
          </svg>
        </button>
      </div>



      {/* Messages */}
      <div className="flex-1 overflow-y-auto" style={{ padding: "12px 20px 16px" }}>
        <div className="space-y-4">
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              {msg.role === "assistant" && (
                <div className="mr-2 mt-0.5 flex shrink-0 items-center justify-center rounded-full" style={{ width: 24, height: 24, background: "var(--color-accent)", opacity: 0.15 }}>
                  <span className="text-[10px]">✨</span>
                </div>
              )}
              <div
                className="text-[13px] leading-relaxed"
                style={{
                  maxWidth: "82%",
                  padding: "10px 14px",
                  borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                  background: msg.role === "user" ? "var(--color-accent)" : "var(--color-surface-hover)",
                  color: msg.role === "user" ? "white" : "var(--color-text-primary)",
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="mr-2 mt-0.5 flex shrink-0 items-center justify-center rounded-full" style={{ width: 24, height: 24, background: "var(--color-accent)", opacity: 0.15 }}>
                <span className="text-[10px]">✨</span>
              </div>
              <div className="rounded-2xl rounded-bl-sm" style={{ background: "var(--color-surface-hover)", padding: "12px 16px" }}>
                <div className="flex gap-1.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-tertiary)]" style={{ animationDelay: "0ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-tertiary)]" style={{ animationDelay: "150ms" }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[var(--color-text-tertiary)]" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="border-t border-[var(--color-border)]" style={{ padding: "12px 20px 16px" }}>
        <div
          className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] focus-within:border-[var(--color-accent)]/40 transition-all duration-150"
          style={{ padding: "10px 12px" }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your leads, tasks, or pipeline..."
            rows={1}
            className="w-full resize-none bg-transparent text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none leading-relaxed"
          />
          {/* Bottom bar: mode dropdown + send */}
          <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
            <div className="relative">
              <button
                type="button"
                onClick={() => setModeOpen((v) => !v)}
                className="flex items-center gap-1 text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
              >
                {MODE_META[mode].label}
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m6 9 6 6 6-6" />
                </svg>
              </button>
              {modeOpen && (
                <div
                  className="absolute bottom-full left-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg overflow-hidden"
                  style={{ marginBottom: 4, minWidth: 150 }}
                >
                  {(["ask", "plan", "agent"] as Mode[]).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => { setMode(m); setModeOpen(false); }}
                      className="flex w-full items-center gap-2 text-left text-[12px] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer"
                      style={{ padding: "8px 12px", color: mode === m ? MODE_META[m].color : "var(--color-text-secondary)" }}
                    >
                      <span className="font-medium">{MODE_META[m].label}</span>
                      <span className="text-[11px] text-[var(--color-text-tertiary)]">{MODE_META[m].desc}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="flex shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent)] text-white disabled:opacity-20 transition-all duration-150 hover:bg-[var(--color-accent-hover)] cursor-pointer"
              style={{ width: 30, height: 30 }}
              aria-label="Send message"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-center text-[10px] text-[var(--color-text-tertiary)]" style={{ marginTop: 8 }}>
          kove AI can make mistakes. Verify important information.
        </p>
      </form>
    </aside>
  );
}
