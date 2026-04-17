import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/lib/types/database";

/**
 * POST /api/ai/call-actions
 * Executes AI-suggested actions during or after calls:
 * - advance_status: move contact to next pipeline status
 * - create_followup: create a follow-up task
 * - schedule_appointment: create an appointment task with details
 * - assign_handoff: assign contact to another rep
 * - log_note: add a note to the contact timeline
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user: authUser } } = await supabase.auth.getUser();
  if (!authUser) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", authUser.id).single() as { data: User | null; error: unknown };
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { action, contactId, params } = await request.json();
  if (!action || !contactId) {
    return NextResponse.json({ error: "action and contactId required" }, { status: 400 });
  }

  switch (action) {
    case "advance_status": {
      const statuses = ["new", "qualifying", "qualified", "closing", "won", "lost", "renewal"];
      const { data: contact } = await supabase.from("contacts").select("status").eq("id", contactId).single();
      const currentIdx = statuses.indexOf(contact?.status ?? "new");
      const nextStatus = params?.status ?? statuses[Math.min(currentIdx + 1, statuses.length - 1)];
      
      await supabase.from("contacts").update({ status: nextStatus }).eq("id", contactId);
      
      await supabase.from("activities").insert({
        contact_id: contactId, user_id: koveUser.id, org_id: koveUser.org_id,
        type: "note", content: `Status advanced to ${nextStatus}`,
        direction: "outbound", occurred_at: new Date().toISOString(),
      });
      
      return NextResponse.json({ success: true, newStatus: nextStatus });
    }

    case "create_followup": {
      const dueAt = params?.dueAt ?? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const { data: task } = await supabase.from("tasks").insert({
        org_id: koveUser.org_id,
        contact_id: contactId,
        assigned_to: koveUser.id,
        type: "follow_up",
        title: params?.title ?? "Follow up after call",
        description: params?.description ?? null,
        due_at: dueAt,
        ai_generated: true,
      }).select().single();

      return NextResponse.json({ success: true, task });
    }

    case "schedule_appointment": {
      const { data: task } = await supabase.from("tasks").insert({
        org_id: koveUser.org_id,
        contact_id: contactId,
        assigned_to: params?.assignTo ?? koveUser.id,
        type: "appointment",
        title: params?.title ?? "Appointment",
        description: params?.description ?? null,
        due_at: params?.dateTime ?? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        ai_generated: true,
      }).select().single();

      await supabase.from("activities").insert({
        contact_id: contactId, user_id: koveUser.id, org_id: koveUser.org_id,
        type: "appointment", content: `Appointment scheduled: ${params?.title ?? "Appointment"}`,
        direction: "outbound", occurred_at: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, task });
    }

    case "assign_handoff": {
      // Get available reps
      const { data: orgUsers } = await supabase
        .from("users").select("id, full_name, email").eq("org_id", koveUser.org_id);

      // Use Claude to pick the best rep if not specified
      let assignToId = params?.assignTo;
      if (!assignToId && orgUsers && orgUsers.length > 1) {
        try {
          const res = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": process.env.ANTHROPIC_API_KEY!,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-20250514",
              max_tokens: 100,
              messages: [{
                role: "user",
                content: `Pick the best team member to hand off this contact to. Current handler: ${koveUser.full_name}. 
Available reps: ${orgUsers.filter(u => u.id !== koveUser.id).map(u => `${u.full_name} (${u.id})`).join(", ")}
Reason for handoff: ${params?.reason ?? "Standard handoff"}
Respond with just the user ID.`,
              }],
            }),
          });
          const data = await res.json();
          assignToId = data.content?.[0]?.text?.trim();
        } catch {
          assignToId = orgUsers.find(u => u.id !== koveUser.id)?.id;
        }
      }

      if (!assignToId) {
        return NextResponse.json({ error: "No rep available for handoff" }, { status: 400 });
      }

      // Add to assigned_to
      const { data: contact } = await supabase.from("contacts").select("assigned_to").eq("id", contactId).single();
      const currentAssigned = contact?.assigned_to ?? [];
      if (!currentAssigned.includes(assignToId)) {
        await supabase.from("contacts").update({
          assigned_to: [...currentAssigned, assignToId],
          handoff_notes: params?.notes ?? `Handed off from ${koveUser.full_name}`,
        }).eq("id", contactId);
      }

      await supabase.from("activities").insert({
        contact_id: contactId, user_id: koveUser.id, org_id: koveUser.org_id,
        type: "handoff", content: `Contact handed off to ${orgUsers?.find(u => u.id === assignToId)?.full_name ?? "team member"}`,
        direction: "outbound", occurred_at: new Date().toISOString(),
      });

      return NextResponse.json({ success: true, assignedTo: assignToId });
    }

    case "log_note": {
      await supabase.from("activities").insert({
        contact_id: contactId, user_id: koveUser.id, org_id: koveUser.org_id,
        type: "note", content: params?.content ?? "Note from call",
        direction: "outbound", occurred_at: new Date().toISOString(),
      });
      return NextResponse.json({ success: true });
    }

    default:
      return NextResponse.json({ error: "Unknown action" }, { status: 400 });
  }
}
