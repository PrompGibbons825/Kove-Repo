"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useLandingPageBuilder } from "@/components/landing-pages/builder-context";
import {
  Plus,
  Globe,
  Code2,
  Loader2,
  Eye,
  Trash2,
  Check,
  Upload,
  X,
  ArrowLeft,
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

export default function WorkflowsPage() {
  const supabase = createClient();
  const [pages, setPages] = useState<LandingPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPage, setEditingPage] = useState<LandingPage | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

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

  function openBuilder(page: LandingPage | null) {
    setEditingPage(page);
    setShowBuilder(true);
  }

  function closeBuilder() {
    setShowBuilder(false);
    setEditingPage(null);
    fetchPages();
  }

  if (showBuilder) {
    return <LandingPageBuilder page={editingPage} onClose={closeBuilder} />;
  }

  return (
    <div className="flex-1 flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-8 pt-8 pb-6">
        <div>
          <h1 className="text-[24px] font-semibold text-[var(--color-text-primary)]">
            Workflows
          </h1>
          <p className="text-[14px] text-[var(--color-text-tertiary)] mt-1">
            Build landing pages and automate your lead capture
          </p>
        </div>
        <button
          onClick={() => openBuilder(null)}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] text-white text-[13px] font-medium rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          New Landing Page
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-8 pb-8">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-5 h-5 animate-spin text-[var(--color-text-tertiary)]" />
          </div>
        ) : pages.length === 0 ? (
          <EmptyState onCreate={() => openBuilder(null)} />
        ) : (
          <div className="grid gap-3">
            {pages.map((page) => (
              <PageCard
                key={page.id}
                page={page}
                onEdit={() => openBuilder(page)}
                onDelete={async () => {
                  await supabase.from("landing_pages").delete().eq("id", page.id);
                  fetchPages();
                }}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Empty State ─── */

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[var(--color-accent-soft)] flex items-center justify-center mb-5">
        <Globe className="w-7 h-7 text-[var(--color-accent)]" strokeWidth={1.5} />
      </div>
      <h2 className="text-[18px] font-semibold text-[var(--color-text-primary)] mb-2">
        No landing pages yet
      </h2>
      <p className="text-[14px] text-[var(--color-text-tertiary)] mb-6 max-w-sm">
        Build your first AI-powered landing page. Describe what you want in the
        AI assistant, and it will generate a complete page for you.
      </p>
      <button
        onClick={onCreate}
        className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-accent)] text-white text-[13px] font-medium rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors shadow-sm"
      >
        <Sparkles className="w-4 h-4" />
        Build with AI
      </button>
    </div>
  );
}

/* ─── Page Card ─── */

