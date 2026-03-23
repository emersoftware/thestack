-- Scoring configuration table (single-row config)
CREATE TABLE IF NOT EXISTS scoring_config (
  id TEXT PRIMARY KEY DEFAULT 'default',
  gravity REAL NOT NULL DEFAULT 1.5,
  boost REAL NOT NULL DEFAULT 1.0,
  age_offset_hours REAL NOT NULL DEFAULT 2.0,
  recalc_window_hours INTEGER NOT NULL DEFAULT 720,
  updated_at INTEGER NOT NULL
);

-- Insert default config (gravity=1.5, window=30d)
INSERT OR IGNORE INTO scoring_config (id, gravity, boost, age_offset_hours, recalc_window_hours, updated_at)
VALUES ('default', 1.5, 1.0, 2.0, 720, unixepoch());

-- One-time recalculation of all published post scores with new params
-- Formula: (max(0, upvotes - 1) + boost) / pow(ageHours + offset, gravity)
UPDATE posts SET score = (max(0, upvotes_count - 1) + 1.0) / pow(
  (unixepoch() - coalesce(published_at, created_at)) / 3600.0 + 2.0,
  1.5
)
WHERE status = 'published' AND is_deleted = 0;

-- Zero out non-published / deleted posts
UPDATE posts SET score = 0 WHERE status != 'published' OR is_deleted = 1;
