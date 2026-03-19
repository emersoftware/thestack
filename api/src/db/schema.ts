import { sqliteTable, text, integer, real, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    name: text('name').notNull(),
    email: text('email').notNull().unique(),
    emailVerified: integer('email_verified', { mode: 'boolean' }).default(false).notNull(),
    image: text('image'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
    username: text('username').unique().notNull(),
    karma: integer('karma').default(0),
    about: text('about'),
    isAdmin: integer('is_admin', { mode: 'boolean' }).default(false),
    isBanned: integer('is_banned', { mode: 'boolean' }).default(false),
    isSuperAdmin: integer('is_super_admin', { mode: 'boolean' }).default(false),
    newsletterEnabled: integer('newsletter_enabled', { mode: 'boolean' }).default(true).notNull(),
  },
  (table) => [
    uniqueIndex('idx_users_username').on(table.username),
    index('idx_users_karma').on(table.karma),
    uniqueIndex('idx_users_email').on(table.email),
  ]
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull().unique(),
    expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_sessions_user').on(table.userId),
    uniqueIndex('idx_sessions_token').on(table.token),
  ]
);

export const accounts = sqliteTable(
  'accounts',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: integer('access_token_expires_at', { mode: 'timestamp' }),
    refreshTokenExpiresAt: integer('refresh_token_expires_at', { mode: 'timestamp' }),
    scope: text('scope'),
    idToken: text('id_token'),
    password: text('password'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [index('idx_accounts_user').on(table.userId)]
);

export const verifications = sqliteTable('verifications', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }),
  updatedAt: integer('updated_at', { mode: 'timestamp' }),
});

export const feeds = sqliteTable(
  'feeds',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    hash: text('hash').notNull().unique(),
    type: text('type').notNull().default('email'),
    sourceUrl: text('source_url'),
    autoPublish: integer('auto_publish', { mode: 'boolean' }).default(false).notNull(),
    isActive: integer('is_active', { mode: 'boolean' }).default(true).notNull(),
    lastProcessedAt: integer('last_processed_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_feeds_user').on(table.userId),
    uniqueIndex('idx_feeds_hash').on(table.hash),
    index('idx_feeds_type').on(table.type),
  ]
);

export const feedLogs = sqliteTable(
  'feed_logs',
  {
    id: text('id').primaryKey(),
    feedId: text('feed_id')
      .notNull()
      .references(() => feeds.id, { onDelete: 'cascade' }),
    subject: text('subject'),
    source: text('source'),
    rawBody: text('raw_body'),
    status: text('status').notNull().default('processing'),
    error: text('error'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_feed_logs_feed').on(table.feedId),
    index('idx_feed_logs_created_at').on(table.createdAt),
  ]
);

export const posts = sqliteTable(
  'posts',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    slug: text('slug').unique(),
    url: text('url').notNull().unique(),
    domain: text('domain').notNull(),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    upvotesCount: integer('upvotes_count').default(0).notNull(),
    score: real('score').default(0).notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
    source: text('source'),
    feedId: text('feed_id').references(() => feeds.id, { onDelete: 'set null' }),
    status: text('status').notNull().default('published'),
    publishedAt: integer('published_at', { mode: 'timestamp' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_posts_author').on(table.authorId),
    index('idx_posts_domain').on(table.domain),
    index('idx_posts_score').on(table.score),
    index('idx_posts_created_at').on(table.createdAt),
    uniqueIndex('idx_posts_slug').on(table.slug),
  ]
);

export const postUpvotes = sqliteTable(
  'post_upvotes',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_upvotes_post').on(table.postId),
    index('idx_upvotes_user').on(table.userId),
    uniqueIndex('idx_upvotes_unique').on(table.postId, table.userId),
  ]
);

export const comments = sqliteTable(
  'comments',
  {
    id: text('id').primaryKey(),
    postId: text('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    authorId: text('author_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    parentId: text('parent_id'),
    content: text('content').notNull(),
    upvotesCount: integer('upvotes_count').default(0).notNull(),
    isDeleted: integer('is_deleted', { mode: 'boolean' }).default(false).notNull(),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_comments_post').on(table.postId),
    index('idx_comments_author').on(table.authorId),
    index('idx_comments_parent').on(table.parentId),
    index('idx_comments_created_at').on(table.createdAt),
  ]
);

export const commentUpvotes = sqliteTable(
  'comment_upvotes',
  {
    id: text('id').primaryKey(),
    commentId: text('comment_id')
      .notNull()
      .references(() => comments.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_comment_upvotes_comment').on(table.commentId),
    index('idx_comment_upvotes_user').on(table.userId),
    uniqueIndex('idx_comment_upvotes_unique').on(table.commentId, table.userId),
  ]
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
export type PostUpvote = typeof postUpvotes.$inferSelect;
export type NewPostUpvote = typeof postUpvotes.$inferInsert;
export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
export type CommentUpvote = typeof commentUpvotes.$inferSelect;
export type NewCommentUpvote = typeof commentUpvotes.$inferInsert;

export const pageViews = sqliteTable(
  'page_views',
  {
    id: text('id').primaryKey(),
    userId: text('user_id'),
    path: text('path').notNull(),
    referrer: text('referrer'),
    userAgent: text('user_agent'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_page_views_created_at').on(table.createdAt),
    index('idx_page_views_path').on(table.path),
    index('idx_page_views_user').on(table.userId),
  ]
);

export const linkClicks = sqliteTable(
  'link_clicks',
  {
    id: text('id').primaryKey(),
    postId: text('post_id').notNull(),
    userId: text('user_id'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_link_clicks_created_at').on(table.createdAt),
    index('idx_link_clicks_post').on(table.postId),
    index('idx_link_clicks_user').on(table.userId),
  ]
);

export const newsletterSends = sqliteTable(
  'newsletter_sends',
  {
    id: text('id').primaryKey(),
    subject: text('subject').notNull(),
    status: text('status').notNull().default('draft'),
    scheduledFor: integer('scheduled_for', { mode: 'timestamp' }),
    sentAt: integer('sent_at', { mode: 'timestamp' }),
    recipientCount: integer('recipient_count'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
  },
  (table) => [
    index('idx_newsletter_sends_status').on(table.status),
    index('idx_newsletter_sends_scheduled_for').on(table.scheduledFor),
  ]
);

export const newsletterOpens = sqliteTable(
  'newsletter_opens',
  {
    id: text('id').primaryKey(),
    token: text('token').notNull().unique(),
    userId: text('user_id').notNull(),
    sendDate: integer('send_date', { mode: 'timestamp' }).notNull(),
    openedAt: integer('opened_at', { mode: 'timestamp' }),
    sendId: text('send_id').references(() => newsletterSends.id, { onDelete: 'set null' }),
  },
  (table) => [
    uniqueIndex('idx_newsletter_opens_token').on(table.token),
    index('idx_newsletter_opens_send_date').on(table.sendDate),
    index('idx_newsletter_opens_user').on(table.userId),
    index('idx_newsletter_opens_send_id').on(table.sendId),
  ]
);

export type Feed = typeof feeds.$inferSelect;
export type NewFeed = typeof feeds.$inferInsert;
export type FeedLog = typeof feedLogs.$inferSelect;
export type NewFeedLog = typeof feedLogs.$inferInsert;
export type PageView = typeof pageViews.$inferSelect;
export type LinkClick = typeof linkClicks.$inferSelect;
export type NewsletterOpen = typeof newsletterOpens.$inferSelect;
export type NewsletterSend = typeof newsletterSends.$inferSelect;
export type NewNewsletterSend = typeof newsletterSends.$inferInsert;
