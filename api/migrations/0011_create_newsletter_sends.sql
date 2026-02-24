CREATE TABLE newsletter_sends (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  scheduled_for INTEGER,
  sent_at INTEGER,
  recipient_count INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX idx_newsletter_sends_status ON newsletter_sends(status);
CREATE INDEX idx_newsletter_sends_scheduled_for ON newsletter_sends(scheduled_for);

ALTER TABLE newsletter_opens ADD COLUMN send_id TEXT REFERENCES newsletter_sends(id) ON DELETE SET NULL;
CREATE INDEX idx_newsletter_opens_send_id ON newsletter_opens(send_id);
