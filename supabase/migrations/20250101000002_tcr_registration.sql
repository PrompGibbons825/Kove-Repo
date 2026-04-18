-- ============================================================
-- 10DLC / TCR brand + campaign registration fields
-- ============================================================

alter table organizations
  add column if not exists tcr_brand_id      text null,
  add column if not exists tcr_brand_status  text null,  -- PENDING, VERIFIED, FAILED, etc.
  add column if not exists tcr_campaign_id   text null,
  add column if not exists tcr_campaign_status text null; -- PENDING, ACTIVE, FAILED, etc.
