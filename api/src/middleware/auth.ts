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
  isSuperAdmin: boolean;
};

export type AuthVariables = {
  user: AuthUser | null;
};

/**
 * Filters duplicate cookies from the Cookie header.
 * When multiple cookies with the same name exist (e.g., from different domains),
 * keeps only the FIRST occurrence.
 * TEMPORARY: Can be removed after 2025-12-18
 *
 * Why FIRST: The new cross-subdomain cookies on .thestack.cl are typically sent
 * before old host-only cookies on api.thestack.cl by Safari and most browsers.
 */
function filterDuplicateCookies(cookieHeader: string | null | undefined): string {
  if (!cookieHeader) return '';

  const cookieMap = new Map<string, string>();

  for (const cookie of cookieHeader.split(';')) {
    const trimmed = cookie.trim();
    const name = trimmed.split('=')[0];
    if (name) {
      // Only set if not already present (first wins)
      if (!cookieMap.has(name)) {
        cookieMap.set(name, trimmed);
      }
    }
  }

  return Array.from(cookieMap.values()).join('; ');
}

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

  // Filter duplicate cookies to prevent conflicts from old domain cookies
  // TEMPORARY: Can be removed after 2025-12-18
  const originalCookies = c.req.header('Cookie');
  const filteredCookies = filterDuplicateCookies(originalCookies);

  let headers: Headers;
  if (filteredCookies && filteredCookies !== originalCookies) {
    headers = new Headers(c.req.raw.headers);
    headers.set('Cookie', filteredCookies);
  } else {
    headers = c.req.raw.headers;
  }

  const session = await auth.api.getSession({ headers });

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
      isSuperAdmin: schema.users.isSuperAdmin,
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
    isSuperAdmin: dbUser.isSuperAdmin ?? false,
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

/**
 * Middleware: Require super admin privileges
 * Returns 401 if not authenticated, 403 if banned or not super admin
 */
export function requireSuperAdmin() {
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

    if (!user.isSuperAdmin) {
      return c.json({ error: 'Requiere privilegios de super admin' }, 403);
    }

    return next();
  };
}
