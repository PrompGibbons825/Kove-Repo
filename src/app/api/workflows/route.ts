import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase.from("users").select("org_id").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: workflows, error } = await supabase
    .from("workflows")
    .select("id, name, description, status")
    .eq("org_id", koveUser.org_id)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ workflows: workflows ?? [] });
}
