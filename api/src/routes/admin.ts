import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, sql, desc, isNull, and, gte, lte, count, countDistinct } from 'drizzle-orm';
import type { Env } from '../lib/auth';
import * as schema from '../db/schema';
import { requireAdmin, requireSuperAdmin, type AuthVariables, type AuthUser } from '../middleware/auth';
import { sendWeeklyNewsletter, createWeeklyDraft, getWeeklySubject, getNextMondayAt18UTC, getNewsletterSubscribers } from '../lib/newsletter';
import { generateSlug, calculateHNScore, classifyFetchError, batchInChunks } from '../lib/utils';
import { getScoringConfig } from '../lib/scoring';

const admin = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

// Apply admin middleware to all routes - sessionMiddleware already ran in index.ts
admin.use('*', requireAdmin());

admin.get('/stats', async (c) => {
  const db = drizzle(c.env.DB, { schema });

  try {
    const [usersCount, postsCount, upvotesCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(schema.users),
      db.select({ count: sql<number>`count(*)` }).from(schema.posts),
      db.select({ count: sql<number>`count(*)` }).from(schema.postUpvotes),
    ]);

    return c.json({
      users: usersCount[0]?.count || 0,
      posts: postsCount[0]?.count || 0,
      upvotes: upvotesCount[0]?.count || 0,
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    return c.json({ error: 'Error al obtener estadísticas' }, 500);
  }
});

admin.get('/users', async (c) => {
  const db = drizzle(c.env.DB, { schema });

  try {
    const users = await db
      .select({
        id: schema.users.id,
        username: schema.users.username,
        email: schema.users.email,
        karma: schema.users.karma,
        isAdmin: schema.users.isAdmin,
        isBanned: schema.users.isBanned,
        isSuperAdmin: schema.users.isSuperAdmin,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .orderBy(desc(schema.users.createdAt));

    return c.json({ users });
  } catch (error) {
    console.error('Error fetching users:', error);
    return c.json({ error: 'Error al obtener usuarios' }, 500);
  }
});

// Only a super-admin can mint new admins. This mirrors demote/ban, which
// already restrict admin-on-admin actions to super-admin and prevents an
// admin chain that a super-admin can't fully unwind.
admin.put('/users/:id/promote', requireSuperAdmin(), async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.req.param('id');

  try {
    const [targetUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }

    await db
      .update(schema.users)
      .set({ isAdmin: true })
      .where(eq(schema.users.id, userId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error promoting user:', error);
    return c.json({ error: 'Error al promover usuario' }, 500);
  }
});

admin.put('/users/:id/demote', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.req.param('id');
  const user = c.get('user') as AuthUser;

  if (userId === user.id) {
    return c.json({ error: 'No puedes degradarte a ti mismo' }, 400);
  }

  try {
    const [targetUser] = await db
      .select({
        id: schema.users.id,
        isAdmin: schema.users.isAdmin,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }

    if (targetUser.isAdmin && !user.isSuperAdmin) {
      return c.json({ error: 'Solo super-admin puede degradar a otros admins' }, 403);
    }

    await db
      .update(schema.users)
      .set({ isAdmin: false })
      .where(eq(schema.users.id, userId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error demoting user:', error);
    return c.json({ error: 'Error al degradar usuario' }, 500);
  }
});

admin.put('/users/:id/ban', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.req.param('id');
  const user = c.get('user') as AuthUser;

  if (userId === user.id) {
    return c.json({ error: 'No puedes banearte a ti mismo' }, 400);
  }

  try {
    const [targetUser] = await db
      .select({
        id: schema.users.id,
        isAdmin: schema.users.isAdmin,
      })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }

    if (targetUser.isAdmin && !user.isSuperAdmin) {
      return c.json({ error: 'Solo super-admin puede banear a otros admins' }, 403);
    }

    await db
      .update(schema.users)
      .set({ isBanned: true })
      .where(eq(schema.users.id, userId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error banning user:', error);
    return c.json({ error: 'Error al banear usuario' }, 500);
  }
});

admin.put('/users/:id/unban', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.req.param('id');

  try {
    const [targetUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }

    await db
      .update(schema.users)
      .set({ isBanned: false })
      .where(eq(schema.users.id, userId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error unbanning user:', error);
    return c.json({ error: 'Error al desbanear usuario' }, 500);
  }
});

admin.get('/posts', async (c) => {
  const db = drizzle(c.env.DB, { schema });

  try {
    const posts = await db
      .select({
        id: schema.posts.id,
        title: schema.posts.title,
        url: schema.posts.url,
        domain: schema.posts.domain,
        upvotesCount: schema.posts.upvotesCount,
        isDeleted: schema.posts.isDeleted,
        createdAt: schema.posts.createdAt,
        authorId: schema.posts.authorId,
        authorUsername: schema.users.username,
      })
      .from(schema.posts)
      .leftJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
      .orderBy(desc(schema.posts.createdAt));

    return c.json({
      posts: posts.map((p) => ({
        id: p.id,
        title: p.title,
        url: p.url,
        domain: p.domain,
        upvotesCount: p.upvotesCount,
        isDeleted: p.isDeleted,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
        author: { id: p.authorId, username: p.authorUsername || 'unknown' },
      })),
    });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return c.json({ error: 'Error al obtener posts' }, 500);
  }
});

admin.delete('/posts/:id', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const postId = c.req.param('id');

  try {
    await db
      .update(schema.posts)
      .set({ isDeleted: true })
      .where(eq(schema.posts.id, postId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    return c.json({ error: 'Error al eliminar post' }, 500);
  }
});

admin.put('/posts/:id/restore', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const postId = c.req.param('id');

  try {
    await db
      .update(schema.posts)
      .set({ isDeleted: false })
      .where(eq(schema.posts.id, postId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error restoring post:', error);
    return c.json({ error: 'Error al restaurar post' }, 500);
  }
});

// Super-admin only endpoints
admin.put('/users/:id/make-super-admin', requireSuperAdmin(), async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.req.param('id');

  try {
    const [targetUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }

    await db
      .update(schema.users)
      .set({ isAdmin: true, isSuperAdmin: true })
      .where(eq(schema.users.id, userId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error making super admin:', error);
    return c.json({ error: 'Error al hacer super admin' }, 500);
  }
});

admin.put('/users/:id/remove-super-admin', requireSuperAdmin(), async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.req.param('id');
  const user = c.get('user') as AuthUser;

  if (userId === user.id) {
    return c.json({ error: 'No puedes quitarte super-admin a ti mismo' }, 400);
  }

  try {
    const [targetUser] = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!targetUser) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }

    await db
      .update(schema.users)
      .set({ isSuperAdmin: false })
      .where(eq(schema.users.id, userId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error removing super admin:', error);
    return c.json({ error: 'Error al quitar super admin' }, 500);
  }
});

// GET /admin/newsletter/status - countdown, subscribers, current draft, paused state
admin.get('/newsletter/status', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  try {
    const subscribers = await getNewsletterSubscribers(db);
    const nextSendAt = getNextMondayAt18UTC();
    const secondsUntilNextSend = Math.max(0, Math.floor((nextSendAt.getTime() - Date.now()) / 1000));

    // Get paused state
    const [nlConfig] = await db
      .select()
      .from(schema.newsletterConfig)
      .where(eq(schema.newsletterConfig.id, 'default'))
      .limit(1);
    const paused = nlConfig?.paused ?? false;

    // Find current draft/scheduled by send date
    const [currentDraft] = await db
      .select()
      .from(schema.newsletterSends)
      .where(
        and(
          sql`${schema.newsletterSends.status} IN ('draft', 'scheduled')`,
          eq(schema.newsletterSends.scheduledFor, nextSendAt)
        )
      )
      .limit(1);

    return c.json({
      paused,
      activeSubscribers: subscribers.length,
      nextSendAt: nextSendAt.toISOString(),
      secondsUntilNextSend,
      currentDraft: currentDraft ? {
        id: currentDraft.id,
        subject: currentDraft.subject,
        status: currentDraft.status,
        sentAt: currentDraft.sentAt ? new Date(currentDraft.sentAt).toISOString() : null,
        recipientCount: currentDraft.recipientCount,
        openedCount: 0,
        openRate: 0,
      } : null,
    });
  } catch (error) {
    console.error('Error fetching newsletter status:', error);
    return c.json({ error: 'Error al obtener estado del newsletter' }, 500);
  }
});

// POST /admin/newsletter/pause - toggle newsletter pause state
admin.post('/newsletter/pause', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  try {
    const body = await c.req.json<{ paused: boolean }>();
    const paused = Boolean(body.paused);
    const now = new Date();

    const [existing] = await db
      .select()
      .from(schema.newsletterConfig)
      .where(eq(schema.newsletterConfig.id, 'default'))
      .limit(1);

    if (existing) {
      await db
        .update(schema.newsletterConfig)
        .set({ paused, updatedAt: now })
        .where(eq(schema.newsletterConfig.id, 'default'));
    } else {
      await db.insert(schema.newsletterConfig).values({
        id: 'default',
        paused,
        updatedAt: now,
      });
    }

    console.log(`[Admin] Newsletter ${paused ? 'paused' : 'resumed'}`);
    return c.json({ paused });
  } catch (error) {
    console.error('Error toggling newsletter pause:', error);
    return c.json({ error: 'Error al cambiar estado del newsletter' }, 500);
  }
});

// GET /admin/newsletter/sends - history with open rates
admin.get('/newsletter/sends', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  try {
    const sends = await db.all(sql`
      SELECT
        ns.id, ns.subject, ns.status, ns.sent_at as sentAt,
        ns.recipient_count as recipientCount,
        count(CASE WHEN no2.opened_at IS NOT NULL THEN 1 END) as openedCount
      FROM newsletter_sends ns
      LEFT JOIN newsletter_opens no2 ON no2.send_id = ns.id
      GROUP BY ns.id
      ORDER BY ns.sent_at DESC
    `) as any[];

    return c.json({
      sends: sends.map((s: any) => ({
        id: s.id,
        subject: s.subject,
        status: s.status,
        sentAt: s.sentAt ? new Date(s.sentAt * 1000).toISOString() : null,
        recipientCount: s.recipientCount,
        openedCount: s.openedCount ?? 0,
        openRate: s.recipientCount && s.recipientCount > 0
          ? Math.round(((s.openedCount ?? 0) / s.recipientCount) * 100)
          : 0,
      })),
    });
  } catch (error) {
    console.error('Error fetching newsletter sends:', error);
    return c.json({ error: 'Error al obtener historial de envios' }, 500);
  }
});

// POST /admin/newsletter/draft - create or update weekly draft
admin.post('/newsletter/draft', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  try {
    const body = await c.req.json<{ subject: string }>();
    if (!body.subject || !body.subject.trim()) {
      return c.json({ error: 'Subject es requerido' }, 400);
    }

    const nextMonday = getNextMondayAt18UTC();

    // Check for existing draft/scheduled for the same send date
    const [existing] = await db
      .select()
      .from(schema.newsletterSends)
      .where(
        and(
          sql`${schema.newsletterSends.status} IN ('draft', 'scheduled')`,
          eq(schema.newsletterSends.scheduledFor, nextMonday)
        )
      )
      .limit(1);

    const now = new Date();

    if (existing) {
      await db
        .update(schema.newsletterSends)
        .set({ subject: body.subject.trim(), updatedAt: now })
        .where(eq(schema.newsletterSends.id, existing.id));

      return c.json({ ...existing, subject: body.subject.trim(), updatedAt: now.toISOString() });
    }

    const id = crypto.randomUUID();

    await db.insert(schema.newsletterSends).values({
      id,
      subject: body.subject.trim(),
      status: 'draft',
      scheduledFor: nextMonday,
      createdAt: now,
      updatedAt: now,
    });

    const [created] = await db
      .select()
      .from(schema.newsletterSends)
      .where(eq(schema.newsletterSends.id, id));

    return c.json(created);
  } catch (error) {
    console.error('Error creating newsletter draft:', error);
    return c.json({ error: 'Error al crear borrador' }, 500);
  }
});

// POST /admin/newsletter/send - send newsletter (optionally with sendId)
admin.post('/newsletter/send', async (c) => {
  try {
    console.log('[Admin] Manual newsletter trigger requested');
    let sendId: string | undefined;
    try {
      const body = await c.req.json<{ sendId?: string }>();
      sendId = body.sendId;
    } catch {
      // No body is fine
    }
    const result = await sendWeeklyNewsletter(c.env, sendId);
    return c.json({
      success: true,
      sent: result.sent,
      errors: result.errors,
      sendId: result.sendId,
    });
  } catch (error) {
    console.error('Error sending newsletter:', error);
    return c.json({ error: 'Error al enviar newsletter' }, 500);
  }
});

// GET /admin/feeds - list all feeds with owner info
admin.get('/feeds', async (c) => {
  const db = drizzle(c.env.DB, { schema });

  try {
    const result = await db
      .select({
        id: schema.feeds.id,
        name: schema.feeds.name,
        hash: schema.feeds.hash,
        type: schema.feeds.type,
        sourceUrl: schema.feeds.sourceUrl,
        autoPublish: schema.feeds.autoPublish,
        isActive: schema.feeds.isActive,
        lastProcessedAt: schema.feeds.lastProcessedAt,
        createdAt: schema.feeds.createdAt,
        userId: schema.feeds.userId,
        username: schema.users.username,
      })
      .from(schema.feeds)
      .leftJoin(schema.users, eq(schema.feeds.userId, schema.users.id))
      .orderBy(desc(schema.feeds.createdAt));

    return c.json({
      feeds: result.map((f) => ({
        id: f.id,
        name: f.name,
        type: f.type,
        email: f.type === 'email' ? `feed-${f.hash}@thestack.cl` : null,
        sourceUrl: f.sourceUrl,
        autoPublish: f.autoPublish,
        isActive: f.isActive,
        lastProcessedAt: f.lastProcessedAt ? new Date(f.lastProcessedAt).toISOString() : null,
        createdAt: new Date(f.createdAt).toISOString(),
        owner: { id: f.userId, username: f.username || 'unknown' },
      })),
    });
  } catch (error) {
    console.error('Error fetching admin feeds:', error);
    return c.json({ error: 'Error al obtener feeds' }, 500);
  }
});

// POST /admin/feeds/logs/:logId/retry - retry a failed feed log
admin.post('/feeds/logs/:logId/retry', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const logId = c.req.param('logId');

  try {
    const [log] = await db
      .select()
      .from(schema.feedLogs)
      .where(eq(schema.feedLogs.id, logId))
      .limit(1);

    if (!log) {
      return c.json({ error: 'Log no encontrado' }, 404);
    }

    if (log.status !== 'error' && log.status !== 'rate_limited') {
      return c.json({ error: 'Solo se pueden reintentar logs con error o rate limited' }, 400);
    }

    if (!log.rawBody) {
      return c.json({ error: 'No hay contenido guardado para reintentar' }, 400);
    }

    const [feed] = await db
      .select()
      .from(schema.feeds)
      .where(eq(schema.feeds.id, log.feedId))
      .limit(1);

    if (!feed) {
      return c.json({ error: 'Feed no encontrado' }, 404);
    }

    // Re-extract links from stored raw body
    const { extractLinks, extractLinksFromText } = await import('../lib/link-utils');
    const links = extractLinks(log.rawBody);
    if (links.length === 0) {
      const textLinks = extractLinksFromText(log.rawBody);
      links.push(...textLinks);
    }

    const agentRawBody = links.length === 0 ? log.rawBody : undefined;

    // Reset log status to processing
    await db
      .update(schema.feedLogs)
      .set({ status: 'processing', error: null })
      .where(eq(schema.feedLogs.id, logId));

    // Run agent
    const { runFeedAgent } = await import('../lib/feed-agent');
    c.executionCtx.waitUntil(
      runFeedAgent(links, feed, logId, c.env, agentRawBody).catch(async (err) => {
        console.error('[Feed Agent Retry] Error:', err);
        const dbInner = drizzle(c.env.DB, { schema });
        await dbInner
          .update(schema.feedLogs)
          .set({ status: 'error', error: classifyFetchError(err) })
          .where(eq(schema.feedLogs.id, logId));
      })
    );

    return c.json({ success: true });
  } catch (error) {
    console.error('Error retrying feed log:', error);
    return c.json({ error: 'Error al reintentar' }, 500);
  }
});

// DELETE /admin/feeds/:id - delete any feed
admin.delete('/feeds/:id', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const feedId = c.req.param('id');

  try {
    await db.delete(schema.feeds).where(eq(schema.feeds.id, feedId));
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting feed:', error);
    return c.json({ error: 'Error al eliminar feed' }, 500);
  }
});

// Migrate slugs for existing posts (one-time migration)
admin.post('/migrate-slugs', async (c) => {
  const db = drizzle(c.env.DB, { schema });

  try {
    // Get all posts without slugs
    const postsWithoutSlugs = await db
      .select({ id: schema.posts.id, title: schema.posts.title })
      .from(schema.posts)
      .where(isNull(schema.posts.slug));

    if (postsWithoutSlugs.length === 0) {
      return c.json({ message: 'No posts to migrate', migrated: 0 });
    }

    // Track used slugs for collision handling
    const slugCounts = new Map<string, number>();

    // Get existing slugs to avoid collisions
    const existingSlugs = await db
      .select({ slug: schema.posts.slug })
      .from(schema.posts);

    for (const { slug } of existingSlugs) {
      if (slug) {
        const baseSlug = slug.replace(/-\d+$/, '');
        slugCounts.set(baseSlug, (slugCounts.get(baseSlug) || 0) + 1);
      }
    }

    let migrated = 0;
    for (const post of postsWithoutSlugs) {
      const baseSlug = generateSlug(post.title);
      const count = slugCounts.get(baseSlug) || 0;

      const slug = count === 0 ? baseSlug : `${baseSlug}-${count + 1}`;
      slugCounts.set(baseSlug, count + 1);

      await db
        .update(schema.posts)
        .set({ slug })
        .where(eq(schema.posts.id, post.id));

      migrated++;
    }

    return c.json({ message: 'Migration completed', migrated });
  } catch (error) {
    console.error('Error migrating slugs:', error);
    return c.json({ error: 'Error al migrar slugs' }, 500);
  }
});

// ─── Analytics helpers ───

function parseDateRange(c: { req: { query: (k: string) => string | undefined } }) {
  const startStr = c.req.query('start');
  const endStr = c.req.query('end');
  const now = new Date();
  const start = startStr ? new Date(startStr + 'T00:00:00Z') : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const end = endStr ? new Date(endStr + 'T23:59:59Z') : now;
  return { start, end };
}

// GET /admin/analytics/overview
admin.get('/analytics/overview', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { start, end } = parseDateRange(c);
  try {
    const [views, visitors, clicks, opens] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(schema.pageViews)
        .where(and(gte(schema.pageViews.createdAt, start), lte(schema.pageViews.createdAt, end))),
      db.select({ count: sql<number>`count(distinct coalesce(user_id, user_agent))` }).from(schema.pageViews)
        .where(and(gte(schema.pageViews.createdAt, start), lte(schema.pageViews.createdAt, end))),
      db.select({ count: sql<number>`count(*)` }).from(schema.linkClicks)
        .where(and(gte(schema.linkClicks.createdAt, start), lte(schema.linkClicks.createdAt, end))),
      db.select({ count: sql<number>`count(*)` }).from(schema.newsletterOpens)
        .where(and(gte(schema.newsletterOpens.sendDate, start), lte(schema.newsletterOpens.sendDate, end), sql`opened_at IS NOT NULL`)),
    ]);
    return c.json({
      pageViews: views[0]?.count || 0,
      uniqueVisitors: visitors[0]?.count || 0,
      linkClicks: clicks[0]?.count || 0,
      newsletterOpens: opens[0]?.count || 0,
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    return c.json({ error: 'Error al obtener analytics' }, 500);
  }
});

// GET /admin/analytics/posts-per-day
admin.get('/analytics/posts-per-day', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { start, end } = parseDateRange(c);
  try {
    const rows = await db
      .select({ day: sql<string>`date(created_at, 'unixepoch')`, count: sql<number>`count(*)` })
      .from(schema.posts)
      .where(and(gte(schema.posts.createdAt, start), lte(schema.posts.createdAt, end)))
      .groupBy(sql`date(created_at, 'unixepoch')`)
      .orderBy(sql`date(created_at, 'unixepoch')`);
    return c.json({ data: rows });
  } catch (error) {
    console.error('Posts per day error:', error);
    return c.json({ error: 'Error' }, 500);
  }
});

// GET /admin/analytics/registrations-per-day
admin.get('/analytics/registrations-per-day', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { start, end } = parseDateRange(c);
  try {
    const rows = await db
      .select({ day: sql<string>`date(created_at, 'unixepoch')`, count: sql<number>`count(*)` })
      .from(schema.users)
      .where(and(gte(schema.users.createdAt, start), lte(schema.users.createdAt, end)))
      .groupBy(sql`date(created_at, 'unixepoch')`)
      .orderBy(sql`date(created_at, 'unixepoch')`);
    return c.json({ data: rows });
  } catch (error) {
    console.error('Registrations per day error:', error);
    return c.json({ error: 'Error' }, 500);
  }
});

