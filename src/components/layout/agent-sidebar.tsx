"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import type { User, Organization } from "@/lib/types/database";
import { useLandingPageBuilder } from "@/components/landing-pages/builder-context";
import { useWorkflowBuilder } from "@/components/workflows/workflow-context";

type Mode = "ask" | "plan" | "agent";
type View = "list" | "chat";

interface AgentSidebarProps {
  user: User;
  org: Organization;
  width: number;
  onWidthChange: (w: number) => void;
  onClose: () => void;
  contained?: boolean;
  welcomeContext?: string | null;
  onWelcomeHandled?: () => void;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  actions?: Array<{ label: string; value: string; desc?: string }>;
}

interface Chat {
  id: string;
  name: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = "kove_agent_chats";
const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const MODE_META: Record<Mode, { label: string; desc: string; color: string }> = {
  ask:   { label: "Ask",   desc: "Quick answers about your data",   color: "var(--color-accent)" },
  plan:  { label: "Plan",  desc: "Build step-by-step action plans", color: "#f59e0b" },
  agent: { label: "Agent", desc: "Autonomous task execution",       color: "#10b981" },
};

function loadChats(): Chat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const chats: Chat[] = JSON.parse(raw);
    const cutoff = Date.now() - ONE_WEEK_MS;
    return chats.filter((c) => c.updatedAt > cutoff);
  } catch {
    return [];
  }
}

function saveChats(chats: Chat[]) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(chats)); } catch {}
}

