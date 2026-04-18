// ============================================================
// kove AI Context Assembly
// Builds the 4-layer system prompt for every agent request
// ============================================================

import type { User, Organization, PermissionSet } from "@/lib/types/database";

interface PageContext {
  page: string;
  contactId?: string;
  contactData?: Record<string, unknown>;
  additionalContext?: string;
}

/**
 * Assemble the full system prompt for the AI agent.
 * Layers:
 *   1. Base identity + behavior guidelines
 *   2. Business context (filtered by user permissions)
 *   3. Individual context (private to this user)
 *   4. Current page context
 */
export function assembleSystemPrompt(
  user: User,
  org: Organization,
  permissions: PermissionSet,
  pageContext: PageContext,
  relevantContacts?: string[],
  relevantActivities?: string[],
  workflows?: Array<{ id: string; name: string; description: string | null; status: string }>,
  tasks?: Array<{ id: string; type: string; title: string | null; status: string; due_at: string | null; contact_id: string | null; assigned_to: string | null; notes: string | null }>
): string {
  const layers: string[] = [];

  // Layer 1 — Base identity
  layers.push(buildBasePrompt(user, org, permissions));

  // Layer 2 — Business context (scoped to permissions)
  layers.push(buildBusinessContext(org, permissions));

  // Layer 3 — Individual context (private)
  layers.push(buildIndividualContext(user));

  // Layer 4 — Current page context + vector-retrieved data
  layers.push(buildPageContext(pageContext, relevantContacts, relevantActivities, workflows, tasks));

  return layers.join("\n\n---\n\n");
}

function buildBasePrompt(user: User, org: Organization, permissions: PermissionSet): string {
  const canDo: string[] = [];
  if (permissions.edit_contacts) canDo.push("edit contacts");
  if (permissions.create_contacts) canDo.push("create contacts");
  if (permissions.delete_contacts) canDo.push("delete contacts");
  if (permissions.assign_contacts) canDo.push("assign contacts");
  if (permissions.create_workflows) canDo.push("create/modify workflows");
  if (permissions.view_all_contacts) canDo.push("view all contacts (not just assigned)");
  if (permissions.view_all_activities) canDo.push("view all activities");
  if (permissions.view_team_analytics) canDo.push("view team analytics");
  if (permissions.manage_users) canDo.push("manage team members");
  if (permissions.configure_commissions) canDo.push("configure commission rules");
  if (permissions.access_billing) canDo.push("access billing");

  return `You are the kove AI agent — a sales operating assistant for ${org.name}.
You are speaking with ${user.full_name} (${user.is_owner ? "Owner" : "Team Member"}).
Organization vertical: ${org.vertical}.

This user's permissions allow them to: ${canDo.length > 0 ? canDo.join(", ") : "view their own contacts and activities only"}.

Behavior rules:
- Be direct. No filler. These are busy salespeople.
- When suggesting actions (create task, reassign lead, draft message), present them as confirmable actions.
- Never reveal information the user does not have permission to see.
- Never reference another user's private AI context.
- If asked about data outside the user's permission scope, say "I don't have access to that information for your role."
- You have full read access to all data listed in context below. You can discuss, analyze, and act on it.`;
}

function buildBusinessContext(org: Organization, permissions: PermissionSet): string {
  const ctx = org.business_context as Record<string, unknown>;
  const sections: string[] = ["## Business Context"];

  // Always include basic org info
  sections.push(`Organization: ${org.name} | Vertical: ${org.vertical}`);

  // Commission rules visible if user can view team commissions or configure them
  if (permissions.view_team_commissions || permissions.configure_commissions) {
    const rules = org.commission_rules;
    if (rules && Object.keys(rules as object).length > 0) {
      sections.push(`Commission Rules: ${JSON.stringify(rules)}`);
    }
  }

  // Team analytics context
  if (permissions.ai_team_context && ctx.team_performance) {
    sections.push(`Team Performance: ${JSON.stringify(ctx.team_performance)}`);
  }

  // Full business analytics
  if (permissions.ai_business_context) {
    if (ctx.revenue) sections.push(`Revenue Data: ${JSON.stringify(ctx.revenue)}`);
    if (ctx.pipeline_health) sections.push(`Pipeline Health: ${JSON.stringify(ctx.pipeline_health)}`);
    if (ctx.strategic_insights) sections.push(`Strategic Insights: ${JSON.stringify(ctx.strategic_insights)}`);
  }

  return sections.join("\n");
}

function buildIndividualContext(user: User): string {
  const ctx = user.individual_context as Record<string, unknown>;
  if (!ctx || Object.keys(ctx).length === 0) {
    return "## Individual Context\nNo personalized context built yet. Will learn from usage.";
  }

  const sections: string[] = ["## Individual Context (Private)"];

  if (ctx.workflow_patterns) sections.push(`Work patterns: ${JSON.stringify(ctx.workflow_patterns)}`);
  if (ctx.communication_style) sections.push(`Communication style: ${JSON.stringify(ctx.communication_style)}`);
  if (ctx.performance_signals) sections.push(`Performance signals: ${JSON.stringify(ctx.performance_signals)}`);
  if (ctx.current_focus) sections.push(`Current focus: ${JSON.stringify(ctx.current_focus)}`);

  return sections.join("\n");
}

