import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, sql, desc, isNull } from 'drizzle-orm';
import type { Env } from '../lib/auth';
import * as schema from '../db/schema';
import { requireAdmin, requireSuperAdmin, type AuthVariables, type AuthUser } from '../middleware/auth';
import { sendWeeklyNewsletter } from '../lib/newsletter';
import { generateSlug } from '../lib/utils';

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

admin.put('/users/:id/promote', async (c) => {
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

// Manually trigger the weekly newsletter (admin only)
admin.post('/newsletter/send', async (c) => {
  try {
    console.log('[Admin] Manual newsletter trigger requested');
    const result = await sendWeeklyNewsletter(c.env);
    return c.json({
      success: true,
      sent: result.sent,
      errors: result.errors,
    });
  } catch (error) {
    console.error('Error sending newsletter:', error);
    return c.json({ error: 'Error al enviar newsletter' }, 500);
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

export default admin;
