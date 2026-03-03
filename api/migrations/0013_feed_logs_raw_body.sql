ALTER TABLE feed_logs ADD COLUMN raw_body TEXT;
ALTER TABLE feed_logs DROP COLUMN links_found;
ALTER TABLE feed_logs DROP COLUMN links_published;
ALTER TABLE feed_logs DROP COLUMN links_skipped;
