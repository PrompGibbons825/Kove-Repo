import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { User } from "@/lib/types/database";

const LP_SYSTEM_PROMPT = `You are an expert web developer and designer working inside Kove, an AI-native sales CRM.

Your job is to generate beautiful, fully self-contained HTML landing pages based on the user's description and their uploaded brand assets.

RULES:
1. Output ONLY the complete HTML — no markdown, no explanation, no code fences. Just raw HTML starting with <!DOCTYPE html>.
2. The page must be fully self-contained: inline all CSS in a <style> tag. Do NOT reference external stylesheets (except Google Fonts if needed).
3. The page must be mobile-responsive using CSS media queries.
4. Include a form that POSTs JSON to the submission endpoint. The form action URL will be provided in the context.
5. The form must include at minimum: name, email. Add other fields if the user requests them.
6. The form submission must use JavaScript fetch() to POST JSON data, show a success message on completion, and prevent default form behavior.
7. Use the brand assets (logo URLs, colors, fonts) provided in context to match the organization's branding.
8. Design should be modern, clean, and conversion-focused — large headline, clear value proposition, prominent CTA button.
9. When the user asks for edits, return the FULL updated HTML (not a diff or patch).

FORM SUBMISSION TEMPLATE (include this JS pattern in every page):
<script>
document.querySelector('form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  try {
    const res = await fetch('{{SUBMISSION_URL}}', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (res.ok) {
      e.target.innerHTML = '<p style="text-align:center;padding:2rem;font-size:1.2rem;">Thank you! We\\'ll be in touch soon.</p>';
    }
  } catch {}
});
</script>`;

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: koveUser } = (await supabase
      .from("users")
      .select("*")
      .eq("id", authUser.id)
      .single()) as { data: User | null; error: unknown };

    if (!koveUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { message, conversationHistory, landingPageId, brandAssets, slug } =
      await request.json();

    const submissionUrl = `https://site.trykove.app/api/lp/${slug || "preview"}`;

    // Build brand context
    let brandContext = "";
    if (brandAssets && brandAssets.length > 0) {
      brandContext = `\n\nBRAND ASSETS:\n${brandAssets
        .map(
          (a: { type: string; url: string; name: string }) =>
            `- ${a.type}: ${a.name} (${a.url})`
        )
        .join("\n")}`;
    }

    const systemPrompt =
      LP_SYSTEM_PROMPT.replace("{{SUBMISSION_URL}}", submissionUrl) +
      brandContext +
      `\n\nSUBMISSION ENDPOINT: ${submissionUrl}`;

    const anthropicResponse = await fetch(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": process.env.ANTHROPIC_API_KEY!,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-6",
          max_tokens: 8192,
          system: systemPrompt,
          messages: [
            ...(conversationHistory ?? []),
            { role: "user", content: message },
          ],
        }),
      }
    );

    const data = await anthropicResponse.json();

    if (!anthropicResponse.ok || data.type === "error") {
      console.error("Anthropic API error:", JSON.stringify(data));
      return NextResponse.json(
        { error: `AI error: ${data.error?.message ?? "Unknown error"}` },
        { status: 502 }
      );
    }

    const html = data.content?.[0]?.text ?? "";

    // If a landing page ID is provided, save the generated HTML
    if (landingPageId) {
      await supabase
        .from("landing_pages")
        .update({ html_content: html, updated_at: new Date().toISOString() })
        .eq("id", landingPageId)
        .eq("org_id", koveUser.org_id);
    }

    return NextResponse.json({ html, summary: "I've updated the landing page preview. Take a look and let me know if you'd like any changes!" });
  } catch (error) {
    console.error("LP generate error:", error);
    return NextResponse.json(
      {
        error: `Server error: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
