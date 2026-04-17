import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { searchNumbers, purchaseNumber, ensureConnection } from "@/lib/telnyx/client";

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
    .from("organizations").select("telnyx_phone").eq("id", koveUser.org_id).single();
  if (org?.telnyx_phone) {
    return NextResponse.json({ error: "Organization already has a phone number", phone: org.telnyx_phone }, { status: 400 });
  }

  const body = await request.json().catch(() => ({}));
  const areaCode = body.area_code;

  try {
    // Ensure connection exists (uses env var or auto-creates)
    const connectionId = await ensureConnection();

    // Patch webhook URL onto the connection to make sure it's current
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://kove-seven.vercel.app";
    await fetch(`https://api.telnyx.com/v2/credential_connections/${connectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.TELNYX_API_KEY}` },
      body: JSON.stringify({ webhook_event_url: `${appUrl}/api/comms/call/webhook` }),
    });

    // Search for available numbers
    const available = await searchNumbers(areaCode, 1);
    if (!available.length) {
      return NextResponse.json({ error: "No numbers available in this area code" }, { status: 404 });
    }

    const phoneNumber = available[0].phone_number;

    // Purchase the number
    await purchaseNumber(phoneNumber);

    // Save to org
    await supabase
      .from("organizations")
      .update({
        telnyx_phone: phoneNumber,
        telnyx_connection_id: connectionId,
      })
      .eq("id", koveUser.org_id);

    return NextResponse.json({ success: true, phone: phoneNumber });
  } catch (err) {
    console.error("Number provisioning error:", err);
    return NextResponse.json({ error: "Failed to provision phone number" }, { status: 500 });
  }
}
