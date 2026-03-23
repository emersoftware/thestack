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
