-- ============================================================
-- Telnyx messaging profile + per-user WebRTC credentials
-- ============================================================

-- Add messaging profile ID to organizations
-- (separates voice connection from SMS messaging profile in Telnyx)
alter table organizations
  add column if not exists telnyx_messaging_profile_id text null;

-- Add per-user telephony credential ID for WebRTC calling
-- (avoids creating a new Telnyx credential on every token request)
alter table users
  add column if not exists telnyx_credential_id text null;