// GET /admin/analytics/time-to-first-action
admin.get('/analytics/time-to-first-action', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { start, end } = parseDateRange(c);
  try {
    const [firstPost, firstComment, firstUpvote] = await Promise.all([
      db.all(sql`
        SELECT avg(first_action - registered) as avg_seconds FROM (
          SELECT u.created_at as registered, min(p.created_at) as first_action
          FROM users u JOIN posts p ON p.author_id = u.id
          WHERE u.created_at >= ${Math.floor(start.getTime() / 1000)} AND u.created_at <= ${Math.floor(end.getTime() / 1000)}
          GROUP BY u.id
        ) WHERE first_action IS NOT NULL
      `),
      db.all(sql`
        SELECT avg(first_action - registered) as avg_seconds FROM (
          SELECT u.created_at as registered, min(c.created_at) as first_action
          FROM users u JOIN comments c ON c.author_id = u.id
          WHERE u.created_at >= ${Math.floor(start.getTime() / 1000)} AND u.created_at <= ${Math.floor(end.getTime() / 1000)}
          GROUP BY u.id
        ) WHERE first_action IS NOT NULL
      `),
      db.all(sql`
        SELECT avg(first_action - registered) as avg_seconds FROM (
          SELECT u.created_at as registered, min(pu.created_at) as first_action
          FROM users u JOIN post_upvotes pu ON pu.user_id = u.id
          WHERE u.created_at >= ${Math.floor(start.getTime() / 1000)} AND u.created_at <= ${Math.floor(end.getTime() / 1000)}
          GROUP BY u.id
        ) WHERE first_action IS NOT NULL
      `),
    ]);
    return c.json({
      avgSecondsToFirstPost: (firstPost[0] as any)?.avg_seconds || null,
      avgSecondsToFirstComment: (firstComment[0] as any)?.avg_seconds || null,
      avgSecondsToFirstUpvote: (firstUpvote[0] as any)?.avg_seconds || null,
    });
  } catch (error) {
    console.error('Time to first action error:', error);
    return c.json({ error: 'Error' }, 500);
  }
});

