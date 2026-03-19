import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and, gte } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Feed } from '../db/schema';
import { generateId, FEED_BOT_USER_AGENT } from './utils';
import { runFeedAgent } from './feed-agent';
import type { Env } from './auth';

const THREE_DAYS_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Strip HTML tags but keep link URLs inline for AI context
 */
export function htmlToText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
    .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
    .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
    .replace(/<a\s+[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, '$2 ($1)')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetch and process all active blog feeds using AI
 * Called by cron job — respects 3-day rate limit per feed
 */
export async function fetchAndProcessBlogFeeds(env: Env) {
  const db = drizzle(env.DB, { schema });

  try {
    const blogFeeds = await db
      .select()
      .from(schema.feeds)
      .where(and(eq(schema.feeds.type, 'blog'), eq(schema.feeds.isActive, true)));

    console.log(`[Blog] Found ${blogFeeds.length} active blog feeds`);

    for (const feed of blogFeeds) {
      try {
        await processBlogFeed(db, feed, env);
      } catch (err) {
        console.error(`[Blog] Error processing feed ${feed.id}:`, err);
      }
    }
  } catch (error) {
    console.error('[Blog] Error fetching blog feeds:', error);
  }
}

async function processBlogFeed(
  db: DrizzleD1Database<typeof schema>,
  feed: Feed,
  env: Env
) {
  if (!feed.sourceUrl) {
    console.error(`[Blog] Feed ${feed.id} has no sourceUrl`);
    return;
  }

  // Rate limit: max 1 process every 3 days per feed
  const threeDaysAgo = new Date(Date.now() - THREE_DAYS_MS);
  const [recentLog] = await db
    .select({ id: schema.feedLogs.id })
    .from(schema.feedLogs)
    .where(
      and(
        eq(schema.feedLogs.feedId, feed.id),
        eq(schema.feedLogs.status, 'completed'),
        gte(schema.feedLogs.createdAt, threeDaysAgo)
      )
    )
    .limit(1);

  if (recentLog) {
    console.log(`[Blog] Feed ${feed.id} rate limited (processed within 3 days)`);
    return;
  }

  // Fetch the blog HTML page
  let html: string;
  try {
    const response = await fetch(feed.sourceUrl, {
      headers: { 'User-Agent': FEED_BOT_USER_AGENT },
      redirect: 'follow',
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    html = await response.text();
  } catch (err) {
    await db.insert(schema.feedLogs).values({
      id: generateId(),
      feedId: feed.id,
      subject: null,
      source: feed.sourceUrl,
      status: 'error',
      error: `Fetch failed: ${err}`,
      createdAt: new Date(),
    });
    return;
  }

  // Convert HTML to text, stripping nav/footer/scripts but keeping links inline
  // Pass as rawBody so the AI agent sees the full page context
  const pageText = htmlToText(html).slice(0, 16000);

  if (pageText.length < 50) {
    const now = new Date();
    await db.batch([
      db.insert(schema.feedLogs).values({
        id: generateId(),
        feedId: feed.id,
        subject: 'No content found',
        source: feed.sourceUrl,
        status: 'completed',
        createdAt: now,
      }),
      db.update(schema.feeds)
        .set({ lastProcessedAt: now, updatedAt: now })
        .where(eq(schema.feeds.id, feed.id)),
    ]);
    return;
  }

  // Create log entry
  const logId = generateId();
  await db.insert(schema.feedLogs).values({
    id: logId,
    feedId: feed.id,
    subject: `Blog: processing ${feed.sourceUrl}`,
    source: feed.sourceUrl,
    rawBody: pageText,
    status: 'processing',
    createdAt: new Date(),
  });

  // Pass no pre-extracted links — let the AI agent find and evaluate links
  // from the rawBody context (same fallback path used by email handler)
  try {
    await runFeedAgent([], feed, logId, env, pageText);
  } catch (err) {
    console.error(`[Blog] Agent error for feed ${feed.id}:`, err);
    await db
      .update(schema.feedLogs)
      .set({ status: 'error', error: String(err) })
      .where(eq(schema.feedLogs.id, logId));
  }
}
