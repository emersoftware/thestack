-- Add slug column to posts table for SEO-friendly URLs
ALTER TABLE posts ADD COLUMN slug TEXT;

-- Create unique index for slug lookups
CREATE UNIQUE INDEX idx_posts_slug ON posts(slug);
