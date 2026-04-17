import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TELNYX_API = "https://api.telnyx.com/v2";

function toE164(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

/**
 * GET /api/debug/sms-test?to=+1XXXXXXXXXX
 * Sends a real test SMS and returns the full Telnyx API response.
 * Also dumps the full org config so you can see exactly what's being used.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized — must be logged in" }, { status: 401 });

  const { data: koveUser } = await supabase.from("users").select("org_id").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: org } = await supabase
    .from("organizations")
    .select("telnyx_phone, telnyx_messaging_profile_id, telnyx_connection_id")
    .eq("id", koveUser.org_id)
    .single();

  const { searchParams } = new URL(request.url);
  const toRaw = searchParams.get("to");

  const config = {
    api_key_present: !!process.env.TELNYX_API_KEY,
    api_key_prefix: process.env.TELNYX_API_KEY?.slice(0, 12) + "...",
    org_phone_raw: org?.telnyx_phone ?? null,
    org_phone_e164: org?.telnyx_phone ? toE164(org.telnyx_phone) : null,
    messaging_profile_id: org?.telnyx_messaging_profile_id ?? null,
    connection_id: org?.telnyx_connection_id ?? null,
  };

  if (!toRaw) {
    return NextResponse.json({
      config,
      instructions: "Add ?to=+1XXXXXXXXXX to send a test SMS to that number",
    });
  }

  if (!org?.telnyx_phone) {
    return NextResponse.json({ config, error: "No telnyx_phone in org record" }, { status: 400 });
  }

  const from = toE164(org.telnyx_phone);
  const to = toE164(toRaw);

  const body: Record<string, string> = {
    from,
    to,
    text: "Kove test message — if you see this, SMS delivery is working!",
    type: "SMS",
  };
  if (org.telnyx_messaging_profile_id) {
    body.messaging_profile_id = org.telnyx_messaging_profile_id;
  }

  const res = await fetch(`${TELNYX_API}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json();

  return NextResponse.json({
    config,
    request_body: body,
    telnyx_http_status: res.status,
    telnyx_response: json,
  });
}