function PageCard({
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
    <div className="flex items-center justify-between p-5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-xl hover:shadow-[var(--shadow-sm)] transition-all">
      <div className="flex items-center gap-4 min-w-0">
        <div
          className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
            page.status === "live" ? "bg-[var(--color-success)]" : "bg-[var(--color-text-tertiary)]"
          }`}
        />
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[var(--color-text-primary)] truncate">
            site.trykove.app/lp/{page.slug}
          </p>
          <p className="text-[12px] text-[var(--color-text-tertiary)] mt-0.5">
            {page.status === "live" ? "Live" : "Draft"} · Created{" "}
            {new Date(page.created_at).toLocaleDateString()}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={copyEmbed}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
          title="Copy embed code"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Code2 className="w-3.5 h-3.5" />}
          {copied ? "Copied" : "Embed"}
        </button>
        {page.status === "live" && (
          <a
            href={`https://site.trykove.app/lp/${page.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <Eye className="w-3.5 h-3.5" />
            View
          </a>
        )}
        <button
          onClick={onEdit}
          className="px-4 py-1.5 text-[12px] font-medium text-white bg-[var(--color-accent)] rounded-lg hover:bg-[var(--color-accent-hover)] transition-colors"
        >
          Edit
        </button>
        <button
          onClick={onDelete}
          className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] hover:bg-[var(--color-danger-soft)] rounded-lg transition-colors"
          title="Delete"
        >
          <Trash2 className="w-3.5 h-3.5" />
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
  const lpCtx = useLandingPageBuilder();
  const [slug, setSlugLocal] = useState(page?.slug ?? "");
  const [brandAssets, setBrandAssetsLocal] = useState<
    { type: string; url: string; name: string }[]
  >(page?.brand_assets ?? []);
  const [saving, setSaving] = useState(false);
  const [pageId, setPageIdLocal] = useState(page?.id ?? "");
  const [pageStatus, setPageStatus] = useState<"draft" | "live">(page?.status ?? "draft");
  const [uploading, setUploading] = useState(false);
  const [slugError, setSlugError] = useState("");
  const [copied, setCopied] = useState(false);

  // Open the shared context so the agent sidebar knows we're building a landing page
  useEffect(() => {
    lpCtx.open(page?.id ?? "", page?.slug ?? "", page?.html_content ?? "", page?.brand_assets ?? []);
    return () => lpCtx.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync local slug/brand assets to context
  useEffect(() => {
    lpCtx.setSlug(slug);
  }, [slug, lpCtx]);

  useEffect(() => {
    lpCtx.setBrandAssets(brandAssets);
  }, [brandAssets, lpCtx]);

  useEffect(() => {
    lpCtx.setPageId(pageId);
  }, [pageId, lpCtx]);

  // Read HTML from context (agent sidebar updates it)
  const html = lpCtx.state.html;

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
        setSlugError("This slug is already taken.");
        setSaving(false);
        return;
      }
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setSaving(false); return; }

      const { data: koveUser } = await supabase
        .from("users")
        .select("org_id")
        .eq("id", user.id)
        .single();

      if (!koveUser) { setSaving(false); return; }

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
        setSlugError("This slug is already taken.");
        setSaving(false);
        return;
      }

      if (newPage) {
        setPageIdLocal(newPage.id);
        lpCtx.setPageId(newPage.id);
      }
    }
    setSaving(false);
  }

  async function handlePublish() {
    if (!pageId) await handleSave();
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

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setUploading(false); return; }

    const { data: koveUser } = await supabase
      .from("users")
      .select("org_id")
      .eq("id", user.id)
      .single();

    if (!koveUser) { setUploading(false); return; }

    const path = `${koveUser.org_id}/brand/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("brand-assets").upload(path, file);

    if (!error) {
      const { data: { publicUrl } } = supabase.storage.from("brand-assets").getPublicUrl(path);
      const newAssets = [
        ...brandAssets,
        {
          type: file.type.startsWith("image/") ? "logo" : "file",
          url: publicUrl,
          name: file.name,
        },
      ];
      setBrandAssetsLocal(newAssets);
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
    <div className="flex-1 flex flex-col h-full overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center gap-4">
          <button
            onClick={onClose}
            className="p-2 text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-hover)] rounded-lg transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-[var(--color-border)]" />

          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-[var(--color-text-tertiary)]" />
            <span className="text-[13px] text-[var(--color-text-tertiary)]">
              site.trykove.app/lp/
            </span>
            <input
              type="text"
              value={slug}
              onChange={(e) => {
                setSlugLocal(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""));
                setSlugError("");
              }}
              placeholder="your-page-slug"
              className="px-2.5 py-1.5 text-[13px] bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg text-[var(--color-text-primary)] w-52 focus:outline-none focus:border-[var(--color-accent)] transition-colors"
            />
            {slugError && (
              <span className="text-[12px] text-[var(--color-danger)]">{slugError}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Brand assets */}
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            {uploading ? "Uploading…" : "Brand Assets"}
            <input
              type="file"
              accept="image/*,.svg"
              className="hidden"
              onChange={handleUploadAsset}
            />
          </label>

          {pageId && slug && (
            <button
              onClick={copyEmbed}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-[var(--color-success)]" /> : <Code2 className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Embed"}
            </button>
          )}

          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-1.5 text-[12px] font-medium text-[var(--color-text-secondary)] border border-[var(--color-border)] rounded-lg hover:bg-[var(--color-surface-hover)] transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            Save
          </button>

          <button
            onClick={handlePublish}
            disabled={!html}
            className={`flex items-center gap-1.5 px-5 py-1.5 text-[12px] font-medium rounded-lg transition-colors disabled:opacity-40 ${
              pageStatus === "live"
                ? "bg-[var(--color-danger)] text-white hover:bg-red-600"
                : "bg-[var(--color-success)] text-white hover:bg-emerald-600"
            }`}
          >
            {pageStatus === "live" ? "Unpublish" : "Go Live"}
          </button>
        </div>
      </div>

      {/* Brand assets pills */}
      {brandAssets.length > 0 && (
        <div className="flex items-center gap-2 px-6 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
          <span className="text-[11px] font-medium text-[var(--color-text-tertiary)] uppercase tracking-wider mr-1">
            Assets
          </span>
          {brandAssets.map((a, i) => (
            <div
              key={i}
              className="flex items-center gap-1.5 px-2.5 py-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-md text-[11px] text-[var(--color-text-secondary)]"
            >
              {a.type === "logo" ? "🖼" : "📄"} {a.name}
              <button
                onClick={() => setBrandAssetsLocal(brandAssets.filter((_, j) => j !== i))}
                className="text-[var(--color-text-tertiary)] hover:text-[var(--color-danger)] transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Full-width preview */}
      <div className="flex-1 bg-[var(--color-background)] overflow-hidden">
        {html ? (
          <iframe
            srcDoc={html}
            className="w-full h-full bg-white"
            sandbox="allow-scripts allow-forms"
            title="Landing page preview"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent-soft)] flex items-center justify-center mb-4">
              <Sparkles className="w-6 h-6 text-[var(--color-accent)]" strokeWidth={1.5} />
            </div>
            <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] mb-2">
              Open the AI assistant to get started
            </h3>
            <p className="text-[13px] text-[var(--color-text-tertiary)] max-w-md">
              Click the chat icon in the top right to open the AI assistant.
              Describe the landing page you want — it will generate the HTML and
              show a live preview here. You can iterate until it&apos;s perfect.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
