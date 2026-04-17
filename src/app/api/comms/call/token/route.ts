import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { generateWebRTCToken } from "@/lib/telnyx/client";

/**
 * GET /api/comms/call/token
 * Returns a short-lived WebRTC token for browser-based calling.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  // Get org's connection ID (or use kove's default)
  const { data: org } = await supabase
    .from("organizations").select("telnyx_connection_id, telnyx_phone")
    .eq("id", koveUser.org_id).single();

  const connectionId = org?.telnyx_connection_id || process.env.TELNYX_CONNECTION_ID;
  if (!connectionId) {
    return NextResponse.json({ error: "No Telnyx connection configured" }, { status: 400 });
  }

  try {
    const token = await generateWebRTCToken(connectionId);
    return NextResponse.json({
      token,
      callerNumber: org?.telnyx_phone ?? null,
    });
  } catch (err) {
    console.error("WebRTC token error:", err);
    return NextResponse.json({ error: "Failed to generate call token" }, { status: 500 });
  }
}
