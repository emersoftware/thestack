import { Hono } from 'hono';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { eq, and, asc, inArray, sql } from 'drizzle-orm';
import { createAuth, type Env } from '../lib/auth';
import * as schema from '../db/schema';
import { generateId } from '../lib/utils';

const comments = new Hono<{ Bindings: Env }>();

const createCommentSchema = z.object({
  content: z.string().min(1, 'Comentario requerido').max(10000, 'Comentario muy largo'),
  parentId: z.string().optional(),
});

async function getSession(c: { env: Env; req: { raw: Request } }) {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  return session;
}

// Get comments for a post
comments.get('/post/:postId', async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const postId = c.req.param('postId');
  const session = await getSession(c);

  try {
    const result = await db
      .select({
        id: schema.comments.id,
        postId: schema.comments.postId,
        parentId: schema.comments.parentId,
        content: schema.comments.content,
        likesCount: schema.comments.likesCount,
        isDeleted: schema.comments.isDeleted,
        createdAt: schema.comments.createdAt,
        authorId: schema.comments.authorId,
        authorUsername: schema.users.username,
      })
      .from(schema.comments)
      .leftJoin(schema.users, eq(schema.comments.authorId, schema.users.id))
      .where(eq(schema.comments.postId, postId))
      .orderBy(asc(schema.comments.createdAt));

    // Get user's liked comment IDs if logged in
    let myLikedIds: Set<string> = new Set();
    if (session?.user) {
      const commentIds = result.map((c) => c.id);
      if (commentIds.length > 0) {
        const myLikes = await db
          .select({ commentId: schema.commentLikes.commentId })
          .from(schema.commentLikes)
          .where(
            and(
              eq(schema.commentLikes.userId, session.user.id),
              inArray(schema.commentLikes.commentId, commentIds)
            )
          );
        myLikedIds = new Set(myLikes.map((l) => l.commentId));
      }
    }

    const formattedComments = result.map((comment) => ({
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      content: comment.isDeleted ? '[eliminado]' : comment.content,
      likesCount: comment.likesCount,
      hasLiked: myLikedIds.has(comment.id),
      isDeleted: comment.isDeleted,
      createdAt: comment.createdAt ? new Date(comment.createdAt).toISOString() : null,
      author: {
        id: comment.authorId,
        username: comment.isDeleted ? '[eliminado]' : (comment.authorUsername || 'unknown'),
      },
    }));

    return c.json({ comments: formattedComments });
  } catch (error) {
    console.error('Error fetching comments:', error);
    return c.json({ error: 'Error al obtener comentarios' }, 500);
  }
});

// Create a comment
comments.post('/post/:postId', async (c) => {
  const session = await getSession(c);
  if (!session?.user) {
    return c.json({ error: 'Debes iniciar sesión para comentar' }, 401);
  }

  if (!session.user.emailVerified) {
    return c.json({ error: 'Debes verificar tu email para comentar' }, 403);
  }

  const db = drizzle(c.env.DB, { schema });
  const postId = c.req.param('postId');

  try {
    // Verify post exists
    const post = await db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(and(eq(schema.posts.id, postId), eq(schema.posts.isDeleted, false)))
      .limit(1);

    if (post.length === 0) {
      return c.json({ error: 'Post no encontrado' }, 404);
    }

    const body = await c.req.json();
    const validation = createCommentSchema.safeParse(body);
    if (!validation.success) {
      return c.json({ error: validation.error.issues[0].message }, 400);
    }

    const { content, parentId } = validation.data;

    // Verify parent comment exists if provided
    if (parentId) {
      const parent = await db
        .select({ id: schema.comments.id })
        .from(schema.comments)
        .where(and(eq(schema.comments.id, parentId), eq(schema.comments.postId, postId)))
        .limit(1);

      if (parent.length === 0) {
        return c.json({ error: 'Comentario padre no encontrado' }, 404);
      }
    }

    const now = new Date();
    const commentId = generateId();

    await db.insert(schema.comments).values({
      id: commentId,
      postId,
      authorId: session.user.id,
      parentId: parentId || null,
      content,
      likesCount: 1,
      isDeleted: false,
      createdAt: now,
      updatedAt: now,
    });

    // Auto-like own comment (like posts)
    await db.insert(schema.commentLikes).values({
      id: generateId(),
      commentId,
      userId: session.user.id,
      createdAt: now,
    });

    const created = await db
      .select({
        id: schema.comments.id,
        postId: schema.comments.postId,
        parentId: schema.comments.parentId,
        content: schema.comments.content,
        likesCount: schema.comments.likesCount,
        isDeleted: schema.comments.isDeleted,
        createdAt: schema.comments.createdAt,
        authorId: schema.comments.authorId,
        authorUsername: schema.users.username,
      })
      .from(schema.comments)
      .leftJoin(schema.users, eq(schema.comments.authorId, schema.users.id))
      .where(eq(schema.comments.id, commentId))
      .limit(1);

    const comment = created[0];
    return c.json({
      id: comment.id,
      postId: comment.postId,
      parentId: comment.parentId,
      content: comment.content,
      likesCount: comment.likesCount,
      hasLiked: true,
      isDeleted: comment.isDeleted,
      createdAt: comment.createdAt ? new Date(comment.createdAt).toISOString() : null,
      author: {
        id: comment.authorId,
        username: comment.authorUsername || 'unknown',
      },
    }, 201);
  } catch (error) {
    console.error('Error creating comment:', error);
    return c.json({ error: 'Error al crear comentario' }, 500);
  }
});

