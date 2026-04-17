// ============================================================
// kove Embeddings — OpenAI text-embedding-3-small (1536 dims)
// Matches the vector(1536) columns in contacts + activities
// ============================================================

/**
 * Generate an embedding vector for a given text string.
 * Uses OpenAI text-embedding-3-small which outputs 1536 dimensions,
 * matching the schema's extensions.vector(1536) columns.
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await fetch("https://api.openai.com/v1/embeddings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "text-embedding-3-small",
      input: text.slice(0, 8000), // max safe input length
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new Error(`OpenAI embeddings error: ${err.error?.message ?? response.statusText}`);
  }

  const data = await response.json();
  return data.data[0].embedding as number[];
}

/**
 * Build the embedding_text for a contact.
 * This is the text that gets embedded and searched against.
 */
export function buildContactEmbeddingText(contact: {
  name: string;
  phone?: string | null;
  email?: string | null;
  source?: string | null;
  status?: string | null;
  pipeline_stage?: string | null;
  ai_summary?: string | null;
  handoff_notes?: string | null;
  custom_fields?: Record<string, unknown>;
}): string {
  const parts: string[] = [`Contact: ${contact.name}`];
  if (contact.email) parts.push(`Email: ${contact.email}`);
  if (contact.phone) parts.push(`Phone: ${contact.phone}`);
  if (contact.source) parts.push(`Source: ${contact.source}`);
  if (contact.status) parts.push(`Status: ${contact.status}`);
  if (contact.pipeline_stage) parts.push(`Stage: ${contact.pipeline_stage}`);
  if (contact.ai_summary) parts.push(`Summary: ${contact.ai_summary}`);
  if (contact.handoff_notes) parts.push(`Notes: ${contact.handoff_notes}`);
  if (contact.custom_fields && Object.keys(contact.custom_fields).length > 0) {
    parts.push(`Custom fields: ${JSON.stringify(contact.custom_fields)}`);
  }
  return parts.join(". ");
}
