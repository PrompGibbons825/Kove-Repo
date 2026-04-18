"use client";

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  type DragEvent,
  type MouseEvent as RMouseEvent,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { useLandingPageBuilder } from "@/components/landing-pages/builder-context";
import { useWorkflowBuilder, type WorkflowNode as CtxNode } from "@/components/workflows/workflow-context";
import {
  Plus,
  Globe,
  Loader2,
  ArrowLeft,
  Sparkles,
  Play,
  Trash2,
  Zap,
  Mail,
  MessageSquare,
  UserPlus,
  ClipboardList,
  Bell,
  GitBranch,
  Clock,
  Filter,
  CheckCircle2,
  ChevronRight,
  GripVertical,
  X,
  Upload,
  Code2,
  Check,
} from "lucide-react";

/* ─────────────────────── Types ─────────────────────── */

interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  status: "draft" | "active";
  createdAt: number;
  updatedAt: number;
}

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  config?: Record<string, unknown>;
}

interface WorkflowEdge {
  id: string;
  from: string;
  to: string;
}

type PageView = "list" | "create" | "builder" | "lp-editor";

/* ─── Node catalog ─── */

interface NodeDef {
  type: string;
  label: string;
  category: "trigger" | "action" | "logic";
  icon: React.ReactNode;
  color: string;
  desc: string;
}

const NODE_CATALOG: NodeDef[] = [
  // Triggers
  {
    type: "landing-page",
    label: "Landing Page",
    category: "trigger",
    icon: <Globe className="w-4 h-4" />,
    color: "#6366f1",
    desc: "Capture leads from an AI-built landing page",
  },
  {
    type: "form-submit",
    label: "Form Submission",
    category: "trigger",
    icon: <ClipboardList className="w-4 h-4" />,
    color: "#8b5cf6",
    desc: "Trigger when a form is submitted",
  },
  {
    type: "new-contact",
    label: "New Contact",
    category: "trigger",
    icon: <UserPlus className="w-4 h-4" />,
    color: "#06b6d4",
    desc: "Trigger when a contact is created",
  },
  {
    type: "inbound-call",
    label: "Inbound Call",
    category: "trigger",
    icon: <Bell className="w-4 h-4" />,
    color: "#f59e0b",
    desc: "Trigger on incoming phone call",
  },
  {
    type: "schedule",
    label: "Schedule",
    category: "trigger",
    icon: <Clock className="w-4 h-4" />,
    color: "#64748b",
    desc: "Run on a recurring schedule",
  },
  // Actions
  {
    type: "send-email",
    label: "Send Email",
    category: "action",
    icon: <Mail className="w-4 h-4" />,
    color: "#3b82f6",
    desc: "Send an email to a contact",
  },
  {
    type: "send-sms",
    label: "Send SMS",
    category: "action",
    icon: <MessageSquare className="w-4 h-4" />,
    color: "#10b981",
    desc: "Send a text message",
  },
  {
    type: "assign-task",
    label: "Create Task",
    category: "action",
    icon: <CheckCircle2 className="w-4 h-4" />,
    color: "#f97316",
    desc: "Create a follow-up task",
  },
  {
    type: "notify-team",
    label: "Notify Team",
    category: "action",
    icon: <Bell className="w-4 h-4" />,
    color: "#ec4899",
    desc: "Send a notification to your team",
  },
  // Logic
  {
    type: "delay",
    label: "Delay",
    category: "logic",
    icon: <Clock className="w-4 h-4" />,
    color: "#64748b",
    desc: "Wait before the next step",
  },
  {
    type: "condition",
    label: "If / Else",
    category: "logic",
    icon: <Filter className="w-4 h-4" />,
    color: "#a855f7",
    desc: "Branch based on conditions",
  },
  {
    type: "branch",
    label: "Split Path",
    category: "logic",
    icon: <GitBranch className="w-4 h-4" />,
    color: "#14b8a6",
    desc: "Run multiple paths in parallel",
  },
];

const TRIGGERS = NODE_CATALOG.filter((n) => n.category === "trigger");
const ACTIONS = NODE_CATALOG.filter((n) => n.category === "action");
const LOGIC = NODE_CATALOG.filter((n) => n.category === "logic");

/* ─── Storage helpers ─── */

const WF_KEY = "kove_workflows";