// GET /admin/analytics/engagement
admin.get('/analytics/engagement', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { start, end } = parseDateRange(c);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000)));
  try {
    const [commentsCount, upvotesCount, postsCount] = await Promise.all([
      db.select({ count: sql<number>`count(*)` }).from(schema.comments)
        .where(and(gte(schema.comments.createdAt, start), lte(schema.comments.createdAt, end))),
      db.select({ count: sql<number>`count(*)` }).from(schema.postUpvotes)
        .where(and(gte(schema.postUpvotes.createdAt, start), lte(schema.postUpvotes.createdAt, end))),
      db.select({ count: sql<number>`count(*)` }).from(schema.posts)
        .where(and(gte(schema.posts.createdAt, start), lte(schema.posts.createdAt, end))),
    ]);
    const comments = commentsCount[0]?.count || 0;
    const upvotes = upvotesCount[0]?.count || 0;
    const postsCt = postsCount[0]?.count || 0;
    return c.json({
      commentsPerDay: +(comments / days).toFixed(1),
      upvotesPerDay: +(upvotes / days).toFixed(1),
      postsPerDay: +(postsCt / days).toFixed(1),
      commentsPerPost: postsCt > 0 ? +(comments / postsCt).toFixed(1) : 0,
      upvotesPerPost: postsCt > 0 ? +(upvotes / postsCt).toFixed(1) : 0,
    });
  } catch (error) {
    console.error('Engagement error:', error);
    return c.json({ error: 'Error' }, 500);
  }
});

