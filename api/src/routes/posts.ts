import { Hono } from 'hono';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { eq, desc, and, sql, gte } from 'drizzle-orm';
import { createAuth, type Env } from '../lib/auth';
import * as schema from '../db/schema';
import { extractDomain, generateId, isValidUrl, calculateHNScore } from '../lib/utils';

const posts = new Hono<{ Bindings: Env }>();

const createPostSchema = z.object({
  title: z.string().min(1, 'Título requerido').max(300, 'Título muy largo (max 300)'),
  url: z.string().url('URL inválida').refine(isValidUrl, 'URL debe ser http o https'),
});

async function getSession(c: { env: Env; req: { raw: Request } }) {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session;
}

posts.get('/', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const sort = c.req.query('sort') || 'hot';
  const page = parseInt(c.req.query('page') || '1', 10);
  const limit = 30;
  const offset = (page - 1) * limit;

  try {
    const orderBy = sort === 'new'
      ? desc(schema.posts.createdAt)
      : desc(schema.posts.score);

    const postsResult = await db
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
      .where(eq(schema.posts.isDeleted, false))
      .orderBy(orderBy)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = postsResult.length > limit;
    const postsToReturn = hasMore ? postsResult.slice(0, limit) : postsResult;

    const formattedPosts = postsToReturn.map((post) => ({
      id: post.id,
      title: post.title,
      url: post.url,
      domain: post.domain,
      upvotesCount: post.upvotesCount,
      score: post.score,
      createdAt: post.createdAt ? new Date(post.createdAt).toISOString() : null,
      author: {
        id: post.authorId,
        username: post.authorUsername || 'unknown',
      },
    }));

    return c.json({ posts: formattedPosts, hasMore });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return c.json({ error: 'Error al obtener posts' }, 500);
  }
});

// must be defined before /:id to avoid route collision
posts.get('/my-upvotes', async (c) => {
  const session = await getSession(c);
  if (!session?.user) {
    return c.json({ postIds: [] });
  }

  const db = drizzle(c.env.DB, { schema });

  try {
    const upvotes = await db
      .select({ postId: schema.postUpvotes.postId })
      .from(schema.postUpvotes)
      .where(eq(schema.postUpvotes.userId, session.user.id));

    return c.json({ postIds: upvotes.map((u) => u.postId) });
  } catch (error) {
    console.error('Error fetching user upvotes:', error);
    return c.json({ error: 'Error al obtener votos' }, 500);
  }
});

posts.get('/:id', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const postId = c.req.param('id');

  try {
    const result = await db
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
      .where(and(eq(schema.posts.id, postId), eq(schema.posts.isDeleted, false)))
      .limit(1);

    if (result.length === 0) {
      return c.json({ error: 'Post no encontrado' }, 404);
    }

    const post = result[0];
    return c.json({
      id: post.id,
      title: post.title,
      url: post.url,
      domain: post.domain,
      upvotesCount: post.upvotesCount,
      score: post.score,
      createdAt: post.createdAt ? new Date(post.createdAt).toISOString() : null,
      author: {
        id: post.authorId,
        username: post.authorUsername || 'unknown',
      },
    });
  } catch (error) {
    console.error('Error fetching post:', error);
    return c.json({ error: 'Error al obtener post' }, 500);
  }
});

posts.post('/', async (c) => {
  const session = await getSession(c);
  if (!session?.user) {
    return c.json({ error: 'Debes iniciar sesión para publicar' }, 401);
  }

  if (!session.user.emailVerified) {
    return c.json({ error: 'Debes verificar tu email para publicar' }, 403);
  }

  const db = drizzle(c.env.DB, { schema });
  const TEN_MINUTES = 10 * 60 * 1000;
  const recentPost = await db
    .select({ createdAt: schema.posts.createdAt })
    .from(schema.posts)
    .where(
      and(
        eq(schema.posts.authorId, session.user.id),
        gte(schema.posts.createdAt, new Date(Date.now() - TEN_MINUTES))
      )
    )
    .limit(1);

  if (recentPost.length > 0) {
    return c.json({ error: 'Debes esperar 10 minutos entre posts' }, 429);
  }

  const ONE_DAY = 24 * 60 * 60 * 1000;
  const todayPosts = await db
    .select({ count: sql<number>`count(*)` })
    .from(schema.posts)
    .where(
      and(
        eq(schema.posts.authorId, session.user.id),
        gte(schema.posts.createdAt, new Date(Date.now() - ONE_DAY))
      )
    );

  if ((todayPosts[0]?.count || 0) >= 5) {
    return c.json({ error: 'Has alcanzado el limite de 5 posts por dia' }, 429);
  }

  try {
    const body = await c.req.json();
    const validation = createPostSchema.safeParse(body);
    if (!validation.success) {
      return c.json({
        error: validation.error.issues[0].message
      }, 400);
    }

    const { title, url } = validation.data;
    const domain = extractDomain(url);

    if (!domain) {
      return c.json({ error: 'URL inválida' }, 400);
    }

    const existingPost = await db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(eq(schema.posts.url, url))
      .limit(1);

    if (existingPost.length > 0) {
      return c.json({
        error: 'Esta URL ya fue publicada',
        existingPostId: existingPost[0].id
      }, 409);
    }

    const now = new Date();
    const postId = generateId();
    const initialScore = calculateHNScore(1, now);

    await db.insert(schema.posts).values({
      id: postId,
      title,
      url,
      domain,
      authorId: session.user.id,
      upvotesCount: 1,
      score: initialScore,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });

    await db.insert(schema.postUpvotes).values({
      id: generateId(),
      postId,
      userId: session.user.id,
      createdAt: now,
    });

    await db
      .update(schema.users)
      .set({ karma: sql`${schema.users.karma} + 1` })
      .where(eq(schema.users.id, session.user.id));

    const createdPost = await db
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
      .where(eq(schema.posts.id, postId))
      .limit(1);

    const post = createdPost[0];
    return c.json({
      id: post.id,
      title: post.title,
      url: post.url,
      domain: post.domain,
      upvotesCount: post.upvotesCount,
      score: post.score,
      createdAt: post.createdAt ? new Date(post.createdAt).toISOString() : null,
      author: {
        id: post.authorId,
        username: post.authorUsername || 'unknown',
      },
    }, 201);
  } catch (error) {
    console.error('Error creating post:', error);
    return c.json({ error: 'Error al crear post' }, 500);
  }
});

