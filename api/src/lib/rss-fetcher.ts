import { drizzle } from 'drizzle-orm/d1';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, and } from 'drizzle-orm';
import * as schema from '../db/schema';
import type { Feed } from '../db/schema';
import { generateId, FEED_BOT_USER_AGENT, safeFetch, classifyFetchError } from './utils';
import { cleanUrl } from './link-utils';
import { createFeedPosts, sendPendingPostsNotification } from './post-creator';
import type { Env } from './auth';

interface RssEntry {
  title: string;
  url: string;
  pubDate: string | null;
}

/**
 * Parse RSS 2.0 and Atom feeds from XML string
 */
export function parseRssFeed(xml: string): RssEntry[] {
  const entries: RssEntry[] = [];

  // Try RSS 2.0 format: <item>
  const itemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match;

  while ((match = itemRegex.exec(xml)) !== null) {
    const itemXml = match[1];
    const title = extractTag(itemXml, 'title');
    const link = extractTag(itemXml, 'link');
    const pubDate = extractTag(itemXml, 'pubDate');

    if (title && link) {
      entries.push({
        title: decodeXmlEntities(title),
        url: cleanUrl(decodeXmlEntities(link.trim())),
        pubDate,
      });
    }
  }

  // If no RSS items found, try Atom format: <entry>
  if (entries.length === 0) {
    const entryRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;

    while ((match = entryRegex.exec(xml)) !== null) {
      const entryXml = match[1];
      const title = extractTag(entryXml, 'title');
      const link = extractAtomLink(entryXml);
      const published = extractTag(entryXml, 'published') || extractTag(entryXml, 'updated');

      if (title && link) {
        entries.push({
          title: decodeXmlEntities(title),
          url: cleanUrl(link.trim()),
          pubDate: published,
        });
      }
    }
  }

  // Limit to most recent entries (feeds are ordered newest-first)
  return entries.slice(0, MAX_ENTRIES_PER_FEED);
}

function extractTag(xml: string, tag: string): string | null {
  // Handle CDATA: <tag><![CDATA[content]]></tag>
  const cdataRegex = new RegExp(`<${tag}[^>]*>\\s*<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>\\s*<\\/${tag}>`, 'i');
  const cdataMatch = cdataRegex.exec(xml);
  if (cdataMatch) return cdataMatch[1].trim();

  // Handle regular: <tag>content</tag>
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = regex.exec(xml);
  return match ? match[1].trim() : null;
}

function extractAtomLink(xml: string): string | null {
  // Match rel="alternate" with href in either attribute order
  const altRegex = /<link[^>]*(?:rel=["']alternate["'][^>]*href=["']([^"']+)["']|href=["']([^"']+)["'][^>]*rel=["']alternate["'])[^>]*\/?>/i;
  const altMatch = altRegex.exec(xml);
  if (altMatch) return altMatch[1] || altMatch[2];

  const hrefRegex = /<link[^>]*href=["']([^"']+)["'][^>]*\/?>/i;
  const hrefMatch = hrefRegex.exec(xml);
  return hrefMatch ? hrefMatch[1] : null;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(parseInt(dec, 10)));
}

const MAX_ENTRIES_PER_FEED = 5;

/**
 * Fetch and process all active RSS feeds
 * Called by cron job once per day
 */
export async function fetchAndProcessRssFeeds(env: Env) {
  const db = drizzle(env.DB, { schema });

  try {
    const rssFeeds = await db
      .select()
      .from(schema.feeds)
      .where(and(eq(schema.feeds.type, 'rss'), eq(schema.feeds.isActive, true)));

    console.log(`[RSS] Found ${rssFeeds.length} active RSS feeds`);

    for (const feed of rssFeeds) {
      try {
        await processRssFeed(db, feed, env);
      } catch (err) {
        console.error(`[RSS] Error processing feed ${feed.id}:`, err);
      }
    }
  } catch (error) {
    console.error('[RSS] Error fetching RSS feeds:', error);
  }
}

async function processRssFeed(
  db: DrizzleD1Database<typeof schema>,
  feed: Feed,
  env: Env
) {
  if (!feed.sourceUrl) {
    console.error(`[RSS] Feed ${feed.id} has no sourceUrl`);
    return;
  }

  let xml: string;
  try {
    const { response } = await safeFetch(feed.sourceUrl, {
      headers: { 'User-Agent': FEED_BOT_USER_AGENT },
    });
    xml = await response.text();
  } catch (err) {
    console.error(`[RSS] Fetch error for feed ${feed.id}:`, err);
    await db.insert(schema.feedLogs).values({
      id: generateId(),
      feedId: feed.id,
      subject: null,
      source: feed.sourceUrl,
      status: 'error',
      error: classifyFetchError(err),
      createdAt: new Date(),
    });
    return;
  }

  // Parse entries
  const entries = parseRssFeed(xml);
  if (entries.length === 0) {
    const now = new Date();
    await db.batch([
      db.insert(schema.feedLogs).values({
        id: generateId(),
        feedId: feed.id,
        subject: null,
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

  // Create posts using shared logic (handles dedup, rate limits, auto-publish)
  const result = await createFeedPosts(db, feed, entries);

  // Log and update lastProcessedAt
  const now = new Date();
  await db.batch([
    db.insert(schema.feedLogs).values({
      id: generateId(),
      feedId: feed.id,
      subject: `RSS: ${result.created} created, ${result.skipped} skipped`,
      source: feed.sourceUrl,
      status: 'completed',
      createdAt: now,
    }),
    db.update(schema.feeds)
      .set({ lastProcessedAt: now, updatedAt: now })
      .where(eq(schema.feeds.id, feed.id)),
  ]);

  console.log(`[RSS] Feed ${feed.id}: ${result.created} created, ${result.skipped} skipped`);

  // Send notification for pending posts
  if (result.pendingTitles.length > 0) {
    await sendPendingPostsNotification(db, env, feed, result.pendingTitles);
  }
}