// GET /admin/analytics/retention
admin.get('/analytics/retention', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { start, end } = parseDateRange(c);
  try {
    // DAU: distinct users with any activity per day (posts, comments, upvotes)
    const dauRows = await db.all(sql`
      SELECT day, count(distinct user_id) as active_users FROM (
        SELECT date(created_at, 'unixepoch') as day, author_id as user_id FROM posts
        WHERE created_at >= ${Math.floor(start.getTime() / 1000)} AND created_at <= ${Math.floor(end.getTime() / 1000)}
        UNION ALL
        SELECT date(created_at, 'unixepoch') as day, author_id as user_id FROM comments
        WHERE created_at >= ${Math.floor(start.getTime() / 1000)} AND created_at <= ${Math.floor(end.getTime() / 1000)}
        UNION ALL
        SELECT date(created_at, 'unixepoch') as day, user_id FROM post_upvotes
        WHERE created_at >= ${Math.floor(start.getTime() / 1000)} AND created_at <= ${Math.floor(end.getTime() / 1000)}
      ) GROUP BY day ORDER BY day
    `);
    // WAU: distinct users per ISO week
    const wauRows = await db.all(sql`
      SELECT week, count(distinct user_id) as active_users FROM (
        SELECT strftime('%Y-W%W', created_at, 'unixepoch') as week, author_id as user_id FROM posts
        WHERE created_at >= ${Math.floor(start.getTime() / 1000)} AND created_at <= ${Math.floor(end.getTime() / 1000)}
        UNION ALL
        SELECT strftime('%Y-W%W', created_at, 'unixepoch') as week, author_id as user_id FROM comments
        WHERE created_at >= ${Math.floor(start.getTime() / 1000)} AND created_at <= ${Math.floor(end.getTime() / 1000)}
        UNION ALL
        SELECT strftime('%Y-W%W', created_at, 'unixepoch') as week, user_id FROM post_upvotes
        WHERE created_at >= ${Math.floor(start.getTime() / 1000)} AND created_at <= ${Math.floor(end.getTime() / 1000)}
      ) GROUP BY week ORDER BY week
    `);
    return c.json({ dau: dauRows, wau: wauRows });
  } catch (error) {
    console.error('Retention error:', error);
    return c.json({ error: 'Error' }, 500);
  }
});

