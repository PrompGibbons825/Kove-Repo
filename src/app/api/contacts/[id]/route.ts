import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateEmbedding, buildContactEmbeddingText } from "@/lib/ai/embeddings";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: contact, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !contact) return NextResponse.json({ error: "Contact not found" }, { status: 404 });
  return NextResponse.json({ contact });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase.from("users").select("*").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!koveUser.is_owner && !koveUser.computed_permissions?.edit_contacts) {
    return NextResponse.json({ error: "No permission to edit contacts" }, { status: 403 });
  }

  const body = await request.json();
  const { data: contact, error } = await supabase
    .from("contacts")
    .update(body)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Regenerate embedding when contact data changes
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
      .catch((err) => console.error("Embedding regeneration failed:", err));
  }

  return NextResponse.json({ contact });
}

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase.from("users").select("*").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!koveUser.is_owner && !koveUser.computed_permissions?.delete_contacts) {
    return NextResponse.json({ error: "No permission to delete contacts" }, { status: 403 });
  }

  const { error } = await supabase.from("contacts").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
