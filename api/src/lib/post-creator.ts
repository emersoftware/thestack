import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { eq, sql, inArray } from 'drizzle-orm';
import { Resend } from 'resend';
import * as schema from '../db/schema';
import type { Feed } from '../db/schema';
import { extractDomain, generateId, calculateHNScore } from './utils';
import { generateUniqueSlug } from './slug';
import { getPublishedTodayCount, isOverDailyLimit } from './rate-limit';
import { generatePendingEmailHtml } from './feed-agent';
import type { Env } from './auth';

type Db = DrizzleD1Database<typeof schema>;

export interface FeedPostEntry {
  title: string;
  url: string;
}

interface CreateFeedPostsResult {
  created: number;
  skipped: number;
  pendingTitles: string[];
}

/**
 * Batch-check which URLs already exist as posts
 */
async function getExistingUrls(db: Db, urls: string[]): Promise<Set<string>> {
  if (urls.length === 0) return new Set();
  const existing = await db
    .select({ url: schema.posts.url })
    .from(schema.posts)
    .where(inArray(schema.posts.url, urls));
  return new Set(existing.map((p) => p.url));
}

/**
 * Create posts from feed entries, handling duplicates, rate limits, and auto-publish
 */
export async function createFeedPosts(
  db: Db,
  feed: Feed,
  entries: FeedPostEntry[],
): Promise<CreateFeedPostsResult> {
  const existingUrls = await getExistingUrls(db, entries.map((e) => e.url));

  let created = 0;
  let skipped = 0;
  const pendingTitles: string[] = [];

  let publishedTodayCount = feed.autoPublish
    ? await getPublishedTodayCount(db, feed.userId)
    : 0;

  const now = new Date();

  for (const entry of entries) {
    try {
      if (existingUrls.has(entry.url)) {
        skipped++;
        continue;
      }

      const domain = extractDomain(entry.url);
      if (!domain) {
        skipped++;
        continue;
      }

      const rateLimitReached = feed.autoPublish && isOverDailyLimit(publishedTodayCount);
      const shouldPublish = feed.autoPublish && !rateLimitReached;
      const slug = await generateUniqueSlug(db, entry.title);
      const postId = generateId();
      const initialScore = shouldPublish ? calculateHNScore(1, now) : 0;

      if (shouldPublish) {
        await db.batch([
          db.insert(schema.posts).values({
            id: postId,
            title: entry.title,
            slug,
            url: entry.url,
            domain,
            authorId: feed.userId,
            upvotesCount: 1,
            score: initialScore,
            isDeleted: false,
            source: 'feed',
            feedId: feed.id,
            status: 'published',
            publishedAt: now,
            createdAt: now,
            updatedAt: now,
          }),
          db.insert(schema.postUpvotes).values({
            id: generateId(),
            postId,
            userId: feed.userId,
            createdAt: now,
          }),
          db.update(schema.users)
            .set({ karma: sql`${schema.users.karma} + 1` })
            .where(eq(schema.users.id, feed.userId)),
        ]);
        publishedTodayCount++;
      } else {
        await db.insert(schema.posts).values({
          id: postId,
          title: entry.title,
          slug,
          url: entry.url,
          domain,
          authorId: feed.userId,
          upvotesCount: 0,
          score: 0,
          isDeleted: false,
          source: 'feed',
          feedId: feed.id,
          status: 'pending',
          createdAt: now,
          updatedAt: now,
        });
        pendingTitles.push(entry.title);
      }

      created++;
      // Track URL locally to prevent duplicates within same batch
      existingUrls.add(entry.url);
    } catch (err) {
      console.error(`[Feed] Error creating post for ${entry.url}:`, err);
      skipped++;
    }
  }

  return { created, skipped, pendingTitles };
}

/**
 * Send notification email for pending feed posts
 */
export async function sendPendingPostsNotification(
  db: Db,
  env: Env,
  feed: Feed,
  pendingTitles: string[],
) {
  if (pendingTitles.length === 0) return;

  try {
    const [user] = await db
      .select({
        email: schema.users.email,
        name: schema.users.name,
        username: schema.users.username,
      })
      .from(schema.users)
      .where(eq(schema.users.id, feed.userId))
      .limit(1);

    if (!user?.email) return;

    const html = generatePendingEmailHtml(
      user.name || user.username,
      feed.name,
      pendingTitles,
      user.username,
    );

    const resend = new Resend(env.RESEND_API_KEY);
    await resend.emails.send({
      from: 'The Stack <noreply@thestack.cl>',
      to: user.email,
      subject: `Tienes ${pendingTitles.length} ${pendingTitles.length === 1 ? 'post pendiente' : 'posts pendientes'} del feed "${feed.name}"`,
      html,
    });
  } catch (err) {
    console.error('[Feed] Error sending pending notification email:', err);
  }
}
