import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

const TELNYX_API = "https://api.telnyx.com/v2";

function telnyxHeaders() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${process.env.TELNYX_API_KEY}`,
  };
}

function toE164(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return digits;
  if (digits.startsWith("1") && digits.length === 11) return `+${digits}`;
  if (digits.length === 10) return `+1${digits}`;
  return `+${digits}`;
}

/**
 * GET /api/debug/sms
 * Checks Telnyx API key, org phone number, messaging profile, and number capabilities.
 */
export async function GET() {
  const supabase = await createClient();

  // Try to get org from session, fall back to first org in DB for debugging
  let org: { telnyx_phone: string | null; telnyx_messaging_profile_id: string | null } | null = null;
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const { data: koveUser } = await supabase.from("users").select("org_id").eq("id", user.id).single();
    if (koveUser) {
      const { data } = await supabase
        .from("organizations")
        .select("telnyx_phone, telnyx_messaging_profile_id")
        .eq("id", koveUser.org_id)
        .single();
      org = data;
    }
  }
  // Fallback: use service role to grab the first org (debug only)
  if (!org) {
    const { createClient: createServiceClient } = await import("@/lib/supabase/server");
    const svc = await createServiceClient();
    const { data } = await svc
      .from("organizations")
      .select("telnyx_phone, telnyx_messaging_profile_id")
      .limit(1)
      .single();
    org = data;
  }

  const apiKey = process.env.TELNYX_API_KEY;
  const results: Record<string, unknown> = {
    api_key_present: !!apiKey,
    api_key_prefix: apiKey ? apiKey.slice(0, 10) + "..." : null,
    org_phone: org?.telnyx_phone ?? null,
    org_phone_e164: org?.telnyx_phone ? toE164(org.telnyx_phone) : null,
    messaging_profile_id: org?.telnyx_messaging_profile_id ?? null,
  };

  // Check API key is valid by hitting /v2/phone_numbers for our number
  if (org?.telnyx_phone) {
    try {
      const e164 = toE164(org.telnyx_phone);
      const numbersRes = await fetch(
        `${TELNYX_API}/phone_numbers?filter[phone_number]=${encodeURIComponent(e164)}`,
        { headers: telnyxHeaders() }
      );
      const numbersJson = await numbersRes.json();
      const numberData = numbersJson.data?.[0];
      results.telnyx_number_lookup_status = numbersRes.status;
      results.telnyx_number_found = !!numberData;
      if (numberData) {
        results.number_messaging_enabled = numberData.features?.includes("sms") ?? numberData.messaging_enabled ?? null;
        results.number_status = numberData.status;
        results.number_messaging_profile_id = numberData.messaging_profile_id ?? null;
        results.number_raw = numberData;
      } else {
        results.telnyx_number_error = numbersJson.errors ?? numbersJson;
      }
    } catch (err) {
      results.telnyx_number_lookup_error = String(err);
    }
  }

  // Check messaging profile exists
  if (org?.telnyx_messaging_profile_id) {
    try {
      const mpRes = await fetch(
        `${TELNYX_API}/messaging_profiles/${org.telnyx_messaging_profile_id}`,
        { headers: telnyxHeaders() }
      );
      const mpJson = await mpRes.json();
      results.messaging_profile_status = mpRes.status;
      results.messaging_profile_found = mpRes.ok;
      if (mpRes.ok) {
        results.messaging_profile_name = mpJson.data?.name;
        results.messaging_profile_enabled = mpJson.data?.enabled;
        results.messaging_profile_webhook = mpJson.data?.webhook_url;
      } else {
        results.messaging_profile_error = mpJson.errors ?? mpJson;
      }
    } catch (err) {
      results.messaging_profile_lookup_error = String(err);
    }
  }

  return NextResponse.json(results, { status: 200 });
}
