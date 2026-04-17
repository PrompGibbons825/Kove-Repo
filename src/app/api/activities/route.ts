import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateEmbedding } from "@/lib/ai/embeddings";
import type { User } from "@/lib/types/database";

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contact_id");

  let query = supabase.from("activities").select("*").order("occurred_at", { ascending: false });
  if (contactId) query = query.eq("contact_id", contactId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activities: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", authUser.id).single() as { data: User | null; error: unknown };
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();

  const { data, error } = await supabase.from("activities").insert({
    contact_id: body.contact_id,
    user_id: koveUser.id,
    org_id: koveUser.org_id,
    type: body.type ?? "note",
    content: body.content ?? null,
    ai_summary: null,
    action_items: body.action_items ?? [],
    occurred_at: body.occurred_at ?? new Date().toISOString(),
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate embedding asynchronously so it shows up in future vector searches
  if (data) {
    const embeddingText = [body.type, body.content].filter(Boolean).join(": ");
    generateEmbedding(embeddingText)
      .then(async (embedding) => {
        const sb = await createClient();
        await sb.from("activities").update({ embedding_text: embeddingText, embedding }).eq("id", data.id);
      })
      .catch((err) => console.error("Activity embedding failed:", err));
  }

  return NextResponse.json(data);
}
