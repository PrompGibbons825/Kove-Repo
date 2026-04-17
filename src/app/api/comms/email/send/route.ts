import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { evaluateAndAssignMember } from "@/lib/ai/assign-members";
import type { SmtpConfig } from "@/lib/types/database";

/**
 * POST /api/comms/email/send
 * Send an email using the org's SMTP configuration.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: koveUser } = await supabase
    .from("users").select("*").eq("id", user.id).single();
  if (!koveUser) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const { data: org } = await supabase
    .from("organizations").select("smtp_config").eq("id", koveUser.org_id).single();

  const smtp = org?.smtp_config as SmtpConfig | null;
  if (!smtp?.host || !smtp?.user || !smtp?.pass) {
    return NextResponse.json({ error: "SMTP not configured. Go to Settings → Communications to set up email." }, { status: 400 });
  }

  const body = await request.json();
  const { contact_id, to, subject, html, text } = body;

  if (!to || (!html && !text)) {
    return NextResponse.json({ error: "to and message body are required" }, { status: 400 });
  }

  try {
    const transporter = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port || 587,
      secure: smtp.port === 465,
      auth: { user: smtp.user, pass: smtp.pass },
    });

    await transporter.sendMail({
      from: smtp.from_name ? `"${smtp.from_name}" <${smtp.from_email || smtp.user}>` : smtp.from_email || smtp.user,
      to,
      subject: subject ?? "(no subject)",
      text: text ?? undefined,
      html: html ?? undefined,
    });

    // Log as activity
    const { data: activity } = await supabase.from("activities").insert({
      contact_id: contact_id ?? null,
      user_id: koveUser.id,
      org_id: koveUser.org_id,
      type: "email",
      content: text || html || "",
      direction: "outbound",
      metadata: { to, subject, from: smtp.from_email || smtp.user },
      occurred_at: new Date().toISOString(),
    }).select().single();

    // AI auto-assign
    if (activity && contact_id) {
      evaluateAndAssignMember({
        contactId: contact_id,
        orgId: koveUser.org_id,
        userId: koveUser.id,
        activityType: "email",
        content: text || html || "",
      }).catch((err) => console.error("[email] auto-assign failed:", err));
    }

    return NextResponse.json({ success: true, activity });
  } catch (err) {
    console.error("Email send error:", err);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
