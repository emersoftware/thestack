import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, gte } from 'drizzle-orm';
import health from './routes/health';
import auth from './routes/auth';
import posts from './routes/posts';
import users from './routes/users';
import sites from './routes/sites';
import admin from './routes/admin';
import * as schema from './db/schema';
import { calculateHNScore } from './lib/utils';
import type { Env } from './lib/auth';

const app = new Hono<{ Bindings: Env }>();

app.use('*', logger());
app.use(
  '*',
  cors({
    origin: ['http://localhost:5173', 'https://thestack.cl'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

app.route('/api/health', health);
app.route('/api/auth', auth);
app.route('/api/posts', posts);
app.route('/api/users', users);
app.route('/api/sites', sites);
app.route('/api/admin', admin);

app.get('/', (c) => {
  return c.json({
    name: 'the stack API',
    version: '0.1.0',
    environment: c.env.ENVIRONMENT,
  });
});

app.notFound((c) => {
  return c.json({ error: 'Not Found' }, 404);
});

app.onError((err, c) => {
  console.error(`Error: ${err.message}`);
  return c.json({ error: 'Internal Server Error' }, 500);
});

export default {
  fetch: app.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const db = drizzle(env.DB, { schema });
    const cutoffTime = new Date(Date.now() - 168 * 60 * 60 * 1000);

    try {
      const recentPosts = await db
        .select({
          id: schema.posts.id,
          upvotesCount: schema.posts.upvotesCount,
          createdAt: schema.posts.createdAt,
        })
        .from(schema.posts)
        .where(
          and(
            gte(schema.posts.createdAt, cutoffTime),
            eq(schema.posts.isDeleted, false)
          )
        );

      for (const post of recentPosts) {
        const newScore = calculateHNScore(post.upvotesCount, post.createdAt);

        await db
          .update(schema.posts)
          .set({ score: newScore })
          .where(eq(schema.posts.id, post.id));
      }

      console.log(`[Cron] Updated scores for ${recentPosts.length} posts`);
    } catch (error) {
      console.error('[Cron] Error updating scores:', error);
    }
  },
};