function autoName(messages: Message[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  const text = first.content.trim();
  return text.length > 52 ? text.slice(0, 52) + "…" : text;
}

function formatRelative(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export function AgentSidebar({ user, org, width, onWidthChange, onClose, contained, welcomeContext, onWelcomeHandled }: AgentSidebarProps) {
  const lpBuilder = useLandingPageBuilder();
  const wfBuilder = useWorkflowBuilder();
  const [view, setView] = useState<View>("list");
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("agent");
  const [modeOpen, setModeOpen] = useState(false);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const resizingRef = useRef(false);

  useEffect(() => {
    setChats(loadChats());
    requestAnimationFrame(() => setVisible(true));
  }, []);

  const activeChat = chats.find((c) => c.id === activeChatId) ?? null;

  useEffect(() => {
    if (view === "chat") {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
      inputRef.current?.focus();
    }
  }, [activeChat?.messages, view]);

  useEffect(() => {
    if (chats.length > 0) saveChats(chats);
  }, [chats]);

  const startResize = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    resizingRef.current = true;
    const startX = e.clientX;
    const startW = width;
    const onMove = (ev: MouseEvent) => {
      if (!resizingRef.current) return;
      onWidthChange(Math.max(320, Math.min(700, startW + (startX - ev.clientX))));
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
    pruneEmptyChat(activeChatId);
    setVisible(false);
    setTimeout(onClose, 250);
  }

  function startNewChat() {
    pruneEmptyChat(activeChatId);
    const welcomeMsg: Message = {
      id: "welcome",
      role: "assistant",
      content: `Hey ${user.full_name?.split(" ")[0] ?? "there"}! I'm your AI sales assistant. Ask me anything — lead priorities, follow-up suggestions, or data insights.`,
    };
    const newChat: Chat = {
      id: crypto.randomUUID(),
      name: "New chat",
      messages: [welcomeMsg],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setView("chat");
  }

  function openChat(id: string) {
    setActiveChatId(id);
    setView("chat");
  }

  // Remove a chat if the user never sent a message
  function pruneEmptyChat(id: string | null) {
    if (!id) return;
    setChats((prev) => {
      const chat = prev.find((c) => c.id === id);
      if (!chat) return prev;
      const hasUserMessage = chat.messages.some((m) => m.role === "user");
      if (hasUserMessage) return prev;
      const next = prev.filter((c) => c.id !== id);
      saveChats(next);
      return next;
    });
  }

  function startWorkflowWelcomeChat() {
    const welcomeMsg: Message = {
      id: "wf-welcome",
      role: "assistant",
      content: `**Welcome to Workflows!** ⚡\n\nWorkflows let you automate repetitive tasks — from capturing leads to following up with clients, all on autopilot. Chain together **triggers** (new contact, inbound call, form submit) with **actions** (send email, SMS, create task, notify team).\n\nHere are the 4 most common workflows to get you started, or we can build a fully custom one together!`,
      actions: [
        { label: "⚡ Lead capture",  value: "template:Lead capture",  desc: "Landing page → instant email + task" },
        { label: "📞 Missed call",   value: "template:Missed call",   desc: "Inbound call → SMS + notify team" },
        { label: "💌 Drip campaign", value: "template:Drip campaign", desc: "New contact → 3-touch email sequence" },
        { label: "📅 Meeting prep",  value: "template:Meeting prep",  desc: "Scheduled event → reminder SMS" },
        { label: "✨ Build custom",  value: "custom",                 desc: "Start from scratch with AI help" },
      ],
    };
    const newChat: Chat = {
      id: crypto.randomUUID(),
      name: "Workflows setup",
      messages: [welcomeMsg],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setChats((prev) => [newChat, ...prev]);
    setActiveChatId(newChat.id);
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setView("chat");
  }

  function handleActionClick(value: string, msgId: string) {
    const isTemplate = value.startsWith("template:");
    const name = isTemplate ? value.replace("template:", "") : null;
    if (isTemplate && name) {
      window.dispatchEvent(new CustomEvent("workflow-use-template", { detail: { name } }));
    }
    const responseContent = isTemplate && name
      ? `Opening **${name}** for you! 🎉 The canvas is pre-built and ready — customize it however you like.`
      : `Awesome! Just type your workflow name in the field on the left and hit enter to kick things off. 🚀`;
    const confirmMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: responseContent };
    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? {
              ...c,
              updatedAt: Date.now(),
              messages: [
                ...c.messages.map((m) => m.id === msgId ? { ...m, actions: undefined } : m),
                confirmMsg,
              ],
            }
          : c
      )
    );
  }

  // Auto-create workflow welcome chat when prompted
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { if (welcomeContext === "workflow") { startWorkflowWelcomeChat(); onWelcomeHandled?.(); } }, [welcomeContext]);

  function goBack() {
    pruneEmptyChat(activeChatId);
    setView("list");
    setActiveChatId(null);
  }

  function deleteChat(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setChats((prev) => {
      const next = prev.filter((c) => c.id !== id);
      saveChats(next);
      return next;
    });
    if (activeChatId === id) goBack();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || loading || !activeChatId) return;

    const userMessage: Message = { id: crypto.randomUUID(), role: "user", content: input.trim() };
    setInput("");
    if (inputRef.current) inputRef.current.style.height = "auto";
    setLoading(true);

    const currentMessages = activeChat?.messages ?? [];

    setChats((prev) =>
      prev.map((c) =>
        c.id === activeChatId
          ? { ...c, messages: [...c.messages, userMessage], updatedAt: Date.now(), name: c.name === "New chat" ? autoName([...c.messages, userMessage]) : c.name }
          : c
      )
    );

    try {
      const isLpMode = lpBuilder.state.active;
      const isWfMode = wfBuilder.state.active;

      // Always use /api/agent when in workflow mode — LP HTML generation is handled via ```html blocks
      const endpoint = (isLpMode && !isWfMode) ? "/api/lp/generate" : "/api/agent";

      // Build workflow page context so agent sees current canvas state
      // Include LP context whenever there's a landing-page node in the workflow (panel open or not)
      const hasLpNode = isWfMode && wfBuilder.state.nodes.some((n) => n.type === "landing-page");
      const lpContext = isWfMode && (isLpMode || hasLpNode)
        ? `\n\nLANDING PAGE CONTEXT:\n` +
          (isLpMode ? `Landing page panel is OPEN — you can generate/edit HTML for it.\n` : `A landing-page node exists on the canvas. The panel is not currently open.\n`) +
          `Page ID: ${lpBuilder.state.pageId || "(not saved yet)"}\n` +
          `Slug: ${lpBuilder.state.slug || "(none set)"}\n` +
          `Brand assets: ${lpBuilder.state.brandAssets.length > 0 ? lpBuilder.state.brandAssets.map(a => `${a.type}: ${a.name} (${a.url})`).join(", ") : "(none)"}\n` +
          `Current HTML: ${lpBuilder.state.html ? `${lpBuilder.state.html.length} chars of HTML exist` : "(no HTML yet — page not generated)"}\n` +
          (lpBuilder.state.html ? `\nCurrent HTML (full):\n${lpBuilder.state.html}` : "")
        : "";

      const wfPageContext = isWfMode
        ? {
            page: window.location.pathname,
            additionalContext:
              `WORKFLOW BUILDER MODE\n` +
              `Current workflow: "${wfBuilder.state.workflowName}" (id: ${wfBuilder.state.workflowId})\n` +
              `Nodes (${wfBuilder.state.nodes.length}):\n` +
              (wfBuilder.state.nodes.length
                ? wfBuilder.state.nodes.map((n) => `  - [${n.id.slice(0, 8)}] ${n.label} (type: ${n.type})`).join("\n")
                : "  (empty canvas)") +
              `\nEdges (${wfBuilder.state.edges.length}):\n` +
              (wfBuilder.state.edges.length
                ? wfBuilder.state.edges.map((e) => `  - ${e.from.slice(0, 8)} → ${e.to.slice(0, 8)}`).join("\n")
                : "  (no connections)") +
              lpContext,
          }
        : { page: window.location.pathname };

      const body = (isLpMode && !isWfMode)
        ? {
            message: userMessage.content,
            conversationHistory: currentMessages.map((m) => ({ role: m.role, content: m.content })),
            landingPageId: lpBuilder.state.pageId || undefined,
            brandAssets: lpBuilder.state.brandAssets,
            slug: lpBuilder.state.slug,
          }
        : {
            message: userMessage.content,
            mode,
            conversationHistory: currentMessages.map((m) => ({ role: m.role, content: m.content })),
            pageContext: wfPageContext,
          };
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (isLpMode && data.html) {
        lpBuilder.setHtml(data.html);
      }

      const rawContent: string = data.response ?? data.summary ?? "Something went wrong. Try again.";

      // Parse any JSON workflow commands the agent embedded in its response
      if (isWfMode) {
        const cmdRegex = /```json\s*([\s\S]*?)```/g;
        let match;
        while ((match = cmdRegex.exec(rawContent)) !== null) {
          try {
            const parsed = JSON.parse(match[1]);
            const cmds = Array.isArray(parsed) ? parsed : [parsed];
            for (const cmd of cmds) {
              if (cmd.action === "add_node" && cmd.type && cmd.label) {
                wfBuilder.addNode({
                  type: cmd.type,
                  label: cmd.label,
                  x: cmd.x ?? 100 + wfBuilder.state.nodes.length * 220,
                  y: cmd.y ?? 200,
                });
              } else if (cmd.action === "add_edge" && cmd.from && cmd.to) {
                wfBuilder.addEdge(cmd.from, cmd.to);
              }
            }
          } catch { /* ignore malformed JSON */ }
        }

        // Parse ```html blocks — landing page HTML updates
        const htmlRegex = /```html\s*([\s\S]*?)```/g;
        let htmlMatch;
        while ((htmlMatch = htmlRegex.exec(rawContent)) !== null) {
          const generatedHtml = htmlMatch[1].trim();
          if (generatedHtml && (isLpMode || hasLpNode)) {
            lpBuilder.setHtml(generatedHtml);
          }
        }
      }

      // Strip the raw JSON and HTML blocks from the visible message
      const displayContent = rawContent.replace(/```(?:json|html)[\s\S]*?```/g, "").trim();

      const assistantMessage: Message = { id: crypto.randomUUID(), role: "assistant", content: displayContent || "Done! The canvas has been updated." };
      setChats((prev) =>
        prev.map((c) => c.id === activeChatId ? { ...c, messages: [...c.messages, assistantMessage], updatedAt: Date.now() } : c)
      );
    } catch {
      const errMsg: Message = { id: crypto.randomUUID(), role: "assistant", content: "Connection error. Check your internet and try again." };
      setChats((prev) =>
        prev.map((c) => c.id === activeChatId ? { ...c, messages: [...c.messages, errMsg], updatedAt: Date.now() } : c)
      );
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSubmit(e); }
  }

  const iconBtn = "flex items-center justify-center rounded-lg text-[var(--color-text-tertiary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] transition-all duration-150 cursor-pointer";

  const headerLeft = view === "chat" ? (
    <div className="flex items-center gap-2 min-w-0">
      <button onClick={goBack} className={iconBtn} style={{ width: 32, height: 32, flexShrink: 0 }} aria-label="Back to chats">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>
      <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate">{activeChat?.name ?? "Chat"}</p>
      {lpBuilder.state.active && (
        <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-[var(--color-accent-soft)] text-[var(--color-accent)] rounded-full whitespace-nowrap">
          ✦ Landing Page
        </span>
      )}
      {wfBuilder.state.active && (
        <span className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 rounded-full whitespace-nowrap">
          ⚡ Workflow
        </span>
      )}
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <div className="flex items-center justify-center rounded-xl" style={{ width: 30, height: 30, background: "var(--color-accent)" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
      </div>
      <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">kove AI</p>
    </div>
  );

  return (
    <aside
      className={
        contained
          ? "relative flex h-full w-full flex-col overflow-hidden bg-[var(--color-surface)]"
          : "fixed top-0 right-0 z-50 flex h-screen flex-col border-l border-[var(--color-border)] bg-[var(--color-surface)] shadow-xl"
      }
      style={contained ? {} : {
        width: visible ? width : 40,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(100%)",
        transition: "width 250ms cubic-bezier(0.16,1,0.3,1), opacity 200ms ease, transform 250ms cubic-bezier(0.16,1,0.3,1)",
      }}
    >
      {!contained && (
        <div onMouseDown={startResize} className="absolute left-0 top-0 bottom-0 cursor-col-resize hover:bg-[var(--color-accent)]/20 transition-colors z-10" style={{ width: 6 }} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] flex-shrink-0" style={{ padding: "10px 12px 10px 14px" }}>
        {headerLeft}
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button onClick={startNewChat} className={iconBtn} style={{ width: 32, height: 32 }} aria-label="New chat">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
          </button>
          <button onClick={handleClose} className={iconBtn} style={{ width: 32, height: 32 }} aria-label="Close">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18" /><path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── LIST VIEW ── */}
      {view === "list" && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {chats.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-4" style={{ padding: "40px 24px" }}>
              <div className="flex items-center justify-center rounded-2xl" style={{ width: 52, height: 52, background: "var(--color-surface-hover)" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">No recent chats</p>
                <p className="text-[12px] text-[var(--color-text-tertiary)]" style={{ marginTop: 4 }}>Start a new conversation below</p>
              </div>
              <button onClick={startNewChat} className="rounded-lg bg-[var(--color-accent)] text-white text-[13px] font-medium transition-all hover:bg-[var(--color-accent-hover)] cursor-pointer" style={{ padding: "8px 20px" }}>
                New chat
              </button>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto" style={{ padding: "8px 0" }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]" style={{ padding: "4px 16px 8px" }}>
                  Recent Sessions
                </p>
                {chats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => openChat(chat.id)}
                    className="group relative flex w-full items-start gap-3 text-left transition-colors hover:bg-[var(--color-surface-hover)] cursor-pointer"
                    style={{ padding: "9px 16px" }}
                  >
                    <div className="mt-0.5 flex shrink-0 items-center justify-center rounded-lg" style={{ width: 26, height: 26, background: "var(--color-surface-hover)" }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--color-text-tertiary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                      </svg>
                    </div>
                    <div className="min-w-0 flex-1 pr-6">
                      <p className="truncate text-[13px] text-[var(--color-text-primary)] leading-snug">{chat.name}</p>
                      <p className="text-[11px] text-[var(--color-text-tertiary)]" style={{ marginTop: 2 }}>
                        {formatRelative(chat.updatedAt)} · {chat.messages.filter(m => m.role === "user").length} message{chat.messages.filter(m => m.role === "user").length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <button
                      onClick={(e) => deleteChat(chat.id, e)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 transition-opacity text-[var(--color-text-tertiary)] hover:text-red-400 hover:bg-red-500/10 cursor-pointer"
                      style={{ width: 24, height: 24 }}
                      aria-label="Delete chat"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                      </svg>
                    </button>
                  </button>
                ))}
              </div>
              <div className="border-t border-[var(--color-border)] flex-shrink-0" style={{ padding: "10px 14px" }}>
                <button
                  onClick={startNewChat}
                  className="flex w-full items-center gap-2 rounded-lg border border-[var(--color-border)] text-[13px] text-[var(--color-text-secondary)] transition-all hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-text-primary)] cursor-pointer"
                  style={{ padding: "8px 12px" }}
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                  New chat
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── CHAT VIEW ── */}
      {view === "chat" && activeChat && (
        <>
          <div className="flex-1 overflow-y-auto" style={{ padding: "12px 16px 20px" }}>
            <div className="space-y-4">
              {activeChat.messages.map((msg) => (
                <div key={msg.id} className="flex flex-col">
                  <div className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    {msg.role === "assistant" && (
                      <div className="mr-2 mt-0.5 flex shrink-0 items-center justify-center rounded-full" style={{ width: 22, height: 22, background: "var(--color-accent)" }}>
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      </div>
                    )}
                    <div
                      className="text-[13px] leading-relaxed"
                      style={{
                        maxWidth: "82%",
                        padding: "9px 13px",
                        borderRadius: msg.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px",
                        background: msg.role === "user" ? "var(--color-accent)" : "var(--color-surface-hover)",
                        color: msg.role === "user" ? "white" : "var(--color-text-primary)",
                      }}
                    >
                      {msg.role === "assistant" ? (
                        <ReactMarkdown
                          components={{
                            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                            strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                            ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-0.5">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-0.5">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                            code: ({ children }) => <code className="rounded px-1 py-0.5 text-[12px]" style={{ background: "var(--color-border)" }}>{children}</code>,
                            h1: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
                            h2: ({ children }) => <p className="font-semibold mb-1">{children}</p>,
                            h3: ({ children }) => <p className="font-medium mb-1">{children}</p>,
                          }}
                        >
                          {msg.content}
                        </ReactMarkdown>
                      ) : msg.content}
                    </div>
                  </div>
                  {msg.actions && msg.actions.length > 0 && (
                    <div className="flex flex-col gap-2" style={{ marginTop: 10, marginLeft: 30, marginRight: 16 }}>
                      {msg.actions.map((action) => (
                        <button
                          key={action.value}
                          onClick={() => handleActionClick(action.value, msg.id)}
                          className="flex items-center gap-3 w-full text-left rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] hover:border-[var(--color-accent)]/50 hover:bg-[var(--color-accent)]/5 transition-all cursor-pointer"
                          style={{ padding: "9px 13px" }}
                        >
                          <span className="text-[16px] flex-shrink-0">{action.label.slice(0, 2)}</span>
                          <div className="min-w-0">
                            <p className="text-[13px] font-semibold text-[var(--color-text-primary)] leading-tight">{action.label.slice(2).trim()}</p>
                            {action.desc && <p className="text-[11px] text-[var(--color-text-tertiary)] mt-0.5 leading-snug">{action.desc}</p>}
                          </div>
                          <svg className="ml-auto flex-shrink-0 text-[var(--color-text-tertiary)]" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6"/></svg>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="mr-2 mt-0.5 flex shrink-0 items-center justify-center rounded-full" style={{ width: 22, height: 22, background: "var(--color-accent)" }}>
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9.663 17h4.673M12 3v1m6.364 1.636-.707.707M21 12h-1M4 12H3m3.343-5.657-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                    </svg>
                  </div>
                  <div className="rounded-2xl rounded-bl-sm" style={{ background: "var(--color-surface-hover)", padding: "11px 14px" }}>
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

          <form onSubmit={handleSubmit} className="border-t border-[var(--color-border)] flex-shrink-0" style={{ padding: "10px 14px 14px" }}>
            <div
              className="rounded-xl border border-[var(--color-border)] bg-[var(--color-background)] focus-within:border-[var(--color-accent)]/40 transition-all duration-150"
              style={{ padding: "10px 12px" }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Ask about your leads, tasks, or pipeline..."
                rows={1}
                style={{ maxHeight: 200, overflowY: "auto" }}
                className="w-full resize-none bg-transparent text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none leading-relaxed"
              />
              <div className="flex items-center justify-between" style={{ marginTop: 8 }}>
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setModeOpen((v) => !v)}
                    className="flex items-center gap-1 text-[12px] font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                  >
                    {MODE_META[mode].label}
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m6 9 6 6 6-6" />
                    </svg>
                  </button>
                  {modeOpen && (
                    <div className="absolute bottom-full left-0 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg overflow-hidden" style={{ marginBottom: 4, minWidth: 150 }}>
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
                  style={{ width: 28, height: 28 }}
                  aria-label="Send message"
                >
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m5 12 7-7 7 7" /><path d="M12 19V5" />
                  </svg>
                </button>
              </div>
            </div>
            <p className="text-center text-[10px] text-[var(--color-text-tertiary)]" style={{ marginTop: 6 }}>
              kove AI can make mistakes. Verify important information.
            </p>
          </form>
        </>
      )}
    </aside>
  );
}