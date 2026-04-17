// ============================================================
// AI Auto-Member Assignment
// Analyzes activity content for qualifying signals and
// automatically adds relevant reps to a contact's assigned_to
// ============================================================

import { createClient } from "@/lib/supabase/server";

interface AssignmentContext {
  contactId: string;
  orgId: string;
  userId: string; // the rep who performed the activity
  activityType: string;
  content: string;
  transcript?: string;
}

/**
 * Analyze an interaction and decide whether the interacting rep
 * should be added to the contact's assigned_to list.
 *
 * Key signals:
 * - Rep qualified the contact (asked budget/timeline/authority/need)
 * - Sales conversation — rep is actively selling or closing
 * - Rep scheduled a follow-up or meeting
 * - Contact expressed strong interest or intent to buy
 */
export async function evaluateAndAssignMember(ctx: AssignmentContext) {
  try {
    const supabase = await createClient();

    // Get current contact
    const { data: contact } = await supabase
      .from("contacts")
      .select("assigned_to, status, name")
      .eq("id", ctx.contactId)
      .single();

    if (!contact) return;

    const currentAssigned: string[] = contact.assigned_to ?? [];

    // If user is already assigned, skip
    if (currentAssigned.includes(ctx.userId)) return;

    // Use Claude to evaluate if this interaction is a qualifying signal
    const textToAnalyze = ctx.transcript || ctx.content;
    if (!textToAnalyze || textToAnalyze.length < 20) return;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: `You are evaluating a CRM interaction to decide if the sales rep should be permanently assigned to this contact.

Activity type: ${ctx.activityType}
Contact: ${contact.name}
Contact status: ${contact.status}

Interaction content:
"""
${textToAnalyze.slice(0, 2000)}
"""

Should this rep be added as an assigned member of this contact? Answer YES only if:
- The rep has qualified the contact (asked about budget, timeline, decision-making, needs)
- This is a sales conversation where the rep is actively selling or closing
- The rep has built meaningful rapport beyond a cold intro
- The contact expressed buying intent to this specific rep

Answer with ONLY "YES" or "NO".`,
          },
        ],
      }),
    });

    if (!response.ok) return;

    const result = await response.json();
    const answer = result.content?.[0]?.text?.trim()?.toUpperCase();

    if (answer === "YES") {
      const newAssigned = [...currentAssigned, ctx.userId];
      await supabase
        .from("contacts")
        .update({ assigned_to: newAssigned })
        .eq("id", ctx.contactId);

      console.log(`[auto-assign] Added user ${ctx.userId} to contact ${ctx.contactId}`);
    }
  } catch (err) {
    console.error("[auto-assign] Failed:", err);
  }
}
