-- Add likes_count to comments
ALTER TABLE comments ADD COLUMN likes_count INTEGER DEFAULT 0 NOT NULL;

-- Create comment_likes table
CREATE TABLE comment_likes (
  id TEXT PRIMARY KEY,
  comment_id TEXT NOT NULL REFERENCES comments(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_comment_likes_comment ON comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user ON comment_likes(user_id);
CREATE UNIQUE INDEX idx_comment_likes_unique ON comment_likes(comment_id, user_id);
