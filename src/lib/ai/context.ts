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
  workflows?: Array<{ id: string; name: string; description: string | null; status: string }>
): string {
  const layers: string[] = [];

  // Layer 1 — Base identity
  layers.push(buildBasePrompt(user, org));

  // Layer 2 — Business context (scoped to permissions)
  layers.push(buildBusinessContext(org, permissions));

  // Layer 3 — Individual context (private)
  layers.push(buildIndividualContext(user));

  // Layer 4 — Current page context + vector-retrieved data
  layers.push(buildPageContext(pageContext, relevantContacts, relevantActivities, workflows));

  return layers.join("\n\n---\n\n");
}

function buildBasePrompt(user: User, org: Organization): string {
  return `You are the kove AI agent — a sales operating assistant for ${org.name}.
You are speaking with ${user.full_name} (${user.is_owner ? "Owner" : "Team Member"}).
Organization vertical: ${org.vertical}.

Behavior rules:
- Be direct. No filler. These are busy salespeople.
- When suggesting actions (create task, reassign lead, draft message), present them as confirmable actions.
- Never reveal information the user does not have permission to see.
- Never reference another user's private AI context.
- If asked about data outside the user's permission scope, say "I don't have access to that information for your role."`;
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
  workflows?: Array<{ id: string; name: string; description: string | null; status: string }>
): string {
  const sections: string[] = [`## Current Context\nUser is on: ${pageContext.page}`];

  if (pageContext.contactData) {
    sections.push(`Viewing contact: ${JSON.stringify(pageContext.contactData)}`);
  }

  if (pageContext.additionalContext) {
    sections.push(pageContext.additionalContext);
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

  return sections.join("\n\n");
}
