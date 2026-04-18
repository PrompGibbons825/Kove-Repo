import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/permissions";
import { assembleSystemPrompt } from "@/lib/ai/context";
import { generateEmbedding } from "@/lib/ai/embeddings";
import type { User, Organization } from "@/lib/types/database";

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: koveUser } = await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single() as { data: User | null; error: unknown };

    if (!koveUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", koveUser.org_id)
      .single() as { data: Organization | null; error: unknown };

    if (!org) {
      return NextResponse.json({ error: "Org not found" }, { status: 404 });
    }

    const { message, conversationHistory, pageContext } = await request.json();

    const permissions = getEffectivePermissions(koveUser as User);

    // Fetch workflows so agent knows about them
    const { data: workflows } = await supabase
      .from("workflows")
      .select("id, name, description, status")
      .eq("org_id", koveUser.org_id);

    // Always fetch recent contacts to give Claude real data
    const contactQuery = supabase
      .from("contacts")
      .select("id, name, email, phone, source, status, pipeline_stage, workflow_id, ai_summary, last_contacted_at, created_at")
      .eq("org_id", koveUser.org_id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!permissions.view_all_contacts) {
      contactQuery.contains("assigned_to", [koveUser.id]);
    }

    const { data: allContacts } = await contactQuery;

    // Try vector search to find the most relevant subset — falls back to recency order
    let relevantContacts: string[] = [];
    let relevantActivities: string[] = [];
    const workflowMap = Object.fromEntries((workflows ?? []).map((w: { id: string; name: string }) => [w.id, w.name]));
    try {
      const queryEmbedding = await generateEmbedding(message);

      // Parallel vector search: contacts + activities
      const [matchedContacts, matchedActivities] = await Promise.all([
        supabase.rpc("match_contacts", {
          query_embedding: queryEmbedding,
          match_threshold: 0.3,
          match_count: 10,
          filter_org_id: koveUser.org_id,
        }),
        supabase.rpc("match_activities", {
          query_embedding: queryEmbedding,
          match_threshold: 0.5,
          match_count: 8,
          filter_org_id: koveUser.org_id,
        }),
      ]);

      if (matchedContacts.data && matchedContacts.data.length > 0) {
        relevantContacts = matchedContacts.data.map(
          (c: { name: string; status: string; ai_summary: string | null; embedding_text: string | null; similarity: number }) =>
            `- ${c.name} (${c.status})${c.ai_summary ? `: ${c.ai_summary}` : c.embedding_text ? `: ${c.embedding_text}` : ""} [match: ${(c.similarity * 100).toFixed(0)}%]`
        );
      }

      if (matchedActivities.data && matchedActivities.data.length > 0) {
        relevantActivities = matchedActivities.data.map(
          (a: { type: string; ai_summary: string | null; embedding_text: string | null; similarity: number }) =>
            `- [${a.type}] ${a.ai_summary ?? a.embedding_text ?? "(no summary)"} [match: ${(a.similarity * 100).toFixed(0)}%]`
        );
      }
    } catch (embErr) {
      console.warn("Vector search skipped:", embErr);
    }

    // Fallback: if vector search returned no contacts, use recent contacts by recency
    if (relevantContacts.length === 0 && allContacts && allContacts.length > 0) {
      const workflowMap = Object.fromEntries((workflows ?? []).map((w) => [w.id, w.name]));
      relevantContacts = allContacts.map(
        (c) =>
          `- ${c.name} (${c.status})` +
          (c.pipeline_stage ? ` | Stage: ${c.pipeline_stage}` : "") +
          (c.workflow_id && workflowMap[c.workflow_id] ? ` | Workflow: ${workflowMap[c.workflow_id]}` : "") +
          (c.source ? ` | Source: ${c.source}` : "") +
          (c.email ? ` | ${c.email}` : "") +
          (c.phone ? ` | ${c.phone}` : "") +
          (c.ai_summary ? ` | ${c.ai_summary}` : "")
      );
    }

    const systemPrompt = assembleSystemPrompt(
      koveUser as User,
      org as Organization,
      permissions,
      pageContext ?? { page: "unknown" },
      relevantContacts,
      relevantActivities,
      workflows ?? []
    );

    // Call Anthropic Claude
    const anthropicResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: systemPrompt,
          messages: [
            ...(conversationHistory ?? []),
            { role: "user", content: message },
          ],
        }),
      }
    );

    const data = await anthropicResponse.json();

    if (!anthropicResponse.ok || data.type === "error") {
      console.error("Anthropic API error:", JSON.stringify(data));
      return NextResponse.json(
        { response: `AI error: ${data.error?.message ?? "Unknown error"}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      response:
        data.content?.[0]?.text ?? "I couldn't process that. Try again.",
    });
  } catch (error) {
    console.error("Agent error:", error);
    return NextResponse.json(
      { response: `Server error: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