function loadWorkflows(): Workflow[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(WF_KEY) || "[]");
  } catch {
    return [];
  }
}
function saveWorkflows(wfs: Workflow[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(WF_KEY, JSON.stringify(wfs));
}

/* ═══════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════ */

export default function WorkflowsPage() {
  const [view, setView] = useState<PageView>("list");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWfId, setActiveWfId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setWorkflows(loadWorkflows());
    setLoading(false);
  }, []);

  function persist(wfs: Workflow[]) {
    setWorkflows(wfs);
    saveWorkflows(wfs);
  }

  function openBuilder(id: string) {
    setActiveWfId(id);
    setView("builder");
  }

  function createWorkflow(name: string) {
    const wf: Workflow = {
      id: crypto.randomUUID(),
      name,
      nodes: [],
      edges: [],
      status: "draft",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    persist([wf, ...workflows]);
    openBuilder(wf.id);
  }

  function deleteWorkflow(id: string) {
    persist(workflows.filter((w) => w.id !== id));
  }

  function updateWorkflow(updated: Workflow) {
    persist(workflows.map((w) => (w.id === updated.id ? updated : w)));
  }

  const activeWf = workflows.find((w) => w.id === activeWfId) ?? null;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-tertiary)]" />
      </div>
    );
  }

  if (view === "create") {
    return (
      <CreateWorkflow
        onCreate={createWorkflow}
        onCancel={() => setView("list")}
      />
    );
  }

  if (view === "builder" && activeWf) {
    return (
      <WorkflowBuilder
        workflow={activeWf}
        onChange={updateWorkflow}
        onBack={() => {
          setView("list");
          setActiveWfId(null);
        }}
        onOpenLpEditor={() => setView("lp-editor")}
      />
    );
  }

  if (view === "lp-editor" && activeWf) {
    return (
      <LandingPageEditor
        workflowId={activeWf.id}
        onBack={() => setView("builder")}
      />
    );
  }

  return (
    <WorkflowList
      workflows={workflows}
      onNew={() => setView("create")}
      onOpen={openBuilder}
      onDelete={deleteWorkflow}
    />
  );
}

/* ═══════════════════════════════════════════════════════
   Workflow List
   ═══════════════════════════════════════════════════════ */

