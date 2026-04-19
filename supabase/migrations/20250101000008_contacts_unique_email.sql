-- Add unique index on (org_id, email) for contacts so LP form upserts work correctly.
-- NULL emails are excluded so multiple contacts without email can coexist per org.
CREATE UNIQUE INDEX IF NOT EXISTS idx_contacts_org_email
  ON contacts(org_id, email)
  WHERE email IS NOT NULL;
