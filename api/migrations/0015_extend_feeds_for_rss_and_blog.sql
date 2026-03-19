-- Extend feeds to support RSS and Blog HTML sources
-- Rename email-specific columns to generic names

-- Feeds table: rename email_hash to hash
ALTER TABLE feeds RENAME COLUMN email_hash TO hash;

-- Feeds table: add type and source_url
ALTER TABLE feeds ADD COLUMN type TEXT NOT NULL DEFAULT 'email';
ALTER TABLE feeds ADD COLUMN source_url TEXT;

-- Recreate unique index with new column name
DROP INDEX IF EXISTS idx_feeds_email_hash;
CREATE UNIQUE INDEX idx_feeds_hash ON feeds(hash);

-- Add index on type for cron queries
CREATE INDEX idx_feeds_type ON feeds(type);

-- Feed logs: rename email-specific columns to generic names
ALTER TABLE feed_logs RENAME COLUMN email_subject TO subject;
ALTER TABLE feed_logs RENAME COLUMN email_from TO source;
