import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { ensureConnection, ensureMessagingProfile } from "@/lib/telnyx/client";

const TELNYX_API = "https://api.telnyx.com/v2";

function telnyxHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
  };
}

/**
 * POST /api/comms/import-number
 * Connects a phone number already in the user's Telnyx account to kove.
 * Assigns the kove credential connection (voice) and messaging profile (SMS)
 * to the number, then saves it to the org.
 *
 * Body: { phone_number: string }  e.g. "+14155551234"
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  if (!koveUser.is_owner) {
    return NextResponse.json(
      { error: "Only org owners can configure phone numbers" },
      { status: 403 }
    );
  }

  const { data: org } = await supabase
    .from("organizations")
    .select("telnyx_phone, telnyx_messaging_profile_id")
    .eq("id", koveUser.org_id)
    .single();

  if (org?.telnyx_phone) {
    return NextResponse.json(
      { error: "Organization already has a phone number", phone: org.telnyx_phone },
      { status: 400 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const phoneNumber: string | undefined = body.phone_number?.trim();

  if (!phoneNumber) {
    return NextResponse.json({ error: "phone_number is required" }, { status: 400 });
  }

  // Normalize to E.164 — prepend + if missing
  const e164 = phoneNumber.startsWith("+") ? phoneNumber : `+${phoneNumber}`;

  try {
    // Verify the number exists in this Telnyx account
    const listRes = await fetch(
      `${TELNYX_API}/phone_numbers?filter[phone_number]=${encodeURIComponent(e164)}`,
      { headers: telnyxHeaders() }
    );
    if (!listRes.ok) {
      throw new Error(`Telnyx lookup failed: ${listRes.statusText}`);
    }
    const listData = await listRes.json();
    const records: { id: string; phone_number: string }[] = listData.data ?? [];
    const match = records.find((r) => r.phone_number === e164);
    if (!match) {
      return NextResponse.json(
        { error: `Number ${e164} was not found in your Telnyx account. Make sure it is already purchased there.` },
        { status: 404 }
      );
    }

    // Ensure voice connection and SMS messaging profile exist
    const connectionId = await ensureConnection();
    const messagingProfileId = await ensureMessagingProfile(org?.telnyx_messaging_profile_id);

    // Assign the voice connection and messaging profile to the existing number
    const patchRes = await fetch(`${TELNYX_API}/phone_numbers/${match.id}`, {
      method: "PATCH",
      headers: telnyxHeaders(),
      body: JSON.stringify({
        connection_id: connectionId,
        messaging_profile_id: messagingProfileId,
      }),
    });
    if (!patchRes.ok) {
      const err = await patchRes.json();
      throw new Error(
        `Failed to assign connection to number: ${err.errors?.[0]?.detail ?? patchRes.statusText}`
      );
    }

    // Save to org
    await supabase
      .from("organizations")
      .update({
        telnyx_phone: e164,
        telnyx_connection_id: connectionId,
        telnyx_messaging_profile_id: messagingProfileId,
      })
      .eq("id", koveUser.org_id);

    return NextResponse.json({ success: true, phone: e164 });
  } catch (err) {
    console.error("[import-number]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to import number" },
      { status: 500 }
    );
  }
}
