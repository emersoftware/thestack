import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { and, eq, isNull } from 'drizzle-orm';
import type { Env } from '../lib/auth';
import * as schema from '../db/schema';
import { createAuth } from '../lib/auth';

const track = new Hono<{ Bindings: Env }>();

function generateId(): string {
  return crypto.randomUUID();
}

/**
 * Best-effort user ID extraction from session cookie.
 * Does NOT block on failure — returns null if unauthenticated.
 */
async function getBestEffortUserId(c: any): Promise<string | null> {
  try {
    const auth = createAuth(c.env);
    const session = await auth.api.getSession({ headers: c.req.raw.headers });
    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

// POST /api/track/pageview
track.post('/pageview', async (c) => {
  const db = drizzle(c.env.DB, { schema });

  try {
    const body = await c.req.json<{ path: string; referrer?: string }>();
    if (!body.path) return c.body(null, 204);

    const userId = await getBestEffortUserId(c);
    const userAgent = c.req.header('User-Agent') ?? null;

    await db.insert(schema.pageViews).values({
      id: generateId(),
      userId,
      path: body.path,
      referrer: body.referrer ?? null,
      userAgent,
      createdAt: new Date(),
    });
  } catch {
    // Fire and forget — never fail tracking
  }

  return c.body(null, 204);
});

// POST /api/track/click
track.post('/click', async (c) => {
  const db = drizzle(c.env.DB, { schema });

  try {
    const body = await c.req.json<{ postId: string }>();
    if (!body.postId) return c.body(null, 204);

    const userId = await getBestEffortUserId(c);

    await db.insert(schema.linkClicks).values({
      id: generateId(),
      postId: body.postId,
      userId,
      createdAt: new Date(),
    });
  } catch {
    // Fire and forget
  }

  return c.body(null, 204);
});

// GET /api/track/open?token=xxx — 1x1 transparent GIF pixel
const TRANSPARENT_GIF = new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
  0x80, 0x00, 0x00, 0xff, 0xff, 0xff, 0x00, 0x00, 0x00, 0x21,
  0xf9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2c, 0x00, 0x00,
  0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
  0x01, 0x00, 0x3b,
]);

track.get('/open', async (c) => {
  const token = c.req.query('token');

  if (token) {
    const db = drizzle(c.env.DB, { schema });
    try {
      // Only record the first open — prevents bots and re-fetches from
      // overwriting openedAt and distorting metrics.
      await db
        .update(schema.newsletterOpens)
        .set({ openedAt: new Date() })
        .where(
          and(
            eq(schema.newsletterOpens.token, token),
            isNull(schema.newsletterOpens.openedAt)
          )
        );
    } catch {
      // Fire and forget
    }
  }

  return c.body(TRANSPARENT_GIF, 200, {
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, no-cache, must-revalidate',
  });
});

export default track;