// Delete a comment (soft delete)
comments.delete('/:id', async (c) => {
  const session = await getSession(c);
  if (!session?.user) {
    return c.json({ error: 'Debes iniciar sesión' }, 401);
  }

  const db = drizzle(c.env.DB, { schema });
  const commentId = c.req.param('id');

  try {
    const existing = await db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.id, commentId))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: 'Comentario no encontrado' }, 404);
    }

    const comment = existing[0];
    const user = session.user as { id: string; isAdmin?: boolean };

    if (comment.authorId !== user.id && !user.isAdmin) {
      return c.json({ error: 'No tienes permiso para eliminar este comentario' }, 403);
    }

    await db
      .update(schema.comments)
      .set({ isDeleted: true, updatedAt: new Date() })
      .where(eq(schema.comments.id, commentId));

    return c.json({ success: true });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return c.json({ error: 'Error al eliminar comentario' }, 500);
  }
});

// Toggle like on a comment
comments.post('/:id/like', async (c) => {
  const session = await getSession(c);
  if (!session?.user) {
    return c.json({ error: 'Debes iniciar sesión para dar like' }, 401);
  }

  if (!session.user.emailVerified) {
    return c.json({ error: 'Debes verificar tu email para dar like' }, 403);
  }

  const db = drizzle(c.env.DB, { schema });
  const commentId = c.req.param('id');
  const userId = session.user.id;

  try {
    const existing = await db
      .select()
      .from(schema.comments)
      .where(eq(schema.comments.id, commentId))
      .limit(1);

    if (existing.length === 0) {
      return c.json({ error: 'Comentario no encontrado' }, 404);
    }

    const comment = existing[0];

    if (comment.isDeleted) {
      return c.json({ error: 'No puedes dar like a un comentario eliminado' }, 400);
    }

    const existingLike = await db
      .select()
      .from(schema.commentLikes)
      .where(
        and(
          eq(schema.commentLikes.commentId, commentId),
          eq(schema.commentLikes.userId, userId)
        )
      )
      .limit(1);

    let hasLiked: boolean;
    let newCount: number;

    if (existingLike.length > 0) {
      // Remove like
      await db
        .delete(schema.commentLikes)
        .where(
          and(
            eq(schema.commentLikes.commentId, commentId),
            eq(schema.commentLikes.userId, userId)
          )
        );

      await db
        .update(schema.comments)
        .set({
          likesCount: sql`${schema.comments.likesCount} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.comments.id, commentId));

      await db
        .update(schema.users)
        .set({ karma: sql`${schema.users.karma} - 1` })
        .where(eq(schema.users.id, comment.authorId));

      hasLiked = false;
      newCount = comment.likesCount - 1;
    } else {
      // Add like
      await db.insert(schema.commentLikes).values({
        id: generateId(),
        commentId,
        userId,
        createdAt: new Date(),
      });

      await db
        .update(schema.comments)
        .set({
          likesCount: sql`${schema.comments.likesCount} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(schema.comments.id, commentId));

      await db
        .update(schema.users)
        .set({ karma: sql`${schema.users.karma} + 1` })
        .where(eq(schema.users.id, comment.authorId));

      hasLiked = true;
      newCount = comment.likesCount + 1;
    }

    return c.json({ hasLiked, likesCount: newCount });
  } catch (error) {
    console.error('Error toggling comment like:', error);
    return c.json({ error: 'Error al dar like' }, 500);
  }
});

export default comments;
