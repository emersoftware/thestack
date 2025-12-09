import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and, sql } from 'drizzle-orm';
import type { Env } from '../lib/auth';
import * as schema from '../db/schema';

const sites = new Hono<{ Bindings: Env }>();

sites.get('/:domain/posts', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const domain = c.req.param('domain');
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = 30;
  const offset = (page - 1) * limit;

  try {
    const countResult = await db
      .select({ count: sql<number>`count(*)` })
      .from(schema.posts)
      .where(
        and(eq(schema.posts.domain, domain), eq(schema.posts.isDeleted, false))
      );

    const totalPosts = countResult[0]?.count || 0;

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
        and(eq(schema.posts.domain, domain), eq(schema.posts.isDeleted, false))
      )
      .orderBy(desc(schema.posts.createdAt))
      .limit(limit + 1)
      .offset(offset);

    const hasMore = posts.length > limit;
    const postsToReturn = hasMore ? posts.slice(0, limit) : posts;

    return c.json({
      domain,
      totalPosts,
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
    console.error('Error fetching site posts:', error);
    return c.json({ error: 'Error al obtener posts' }, 500);
  }
});

export default sites;
