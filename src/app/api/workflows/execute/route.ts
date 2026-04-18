import { createServiceClient } from "@/lib/supabase/service";
import { executeWorkflow } from "@/lib/workflows/engine";
import { NextResponse } from "next/server";

/**
 * POST /api/workflows/execute
 * Internal endpoint called when a triggering event occurs.
 * Body: { trigger: "new-contact" | "webhook" | "form-submit" | "landing-page", contactId?, orgId, metadata? }
 */
export async function POST(request: Request) {
  const body = await request.json();
  const { trigger, contactId, orgId, metadata } = body;

  if (!trigger || !orgId) {
    return NextResponse.json({ error: "trigger and orgId are required" }, { status: 400 });
  }

  // Verify this is an internal call (check for service key or internal header)
  const authHeader = request.headers.get("authorization");
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (authHeader !== `Bearer ${serviceKey}`) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const supabase = createServiceClient();

  // Fetch all active workflows for this org that have the matching trigger type
  const { data: workflows } = await supabase
    .from("workflows")
    .select("id, nodes, edges, status")
    .eq("org_id", orgId)
    .eq("status", "active");

  if (!workflows || workflows.length === 0) {
    return NextResponse.json({ executed: 0 });
  }

  // Filter workflows that have a trigger node matching the trigger type
  const matchingWorkflows = workflows.filter((wf) => {
    // If a specific workflowId is provided (e.g. from LP submission), match by ID
    if (metadata?.workflowId) return wf.id === metadata.workflowId;
    const nodes = (wf.nodes ?? []) as { type: string; config?: Record<string, string> }[];
    return nodes.some((n) => {
      if (n.type !== trigger) return false;
      // For new-contact trigger, check source filter
      if (trigger === "new-contact" && n.config?.source && metadata?.source) {
        return n.config.source === metadata.source || n.config.source === "";
      }
      return true;
    });
  });

  // Fetch contact data if provided
  let contact: Record<string, unknown> = {};
  if (contactId) {
    const { data } = await supabase.from("contacts").select("*").eq("id", contactId).single();
    if (data) contact = data;
  }

  // Fetch org data
  const { data: org } = await supabase
    .from("organizations")
    .select("*")
    .eq("id", orgId)
    .single();

  // Execute all matching workflows concurrently
  const results = await Promise.allSettled(
    matchingWorkflows.map((wf) =>
      executeWorkflow(wf.id, trigger, {
        orgId,
        contact,
        org: org ?? {},
      })
    )
  );

  return NextResponse.json({
    executed: matchingWorkflows.length,
    results: results.map((r) => (r.status === "fulfilled" ? "ok" : (r as PromiseRejectedResult).reason?.message)),
  });
}