// GET /admin/analytics/newsletter
admin.get('/analytics/newsletter', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { start, end } = parseDateRange(c);
  try {
    const [subscriberCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.users)
      .where(and(eq(schema.users.emailVerified, true), eq(schema.users.newsletterEnabled, true), eq(schema.users.isBanned, false)));

    const sendRows = await db.all(sql`
      SELECT date(send_date, 'unixepoch') as send_day,
        count(*) as total,
        count(opened_at) as opened
      FROM newsletter_opens
      WHERE send_date >= ${Math.floor(start.getTime() / 1000)} AND send_date <= ${Math.floor(end.getTime() / 1000)}
      GROUP BY date(send_date, 'unixepoch')
      ORDER BY date(send_date, 'unixepoch')
    `);

    return c.json({
      activeSubscribers: subscriberCount.count,
      sends: sendRows,
    });
  } catch (error) {
    console.error('Newsletter analytics error:', error);
    return c.json({ error: 'Error' }, 500);
  }
});

// GET /admin/analytics/content
admin.get('/analytics/content', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { start, end } = parseDateRange(c);
  try {
    const topPosts = await db
      .select({
        id: schema.posts.id,
        title: schema.posts.title,
        domain: schema.posts.domain,
        upvotesCount: schema.posts.upvotesCount,
        authorUsername: schema.users.username,
      })
      .from(schema.posts)
      .leftJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
      .where(and(gte(schema.posts.createdAt, start), lte(schema.posts.createdAt, end), eq(schema.posts.isDeleted, false)))
      .orderBy(desc(schema.posts.upvotesCount))
      .limit(10);

    const topUsers = await db.all(sql`
      SELECT u.username, count(p.id) as post_count, coalesce(sum(p.upvotes_count), 0) as total_upvotes
      FROM users u JOIN posts p ON p.author_id = u.id
      WHERE p.created_at >= ${Math.floor(start.getTime() / 1000)} AND p.created_at <= ${Math.floor(end.getTime() / 1000)} AND p.is_deleted = 0
      GROUP BY u.id ORDER BY total_upvotes DESC LIMIT 10
    `);

    const topDomains = await db.all(sql`
      SELECT domain, count(*) as post_count, coalesce(sum(upvotes_count), 0) as total_upvotes
      FROM posts
      WHERE created_at >= ${Math.floor(start.getTime() / 1000)} AND created_at <= ${Math.floor(end.getTime() / 1000)} AND is_deleted = 0
      GROUP BY domain ORDER BY post_count DESC LIMIT 10
    `);

    return c.json({ topPosts, topUsers, topDomains });
  } catch (error) {
    console.error('Content analytics error:', error);
    return c.json({ error: 'Error' }, 500);
  }
});

