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
 * formula: (max(0, upvotes - 1) + BOOST) / (ageHours + 2)^GRAVITY
 * - BOOST gives new posts initial visibility
 * - upvotes - 1 discounts author's auto-upvote
 * - posts decay over time (GRAVITY = 1.2 for small communities)
 * - +2 hours prevents division by zero and smooths early ranking
 */
const GRAVITY = 1.2;
const BOOST = 1.0;
const HOUR_IN_MS = 1000 * 60 * 60;

export function calculateHNScore(upvotes: number, createdAt: Date): number {
  const ageInHours = (Date.now() - createdAt.getTime()) / HOUR_IN_MS;
  const score = (Math.max(0, upvotes - 1) + BOOST) / Math.pow(ageInHours + 2, GRAVITY);
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
