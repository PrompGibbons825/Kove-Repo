-- Add email_unsubscribed flag to contacts for CAN-SPAM / List-Unsubscribe compliance
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_unsubscribed boolean NOT NULL DEFAULT false;
ALTER TABLE contacts ADD COLUMN IF NOT EXISTS email_unsubscribed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_contacts_unsubscribed ON contacts(org_id, email_unsubscribed);
