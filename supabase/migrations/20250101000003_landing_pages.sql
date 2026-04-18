-- ============================================================
-- Migration 004: Landing pages, submissions, and waitlist
-- ============================================================

-- Waitlist table (for the marketing website at site.trykove.app)
CREATE TABLE IF NOT EXISTS waitlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Landing pages (created by AI builder in the Workflows tab)
CREATE TABLE IF NOT EXISTS landing_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  workflow_id UUID REFERENCES workflows(id) ON DELETE SET NULL,
  slug TEXT NOT NULL,
  html_content TEXT NOT NULL DEFAULT '',
  brand_assets JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'live')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT landing_pages_slug_unique UNIQUE (slug)
);

-- Enforce global slug uniqueness at database level
CREATE UNIQUE INDEX IF NOT EXISTS idx_landing_pages_slug ON landing_pages(slug);

-- Landing page form submissions
CREATE TABLE IF NOT EXISTS landing_page_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  landing_page_id UUID NOT NULL REFERENCES landing_pages(id) ON DELETE CASCADE,
  org_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_lp_submissions_lp_id ON landing_page_submissions(landing_page_id);
CREATE INDEX IF NOT EXISTS idx_lp_submissions_org_id ON landing_page_submissions(org_id);

-- RLS policies
ALTER TABLE waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE landing_page_submissions ENABLE ROW LEVEL SECURITY;

-- Waitlist: service role only (website API uses service key)
CREATE POLICY "Service role full access on waitlist"
  ON waitlist FOR ALL
  USING (true)
  WITH CHECK (true);

-- Landing pages: users can manage their org's pages
CREATE POLICY "Users can view own org landing pages"
  ON landing_pages FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can insert own org landing pages"
  ON landing_pages FOR INSERT
  WITH CHECK (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can update own org landing pages"
  ON landing_pages FOR UPDATE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

CREATE POLICY "Users can delete own org landing pages"
  ON landing_pages FOR DELETE
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Landing page submissions: users can view their org's submissions
CREATE POLICY "Users can view own org LP submissions"
  ON landing_page_submissions FOR SELECT
  USING (org_id IN (SELECT org_id FROM users WHERE id = auth.uid()));

-- Service role needs insert for public form submissions
CREATE POLICY "Service role insert LP submissions"
  ON landing_page_submissions FOR INSERT
  WITH CHECK (true);

-- Auto-draft landing pages when workflow is deactivated
CREATE OR REPLACE FUNCTION auto_draft_landing_pages()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != 'active' AND OLD.status = 'active' THEN
    UPDATE landing_pages
    SET status = 'draft', updated_at = now()
    WHERE workflow_id = NEW.id AND status = 'live';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_auto_draft_landing_pages
  AFTER UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION auto_draft_landing_pages();
