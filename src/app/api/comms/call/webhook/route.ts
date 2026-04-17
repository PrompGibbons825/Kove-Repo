import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { evaluateAndAssignMember } from "@/lib/ai/assign-members";

/**
 * POST /api/comms/call/webhook
 * Receives Telnyx call events: call.initiated, call.answered, call.hangup,
 * call.transcription.completed, etc.
 */
export async function POST(request: Request) {
  const body = await request.json();
  const event = body.data;
  const eventType = event?.event_type;
  const payload = event?.payload;

  if (!eventType || !payload) {
    return NextResponse.json({ ok: true });
  }

  const supabase = createServiceClient();

  // Identify org by the phone number
  const toNumber = payload.to || payload.called_number;
  const fromNumber = payload.from || payload.calling_number;
  const direction = payload.direction ?? "inbound";

  let org = null;
  if (toNumber) {
    const { data } = await supabase
      .from("organizations")
      .select("id")
      .eq("telnyx_phone", toNumber)
      .single();
    org = data;
  }
  if (!org && fromNumber) {
    const { data } = await supabase
      .from("organizations")
      .select("id")
      .eq("telnyx_phone", fromNumber)
      .single();
    org = data;
  }

  switch (eventType) {
    case "call.initiated":
    case "call.answered": {
      // For inbound calls — broadcast via Supabase Realtime so browser rings
      if (direction === "inbound" && org) {
        // Insert a temporary "ringing" activity that the UI can listen for
        const contactPhone = direction === "inbound" ? fromNumber : toNumber;
        // Try to find the contact by phone
        const { data: contact } = await supabase
          .from("contacts")
          .select("id")
          .eq("org_id", org.id)
          .eq("phone", contactPhone)
          .single();

        await supabase.from("activities").insert({
          contact_id: contact?.id ?? null,
          user_id: null,
          org_id: org.id,
          type: "call",
          content: `Incoming call from ${fromNumber}`,
          direction: "inbound",
          metadata: {
            call_control_id: payload.call_control_id,
            call_leg_id: payload.call_leg_id,
            status: eventType === "call.answered" ? "answered" : "ringing",
            from: fromNumber,
            to: toNumber,
          },
          occurred_at: new Date().toISOString(),
        });
      }
      break;
    }

    case "call.hangup": {
      // Update the call activity with duration
      if (payload.call_control_id && org) {
        // Find the activity with this call_control_id
        const { data: activities } = await supabase
          .from("activities")
          .select("id, contact_id")
          .eq("org_id", org.id)
          .eq("type", "call")
          .order("occurred_at", { ascending: false })
          .limit(5);

        const activity = activities?.find(
          (a: Record<string, unknown>) =>
            (a as unknown as { metadata?: { call_control_id?: string } }).metadata?.call_control_id === payload.call_control_id
        );

        if (activity) {
          await supabase
            .from("activities")
            .update({
              duration_seconds: payload.duration_seconds ?? null,
              metadata: {
                call_control_id: payload.call_control_id,
                status: "completed",
                hangup_cause: payload.hangup_cause,
              },
            })
            .eq("id", activity.id);
        }
      }
      break;
    }

    case "call.transcription": {
      // Save transcription text to the activity
      if (payload.transcription_data && org) {
        const transcriptText = payload.transcription_data.transcript;
        // Find latest call activity for this org
        const { data: activities } = await supabase
          .from("activities")
          .select("id, contact_id, user_id")
          .eq("org_id", org.id)
          .eq("type", "call")
          .order("occurred_at", { ascending: false })
          .limit(1);

        if (activities?.[0]) {
          await supabase
            .from("activities")
            .update({ transcript: transcriptText })
            .eq("id", activities[0].id);

          // Trigger AI auto-assignment based on transcript
          if (activities[0].user_id && activities[0].contact_id) {
            evaluateAndAssignMember({
              contactId: activities[0].contact_id,
              orgId: org.id,
              userId: activities[0].user_id,
              activityType: "call",
              content: transcriptText,
              transcript: transcriptText,
            }).catch((err) => console.error("[webhook] auto-assign failed:", err));
          }
        }
      }
      break;
    }
  }

  return NextResponse.json({ ok: true });
}
