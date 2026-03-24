-- Newsletter configuration (singleton row)
CREATE TABLE IF NOT EXISTS newsletter_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  paused INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

INSERT INTO newsletter_config (id, paused, updated_at) VALUES ('default', 0, unixepoch());