const TEMPLATES = [
  {
    name: "Lead capture",
    desc: "Landing page → instant email + task",
    color: "#6366f1",
    nodes: [
      { icon: <Globe className="w-3.5 h-3.5" />, label: "Landing Page" },
      { icon: <Mail className="w-3.5 h-3.5" />, label: "Send Email" },
      { icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Create Task" },
    ],
  },
  {
    name: "Missed call",
    desc: "Inbound call → SMS + notify team",
    color: "#f59e0b",
    nodes: [
      { icon: <Bell className="w-3.5 h-3.5" />, label: "Inbound Call" },
      { icon: <MessageSquare className="w-3.5 h-3.5" />, label: "Send SMS" },
      { icon: <Bell className="w-3.5 h-3.5" />, label: "Notify Team" },
    ],
  },
  {
    name: "Drip campaign",
    desc: "New contact → 3-touch email sequence",
    color: "#3b82f6",
    nodes: [
      { icon: <UserPlus className="w-3.5 h-3.5" />, label: "New Contact" },
      { icon: <Mail className="w-3.5 h-3.5" />, label: "Email #1" },
      { icon: <Clock className="w-3.5 h-3.5" />, label: "Wait 2 days" },
    ],
  },
  {
    name: "Meeting prep",
    desc: "Scheduled event → reminder SMS",
    color: "#10b981",
    nodes: [
      { icon: <Clock className="w-3.5 h-3.5" />, label: "Schedule" },
      { icon: <Filter className="w-3.5 h-3.5" />, label: "If / Else" },
      { icon: <MessageSquare className="w-3.5 h-3.5" />, label: "Send SMS" },
    ],
  },
];

function MiniFlow({ nodes, color }: { nodes: { icon: React.ReactNode; label: string }[]; color: string }) {
  return (
    <div className="flex items-center gap-2 mt-4 flex-wrap">
      {nodes.map((n, i) => (
        <div key={i} className="flex items-center gap-2">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-white text-[11px] font-medium whitespace-nowrap"
            style={{ backgroundColor: color, opacity: 0.85 + i * 0.05 }}
          >
            {n.icon}
            <span>{n.label}</span>
          </div>
          {i < nodes.length - 1 && (
            <ChevronRight className="w-3.5 h-3.5 text-[var(--color-text-tertiary)] flex-shrink-0" />
          )}
        </div>
      ))}
    </div>
  );
}

function LiquidBolt() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0, active: false });
  const rafRef = useRef<number>(0);
  const smoothRef = useRef({ x: 0, y: 0 });

  const handleMove = useCallback((e: MouseEvent) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    setMouse({ x: dx, y: dy, active: dist < 2.5 });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleMove);
    return () => {
      window.removeEventListener("mousemove", handleMove);
      cancelAnimationFrame(rafRef.current);
    };
  }, [handleMove]);

  useEffect(() => {
    function tick() {
      smoothRef.current.x += (mouse.x - smoothRef.current.x) * 0.08;
      smoothRef.current.y += (mouse.y - smoothRef.current.y) * 0.08;
      const el = containerRef.current;
      if (el) {
        el.style.setProperty("--mx", String(smoothRef.current.x));
        el.style.setProperty("--my", String(smoothRef.current.y));
      }
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [mouse]);

  const bolt = "M50 8 L75 55 L55 55 L65 108 L30 50 L45 50 Z";
  const boltInner = "M50 14 L71 53 L54 53 L63 102 L34 52 L47 52 Z";

  return (
    <div
      ref={containerRef}
      className="relative mx-auto cursor-pointer"
      style={{ width: 280, height: 280, perspective: 600 }}
    >
      {/* Ambient glow behind everything */}
      <div
        className="absolute rounded-full transition-opacity duration-1000"
        style={{
          inset: "-60%",
          filter: "blur(90px)",
          opacity: mouse.active ? 0.55 : 0.3,
          background: "radial-gradient(circle, rgba(0,229,255,0.3) 0%, rgba(139,92,246,0.25) 30%, rgba(255,119,255,0.15) 55%, transparent 75%)",
        }}
      />
      {/* Mid glow */}
      <div
        className="absolute rounded-full transition-opacity duration-700"
        style={{
          inset: "-30%",
          filter: "blur(50px)",
          opacity: mouse.active ? 0.6 : 0.35,
          background: "radial-gradient(circle, rgba(0,229,255,0.4) 0%, rgba(168,130,255,0.3) 40%, transparent 70%)",
          animation: "orbPulse 4s ease-in-out infinite",
        }}
      />

      {/* The SVG bolt */}
      <svg
        viewBox="0 0 100 120"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0 w-full h-full"
        style={{
          overflow: "visible",
          filter: "drop-shadow(0 0 12px rgba(0,229,255,0.4)) drop-shadow(0 0 30px rgba(255,119,255,0.2))",
          transform: `rotateY(calc(var(--mx,0) * 14deg)) rotateX(calc(var(--my,0) * -14deg)) scale(${mouse.active ? 1.06 : 1})`,
          transition: "transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)",
          animation: "orbFloat 6s ease-in-out infinite",
        }}
      >
        <defs>
          {/* Electric glow filter with turbulence distortion */}
          <filter id="electric-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feTurbulence type="fractalNoise" baseFrequency="0.5" numOctaves="3" result="noise">
              <animate attributeName="seed" from="0" to="100" dur="4s" repeatCount="indefinite" />
            </feTurbulence>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="4" result="distorted" />
            <feGaussianBlur in="distorted" stdDeviation="6" result="blueBlur" />
            <feColorMatrix in="blueBlur" type="matrix" values="0 0 0 0 0  0 1 0 0 0.8  0 0 1 0 1  0 0 0 1 0" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" result="pinkBlur" />
            <feColorMatrix in="pinkBlur" type="matrix" values="1 0 0 0 1  0 0 0 0 0  0 0 1 0 1  0 0 0 1.5 0" />
            <feMerge>
              <feMergeNode in="blueBlur" />
              <feMergeNode in="pinkBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>

          {/* Gradient: pink top → cyan bottom */}
          <linearGradient id="wfBoltGrad" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ff77ff" />
            <stop offset="50%" stopColor="#c084fc" />
            <stop offset="100%" stopColor="#00e5ff" />
          </linearGradient>

          {/* Lighter gradient for inner core */}
          <linearGradient id="wfBoltCore" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#ffd6ff" />
            <stop offset="100%" stopColor="#b3f5ff" />
          </linearGradient>
        </defs>

        {/* Aura layer — distorted electric glow */}
        <path
          d={bolt}
          fill="url(#wfBoltGrad)"
          filter="url(#electric-glow)"
          opacity="0.7"
          style={{ animation: "boltFlicker 3s infinite alternate ease-in-out" }}
        />

        {/* Main bolt body */}
        <path
          d={bolt}
          fill="url(#wfBoltGrad)"
          style={{ animation: "boltFlicker 3s infinite alternate ease-in-out" }}
        />

        {/* White-hot inner core */}
        <path
          d={boltInner}
          fill="url(#wfBoltCore)"
          opacity="0.75"
        />

        {/* Bright white center for depth */}
        <path
          d={boltInner}
          fill="white"
          opacity="0.3"
          style={{ animation: "boltFlicker 2s infinite alternate ease-in-out", animationDelay: "-0.5s" }}
        />
      </svg>
    </div>
  );
}

function WorkflowList({
  workflows,
  onNew,
  onOpen,
  onDelete,
}: {
  workflows: Workflow[];
  onNew: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (workflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-10" style={{ minHeight: "calc(100vh - 80px)" }}>
        {/* Animated Bolt */}
        <LiquidBolt />

        {/* Title + subtitle */}
        <div className="text-center">
          <h1 className="text-[24px] font-medium text-[var(--color-text-primary)]">Welcome to Workflows</h1>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-2">build · ship · automate</p>
        </div>

        {/* CTA */}
        <button
          onClick={() => {
            window.dispatchEvent(new CustomEvent("open-agent-sidebar"));
            onNew();
          }}
          className="text-[15px] font-semibold text-white rounded-full hover:scale-105 active:scale-100 transition-all cursor-pointer"
          style={{
            padding: "14px 40px",
            background: "linear-gradient(135deg, #a78bfa 0%, #c084fc 50%, #e879f9 100%)",
            boxShadow: "0 4px 24px rgba(168,130,255,0.35), 0 1px 3px rgba(0,0,0,0.08)",
          }}
        >
          Let&apos;s get started
        </button>

        {/* Templates */}
        <div style={{ width: "100%", maxWidth: 700 }}>
          <p className="text-[13px] text-[var(--color-text-tertiary)]" style={{ marginBottom: 12 }}>templates:</p>
          <div className="grid grid-cols-3 gap-4">
            {TEMPLATES.slice(0, 3).map((t) => (
              <button
                key={t.name}
                onClick={onNew}
                className="flex flex-col items-start gap-2 text-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 hover:shadow-md hover:border-[var(--color-accent)]/20 cursor-pointer"
                style={{ padding: 20, transform: "translateY(0)" }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "translateY(0)")}
              >
                <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">{t.name}</p>
                <p className="text-[13px] text-[var(--color-text-tertiary)]">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      <div className="flex items-center justify-between px-8 pt-7 pb-5 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--color-text-primary)]">Workflows</h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)] mt-0.5">
            {workflows.filter((w) => w.status === "active").length} active · {workflows.length} total
          </p>
        </div>
        <button
          onClick={onNew}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white text-[13px] font-medium rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New workflow
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 py-5 space-y-2">
        {workflows.map((wf) => (
          <div
            key={wf.id}
            onClick={() => onOpen(wf.id)}
            className="group flex items-center gap-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl cursor-pointer hover:border-[var(--color-accent)]/30 hover:shadow-[var(--shadow-sm)] transition-all"
          >
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center flex-shrink-0 shadow-sm">
              <Zap className="w-4 h-4 text-white" strokeWidth={2} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[14px] font-medium text-[var(--color-text-primary)] truncate">{wf.name}</p>
              <p className="text-[12px] text-[var(--color-text-tertiary)] mt-0.5">
                {wf.nodes.length} steps · Updated {new Date(wf.updatedAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                wf.status === "active"
                  ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                  : "bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  wf.status === "active" ? "bg-[var(--color-success)]" : "bg-[var(--color-text-tertiary)]"
                }`} />
                {wf.status === "active" ? "Active" : "Draft"}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(wf.id); }}
                className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded-lg transition-colors opacity-0 group-hover:opacity-100"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] transition-colors" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Create Workflow
   ═══════════════════════════════════════════════════════ */

function CreateWorkflow({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate(name.trim());
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center gap-3 px-8 pt-6 pb-5 border-b border-[var(--color-border)]">
        <button
          onClick={onCancel}
          className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="h-5 w-px bg-[var(--color-border)]" />
        <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">New workflow</p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-xl px-10 pt-8 pb-12">
          <form onSubmit={handleSubmit}>
            <label className="block text-[12px] font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-2">Workflow name</label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lead follow-up, Event registration…"
              className="w-full px-4 py-3 text-[15px] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none focus:border-[var(--color-accent)] focus:ring-2 focus:ring-[var(--color-accent)]/15 transition-all"
            />
            <div className="flex items-center gap-3 mt-4">
              <button
                type="submit"
                disabled={!name.trim()}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] text-white text-[13px] font-semibold rounded-lg hover:bg-[var(--color-accent-hover)] transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
              >
                <Play className="w-3.5 h-3.5" />
                Open builder
              </button>
              <button type="button" onClick={onCancel} className="px-5 py-2.5 text-[13px] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors">
                Cancel
              </button>
            </div>
          </form>

          {/* Templates */}
          <div className="mt-10">
            <p className="text-[11px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-widest mb-4">Or start from a template</p>
            <div className="space-y-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.name}
                  onClick={() => { setName(t.name); setTimeout(() => inputRef.current?.focus(), 0); }}
                  className="group w-full flex items-center gap-4 p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl text-left hover:border-[var(--color-accent)]/40 hover:shadow-[var(--shadow-sm)] transition-all"
                >
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center text-white flex-shrink-0"
                    style={{ backgroundColor: t.color }}
                  >
                    <Zap className="w-4 h-4" strokeWidth={2} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">{t.name}</p>
                    <p className="text-[12px] text-[var(--color-text-tertiary)] mt-0.5">{t.desc}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {t.nodes.map((n, i) => (
                      <span key={i} className="text-[10px] text-[var(--color-text-tertiary)] flex items-center gap-0.5">
                        {i > 0 && <span className="text-[var(--color-border)] mx-0.5">›</span>}
                        {n.label}
                      </span>
                    ))}
                  </div>
                  <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)] group-hover:text-[var(--color-accent)] flex-shrink-0 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Workflow Builder (drag-and-drop canvas)
   ═══════════════════════════════════════════════════════ */

function WorkflowBuilder({
  workflow,
  onChange,
  onBack,
  onOpenLpEditor,
}: {
  workflow: Workflow;
  onChange: (wf: Workflow) => void;
  onBack: () => void;
  onOpenLpEditor: () => void;
}) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<string | null>(null);
  const [showTip, setShowTip] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [wfName, setWfName] = useState(workflow.name);
  const nameRef = useRef<HTMLInputElement>(null);
  const wfCtx = useWorkflowBuilder();

  // Register with shared context so agent sidebar can see canvas state
  useEffect(() => {
    wfCtx.openBuilder(workflow.id, workflow.name, workflow.nodes as CtxNode[], workflow.edges);
    return () => wfCtx.closeBuilder();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.id]);

  // Sync canvas state to context whenever nodes/edges change
  useEffect(() => {
    wfCtx.syncState(workflow.nodes as CtxNode[], workflow.edges);
  }, [workflow.nodes, workflow.edges, wfCtx]);

  // Consume pending AI commands from the agent sidebar
  useEffect(() => {
    if (wfCtx.pendingCommands.length === 0) return;
    let updated = { ...workflow };
    for (const cmd of wfCtx.pendingCommands) {
      if (cmd.type === "add_node") {
        const p = cmd.payload as { id: string; type: string; label: string; x: number; y: number };
        if (!updated.nodes.find((n) => n.id === p.id)) {
          updated = { ...updated, nodes: [...updated.nodes, { id: p.id, type: p.type, label: p.label, x: p.x, y: p.y }], updatedAt: Date.now() };
        }
      } else if (cmd.type === "add_edge") {
        const p = cmd.payload as { from: string; to: string };
        // Resolve partial IDs (8-char prefix match)
        const fromNode = updated.nodes.find((n) => n.id.startsWith(p.from));
        const toNode = updated.nodes.find((n) => n.id.startsWith(p.to));
        if (fromNode && toNode && !updated.edges.find((e) => e.from === fromNode.id && e.to === toNode.id)) {
          updated = { ...updated, edges: [...updated.edges, { id: crypto.randomUUID(), from: fromNode.id, to: toNode.id }], updatedAt: Date.now() };
        }
      }
    }
    onChange(updated);
    wfCtx.clearCommands();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wfCtx.pendingCommands]);

  useEffect(() => {
    if (editingName) nameRef.current?.focus();
  }, [editingName]);

  const nodes = workflow.nodes;
  const edges = workflow.edges;

  function addNode(def: NodeDef, x: number, y: number) {
    const node: WorkflowNode = {
      id: crypto.randomUUID(),
      type: def.type,
      label: def.label,
      x,
      y,
    };
    onChange({ ...workflow, nodes: [...nodes, node], updatedAt: Date.now() });
  }

  function removeNode(id: string) {
    onChange({
      ...workflow,
      nodes: nodes.filter((n) => n.id !== id),
      edges: edges.filter((e) => e.from !== id && e.to !== id),
      updatedAt: Date.now(),
    });
  }

  function moveNode(id: string, x: number, y: number) {
    onChange({
      ...workflow,
      nodes: nodes.map((n) => (n.id === id ? { ...n, x, y } : n)),
      updatedAt: Date.now(),
    });
  }

  function addEdge(from: string, to: string) {
    if (from === to) return;
    if (edges.some((e) => e.from === from && e.to === to)) return;
    onChange({
      ...workflow,
      edges: [...edges, { id: crypto.randomUUID(), from, to }],
      updatedAt: Date.now(),
    });
  }

  function removeEdge(id: string) {
    onChange({
      ...workflow,
      edges: edges.filter((e) => e.id !== id),
      updatedAt: Date.now(),
    });
  }

  function handleCanvasDrop(e: DragEvent) {
    e.preventDefault();
    const type = e.dataTransfer.getData("node-type");
    const def = NODE_CATALOG.find((n) => n.type === type);
    if (!def || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    addNode(def, e.clientX - rect.left - 80, e.clientY - rect.top - 24);
  }

  function handleNodeMouseDown(id: string, e: RMouseEvent) {
    if ((e.target as HTMLElement).closest("[data-port]")) return;
    const node = nodes.find((n) => n.id === id);
    if (!node) return;
    setDragging(id);
    setDragOffset({ x: e.clientX - node.x, y: e.clientY - node.y });
  }

  function handleCanvasMouseMove(e: RMouseEvent) {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    moveNode(
      dragging,
      e.clientX - rect.left - dragOffset.x + canvasRef.current.scrollLeft,
      e.clientY - rect.top - dragOffset.y + canvasRef.current.scrollTop
    );
  }

  function handleCanvasMouseUp() {
    setDragging(null);
    setConnecting(null);
  }

  function handlePortClick(nodeId: string, port: "out" | "in") {
    if (port === "out") {
      setConnecting(nodeId);
    } else if (connecting) {
      addEdge(connecting, nodeId);
      setConnecting(null);
    }
  }

  function saveName() {
    if (wfName.trim()) {
      onChange({ ...workflow, name: wfName.trim(), updatedAt: Date.now() });
    } else {
      setWfName(workflow.name);
    }
    setEditingName(false);
  }

  function getNodeDef(type: string) {
    return NODE_CATALOG.find((n) => n.type === type);
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)] z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-[var(--color-border)]" />
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-accent)] to-indigo-600 flex items-center justify-center">
            <Zap className="w-3.5 h-3.5 text-white" />
          </div>
          {editingName ? (
            <input
              ref={nameRef}
              value={wfName}
              onChange={(e) => setWfName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") {
                  setWfName(workflow.name);
                  setEditingName(false);
                }
              }}
              className="px-2 py-1 text-[14px] font-medium bg-[var(--color-background)] border border-[var(--color-accent)] rounded-lg text-[var(--color-text-primary)] focus:outline-none w-64"
            />
          ) : (
            <button
              onClick={() => setEditingName(true)}
              className="text-[14px] font-medium text-[var(--color-text-primary)] hover:text-[var(--color-accent)] transition-colors"
            >
              {workflow.name}
            </button>
          )}
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
            workflow.status === "active"
              ? "bg-emerald-500/10 text-emerald-600"
              : "bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
          }`}>
            {workflow.status === "active" ? "Active" : "Draft"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setPaletteOpen(!paletteOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <GripVertical className="w-3.5 h-3.5" />
            {paletteOpen ? "Hide" : "Show"} Nodes
          </button>
          <button
            onClick={() =>
              onChange({
                ...workflow,
                status: workflow.status === "active" ? "draft" : "active",
                updatedAt: Date.now(),
              })
            }
            className={`flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-medium rounded-lg transition-colors ${
              workflow.status === "active"
                ? "bg-[var(--color-danger)] text-white hover:bg-red-600"
                : "bg-[var(--color-success)] text-white hover:bg-emerald-600"
            }`}
          >
            <Play className="w-3.5 h-3.5" />
            {workflow.status === "active" ? "Deactivate" : "Activate"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Node palette */}
        {paletteOpen && (
          <div className="w-[240px] flex-shrink-0 border-r border-[var(--color-border)] bg-[var(--color-surface)] overflow-y-auto">
            <div className="p-4 space-y-5">
              {[
                { title: "Triggers", items: TRIGGERS },
                { title: "Actions", items: ACTIONS },
                { title: "Logic", items: LOGIC },
              ].map((group) => (
                <div key={group.title}>
                  <p className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-2">
                    {group.title}
                  </p>
                  <div className="space-y-1.5">
                    {group.items.map((def) => (
                      <div
                        key={def.type}
                        draggable
                        onDragStart={(e) => {
                          e.dataTransfer.setData("node-type", def.type);
                          e.dataTransfer.effectAllowed = "copy";
                        }}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-background)] cursor-grab active:cursor-grabbing transition-all group/node"
                      >
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-white"
                          style={{ backgroundColor: def.color }}
                        >
                          {def.icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[12px] font-medium text-[var(--color-text-primary)] leading-tight">
                            {def.label}
                          </p>
                          <p className="text-[10px] text-[var(--color-text-tertiary)] leading-tight mt-0.5 truncate">
                            {def.desc}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-auto"
          style={{
            backgroundImage:
              "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
            backgroundColor: "var(--color-background)",
          }}
          onDragOver={(e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = "copy";
          }}
          onDrop={handleCanvasDrop}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        >
          {/* AI tip */}
          {showTip && nodes.length === 0 && (
            <div className="absolute top-6 left-1/2 -translate-x-1/2 flex items-start gap-3 p-4 bg-[var(--color-surface)] border border-[var(--color-accent)]/20 rounded-xl shadow-lg max-w-sm z-20">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-soft)] flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-4 h-4 text-[var(--color-accent)]" />
              </div>
              <div className="flex-1">
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1">
                  Let AI build this for you
                </p>
                <p className="text-[12px] text-[var(--color-text-tertiary)] leading-relaxed">
                  Open the AI sidebar and describe what you want to automate.
                  It&apos;ll wire up the triggers, actions, and logic.
                </p>
              </div>
              <button
                onClick={() => setShowTip(false)}
                className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors flex-shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Empty canvas prompt */}
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-6 h-6 text-[var(--color-text-tertiary)]" />
                </div>
                <p className="text-[14px] font-medium text-[var(--color-text-tertiary)]">
                  Drag nodes from the panel to get started
                </p>
                <p className="text-[12px] text-[var(--color-text-tertiary)] mt-1">
                  or let the AI sidebar build it for you
                </p>
              </div>
            </div>
          )}

          {/* SVG edges */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.from);
              const toNode = nodes.find((n) => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              const x1 = fromNode.x + 160;
              const y1 = fromNode.y + 28;
              const x2 = toNode.x;
              const y2 = toNode.y + 28;
              const mx = (x1 + x2) / 2;
              return (
                <g key={edge.id} className="pointer-events-auto cursor-pointer" onClick={() => removeEdge(edge.id)}>
                  <path
                    d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth="2"
                    strokeDasharray={connecting ? "6 3" : "none"}
                    opacity={0.5}
                  />
                  <path
                    d={`M ${x1} ${y1} C ${mx} ${y1}, ${mx} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="transparent"
                    strokeWidth="16"
                  />
                </g>
              );
            })}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const def = getNodeDef(node.type);
            const isLp = node.type === "landing-page";
            return (
              <div
                key={node.id}
                className={`absolute flex items-center gap-0 select-none z-10 group/card ${
                  dragging === node.id ? "cursor-grabbing" : "cursor-grab"
                }`}
                style={{ left: node.x, top: node.y }}
                onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
              >
                {/* In port */}
                <div
                  data-port="in"
                  onClick={() => handlePortClick(node.id, "in")}
                  className={`w-3 h-3 rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] transition-colors cursor-crosshair -mr-1.5 z-20 ${
                    connecting ? "scale-125 border-[var(--color-accent)]" : ""
                  }`}
                />

                {/* Card */}
                <div className="flex items-center gap-2.5 pl-3.5 pr-2 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl shadow-sm hover:shadow-md transition-all min-w-[160px]">
                  <div
                    className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0 text-white"
                    style={{ backgroundColor: def?.color ?? "#6366f1" }}
                  >
                    {def?.icon ?? <Zap className="w-4 h-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[var(--color-text-primary)] truncate">
                      {node.label}
                    </p>
                    {isLp && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenLpEditor();
                        }}
                        className="text-[10px] text-[var(--color-accent)] hover:underline mt-0.5"
                      >
                        Edit page →
                      </button>
                    )}
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeNode(node.id);
                    }}
                    className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] rounded transition-colors opacity-0 group-hover/card:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>

                {/* Out port */}
                <div
                  data-port="out"
                  onClick={() => handlePortClick(node.id, "out")}
                  className="w-3 h-3 rounded-full border-2 border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)] transition-colors cursor-crosshair -ml-1.5 z-20"
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Landing Page Editor (accessed from LP node)
   ═══════════════════════════════════════════════════════ */

function LandingPageEditor({
  workflowId,
  onBack,
}: {
  workflowId: string;
  onBack: () => void;
}) {
  const supabase = createClient();
  const lpCtx = useLandingPageBuilder();
  const [slug, setSlugLocal] = useState("");
  const [brandAssets, setBrandAssetsLocal] = useState<
    { type: string; url: string; name: string }[]
  >([]);
  const [saving, setSaving] = useState(false);
  const [pageId, setPageIdLocal] = useState("");
  const [pageStatus, setPageStatus] = useState<"draft" | "live">("draft");
  const [uploading, setUploading] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [copied, setCopied] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);

  // Load existing landing page for this workflow
  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("landing_pages")
        .select("*")
        .eq("workflow_id", workflowId)
        .maybeSingle();

      if (data) {
        setPageIdLocal(data.id);
        setSlugLocal(data.slug);
        setBrandAssetsLocal(data.brand_assets ?? []);
        setPageStatus(data.status);
        lpCtx.open(data.id, data.slug, data.html_content ?? "", data.brand_assets ?? []);
      } else {
        lpCtx.open("", "", "", []);
      }
      setLoadingPage(false);
    }
    load();
    return () => lpCtx.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  useEffect(() => { lpCtx.setSlug(slug); }, [slug, lpCtx]);
  useEffect(() => { lpCtx.setBrandAssets(brandAssets); }, [brandAssets, lpCtx]);
  useEffect(() => { lpCtx.setPageId(pageId); }, [pageId, lpCtx]);

  const html = lpCtx.state.html;

  async function handleSave() {
    if (!slug.trim()) { setSlugError("A URL slug is required"); return; }
    setSaving(true);
    setSlugError("");

    if (pageId) {
      const { error } = await supabase
        .from("landing_pages")
        .update({ slug, html_content: html, brand_assets: brandAssets, updated_at: new Date().toISOString() })
        .eq("id", pageId);
      if (error?.code === "23505") { setSlugError("Slug taken."); setSaving(false); return; }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }
      const { data: koveUser } = await supabase.from("users").select("org_id").eq("id", user.id).single();
      if (!koveUser) { setSaving(false); return; }

      const { data: newPage, error } = await supabase
        .from("landing_pages")
        .insert({ org_id: koveUser.org_id, workflow_id: workflowId, slug, html_content: html, brand_assets: brandAssets })
        .select("id")
        .single();
      if (error?.code === "23505") { setSlugError("Slug taken."); setSaving(false); return; }
      if (newPage) { setPageIdLocal(newPage.id); lpCtx.setPageId(newPage.id); }
    }
    setSaving(false);
  }

  async function handlePublish() {
    if (!pageId) await handleSave();
    if (!pageId && !slug.trim()) return;
    const newStatus = pageStatus === "live" ? "draft" : "live";
    await supabase.from("landing_pages").update({ status: newStatus, updated_at: new Date().toISOString() }).eq("id", pageId);
    setPageStatus(newStatus);
  }

  async function handleUploadAsset(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }
    const { data: koveUser } = await supabase.from("users").select("org_id").eq("id", user.id).single();
    if (!koveUser) { setUploading(false); return; }
    const path = `${koveUser.org_id}/brand/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("brand-assets").upload(path, file);
    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("brand-assets").getPublicUrl(path);
      setBrandAssetsLocal([...brandAssets, { type: file.type.startsWith("image/") ? "logo" : "file", url: publicUrl, name: file.name }]);
    }
    setUploading(false);
  }

  function copyEmbed() {
    navigator.clipboard.writeText(`<iframe src="https://site.trykove.app/lp/${slug}" style="width:100%;min-height:600px;border:none;" loading="lazy"></iframe>`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (loadingPage) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-tertiary)]" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-5 w-px bg-[var(--color-border)]" />
          <Globe className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
          <span className="text-[13px] text-[var(--color-text-tertiary)]">site.trykove.app/lp/</span>
          <input
            type="text"
            value={slug}
            onChange={(e) => { setSlugLocal(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugError(""); }}
            placeholder="your-page-slug"
            className="px-2.5 py-1.5 text-[13px] bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] w-48 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
          />
          {slugError && <span className="text-[12px] text-[var(--color-danger)]">{slugError}</span>}
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "Uploading…" : "Assets"}
            <input type="file" accept="image/*,.svg" className="hidden" onChange={handleUploadAsset} />
          </label>
          {pageId && slug && (
            <button onClick={copyEmbed} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors">
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Code2 className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Embed"}
            </button>
          )}
          <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>
          <button onClick={handlePublish} disabled={!html} className={`flex items-center gap-1.5 px-5 py-1.5 text-[12px] font-medium rounded-lg transition-colors disabled:opacity-40 ${pageStatus === "live" ? "bg-[var(--color-danger)] text-white hover:bg-red-600" : "bg-[var(--color-success)] text-white hover:bg-emerald-600"}`}>
            {pageStatus === "live" ? "Unpublish" : "Go Live"}
          </button>
        </div>
      </div>

      {/* Asset pills */}
      {brandAssets.length > 0 && (
        <div className="flex items-center gap-2 px-5 py-2 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <span className="text-[10px] font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Assets</span>
          {brandAssets.map((a, i) => (
            <div key={i} className="flex items-center gap-1.5 px-2 py-0.5 bg-[var(--color-background)] border border-[var(--color-border)] rounded-md text-[11px] text-[var(--color-text-secondary)]">
              {a.type === "logo" ? "🖼" : "📄"} {a.name}
              <button onClick={() => setBrandAssetsLocal(brandAssets.filter((_, j) => j !== i))} className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"><X className="w-3 h-3" /></button>
            </div>
          ))}
        </div>
      )}

      {/* Preview */}
      <div className="flex-1 bg-[var(--color-background)] overflow-hidden">
        {html ? (
          <iframe srcDoc={html} className="w-full h-full bg-white" sandbox="allow-scripts allow-forms" title="Landing page preview" />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-soft)] flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-[var(--color-accent)]" strokeWidth={1.5} />
            </div>
            <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] mb-2">
              Open the AI assistant to build your page
            </h3>
            <p className="text-[13px] text-[var(--color-text-tertiary)] max-w-md">
              Click the chat icon to open the AI sidebar. Describe the landing page you want
              and it will generate it live. Iterate until it&apos;s perfect.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
