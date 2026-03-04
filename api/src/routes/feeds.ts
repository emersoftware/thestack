import { Hono } from 'hono';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, desc, sql, gte } from 'drizzle-orm';
import type { Env } from '../lib/auth';
import * as schema from '../db/schema';
import { generateId, calculateHNScore } from '../lib/utils';
import { requireAuth, requireVerifiedEmail, type AuthVariables, type AuthUser } from '../middleware/auth';

const createFeedSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(100, 'Nombre muy largo (max 100)'),
  autoPublish: z.boolean().optional().default(false),
});

const updateFeedSchema = z.object({
  name: z.string().min(1, 'Nombre es requerido').max(100, 'Nombre muy largo (max 100)').optional(),
  autoPublish: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

const feeds = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

function generateEmailHash(): string {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

// GET /api/feeds - list user's feeds
feeds.get('/', requireAuth(), async (c) => {
  const user = c.get('user') as AuthUser;
  const db = drizzle(c.env.DB, { schema });

  try {
    const result = await db
      .select()
      .from(schema.feeds)
      .where(eq(schema.feeds.userId, user.id))
      .orderBy(desc(schema.feeds.createdAt));

    return c.json({
      feeds: result.map((f) => ({
        id: f.id,
        name: f.name,
        email: `feed-${f.emailHash}@thestack.cl`,
        autoPublish: f.autoPublish,
        isActive: f.isActive,
        lastProcessedAt: f.lastProcessedAt ? new Date(f.lastProcessedAt).toISOString() : null,
        createdAt: new Date(f.createdAt).toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching feeds:', error);
    return c.json({ error: 'Error al obtener feeds' }, 500);
  }
});

// POST /api/feeds - create a new feed
feeds.post('/', requireVerifiedEmail(), async (c) => {
  const user = c.get('user') as AuthUser;
  const db = drizzle(c.env.DB, { schema });

  try {
    const body = await c.req.json();
    const validation = createFeedSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ error: validation.error.issues[0].message }, 400);
    }

    const { name, autoPublish } = validation.data;

    // Rate limit: max 3 active feeds for non-admins
    if (!user.isAdmin) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.feeds)
        .where(and(eq(schema.feeds.userId, user.id), eq(schema.feeds.isActive, true)));

      if ((countResult?.count || 0) >= 3) {
        return c.json({ error: 'Has alcanzado el limite de 3 feeds activos' }, 429);
      }
    }

    const now = new Date();
    const id = generateId();
    const emailHash = generateEmailHash();

    await db.insert(schema.feeds).values({
      id,
      userId: user.id,
      name: name.trim(),
      emailHash,
      autoPublish,
      isActive: true,
      createdAt: now,
      updatedAt: now,
    });

    return c.json({
      id,
      name: name.trim(),
      email: `feed-${emailHash}@thestack.cl`,
      autoPublish,
    }, 201);
  } catch (error) {
    console.error('Error creating feed:', error);
    return c.json({ error: 'Error al crear feed' }, 500);
  }
});

// --- Static routes MUST come before /:id ---

// GET /api/feeds/pending - user's pending feed posts
feeds.get('/pending', requireAuth(), async (c) => {
  const user = c.get('user') as AuthUser;
  const db = drizzle(c.env.DB, { schema });

  try {
    const pendingPosts = await db
      .select({
        id: schema.posts.id,
        title: schema.posts.title,
        url: schema.posts.url,
        domain: schema.posts.domain,
        createdAt: schema.posts.createdAt,
        feedName: schema.feeds.name,
      })
      .from(schema.posts)
      .leftJoin(schema.feeds, eq(schema.posts.feedId, schema.feeds.id))
      .where(
        and(
          eq(schema.posts.authorId, user.id),
          eq(schema.posts.status, 'pending'),
          eq(schema.posts.isDeleted, false),
          eq(schema.posts.source, 'feed')
        )
      )
      .orderBy(desc(schema.posts.createdAt));

    return c.json({
      posts: pendingPosts.map((p) => ({
        id: p.id,
        title: p.title,
        url: p.url,
        domain: p.domain,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
        feedName: p.feedName,
      })),
    });
  } catch (error) {
    console.error('Error fetching pending posts:', error);
    return c.json({ error: 'Error al obtener posts pendientes' }, 500);
  }
});

// PUT /api/feeds/posts/:postId/approve - approve a pending post
feeds.put('/posts/:postId/approve', requireAuth(), async (c) => {
  const user = c.get('user') as AuthUser;
  const db = drizzle(c.env.DB, { schema });
  const postId = c.req.param('postId');

  try {
    const [post] = await db
      .select()
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.id, postId),
          eq(schema.posts.authorId, user.id),
          eq(schema.posts.status, 'pending'),
          eq(schema.posts.source, 'feed')
        )
      )
      .limit(1);

    if (!post) {
      return c.json({ error: 'Post no encontrado' }, 404);
    }

    // Rate limit: max 10 published posts per day per user
    const ONE_DAY = 24 * 60 * 60 * 1000;
    const [todayPosts] = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.authorId, user.id),
          gte(schema.posts.createdAt, new Date(Date.now() - ONE_DAY)),
          eq(schema.posts.status, 'published')
        )
      );

    if ((todayPosts?.count || 0) >= 10) {
      return c.json({ error: 'Has alcanzado el limite de 10 posts publicados por dia' }, 429);
    }

    const now = new Date();
    const initialScore = calculateHNScore(1, now);

    await db.batch([
      db.update(schema.posts)
        .set({ status: 'published', updatedAt: now, score: initialScore, upvotesCount: 1 })
        .where(eq(schema.posts.id, postId)),
      db.insert(schema.postUpvotes).values({
        id: generateId(),
        postId,
        userId: user.id,
        createdAt: now,
      }),
      db.update(schema.users)
        .set({ karma: sql`${schema.users.karma} + 1` })
        .where(eq(schema.users.id, user.id)),
    ]);

    return c.json({ success: true });
  } catch (error) {
    console.error('Error approving post:', error);
    return c.json({ error: 'Error al aprobar post' }, 500);
  }
});

