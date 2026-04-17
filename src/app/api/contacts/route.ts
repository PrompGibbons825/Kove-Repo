import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateEmbedding, buildContactEmbeddingText } from "@/lib/ai/embeddings";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase.from("users").select("*").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // RLS will handle permission scoping at the DB level
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("org_id", koveUser.org_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contacts: contacts ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase.from("users").select("*").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Check create permission
  if (!koveUser.is_owner && !koveUser.computed_permissions?.create_contacts) {
    return NextResponse.json({ error: "No permission to create contacts" }, { status: 403 });
  }

  const body = await request.json();
  const { name, phone, email, source, status, pipeline_stage, custom_fields } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }

  const { data: contact, error } = await supabase
    .from("contacts")
    .insert({
      org_id: koveUser.org_id,
      assigned_to: [user.id],
      name: name.trim(),
      phone: phone?.trim() || null,
      email: email?.trim() || null,
      source: source?.trim() || null,
      status: status || "new",
      pipeline_stage: pipeline_stage || null,
      custom_fields: custom_fields || {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate and store embedding asynchronously (don't block the response)
  if (contact) {
    const embeddingText = buildContactEmbeddingText(contact);
    generateEmbedding(embeddingText)
      .then(async (embedding) => {
        const supabaseService = await createClient();
        await supabaseService
          .from("contacts")
          .update({ embedding_text: embeddingText, embedding })
          .eq("id", contact.id);
      })
      .catch((err) => console.error("Embedding generation failed:", err));
  }

  return NextResponse.json({ contact }, { status: 201 });
}
