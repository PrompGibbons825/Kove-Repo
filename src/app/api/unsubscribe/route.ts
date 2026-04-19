import { createServiceClient } from "@/lib/supabase/service";
import { NextResponse } from "next/server";

/**
 * GET /api/unsubscribe?token=<base64(orgId:email)>
 * One-click unsubscribe — marks contact as email_unsubscribed in the DB
 * and renders a simple confirmation page.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return new NextResponse(confirmationPage("Invalid unsubscribe link."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  let orgId: string, email: string;
  try {
    const decoded = Buffer.from(token, "base64url").toString("utf-8");
    [orgId, email] = decoded.split("|");
    if (!orgId || !email) throw new Error("bad format");
  } catch {
    return new NextResponse(confirmationPage("Invalid unsubscribe link."), {
      status: 400,
      headers: { "Content-Type": "text/html" },
    });
  }

  const supabase = createServiceClient();

  // Find and update the contact
  const { data: contact } = await supabase
    .from("contacts")
    .select("id, name, email_unsubscribed")
    .eq("org_id", orgId)
    .eq("email", email)
    .single();

  if (!contact) {
    return new NextResponse(confirmationPage("Email address not found."), {
      status: 404,
      headers: { "Content-Type": "text/html" },
    });
  }

  if (!contact.email_unsubscribed) {
    await supabase
      .from("contacts")
      .update({ email_unsubscribed: true, email_unsubscribed_at: new Date().toISOString() })
      .eq("id", contact.id);
  }

  return new NextResponse(confirmationPage("You have been unsubscribed.", true), {
    status: 200,
    headers: { "Content-Type": "text/html" },
  });
}

function confirmationPage(message: string, success = false) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${success ? "Unsubscribed" : "Error"}</title>
  <style>
    body { margin: 0; background: #0f0f0f; color: #e5e5e5; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 16px; padding: 40px 48px; max-width: 420px; text-align: center; }
    .icon { font-size: 40px; margin-bottom: 16px; }
    h1 { font-size: 20px; font-weight: 600; margin: 0 0 8px; color: #fff; }
    p { font-size: 14px; color: #999; margin: 0; line-height: 1.6; }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${success ? "✅" : "⚠️"}</div>
    <h1>${message}</h1>
    <p>${success ? "You won't receive any more emails from this sender." : "Please check the link and try again."}</p>
  </div>
</body>
</html>`;
}
