import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getEffectivePermissions } from "@/lib/permissions";
import { assembleSystemPrompt } from "@/lib/ai/context";
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
      .single();

    if (!koveUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { data: org } = await supabase
      .from("organizations")
      .select("*")
      .eq("id", koveUser.org_id)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Org not found" }, { status: 404 });
    }

    const { message, conversationHistory, pageContext } = await request.json();

    const permissions = getEffectivePermissions(koveUser as User);
    const systemPrompt = assembleSystemPrompt(
      koveUser as User,
      org as Organization,
      permissions,
      pageContext ?? { page: "unknown" }
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
          model: "claude-sonnet-4-20250514",
          max_tokens: 1024,
          system: systemPrompt,
          messages: [
            ...(conversationHistory ?? []),
            { role: "user", content: message },
          ],
        }),
      }
    );

    const data = await anthropicResponse.json();

    return NextResponse.json({
      response:
        data.content?.[0]?.text ?? "I couldn't process that. Try again.",
    });
  } catch (error) {
    console.error("Agent error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
