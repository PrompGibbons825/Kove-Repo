import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ensureTelephonyCredential, generateWebRTCToken } from "@/lib/telnyx/client";

/**
 * GET /api/comms/call/token
 * Returns a short-lived WebRTC token for browser-based calling.
 * Creates a telephony credential for the user on first call, then reuses it.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get org's connection ID and phone
  const { data: org } = await supabase
    .from("organizations").select("telnyx_connection_id, telnyx_phone")
    .eq("id", koveUser.org_id).single();

  const connectionId = org?.telnyx_connection_id || process.env.TELNYX_CONNECTION_ID;
  if (!connectionId) {
    return NextResponse.json({ error: "No Telnyx connection configured" }, { status: 400 });
  }

  try {
    // Ensure a telephony credential exists for this user (creates once, reuses after)
    const credentialId = await ensureTelephonyCredential(
      connectionId,
      koveUser.id,
      koveUser.telnyx_credential_id
    );

    // Persist the credential ID if it was just created
    if (!koveUser.telnyx_credential_id) {
      await supabase
        .from("users")
        .update({ telnyx_credential_id: credentialId })
        .eq("id", koveUser.id);
    }

    const token = await generateWebRTCToken(credentialId);
    return NextResponse.json({
      token,
      callerNumber: org?.telnyx_phone ?? null,
    });
  } catch (err) {
    console.error("WebRTC token error:", err);
    return NextResponse.json({ error: "Failed to generate call token" }, { status: 500 });
  }
}
