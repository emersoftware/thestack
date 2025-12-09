-- Phase 3: Voting System
CREATE TABLE IF NOT EXISTS post_upvotes (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_upvotes_post ON post_upvotes(post_id);
CREATE INDEX IF NOT EXISTS idx_upvotes_user ON post_upvotes(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_upvotes_unique ON post_upvotes(post_id, user_id);
