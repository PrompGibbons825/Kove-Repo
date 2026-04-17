import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/lib/types/database";

/**
 * GET /api/tasks — list tasks for current user/org
 * POST /api/tasks — create a new task
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const contactId = searchParams.get("contact_id");

  let query = supabase.from("tasks").select("*").order("due_at", { ascending: true });
  if (contactId) query = query.eq("contact_id", contactId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ tasks: data ?? [] });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", authUser.id).single() as { data: User | null; error: unknown };
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const body = await request.json();

  const { data, error } = await supabase.from("tasks").insert({
    org_id: koveUser.org_id,
    contact_id: body.contact_id ?? null,
    assigned_to: body.assigned_to ?? koveUser.id,
    type: body.type ?? "follow_up",
    title: body.title,
    description: body.description ?? null,
    due_at: body.due_at ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    ai_generated: body.ai_generated ?? false,
  }).select().single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