// GET /admin/analytics/activation-funnel
admin.get('/analytics/activation-funnel', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { start, end } = parseDateRange(c);
  try {
    const [totalUsers] = await db.select({ count: sql<number>`count(*)` }).from(schema.users)
      .where(and(gte(schema.users.createdAt, start), lte(schema.users.createdAt, end)));
    const [posters] = await db.all(sql`
      SELECT count(distinct author_id) as count FROM posts WHERE author_id IN (
        SELECT id FROM users WHERE created_at >= ${Math.floor(start.getTime() / 1000)} AND created_at <= ${Math.floor(end.getTime() / 1000)}
      )
    `) as any[];
    const [commenters] = await db.all(sql`
      SELECT count(distinct author_id) as count FROM comments WHERE author_id IN (
        SELECT id FROM users WHERE created_at >= ${Math.floor(start.getTime() / 1000)} AND created_at <= ${Math.floor(end.getTime() / 1000)}
      )
    `) as any[];
    const [upvoters] = await db.all(sql`
      SELECT count(distinct user_id) as count FROM post_upvotes WHERE user_id IN (
        SELECT id FROM users WHERE created_at >= ${Math.floor(start.getTime() / 1000)} AND created_at <= ${Math.floor(end.getTime() / 1000)}
      )
    `) as any[];

    const total = totalUsers.count || 0;
    return c.json({
      totalUsers: total,
      posted: posters?.count || 0,
      commented: commenters?.count || 0,
      upvoted: upvoters?.count || 0,
      postedPct: total > 0 ? +((posters?.count || 0) / total * 100).toFixed(1) : 0,
      commentedPct: total > 0 ? +((commenters?.count || 0) / total * 100).toFixed(1) : 0,
      upvotedPct: total > 0 ? +((upvoters?.count || 0) / total * 100).toFixed(1) : 0,
    });
  } catch (error) {
    console.error('Activation funnel error:', error);
    return c.json({ error: 'Error' }, 500);
  }
});

