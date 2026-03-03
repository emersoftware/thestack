CREATE TABLE feeds (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email_hash TEXT NOT NULL UNIQUE,
  auto_publish INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_processed_at INTEGER,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX idx_feeds_user ON feeds(user_id);
CREATE UNIQUE INDEX idx_feeds_email_hash ON feeds(email_hash);

CREATE TABLE feed_logs (
  id TEXT PRIMARY KEY,
  feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
  email_subject TEXT,
  email_from TEXT,
  links_found INTEGER DEFAULT 0,
  links_published INTEGER DEFAULT 0,
  links_skipped INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'processing',
  error TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_feed_logs_feed ON feed_logs(feed_id);
CREATE INDEX idx_feed_logs_created_at ON feed_logs(created_at);

ALTER TABLE posts ADD COLUMN source TEXT;
ALTER TABLE posts ADD COLUMN feed_id TEXT REFERENCES feeds(id) ON DELETE SET NULL;
ALTER TABLE posts ADD COLUMN status TEXT NOT NULL DEFAULT 'published';
