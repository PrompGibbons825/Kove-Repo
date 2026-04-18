-- Migration 007: Org-level brand assets
-- Store brand assets at the org level so they're available across all workflows/nodes

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS brand_assets JSONB DEFAULT '[]'::jsonb;
