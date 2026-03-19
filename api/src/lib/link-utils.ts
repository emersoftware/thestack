/**
 * Extract links from HTML content
 */
export function extractLinks(html: string): string[] {
  const seen = new Set<string>();
  const links: string[] = [];

  const hrefRegex = /<a\s+[^>]*href=["']([^"']+)["'][^>]*>/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    const url = match[1];
    if (!url.startsWith('https://')) continue;
    if (seen.has(url)) continue;
    if (isTrackingOrUnsubscribe(url)) continue;
    seen.add(url);
    links.push(url);
  }

  return links;
}

/**
 * Extract links from plain text content
 */
export function extractLinksFromText(text: string): string[] {
  const seen = new Set<string>();
  const links: string[] = [];
  const urlRegex = /https?:\/\/[^\s<>"')\]]+/gi;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    const url = match[0].replace(/[.,;:!?]+$/, '');
    if (!url.startsWith('https://')) continue;
    if (seen.has(url)) continue;
    if (isTrackingOrUnsubscribe(url)) continue;
    seen.add(url);
    links.push(url);
  }

  return links;
}

/**
 * Strip tracking/UTM parameters from URLs
 */
export function cleanUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const paramsToRemove = [...parsed.searchParams.keys()].filter((k) => {
      const lower = k.toLowerCase();
      return lower.startsWith('utm_') || lower === '_gl' || lower === 'ref' ||
        lower === 'source' || lower === 'mc_cid' || lower === 'mc_eid';
    });
    for (const param of paramsToRemove) {
      parsed.searchParams.delete(param);
    }
    const clean = parsed.toString();
    return clean.endsWith('?') ? clean.slice(0, -1) : clean;
  } catch {
    return url;
  }
}

/**
 * Check if URL is a tracking/unsubscribe link
 */
export function isTrackingOrUnsubscribe(url: string): boolean {
  const lower = url.toLowerCase();
  const patterns = [
    'unsubscribe',
    'manage-preferences',
    'email-preferences',
    'opt-out',
    'tracking',
    'click.convertkit',
    'click.mailchimp',
    'list-manage.com',
    'email.mg.',
    'sendgrid.net',
    'ct.sendgrid',
    'mandrillapp.com',
    'mailgun.org',
    'link.mail.',
  ];
  return patterns.some((p) => lower.includes(p));
}
