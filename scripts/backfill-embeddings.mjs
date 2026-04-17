// Backfill embeddings for all contacts that don't have one yet.
// Run: node scripts/backfill-embeddings.mjs (reads from .env.local automatically)

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

// Parse .env.local manually (no external dotenv dep needed)
try {
  const envFile = readFileSync(".env.local", "utf8");
  for (const line of envFile.split("\n")) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) process.env[match[1].trim()] = match[2].trim();
  }
} catch {}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !OPENAI_API_KEY) {
  console.error("Missing required env vars. Check .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

function buildEmbeddingText(c) {
  const parts = [`Contact: ${c.name}`];
  if (c.email) parts.push(`Email: ${c.email}`);
  if (c.phone) parts.push(`Phone: ${c.phone}`);
  if (c.source) parts.push(`Source: ${c.source}`);
  if (c.status) parts.push(`Status: ${c.status}`);
  if (c.pipeline_stage) parts.push(`Stage: ${c.pipeline_stage}`);
  if (c.ai_summary) parts.push(`Summary: ${c.ai_summary}`);
  if (c.handoff_notes) parts.push(`Notes: ${c.handoff_notes}`);
  if (c.custom_fields && Object.keys(c.custom_fields).length > 0)
    parts.push(`Custom fields: ${JSON.stringify(c.custom_fields)}`);
  return parts.join(". ");
}

async function embed(text) {
  const res = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({ model: "text-embedding-3-small", input: text.slice(0, 8000) }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${await res.text()}`);
  const data = await res.json();
  return data.data[0].embedding;
}

async function main() {
  // Fetch all contacts (service role bypasses RLS)
  const { data: contacts, error } = await supabase
    .from("contacts")
    .select("id, name, email, phone, source, status, pipeline_stage, ai_summary, handoff_notes, custom_fields, embedding");

  if (error) { console.error("Failed to fetch contacts:", error); process.exit(1); }
  console.log(`Found ${contacts.length} contacts total.`);

  const toProcess = contacts.filter((c) => !c.embedding);
  console.log(`${toProcess.length} contacts need embeddings.\n`);

  let success = 0, failed = 0;
  for (const contact of toProcess) {
    try {
      const embeddingText = buildEmbeddingText(contact);
      const embedding = await embed(embeddingText);
      const { error: updateErr } = await supabase
        .from("contacts")
        .update({ embedding_text: embeddingText, embedding })
        .eq("id", contact.id);
      if (updateErr) throw updateErr;
      console.log(`✓ ${contact.name}`);
      success++;
      // Rate limit: ~500 RPM on OpenAI free tier
      await new Promise((r) => setTimeout(r, 120));
    } catch (err) {
      console.error(`✗ ${contact.name}:`, err.message);
      failed++;
    }
  }

  console.log(`\nDone. ${success} embedded, ${failed} failed.`);
}

main();
