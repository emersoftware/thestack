-- Page views tracking (guest + logged in users)
CREATE TABLE page_views (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  path TEXT NOT NULL,
  referrer TEXT,
  user_agent TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_page_views_created_at ON page_views(created_at);
CREATE INDEX idx_page_views_path ON page_views(path);
CREATE INDEX idx_page_views_user ON page_views(user_id);

-- Link clicks tracking (external link clicks on posts)
CREATE TABLE link_clicks (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  user_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE INDEX idx_link_clicks_created_at ON link_clicks(created_at);
CREATE INDEX idx_link_clicks_post ON link_clicks(post_id);
CREATE INDEX idx_link_clicks_user ON link_clicks(user_id);

-- Newsletter open tracking
CREATE TABLE newsletter_opens (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  user_id TEXT NOT NULL,
  send_date INTEGER NOT NULL,
  opened_at INTEGER
);

CREATE INDEX idx_newsletter_opens_token ON newsletter_opens(token);
CREATE INDEX idx_newsletter_opens_send_date ON newsletter_opens(send_date);
CREATE INDEX idx_newsletter_opens_user ON newsletter_opens(user_id);
