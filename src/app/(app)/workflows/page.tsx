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
  BarChart2,
  Activity,
  AlertCircle,
  TrendingUp,
  LayoutGrid,
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
  {
    type: "webhook",
    label: "Webhook",
    category: "trigger",
    icon: <Code2 className="w-4 h-4" />,
    color: "#0ea5e9",
    desc: "Trigger from any external app via HTTP",
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

/* ─── Node config field definitions ─── */

interface ConfigField {
  key: string;
  label: string;
  type: "text" | "textarea" | "select" | "number";
  placeholder?: string;
  options?: { value: string; label: string }[];
}

const NODE_CONFIG_FIELDS: Record<string, ConfigField[]> = {
  "landing-page": [],
  "form-submit": [
    { key: "formId", label: "Form ID", type: "text", placeholder: "Form identifier" },
    { key: "fields", label: "Required Fields", type: "textarea", placeholder: "name, email, phone (comma-separated)" },
  ],
  "new-contact": [
    // source options are injected dynamically from fetched org settings — see WorkflowBuilder
    { key: "source", label: "Source Filter", type: "select", options: [
      { value: "", label: "Any source" },
    ]},
    { key: "tags", label: "Required Tags", type: "text", placeholder: "e.g. lead, vip (comma-separated)" },
  ],
  "webhook": [
    { key: "name", label: "Webhook Name", type: "text", placeholder: "e.g. HubSpot lead form" },
    { key: "secret", label: "Secret Key (optional)", type: "text", placeholder: "Used to verify the request" },
    { key: "method", label: "HTTP Method", type: "select", options: [
      { value: "POST", label: "POST" },
      { value: "GET", label: "GET" },
    ]},
  ],
  "inbound-call": [
    { key: "phoneNumber", label: "Phone Number", type: "text", placeholder: "+1 (555) 000-0000" },
    { key: "greeting", label: "Greeting Message", type: "textarea", placeholder: "What the AI should say when answering" },
  ],
  "schedule": [
    { key: "frequency", label: "Frequency", type: "select", options: [
      { value: "hourly", label: "Every hour" },
      { value: "daily", label: "Daily" },
      { value: "weekly", label: "Weekly" },
      { value: "monthly", label: "Monthly" },
    ]},
    { key: "time", label: "Time (24h)", type: "text", placeholder: "09:00" },
    { key: "timezone", label: "Timezone", type: "text", placeholder: "America/New_York" },
  ],
  "send-email": [
    { key: "to", label: "To", type: "text", placeholder: "{{contact.email}} or specific address" },
    { key: "subject", label: "Subject", type: "text", placeholder: "Email subject line" },
    { key: "body", label: "Body", type: "textarea", placeholder: "Write your email content..." },
  ],
  "send-sms": [
    { key: "to", label: "To", type: "text", placeholder: "{{contact.phone}} or specific number" },
    { key: "message", label: "Message", type: "textarea", placeholder: "SMS message content (160 chars)" },
  ],
  "assign-task": [
    { key: "title", label: "Task Title", type: "text", placeholder: "Follow up with {{contact.name}}" },
    { key: "assignee", label: "Assign To", type: "select", options: [
      { value: "", label: "Unassigned" },
      { value: "owner", label: "Contact Owner" },
      { value: "round-robin", label: "Round Robin" },
    ]},
    { key: "dueIn", label: "Due In (hours)", type: "number", placeholder: "24" },
    { key: "notes", label: "Notes", type: "textarea", placeholder: "Additional task details..." },
  ],
  "notify-team": [
    { key: "channel", label: "Channel", type: "select", options: [
      { value: "in-app", label: "In-App" },
      { value: "email", label: "Email" },
      { value: "slack", label: "Slack" },
    ]},
    { key: "message", label: "Message", type: "textarea", placeholder: "Notification message..." },
  ],
  "delay": [
    { key: "duration", label: "Duration", type: "number", placeholder: "1" },
    { key: "unit", label: "Unit", type: "select", options: [
      { value: "minutes", label: "Minutes" },
      { value: "hours", label: "Hours" },
      { value: "days", label: "Days" },
    ]},
  ],
  "condition": [
    { key: "field", label: "Field", type: "text", placeholder: "e.g. contact.email, contact.tags" },
    { key: "operator", label: "Operator", type: "select", options: [
      { value: "equals", label: "Equals" },
      { value: "not_equals", label: "Does not equal" },
      { value: "contains", label: "Contains" },
      { value: "not_contains", label: "Does not contain" },
      { value: "exists", label: "Exists" },
      { value: "gt", label: "Greater than" },
      { value: "lt", label: "Less than" },
    ]},
    { key: "value", label: "Value", type: "text", placeholder: "Comparison value" },
  ],
  "branch": [
    { key: "paths", label: "Number of Paths", type: "number", placeholder: "2" },
    { key: "description", label: "Description", type: "textarea", placeholder: "Describe what each path does..." },
  ],
};

/* ─── API helpers ─── */

function dbToWorkflow(row: Record<string, unknown>): Workflow {
  return {
    id: row.id as string,
    name: row.name as string,
    nodes: (row.nodes as WorkflowNode[]) ?? [],
    edges: (row.edges as WorkflowEdge[]) ?? [],
    status: (row.status as "draft" | "active") ?? "draft",
    createdAt: new Date(row.created_at as string).getTime(),
    updatedAt: new Date((row.updated_at ?? row.created_at) as string).getTime(),
  };
}

async function apiFetch(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? res.statusText);
  }
  return res.json();
}

/* ═══════════════════════════════════════════════════════
   Main Page
   ═══════════════════════════════════════════════════════ */

