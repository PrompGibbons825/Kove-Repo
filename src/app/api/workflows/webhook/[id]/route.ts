import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { executeWorkflow } from "@/lib/workflows/engine";
import { createHmac } from "crypto";

/**
 * POST /api/workflows/webhook/[id]
 * Public endpoint for external apps to trigger a workflow.
 * The [id] is the workflow ID. Optionally verify with X-Webhook-Secret header.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workflowId } = await params;
  const supabase = createServiceClient();

  // Fetch the workflow
  const { data: wf } = await supabase
    .from("workflows")
    .select("id, org_id, nodes, edges, status")
    .eq("id", workflowId)
    .eq("status", "active")
    .single();

  if (!wf) {
    return NextResponse.json({ error: "Workflow not found or inactive" }, { status: 404 });
  }

  // Find the webhook trigger node
  const nodes = (wf.nodes ?? []) as { id: string; type: string; config?: Record<string, string> }[];
  const webhookNode = nodes.find((n) => n.type === "webhook");
  if (!webhookNode) {
    return NextResponse.json({ error: "No webhook trigger configured" }, { status: 400 });
  }

  // Verify secret if configured
  const secret = webhookNode.config?.secret;
  if (secret) {
    const providedSecret = request.headers.get("x-webhook-secret");
    const bodyText = await request.text();

    // Support either a plain secret match or HMAC signature
    const hmac = createHmac("sha256", secret).update(bodyText).digest("hex");
    if (providedSecret !== secret && providedSecret !== hmac) {
      return NextResponse.json({ error: "Invalid webhook secret" }, { status: 401 });
    }

    // Re-parse body since we consumed it
    const payload = bodyText ? JSON.parse(bodyText) : {};
    return await runWebhook(supabase, wf, payload);
  }

  const payload = await request.json().catch(() => ({}));
  return await runWebhook(supabase, wf, payload);
}

// Also accept GET for simple integrations
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: workflowId } = await params;
  const supabase = createServiceClient();

  const { data: wf } = await supabase
    .from("workflows")
    .select("id, org_id, nodes, edges, status")
    .eq("id", workflowId)
    .eq("status", "active")
    .single();

  if (!wf) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const nodes = (wf.nodes ?? []) as { type: string; config?: Record<string, string> }[];
  const webhookNode = nodes.find((n) => n.type === "webhook");
  if (!webhookNode) return NextResponse.json({ error: "No webhook trigger" }, { status: 400 });
  if (webhookNode.config?.method === "POST") return NextResponse.json({ error: "This webhook only accepts POST" }, { status: 405 });

  const url = new URL(request.url);
  const payload = Object.fromEntries(url.searchParams.entries());
  return await runWebhook(supabase, wf, payload);
}

async function runWebhook(
  supabase: ReturnType<typeof createServiceClient>,
  wf: { id: string; org_id: string },
  payload: Record<string, unknown>
) {
  // If payload has a contact_id, look up the contact
  let contact: Record<string, unknown> = {};
  if (payload.contact_id) {
    const { data } = await supabase.from("contacts").select("*").eq("id", payload.contact_id as string).single();
    if (data) contact = data;
  } else if (payload.email || payload.phone) {
    // Try to find by email or phone
    let q = supabase.from("contacts").select("*").eq("org_id", wf.org_id);
    if (payload.email) q = q.eq("email", payload.email as string);
    else if (payload.phone) q = q.eq("phone", payload.phone as string);
    const { data } = await q.maybeSingle();
    if (data) contact = data;
  }

  const { data: org } = await supabase.from("organizations").select("*").eq("id", wf.org_id).single();

  await executeWorkflow(wf.id, "webhook", {
    orgId: wf.org_id,
    contact,
    org: org ?? {},
  });

  return NextResponse.json({ ok: true, workflow_id: wf.id });
}
