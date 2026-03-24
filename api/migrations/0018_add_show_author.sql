-- Allow users to hide their username from posts in the feed
ALTER TABLE users ADD COLUMN show_author INTEGER NOT NULL DEFAULT 1;
