import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/ai/live-coach
 * Streams real-time AI coaching suggestions during a call.
 * Receives transcript batches and returns SSE stream from Claude.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { transcript, contactContext, previousSuggestions } = await request.json();

  if (!transcript) {
    return NextResponse.json({ error: "No transcript provided" }, { status: 400 });
  }

  const systemPrompt = `You are an AI sales coach providing real-time suggestions during a live call.
You will receive a live transcript and context about the contact.
Provide brief, actionable suggestions the sales rep can use RIGHT NOW.

Rules:
- Keep suggestions under 2 sentences each
- Be specific, not generic
- Identify buying signals, objections, and opportunities
- Suggest relevant questions to ask
- Note qualification criteria being met
- If the customer seems ready, suggest closing language

Respond with JSON: {
  "suggestions": ["suggestion 1", "suggestion 2"],
  "qualificationMet": ["criteria that appear satisfied"],
  "sentiment": "positive" | "neutral" | "negative",
  "nextAction": "what to do next in the conversation"
}`;

  const userMessage = `Contact Context:
${contactContext ?? "No context available"}

Previous Suggestions Given:
${previousSuggestions ?? "None"}

Live Transcript (latest):
${transcript}

Provide coaching suggestions based on what's happening in this call right now.`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 500,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
        stream: true,
      }),
    });

    if (!response.ok || !response.body) {
      const err = await response.text();
      console.error("Claude streaming error:", err);
      return NextResponse.json({ error: "AI coaching failed" }, { status: 500 });
    }

    // Forward the SSE stream
    return new Response(response.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (err) {
    console.error("Live coach error:", err);
    return NextResponse.json({ error: "AI coaching failed" }, { status: 500 });
  }
}
