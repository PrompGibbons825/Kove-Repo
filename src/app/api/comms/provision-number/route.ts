import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { searchNumbers, purchaseNumber, ensureConnection, ensureMessagingProfile } from "@/lib/telnyx/client";

/**
 * POST /api/comms/provision-number
 * Provisions a Telnyx phone number for the org.
 * Body: { area_code?: string }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!koveUser.is_owner) {
    return NextResponse.json({ error: "Only org owners can provision numbers" }, { status: 403 });
  }

  // Check if org already has a number
  const { data: org } = await supabase
    .from("organizations").select("telnyx_phone, telnyx_messaging_profile_id").eq("id", koveUser.org_id).single();
  if (org?.telnyx_phone) {
    return NextResponse.json({ error: "Organization already has a phone number", phone: org.telnyx_phone }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const areaCode = body.area_code;

  try {
    // Ensure credential connection exists for voice/WebRTC
    const connectionId = await ensureConnection();

    // Ensure messaging profile exists for SMS (separate from voice connection)
    const messagingProfileId = await ensureMessagingProfile(org?.telnyx_messaging_profile_id);

    // Search for available numbers
    const available = await searchNumbers(areaCode, 1);
    if (!available.length) {
      return NextResponse.json({ error: "No numbers available in this area code" }, { status: 404 });
    }

    const phoneNumber = available[0].phone_number;

    // Purchase the number — assign both voice connection and SMS messaging profile
    await purchaseNumber(phoneNumber, connectionId, messagingProfileId);

    // Save to org
    await supabase
      .from("organizations")
      .update({
        telnyx_phone: phoneNumber,
        telnyx_connection_id: connectionId,
        telnyx_messaging_profile_id: messagingProfileId,
      })
      .eq("id", koveUser.org_id);

    return NextResponse.json({ success: true, phone: phoneNumber });
  } catch (err) {
    console.error("Number provisioning error:", err);
    return NextResponse.json({ error: "Failed to provision phone number" }, { status: 500 });
  }
}
