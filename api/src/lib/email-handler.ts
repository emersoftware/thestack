import { drizzle } from 'drizzle-orm/d1';
import { eq, and, gte } from 'drizzle-orm';
import PostalMime from 'postal-mime';
import * as schema from '../db/schema';
import { generateId } from './utils';
import { runFeedAgent } from './feed-agent';
import { extractLinks, extractLinksFromText } from './link-utils';
import type { Env } from './auth';

export async function handleIncomingEmail(
  message: ForwardableEmailMessage,
  env: Env,
  ctx: ExecutionContext
) {
  const db = drizzle(env.DB, { schema });

  try {
    // Extract hash from recipient: feed-<hash>@thestack.cl
    const to = message.to;
    const match = to.match(/^feed-([a-f0-9]+)@/i);
    if (!match) return;

    const hash = match[1];

    // Find feed
    const [feed] = await db
      .select()
      .from(schema.feeds)
      .where(and(eq(schema.feeds.hash, hash), eq(schema.feeds.isActive, true)))
      .limit(1);

    if (!feed) return;

    // Rate limit: max 1 processed email every 3 days per feed
    const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
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
      await db.insert(schema.feedLogs).values({
        id: generateId(),
        feedId: feed.id,
        subject: message.headers.get('subject') || null,
        source: message.from,
        status: 'rate_limited',
        createdAt: new Date(),
      });
      return;
    }

    // Parse email
    const rawEmail = await new Response(message.raw).arrayBuffer();
    const parser = new PostalMime();
    const parsed = await parser.parse(rawEmail);

    // Store the email body for potential retries
    const bodyContent = parsed.html || parsed.text || '';
    const rawBody = bodyContent.slice(0, 16000);

    // Extract links from HTML body
    const links = extractLinks(parsed.html || '');

    // Fallback: if no links found in HTML, extract from plain text
    if (links.length === 0 && parsed.text) {
      const textLinks = extractLinksFromText(parsed.text);
      links.push(...textLinks);
    }

    // If no links found at all, agent will work from rawBody
    const agentRawBody = links.length === 0 ? rawBody : undefined;

    if (links.length === 0 && !rawBody) {
      await db.insert(schema.feedLogs).values({
        id: generateId(),
        feedId: feed.id,
        subject: parsed.subject || null,
        source: message.from,
        rawBody: null,
        status: 'completed',
        createdAt: new Date(),
      });
      return;
    }

    // Create log entry with raw body for retry capability
    const logId = generateId();
    await db.insert(schema.feedLogs).values({
      id: logId,
      feedId: feed.id,
      subject: parsed.subject || null,
      source: message.from,
      rawBody,
      status: 'processing',
      createdAt: new Date(),
    });

    // Process with agent in background
    ctx.waitUntil(
      runFeedAgent(links, feed, logId, env, agentRawBody).catch((err) => {
        console.error('[Feed Agent] Error:', err);
        const dbInner = drizzle(env.DB, { schema });
        return dbInner
          .update(schema.feedLogs)
          .set({ status: 'error', error: String(err) })
          .where(eq(schema.feedLogs.id, logId));
      })
    );
  } catch (error) {
    console.error('[Email Handler] Error:', error);
  }
}

