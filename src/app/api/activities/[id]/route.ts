import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import type { User } from "@/lib/types/database";

/**
 * PATCH /api/activities/[id]
 * Edit the content of a note activity (only notes owned by current user).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", authUser.id).single() as { data: User | null; error: unknown };
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();
  const { content } = body;
  if (!content?.trim()) return NextResponse.json({ error: "content is required" }, { status: 400 });

  // Only allow editing notes owned by this user
  const { data: existing } = await supabase
    .from("activities")
    .select("id, type, user_id, org_id")
    .eq("id", id)
    .eq("org_id", koveUser.org_id)
    .single();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!(["note", "sms", "email"].includes(existing.type))) return NextResponse.json({ error: "Only notes, SMS, and email activities can be edited" }, { status: 400 });

  const { data, error } = await supabase
    .from("activities")
    .update({ content: content.trim() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ activity: data });
}

/**
 * DELETE /api/activities/[id]
 * Delete a note activity (only notes within the org).
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", authUser.id).single() as { data: User | null; error: unknown };
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Only allow deleting notes within org
  const { data: existing } = await supabase
    .from("activities")
    .select("id, type, org_id")
    .eq("id", id)
    .eq("org_id", koveUser.org_id)
    .single();

  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase.from("activities").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
