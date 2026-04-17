import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/lib/types/database";
import { hasPermission } from "@/lib/permissions";

export async function GET() {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", authUser.id).single() as { data: User | null; error: unknown };
  if (!koveUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: org } = await supabase
    .from("organizations").select("*").eq("id", koveUser.org_id).single();
  if (!org) return NextResponse.json({ error: "Org not found" }, { status: 404 });

  return NextResponse.json({
    source_options: org.source_options ?? [],
    pipeline_options: org.pipeline_options ?? [],
    custom_field_schema: org.custom_field_schema ?? [],
    telnyx_phone: org.telnyx_phone ?? null,
    smtp_config: org.smtp_config ?? {},
    tcr_brand_id: org.tcr_brand_id ?? null,
    tcr_brand_status: org.tcr_brand_status ?? null,
    tcr_campaign_id: org.tcr_campaign_id ?? null,
    tcr_campaign_status: org.tcr_campaign_status ?? null,
  });
}

export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", authUser.id).single() as { data: User | null; error: unknown };
  if (!koveUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Owner or manage_users permission required
  if (!koveUser.is_owner && !hasPermission(koveUser, "manage_users")) {
    return NextResponse.json({ error: "Permission denied" }, { status: 403 });
  }

  const body = await request.json();
  const update: Record<string, unknown> = {};

  if (body.source_options !== undefined) update.source_options = body.source_options;
  if (body.pipeline_options !== undefined) update.pipeline_options = body.pipeline_options;
  if (body.custom_field_schema !== undefined) update.custom_field_schema = body.custom_field_schema;
  if (body.smtp_config !== undefined) update.smtp_config = body.smtp_config;

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { error } = await supabase
    .from("organizations").update(update).eq("id", koveUser.org_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
