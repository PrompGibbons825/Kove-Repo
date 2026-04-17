import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TELNYX_API = "https://api.telnyx.com/v2";

async function getOrgAndUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Unauthorized", status: 401 };
  const { data: koveUser } = await supabase.from("users").select("org_id").eq("id", user.id).single();
  if (!koveUser) return { error: "User not found", status: 404 };
  const { data: org } = await supabase
    .from("organizations")
    .select("id, telnyx_messaging_profile_id, tcr_brand_id, tcr_brand_status, tcr_campaign_id, tcr_campaign_status")
    .eq("id", koveUser.org_id)
    .single();
  return { supabase, user, org, orgId: koveUser.org_id };
}

/** GET /api/comms/tcr — return current brand + campaign registration status */
export async function GET() {
  const ctx = await getOrgAndUser();
  if ("error" in ctx) return NextResponse.json({ error: ctx.error }, { status: ctx.status });
  const { org } = ctx;
  return NextResponse.json({
    brand_id: org?.tcr_brand_id ?? null,
    brand_status: org?.tcr_brand_status ?? null,
    campaign_id: org?.tcr_campaign_id ?? null,
    campaign_status: org?.tcr_campaign_status ?? null,
  });
}
