import { createServiceClient } from "@/lib/supabase/service";
import { sendSMS } from "@/lib/telnyx/client";
import nodemailer from "nodemailer";
import type { SmtpConfig } from "@/lib/types/database";

interface WfNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  config?: Record<string, string>;
}

interface WfEdge {
  id: string;
  from: string;
  to: string;
}

interface StepLog {
  nodeId: string;
  type: string;
  status: "success" | "failed" | "skipped";
  result?: string;
  startedAt: string;
  finishedAt: string;
}

interface ExecContext {
  orgId: string;
  contact: Record<string, unknown>;
  org: Record<string, unknown>;
}

/**
 * Execute a workflow for a given trigger + context.
 * Walks the node graph in topological order following edges.
 */
export async function executeWorkflow(
  workflowId: string,
  triggerType: string,
  context: ExecContext
) {
  const supabase = createServiceClient();

  // Fetch workflow
  const { data: wf } = await supabase
    .from("workflows")
    .select("*")
    .eq("id", workflowId)
    .single();

  if (!wf || wf.status !== "active") return;

  const nodes: WfNode[] = wf.nodes ?? [];
  const edges: WfEdge[] = wf.edges ?? [];

  if (nodes.length === 0) return;

  // Create execution record
  const { data: exec } = await supabase
    .from("workflow_executions")
    .insert({
      org_id: context.orgId,
      workflow_id: workflowId,
      contact_id: (context.contact?.id as string) ?? null,
      trigger_type: triggerType,
      status: "running",
    })
    .select("id")
    .single();

  const execId = exec?.id;
  const steps: StepLog[] = [];

  try {
    // Find trigger node(s) — entry points (no incoming edges)
    const nodesWithIncoming = new Set(edges.map((e) => e.to));
    const entryNodes = nodes.filter((n) => !nodesWithIncoming.has(n.id));

    // BFS walk through graph
    const visited = new Set<string>();
    const queue = [...entryNodes];

    while (queue.length > 0) {
      const node = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);

      const stepStart = new Date().toISOString();
      let stepStatus: "success" | "failed" | "skipped" = "success";
      let stepResult = "";

      try {
        // Execute this node's action
        const result = await executeNode(node, context);
        stepResult = result ?? "ok";

        // If it's a condition node and it returned false, skip downstream
        if (node.type === "condition" && result === "false") {
          stepStatus = "skipped";
          steps.push({ nodeId: node.id, type: node.type, status: stepStatus, result: stepResult, startedAt: stepStart, finishedAt: new Date().toISOString() });
          continue; // Don't follow edges from this node
        }
      } catch (err) {
        stepStatus = "failed";
        stepResult = err instanceof Error ? err.message : String(err);
      }

      steps.push({
        nodeId: node.id,
        type: node.type,
        status: stepStatus,
        result: stepResult,
        startedAt: stepStart,
        finishedAt: new Date().toISOString(),
      });

      // If step failed, stop execution
      if (stepStatus === "failed") break;

      // Follow edges to next nodes
      const nextEdges = edges.filter((e) => e.from === node.id);
      for (const edge of nextEdges) {
        const nextNode = nodes.find((n) => n.id === edge.to);
        if (nextNode && !visited.has(nextNode.id)) {
          queue.push(nextNode);
        }
      }
    }

    // Update execution record
    const allSuccess = steps.every((s) => s.status === "success" || s.status === "skipped");
    if (execId) {
      await supabase
        .from("workflow_executions")
        .update({
          status: allSuccess ? "completed" : "failed",
          steps,
          error: allSuccess ? null : steps.find((s) => s.status === "failed")?.result,
          finished_at: new Date().toISOString(),
        })
        .eq("id", execId);
    }
  } catch (err) {
    if (execId) {
      await supabase
        .from("workflow_executions")
        .update({
          status: "failed",
          steps,
          error: err instanceof Error ? err.message : String(err),
          finished_at: new Date().toISOString(),
        })
        .eq("id", execId);
    }
  }
}

/**
 * Execute a single node based on its type and config.
 */
