import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, sql, desc } from 'drizzle-orm';
import { createAuth, type Env } from '../lib/auth';
import * as schema from '../db/schema';

type Variables = {
  adminUser: { id: string };
};

const admin = new Hono<{ Bindings: Env; Variables: Variables }>();

async function requireAdmin(c: any, next: any) {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    return c.json({ error: 'No autenticado' }, 401);
  }

  const db = drizzle(c.env.DB, { schema });
  const user = await db
    .select({ isAdmin: schema.users.isAdmin })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);

  if (!user[0]?.isAdmin) {
    return c.json({ error: 'No autorizado' }, 403);
  }

  c.set('adminUser', session.user);
  await next();
}

admin.use('*', requireAdmin);

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

admin.put('/users/:id/promote', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const userId = c.req.param('id');

  try {
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
  const adminUser = c.get('adminUser');

  if (userId === adminUser.id) {
    return c.json({ error: 'No puedes degradarte a ti mismo' }, 400);
  }

  try {
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
  const adminUser = c.get('adminUser');

  if (userId === adminUser.id) {
    return c.json({ error: 'No puedes banearte a ti mismo' }, 400);
  }

  try {
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

export default admin;