export default function WorkflowsPage() {
  const [view, setView] = useState<PageView>("list");
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [activeWfId, setActiveWfId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Load from Supabase via API
  useEffect(() => {
    apiFetch("/api/workflows")
      .then((d) => setWorkflows((d.workflows ?? []).map(dbToWorkflow)))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  function openBuilder(id: string) {
    setActiveWfId(id);
    setView("builder");
  }

  async function createWorkflow(name: string) {
    const data = await apiFetch("/api/workflows", {
      method: "POST",
      body: JSON.stringify({ name, nodes: [], edges: [], status: "draft" }),
    });
    const wf = dbToWorkflow(data.workflow);
    setWorkflows((prev) => [wf, ...prev]);
    openBuilder(wf.id);
  }

  async function deleteWorkflow(id: string) {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
    await apiFetch("/api/workflows", {
      method: "DELETE",
      body: JSON.stringify({ id }),
    }).catch(() => {});
  }

  async function createFromTemplate(name: string) {
    const tpl = TEMPLATE_WORKFLOWS[name];
    const data = await apiFetch("/api/workflows", {
      method: "POST",
      body: JSON.stringify({ name, nodes: tpl?.nodes ?? [], edges: tpl?.edges ?? [], status: "draft" }),
    });
    const wf = dbToWorkflow(data.workflow);
    setWorkflows((prev) => [wf, ...prev]);
    openBuilder(wf.id);
  }

  // Listen for template selection dispatched from AI sidebar action buttons
  useEffect(() => {
    function handler(e: Event) {
      const name = (e as CustomEvent).detail?.name as string | undefined;
      if (!name) return;
      createFromTemplate(name);
    }
    window.addEventListener("workflow-use-template", handler);
    return () => window.removeEventListener("workflow-use-template", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function updateWorkflow(updated: Workflow) {
    // Optimistic update
    setWorkflows((prev) => prev.map((w) => (w.id === updated.id ? updated : w)));
    await apiFetch("/api/workflows", {
      method: "PATCH",
      body: JSON.stringify({
        id: updated.id,
        name: updated.name,
        nodes: updated.nodes,
        edges: updated.edges,
        status: updated.status,
      }),
    }).catch(() => {
      // If save fails, reload from server to restore true state
      apiFetch("/api/workflows")
        .then((d) => setWorkflows((d.workflows ?? []).map(dbToWorkflow)))
        .catch(() => {});
    });
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
      />
    );
  }

  return (
    <WorkflowList
      workflows={workflows}
      onNew={() => setView("create")}
      onCreateDirect={createWorkflow}
      onUseTemplate={createFromTemplate}
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

const TEMPLATE_WORKFLOWS: Record<string, { nodes: WorkflowNode[]; edges: WorkflowEdge[] }> = {
  "Lead capture": {
    nodes: [
      { id: "lc-1", type: "landing-page", label: "Landing Page", x: 220, y: 100 },
      { id: "lc-2", type: "send-email",   label: "Send Email",   x: 220, y: 260 },
      { id: "lc-3", type: "assign-task",  label: "Create Task",  x: 220, y: 420 },
    ],
    edges: [
      { id: "lc-e1", from: "lc-1", to: "lc-2" },
      { id: "lc-e2", from: "lc-2", to: "lc-3" },
    ],
  },
  "Missed call": {
    nodes: [
      { id: "mc-1", type: "inbound-call", label: "Inbound Call", x: 220, y: 100 },
      { id: "mc-2", type: "send-sms",     label: "Send SMS",     x: 220, y: 260 },
      { id: "mc-3", type: "notify-team",  label: "Notify Team",  x: 220, y: 420 },
    ],
    edges: [
      { id: "mc-e1", from: "mc-1", to: "mc-2" },
      { id: "mc-e2", from: "mc-2", to: "mc-3" },
    ],
  },
  "Drip campaign": {
    nodes: [
      { id: "dc-1", type: "new-contact", label: "New Contact", x: 220, y: 100 },
      { id: "dc-2", type: "send-email",  label: "Email #1",    x: 220, y: 260 },
      { id: "dc-3", type: "delay",       label: "Wait 2 days", x: 220, y: 420 },
      { id: "dc-4", type: "send-email",  label: "Email #2",    x: 220, y: 580 },
    ],
    edges: [
      { id: "dc-e1", from: "dc-1", to: "dc-2" },
      { id: "dc-e2", from: "dc-2", to: "dc-3" },
      { id: "dc-e3", from: "dc-3", to: "dc-4" },
    ],
  },
  "Meeting prep": {
    nodes: [
      { id: "mp-1", type: "schedule",   label: "Schedule",  x: 220, y: 100 },
      { id: "mp-2", type: "condition",  label: "If / Else", x: 220, y: 260 },
      { id: "mp-3", type: "send-sms",   label: "Send SMS",  x: 220, y: 420 },
    ],
    edges: [
      { id: "mp-e1", from: "mp-1", to: "mp-2" },
      { id: "mp-e2", from: "mp-2", to: "mp-3" },
    ],
  },
};

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

  const size = 300;
  const svgWidth = Math.round(size * (260 / 410));

  return (
    <div
      ref={containerRef}
      className="relative mx-auto cursor-pointer"
      style={{ width: svgWidth, height: size, perspective: 600 }}
    >
      <svg
        width={svgWidth}
        height={size}
        viewBox="220 50 260 410"
        xmlns="http://www.w3.org/2000/svg"
        className="absolute inset-0"
        style={{
          overflow: "visible",
          transform: `rotateY(calc(var(--mx,0) * 14deg)) rotateX(calc(var(--my,0) * -14deg)) scale(${mouse.active ? 1.06 : 1})`,
          transition: "transform 0.4s cubic-bezier(0.25,0.46,0.45,0.94)",
          animation: "orbFloat 6s ease-in-out infinite",
        }}
        role="img"
        aria-label="Lightning bolt"
      >
        <defs>
          <filter id="lb-glow-purple" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="22" result="blur2" />
            <feMerge><feMergeNode in="blur2" /><feMergeNode in="blur1" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="lb-glow-blue" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="6" result="blur1" />
            <feGaussianBlur in="SourceGraphic" stdDeviation="18" result="blur2" />
            <feMerge><feMergeNode in="blur2" /><feMergeNode in="blur1" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="lb-glow-core" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="3" />
          </filter>
          <linearGradient id="lb-grad" x1="0.3" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#c084fc" />
            <stop offset="40%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#38bdf8" />
          </linearGradient>
          <linearGradient id="lb-grad-glow" x1="0.3" y1="0" x2="0.7" y2="1">
            <stop offset="0%" stopColor="#e879f9" stopOpacity="0.7" />
            <stop offset="50%" stopColor="#6366f1" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.5" />
          </linearGradient>
        </defs>

        <style>{`
          @keyframes lb-pulse   { 0%,100%{opacity:.85} 50%{opacity:1} }
          @keyframes lb-flicker { 0%,100%{opacity:1} 25%{opacity:.9} 50%{opacity:1} 75%{opacity:.82} }
          .lb-outer { animation: lb-pulse   2.5s ease-in-out infinite; }
          .lb-mid   { animation: lb-pulse   2s   ease-in-out infinite 0.3s; }
          .lb-core  { animation: lb-flicker 1.5s ease-in-out infinite; }
        `}</style>

        <path className="lb-outer" d="M360 60 L290 230 L330 230 L260 440 L410 240 L365 240 L430 60 Z" fill="#c084fc" filter="url(#lb-glow-purple)" opacity={0.5} />
        <path className="lb-outer" d="M340 180 L280 340 L310 340 L255 440 L380 280 L345 280 L390 180 Z" fill="#38bdf8" filter="url(#lb-glow-blue)" opacity={0.45} />
        <path className="lb-mid"   d="M358 75 L292 235 L328 235 L263 425 L405 245 L363 245 L425 75 Z" fill="url(#lb-grad-glow)" filter="url(#lb-glow-purple)" opacity={0.6} />
        <path className="lb-mid"   d="M358 80 L294 235 L330 235 L265 420 L402 248 L362 248 L422 80 Z" fill="url(#lb-grad)" opacity={0.92} />
        <path className="lb-core"  d="M358 90 L298 235 L332 235 L270 410 L398 250 L360 250 L418 90 Z" fill="white" opacity={0.25} filter="url(#lb-glow-core)" />
        <path className="lb-core"  d="M375 95 L318 238 L342 238 L290 390" stroke="#e0f2fe" strokeWidth={1.5} fill="none" opacity={0.5} />
      </svg>
    </div>
  );
}

function WorkflowList({
  workflows,
  onNew,
  onCreateDirect,
  onUseTemplate,
  onOpen,
  onDelete,
}: {
  workflows: Workflow[];
  onNew: () => void;
  onCreateDirect: (name: string) => void;
  onUseTemplate: (name: string) => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  const [namingMode, setNamingMode] = useState(false);
  const [wfName, setWfName] = useState("");
  const nameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (namingMode) setTimeout(() => nameInputRef.current?.focus(), 50);
  }, [namingMode]);

  if (workflows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-10" style={{ minHeight: "calc(100vh - 80px)" }}>
        {/* Animated Bolt */}
        <div style={{ marginLeft: 10 }}>
          <LiquidBolt />
        </div>

        {/* Title + subtitle */}
        <div className="text-center">
          <h1 className="text-[24px] font-medium text-[var(--color-text-primary)]">Welcome to Workflows</h1>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-2">build · ship · automate</p>
        </div>

        {/* CTA */}
        {namingMode ? (
          <form
            onSubmit={(e) => { e.preventDefault(); if (wfName.trim()) onCreateDirect(wfName.trim()); }}
            style={{ display: "flex", alignItems: "center", gap: 16, width: 560 }}
          >
            <input
              ref={nameInputRef}
              type="text"
              value={wfName}
              onChange={(e) => setWfName(e.target.value)}
              placeholder="Name your workflow..."
              style={{ flex: 1, minWidth: 0, padding: "14px 20px", fontSize: 15, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14, color: "var(--color-text-primary)", outline: "none", transition: "border-color 0.15s" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
            />
            <button
              type="submit"
              disabled={!wfName.trim()}
              style={{ flexShrink: 0, padding: "14px 28px", borderRadius: 14, fontSize: 14, fontWeight: 600, color: "white", background: "linear-gradient(135deg, #a78bfa 0%, #c084fc 50%, #e879f9 100%)", boxShadow: "0 4px 24px rgba(168,130,255,0.35)", cursor: "pointer", opacity: wfName.trim() ? 1 : 0.5, border: "none", whiteSpace: "nowrap" }}
            >
              Open builder &rarr;
            </button>
          </form>
        ) : (
          <button
            onClick={() => {
              window.dispatchEvent(new CustomEvent("open-agent-sidebar", { detail: { context: "workflow" } }));
              setNamingMode(true);
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
        )}

        {/* Templates */}
        <div style={{ width: 560 }}>
          <p className="text-[12px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-widest" style={{ marginBottom: 14 }}>Start from a template</p>
          <div className="grid grid-cols-3 gap-3">
            {TEMPLATES.slice(0, 3).map((t) => (
              <button
                key={t.name}
                onClick={() => onUseTemplate(t.name)}
                className="flex flex-col items-start text-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 cursor-pointer"
                style={{ padding: "18px 20px", gap: 6 }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)"; e.currentTarget.style.borderColor = "rgba(99,102,241,0.3)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
              >
                <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">{t.name}</p>
                <p className="text-[12px] text-[var(--color-text-tertiary)] leading-snug">{t.desc}</p>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const containerRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const [activeTab, setActiveTab] = useState<"workflows" | "health">("workflows");

  // Workflow colors palette
  const WF_COLORS = ["#a78bfa", "#38bdf8", "#34d399", "#fb923c", "#f472b6", "#facc15"];

  const activeCount = workflows.filter((w) => w.status === "active").length;
  // Execution data will come from real DB once workflows are live — show 0 until then
  const totalExecutions = 0;
  const chartDays: { label: string; values: number[] }[] = [];
  const mockErrors: { id: number; workflow: string; msg: string; time: string; color: string }[] = [];

  return (
    <div
      ref={containerRef}
      className="flex flex-col items-center overflow-y-auto"
      style={{ height: "calc(100vh - 56px)", paddingTop: 64, paddingBottom: 60 }}
      onScroll={(e) => setScrolled((e.currentTarget as HTMLDivElement).scrollTop > 70)}
    >
      {/* ── Fade-away header ── */}
      <div
        className="flex flex-col items-center gap-8 pt-4 pb-6 w-full"
        style={{
          opacity: scrolled ? 0 : 1,
          transform: scrolled ? "translateY(-18px) scale(0.97)" : "translateY(0) scale(1)",
          transition: "opacity 0.18s ease, transform 0.18s ease",
          pointerEvents: scrolled ? "none" : "auto",
        }}
      >
        <div style={{ marginLeft: 10 }}>
          <LiquidBolt />
        </div>
        <div className="text-center">
          <h1 className="text-[24px] font-medium text-[var(--color-text-primary)]">Workflows</h1>
          <p className="text-[14px] text-[var(--color-text-secondary)] mt-2">build · ship · automate</p>
        </div>

        {namingMode ? (
          <form
            onSubmit={(e) => { e.preventDefault(); if (wfName.trim()) onCreateDirect(wfName.trim()); }}
            style={{ display: "flex", alignItems: "center", gap: 16, width: 560 }}
          >
            <input
              ref={nameInputRef}
              type="text"
              value={wfName}
              onChange={(e) => setWfName(e.target.value)}
              placeholder="Name your workflow..."
              style={{ flex: 1, minWidth: 0, padding: "14px 20px", fontSize: 15, background: "var(--color-surface)", border: "1px solid var(--color-border)", borderRadius: 14, color: "var(--color-text-primary)", outline: "none", transition: "border-color 0.15s" }}
              onFocus={(e) => (e.currentTarget.style.borderColor = "var(--color-accent)")}
              onBlur={(e) => (e.currentTarget.style.borderColor = "var(--color-border)")}
            />
            <button
              type="submit"
              disabled={!wfName.trim()}
              style={{ flexShrink: 0, padding: "14px 28px", borderRadius: 14, fontSize: 14, fontWeight: 600, color: "white", background: "linear-gradient(135deg, #a78bfa 0%, #c084fc 50%, #e879f9 100%)", boxShadow: "0 4px 24px rgba(168,130,255,0.35)", cursor: "pointer", opacity: wfName.trim() ? 1 : 0.5, border: "none", whiteSpace: "nowrap" }}
            >
              Open builder &rarr;
            </button>
          </form>
        ) : (
          <button
            onClick={() => setNamingMode(true)}
            className="flex items-center gap-2 text-[14px] font-semibold text-white rounded-full hover:scale-105 active:scale-100 transition-all cursor-pointer"
            style={{ padding: "13px 32px", background: "linear-gradient(135deg, #a78bfa 0%, #c084fc 50%, #e879f9 100%)", boxShadow: "0 4px 24px rgba(168,130,255,0.35)" }}
          >
            <Plus className="w-4 h-4" />
            New workflow
          </button>
        )}
      </div>

      {/* ── Sticky tab toggle ── */}
      <div
        className="flex items-center gap-1 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]"
        style={{
          position: "sticky",
          top: 12,
          zIndex: 20,
          padding: "5px",
          marginBottom: 28,
          marginTop: 20,
          boxShadow: scrolled ? "0 8px 32px rgba(0,0,0,0.14)" : "none",
          transition: "box-shadow 0.2s ease",
        }}
      >
        {(["workflows", "health"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className="flex items-center gap-2 text-[13px] font-semibold rounded-xl transition-all cursor-pointer"
            style={{
              padding: "9px 20px",
              background: activeTab === tab ? "rgba(167,139,250,0.12)" : "transparent",
              color: activeTab === tab ? "var(--color-text-primary)" : "var(--color-text-tertiary)",
              boxShadow: "none",
            }}
          >
            {tab === "workflows" ? <LayoutGrid className="w-3.5 h-3.5" /> : <BarChart2 className="w-3.5 h-3.5" />}
            {tab === "workflows" ? "Workflows" : "Health Monitor"}
          </button>
        ))}
      </div>

      {/* ── Workflows grid ── */}
      {activeTab === "workflows" && (
        <div style={{ width: 680 }}>
          <div className="grid grid-cols-3 gap-4">
            {workflows.map((wf, idx) => (
              <button
                key={wf.id}
                onClick={() => onOpen(wf.id)}
                className="group relative flex flex-col items-start text-left rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] transition-all duration-200 cursor-pointer"
                style={{ padding: "20px 20px 16px" }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-3px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(0,0,0,0.12)"; e.currentTarget.style.borderColor = `${WF_COLORS[idx % WF_COLORS.length]}55`; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; e.currentTarget.style.borderColor = "var(--color-border)"; }}
              >
                {/* Delete on hover */}
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(wf.id); }}
                  className="absolute top-3 right-3 p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-3 h-3" />
                </button>

                {/* Icon */}
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center mb-3 shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${WF_COLORS[idx % WF_COLORS.length]}cc, ${WF_COLORS[(idx + 1) % WF_COLORS.length]}99)` }}
                >
                  <Zap className="w-4 h-4 text-white" strokeWidth={2} />
                </div>

                {/* Name */}
                <p className="text-[14px] font-semibold text-[var(--color-text-primary)] leading-tight mb-1 pr-5">{wf.name}</p>

                {/* Meta */}
                <p className="text-[12px] text-[var(--color-text-tertiary)] mb-3">{wf.nodes.length} step{wf.nodes.length !== 1 ? "s" : ""}</p>

                {/* Status badge */}
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold mt-auto ${
                  wf.status === "active"
                    ? "bg-[var(--color-success-soft)] text-[var(--color-success)]"
                    : "bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${wf.status === "active" ? "bg-[var(--color-success)]" : "bg-[var(--color-text-tertiary)]"}`} />
                  {wf.status === "active" ? "Active" : "Draft"}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Health Monitor ── */}
      {activeTab === "health" && (
        <div style={{ width: 680 }} className="flex flex-col gap-5">

          {/* AI customize hint */}
          <div
            className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] cursor-pointer"
            style={{ padding: "14px 18px" }}
            onClick={() => window.dispatchEvent(new CustomEvent("open-agent-sidebar", { detail: { context: "workflow-health" } }))}
            onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "rgba(168,130,255,0.35)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.borderColor = "var(--color-border)"; }}
          >
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: "linear-gradient(135deg, #a78bfa, #e879f9)" }}>
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-[var(--color-text-primary)]">Customize this dashboard</p>
              <p className="text-[12px] text-[var(--color-text-tertiary)]">Ask the AI to add charts, metrics, or filters</p>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--color-text-tertiary)] flex-shrink-0" />
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: "Total executions", value: totalExecutions > 0 ? totalExecutions.toLocaleString() : "—", icon: <Activity className="w-4 h-4" />, color: "#a78bfa" },
              { label: "Active workflows", value: `${activeCount} / ${workflows.length}`, icon: <Zap className="w-4 h-4" />, color: activeCount > 0 ? "#34d399" : "var(--color-text-tertiary)" },
              { label: "Errors (7d)", value: totalExecutions > 0 ? `${mockErrors.length}` : "—", icon: <AlertCircle className="w-4 h-4" />, color: mockErrors.length > 0 ? "#fb923c" : "var(--color-text-tertiary)" },
            ].map((s) => (
              <div key={s.label} className="flex flex-col gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" style={{ padding: "18px 20px" }}>
                <div className="flex items-center gap-2" style={{ color: s.color }}>
                  {s.icon}
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-tertiary)]">{s.label}</span>
                </div>
                <p className="text-[28px] font-bold text-[var(--color-text-primary)] leading-none">{s.value}</p>
              </div>
            ))}
          </div>

          {/* Daily executions bar chart */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" style={{ padding: "22px 24px 18px" }}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">Daily executions</p>
                <p className="text-[12px] text-[var(--color-text-tertiary)] mt-0.5">Last 14 days · one bar per active workflow</p>
              </div>
              {activeCount > 0 && (
                <div className="flex items-center gap-3 flex-wrap justify-end" style={{ maxWidth: 280 }}>
                  {workflows.filter(w => w.status === "active").map((wf, idx) => (
                    <div key={wf.id} className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: WF_COLORS[idx % WF_COLORS.length] }} />
                      <span className="text-[11px] text-[var(--color-text-tertiary)] truncate" style={{ maxWidth: 80 }}>{wf.name}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
            {activeCount === 0 || chartDays.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-10">
                <BarChart2 className="w-8 h-8 text-[var(--color-text-tertiary)] opacity-30" />
                <p className="text-[13px] text-[var(--color-text-tertiary)]">
                  {activeCount === 0 ? "No active workflows — activate one to see execution data" : "No executions recorded yet"}
                </p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <svg width={Math.max(632, chartDays.length * 46)} height={180} style={{ display: "block" }}>
                  {[0, 0.25, 0.5, 0.75, 1].map((frac) => {
                    const maxVal = Math.max(...chartDays.flatMap((d) => d.values), 1);
                    const y = 10 + (1 - frac) * 130;
                    return (
                      <g key={frac}>
                        <line x1={28} x2={Math.max(632, chartDays.length * 46) - 4} y1={y} y2={y} stroke="var(--color-border)" strokeWidth={1} />
                        <text x={24} y={y + 4} textAnchor="end" fontSize={9} fill="var(--color-text-tertiary)">{Math.round(frac * maxVal)}</text>
                      </g>
                    );
                  })}
                  {chartDays.map((day, dIdx) => {
                    const maxVal = Math.max(...chartDays.flatMap((d) => d.values), 1);
                    const barW = 10;
                    const groupX = 32 + dIdx * 46;
                    return (
                      <g key={day.label}>
                        {day.values.map((val, wIdx) => {
                          const barH = Math.max(2, (val / maxVal) * 130);
                          const x = groupX + wIdx * (barW + 2);
                          const y = 10 + 130 - barH;
                          return <rect key={wIdx} x={x} y={y} width={barW} height={barH} rx={3} fill={WF_COLORS[wIdx % WF_COLORS.length]} opacity={0.85} />;
                        })}
                        <text x={groupX + (day.values.length * (barW + 2)) / 2} y={158} textAnchor="middle" fontSize={9} fill="var(--color-text-tertiary)" style={{ userSelect: "none" }}>{day.label}</text>
                      </g>
                    );
                  })}
                </svg>
              </div>
            )}
          </div>

          {/* Per-workflow status */}
          <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" style={{ padding: "20px 24px" }}>
            <p className="text-[14px] font-semibold text-[var(--color-text-primary)] mb-4">Workflow status</p>
            <div className="flex flex-col gap-3">
              {workflows.map((wf, idx) => (
                <div key={wf.id} className="flex items-center gap-3">
                  <span className="w-2.5 h-2.5 rounded-sm flex-shrink-0" style={{ background: WF_COLORS[idx % WF_COLORS.length] }} />
                  <p className="text-[13px] font-medium text-[var(--color-text-primary)] truncate" style={{ width: 160 }}>{wf.name}</p>
                  <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-hover)]">
                    {/* bar will fill when real data exists */}
                  </div>
                  <span className="text-[12px] text-[var(--color-text-tertiary)] flex-shrink-0" style={{ width: 60, textAlign: "right" }}>no data</span>
                  <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    wf.status === "active" ? "bg-[var(--color-success-soft)] text-[var(--color-success)]" : "bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
                  }`}>{wf.status === "active" ? "Active" : "Draft"}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Errors — only when real data exists */}
          {mockErrors.length > 0 && (
            <div className="rounded-2xl border border-[#fb923c33] bg-[var(--color-surface)]" style={{ padding: "20px 24px" }}>
              <div className="flex items-center gap-2 mb-4">
                <AlertCircle className="w-4 h-4 text-[#fb923c]" />
                <p className="text-[14px] font-semibold text-[var(--color-text-primary)]">Recent errors</p>
              </div>
              <div className="flex flex-col gap-3">
                {mockErrors.map((err) => (
                  <div key={err.id} className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-surface-hover)]">
                    <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: err.color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium text-[var(--color-text-primary)]">{err.workflow}</p>
                      <p className="text-[12px] text-[#fb923c]">{err.msg}</p>
                    </div>
                    <span className="text-[11px] text-[var(--color-text-tertiary)] flex-shrink-0">{err.time}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Status callout */}
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)]" style={{ padding: "16px 20px" }}>
            <TrendingUp className="w-4 h-4 flex-shrink-0" style={{ color: "#a78bfa" }} />
            <p className="text-[13px] text-[var(--color-text-secondary)]">
              {activeCount === 0
                ? <><span className="font-semibold text-[var(--color-text-primary)]">No active workflows yet.</span> Activate a workflow to start seeing live execution data, errors, and trends here.</>
                : <>{activeCount} workflow{activeCount > 1 ? "s are" : " is"} active. Execution data will appear here once runs complete.</>}
            </p>
          </div>

        </div>
      )}
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
}: {
  workflow: Workflow;
  onChange: (wf: Workflow) => void;
  onBack: () => void;
}) {
  const [showLpPanel, setShowLpPanel] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [orgSources, setOrgSources] = useState<string[]>([]);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [connecting, setConnecting] = useState<string | null>(null);

  // Load org sources so the New Contact trigger can filter by them
  useEffect(() => {
    fetch("/api/settings/org")
      .then((r) => r.json())
      .then((d) => setOrgSources(d.source_options ?? []))
      .catch(() => {});
  }, []);
  const [showTip, setShowTip] = useState(true);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [nodeSearch, setNodeSearch] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [editingName, setEditingName] = useState(false);
  const [wfName, setWfName] = useState(workflow.name);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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

  function updateNodeConfig(id: string, key: string, value: unknown) {
    onChange({
      ...workflow,
      nodes: nodes.map((n) =>
        n.id === id ? { ...n, config: { ...n.config, [key]: value } } : n
      ),
      updatedAt: Date.now(),
    });
  }

  const selectedNode = selectedNodeId ? nodes.find((n) => n.id === selectedNodeId) ?? null : null;

  function handleCanvasDrop(e: DragEvent) {
    e.preventDefault();
    const type = e.dataTransfer.getData("node-type");
    const def = NODE_CATALOG.find((n) => n.type === type);
    if (!def || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    addNode(def, e.clientX - rect.left - 100, e.clientY - rect.top - 28);
  }

  function handleNodeMouseDown(id: string, e: RMouseEvent) {
    if ((e.target as HTMLElement).closest("[data-port]")) return;
    e.preventDefault();
    const node = nodes.find((n) => n.id === id);
    if (!node || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    // Store offset as cursor position relative to canvas, minus the node's current canvas position
    setDragging(id);
    setDragOffset({
      x: (e.clientX - rect.left + canvasRef.current.scrollLeft) - node.x,
      y: (e.clientY - rect.top + canvasRef.current.scrollTop) - node.y,
    });
  }

  function handleCanvasMouseMove(e: RMouseEvent) {
    if (!dragging || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    moveNode(
      dragging,
      (e.clientX - rect.left + canvasRef.current.scrollLeft) - dragOffset.x,
      (e.clientY - rect.top + canvasRef.current.scrollTop) - dragOffset.y,
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

  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  function handleCanvasMouseMoveWithPos(e: RMouseEvent) {
    if (canvasRef.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left + canvasRef.current.scrollLeft,
        y: e.clientY - rect.top + canvasRef.current.scrollTop,
      });
    }
    handleCanvasMouseMove(e);
  }

  // Node card dimensions (must match rendered size)
  const NODE_W = 200;
  const NODE_H = 56;
  const PORT_R = 7; // port radius

  function getOutPortPos(node: WorkflowNode) {
    return { x: node.x + NODE_W + PORT_R, y: node.y + NODE_H / 2 };
  }
  function getInPortPos(node: WorkflowNode) {
    return { x: node.x - PORT_R, y: node.y + NODE_H / 2 };
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", position: "fixed", top: 0, bottom: 0, left: 68, right: "var(--right-panel-width, 0px)", overflow: "hidden", zIndex: 40, background: "var(--color-background)", transition: "right 300ms cubic-bezier(0.16,1,0.3,1)" }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-[var(--color-border)] bg-[var(--color-surface)] z-10" style={{ minHeight: 68 }}>
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="p-2.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-xl transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="h-6 w-px bg-[var(--color-border)]" />
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[var(--color-accent)] to-indigo-600 flex items-center justify-center shadow-sm">
            <Zap className="w-4 h-4 text-white" />
          </div>
          {editingName ? (
            <input
              ref={nameRef}
              value={wfName}
              onChange={(e) => setWfName(e.target.value)}
              onBlur={saveName}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveName();
                if (e.key === "Escape") { setWfName(workflow.name); setEditingName(false); }
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
          <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-medium ${
            workflow.status === "active"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-[var(--color-surface-hover)] text-[var(--color-text-tertiary)]"
          }`}>
            {workflow.status === "active" ? "Active" : "Draft"}
          </span>
        </div>
      </div>

      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* Node palette */}
        {paletteOpen && (
          <div style={{ width: 240, flexShrink: 0, borderRight: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden", alignSelf: "stretch" }}>

            {/* Search bar */}
            <div style={{ padding: "12px 12px 8px", borderBottom: "1px solid var(--color-border)", flexShrink: 0 }}>
              <div style={{ position: "relative" }}>
                <svg style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", width: 14, height: 14, color: "var(--color-text-tertiary)", pointerEvents: "none" }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                  <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
                </svg>
                <input
                  type="text"
                  placeholder="Search nodes..."
                  value={nodeSearch}
                  onChange={(e) => setNodeSearch(e.target.value)}
                  style={{ width: "100%", padding: "9px 10px 9px 30px", fontSize: 13, background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" }}
                />
              </div>
            </div>

            {/* Scrollable node list */}
            <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "12px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { title: "Triggers", items: TRIGGERS },
                { title: "Actions", items: ACTIONS },
                { title: "Logic", items: LOGIC },
              ].map((group) => {
                const filtered = group.items.filter((d) =>
                  !nodeSearch || d.label.toLowerCase().includes(nodeSearch.toLowerCase()) || d.desc.toLowerCase().includes(nodeSearch.toLowerCase())
                );
                if (filtered.length === 0) return null;
                const collapsed = collapsedGroups[group.title];
                return (
                  <div key={group.title}>
                    {/* Collapsible group header */}
                    <button
                      onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group.title]: !prev[group.title] }))}
                      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", padding: "6px 8px", background: "none", border: "none", cursor: "pointer", borderRadius: 8, marginBottom: 4 }}
                    >
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{group.title}</span>
                      <svg
                        style={{ width: 14, height: 14, color: "var(--color-text-tertiary)", transform: collapsed ? "rotate(-90deg)" : "rotate(0deg)", transition: "transform 0.15s ease", flexShrink: 0 }}
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </button>

                    {/* Items */}
                    {!collapsed && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                        {filtered.map((def) => (
                          <div
                            key={def.type}
                            draggable
                            onDragStart={(e) => {
                              e.dataTransfer.setData("node-type", def.type);
                              e.dataTransfer.effectAllowed = "copy";
                            }}
                            className="flex items-center rounded-xl border border-transparent hover:border-[var(--color-border)] hover:bg-[var(--color-background)] cursor-grab active:cursor-grabbing transition-all"
                            style={{ gap: 12, padding: "11px 10px" }}
                          >
                            <div
                              style={{ backgroundColor: def.color, width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, color: "white", boxShadow: "0 1px 4px rgba(0,0,0,0.18)" }}
                            >
                              {def.icon}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text-primary)", lineHeight: 1.2 }}>{def.label}</p>
                              <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", lineHeight: 1.3, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{def.desc}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Bottom actions — locked outside scroll */}
            <div style={{ padding: 14, borderTop: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 10, flexShrink: 0, background: "var(--color-surface)" }}>
              <button
                onClick={() => setPaletteOpen(false)}
                style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "15px 20px", fontSize: 14, fontWeight: 600, color: "var(--color-text-secondary)", background: "var(--color-surface-hover)", border: "1px solid var(--color-border)", borderRadius: 16, cursor: "pointer", boxSizing: "border-box" }}
              >
                <GripVertical className="w-4 h-4" />
                Hide Nodes
              </button>
              <button
                onClick={() => onChange({ ...workflow, status: workflow.status === "active" ? "draft" : "active", updatedAt: Date.now() })}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "15px 20px", fontSize: 14, fontWeight: 700, color: "white", borderRadius: 16, cursor: "pointer", border: "none", boxSizing: "border-box",
                  background: workflow.status === "active" ? "var(--color-danger)" : "linear-gradient(135deg, #a78bfa, #e879f9)",
                  boxShadow: workflow.status !== "active" ? "0 4px 20px rgba(168,130,255,0.35)" : "none",
                }}
              >
                <Play className="w-4 h-4" />
                {workflow.status === "active" ? "Deactivate" : "Activate"}
              </button>
            </div>
          </div>
        )}

        {/* Show nodes button when palette is hidden */}
        {!paletteOpen && (
          <button
            onClick={() => setPaletteOpen(true)}
            className="absolute left-3 bottom-3 z-30 flex items-center gap-1.5 px-3 py-2 text-[12px] font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] bg-[var(--color-surface)] rounded-xl hover:bg-[var(--color-surface-hover)] transition-colors shadow-sm"
          >
            <GripVertical className="w-3.5 h-3.5" />
            Show Nodes
          </button>
        )}

        {/* Canvas */}
        <div
          ref={canvasRef}
          className="flex-1 relative overflow-auto"
          style={{
            backgroundImage: "radial-gradient(circle, var(--color-border) 1px, transparent 1px)",
            backgroundSize: "28px 28px",
            backgroundColor: "var(--color-background)",
            cursor: connecting ? "crosshair" : "default",
          }}
          onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; }}
          onDrop={handleCanvasDrop}
          onMouseMove={handleCanvasMouseMoveWithPos}
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
                <p className="text-[13px] font-semibold text-[var(--color-text-primary)] mb-1">Let AI build this for you</p>
                <p className="text-[12px] text-[var(--color-text-tertiary)] leading-relaxed">Open the AI sidebar and describe what you want to automate.</p>
              </div>
              <button onClick={() => setShowTip(false)} className="p-1 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors flex-shrink-0">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl border-2 border-dashed border-[var(--color-border)] flex items-center justify-center mx-auto mb-4">
                  <Plus className="w-6 h-6 text-[var(--color-text-tertiary)]" />
                </div>
                <p className="text-[14px] font-medium text-[var(--color-text-tertiary)]">Drag nodes from the panel to get started</p>
                <p className="text-[12px] text-[var(--color-text-tertiary)] mt-1">or let the AI sidebar build it for you</p>
              </div>
            </div>
          )}

          {/* SVG layer: edges + live connection line */}
          <svg
            className="absolute inset-0 pointer-events-none z-0"
            style={{ width: "100%", height: "100%", overflow: "visible" }}
          >
            <defs>
              <marker id="arrowhead" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                <polygon points="0 0, 8 3, 0 6" fill="var(--color-accent)" opacity="0.6" />
              </marker>
            </defs>

            {/* Existing edges */}
            {edges.map((edge) => {
              const fromNode = nodes.find((n) => n.id === edge.from);
              const toNode = nodes.find((n) => n.id === edge.to);
              if (!fromNode || !toNode) return null;
              const p1 = getOutPortPos(fromNode);
              const p2 = getInPortPos(toNode);
              const cx = (p1.x + p2.x) / 2;
              return (
                <g
                  key={edge.id}
                  className="pointer-events-auto cursor-pointer group/edge"
                  onClick={() => removeEdge(edge.id)}
                >
                  {/* Fat invisible hit target */}
                  <path d={`M ${p1.x} ${p1.y} C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`} fill="none" stroke="transparent" strokeWidth={16} />
                  {/* Visible edge */}
                  <path
                    d={`M ${p1.x} ${p1.y} C ${cx} ${p1.y}, ${cx} ${p2.y}, ${p2.x} ${p2.y}`}
                    fill="none"
                    stroke="var(--color-accent)"
                    strokeWidth={2}
                    opacity={0.55}
                    markerEnd="url(#arrowhead)"
                    className="group-hover/edge:opacity-100 group-hover/edge:stroke-[var(--color-danger)]"
                    style={{ transition: "opacity 0.15s, stroke 0.15s" }}
                  />
                </g>
              );
            })}

            {/* Live drag-to-connect line */}
            {connecting && (() => {
              const fromNode = nodes.find((n) => n.id === connecting);
              if (!fromNode) return null;
              const p1 = getOutPortPos(fromNode);
              const cx = (p1.x + mousePos.x) / 2;
              return (
                <path
                  d={`M ${p1.x} ${p1.y} C ${cx} ${p1.y}, ${cx} ${mousePos.y}, ${mousePos.x} ${mousePos.y}`}
                  fill="none"
                  stroke="var(--color-accent)"
                  strokeWidth={2}
                  strokeDasharray="6 3"
                  opacity={0.7}
                />
              );
            })()}
          </svg>

          {/* Nodes */}
          {nodes.map((node) => {
            const def = getNodeDef(node.type);
            const isTrigger = def?.category === "trigger";
            const isLp = node.type === "landing-page";
            const isConnectingFrom = connecting === node.id;

            return (
              <div
                key={node.id}
                className={`absolute select-none z-10 group/card ${dragging === node.id ? "cursor-grabbing" : "cursor-grab"}`}
                style={{ left: node.x, top: node.y }}
                onMouseDown={(e) => handleNodeMouseDown(node.id, e)}
              >
                <div className="relative flex items-center">
                  {/* In port — hidden for triggers */}
                  {!isTrigger && (
                    <div
                      data-port="in"
                      onClick={(e) => { e.stopPropagation(); handlePortClick(node.id, "in"); }}
                      className={`absolute -left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 z-20 transition-all cursor-crosshair ${
                        connecting && connecting !== node.id
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] scale-125 shadow-[0_0_0_3px_rgba(99,102,241,0.2)]"
                          : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]"
                      }`}
                      style={{ pointerEvents: "all" }}
                    />
                  )}

                  {/* Card */}
                  <div
                    onClick={(e) => { e.stopPropagation(); if (!dragging) { setSelectedNodeId(node.id); if (isLp) setShowLpPanel(true); } }}
                    className={`flex items-center gap-3 px-4 py-3.5 bg-[var(--color-surface)] border rounded-2xl shadow-md transition-all ${
                      selectedNodeId === node.id
                        ? "border-[var(--color-accent)] shadow-[0_0_0_3px_rgba(99,102,241,0.18)] ring-1 ring-[var(--color-accent)]/30"
                        : isConnectingFrom
                        ? "border-[var(--color-accent)] shadow-[0_0_0_3px_rgba(99,102,241,0.15)]"
                        : "border-[var(--color-border)] hover:border-[var(--color-border)] hover:shadow-lg"
                    }`}
                    style={{ minWidth: NODE_W, width: NODE_W }}
                  >
                    <div
                      className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-white shadow-sm"
                      style={{ backgroundColor: def?.color ?? "#6366f1" }}
                    >
                      {def?.icon ?? <Zap className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[var(--color-text-primary)] truncate leading-tight">{node.label}</p>
                      {def?.desc && (
                        <p className="text-[11px] text-[var(--color-text-tertiary)] truncate mt-0.5">{def.desc}</p>
                      )}
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeNode(node.id); }}
                      className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded-lg transition-colors opacity-0 group-hover/card:opacity-100 flex-shrink-0"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Out port */}
                  <div
                    data-port="out"
                    onClick={(e) => { e.stopPropagation(); handlePortClick(node.id, "out"); }}
                    className={`absolute -right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full border-2 z-20 transition-all cursor-crosshair ${
                      isConnectingFrom
                        ? "border-[var(--color-accent)] bg-[var(--color-accent)] scale-125"
                        : "border-[var(--color-border)] bg-[var(--color-surface)] hover:border-[var(--color-accent)] hover:bg-[var(--color-accent)]"
                    }`}
                    style={{ pointerEvents: "all" }}
                  />
                </div>
              </div>
            );
          })}

          {/* Cancel connection / deselect on canvas click */}
          {(connecting || selectedNodeId) && (
            <div
              className="absolute inset-0 z-5"
              style={{ pointerEvents: "all" }}
              onClick={() => { setConnecting(null); setSelectedNodeId(null); }}
            />
          )}
        </div>

        {/* ── Landing page inline panel ── */}
        {showLpPanel && (
          <LandingPageEditor
            workflowId={workflow.id}
            onClose={() => { setShowLpPanel(false); setSelectedNodeId(null); }}
            lpNode={selectedNode?.type === "landing-page" ? selectedNode : null}
            onUpdateNode={(key, val) => {
              if (!selectedNode) return;
              onChange({ ...workflow, nodes: nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...(n.config ?? {}), [key]: val } } : n), updatedAt: Date.now() });
            }}
            onRenameNode={(label) => {
              if (!selectedNode) return;
              onChange({ ...workflow, nodes: nodes.map((n) => n.id === selectedNode.id ? { ...n, label } : n), updatedAt: Date.now() });
            }}
            onDeleteNode={() => { if (selectedNode) { removeNode(selectedNode.id); setSelectedNodeId(null); setShowLpPanel(false); } }}
          />
        )}

        {/* ── Node config panel ── */}
        {selectedNode && !showLpPanel && (() => {
          const def = getNodeDef(selectedNode.type);
          const rawFields = NODE_CONFIG_FIELDS[selectedNode.type] ?? [];
          // Inject live org sources into the new-contact source dropdown
          const fields = rawFields.map((f) => {
            if (selectedNode.type === "new-contact" && f.key === "source" && orgSources.length > 0) {
              return { ...f, options: [{ value: "", label: "Any source" }, ...orgSources.map((s) => ({ value: s, label: s }))] };
            }
            return f;
          });
          const cfg = (selectedNode.config ?? {}) as Record<string, string>;
          return (
            <div style={{ width: 300, flexShrink: 0, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>
              {/* Panel header */}
              <div style={{ padding: "16px 16px 12px", borderBottom: "1px solid var(--color-border)", display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                <div style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: def?.color ?? "#6366f1", display: "flex", alignItems: "center", justifyContent: "center", color: "white", flexShrink: 0, boxShadow: "0 1px 4px rgba(0,0,0,0.18)" }}>
                  {def?.icon ?? <Zap className="w-4 h-4" />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <input
                    type="text"
                    value={selectedNode.label}
                    onChange={(e) => onChange({ ...workflow, nodes: nodes.map((n) => n.id === selectedNode.id ? { ...n, label: e.target.value } : n), updatedAt: Date.now() })}
                    style={{ width: "100%", fontSize: 14, fontWeight: 700, color: "var(--color-text-primary)", background: "none", border: "none", outline: "none", padding: 0, lineHeight: 1.2 }}
                  />
                  <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", marginTop: 2 }}>{def?.desc}</p>
                </div>
                <button
                  onClick={() => setSelectedNodeId(null)}
                  style={{ padding: 6, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: "var(--color-text-tertiary)" }}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Panel body — scrollable */}
              <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column", gap: 16 }}>
                {fields.length === 0 ? (
                  <p style={{ fontSize: 13, color: "var(--color-text-tertiary)", textAlign: "center", padding: "24px 0" }}>No configuration needed for this node.</p>
                ) : (
                  fields.map((field) => (
                    <div key={field.key}>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>{field.label}</label>
                      {field.type === "select" ? (
                        <select
                          value={(cfg[field.key] as string) ?? ""}
                          onChange={(e) => updateNodeConfig(selectedNode.id, field.key, e.target.value)}
                          style={{ width: "100%", padding: "10px 12px", fontSize: 13, background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-text-primary)", outline: "none", cursor: "pointer", appearance: "none" }}
                        >
                          {field.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      ) : field.type === "textarea" ? (
                        <textarea
                          value={(cfg[field.key] as string) ?? ""}
                          onChange={(e) => updateNodeConfig(selectedNode.id, field.key, e.target.value)}
                          placeholder={field.placeholder}
                          rows={3}
                          style={{ width: "100%", padding: "10px 12px", fontSize: 13, background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-text-primary)", outline: "none", resize: "vertical", fontFamily: "inherit", boxSizing: "border-box" }}
                        />
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          value={(cfg[field.key] as string) ?? ""}
                          onChange={(e) => updateNodeConfig(selectedNode.id, field.key, field.type === "number" ? e.target.value : e.target.value)}
                          placeholder={field.placeholder}
                          style={{ width: "100%", padding: "10px 12px", fontSize: 13, background: "var(--color-background)", border: "1px solid var(--color-border)", borderRadius: 12, color: "var(--color-text-primary)", outline: "none", boxSizing: "border-box" }}
                        />
                      )}
                    </div>
                  ))
                )}
              </div>

              {/* Panel footer */}
              <div style={{ padding: 14, borderTop: "1px solid var(--color-border)", flexShrink: 0 }}>
                <button
                  onClick={() => { removeNode(selectedNode.id); setSelectedNodeId(null); }}
                  style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px 16px", fontSize: 13, fontWeight: 600, color: "var(--color-danger)", background: "var(--color-danger-soft, rgba(239,68,68,0.08))", border: "1px solid transparent", borderRadius: 12, cursor: "pointer" }}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Delete Node
                </button>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Landing Page Editor (accessed from LP node)
   ═══════════════════════════════════════════════════════ */

function LandingPageEditor({
  workflowId,
  onClose,
  lpNode,
  onUpdateNode,
  onRenameNode,
  onDeleteNode,
}: {
  workflowId: string;
  onClose: () => void;
  lpNode: WorkflowNode | null;
  onUpdateNode: (key: string, val: string) => void;
  onRenameNode: (label: string) => void;
  onDeleteNode: () => void;
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
  const [copiedEmbed, setCopiedEmbed] = useState(false);
  const [loadingPage, setLoadingPage] = useState(true);
  const [showHtml, setShowHtml] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [dirty, setDirty] = useState(false);
  const htmlRef = useRef<HTMLTextAreaElement>(null);

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
        setHtmlDraft(data.html_content ?? "");
      } else {
        lpCtx.open("", "", "", []);
        setHtmlDraft("");
      }
      setLoadingPage(false);
    }
    load();
    return () => lpCtx.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflowId]);

  useEffect(() => { lpCtx.setSlug(slug); setDirty(true); }, [slug, lpCtx]);
  useEffect(() => { lpCtx.setBrandAssets(brandAssets); setDirty(true); }, [brandAssets, lpCtx]);
  useEffect(() => { lpCtx.setPageId(pageId); }, [pageId, lpCtx]);

  // Keep htmlDraft synced when AI sidebar updates HTML
  useEffect(() => {
    setHtmlDraft(lpCtx.state.html);
    setDirty(true);
  }, [lpCtx.state.html]);

  const html = lpCtx.state.html;

  function applyHtmlEdit() {
    lpCtx.setHtml(htmlDraft);
  }

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
    setDirty(false);
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
      const newAsset = { type: file.type.startsWith("image/") ? "logo" : "file", url: publicUrl, name: file.name };
      setBrandAssetsLocal([...brandAssets, newAsset]);
    }
    setUploading(false);
  }

  const liveUrl = `https://site.trykove.app/lp/${slug}`;
  const embedCode = `<iframe src="${liveUrl}" style="width:100%;min-height:600px;border:none;" loading="lazy"></iframe>`;

  function copyUrl() {
    navigator.clipboard.writeText(liveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function copyEmbed() {
    navigator.clipboard.writeText(embedCode);
    setCopiedEmbed(true);
    setTimeout(() => setCopiedEmbed(false), 2000);
  }

  if (loadingPage) {
    return (
      <div style={{ width: 660, flexShrink: 0, borderLeft: "1px solid var(--color-border)", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--color-text-tertiary)" }} />
      </div>
    );
  }

  const btnStyle = (primary: boolean): React.CSSProperties => ({
    display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
    flex: 1, padding: "0 14px", height: 34, fontSize: 12, fontWeight: 700,
    borderRadius: 10, cursor: "pointer", whiteSpace: "nowrap" as const,
    ...(primary
      ? { color: "white", background: pageStatus === "live" ? "#ef4444" : "linear-gradient(135deg,#10b981,#059669)", border: "none", opacity: html ? 1 : 0.4 }
      : { color: "var(--color-text-secondary)", background: "var(--color-surface-hover)", border: "1px solid var(--color-border)", position: "relative" as const }
    ),
  });

  return (
    <div style={{ width: 660, flexShrink: 0, borderLeft: "1px solid var(--color-border)", display: "flex", flexDirection: "row", minHeight: 0, overflow: "hidden" }}>

      {/* LEFT: live preview */}
      <div style={{ flex: 1, minWidth: 0, background: "#0d0d0f", display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {html ? (
          <iframe srcDoc={html} style={{ flex: 1, width: "100%", border: "none", background: "white", pointerEvents: "none" }} sandbox="allow-scripts" title="Landing page preview" />
        ) : (
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 8 }}>
            <Sparkles className="w-5 h-5" style={{ color: "var(--color-accent)" }} strokeWidth={1.5} />
            <p style={{ fontSize: 12, fontWeight: 600, color: "var(--color-text-tertiary)", textAlign: "center" }}>No page yet</p>
            <p style={{ fontSize: 11, color: "var(--color-text-tertiary)", textAlign: "center", lineHeight: 1.4, maxWidth: 180 }}>Use the AI sidebar to generate your landing page.</p>
          </div>
        )}
      </div>

      {/* RIGHT: settings column */}
      <div style={{ width: 300, flexShrink: 0, borderLeft: "1px solid var(--color-border)", background: "var(--color-surface)", display: "flex", flexDirection: "column", minHeight: 0, overflow: "hidden" }}>

        {/* Toolbar */}
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--color-border)", display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
          {/* Row 1: close + icon + label */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={onClose} style={{ padding: 6, borderRadius: 8, border: "none", background: "none", cursor: "pointer", color: "var(--color-text-tertiary)", flexShrink: 0 }}>
              <X className="w-4 h-4" />
            </button>
            <div style={{ width: 28, height: 28, borderRadius: 8, background: "linear-gradient(135deg,#6366f1,#8b5cf6)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
              <Globe className="w-3.5 h-3.5 text-white" />
            </div>
            <input
              type="text"
              value={lpNode?.label ?? "Landing Page"}
              onChange={(e) => onRenameNode(e.target.value)}
              style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: "var(--color-text-primary)", background: "none", border: "none", outline: "none", padding: 0 }}
            />
            <span style={{ fontSize: 10, padding: "2px 7px", borderRadius: 999, fontWeight: 600, flexShrink: 0, background: pageStatus === "live" ? "rgba(16,185,129,0.12)" : "var(--color-surface-hover)", color: pageStatus === "live" ? "#10b981" : "var(--color-text-tertiary)" }}>
              {pageStatus === "live" ? "Live" : "Draft"}
            </span>
          </div>
          {/* Row 2: slug */}
          <div style={{ display: "flex", alignItems: "center", gap: 4, paddingLeft: 2 }}>
            <span style={{ fontSize: 10, color: "var(--color-text-tertiary)", whiteSpace: "nowrap" }}>trykove.app/lp/</span>
            <input
              type="text"
              value={slug}
              onChange={(e) => { setSlugLocal(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "")); setSlugError(""); }}
              placeholder="your-slug"
              style={{ flex: 1, minWidth: 0, padding: "3px 7px", fontSize: 11, fontWeight: 600, background: "var(--color-background)", border: "1px solid " + (slugError ? "var(--color-danger)" : "var(--color-border)"), borderRadius: 6, color: "var(--color-text-primary)", outline: "none" }}
            />
          </div>
          {slugError && <span style={{ fontSize: 10, color: "var(--color-danger)", paddingLeft: 2 }}>{slugError}</span>}
          {/* Row 3: action buttons */}
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={handleSave} disabled={saving} style={{ ...btnStyle(false), opacity: saving ? 0.5 : 1 }}>
              {saving && <Loader2 className="w-3 h-3 animate-spin" />}
              Save
              {dirty && !saving && <span style={{ position: "absolute", top: 5, right: 5, width: 6, height: 6, borderRadius: 999, background: "#f59e0b" }} />}
            </button>
            <button onClick={handlePublish} disabled={!html} style={btnStyle(true)}>
              {pageStatus === "live" ? "Unpublish" : "Go Live"}
            </button>
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 14, display: "flex", flexDirection: "column", gap: 16 }}>

          {/* Advanced mode toggle */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--color-text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em" }}>Advanced Mode</span>
            <button
              onClick={() => setAdvanced(!advanced)}
              style={{ display: "flex", alignItems: "center", gap: 4, padding: "4px 10px", fontSize: 11, fontWeight: 600, borderRadius: 8, cursor: "pointer", border: "1px solid " + (advanced ? "rgba(99,102,241,0.3)" : "var(--color-border)"), background: advanced ? "rgba(99,102,241,0.1)" : "var(--color-surface-hover)", color: advanced ? "var(--color-accent)" : "var(--color-text-tertiary)" }}
            >
              <Code2 className="w-3 h-3" />
              {advanced ? "On" : "Off"}
            </button>
          </div>

          {/* Simple fields — hidden in advanced mode */}
          {!advanced && lpNode && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {([{key:"pageTitle",label:"Page Title",ph:"e.g. Get Started Today"},{key:"headline",label:"Headline",ph:"Main headline text"},{key:"ctaText",label:"CTA Button Text",ph:"e.g. Sign Up Free"}] as {key:string;label:string;ph:string}[]).map(f => (
                <div key={f.key}>
                  <label style={{ display:"block", fontSize:10, fontWeight:700, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>{f.label}</label>
                  <input type="text" value={((lpNode.config ?? {}) as Record<string,string>)[f.key] ?? ""} onChange={e => onUpdateNode(f.key, e.target.value)} placeholder={f.ph} style={{ width:"100%", padding:"8px 10px", fontSize:12, background:"var(--color-background)", border:"1px solid var(--color-border)", borderRadius:8, color:"var(--color-text-primary)", outline:"none", boxSizing:"border-box" }} />
                </div>
              ))}
              <div style={{ borderBottom: "1px solid var(--color-border)" }} />
            </div>
          )}

          {/* Advanced code editor */}
          {advanced && (
            <div>
              <label style={{ display:"block", fontSize:10, fontWeight:700, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:4 }}>HTML + JavaScript</label>
              <div style={{ position: "relative" }}>
                <textarea
                  ref={htmlRef}
                  value={htmlDraft}
                  onChange={(e) => { setHtmlDraft(e.target.value); setDirty(true); }}
                  onBlur={applyHtmlEdit}
                  spellCheck={false}
                  style={{ width:"100%", minHeight:220, padding:10, fontSize:11, fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace", background:"var(--color-background)", border:"1px solid var(--color-border)", borderRadius:8, color:"var(--color-text-primary)", outline:"none", resize:"vertical", boxSizing:"border-box", lineHeight:1.5 }}
                />
                {htmlDraft !== html && (
                  <button onClick={applyHtmlEdit} style={{ position:"absolute", bottom:6, right:6, padding:"4px 10px", fontSize:10, fontWeight:700, color:"white", background:"var(--color-accent)", border:"none", borderRadius:6, cursor:"pointer" }}>Apply</button>
                )}
              </div>
            </div>
          )}

          {/* Brand Assets */}
          <div>
            <label style={{ display:"block", fontSize:10, fontWeight:700, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:6 }}>Brand Assets</label>
            {brandAssets.length > 0 && (
              <div style={{ display:"flex", flexDirection:"column", gap:5, marginBottom:8 }}>
                {brandAssets.map((a, i) => (
                  <div key={i} style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", background:"var(--color-background)", border:"1px solid var(--color-border)", borderRadius:8 }}>
                    {a.type === "logo" ? <img src={a.url} alt={a.name} style={{ width:22, height:22, borderRadius:4, objectFit:"cover", flexShrink:0 }} /> : <Code2 style={{ width:16, height:16, color:"var(--color-text-tertiary)", flexShrink:0 }} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:11, fontWeight:600, color:"var(--color-text-primary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{a.name}</p>
                      <button onClick={() => navigator.clipboard.writeText(a.url)} style={{ fontSize:9, color:"var(--color-accent)", background:"none", border:"none", padding:0, cursor:"pointer" }}>Copy URL</button>
                    </div>
                    <button onClick={() => setBrandAssetsLocal(brandAssets.filter((_,j)=>j!==i))} style={{ padding:3, borderRadius:4, border:"none", background:"none", cursor:"pointer", color:"var(--color-text-tertiary)" }}><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <label style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, width:"100%", padding:"10px 12px", fontSize:11, fontWeight:600, color:"var(--color-text-secondary)", background:"var(--color-background)", border:"2px dashed var(--color-border)", borderRadius:8, cursor:"pointer" }}>
              <Upload className="w-3.5 h-3.5" />
              {uploading ? "Uploading…" : "Upload Asset"}
              <input type="file" accept="image/*,.svg,.html,.css,.js" onChange={handleUploadAsset} style={{ display:"none" }} />
            </label>
          </div>

          {/* Embed / Share */}
          {pageId && slug && (
            <div>
              <label style={{ display:"block", fontSize:10, fontWeight:700, color:"var(--color-text-secondary)", textTransform:"uppercase", letterSpacing:"0.06em", marginBottom:8 }}>Share & Embed</label>
              <div style={{ marginBottom:8 }}>
                <p style={{ fontSize:10, color:"var(--color-text-tertiary)", marginBottom:3 }}>Direct Link</p>
                <div style={{ display:"flex", gap:5 }}>
                  <div style={{ flex:1, padding:"6px 8px", fontSize:10, fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace", background:"var(--color-background)", border:"1px solid var(--color-border)", borderRadius:6, color:"var(--color-text-secondary)", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{liveUrl}</div>
                  <button onClick={copyUrl} style={{ padding:"6px 10px", fontSize:10, fontWeight:600, color: copied?"#10b981":"var(--color-text-secondary)", background:"var(--color-surface-hover)", border:"1px solid var(--color-border)", borderRadius:6, cursor:"pointer", flexShrink:0 }}>{copied ? <Check className="w-3 h-3" /> : "Copy"}</button>
                </div>
              </div>
              <div>
                <p style={{ fontSize:10, color:"var(--color-text-tertiary)", marginBottom:3 }}>Embed Code</p>
                <div style={{ position:"relative" }}>
                  <pre style={{ padding:"8px 10px", fontSize:9, fontFamily:"ui-monospace,SFMono-Regular,Menlo,monospace", background:"var(--color-background)", border:"1px solid var(--color-border)", borderRadius:6, color:"var(--color-text-secondary)", overflow:"auto", whiteSpace:"pre-wrap", wordBreak:"break-all", lineHeight:1.5, margin:0 }}>{embedCode}</pre>
                  <button onClick={copyEmbed} style={{ position:"absolute", top:4, right:4, padding:"3px 8px", fontSize:9, fontWeight:700, color:copiedEmbed?"#10b981":"var(--color-accent)", background:"var(--color-surface)", border:"1px solid var(--color-border)", borderRadius:4, cursor:"pointer" }}>{copiedEmbed?"Copied!":"Copy"}</button>
                </div>
              </div>
            </div>
          )}

          {/* Delete Node */}
          {lpNode && (
            <button onClick={onDeleteNode} style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6, width:"100%", padding:"10px 14px", fontSize:12, fontWeight:600, color:"var(--color-danger)", background:"rgba(239,68,68,0.08)", border:"1px solid transparent", borderRadius:10, cursor:"pointer" }}>
              <Trash2 className="w-3.5 h-3.5" />
              Delete Node
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
