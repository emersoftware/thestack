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
import comments from './routes/comments';
import * as schema from './db/schema';
import { calculateHNScore } from './lib/utils';
import { sendWeeklyNewsletter } from './lib/newsletter';
import type { Env } from './lib/auth';
import { sessionMiddleware, type AuthVariables } from './middleware/auth';

const app = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

app.use('*', logger());

// TEMPORARY: Expire old cookies on api.thestack.cl domain
// Can be removed after 2025-12-18
// Note: Cookie filtering for auth routes is handled in routes/auth.ts
app.use('*', async (c, next) => {
  await next();

  if (c.env.ENVIRONMENT === 'production') {
    // Expire old session cookies on api.thestack.cl
    // Try both with and without Domain attribute to handle host-only cookies
    c.header(
      'Set-Cookie',
      '__Secure-better-auth.session_token=; Path=/; Domain=api.thestack.cl; Max-Age=0; Secure; HttpOnly; SameSite=Lax',
      { append: true }
    );
    c.header(
      'Set-Cookie',
      '__Secure-better-auth.session_token=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax',
      { append: true }
    );

    // Expire state cookie everywhere EXCEPT callback routes
    if (!c.req.path.includes('/callback/')) {
      // Try both with and without Domain attribute to handle host-only cookies
      c.header(
        'Set-Cookie',
        '__Secure-better-auth.state=; Path=/; Domain=api.thestack.cl; Max-Age=0; Secure; HttpOnly; SameSite=Lax',
        { append: true }
      );
      c.header(
        'Set-Cookie',
        '__Secure-better-auth.state=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax',
        { append: true }
      );
    }
  }
});

app.use(
  '*',
  cors({
    origin: (origin, c) => {
      const allowed = [c.env.FRONTEND_URL, 'https://thestack.cl'].filter(Boolean);
      return allowed.includes(origin) ? origin : allowed[0];
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

// Apply session middleware to routes that need user context
// NOT to /api/auth/* (better-auth handles its own routes)
app.use('/api/posts/*', sessionMiddleware);
app.use('/api/comments/*', sessionMiddleware);
app.use('/api/users/*', sessionMiddleware);
app.use('/api/admin/*', sessionMiddleware);
app.use('/api/sites/*', sessionMiddleware);

app.route('/api/health', health);
app.route('/api/auth', auth);
app.route('/api/posts', posts);
app.route('/api/users', users);
app.route('/api/sites', sites);
app.route('/api/admin', admin);
app.route('/api/comments', comments);

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

    // Score recalculation - runs every 10 minutes
    if (event.cron === '*/10 * * * *') {
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
    }

    // Weekly newsletter - runs Monday at 18:00 UTC (15:00 Chile summer / 14:00 Chile winter)
    if (event.cron === '0 18 * * 2') {
      try {
        console.log('[Cron] Starting weekly newsletter...');
        const result = await sendWeeklyNewsletter(env);
        console.log(
          `[Cron] Newsletter completed: ${result.sent} sent, ${result.errors} errors`
        );
      } catch (error) {
        console.error('[Cron] Error sending newsletter:', error);
      }
    }
  },
};
