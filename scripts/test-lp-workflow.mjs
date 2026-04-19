#!/usr/bin/env node
/**
 * test-lp-workflow.mjs
 * Run: node scripts/test-lp-workflow.mjs <slug>
 *
 * Simulates a landing page form submission against the LIVE kove-website API
 * and prints every step of the debug chain so you can see exactly where it fails.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://mwtezvaugtolzfcwasio.supabase.co";
const SERVICE_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13dGV6dmF1Z3RvbHpmY3dhc2lvIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NjM1Njc0NSwiZXhwIjoyMDkxOTMyNzQ1fQ.5NHp8IAz72qgpocDF-ImKQ_OamnwdpJlOQOG0yBi-do";
const APP_URL = "https://trykove.app";
const LP_URL = "https://site.trykove.app";

const slug = process.argv[2];
if (!slug) {
  console.error("Usage: node scripts/test-lp-workflow.mjs <landing-page-slug>");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function run() {
  console.log("\n============================");
  console.log("  LP → Workflow Debug Test");
  console.log("============================\n");

  // ── Step 1: Check landing page exists in DB ──────────────────────────────
  console.log(`[1] Looking up landing page slug: "${slug}"`);
  const { data: page, error: pageErr } = await supabase
    .from("landing_pages")
    .select("id, org_id, workflow_id, status, slug")
    .eq("slug", slug)
    .single();

  if (pageErr || !page) {
    console.error("    ❌ Not found in DB:", pageErr?.message ?? "no data");
    process.exit(1);
  }
  console.log("    ✅ Found:", JSON.stringify(page, null, 4));

  if (page.status !== "live") {
    console.warn(`\n    ⚠️  Status is "${page.status}" — the API requires status = "live". The submission will return 404.`);
  }
  if (!page.workflow_id) {
    console.warn("\n    ⚠️  workflow_id is NULL — no workflow will be triggered even if form submits correctly.");
    console.warn("       Go to the workflow builder and make sure this landing page is linked to an active workflow.");
  }

  // ── Step 2: Check workflow is active ─────────────────────────────────────
  if (page.workflow_id) {
    console.log(`\n[2] Checking workflow ${page.workflow_id}`);
    const { data: wf, error: wfErr } = await supabase
      .from("workflows")
      .select("id, name, status, nodes")
      .eq("id", page.workflow_id)
      .single();

    if (wfErr || !wf) {
      console.error("    ❌ Workflow not found:", wfErr?.message);
    } else {
      console.log(`    ✅ Found: "${wf.name}" — status: ${wf.status}`);
      if (wf.status !== "active") {
        console.warn(`    ⚠️  Workflow status is "${wf.status}" — it must be "active" to execute.`);
      }
      const nodes = wf.nodes ?? [];
      const triggerNode = nodes.find((n) => n.type === "landing-page");
      console.log(`    Trigger node: ${triggerNode ? "✅ found (type=landing-page)" : "❌ no landing-page trigger node"}`);
      console.log(`    Total nodes: ${nodes.length}`);
    }
  } else {
    console.log("\n[2] Skipping workflow check (no workflow_id)");
  }

  // ── Step 3: Submit the form via the live API ──────────────────────────────
  const testEmail = `test-${Date.now()}@debug.local`;
  const formBody = { name: "Debug Test", email: testEmail, phone: "5550001234" };
  const endpoint = `${LP_URL}/api/lp/${slug}`;

  console.log(`\n[3] POST ${endpoint}`);
  console.log("    Payload:", JSON.stringify(formBody));

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(formBody),
  });

  const responseText = await res.text();
  let parsed;
  try { parsed = JSON.parse(responseText); } catch { parsed = responseText; }

  console.log(`    HTTP ${res.status}`);
  console.log("    Response:", JSON.stringify(parsed, null, 4));

  if (!res.ok) {
    console.error("\n❌ LP API returned an error. Fix the issue above and retry.");
    process.exit(1);
  }

  const debug = parsed?.debug ?? {};

  // ── Step 4: Summarise ────────────────────────────────────────────────────
  console.log("\n[4] Summary");
  const ok = (v) => (v ? "✅" : "❌");
  console.log(`    Contact created:  ${ok(debug.contactCreated)}  ${debug.contactId ?? "(null)"}`);
  console.log(`    Workflow linked:  ${ok(debug.workflowId)}  ${debug.workflowId ?? "(null)"}`);
  if (debug.workflowSkip) {
    console.warn(`    ⚠️  Workflow skipped: ${debug.workflowSkip}`);
  }
  if (debug.wfStatus !== undefined) {
    console.log(`    Execute status:  ${debug.wfStatus === 200 ? "✅" : "❌"}  HTTP ${debug.wfStatus}`);
    console.log(`    Execute response: ${debug.wfResponse}`);
  }
  if (debug.wfError) {
    console.error(`    Execute error: ${debug.wfError}`);
  }

  // ── Step 5: Check workflow_executions table ───────────────────────────────
  if (debug.contactId && page.workflow_id) {
    console.log("\n[5] Checking workflow_executions table...");
    await new Promise((r) => setTimeout(r, 1500)); // give DB a moment
    const { data: execs } = await supabase
      .from("workflow_executions")
      .select("id, status, started_at, error")
      .eq("workflow_id", page.workflow_id)
      .order("started_at", { ascending: false })
      .limit(3);
    if (!execs?.length) {
      console.log("    ❌ No execution records found in DB");
    } else {
      execs.forEach((e) => {
        console.log(`    ${e.status === "completed" ? "✅" : e.status === "failed" ? "❌" : "⏳"} ${e.id} — ${e.status} at ${e.started_at}${e.error ? " — " + e.error : ""}`);
      });
    }
  }

  console.log("\n============================\n");
}

run().catch((e) => { console.error("Fatal:", e); process.exit(1); });
