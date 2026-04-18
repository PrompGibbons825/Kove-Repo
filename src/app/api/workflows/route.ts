import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

async function getOrgUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("id, org_id").eq("id", user.id).single();
  return data ?? null;
}

// GET /api/workflows — list all workflows for the org
export async function GET() {
  const supabase = await createClient();
  const koveUser = await getOrgUser(supabase);
  if (!koveUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("workflows")
    .select("id, name, status, nodes, edges, created_at, updated_at")
    .eq("org_id", koveUser.org_id)
    .order("updated_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workflows: data ?? [] });
}

// POST /api/workflows — create a new workflow
export async function POST(req: Request) {
  const supabase = await createClient();
  const koveUser = await getOrgUser(supabase);
  if (!koveUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { name, nodes = [], edges = [], status = "draft" } = body;
  if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("workflows")
    .insert({
      org_id: koveUser.org_id,
      created_by: koveUser.id,
      name: name.trim(),
      nodes,
      edges,
      status,
    })
    .select("id, name, status, nodes, edges, created_at, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workflow: data }, { status: 201 });
}

// PATCH /api/workflows — update name, nodes, edges, or status
export async function PATCH(req: Request) {
  const supabase = await createClient();
  const koveUser = await getOrgUser(supabase);
  if (!koveUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Only allow safe fields to be updated
  const allowed = ["name", "nodes", "edges", "status"];
  const patch: Record<string, unknown> = {};
  for (const key of allowed) {
    if (key in updates) patch[key] = updates[key];
  }

  const { data, error } = await supabase
    .from("workflows")
    .update(patch)
    .eq("id", id)
    .eq("org_id", koveUser.org_id) // RLS + explicit org check
    .select("id, name, status, nodes, edges, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workflow: data });
}

// DELETE /api/workflows — delete a workflow
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const koveUser = await getOrgUser(supabase);
  if (!koveUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase
    .from("workflows")
    .delete()
    .eq("id", id)
    .eq("org_id", koveUser.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

