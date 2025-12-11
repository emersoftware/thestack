import { Context, Next } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import { createAuth, type Env } from '../lib/auth';
import * as schema from '../db/schema';

export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  username: string;
  karma: number;
  isAdmin: boolean;
  isBanned: boolean;
};

export type AuthVariables = {
  user: AuthUser | null;
};

/**
 * Session middleware - loads session and fresh user data from DB
 * Attaches user to context (or null if unauthenticated)
 * Does NOT block requests - just provides data
 */
export async function sessionMiddleware(
  c: Context<{ Bindings: Env; Variables: AuthVariables }>,
  next: Next
) {
  const auth = createAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });

  if (!session?.user) {
    c.set('user', null);
    return next();
  }

  // Fetch fresh user data from DB (isAdmin, isBanned may have changed)
  const db = drizzle(c.env.DB, { schema });
  const [dbUser] = await db
    .select({
      id: schema.users.id,
      email: schema.users.email,
      emailVerified: schema.users.emailVerified,
      username: schema.users.username,
      karma: schema.users.karma,
      isAdmin: schema.users.isAdmin,
      isBanned: schema.users.isBanned,
    })
    .from(schema.users)
    .where(eq(schema.users.id, session.user.id))
    .limit(1);

  if (!dbUser) {
    c.set('user', null);
    return next();
  }

  c.set('user', {
    id: dbUser.id,
    email: dbUser.email,
    emailVerified: dbUser.emailVerified ?? false,
    username: dbUser.username,
    karma: dbUser.karma ?? 0,
    isAdmin: dbUser.isAdmin ?? false,
    isBanned: dbUser.isBanned ?? false,
  });

  return next();
}

/**
 * Middleware: Require authenticated user
 * Returns 401 if not authenticated, 403 if banned
 */
export function requireAuth() {
  return async (
    c: Context<{ Bindings: Env; Variables: AuthVariables }>,
    next: Next
  ) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'No autenticado' }, 401);
    }

    if (user.isBanned) {
      return c.json({ error: 'Tu cuenta ha sido suspendida' }, 403);
    }

    return next();
  };
}

/**
 * Middleware: Require verified email
 * Returns 401 if not authenticated, 403 if banned or email not verified
 */
export function requireVerifiedEmail() {
  return async (
    c: Context<{ Bindings: Env; Variables: AuthVariables }>,
    next: Next
  ) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'No autenticado' }, 401);
    }

    if (user.isBanned) {
      return c.json({ error: 'Tu cuenta ha sido suspendida' }, 403);
    }

    if (!user.emailVerified) {
      return c.json({ error: 'Debes verificar tu email' }, 403);
    }

    return next();
  };
}

/**
 * Middleware: Require admin privileges
 * Returns 401 if not authenticated, 403 if banned or not admin
 */
export function requireAdmin() {
  return async (
    c: Context<{ Bindings: Env; Variables: AuthVariables }>,
    next: Next
  ) => {
    const user = c.get('user');

    if (!user) {
      return c.json({ error: 'No autenticado' }, 401);
    }

    if (user.isBanned) {
      return c.json({ error: 'Tu cuenta ha sido suspendida' }, 403);
    }

    if (!user.isAdmin) {
      return c.json({ error: 'No autorizado' }, 403);
    }

    return next();
  };
}
