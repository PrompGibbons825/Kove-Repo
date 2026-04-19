-- Replace the partial unique index with a full unique index on (org_id, email).
-- PostgreSQL treats NULL != NULL so multiple rows with email IS NULL are still allowed per org.
-- This allows ON CONFLICT (org_id, email) to work without a WHERE clause.
DROP INDEX IF EXISTS idx_contacts_org_email;

CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_email
  ON contacts(org_id, email);
