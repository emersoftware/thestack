-- Add published_at column to posts
ALTER TABLE posts ADD COLUMN published_at INTEGER;

-- For feed posts that were approved (source='feed' and status='published'), use updated_at as publish time
UPDATE posts SET published_at = updated_at WHERE source = 'feed' AND status = 'published';

-- For manually published posts (source is null or not 'feed'), use created_at
UPDATE posts SET published_at = created_at WHERE (source IS NULL OR source != 'feed') AND status = 'published';
