import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { evaluateAndAssignMember } from "@/lib/ai/assign-members";

/**
 * POST /api/comms/sms/webhook
 * Receives inbound SMS from Telnyx.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const event = body.data;
  const payload = event?.payload;

  if (!payload) return NextResponse.json({ ok: true });

  const supabase = createServiceClient();

  const toNumber = payload.to?.[0]?.phone_number ?? payload.to;
  const fromNumber = payload.from?.phone_number ?? payload.from;
  const text = payload.text ?? "";

  // Identify org by the receiving number
  const { data: org } = await supabase
    .from("organizations")
    .select("id")
    .eq("telnyx_phone", toNumber)
    .single();

  if (!org) {
    console.warn("[sms-webhook] No org found for number:", toNumber);
    return NextResponse.json({ ok: true });
  }

  // Try to find the contact by phone
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, assigned_to")
    .eq("org_id", org.id)
    .eq("phone", fromNumber)
    .single();

  // Log the inbound SMS as an activity
  const { data: activity } = await supabase.from("activities").insert({
    contact_id: contact?.id ?? null,
    user_id: null,
    org_id: org.id,
    type: "sms",
    content: text,
    direction: "inbound",
    metadata: { from: fromNumber, to: toNumber },
    occurred_at: new Date().toISOString(),
  }).select().single();

  // If contact has assigned reps, check if auto-assign is needed
  if (activity && contact?.id && contact.assigned_to?.length) {
    evaluateAndAssignMember({
      contactId: contact.id,
      orgId: org.id,
      userId: contact.assigned_to[0], // primary assigned rep
      activityType: "sms",
      content: text,
    }).catch((err) => console.error("[sms-webhook] auto-assign failed:", err));
  }

  return NextResponse.json({ ok: true });
}