// PUT /api/feeds/posts/:postId/title - update title of a pending post
feeds.put('/posts/:postId/title', requireAuth(), async (c) => {
  const user = c.get('user') as AuthUser;
  const db = drizzle(c.env.DB, { schema });
  const postId = c.req.param('postId');

  try {
    const body = await c.req.json();
    const title = body.title?.trim();
    if (!title || title.length === 0) {
      return c.json({ error: 'Titulo es requerido' }, 400);
    }
    if (title.length > 200) {
      return c.json({ error: 'Titulo muy largo (max 200)' }, 400);
    }

    const [post] = await db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.id, postId),
          eq(schema.posts.authorId, user.id),
          eq(schema.posts.status, 'pending'),
          eq(schema.posts.source, 'feed')
        )
      )
      .limit(1);

    if (!post) {
      return c.json({ error: 'Post no encontrado' }, 404);
    }

    await db
      .update(schema.posts)
      .set({ title, updatedAt: new Date() })
      .where(eq(schema.posts.id, postId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating post title:', error);
    return c.json({ error: 'Error al actualizar titulo' }, 500);
  }
});

// DELETE /api/feeds/posts/:postId - reject a pending post
feeds.delete('/posts/:postId', requireAuth(), async (c) => {
  const user = c.get('user') as AuthUser;
  const db = drizzle(c.env.DB, { schema });
  const postId = c.req.param('postId');

  try {
    const [post] = await db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(
        and(
          eq(schema.posts.id, postId),
          eq(schema.posts.authorId, user.id),
          eq(schema.posts.status, 'pending'),
          eq(schema.posts.source, 'feed')
        )
      )
      .limit(1);

    if (!post) {
      return c.json({ error: 'Post no encontrado' }, 404);
    }

    await db
      .update(schema.posts)
      .set({ status: 'rejected', updatedAt: new Date() })
      .where(eq(schema.posts.id, postId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error rejecting post:', error);
    return c.json({ error: 'Error al rechazar post' }, 500);
  }
});

// --- Dynamic /:id routes ---

// PUT /api/feeds/:id - update feed
feeds.put('/:id', requireAuth(), async (c) => {
  const user = c.get('user') as AuthUser;
  const db = drizzle(c.env.DB, { schema });
  const feedId = c.req.param('id');

  try {
    const [feed] = await db
      .select()
      .from(schema.feeds)
      .where(and(eq(schema.feeds.id, feedId), eq(schema.feeds.userId, user.id)))
      .limit(1);

    if (!feed) {
      return c.json({ error: 'Feed no encontrado' }, 404);
    }

    const body = await c.req.json();
    const validation = updateFeedSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ error: validation.error.issues[0].message }, 400);
    }

    const { name, autoPublish, isActive } = validation.data;
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (name !== undefined) updates.name = name.trim();
    if (autoPublish !== undefined) updates.autoPublish = autoPublish;
    if (isActive !== undefined) updates.isActive = isActive;

    await db
      .update(schema.feeds)
      .set(updates)
      .where(eq(schema.feeds.id, feedId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error updating feed:', error);
    return c.json({ error: 'Error al actualizar feed' }, 500);
  }
});

// DELETE /api/feeds/:id - delete feed
feeds.delete('/:id', requireAuth(), async (c) => {
  const user = c.get('user') as AuthUser;
  const db = drizzle(c.env.DB, { schema });
  const feedId = c.req.param('id');

  try {
    const [feed] = await db
      .select()
      .from(schema.feeds)
      .where(and(eq(schema.feeds.id, feedId), eq(schema.feeds.userId, user.id)))
      .limit(1);

    if (!feed) {
      return c.json({ error: 'Feed no encontrado' }, 404);
    }

    await db.delete(schema.feeds).where(eq(schema.feeds.id, feedId));
    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting feed:', error);
    return c.json({ error: 'Error al eliminar feed' }, 500);
  }
});

// GET /api/feeds/:id/logs - feed processing logs
feeds.get('/:id/logs', requireAuth(), async (c) => {
  const user = c.get('user') as AuthUser;
  const db = drizzle(c.env.DB, { schema });
  const feedId = c.req.param('id');

  try {
    const [feed] = await db
      .select({ id: schema.feeds.id })
      .from(schema.feeds)
      .where(and(eq(schema.feeds.id, feedId), eq(schema.feeds.userId, user.id)))
      .limit(1);

    if (!feed) {
      return c.json({ error: 'Feed no encontrado' }, 404);
    }

    const logs = await db
      .select()
      .from(schema.feedLogs)
      .where(eq(schema.feedLogs.feedId, feedId))
      .orderBy(desc(schema.feedLogs.createdAt))
      .limit(50);

    return c.json({
      logs: logs.map((l) => ({
        id: l.id,
        emailSubject: l.emailSubject,
        emailFrom: l.emailFrom,
        status: l.status,
        error: l.error,
        createdAt: new Date(l.createdAt).toISOString(),
      })),
    });
  } catch (error) {
    console.error('Error fetching feed logs:', error);
    return c.json({ error: 'Error al obtener logs' }, 500);
  }
});

export default feeds;
