/**
 * extract domain from a URL
 * removes www. prefix for consistency
 */
export function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * generate a UUID
 */
export function generateId(): string {
  return crypto.randomUUID();
}

/**
 * validate URL format
 */
export function isValidUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * calculate Hacker News-style ranking score
 * formula: (max(0, upvotes - 1) + boost) / (ageHours + ageOffsetHours)^gravity
 * - boost gives new posts initial visibility
 * - upvotes - 1 discounts author's auto-upvote
 * - posts decay over time (gravity controls decay speed)
 * - ageOffsetHours prevents division by zero and smooths early ranking
 */
export interface ScoringParams {
  gravity: number;
  boost: number;
  ageOffsetHours: number;
}

export const DEFAULT_SCORING_PARAMS: ScoringParams = {
  gravity: 1.5,
  boost: 1.0,
  ageOffsetHours: 2.0,
};

const HOUR_IN_MS = 1000 * 60 * 60;

export function calculateHNScore(
  upvotes: number,
  createdAt: Date,
  params: ScoringParams = DEFAULT_SCORING_PARAMS,
): number {
  const ageInHours = (Date.now() - createdAt.getTime()) / HOUR_IN_MS;
  const score =
    (Math.max(0, upvotes - 1) + params.boost) / Math.pow(ageInHours + params.ageOffsetHours, params.gravity);
  return score;
}

/**
 * convert a title to a URL-safe slug
 * - converts to lowercase
 * - normalizes accents (café → cafe)
 * - replaces dots with hyphens (5.5 → 5-5)
 * - removes special characters
 * - replaces spaces with hyphens
 * - limits to 100 characters
 */
export function generateSlug(title: string): string {
  const slug = title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // remove accents
    .replace(/\./g, '-')               // dots → hyphens (5.5 → 5-5)
    .replace(/[^a-z0-9\s-]/g, '')      // remove special chars
    .replace(/\s+/g, '-')              // spaces → hyphens
    .replace(/-+/g, '-')               // multiple hyphens → single
    .replace(/^-|-$/g, '')             // trim hyphens from ends
    .slice(0, 100);

  return slug || 'post';
}

/**
 * check if a string is a valid UUID
 */
export function isUUID(str: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(str);
}

export const FEED_TYPES = ['email', 'rss', 'blog'] as const;
export type FeedType = (typeof FEED_TYPES)[number];

export const FEED_BOT_USER_AGENT = 'TheStack-FeedBot/1.0';

/**
 * escape special characters for HTML/XML output
 */
export function escapeHtml(text: string): string {
  const entities: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return text.replace(/[&<>"']/g, (c) => entities[c] || c);
}

/**
 * Run db.batch() in chunks. D1 caps the number of statements per batch, so
 * call sites that update many rows at once must split the work.
 *
 * Chunks run sequentially because batch ordering matters across statements.
 */
export async function batchInChunks<T extends { batch: (stmts: never) => Promise<unknown> }>(
  db: T,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  statements: any[],
  chunkSize = 25,
): Promise<void> {
  for (let i = 0; i < statements.length; i += chunkSize) {
    const slice = statements.slice(i, i + chunkSize);
    if (slice.length === 0) continue;
    await db.batch(slice as never);
  }
}

export type FetchErrorCode =
  | 'url_not_allowed'
  | 'redirect_disallowed'
  | 'timeout'
  | 'fetch_failed'
  | `HTTP ${number}`;

/**
 * Reduce an arbitrary fetch/agent error to a short stable code suitable for
 * persisting in user-visible logs. Full details should still go to
 * console.error so the worker logs retain the stack trace.
 */
export function classifyFetchError(err: unknown): FetchErrorCode {
  if (err instanceof Error) {
    const msg = err.message;
    if (msg === 'url_not_allowed' || msg === 'redirect_disallowed') return msg;
    if (err.name === 'AbortError' || err.name === 'TimeoutError') return 'timeout';
    if (msg.startsWith('HTTP ')) return msg as `HTTP ${number}`;
  }
  return 'fetch_failed';
}

/**
 * Fetch with manual redirect handling so each hop is SSRF-checked, plus a
 * timeout. Returns the final Response and the final URL (after redirects).
 *
 * Throws an Error with .message in the FetchErrorCode set on guard failures
 * (`url_not_allowed`, `redirect_disallowed`, `HTTP NNN`). AbortError on timeout.
 */
export async function safeFetch(
  url: string,
  init: { headers?: Record<string, string>; timeoutMs?: number; maxHops?: number } = {},
): Promise<{ response: Response; finalUrl: string }> {
  if (!isPublicHttpUrl(url)) throw new Error('url_not_allowed');

  const { headers, timeoutMs = 15_000, maxHops = 5 } = init;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let currentUrl = url;
  try {
    for (let hop = 0; hop < maxHops; hop++) {
      const response = await fetch(currentUrl, {
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });
      if (response.status < 300 || response.status >= 400) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { response, finalUrl: currentUrl };
      }
      const next = response.headers.get('location');
      if (!next) {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return { response, finalUrl: currentUrl };
      }
      const resolved = new URL(next, currentUrl).toString();
      if (!isPublicHttpUrl(resolved)) throw new Error('redirect_disallowed');
      currentUrl = resolved;
    }
    throw new Error('redirect_disallowed');
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * SSRF guard. Returns true only when the URL is safe to fetch from a
 * server-side worker: http(s) protocol, public hostname, public IP.
 *
 * Rejects:
 *   - non-http(s) protocols (file:, gopher:, dict:, javascript:, ...)
 *   - localhost / 0.0.0.0
 *   - RFC1918 IPv4 (10/8, 172.16/12, 192.168/16)
 *   - loopback IPv4 (127/8) and current-network (0/8)
 *   - link-local (169.254/16)
 *   - IPv6 loopback (::1), unique-local (fc00::/7), link-local (fe80::/10)
 */
export function isPublicHttpUrl(rawUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false;

  const host = parsed.hostname.toLowerCase();
  if (host === '' || host === 'localhost' || host === '0.0.0.0') return false;

  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 0) return false;
    if (a === 10) return false;
    if (a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a >= 224) return false; // multicast / reserved
    return true;
  }

  // Strip optional brackets from IPv6 literals
  const ipv6 = host.startsWith('[') && host.endsWith(']') ? host.slice(1, -1) : host;
  if (ipv6 === '::1' || ipv6 === '::') return false;
  if (/^fe[89ab][0-9a-f]:/i.test(ipv6)) return false; // fe80::/10 link-local
  if (/^f[cd][0-9a-f]{2}:/i.test(ipv6)) return false; // fc00::/7 unique-local
  if (/^::ffff:/i.test(ipv6)) {
    // IPv4-mapped IPv6 — recurse with the embedded IPv4
    const v4 = ipv6.replace(/^::ffff:/i, '');
    if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(v4)) {
      return isPublicHttpUrl(`${parsed.protocol}//${v4}`);
    }
  }

  return true;
}