// GET /admin/analytics/page-views
admin.get('/analytics/page-views', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { start, end } = parseDateRange(c);
  try {
    const perDay = await db
      .select({ day: sql<string>`date(created_at, 'unixepoch')`, count: sql<number>`count(*)` })
      .from(schema.pageViews)
      .where(and(gte(schema.pageViews.createdAt, start), lte(schema.pageViews.createdAt, end)))
      .groupBy(sql`date(created_at, 'unixepoch')`)
      .orderBy(sql`date(created_at, 'unixepoch')`);

    const topPaths = await db
      .select({ path: schema.pageViews.path, count: sql<number>`count(*)` })
      .from(schema.pageViews)
      .where(and(gte(schema.pageViews.createdAt, start), lte(schema.pageViews.createdAt, end)))
      .groupBy(schema.pageViews.path)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    return c.json({ perDay, topPaths });
  } catch (error) {
    console.error('Page views analytics error:', error);
    return c.json({ error: 'Error' }, 500);
  }
});

// GET /admin/analytics/link-clicks
admin.get('/analytics/link-clicks', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { start, end } = parseDateRange(c);
  try {
    const perDay = await db
      .select({ day: sql<string>`date(created_at, 'unixepoch')`, count: sql<number>`count(*)` })
      .from(schema.linkClicks)
      .where(and(gte(schema.linkClicks.createdAt, start), lte(schema.linkClicks.createdAt, end)))
      .groupBy(sql`date(created_at, 'unixepoch')`)
      .orderBy(sql`date(created_at, 'unixepoch')`);

    const topPosts = await db.all(sql`
      SELECT lc.post_id, p.title, count(*) as click_count
      FROM link_clicks lc LEFT JOIN posts p ON p.id = lc.post_id
      WHERE lc.created_at >= ${Math.floor(start.getTime() / 1000)} AND lc.created_at <= ${Math.floor(end.getTime() / 1000)}
      GROUP BY lc.post_id ORDER BY click_count DESC LIMIT 10
    `);

    return c.json({ perDay, topPosts });
  } catch (error) {
    console.error('Link clicks analytics error:', error);
    return c.json({ error: 'Error' }, 500);
  }
});

// ─── Scoring config ───

interface ScoringBody {
  gravity: number;
  boost: number;
  ageOffsetHours: number;
  recalcWindowHours: number;
}

function validateScoringParams(body: ScoringBody): string | null {
  if (body.gravity < 0.5 || body.gravity > 3.0) return 'Gravity debe estar entre 0.5 y 3.0';
  if (body.boost < 0 || body.boost > 5.0) return 'Boost debe estar entre 0.0 y 5.0';
  if (body.ageOffsetHours < 0.5 || body.ageOffsetHours > 10.0) return 'Age offset debe estar entre 0.5 y 10.0';
  if (body.recalcWindowHours < 24 || body.recalcWindowHours > 720) return 'Ventana debe estar entre 24 y 720 horas';
  return null;
}

// GET /admin/scoring - current config + top 50 posts
admin.get('/scoring', async (c) => {
  const db = drizzle(c.env.DB, { schema });

  try {
    const config = await getScoringConfig(db);

    const topPosts = await db
      .select({
        id: schema.posts.id,
        title: schema.posts.title,
        upvotesCount: schema.posts.upvotesCount,
        score: schema.posts.score,
        publishedAt: schema.posts.publishedAt,
        createdAt: schema.posts.createdAt,
        authorUsername: schema.users.username,
      })
      .from(schema.posts)
      .leftJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
      .where(and(eq(schema.posts.isDeleted, false), eq(schema.posts.status, 'published')))
      .orderBy(desc(schema.posts.score))
      .limit(50);

    return c.json({
      config,
      posts: topPosts.map((p) => ({
        id: p.id,
        title: p.title,
        upvotesCount: p.upvotesCount,
        currentScore: p.score,
        publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
        createdAt: new Date(p.createdAt).toISOString(),
        authorUsername: p.authorUsername || 'unknown',
      })),
    });
  } catch (error) {
    console.error('Error al obtener configuracion de scoring:', error);
    return c.json({ error: 'Error al obtener configuracion de scoring' }, 500);
  }
});

