-- ============================================================
-- Migration 007: Brand assets storage bucket
-- ============================================================

-- Create the brand-assets storage bucket (public so images can be embedded in LP HTML)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  10485760, -- 10 MB
  ARRAY[
    'image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp',
    'image/svg+xml', 'text/html', 'text/css', 'application/javascript',
    'text/javascript', 'application/octet-stream'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- RLS: authenticated users can upload to their own org folder
CREATE POLICY "Users can upload brand assets"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'brand-assets');

-- RLS: authenticated users can read any brand asset
CREATE POLICY "Users can read brand assets"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'brand-assets');

-- RLS: public can read brand assets (needed for LP iframe embeds)
CREATE POLICY "Public can read brand assets"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'brand-assets');

-- RLS: users can delete their own org's assets
CREATE POLICY "Users can delete brand assets"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'brand-assets');
