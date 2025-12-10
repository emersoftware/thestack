-- Add upvotes_count to comments
ALTER TABLE comments ADD COLUMN upvotes_count INTEGER DEFAULT 0 NOT NULL;

-- Create comment_upvotes table
CREATE TABLE comment_upvotes (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_comment_upvotes_comment ON comment_upvotes(comment_id);
CREATE INDEX idx_comment_upvotes_user ON comment_upvotes(user_id);
CREATE UNIQUE INDEX idx_comment_upvotes_unique ON comment_upvotes(comment_id, user_id);
