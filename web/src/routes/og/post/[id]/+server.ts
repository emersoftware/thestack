import { PUBLIC_API_URL } from '$env/static/public';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, fetch }) => {
  const postRes = await fetch(`${PUBLIC_API_URL}/api/posts/${params.id}`);

  if (!postRes.ok) {
    return new Response('Post not found', { status: 404 });
  }

  const post = await postRes.json();
  const title = post.title || 'the stack';
  const domain = post.domain || '';
  const author = post.author?.username || '';

  // Escape special characters for SVG
  const escapeXml = (str: string) =>
    str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');

  // Word wrap function for title
  const wrapText = (text: string, maxCharsPerLine: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);

    // Limit to 3 lines max
    if (lines.length > 3) {
      lines.length = 3;
      lines[2] = lines[2].slice(0, -3) + '...';
    }

    return lines;
  };

  const titleLines = wrapText(title, 35);
  const titleY = 315 - (titleLines.length - 1) * 35;

  const titleTspans = titleLines
    .map(
      (line, i) =>
        `<tspan x="600" dy="${i === 0 ? 0 : 70}">${escapeXml(line)}</tspan>`
    )
    .join('');

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <!-- White background -->
  <rect x="0" y="0" width="1200" height="630" fill="#f5f5f5"/>

  <!-- Logo in top left (60x60, scaled 1.5x from 40x40) -->
  <g transform="translate(60, 60)">
    <defs>
      <clipPath id="og-logo-mask">
        <rect x="0" y="0" width="60" height="60" rx="9"/>
      </clipPath>
    </defs>
    <rect x="0" y="0" width="60" height="60" rx="9" fill="#141414"/>
    <g clip-path="url(#og-logo-mask)">
      <rect x="3" y="3" width="30" height="9" rx="4.5" fill="#f5f5f5"/>
      <rect x="3" y="15" width="30" height="9" rx="4.5" fill="#f5f5f5"/>
      <rect x="3" y="27" width="30" height="13.5" rx="6" fill="#f5f5f5"/>
      <rect x="3" y="43.5" width="30" height="45" rx="6" fill="#f5f5f5"/>
    </g>
  </g>

  <!-- Site name next to logo -->
  <text x="140" y="102" font-family="system-ui, -apple-system, sans-serif" font-size="32" font-weight="600" fill="#141414">the stack</text>

  <!-- Post title centered -->
  <text x="600" y="${titleY}" font-family="system-ui, -apple-system, sans-serif" font-size="56" font-weight="700" fill="#141414" text-anchor="middle" dominant-baseline="middle">
    ${titleTspans}
  </text>

  <!-- Domain and author at bottom -->
  <text x="600" y="540" font-family="system-ui, -apple-system, sans-serif" font-size="24" fill="#666666" text-anchor="middle">
    ${domain ? `<tspan>${escapeXml(domain)}</tspan>` : ''}${domain && author ? '<tspan> · </tspan>' : ''}${author ? `<tspan>@${escapeXml(author)}</tspan>` : ''}
  </text>
</svg>`;

  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600'
    }
  });
};
