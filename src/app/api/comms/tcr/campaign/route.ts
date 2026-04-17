import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TELNYX_API = "https://api.telnyx.com/v2";

/**
 * POST /api/comms/tcr/campaign
 * Submits a campaign registration to Telnyx TCR and links it to the org's messaging profile.
 * Body: {
 *   usecase, description, messageFlow, sample1, sample2,
 *   subscriberOptin?, subscriberOptout?, subscriberHelp?,
 *   embeddedLink?, embeddedPhone?, affiliateMarketing?, ageGated?
 * }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase.from("users").select("org_id").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: org } = await supabase
    .from("organizations")
    .select("tcr_brand_id, telnyx_messaging_profile_id")
    .eq("id", koveUser.org_id)
    .single();

  if (!org?.tcr_brand_id) {
    return NextResponse.json({ error: "Brand registration must be completed first" }, { status: 400 });
  }

  const body = await request.json();
  const {
    usecase, description, messageFlow, sample1, sample2,
    subscriberOptin = true, subscriberOptout = true, subscriberHelp = true,
    embeddedLink = false, embeddedPhone = false,
    affiliateMarketing = false, ageGated = false,
  } = body;

  if (!usecase || !description || !messageFlow || !sample1 || !sample2) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const payload: Record<string, unknown> = {
    brandId: org.tcr_brand_id,
    usecase,
    description,
    messageFlow,
    sample1,
    sample2,
    subscriberOptin,
    subscriberOptout,
    subscriberHelp,
    embeddedLink,
    embeddedPhone,
    affiliateMarketing,
    ageGated,
    termsAndConditions: true,
    numberPool: false,
    directLending: false,
  };

  const res = await fetch(`${TELNYX_API}/messaging_campaigns`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
    },
    body: JSON.stringify(payload),
  });

  const json = await res.json();

  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail ?? json?.message ?? "Telnyx campaign registration failed";
    return NextResponse.json({ error: detail, telnyx: json }, { status: res.status });
  }

  const campaignId: string = json?.data?.campaignId ?? json?.data?.id;
  const campaignStatus: string = json?.data?.status ?? "PENDING";

  // Persist to org
  await supabase
    .from("organizations")
    .update({ tcr_campaign_id: campaignId, tcr_campaign_status: campaignStatus })
    .eq("id", koveUser.org_id);

  // If we have a messaging profile, link the campaign to it
  if (org.telnyx_messaging_profile_id && campaignId) {
    try {
      await fetch(`${TELNYX_API}/messaging_campaigns/${campaignId}/messaging_profile_links`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
        },
        body: JSON.stringify({ messaging_profile_id: org.telnyx_messaging_profile_id }),
      });
    } catch {
      // Non-fatal — campaign is registered, profile link can be retried
    }
  }

  return NextResponse.json({ campaign_id: campaignId, campaign_status: campaignStatus, telnyx: json });
}
