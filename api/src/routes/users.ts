import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and } from 'drizzle-orm';
import { createAuth, type Env } from '../lib/auth';
import * as schema from '../db/schema';

const users = new Hono<{ Bindings: Env }>();

users.get('/:username', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const username = c.req.param('username');

  try {
    const user = await db
      .select({
        username: schema.users.username,
        karma: schema.users.karma,
        about: schema.users.about,
        createdAt: schema.users.createdAt,
      })
      .from(schema.users)
      .where(eq(schema.users.username, username))
      .limit(1);

    if (user.length === 0) {
      return c.json({ error: 'Usuario no encontrado' }, 404);
    }

    return c.json({
      ...user[0],
      createdAt: user[0].createdAt ? new Date(user[0].createdAt).toISOString() : null,
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return c.json({ error: 'Error al obtener usuario' }, 500);
  }
});

users.get('/:username/posts', async (c) => {
  const db = drizzle(c.env.DB, { schema });
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
      })
      .from(schema.posts)
      .leftJoin(schema.users, eq(schema.posts.authorId, schema.users.id))
      .where(
        and(
          eq(schema.posts.authorId, user[0].id),
          eq(schema.posts.isDeleted, false)
        )
      )
      .orderBy(desc(schema.posts.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = posts.length > limit;
    const postsToReturn = hasMore ? posts.slice(0, limit) : posts;

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
        },
      })),
      hasMore,
    });
  } catch (error) {
    console.error('Error fetching user posts:', error);
    return c.json({ error: 'Error al obtener posts' }, 500);
  }
});

users.put('/:username', async (c) => {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    return c.json({ error: 'No autenticado' }, 401);
  }

  const db = drizzle(c.env.DB, { schema });
  const username = c.req.param('username');

  try {
    const currentUser = await db
      .select({ username: schema.users.username })
      .from(schema.users)
      .where(eq(schema.users.id, session.user.id))
      .limit(1);

    if (currentUser[0]?.username !== username) {
      return c.json({ error: 'No puedes editar otro perfil' }, 403);
    }

    const body = await c.req.json();
    const about = body.about?.slice(0, 500) || '';

    await db
      .update(schema.users)
      .set({ about, updatedAt: new Date() })
      .where(eq(schema.users.id, session.user.id));

    return c.json({ success: true, about });
  } catch (error) {
    console.error('Error updating user:', error);
    return c.json({ error: 'Error al actualizar perfil' }, 500);
  }
});

export default users;
