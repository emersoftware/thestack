import { Hono } from 'hono';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import type { Env } from '../lib/auth';
import * as schema from '../db/schema';
import { requireAuth, type AuthVariables, type AuthUser } from '../middleware/auth';

const users = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

const updateUserSchema = z.object({
  about: z.string().max(500, 'Bio muy larga (max 500)').optional(),
  newsletterEnabled: z.boolean().optional(),
  showAuthor: z.boolean().optional(),
});

users.get('/:username', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const username = c.req.param('username');
  const currentUser = c.get('user') as AuthUser | undefined;

  try {
    const user = await db
      .select({
        username: schema.users.username,
        karma: schema.users.karma,
        about: schema.users.about,
        createdAt: schema.users.createdAt,
        newsletterEnabled: schema.users.newsletterEnabled,
        showAuthor: schema.users.showAuthor,
      })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (user.length === 0) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }

    const isOwnProfile = currentUser?.username === username;

    let pendingCount: number | undefined;
    if (isOwnProfile) {
      const [countResult] = await db
        .select({ count: sql<number>`count(*)` })
        .from(schema.posts)
        .where(
          and(
            eq(schema.posts.authorId, currentUser!.id),
            eq(schema.posts.status, 'pending'),
            eq(schema.posts.source, 'feed'),
            eq(schema.posts.isDeleted, false)
          )
        );
      pendingCount = countResult?.count || 0;
    }

    return c.json({
      username: user[0].username,
      karma: user[0].karma,
      about: user[0].about,
      createdAt: user[0].createdAt ? new Date(user[0].createdAt).toISOString() : null,
      // Only include newsletter preference, showAuthor and pending count for own profile
      ...(isOwnProfile && { newsletterEnabled: user[0].newsletterEnabled, showAuthor: user[0].showAuthor, pendingCount }),
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({ error: 'Error al obtener usuario' }, 500);
  }
});

users.get('/:username/posts', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const currentUser = c.get('user');
  const username = c.req.param('username');
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = 30;
  const offset = (page - 1) * limit;

  try {
    const user = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (user.length === 0) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }

    const posts = await db
      .select({
        id: schema.posts.id,
        title: schema.posts.title,
        url: schema.posts.url,
        domain: schema.posts.domain,
        upvotesCount: schema.posts.upvotesCount,
        score: schema.posts.score,
        createdAt: schema.posts.createdAt,
        authorId: schema.posts.authorId,
        authorUsername: schema.users.username,
        authorShowAuthor: schema.users.showAuthor,
      })
      .from(schema.posts)
      .leftJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
      .where(
        and(
          eq(schema.posts.authorId, user[0].id),
          eq(schema.posts.isDeleted, false),
          eq(schema.posts.status, 'published')
        )
      )
      .orderBy(desc(schema.posts.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = posts.length > limit;
    const postsToReturn = hasMore ? posts.slice(0, limit) : posts;

    // If user is authenticated, fetch their upvotes for these posts
    let userUpvotes = new Set<string>();
    if (currentUser && postsToReturn.length > 0) {
      const postIds = postsToReturn.map((p) => p.id);
      const upvotes = await db
        .select({ postId: schema.postUpvotes.postId })
        .from(schema.postUpvotes)
        .where(
          and(
            eq(schema.postUpvotes.userId, currentUser.id),
            inArray(schema.postUpvotes.postId, postIds)
          )
        );
      userUpvotes = new Set(upvotes.map((u) => u.postId));
    }

    return c.json({
      posts: postsToReturn.map((p) => ({
        id: p.id,
        title: p.title,
        url: p.url,
        domain: p.domain,
        upvotesCount: p.upvotesCount,
        score: p.score,
        createdAt: p.createdAt ? new Date(p.createdAt).toISOString() : null,
        author: {
          id: p.authorId,
          username: p.authorUsername || 'unknown',
          showAuthor: p.authorShowAuthor ?? true,
        },
        ...(currentUser && { hasUpvoted: userUpvotes.has(p.id) }),
      })),
      hasMore,
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return c.json({ error: 'Error al obtener posts' }, 500);
  }
});

// Middleware checks auth + ban status
users.put('/:username', requireAuth(), async (c) => {
  const user = c.get('user') as AuthUser;

  const db = drizzle(c.env.DB, { schema });
  const username = c.req.param('username');

  try {
    // Check if user is editing their own profile
    if (user.username !== username) {
      return c.json({ error: 'No puedes editar otro perfil' }, 403);
    }

    const body = await c.req.json();
    const validation = updateUserSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ error: validation.error.issues[0].message }, 400);
    }

    const { about, newsletterEnabled, showAuthor } = validation.data;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (about !== undefined) {
      updateData.about = about;
    }
    if (newsletterEnabled !== undefined) {
      updateData.newsletterEnabled = newsletterEnabled;
    }
    if (showAuthor !== undefined) {
      updateData.showAuthor = showAuthor;
    }

    await db
      .update(schema.users)
      .set(updateData)
      .where(eq(schema.users.id, user.id));

    return c.json({ success: true, about: about ?? '', newsletterEnabled, showAuthor });
  } catch (error) {
    console.error('Error updating user:', error);
    return c.json({ error: 'Error al actualizar perfil' }, 500);
  }
});

export default users;
