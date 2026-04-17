import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { sendSMS } from "@/lib/telnyx/client";
import { evaluateAndAssignMember } from "@/lib/ai/assign-members";

/**
 * POST /api/comms/sms/send
 * Send an SMS to a contact via the org's Telnyx number.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: org } = await supabase
    .from("organizations").select("telnyx_phone, telnyx_messaging_profile_id").eq("id", koveUser.org_id).single();
  if (!org?.telnyx_phone) {
    return NextResponse.json({ error: "No phone number configured for this organization" }, { status: 400 });
  }

  const body = await request.json();
  const { contact_id, to, message } = body;

  if (!to || !message?.trim()) {
    return NextResponse.json({ error: "to and message are required" }, { status: 400 });
  }

  try {
    console.log("[sms/send] from:", org.telnyx_phone, "to:", to, "profile:", org.telnyx_messaging_profile_id);
    await sendSMS(org.telnyx_phone, to, message.trim(), org.telnyx_messaging_profile_id ?? undefined);

    // Log the activity
    const { data: activity } = await supabase.from("activities").insert({
      contact_id: contact_id ?? null,
      user_id: koveUser.id,
      org_id: koveUser.org_id,
      type: "sms",
      content: message.trim(),
      direction: "outbound",
      metadata: { to, from: org.telnyx_phone },
      occurred_at: new Date().toISOString(),
    }).select().single();

    // AI auto-assign check
    if (activity && contact_id) {
      evaluateAndAssignMember({
        contactId: contact_id,
        orgId: koveUser.org_id,
        userId: koveUser.id,
        activityType: "sms",
        content: message.trim(),
      }).catch((err) => console.error("[sms] auto-assign failed:", err));

      // Trigger batched conversation summary (fire-and-forget)
      fetch(new URL("/api/ai/sms-summary", request.url).toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId: contact_id, orgId: koveUser.org_id, userId: koveUser.id }),
      }).catch((err) => console.error("[sms] conversation summary failed:", err));
    }

    return NextResponse.json({ success: true, activity });
  } catch (err) {
    console.error("SMS send error:", err);
    return NextResponse.json({ error: "Failed to send SMS" }, { status: 500 });
  }
}
