import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { generateEmbedding, buildContactEmbeddingText } from "@/lib/ai/embeddings";
import type { User, Contact } from "@/lib/types/database";

/**
 * POST /api/ai/call-summary
 * After a call ends, generates an AI summary from the transcript,
 * logs the call activity, updates the contact's AI summary and status,
 * and regenerates the contact's embedding.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", authUser.id).single() as { data: User | null; error: unknown };
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { contactId, transcript, duration, direction } = await request.json();
  if (!contactId || !transcript) {
    return NextResponse.json({ error: "contactId and transcript required" }, { status: 400 });
  }

  // Get contact for context
  const { data: contact } = await supabase
    .from("contacts").select("*").eq("id", contactId).single() as { data: Contact | null; error: unknown };

  try {
    // Generate call summary via Claude
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1000,
        system: `You are a sales CRM assistant. Analyze this call transcript and provide a structured summary.
Respond with JSON only:
{
  "summary": "2-3 sentence call summary",
  "key_points": ["point 1", "point 2"],
  "action_items": ["action 1", "action 2"],
  "customer_sentiment": "positive" | "neutral" | "negative",
  "qualification_signals": ["signal 1"],
  "suggested_next_status": "new" | "qualifying" | "qualified" | "closing" | "won" | "lost" | "renewal" | null,
  "contact_summary_update": "Updated overall summary incorporating this call's findings"
}`,
        messages: [{
          role: "user",
          content: `Contact: ${contact?.name ?? "Unknown"} (Status: ${contact?.status ?? "new"})
Existing summary: ${contact?.ai_summary ?? "None"}

Call transcript:
${transcript}

Analyze this call and provide the structured summary.`,
        }],
      }),
    });

    if (!response.ok) {
      console.error("Claude summary error:", await response.text());
      throw new Error("AI summary generation failed");
    }

    const aiData = await response.json();
    const rawText = aiData.content?.[0]?.text ?? "{}";
    // Parse JSON from Claude response (may be wrapped in markdown)
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    const summaryData = JSON.parse(jsonMatch?.[0] ?? "{}");

    // 1. Insert call activity with transcript and summary
    const { data: activity } = await supabase.from("activities").insert({
      contact_id: contactId,
      user_id: koveUser.id,
      org_id: koveUser.org_id,
      type: "call",
      content: summaryData.summary ?? "Call completed",
      ai_summary: summaryData.summary,
      action_items: summaryData.action_items ?? [],
      direction: direction ?? "outbound",
      duration_seconds: duration ?? null,
      transcript,
      metadata: {
        key_points: summaryData.key_points,
        customer_sentiment: summaryData.customer_sentiment,
        qualification_signals: summaryData.qualification_signals,
        status: "completed",
      },
      occurred_at: new Date().toISOString(),
    }).select().single();

    // 2. Update contact AI summary and optionally status
    const contactUpdate: Record<string, unknown> = {
      ai_summary: summaryData.contact_summary_update ?? summaryData.summary,
      last_contacted_at: new Date().toISOString(),
    };
    if (summaryData.suggested_next_status && contact?.status !== summaryData.suggested_next_status) {
      contactUpdate.status = summaryData.suggested_next_status;
    }
    await supabase.from("contacts").update(contactUpdate).eq("id", contactId);

    // 3. Regenerate contact embedding with updated summary
    const svc = createServiceClient();
    const updatedContact = { ...contact, ...contactUpdate } as Contact;
    const embeddingText = buildContactEmbeddingText({
      ...updatedContact,
      custom_fields: (updatedContact.custom_fields as Record<string, unknown>) ?? undefined,
    });
    generateEmbedding(embeddingText)
      .then(async (embedding) => {
        await svc.from("contacts").update({ embedding_text: embeddingText, embedding }).eq("id", contactId);
      })
      .catch((err) => console.error("Contact embedding update failed:", err));

    // 4. Generate activity embedding
    if (activity) {
      const actEmbedText = `Call: ${summaryData.summary}. ${summaryData.key_points?.join(". ") ?? ""}`;
      generateEmbedding(actEmbedText)
        .then(async (embedding) => {
          await svc.from("activities").update({ embedding_text: actEmbedText, embedding }).eq("id", activity.id);
        })
        .catch((err) => console.error("Activity embedding failed:", err));
    }

    return NextResponse.json({
      activity,
      summary: summaryData,
      statusUpdated: !!contactUpdate.status,
    });
  } catch (err) {
    console.error("Call summary error:", err);
    // Fallback: still log the call even if AI fails
    const { data: activity } = await supabase.from("activities").insert({
      contact_id: contactId,
      user_id: koveUser.id,
      org_id: koveUser.org_id,
      type: "call",
      content: "Call completed",
      direction: direction ?? "outbound",
      duration_seconds: duration ?? null,
      transcript,
      metadata: { status: "completed" },
      occurred_at: new Date().toISOString(),
    }).select().single();

    return NextResponse.json({ activity, summary: null, error: "AI summary failed" });
  }
}
