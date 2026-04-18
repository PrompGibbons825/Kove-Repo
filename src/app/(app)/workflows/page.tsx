"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus,
  Globe,
  Code2,
  Send,
  Loader2,
  Eye,
  Trash2,
  Copy,
  Check,
  Upload,
  X,
  Sparkles,
} from "lucide-react";

interface LandingPage {
  id: string;
  org_id: string;
  workflow_id: string | null;
  slug: string;
  html_content: string;
  brand_assets: { type: string; url: string; name: string }[];
  status: "draft" | "live";
  created_at: string;
  updated_at: string;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export default function WorkflowsPage() {
  const supabase = createClient();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [activePage, setActivePage] = useState<LandingPage | null>(null);

  const fetchPages = useCallback(async () => {
    const { data } = await supabase
      .from("landing_pages")
      .select("*")
      .order("created_at", { ascending: false });
    setPages((data as LandingPage[]) ?? []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)]">
        <div>
          <h1 className="text-[22px] font-semibold text-[var(--color-text-primary)]">
            Workflows
          </h1>
          <p className="text-[13px] text-[var(--color-text-tertiary)] mt-0.5">
            Landing pages &amp; automations
          </p>
        </div>
        <button
          onClick={() => {
            setActivePage(null);
            setShowBuilder(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white text-[13px] font-medium rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          <Plus className="w-4 h-4" />
          New Landing Page
        </button>
      </div>

      {showBuilder ? (
        <LandingPageBuilder
          page={activePage}
          onClose={() => {
            setShowBuilder(false);
            fetchPages();
          }}
        />
      ) : (
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-tertiary)]" />
            </div>
          ) : pages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <Globe className="w-10 h-10 text-[var(--color-text-tertiary)] mb-3" strokeWidth={1.2} />
              <p className="text-[15px] font-medium text-[var(--color-text-primary)] mb-1">
                No landing pages yet
              </p>
              <p className="text-[13px] text-[var(--color-text-tertiary)] mb-4">
                Create your first AI-built landing page to capture leads directly into your CRM.
              </p>
              <button
                onClick={() => setShowBuilder(true)}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--color-accent)] text-white text-[13px] font-medium rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
              >
                <Sparkles className="w-4 h-4" />
                Build with AI
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {pages.map((page) => (
                <LandingPageCard
                  key={page.id}
                  page={page}
                  onEdit={() => {
                    setActivePage(page);
                    setShowBuilder(true);
                  }}
                  onDelete={async () => {
                    await supabase.from("landing_pages").delete().eq("id", page.id);
                    fetchPages();
                  }}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Landing Page Card ─── */

function LandingPageCard({
  page,
  onEdit,
  onDelete,
}: {
  page: LandingPage;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);

  function copyEmbed() {
    const snippet = `<iframe src="https://site.trykove.app/lp/${page.slug}" style="width:100%;min-height:600px;border:none;" loading="lazy"></iframe>`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-center justify-between p-4 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:shadow-[var(--shadow-sm)] transition-shadow">
      <div className="flex items-center gap-4">
        <div
          className={`w-2.5 h-2.5 rounded-full ${
            page.status === "live" ? "bg-[var(--color-success)]" : "bg-[var(--color-text-tertiary)]"
          }`}
        />
        <div>
          <p className="text-[14px] font-medium text-[var(--color-text-primary)]">
            /{page.slug}
          </p>
          <p className="text-[12px] text-[var(--color-text-tertiary)]">
            {page.status === "live" ? "Live" : "Draft"} · Created{" "}
            {new Date(page.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={copyEmbed}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] rounded-lg hover:bg-[var(--color-border)] transition-colors"
          title="Copy embed code"
        >
          {copied ? <Check className="w-3.5 h-3.5" /> : <Code2 className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Embed"}
        </button>
        {page.status === "live" && (
          <a
            href={`https://site.trykove.app/lp/${page.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] rounded-lg hover:bg-[var(--color-border)] transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </a>
        )}
        <button
          onClick={onEdit}
          className="px-3 py-1.5 text-[12px] font-medium text-white bg-[var(--color-accent)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/* ─── Landing Page Builder ─── */

function LandingPageBuilder({
  page,
  onClose,
}: {
  page: LandingPage | null;
  onClose: () => void;
}) {
  const supabase = createClient();
  const [slug, setSlug] = useState(page?.slug ?? "");
  const [html, setHtml] = useState(page?.html_content ?? "");
  const [brandAssets, setBrandAssets] = useState<
    { type: string; url: string; name: string }[]
  >(page?.brand_assets ?? []);
  const [chat, setChat] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pageId, setPageId] = useState(page?.id ?? "");
  const [pageStatus, setPageStatus] = useState<"draft" | "live">(
    page?.status ?? "draft"
  );
  const [uploading, setUploading] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [copied, setCopied] = useState(false);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || generating) return;

    const userMsg: ChatMessage = { role: "user", content: input };
    const newChat = [...chat, userMsg];
    setChat(newChat);
    setInput("");
    setGenerating(true);

    try {
      const res = await fetch("/api/lp/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: input,
          conversationHistory: newChat.slice(0, -1), // exclude current
          landingPageId: pageId || undefined,
          brandAssets,
          slug: slug || "preview",
        }),
      });

      const data = await res.json();

      if (data.html) {
        setHtml(data.html);
        setChat([
          ...newChat,
          {
            role: "assistant",
            content:
              "I've updated the landing page. Check the preview on the right. Let me know if you'd like any changes!",
          },
        ]);

        // If no slug yet, suggest one from AI response
        if (!slug && data.html.includes("<title>")) {
          const titleMatch = data.html.match(/<title>(.*?)<\/title>/i);
          if (titleMatch) {
            const suggested = titleMatch[1]
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, "-")
              .replace(/^-|-$/g, "")
              .slice(0, 40);
            setSlug(suggested);
          }
        }
      } else {
        setChat([
          ...newChat,
          {
            role: "assistant",
            content: data.error || "Something went wrong. Please try again.",
          },
        ]);
      }
    } catch {
      setChat([
        ...newChat,
        { role: "assistant", content: "Failed to connect. Please try again." },
      ]);
    }

    setGenerating(false);
  }

  async function handleSave() {
    if (!slug.trim()) {
      setSlugError("A URL slug is required");
      return;
    }
    setSaving(true);
    setSlugError("");

    if (pageId) {
      const { error } = await supabase
        .from("landing_pages")
        .update({
          slug,
          html_content: html,
          brand_assets: brandAssets,
          updated_at: new Date().toISOString(),
        })
        .eq("id", pageId);

      if (error?.code === "23505") {
        setSlugError("This slug is already taken. Choose a unique URL.");
        setSaving(false);
        return;
      }
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: koveUser } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!koveUser) return;

      const { data: newPage, error } = await supabase
        .from("landing_pages")
        .insert({
          org_id: koveUser.org_id,
          slug,
          html_content: html,
          brand_assets: brandAssets,
        })
        .select("id")
        .single();

      if (error?.code === "23505") {
        setSlugError("This slug is already taken. Choose a unique URL.");
        setSaving(false);
        return;
      }

      if (newPage) setPageId(newPage.id);
    }
    setSaving(false);
  }

  async function handlePublish() {
    if (!pageId) {
      await handleSave();
    }
    if (!pageId && !slug.trim()) return;

    const newStatus = pageStatus === "live" ? "draft" : "live";
    await supabase
      .from("landing_pages")
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", pageId);
    setPageStatus(newStatus);
  }

  async function handleUploadAsset(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setUploading(false);
      return;
    }

    const { data: koveUser } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!koveUser) {
      setUploading(false);
      return;
    }

    const path = `${koveUser.org_id}/brand/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage
      .from("brand-assets")
      .upload(path, file);

    if (!error) {
      const {
        data: { publicUrl },
      } = supabase.storage.from("brand-assets").getPublicUrl(path);
      setBrandAssets([
        ...brandAssets,
        {
          type: file.type.startsWith("image/") ? "logo" : "file",
          url: publicUrl,
          name: file.name,
        },
      ]);
    }
    setUploading(false);
  }

  function copyEmbed() {
    const snippet = `<iframe src="https://site.trykove.app/lp/${slug}" style="width:100%;min-height:600px;border:none;" loading="lazy"></iframe>`;
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Builder toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-text-secondary)]">
            <Globe className="w-3.5 h-3.5" />
            site.trykove.app/lp/
          </div>
          <input
            type="text"
            value={slug}
            onChange={(e) => {
              setSlug(
                e.target.value
                  .toLowerCase()
                  .replace(/[^a-z0-9-]/g, "")
              );
              setSlugError("");
            }}
            placeholder="your-page-slug"
            className="px-2 py-1 text-[13px] bg-[var(--color-surface-hover)] border border-[var(--color-border)] rounded-md text-[var(--color-text-primary)] w-48 focus:outline-none focus:border-[var(--color-accent)]"
          />
          {slugError && (
            <span className="text-[12px] text-[var(--color-danger)]">
              {slugError}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {pageId && slug && (
            <button
              onClick={copyEmbed}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] rounded-lg hover:bg-[var(--color-border)] transition-colors"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5" />
              ) : (
                <Code2 className="w-3.5 h-3.5" />
              )}
              {copied ? "Copied" : "Embed Code"}
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] bg-[var(--color-surface-hover)] rounded-lg hover:bg-[var(--color-border)] transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
            Save Draft
          </button>
          <button
            onClick={handlePublish}
            disabled={!html}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-medium rounded-lg transition-colors disabled:opacity-50 ${
              pageStatus === "live"
                ? "bg-[var(--color-danger)] text-white hover:bg-red-600"
                : "bg-[var(--color-success)] text-white hover:bg-emerald-600"
            }`}
          >
            {pageStatus === "live" ? "Unpublish" : "Go Live"}
          </button>
        </div>
      </div>

      {/* Main builder area: chat on left, preview on right */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat panel */}
        <div className="w-[400px] flex flex-col border-r border-[var(--color-border)] bg-[var(--color-background)]">
          {/* Brand assets */}
          <div className="px-4 py-3 border-b border-[var(--color-border)]">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[12px] font-medium text-[var(--color-text-secondary)]">
                Brand Assets
              </p>
              <label className="flex items-center gap-1 px-2 py-1 text-[11px] text-[var(--color-accent)] cursor-pointer hover:bg-[var(--color-accent-soft)] rounded transition-colors">
                <Upload className="w-3 h-3" />
                {uploading ? "Uploading…" : "Upload"}
                <input
                  type="file"
                  accept="image/*,.svg"
                  className="hidden"
                  onChange={handleUploadAsset}
                />
              </label>
            </div>
            {brandAssets.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {brandAssets.map((a, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1.5 px-2 py-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md text-[11px] text-[var(--color-text-secondary)]"
                  >
                    {a.type === "logo" ? "🖼" : "📄"} {a.name}
                    <button
                      onClick={() =>
                        setBrandAssets(brandAssets.filter((_, j) => j !== i))
                      }
                      className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)]"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[11px] text-[var(--color-text-tertiary)]">
                Upload logos, icons, or brand images for the AI to use.
              </p>
            )}
          </div>

          {/* Chat messages */}
          <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            {chat.length === 0 && (
              <div className="text-center py-12">
                <Sparkles className="w-8 h-8 text-[var(--color-accent)] mx-auto mb-3" strokeWidth={1.2} />
                <p className="text-[14px] font-medium text-[var(--color-text-primary)] mb-1">
                  AI Landing Page Builder
                </p>
                <p className="text-[12px] text-[var(--color-text-tertiary)] max-w-[260px] mx-auto">
                  Describe the landing page you want. The AI will build it using
                  your brand assets. You can iterate until it&apos;s perfect.
                </p>
              </div>
            )}
            {chat.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl text-[13px] leading-relaxed ${
                    msg.role === "user"
                      ? "bg-[var(--color-accent)] text-white"
                      : "bg-[var(--color-surface)] border border-[var(--color-border)] text-[var(--color-text-primary)]"
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {generating && (
              <div className="flex justify-start">
                <div className="px-3.5 py-2.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-2xl">
                  <Loader2 className="w-4 h-4 animate-spin text-[var(--color-accent)]" />
                </div>
              </div>
            )}
          </div>

          {/* Chat input */}
          <form
            onSubmit={handleGenerate}
            className="px-4 py-3 border-t border-[var(--color-border)]"
          >
            <div className="flex items-center gap-2 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl px-3 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  chat.length === 0
                    ? "Describe your landing page…"
                    : "Ask for changes…"
                }
                className="flex-1 bg-transparent text-[13px] text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)] focus:outline-none"
              />
              <button
                type="submit"
                disabled={generating || !input.trim()}
                className="p-1.5 text-[var(--color-accent)] hover:bg-[var(--color-accent-soft)] rounded-lg transition-colors disabled:opacity-30"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        </div>

        {/* Preview panel */}
        <div className="flex-1 bg-[var(--color-surface-hover)] flex flex-col">
          <div className="px-4 py-2 border-b border-[var(--color-border)] flex items-center gap-2 bg-[var(--color-surface)]">
            <Eye className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
            <span className="text-[12px] text-[var(--color-text-tertiary)]">
              Live Preview
            </span>
          </div>
          {html ? (
            <iframe
              srcDoc={html}
              className="flex-1 w-full bg-white"
              sandbox="allow-scripts allow-forms"
              title="Landing page preview"
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-[var(--color-text-tertiary)]">
              <p className="text-[13px]">
                Your landing page preview will appear here
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