// POST /admin/scoring/simulate - simulate with new params
admin.post('/scoring/simulate', async (c) => {
  const db = drizzle(c.env.DB, { schema });

  try {
    const body = await c.req.json<ScoringBody>();
    const validationError = validateScoringParams(body);
    if (validationError) return c.json({ error: validationError }, 400);

    // Constrain to the recalc window — posts outside it would not be re-ranked
    // by the cron anyway, so they're not relevant for the simulation preview.
    const cutoff = new Date(Date.now() - body.recalcWindowHours * 60 * 60 * 1000);
    const allPosts = await db
      .select({
        id: schema.posts.id,
        title: schema.posts.title,
        upvotesCount: schema.posts.upvotesCount,
        score: schema.posts.score,
        publishedAt: schema.posts.publishedAt,
        createdAt: schema.posts.createdAt,
        authorUsername: schema.users.username,
      })
      .from(schema.posts)
      .leftJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
      .where(
        and(
          eq(schema.posts.isDeleted, false),
          eq(schema.posts.status, 'published'),
          gte(schema.posts.createdAt, cutoff)
        )
      )
      .orderBy(desc(schema.posts.score));

    const newParams = { gravity: body.gravity, boost: body.boost, ageOffsetHours: body.ageOffsetHours };

    const postsWithNewScores = allPosts.map((p, idx) => ({
      id: p.id,
      title: p.title,
      upvotesCount: p.upvotesCount,
      currentScore: p.score,
      currentRank: idx + 1,
      newScore: calculateHNScore(p.upvotesCount, p.publishedAt ?? p.createdAt, newParams),
      publishedAt: p.publishedAt ? new Date(p.publishedAt).toISOString() : null,
      createdAt: new Date(p.createdAt).toISOString(),
      authorUsername: p.authorUsername || 'unknown',
    }));

    // Sort by new score descending
    postsWithNewScores.sort((a, b) => b.newScore - a.newScore);

    // Return top 50 with rank change info
    const result = postsWithNewScores.slice(0, 50).map((p, idx) => ({
      ...p,
      newRank: idx + 1,
      rankChange: p.currentRank - (idx + 1),
    }));

    return c.json({ posts: result, totalPosts: allPosts.length });
  } catch (error) {
    console.error('Error al simular scoring:', error);
    return c.json({ error: 'Error al simular scoring' }, 500);
  }
});

// POST /admin/scoring/apply - save config + recalculate ALL scores
admin.post('/scoring/apply', async (c) => {
  const db = drizzle(c.env.DB, { schema });

  try {
    const body = await c.req.json<ScoringBody>();
    const validationError = validateScoringParams(body);
    if (validationError) return c.json({ error: validationError }, 400);

    const now = new Date();

    // Upsert config + fetch posts in parallel
    const [, allPosts] = await Promise.all([
      db
        .insert(schema.scoringConfig)
        .values({
          id: 'default',
          gravity: body.gravity,
          boost: body.boost,
          ageOffsetHours: body.ageOffsetHours,
          recalcWindowHours: body.recalcWindowHours,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: schema.scoringConfig.id,
          set: {
            gravity: body.gravity,
            boost: body.boost,
            ageOffsetHours: body.ageOffsetHours,
            recalcWindowHours: body.recalcWindowHours,
            updatedAt: now,
          },
        }),
      db
        .select({
          id: schema.posts.id,
          upvotesCount: schema.posts.upvotesCount,
          publishedAt: schema.posts.publishedAt,
          createdAt: schema.posts.createdAt,
        })
        .from(schema.posts)
        .where(and(eq(schema.posts.isDeleted, false), eq(schema.posts.status, 'published'))),
    ]);

    // Recalculate ALL published post scores in batch
    const newParams = { gravity: body.gravity, boost: body.boost, ageOffsetHours: body.ageOffsetHours };

    const updates = allPosts.map((post) => {
      const newScore = calculateHNScore(post.upvotesCount, post.publishedAt ?? post.createdAt, newParams);
      return db.update(schema.posts).set({ score: newScore }).where(eq(schema.posts.id, post.id));
    });

    await batchInChunks(db, updates);

    console.log(`[Admin] Scoring config applied: gravity=${body.gravity}, boost=${body.boost}, offset=${body.ageOffsetHours}, window=${body.recalcWindowHours}. Updated ${allPosts.length} posts.`);

    return c.json({ success: true, updated: allPosts.length });
  } catch (error) {
    console.error('Error al aplicar configuracion de scoring:', error);
    return c.json({ error: 'Error al aplicar configuracion de scoring' }, 500);
  }
});

export default admin;
