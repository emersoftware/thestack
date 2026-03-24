import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, gte, or } from 'drizzle-orm';
import health from './routes/health';
import auth from './routes/auth';
import posts from './routes/posts';
import users from './routes/users';
import sites from './routes/sites';
import admin from './routes/admin';
import comments from './routes/comments';
import track from './routes/track';
import feeds from './routes/feeds';
import * as schema from './db/schema';
import { calculateHNScore } from './lib/utils';
import { getScoringConfig } from './lib/scoring';
import { sendWeeklyNewsletter, createWeeklyDraft } from './lib/newsletter';
import { handleIncomingEmail } from './lib/email-handler';
import { fetchAndProcessRssFeeds } from './lib/rss-fetcher';
import { fetchAndProcessBlogFeeds } from './lib/blog-fetcher';
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
app.use('/api/feeds/*', sessionMiddleware);

app.route('/api/track', track);
app.route('/api/health', health);
app.route('/api/auth', auth);
app.route('/api/posts', posts);
app.route('/api/users', users);
app.route('/api/sites', sites);
app.route('/api/admin', admin);
app.route('/api/feeds', feeds);
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

  async email(message: ForwardableEmailMessage, env: Env, ctx: ExecutionContext) {
    await handleIncomingEmail(message, env, ctx);
  },

  async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    const db = drizzle(env.DB, { schema });

    // Score recalculation - runs every 10 minutes
    if (event.cron === '*/10 * * * *') {
      try {
        const config = await getScoringConfig(db);
        const cutoffTime = new Date(Date.now() - config.recalcWindowHours * 60 * 60 * 1000);
        const scoringParams = { gravity: config.gravity, boost: config.boost, ageOffsetHours: config.ageOffsetHours };

        const recentPosts = await db
          .select({
            id: schema.posts.id,
            upvotesCount: schema.posts.upvotesCount,
            publishedAt: schema.posts.publishedAt,
            createdAt: schema.posts.createdAt,
          })
          .from(schema.posts)
          .where(
            and(
              or(
                gte(schema.posts.publishedAt, cutoffTime),
                gte(schema.posts.createdAt, cutoffTime)
              ),
              eq(schema.posts.isDeleted, false),
              eq(schema.posts.status, 'published')
            )
          );

        const updates = recentPosts.map((post) => {
          const newScore = calculateHNScore(post.upvotesCount, post.publishedAt ?? post.createdAt, scoringParams);
          return db.update(schema.posts).set({ score: newScore }).where(eq(schema.posts.id, post.id));
        });

        if (updates.length > 0) {
          await db.batch(updates as [typeof updates[0], ...typeof updates]);
        }

        console.log(`[Cron] Updated scores for ${recentPosts.length} posts (gravity=${config.gravity}, window=${config.recalcWindowHours}h)`);
      } catch (error) {
        console.error('[Cron] Error updating scores:', error);
      }
    }

    // Create weekly draft - runs Friday at 18:00 UTC
    if (event.cron === '0 18 * * FRI') {
      try {
        // Check if newsletter is paused
        const [nlConfig] = await db
          .select()
          .from(schema.newsletterConfig)
          .where(eq(schema.newsletterConfig.id, 'default'))
          .limit(1);
        if (nlConfig?.paused) {
          console.log('[Cron] Newsletter is paused, skipping draft creation');
        } else {
          console.log('[Cron] Creating weekly newsletter draft...');
          const draft = await createWeeklyDraft(env);
          console.log(`[Cron] Draft created/found: ${draft.id} - "${draft.subject}"`);
        }
      } catch (error) {
        console.error('[Cron] Error creating newsletter draft:', error);
      }
    }

    // RSS and blog feed check - runs daily at 12:00 UTC (9:00 Chile summer / 8:00 Chile winter)
    // Use ctx.waitUntil to avoid timeout — feed processing involves external HTTP + AI calls
    if (event.cron === '0 12 * * *') {
      console.log('[Cron] Checking RSS and blog feeds...');
      ctx.waitUntil(
        Promise.all([
          fetchAndProcessRssFeeds(env),
          fetchAndProcessBlogFeeds(env),
        ])
          .then(() => console.log('[Cron] Feed check completed'))
          .catch((error) => console.error('[Cron] Error processing feeds:', error))
      );
    }

    // Weekly newsletter - runs Monday at 18:00 UTC (15:00 Chile summer / 14:00 Chile winter)
    if (event.cron === '0 18 * * MON') {
      try {
        // Check if newsletter is paused
        const [nlConfig] = await db
          .select()
          .from(schema.newsletterConfig)
          .where(eq(schema.newsletterConfig.id, 'default'))
          .limit(1);
        if (nlConfig?.paused) {
          console.log('[Cron] Newsletter is paused, skipping send');
        } else {
          console.log('[Cron] Starting weekly newsletter...');
          const result = await sendWeeklyNewsletter(env);
          console.log(
            `[Cron] Newsletter completed: ${result.sent} sent, ${result.errors} errors`
          );
        }
      } catch (error) {
        console.error('[Cron] Error sending newsletter:', error);
      }
    }
  },
};