posts.delete('/:id', async (c) => {
  const session = await getSession(c);
  if (!session?.user) {
    return c.json({ error: 'Debes iniciar sesión' }, 401);
  }

  const db = drizzle(c.env.DB, { schema });
  const postId = c.req.param('id');

  try {
    const existingPost = await db
      .select()
      .from(schema.posts)
      .where(eq(schema.posts.id, postId))
      .limit(1);

    if (existingPost.length === 0) {
      return c.json({ error: 'Post no encontrado' }, 404);
    }

    const post = existingPost[0];
    const user = session.user as { id: string; isAdmin?: boolean };
    if (post.authorId !== user.id && !user.isAdmin) {
      return c.json({ error: 'No tienes permiso para eliminar este post' }, 403);
    }

    await db
      .update(schema.posts)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(schema.posts.id, postId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting post:', error);
    return c.json({ error: 'Error al eliminar post' }, 500);
  }
});

posts.post('/:id/upvote', async (c) => {
  const session = await getSession(c);
  if (!session?.user) {
    return c.json({ error: 'Debes iniciar sesión para votar' }, 401);
  }

  if (!session.user.emailVerified) {
    return c.json({ error: 'Debes verificar tu email para votar' }, 403);
  }

  const db = drizzle(c.env.DB, { schema });
  const postId = c.req.param('id');
  const userId = session.user.id;

  try {
    const existingPost = await db
      .select()
      .from(schema.posts)
      .where(and(eq(schema.posts.id, postId), eq(schema.posts.isDeleted, false)))
      .limit(1);

    if (existingPost.length === 0) {
      return c.json({ error: 'Post no encontrado' }, 404);
    }

    const post = existingPost[0];

    const existingUpvote = await db
      .select()
      .from(schema.postUpvotes)
      .where(
        and(
          eq(schema.postUpvotes.postId, postId),
          eq(schema.postUpvotes.userId, userId)
        )
      )
      .limit(1);

    let hasUpvoted: boolean;
    let newCount: number;

    if (existingUpvote.length > 0) {
      // Use returning to verify the delete actually removed a row (race condition protection)
      const deleted = await db
        .delete(schema.postUpvotes)
        .where(
          and(
            eq(schema.postUpvotes.postId, postId),
            eq(schema.postUpvotes.userId, userId)
          )
        )
        .returning({ id: schema.postUpvotes.id });

      // Only decrement if we actually deleted something
      if (deleted.length > 0) {
        await db
          .update(schema.posts)
          .set({
            upvotesCount: sql`CASE WHEN ${schema.posts.upvotesCount} > 0 THEN ${schema.posts.upvotesCount} - 1 ELSE 0 END`,
            updatedAt: new Date(),
          })
          .where(eq(schema.posts.id, postId));

        await db
          .update(schema.users)
          .set({
            karma: sql`${schema.users.karma} - 1`,
          })
          .where(eq(schema.users.id, post.authorId));
      }

      hasUpvoted = false;
      newCount = Math.max(0, post.upvotesCount - 1);
    } else {
      // Use try-catch to handle unique constraint violation (race condition protection)
      try {
        await db.insert(schema.postUpvotes).values({
          id: generateId(),
          postId,
          userId,
          createdAt: new Date(),
        });

        await db
          .update(schema.posts)
          .set({
            upvotesCount: sql`${schema.posts.upvotesCount} + 1`,
            updatedAt: new Date(),
          })
          .where(eq(schema.posts.id, postId));

        await db
          .update(schema.users)
          .set({
            karma: sql`${schema.users.karma} + 1`,
          })
          .where(eq(schema.users.id, post.authorId));

        hasUpvoted = true;
        newCount = post.upvotesCount + 1;
      } catch (insertError: unknown) {
        // If insert fails due to unique constraint, the upvote already exists (race condition)
        if (insertError instanceof Error && insertError.message.includes('UNIQUE constraint')) {
          hasUpvoted = true;
          newCount = post.upvotesCount;
        } else {
          throw insertError;
        }
      }
    }

    return c.json({ hasUpvoted, upvotesCount: newCount });
  } catch (error) {
    console.error('Error toggling upvote:', error);
    return c.json({ error: 'Error al votar' }, 500);
  }
});

posts.get('/:id/upvote/status', async (c) => {
  const session = await getSession(c);
  if (!session?.user) {
    return c.json({ hasUpvoted: false });
  }

  const db = drizzle(c.env.DB, { schema });
  const postId = c.req.param('id');

  try {
    const upvote = await db
      .select()
      .from(schema.postUpvotes)
      .where(
        and(
          eq(schema.postUpvotes.postId, postId),
          eq(schema.postUpvotes.userId, session.user.id)
        )
      )
      .limit(1);

    return c.json({ hasUpvoted: upvote.length > 0 });
  } catch (error) {
    console.error('Error checking upvote status:', error);
    return c.json({ error: 'Error al verificar voto' }, 500);
  }
});

export default posts;
