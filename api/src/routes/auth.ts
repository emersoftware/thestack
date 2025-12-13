import { Hono } from 'hono';
import { createAuth, type Env } from '../lib/auth';

const auth = new Hono<{ Bindings: Env }>();

/**
 * TEMPORARY: Endpoint to clear old cookies before OAuth flow
 * Call this from frontend BEFORE initiating GitHub OAuth
 * Can be removed after 2025-12-18
 */
auth.post('/clear-legacy-cookies', async (c) => {
  if (c.env.ENVIRONMENT === 'production') {
    // Expire state cookies - both with and without Domain attribute
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
    // Expire session cookies - both with and without Domain attribute
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
  }
  return c.json({ ok: true });
});

/**
 * Filters duplicate cookies - keeps only the FIRST occurrence of each cookie name.
 * TEMPORARY: Can be removed after 2025-12-18
 *
 * Why FIRST instead of LAST:
 * - Better Auth creates new state cookie on .thestack.cl during sign-in
 * - Old state cookies may exist on api.thestack.cl
 * - Safari (and most browsers) send parent domain cookies (.thestack.cl) first
 * - So the FIRST occurrence is likely the correct/new cookie
 */
function filterDuplicateCookies(cookieHeader: string | null): string {
  if (!cookieHeader) return '';

  const cookies = new Map<string, string>();

  // Parse cookies - FIRST one wins (don't override)
  cookieHeader.split(';').forEach(cookie => {
    const [name, ...rest] = cookie.trim().split('=');
    if (name && rest.length > 0) {
      const trimmedName = name.trim();
      // Only set if not already present (first wins)
      if (!cookies.has(trimmedName)) {
        cookies.set(trimmedName, rest.join('='));
      }
    }
  });

  // Rebuild cookie header
  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

/**
 * Removes all state cookies from the header.
 * Used on sign-in routes to ensure Better Auth creates a fresh state cookie.
 * TEMPORARY: Can be removed after 2025-12-18
 */
function removeStateCookies(cookieHeader: string | null): string {
  if (!cookieHeader) return '';

  return cookieHeader
    .split(';')
    .map(c => c.trim())
    .filter(cookie => {
      const name = cookie.split('=')[0];
      return name !== '__Secure-better-auth.state';
    })
    .join('; ');
}

auth.on(['GET', 'POST'], '/*', async (c) => {
  const authInstance = createAuth(c.env);

  // TEMPORARY: Cookie filtering for cross-subdomain migration
  // Can be removed after 2025-12-18
  if (c.env.ENVIRONMENT === 'production') {
    const originalCookies = c.req.raw.headers.get('cookie');

    // Only process if there are actual cookies
    if (originalCookies) {
      let processedCookies: string;

      // For sign-in routes: remove ALL state cookies so Better Auth creates a fresh one
      if (c.req.path.includes('/sign-in/')) {
        processedCookies = removeStateCookies(originalCookies);
      } else {
        // For other routes (callback, get-session, etc): just filter duplicates
        processedCookies = filterDuplicateCookies(originalCookies);
      }

      // Only create new request if cookies were actually modified
      if (processedCookies && processedCookies !== originalCookies) {
        const newHeaders = new Headers(c.req.raw.headers);
        newHeaders.set('cookie', processedCookies);

        // Use Request constructor with existing request as base - handles body cloning internally
        const newRequest = new Request(c.req.raw, { headers: newHeaders });
        return authInstance.handler(newRequest);
      }
    }
  }

  return authInstance.handler(c.req.raw);
});

export default auth;
