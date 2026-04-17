import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const CONVERSATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour

/**
 * POST /api/ai/sms-summary
 * Batch-summarize SMS conversations into a single timeline note.
 * Called after sending/receiving an SMS. Checks if there's already a recent
 * conversation summary within the last hour — if so, updates it; otherwise
 * creates a new one after a delay.
 *
 * Body: { contactId: string, orgId: string, userId?: string }
 */
export async function POST(request: Request) {
  const { contactId, orgId, userId } = await request.json();
  if (!contactId || !orgId) {
    return NextResponse.json({ error: "contactId and orgId required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const windowStart = new Date(Date.now() - CONVERSATION_WINDOW_MS).toISOString();

  // 1. Get all SMS activities for this contact in the last hour
  const { data: recentSms } = await supabase
    .from("activities")
    .select("*")
    .eq("contact_id", contactId)
    .eq("type", "sms")
    .gte("occurred_at", windowStart)
    .order("occurred_at", { ascending: true });

  if (!recentSms || recentSms.length < 2) {
    // Not enough messages to summarize yet
    return NextResponse.json({ skipped: true, reason: "not enough messages" });
  }

  // 2. Check if there's already a conversation_summary note for this window
  const { data: existingSummaries } = await supabase
    .from("activities")
    .select("id, metadata")
    .eq("contact_id", contactId)
    .eq("type", "note")
    .gte("occurred_at", windowStart)
    .order("occurred_at", { ascending: false });

  const existingSummary = existingSummaries?.find(
    (a) => (a.metadata as Record<string, unknown>)?.is_conversation_summary === true
  );

  // 3. Get the user names for attributing messages
  const userIds = [...new Set(recentSms.filter((s) => s.user_id).map((s) => s.user_id))];
  const { data: users } = userIds.length > 0
    ? await supabase.from("users").select("id, full_name").in("id", userIds)
    : { data: [] };
  const userMap = new Map((users ?? []).map((u) => [u.id, u.full_name]));

  // 4. Get contact name
  const { data: contact } = await supabase
    .from("contacts")
    .select("name, phone")
    .eq("id", contactId)
    .single();

  // 5. Build the conversation transcript for the AI
  const transcript = recentSms.map((msg) => {
    const sender = msg.direction === "outbound"
      ? (msg.user_id ? (userMap.get(msg.user_id) ?? "Agent") : "Agent")
      : (contact?.name ?? "Contact");
    const time = new Date(msg.occurred_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    return `[${time}] ${sender}: ${msg.content}`;
  }).join("\n");

  // 6. Call Claude to summarize
  const prompt = `Summarize this SMS conversation between a sales rep and ${contact?.name ?? "a contact"}. 
Include: who initiated the conversation, key topics discussed, any action items or follow-ups mentioned, and the overall tone/outcome.
Keep it concise (2-4 sentences). Include the names of everyone who participated.

Conversation (last hour):
${transcript}`;

  let summary = "";
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 300,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!res.ok) {
      console.error("[sms-summary] Claude error:", res.status, await res.text());
      return NextResponse.json({ error: "AI summary failed" }, { status: 500 });
    }

    const data = await res.json();
    summary = data.content?.[0]?.text ?? "";
  } catch (err) {
    console.error("[sms-summary] failed:", err);
    return NextResponse.json({ error: "AI summary failed" }, { status: 500 });
  }

  if (!summary) {
    return NextResponse.json({ skipped: true, reason: "empty summary" });
  }

  const messageCount = recentSms.length;
  const participants = [...new Set([
    ...recentSms.filter((s) => s.user_id).map((s) => userMap.get(s.user_id) ?? "Agent"),
    contact?.name ?? "Contact",
  ])];

  const summaryContent = `💬 SMS Conversation (${messageCount} messages) — ${participants.join(", ")}\n\n${summary}`;

  // 7. Upsert: update existing summary or create new one
  if (existingSummary) {
    await supabase
      .from("activities")
      .update({
        content: summaryContent,
        ai_summary: summary,
        metadata: {
          is_conversation_summary: true,
          message_count: messageCount,
          participants,
          window_start: windowStart,
          updated_at: new Date().toISOString(),
        },
        occurred_at: new Date().toISOString(),
      })
      .eq("id", existingSummary.id);

    return NextResponse.json({ updated: true, id: existingSummary.id });
  } else {
    const { data: activity } = await supabase
      .from("activities")
      .insert({
        contact_id: contactId,
        user_id: userId ?? null,
        org_id: orgId,
        type: "note",
        content: summaryContent,
        ai_summary: summary,
        direction: null,
        metadata: {
          is_conversation_summary: true,
          message_count: messageCount,
          participants,
          window_start: windowStart,
        },
        occurred_at: new Date().toISOString(),
      })
      .select()
      .single();

    return NextResponse.json({ created: true, id: activity?.id });
  }
}