function buildPageContext(
  pageContext: PageContext,
  relevantContacts?: string[],
  relevantActivities?: string[],
  workflows?: Array<{ id: string; name: string; description: string | null; status: string }>,
  tasks?: Array<{ id: string; type: string; title: string | null; status: string; due_at: string | null; contact_id: string | null; assigned_to: string | null; notes: string | null }>
): string {
  const sections: string[] = [`## Current Context\nUser is on: ${pageContext.page}`];

  if (pageContext.contactData) {
    sections.push(`Viewing contact: ${JSON.stringify(pageContext.contactData)}`);
  }

  if (pageContext.additionalContext) {
    sections.push(pageContext.additionalContext);

    // If we're in workflow builder mode, inject the node catalog + command instructions
    if (pageContext.additionalContext.startsWith("WORKFLOW BUILDER MODE")) {
      sections.push(`## Workflow Node Catalog
Available node types you can add to the canvas:

TRIGGERS (start the workflow):
- landing-page | "Landing Page" — fires when a lead submits the landing page
- form-submit | "Form Submission" — fires on any form submit
- new-contact | "New Contact" — fires when a contact is created
- inbound-call | "Inbound Call" — fires on incoming call
- schedule | "Schedule" — fires on a recurring schedule

ACTIONS (do something):
- send-email | "Send Email" — send an email to the contact
- send-sms | "Send SMS" — send a text message
- assign-task | "Create Task" — create a follow-up task
- notify-team | "Notify Team" — alert the team

LOGIC (control flow):
- delay | "Delay" — wait N minutes/hours/days
- condition | "If / Else" — branch based on conditions
- branch | "Split Path" — run multiple paths in parallel

## How to build/modify the workflow
When the user asks you to build or modify a workflow, respond with:
1. A short plain-English explanation of what you're building
2. A fenced \`\`\`json code block containing an ARRAY of command objects

Command shapes:
  { "action": "add_node", "type": "<node-type>", "label": "<display label>", "x": <number>, "y": <number> }
  { "action": "add_edge", "from": "<node-id-prefix>", "to": "<node-id-prefix>" }

Use the 8-char node id prefixes shown in the canvas state when referencing existing nodes.
Place nodes in a logical left-to-right or top-to-bottom flow, spacing ~220px apart horizontally, 120px vertically.
Always start with a trigger node if the canvas is empty.

Example response format:
I'll build a lead-capture follow-up workflow.
\`\`\`json
[
  { "action": "add_node", "type": "landing-page", "label": "Landing Page", "x": 80, "y": 200 },
  { "action": "add_node", "type": "send-email", "label": "Welcome Email", "x": 320, "y": 200 },
  { "action": "add_node", "type": "delay", "label": "Wait 1 Day", "x": 560, "y": 200 },
  { "action": "add_node", "type": "send-sms", "label": "Follow-up SMS", "x": 800, "y": 200 }
]
\`\`\`
The nodes are placed on the canvas — connect them by clicking the output port on the right of each node to the input port on the left of the next.

## Landing Page HTML Generation
When a LANDING PAGE CONTEXT section appears in this prompt, you have access to the landing page for this workflow and can generate or edit its HTML.
To create or update the landing page, output a fenced \`\`\`html code block containing the FULL HTML page.

RULES for landing page HTML:
1. Output the complete HTML starting with <!DOCTYPE html> inside the \`\`\`html block.
2. The page must be fully self-contained: inline all CSS in a <style> tag. No external stylesheets (except Google Fonts if needed).
3. The page must be mobile-responsive.
4. Include a form with at minimum: name, email fields.
5. The form must use JavaScript fetch() to POST JSON data to the submission endpoint: https://site.trykove.app/api/lp/{slug}
6. Use brand assets (logos, colors) from the context to match branding.
7. Design should be modern, clean, conversion-focused — large headline, clear value proposition, prominent CTA.
8. When editing, return the FULL updated HTML (not a diff).
9. Include a brief explanation of what you built/changed OUTSIDE the html block — this text will be shown to the user in chat.

Example:
Here's your landing page with a modern dark theme and your logo.
\`\`\`html
<!DOCTYPE html>
<html>...</html>
\`\`\`

You can combine workflow commands (\`\`\`json) and landing page HTML (\`\`\`html) in the same response.
If the LANDING PAGE CONTEXT section is NOT present, the user does not have the landing page panel open — do NOT output HTML blocks.`);
    }
  }

  if (relevantContacts && relevantContacts.length > 0) {
    sections.push(`## Relevant Contacts (via vector search)\n${relevantContacts.join("\n")}`);
  }

  if (relevantActivities && relevantActivities.length > 0) {
    sections.push(`## Relevant Activities (via vector search)\n${relevantActivities.join("\n")}`);
  }

  if (workflows && workflows.length > 0) {
    const wfList = workflows.map((w) => `- ${w.name} [${w.status}]${w.description ? `: ${w.description}` : ""} (id: ${w.id})`).join("\n");
    sections.push(`## Available Workflows\n${wfList}`);
  }

  if (tasks && tasks.length > 0) {
    const taskList = tasks.map((t) => {
      const due = t.due_at ? new Date(t.due_at).toLocaleDateString() : "no due date";
      return `- [${t.status}] ${t.title ?? t.type} (due: ${due})${t.notes ? ` | ${t.notes}` : ""}`;
    }).join("\n");
    sections.push(`## Tasks\n${taskList}`);
  }

  return sections.join("\n\n");
}