async function executeNode(node: WfNode, ctx: ExecContext): Promise<string> {
  const cfg = node.config ?? {};
  const supabase = createServiceClient();

  // Interpolate template variables like {{contact.email}}
  function interpolate(template: string): string {
    return template.replace(/\{\{(\w+)\.(\w+)\}\}/g, (_, obj, key) => {
      if (obj === "contact") return String((ctx.contact as Record<string, unknown>)?.[key] ?? "");
      if (obj === "org") return String((ctx.org as Record<string, unknown>)?.[key] ?? "");
      return "";
    });
  }

  switch (node.type) {
    // ─── Triggers (no-ops during execution, they already fired) ───
    case "landing-page":
    case "form-submit":
    case "new-contact":
    case "inbound-call":
    case "schedule":
    case "webhook":
      return "trigger";

    // ─── Actions ───
    case "send-sms": {
      const to = interpolate(cfg.to ?? "{{contact.phone}}");
      const message = interpolate(cfg.message ?? "");
      if (!to || !message) return "skipped: missing to or message";

      const { data: org } = await supabase
        .from("organizations")
        .select("telnyx_phone, telnyx_messaging_profile_id")
        .eq("id", ctx.orgId)
        .single();

      if (!org?.telnyx_phone) throw new Error("No phone number configured");

      await sendSMS(org.telnyx_phone, to, message, org.telnyx_messaging_profile_id ?? undefined);

      // Log activity
      await supabase.from("activities").insert({
        contact_id: (ctx.contact?.id as string) ?? null,
        user_id: null,
        org_id: ctx.orgId,
        type: "sms",
        content: message,
        direction: "outbound",
        metadata: { to, from: org.telnyx_phone, automated: true, workflow_node: node.id },
        occurred_at: new Date().toISOString(),
      });

      return `sent to ${to}`;
    }

    case "send-email": {
      const to = interpolate(cfg.to ?? "{{contact.email}}");
      const subject = interpolate(cfg.subject ?? "");
      const isHtml = cfg.is_html === "true";
      const bodyHtml = isHtml ? interpolate(cfg.body_html ?? "") : "";
      const bodyText = interpolate(cfg.body ?? "");
      if (!to || (!bodyText && !bodyHtml)) return "skipped: missing to or body";

      const { data: org } = await supabase
        .from("organizations")
        .select("smtp_config")
        .eq("id", ctx.orgId)
        .single();

      const smtp = org?.smtp_config as SmtpConfig | null;
      if (!smtp?.host || !smtp?.user || !smtp?.pass) throw new Error("SMTP not configured");

      const transporter = nodemailer.createTransport({
        host: smtp.host,
        port: smtp.port || 587,
        secure: smtp.port === 465,
        auth: { user: smtp.user, pass: smtp.pass },
      });

      const mailOptions: Parameters<typeof transporter.sendMail>[0] = {
        from: smtp.from_name ? `"${smtp.from_name}" <${smtp.from_email || smtp.user}>` : smtp.from_email || smtp.user,
        to,
        subject: subject || "(no subject)",
      };
      if (isHtml && bodyHtml) {
        mailOptions.html = bodyHtml;
        mailOptions.text = bodyHtml.replace(/<[^>]+>/g, ""); // plain-text fallback
      } else {
        mailOptions.text = bodyText;
      }

      await transporter.sendMail(mailOptions);

      await supabase.from("activities").insert({
        contact_id: (ctx.contact?.id as string) ?? null,
        user_id: null,
        org_id: ctx.orgId,
        type: "email",
        content: isHtml ? bodyHtml : bodyText,
        direction: "outbound",
        metadata: { to, subject, automated: true, workflow_node: node.id, html: isHtml },
        occurred_at: new Date().toISOString(),
      });

      return `sent to ${to}`;
    }

    case "assign-task": {
      const title = interpolate(cfg.title ?? "Follow up");
      const dueIn = parseInt(cfg.dueIn ?? "24", 10);
      const dueAt = new Date(Date.now() + dueIn * 3600_000).toISOString();

      await supabase.from("tasks").insert({
        org_id: ctx.orgId,
        contact_id: (ctx.contact?.id as string) ?? null,
        assigned_to: null,
        type: "ai_action",
        title,
        due_at: dueAt,
        notes: interpolate(cfg.notes ?? ""),
        status: "pending",
        created_by_ai: true,
      });

      return `task created: ${title}`;
    }

    case "notify-team": {
      // For now, log as an activity that the UI can show
      const message = interpolate(cfg.message ?? "");
      await supabase.from("activities").insert({
        contact_id: (ctx.contact?.id as string) ?? null,
        user_id: null,
        org_id: ctx.orgId,
        type: "note",
        content: `[Workflow Notification] ${message}`,
        direction: "system",
        metadata: { automated: true, channel: cfg.channel ?? "in-app", workflow_node: node.id },
        occurred_at: new Date().toISOString(),
      });
      return `notified via ${cfg.channel ?? "in-app"}`;
    }

    // ─── Logic ───
    case "delay": {
      const duration = parseInt(cfg.duration ?? "0", 10);
      const unit = cfg.unit ?? "minutes";
      const ms = duration * (unit === "days" ? 86400000 : unit === "hours" ? 3600000 : 60000);
      if (ms > 0 && ms <= 300000) {
        // Only sleep up to 5 minutes in the same execution (Vercel timeout)
        await new Promise((r) => setTimeout(r, ms));
      }
      // Longer delays would need a scheduled re-run — log it
      return ms > 300000 ? `delay ${duration} ${unit} (exceeds execution window)` : `waited ${duration} ${unit}`;
    }

    case "condition": {
      const field = cfg.field ?? "";
      const operator = cfg.operator ?? "equals";
      const value = cfg.value ?? "";
      const actual = String((ctx.contact as Record<string, unknown>)?.[field.replace("contact.", "")] ?? "");

      let match = false;
      switch (operator) {
        case "equals": match = actual === value; break;
        case "not_equals": match = actual !== value; break;
        case "contains": match = actual.includes(value); break;
        case "not_contains": match = !actual.includes(value); break;
        case "exists": match = actual !== "" && actual !== "undefined" && actual !== "null"; break;
        case "gt": match = Number(actual) > Number(value); break;
        case "lt": match = Number(actual) < Number(value); break;
      }

      return match ? "true" : "false";
    }

    case "branch":
      // Branch just passes through — all outgoing edges are followed
      return "branched";

    default:
      return `unknown node type: ${node.type}`;
  }
}
